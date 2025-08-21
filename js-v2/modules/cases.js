// Cases Module - Handles case management
window.cases = {
    currentCase: null,
    currentCases: [],
    
    // Initialize module
    async init() {
        console.log('Initializing cases module...');
    },
    
    // Load cases from storage and backend
    async loadCases() {
        try {
            // Check if we need to auto-resume a case
            const resumeData = sessionStorage.getItem('resumeCase');
            if (resumeData) {
                sessionStorage.removeItem('resumeCase');
                const { caseNumber } = JSON.parse(resumeData);
                console.log('Auto-resuming case:', caseNumber);
                setTimeout(() => {
                    this.resumeCase(caseNumber);
                }, 100);
                return;
            }
            
            // Get local cases
            const localCases = window.storage.get('cases') || [];
            
            // Get backend cases if connected
            if (window.wallet && window.wallet.connected) {
                const url = getApiUrl('getCases', { serverAddress: window.wallet.address });
                console.log('Fetching cases from:', url);
                console.log('Using server address:', window.wallet.address);
                
                const response = await fetch(url, {
                    headers: {
                        'X-Server-Address': window.wallet.address
                    }
                });
                
                console.log('Cases fetch response:', response.status, response.statusText);
                
                if (response.ok) {
                    const backendResponse = await response.json();
                    console.log('Backend cases response:', backendResponse);
                    
                    // Extract cases array from response
                    let backendCases = [];
                    if (backendResponse.success && backendResponse.cases) {
                        backendCases = backendResponse.cases;
                    } else if (Array.isArray(backendResponse)) {
                        backendCases = backendResponse;
                    }
                    
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
        
        // Ensure backend is an array
        if (!Array.isArray(backend)) {
            console.warn('Backend response is not an array:', backend);
            // If backend returned an object with cases array, use that
            if (backend && backend.cases && Array.isArray(backend.cases)) {
                backend = backend.cases;
            } else {
                return merged; // Return local cases only
            }
        }
        
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
        // Store current cases for reference
        this.currentCases = cases;
        
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
        
        tbody.innerHTML = cases.map(c => {
            // Handle different case formats from backend and local storage
            const caseId = c.caseNumber || c.case_number || c.id || 'Unknown';
            const createdDate = c.created_at || c.createdAt || Date.now();
            const pageCount = c.page_count || c.pageCount || c.documentCount || 0;
            const status = c.status || 'Active';
            
            return `
                <tr>
                    <td>
                        <a href="#" onclick="cases.viewCase('${caseId}'); return false;">
                            ${caseId}
                        </a>
                    </td>
                    <td>${new Date(createdDate).toLocaleDateString()}</td>
                    <td>${pageCount} pages</td>
                    <td>
                        <span class="badge bg-${this.getStatusColor(status)}">
                            ${status}
                        </span>
                    </td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-primary" onclick="cases.resumeCase('${caseId}')" title="Resume">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                            ${(c.served_at || c.servedAt || c.status === 'served' || c.transactionHash) ? `
                                <button class="btn btn-sm btn-success" onclick="cases.printReceipt('${caseId}')" title="Print Receipt">
                                    <i class="bi bi-printer"></i>
                                </button>
                                <button class="btn btn-sm btn-info" onclick="cases.exportStamped('${caseId}')" title="Export Stamped">
                                    <i class="bi bi-file-earmark-pdf"></i>
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-danger" onclick="cases.deleteCase('${caseId}', '${c.server_address || window.wallet.address}')" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
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
                        'X-Server-Address': window.wallet.address
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
                    const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
                    const response = await fetch(`${backendUrl}/api/cases/${caseNumber}`, {
                        headers: {
                            'X-Server-Address': window.wallet.address
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
            
            // Set the currentCaseId in app so preview knows it's already saved
            if (window.app) {
                window.app.currentCaseId = caseData.id || caseData.caseId || caseNumber;
                window.app.consolidatedPDFUrl = `${getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com'}/api/cases/${window.app.currentCaseId}/pdf`;
                console.log('Set currentCaseId for resumed case:', window.app.currentCaseId);
            }
            
            // Navigate to serve page
            window.app.navigate('serve');
            
            // Wait for page to load before filling fields
            await new Promise(resolve => setTimeout(resolve, 100));
            
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
                            // Use the first recipient input by class
                            const firstInput = document.querySelector('.recipient-input');
                            if (firstInput) {
                                firstInput.value = recipient;
                            }
                        } else {
                            // Add additional recipient fields if needed
                            window.app.addRecipientField();
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
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            
            // First, show the UI that indicates existing documents
            if (window.app && window.app.showExistingCaseDocuments) {
                await window.app.showExistingCaseDocuments(caseData);
                console.log('Existing case documents UI displayed');
            }
            
            // Now fetch the actual PDF from backend to populate the file queue
            if (caseData.pdf_path) {
                try {
                    const response = await fetch(`${backendUrl}/api/cases/${caseId}/pdf`, {
                        headers: {
                            'X-Server-Address': window.wallet.address
                        }
                    });
                    
                    if (response.ok) {
                        const blob = await response.blob();
                        const fileName = `Case_${caseId}_documents.pdf`;
                        const file = new File([blob], fileName, { type: 'application/pdf' });
                        
                        // Replace placeholder with actual PDF
                        window.app.state.fileQueue = [{
                            file: file,
                            id: Date.now(),
                            name: fileName,
                            size: file.size,
                            isExisting: true,
                            fromBackend: true
                        }];
                        
                        // Update the display to show the actual file
                        window.app.displayFileQueue();
                        
                        // Store the consolidated PDF URL for preview
                        window.app.consolidatedPDFUrl = `${backendUrl}/api/cases/${caseId}/pdf`;
                        window.app.currentCaseId = caseId;
                        
                        console.log('Backend PDF loaded into file queue');
                    } else {
                        console.error('Failed to fetch PDF from backend');
                    }
                } catch (fetchError) {
                    console.error('Error fetching PDF:', fetchError);
                    // Keep the placeholder if fetch fails
                }
            }
            
        } catch (error) {
            console.error('Error loading case documents:', error);
        }
    },
    
    // View case details
    async viewCase(caseNumber) {
        // First try to get from the current loaded cases
        let caseData = null;
        if (this.currentCases) {
            caseData = this.currentCases.find(c => 
                c.caseNumber === caseNumber || 
                c.id === caseNumber || 
                c.case_number === caseNumber
            );
        }
        
        // If not found in current cases, try backend
        if (!caseData && window.wallet && window.wallet.connected) {
            try {
                const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
                const response = await fetch(`${backendUrl}/api/cases/by-number/${caseNumber}?serverAddress=${window.wallet.address}`, {
                    headers: {
                        'X-Server-Address': window.wallet.address
                    }
                });
                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.case) {
                        caseData = result.case;
                    }
                }
            } catch (error) {
                console.error('Failed to fetch case:', error);
            }
        }
        
        // Fall back to local storage
        if (!caseData) {
            caseData = window.storage.getCase(caseNumber);
        }
        
        if (!caseData) {
            window.app.showError('Case not found');
            return;
        }
        
        this.displayCaseDetails(caseData);
    },
    
    // Display case details modal with document previews
    displayCaseDetails(caseData) {
        // Get case ID and prepare preview URLs
        const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
        const caseId = caseData.caseNumber || caseData.case_number || caseData.id;
        const alertPreviewUrl = `${backendUrl}/api/cases/${caseId}/preview`;
        const pdfUrl = `${backendUrl}/api/cases/${caseId}/pdf?serverAddress=${encodeURIComponent(window.wallet.address)}`;
        
        const modalHtml = `
            <div class="modal fade" id="caseDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Case: ${caseData.caseNumber || caseData.case_number || caseId}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <!-- Case Info Row -->
                            <div class="row mb-3">
                                <div class="col-md-4">
                                    <strong>Created:</strong> ${new Date(caseData.createdAt || caseData.created_at).toLocaleString()}
                                </div>
                                <div class="col-md-4">
                                    <strong>Status:</strong> 
                                    <span class="badge bg-${this.getStatusColor(caseData.status || 'pending')}">
                                        ${caseData.status || 'Awaiting Service'}
                                    </span>
                                </div>
                                <div class="col-md-4">
                                    <strong>Recipients:</strong> ${caseData.recipient_count || caseData.recipientCount || 0}
                                </div>
                            </div>
                            
                            <!-- Document Previews Section -->
                            <h6>Document Previews</h6>
                            <div class="row mb-4">
                                <div class="col-md-6">
                                    <div class="card">
                                        <div class="card-header bg-primary text-white">
                                            <i class="bi bi-bell-fill"></i> Alert Notice
                                        </div>
                                        <div class="card-body p-2" style="height: 400px; overflow: hidden;">
                                            <img src="${alertPreviewUrl}" 
                                                 alt="Alert Notice Preview" 
                                                 class="img-fluid" 
                                                 style="width: 100%; height: 100%; object-fit: contain;"
                                                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjIwMCIgeT0iMTUwIiBzdHlsZT0iZmlsbDojYWFhO2ZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjE5cHg7Zm9udC1mYW1pbHk6QXJpYWwsSGVsdmV0aWNhLHNhbnMtc2VyaWY7ZG9taW5hbnQtYmFzZWxpbmU6Y2VudHJhbCI+UHJldmlldyBOb3QgQXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg=='">
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card">
                                        <div class="card-header bg-success text-white">
                                            <i class="bi bi-file-earmark-text-fill"></i> Legal Documents
                                        </div>
                                        <div class="card-body p-2" style="height: 400px;">
                                            <iframe src="${pdfUrl}" 
                                                    style="width: 100%; height: 100%; border: none;"
                                                    title="Document Preview">
                                            </iframe>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <h6>Service Details</h6>
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
                            <button class="btn btn-info" onclick="cases.showFullPreview('${caseId}')" data-bs-dismiss="modal">
                                <i class="bi bi-eye-fill"></i> Full Preview
                            </button>
                            <button class="btn btn-primary" onclick="cases.resumeCase('${caseData.caseNumber || caseData.case_number || caseId}')" data-bs-dismiss="modal">
                                <i class="bi bi-arrow-clockwise"></i> Resume Case
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
    
    // Show full preview using the existing preview modal from app.js
    async showFullPreview(caseId) {
        try {
            // Get case data
            let caseData = null;
            
            // First try from current cases
            if (this.currentCases) {
                caseData = this.currentCases.find(c => 
                    c.caseNumber === caseId || 
                    c.case_number === caseId || 
                    c.id === caseId
                );
            }
            
            // If not found, fetch from backend
            if (!caseData) {
                const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
                const response = await fetch(`${backendUrl}/api/cases/${caseId}`, {
                    headers: {
                        'X-Server-Address': window.wallet.address
                    }
                });
                
                if (response.ok) {
                    const result = await response.json();
                    caseData = result.case;
                }
            }
            
            if (!caseData) {
                window.app.showError('Case not found');
                return;
            }
            
            // Set up app state to use existing preview functionality
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            window.app.currentCaseId = caseId;
            window.app.consolidatedPDFUrl = `${backendUrl}/api/cases/${caseId}/pdf`;
            
            // Set up pending form data from case metadata
            const metadata = caseData.metadata || {};
            window.app.pendingFormData = {
                caseNumber: caseData.caseNumber || caseData.case_number || caseId,
                issuingAgency: metadata.issuingAgency || caseData.issuing_agency || 'The Block Service',
                noticeType: metadata.noticeType || caseData.notice_type || 'Legal Notice',
                noticeText: metadata.noticeText || 'Legal document for service',
                responseDeadline: metadata.responseDeadline || '',
                recipients: metadata.recipients || caseData.recipients || []
            };
            
            // Set up file queue with a placeholder to indicate we have existing documents
            // This prevents the "upload at least one PDF" error
            window.app.state.fileQueue = [{
                file: new File(['existing'], 'Existing case documents.pdf', { type: 'application/pdf' }),
                preview: null,
                isExisting: true
            }];
            
            // Call the existing preview function
            await window.app.previewNotice();
            
        } catch (error) {
            console.error('Error showing full preview:', error);
            window.app.showError('Failed to load preview: ' + error.message);
        }
    },
    
    // Delete a case
    async deleteCase(caseNumber, serverAddress) {
        // Confirm deletion
        if (!confirm(`Are you sure you want to delete case ${caseNumber}?\n\nThis will remove the case from the backend database. This action cannot be undone.`)) {
            return;
        }
        
        try {
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            const response = await fetch(`${backendUrl}/api/cases/${caseNumber}`, {
                method: 'DELETE',
                headers: {
                    'X-Server-Address': serverAddress || window.wallet.address
                }
            });
            
            if (response.ok) {
                window.app.showSuccess(`Case ${caseNumber} deleted successfully`);
                
                // Remove from local storage if present
                const localCases = window.storage.get('cases') || [];
                const updatedCases = localCases.filter(c => 
                    c.caseNumber !== caseNumber && 
                    c.case_number !== caseNumber && 
                    c.id !== caseNumber
                );
                window.storage.set('cases', updatedCases);
                
                // Reload cases
                await this.loadCases();
            } else {
                const error = await response.text();
                window.app.showError(`Failed to delete case: ${error}`);
            }
        } catch (error) {
            console.error('Error deleting case:', error);
            window.app.showError('Failed to delete case: ' + error.message);
        }
    },
    
    // Print proof of service receipt
    async printReceipt(caseId) {
        try {
            // Get case data
            let caseData = this.getCaseData(caseId);
            
            if (!caseData) {
                window.app.showError('Case not found');
                return;
            }
            
            // Ensure we have the required proof of service data
            if (!caseData.transactionHash && !caseData.transaction_hash) {
                window.app.showError('No transaction hash found for this case. Please ensure the case has been served.');
                return;
            }
            
            // Prepare case data for receipt generation
            const receiptData = {
                caseNumber: caseData.caseNumber || caseData.case_number || caseId,
                serverAddress: caseData.serverAddress || caseData.server_address || window.wallet?.address,
                servedAt: caseData.servedAt || caseData.served_at || new Date().toISOString(),
                transactionHash: caseData.transactionHash || caseData.transaction_hash,
                alertTokenId: caseData.alertTokenId || caseData.alert_token_id || caseData.alertNftId,
                documentTokenId: caseData.documentTokenId || caseData.document_token_id || caseData.documentNftId,
                recipients: caseData.recipients || caseData.metadata?.recipients || [],
                documents: caseData.documents || [],
                agency: caseData.agency || caseData.metadata?.issuingAgency || caseData.metadata?.agency,
                noticeType: caseData.noticeType || caseData.metadata?.noticeType || 'Legal Notice',
                metadata: caseData.metadata || {},
                alertImage: caseData.alertImage || caseData.alertPreview || caseData.alertThumbnail || caseData.alert_image
            };
            
            // Check if proofOfService module is loaded
            if (!window.proofOfService) {
                console.error('Proof of Service module not loaded');
                window.app.showError('Proof of Service module not available. Please refresh the page.');
                return;
            }
            
            // Generate and print the receipt
            await window.proofOfService.printReceipt(receiptData);
            
        } catch (error) {
            console.error('Failed to print receipt:', error);
            window.app.showError('Failed to print receipt: ' + error.message);
        }
    },
    
    // Export stamped documents with delivery confirmation
    async exportStamped(caseId) {
        try {
            // Get case data
            let caseData = this.getCaseData(caseId);
            
            if (!caseData) {
                window.app.showError('Case not found');
                return;
            }
            
            // Ensure we have IPFS document
            const ipfsHash = caseData.ipfsDocument || caseData.ipfs_document || 
                           caseData.metadata?.ipfsHash || caseData.metadata?.ipfs_hash;
            
            if (!ipfsHash) {
                window.app.showError('No IPFS document found for this case');
                return;
            }
            
            // Prepare case data for stamping
            const stampData = {
                caseNumber: caseData.caseNumber || caseData.case_number || caseId,
                servedAt: caseData.servedAt || caseData.served_at || new Date().toISOString(),
                transactionHash: caseData.transactionHash || caseData.transaction_hash || 'N/A',
                ipfsDocument: ipfsHash,
                metadata: caseData.metadata || {}
            };
            
            // Check if proofOfService module is loaded
            if (!window.proofOfService) {
                console.error('Proof of Service module not loaded');
                window.app.showError('Proof of Service module not available. Please refresh the page.');
                return;
            }
            
            // Export stamped documents
            await window.proofOfService.exportStampedDocuments(stampData);
            
        } catch (error) {
            console.error('Failed to export stamped documents:', error);
            window.app.showError('Failed to export stamped documents: ' + error.message);
        }
    },
    
    // Helper function to get case data from various sources
    getCaseData(caseId) {
        // First check current cases
        if (this.currentCases) {
            const found = this.currentCases.find(c => 
                c.caseNumber === caseId || 
                c.case_number === caseId || 
                c.id === caseId
            );
            if (found) return found;
        }
        
        // Check local storage
        const localCases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
        const localCase = localCases.find(c => 
            c.caseNumber === caseId || 
            c.case_number === caseId || 
            c.id === caseId
        );
        if (localCase) return localCase;
        
        // Check storage module
        const storageCases = window.storage?.get('cases') || [];
        const storageCase = storageCases.find(c => 
            c.caseNumber === caseId || 
            c.case_number === caseId || 
            c.id === caseId
        );
        
        return storageCase;
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