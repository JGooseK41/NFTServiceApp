// Cases Module - Handles case management
window.cases = {
    currentCase: null,
    
    // Initialize module
    async init() {
        console.log('Initializing cases module...');
    },
    
    // Load cases from storage and backend
    async loadCases() {
        try {
            // Get local cases
            const localCases = window.storage.get('cases') || [];
            
            // Get backend cases if connected
            if (window.wallet && window.wallet.connected) {
                const response = await fetch(getApiUrl('getCases'), {
                    headers: {
                        'X-Wallet-Address': window.wallet.address
                    }
                });
                
                if (response.ok) {
                    const backendCases = await response.json();
                    
                    // Merge cases
                    const merged = this.mergeCases(localCases, backendCases);
                    this.displayCases(merged);
                    return;
                }
            }
            
            // Display local cases only
            this.displayCases(localCases);
            
        } catch (error) {
            console.error('Failed to load cases:', error);
            this.displayCases([]);
        }
    },
    
    // Merge local and backend cases
    mergeCases(local, backend) {
        const merged = [...local];
        
        backend.forEach(bCase => {
            const exists = merged.find(c => c.caseNumber === bCase.caseNumber);
            if (!exists) {
                merged.push(bCase);
            } else {
                // Update with backend data
                Object.assign(exists, bCase);
            }
        });
        
        return merged.sort((a, b) => b.createdAt - a.createdAt);
    },
    
    // Display cases in table
    displayCases(cases) {
        const tbody = document.getElementById('casesTableBody');
        if (!tbody) return;
        
        if (cases.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted">No cases found</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = cases.map(c => `
            <tr>
                <td>
                    <a href="#" onclick="cases.viewCase('${c.caseNumber}'); return false;">
                        ${c.caseNumber}
                    </a>
                </td>
                <td>${new Date(c.createdAt).toLocaleDateString()}</td>
                <td>${c.documentCount || 0} documents</td>
                <td>
                    <span class="badge bg-${this.getStatusColor(c.status)}">
                        ${c.status || 'Active'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="cases.resumeCase('${c.caseNumber}')">
                        Resume
                    </button>
                    <button class="btn btn-sm btn-info" onclick="cases.viewReceipts('${c.caseNumber}')">
                        Receipts
                    </button>
                </td>
            </tr>
        `).join('');
    },
    
    // Get status color
    getStatusColor(status) {
        switch(status) {
            case 'Completed': return 'success';
            case 'Active': return 'primary';
            case 'Pending': return 'warning';
            default: return 'secondary';
        }
    },
    
    // Create new case
    async newCase() {
        const caseNumber = prompt('Enter case number:');
        if (!caseNumber) return;
        
        const caseData = {
            caseNumber,
            createdAt: Date.now(),
            status: 'Active',
            documentCount: 0,
            notices: []
        };
        
        // Save locally
        window.storage.saveCase(caseData);
        
        // Save to backend if connected
        if (window.wallet && window.wallet.connected) {
            try {
                await fetch(getApiUrl('createCase'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Wallet-Address': window.wallet.address
                    },
                    body: JSON.stringify(caseData)
                });
            } catch (error) {
                console.error('Failed to save case to backend:', error);
            }
        }
        
        this.currentCase = caseData;
        await this.loadCases();
        
        // Navigate to serve page
        window.app.navigate('serve');
        
        // Pre-fill case number
        const caseInput = document.getElementById('caseNumber');
        if (caseInput) {
            caseInput.value = caseNumber;
        }
    },
    
    // Resume existing case
    async resumeCase(caseNumber) {
        try {
            // First try to get from backend if connected
            let caseData = null;
            
            if (window.wallet && window.wallet.connected) {
                try {
                    const response = await fetch(`${getConfig('backend.url')}/api/cases/get/${caseNumber}`, {
                        headers: {
                            'X-Wallet-Address': window.wallet.address
                        }
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        caseData = result.case;
                    }
                } catch (error) {
                    console.error('Failed to load case from backend:', error);
                }
            }
            
            // Fall back to local storage if not found
            if (!caseData) {
                caseData = window.storage.getCase(caseNumber);
            }
            
            if (!caseData) {
                window.app.showError('Case not found');
                return;
            }
            
            this.currentCase = caseData;
            
            // Navigate to serve page
            window.app.navigate('serve');
            
            // Pre-fill all form fields from saved case
            if (caseData.metadata) {
                const fields = ['caseNumber', 'noticeText', 'issuingAgency', 'noticeType', 
                               'caseDetails', 'responseDeadline', 'legalRights'];
                
                fields.forEach(field => {
                    const input = document.getElementById(field);
                    if (input && caseData.metadata[field]) {
                        input.value = caseData.metadata[field];
                    }
                });
                
                // Load recipients
                if (caseData.metadata.recipients && Array.isArray(caseData.metadata.recipients)) {
                    // Clear existing recipients
                    const recipientInputs = document.querySelectorAll('.recipient-input');
                    recipientInputs.forEach(input => input.value = '');
                    
                    // Add saved recipients
                    caseData.metadata.recipients.forEach((recipient, index) => {
                        if (index === 0) {
                            document.getElementById('recipientAddress').value = recipient;
                        } else {
                            // Add additional recipient fields if needed
                            window.app.addRecipient();
                            const inputs = document.querySelectorAll('.recipient-input');
                            if (inputs[index]) {
                                inputs[index].value = recipient;
                            }
                        }
                    });
                }
            }
            
            // Load documents if case has PDF
            if (caseData.pdf_path) {
                await this.loadCaseDocuments(caseData);
            }
            
            window.app.showSuccess(`Resumed case: ${caseNumber} - All data loaded from cloud`);
            
        } catch (error) {
            console.error('Error resuming case:', error);
            window.app.showError('Failed to resume case: ' + error.message);
        }
    },
    
    // Load documents from saved case
    async loadCaseDocuments(caseData) {
        try {
            const caseId = caseData.id || caseData.caseId || caseData.caseNumber;
            
            // Fetch PDF from backend
            const response = await fetch(`${getConfig('backend.url')}/api/cases/pdf/${caseId}`, {
                headers: {
                    'X-Wallet-Address': window.wallet.address
                }
            });
            
            if (!response.ok) {
                console.error('Failed to load case PDF');
                return;
            }
            
            const blob = await response.blob();
            const file = new File([blob], `${caseData.caseNumber || 'case'}.pdf`, { type: 'application/pdf' });
            
            // Add to document queue
            if (window.app && window.app.documentQueue) {
                window.app.documentQueue = [{
                    file: file,
                    id: Date.now(),
                    name: file.name
                }];
                
                // Update UI to show loaded document
                window.app.updateDocumentQueue();
                window.app.showInfo('Documents loaded from saved case');
            }
            
        } catch (error) {
            console.error('Error loading case documents:', error);
        }
    },
    
    // View case details
    async viewCase(caseNumber) {
        const caseData = window.storage.getCase(caseNumber);
        
        if (!caseData) {
            // Try to fetch from backend
            try {
                const response = await fetch(getApiUrl('getCase', { id: caseNumber }));
                if (response.ok) {
                    const data = await response.json();
                    this.displayCaseDetails(data);
                    return;
                }
            } catch (error) {
                console.error('Failed to fetch case:', error);
            }
            
            window.app.showError('Case not found');
            return;
        }
        
        this.displayCaseDetails(caseData);
    },
    
    // Display case details modal
    displayCaseDetails(caseData) {
        const modalHtml = `
            <div class="modal fade" id="caseDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Case: ${caseData.caseNumber}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <strong>Created:</strong> ${new Date(caseData.createdAt).toLocaleString()}
                                </div>
                                <div class="col-md-6">
                                    <strong>Status:</strong> 
                                    <span class="badge bg-${this.getStatusColor(caseData.status)}">
                                        ${caseData.status}
                                    </span>
                                </div>
                            </div>
                            
                            <h6>Notices Served</h6>
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Notice ID</th>
                                            <th>Recipient</th>
                                            <th>Type</th>
                                            <th>Date</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${caseData.notices && caseData.notices.length > 0 ? 
                                            caseData.notices.map(n => `
                                                <tr>
                                                    <td>${n.noticeId.substring(0, 8)}...</td>
                                                    <td>${this.formatAddress(n.recipient)}</td>
                                                    <td>${n.type}</td>
                                                    <td>${new Date(n.timestamp).toLocaleDateString()}</td>
                                                    <td>
                                                        <button class="btn btn-sm btn-info" 
                                                                onclick="window.open('https://blockserved.com/notice/${n.noticeId}')">
                                                            View
                                                        </button>
                                                    </td>
                                                </tr>
                                            `).join('') :
                                            '<tr><td colspan="5" class="text-center">No notices served yet</td></tr>'
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-primary" onclick="cases.resumeCase('${caseData.caseNumber}')" data-bs-dismiss="modal">
                                Resume Case
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('caseDetailsModal'));
        modal.show();
        
        // Clean up on close
        document.getElementById('caseDetailsModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },
    
    // View receipts for case
    async viewReceipts(caseNumber) {
        const receipts = window.storage.getReceipts();
        const caseReceipts = receipts.filter(r => r.caseNumber === caseNumber);
        
        if (caseReceipts.length === 0) {
            window.app.showInfo('No receipts found for this case');
            return;
        }
        
        // Navigate to receipts page with filter
        window.app.navigate('receipts');
        
        // Display filtered receipts
        if (window.receipts) {
            window.receipts.displayReceipts(caseReceipts);
        }
    },
    
    // Add notice to case
    addNoticeToCase(caseNumber, noticeData) {
        const caseData = window.storage.getCase(caseNumber);
        
        if (caseData) {
            if (!caseData.notices) {
                caseData.notices = [];
            }
            
            caseData.notices.push(noticeData);
            caseData.documentCount = caseData.notices.length;
            
            window.storage.saveCase(caseData);
        }
    },
    
    // Format address
    formatAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
};

console.log('Cases module loaded');