// Cases Module - Handles case management

// HTML escape helper to prevent XSS - used for all user input in templates
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Safe attribute helper - for onclick handlers and href attributes
function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

window.cases = {
    currentCase: null,
    currentCases: [],
    showAllNetworks: false,

    // Helper: Safe localStorage setItem with quota handling
    safeLocalStorageSet(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError' || error.code === 22) {
                console.warn('LocalStorage quota exceeded, triggering cleanup...');
                if (window.storage?.cleanup) {
                    window.storage.cleanup();
                }
                try {
                    localStorage.setItem(key, value);
                    return true;
                } catch (retryError) {
                    console.error('LocalStorage still full after cleanup');
                    return false;
                }
            }
            console.error('LocalStorage error:', error);
            return false;
        }
    },

    // Helper: Get address from recipient (handles both string and {address, label} formats)
    getRecipientAddress(recipient) {
        if (!recipient) return '';
        return typeof recipient === 'string' ? recipient : (recipient.address || '');
    },

    // Helper: Get label from recipient (returns null if no label)
    getRecipientLabel(recipient) {
        if (!recipient || typeof recipient === 'string') return null;
        return recipient.label || null;
    },

    // Helper: Format recipient for display (shows label if available, then address)
    formatRecipientDisplay(recipient) {
        const address = this.getRecipientAddress(recipient);
        const label = this.getRecipientLabel(recipient);
        if (label) {
            return `<span class="recipient-label-tag badge bg-info me-1">${label}</span><code>${address}</code>`;
        }
        return `<code>${address}</code>`;
    },

    // Helper: Get recipient for data attributes (just the address)
    getRecipientDataAttr(recipient) {
        return this.getRecipientAddress(recipient);
    },

    // Initialize module
    async init() {
        console.log('Initializing cases module...');
    },

    // Toggle network filter and reload cases
    toggleNetworkFilter(showAll) {
        this.showAllNetworks = showAll;
        this.loadCases();
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
            
            // Get local cases from storage module, strictly filtered by connected wallet
            const connectedWallet = window.wallet?.address?.toLowerCase() || '';
            const rawLocalCases = window.storage.get('cases') || [];
            const localCases = connectedWallet
                ? rawLocalCases.filter(c => {
                    const caseWallet = (c.serverAddress || c.server_address || '').toLowerCase();
                    // Strict: only show cases that explicitly belong to this wallet
                    return caseWallet === connectedWallet;
                })
                : [];  // No wallet connected = show nothing
            console.log('Local cases for wallet:', localCases.length, 'of', rawLocalCases.length);

            // Also check the legalnotice_cases storage (used by case-management-client)
            const rawLegalNoticeCases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
            const legalNoticeCases = connectedWallet
                ? rawLegalNoticeCases.filter(c => {
                    const caseWallet = (c.serverAddress || c.server_address || '').toLowerCase();
                    return caseWallet === connectedWallet;
                })
                : [];
            console.log('Legal notice cases for wallet:', legalNoticeCases.length, 'of', rawLegalNoticeCases.length);

            // Merge both sources of local cases
            const allLocalCases = [...localCases];
            legalNoticeCases.forEach(lnCase => {
                const exists = allLocalCases.find(c =>
                    c.caseNumber === lnCase.caseNumber ||
                    c.case_number === lnCase.case_number ||
                    c.id === lnCase.id
                );
                if (!exists) {
                    allLocalCases.push(lnCase);
                }
            });
            console.log('All local cases after merging:', allLocalCases.length);
            
            // Update network filter label
            const currentChain = window.getCurrentChainId ? window.getCurrentChainId() : 'tron-mainnet';
            const chainInfo = window.getChainInfo ? window.getChainInfo(currentChain) : null;
            const networkName = chainInfo?.name || (currentChain === 'tron-nile' ? 'Nile Testnet' : 'Mainnet');
            const filterLabel = document.getElementById('networkFilterName');
            if (filterLabel) {
                filterLabel.textContent = this.showAllNetworks ? 'All Networks' : networkName;
            }

            // Get backend cases if connected
            if (window.wallet && window.wallet.connected) {
                const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
                const chainParam = this.showAllNetworks ? '' : `?chain=${encodeURIComponent(currentChain)}`;
                const url = `${backendUrl}/api/cases${chainParam}`;
                console.log('Fetching cases from:', url);
                console.log('Using server address:', window.wallet.address);

                const response = await fetchWithTimeout(url, {
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
                    
                    // Fetch complete service data for each served case
                    const enrichedCases = await Promise.all(backendCases.map(async (caseData) => {
                        const caseNumber = caseData.case_number || caseData.caseNumber || caseData.id;

                        // Skip if no valid case number
                        if (!caseNumber) {
                            console.warn('Skipping case with no identifier:', caseData);
                            return caseData;
                        }

                        // If case is served, fetch complete service data
                        if (caseData.status === 'served' || caseData.transaction_hash || caseData.transactionHash) {
                            try {
                                const serviceResponse = await fetchWithTimeout(`${backendUrl}/api/cases/${encodeURIComponent(caseNumber)}/service-data`, {
                                    headers: {
                                        'X-Server-Address': window.wallet.address
                                    }
                                });
                                
                                if (serviceResponse.ok) {
                                    const serviceData = await serviceResponse.json();
                                    if (serviceData.success && serviceData.case) {
                                        console.log(`Enriched case ${caseNumber} with service data`);
                                        // Merge service data into case
                                        return { ...caseData, ...serviceData.case };
                                    }
                                }
                            } catch (error) {
                                console.error(`Failed to fetch service data for case ${caseNumber}:`, error);
                            }
                        }
                        
                        return caseData;
                    }));
                    
                    // Merge enriched backend cases with local cases
                    const merged = this.mergeCases(allLocalCases, enrichedCases);
                    this.displayCases(merged);
                    return;
                } else {
                    console.log('Backend not available, using local cases only');
                }
            }
            
            // Display all local cases (merged from both storage sources)
            console.log('Displaying local cases:', allLocalCases);
            this.displayCases(allLocalCases);
            
        } catch (error) {
            console.error('Failed to load cases:', error);
            // Still display local cases, strictly filtered by connected wallet
            const errorWallet = window.wallet?.address?.toLowerCase() || '';
            if (!errorWallet) {
                this.displayCases([]);
                return;
            }
            const rawCases = window.storage.get('cases') || [];
            const filteredCases = rawCases.filter(c => {
                const w = (c.serverAddress || c.server_address || '').toLowerCase();
                return w === errorWallet;
            });
            const rawLnCases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
            const filteredLnCases = rawLnCases.filter(c => {
                const w = (c.serverAddress || c.server_address || '').toLowerCase();
                return w === errorWallet;
            });
            const allLocalCases = [...filteredCases];
            filteredLnCases.forEach(lnCase => {
                const exists = allLocalCases.find(c =>
                    c.caseNumber === lnCase.caseNumber ||
                    c.case_number === lnCase.case_number ||
                    c.id === lnCase.id
                );
                if (!exists) {
                    allLocalCases.push(lnCase);
                }
            });
            console.log('Displaying local cases despite error:', allLocalCases.length);
            this.displayCases(allLocalCases);
        }
    },
    
    // Merge local and backend cases
    mergeCases(local, backend) {
        const merged = [];
        const processedIds = new Set();
        
        // Ensure backend is an array
        if (!Array.isArray(backend)) {
            console.warn('Backend response is not an array:', backend);
            // If backend returned an object with cases array, use that
            if (backend && backend.cases && Array.isArray(backend.cases)) {
                backend = backend.cases;
            } else {
                backend = []; // Use empty array if invalid
            }
        }
        
        // Process backend cases first (they have the most complete data)
        backend.forEach(bCase => {
            // Use id as fallback since service-data merge can set caseNumber to null
            const caseNumber = bCase.case_number || bCase.caseNumber || bCase.id;
            if (caseNumber) {
                // Ensure caseNumber is set on the object for later use
                if (!bCase.caseNumber && !bCase.case_number) {
                    bCase.caseNumber = caseNumber;
                }
                processedIds.add(caseNumber);
                merged.push(bCase);
            }
        });
        
        // Then add local cases that aren't already in backend
        local.forEach(lCase => {
            const caseNumber = lCase.case_number || lCase.caseNumber || lCase.id;
            if (caseNumber && !processedIds.has(caseNumber)) {
                // Check if this local case might have data the backend doesn't
                const backendCase = merged.find(c =>
                    (c.case_number === caseNumber) ||
                    (c.caseNumber === caseNumber) ||
                    (c.id === caseNumber)
                );
                
                if (backendCase) {
                    // Merge local data into backend case if local has fields backend doesn't
                    if (lCase.transactionHash && !backendCase.transaction_hash) {
                        backendCase.transaction_hash = lCase.transactionHash;
                    }
                    if (lCase.alertTokenId && !backendCase.alert_token_id) {
                        backendCase.alert_token_id = lCase.alertTokenId;
                    }
                    if (lCase.documentTokenId && !backendCase.document_token_id) {
                        backendCase.document_token_id = lCase.documentTokenId;
                    }
                    if (lCase.ipfsHash && !backendCase.ipfs_hash) {
                        backendCase.ipfs_hash = lCase.ipfsHash;
                    }
                    if (lCase.alertImage && !backendCase.alert_image) {
                        backendCase.alert_image = lCase.alertImage;
                    }
                } else {
                    // Add local case if not in backend
                    merged.push(lCase);
                    processedIds.add(caseNumber);
                }
            }
        });
        
        // Sort by creation date (newest first)
        return merged.sort((a, b) => {
            const aTime = b.createdAt || b.created_at || 0;
            const bTime = a.createdAt || a.created_at || 0;
            return aTime - bTime;
        });
    },
    
    // Display cases in table
    displayCases(cases) {
        // Store current cases for reference
        this.currentCases = cases;
        
        const tbody = document.getElementById('casesTableBody');
        if (!tbody) return;
        
        if (cases.length === 0) {
            const currentChain = window.getCurrentChainId ? window.getCurrentChainId() : 'tron-mainnet';
            const chainInfo = window.getChainInfo ? window.getChainInfo(currentChain) : null;
            const networkName = chainInfo?.name || (currentChain === 'tron-nile' ? 'Nile Testnet' : 'Mainnet');
            const filterMsg = this.showAllNetworks
                ? 'No cases found'
                : `No cases found on ${networkName}. Try enabling "Show all networks" above.`;
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted">${filterMsg}</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = cases.map(c => {
            // Handle different case formats from backend and local storage
            const caseId = c.caseNumber || c.case_number || c.id || 'Unknown';
            const createdDate = c.created_at || c.createdAt || Date.now();
            // Get page count from all possible sources
            let pageCount = c.page_count || c.pageCount || c.documentCount;
            if (!pageCount && c.documents) {
                pageCount = Array.isArray(c.documents) ? c.documents.length : 0;
            }
            if (!pageCount && c.metadata) {
                const metadata = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata;
                pageCount = metadata.pageCount || metadata.documentCount || 0;
            }
            pageCount = pageCount || 0;
            
            // Get recipient count from all possible sources
            let recipientCount = 0;
            // Helper to parse a recipients value (could be array, JSON string, or single address)
            const parseRecipients = (val) => {
                if (!val) return 0;
                if (Array.isArray(val)) return val.length;
                if (typeof val === 'string') {
                    try {
                        const parsed = JSON.parse(val);
                        return Array.isArray(parsed) ? parsed.length : (parsed ? 1 : 0);
                    } catch {
                        // Single address string
                        return val.trim() ? 1 : 0;
                    }
                }
                return 0;
            };
            recipientCount = parseRecipients(c.recipients)
                || parseRecipients(c.recipient_address)
                || c.recipient_count || c.recipientCount || 0;
            if (!recipientCount && c.metadata) {
                const metadata = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata;
                recipientCount = parseRecipients(metadata.recipients);
            }
            
            const status = c.status || 'Active';
            
            // Debug logging for served cases
            if (status === 'served' || status.toLowerCase() === 'served') {
                console.log(`Case ${caseId} is served. Checking receipt button conditions:`, {
                    served_at: c.served_at,
                    servedAt: c.servedAt,
                    status: c.status,
                    transactionHash: c.transactionHash,
                    transaction_hash: c.transaction_hash,
                    showReceiptButton: !!(c.served_at || c.servedAt || c.status === 'served' || c.transactionHash || c.transaction_hash)
                });
            }
            
            const txHash = c.transactionHash || c.transaction_hash;
            const alertTokenId = c.alertTokenId || c.alert_token_id;
            const documentTokenId = c.documentTokenId || c.document_token_id;
            const caseChain = c.chain || 'tron-mainnet';
            const caseChainInfo = window.getChainInfo ? window.getChainInfo(caseChain) : null;
            const isTestnet = caseChainInfo?.isTestnet || caseChain.includes('nile') || caseChain.includes('sepolia');
            const chainLabel = caseChainInfo?.shortName || (isTestnet ? 'Testnet' : 'Mainnet');
            const networkBadge = isTestnet
                ? `<span class="badge bg-warning text-dark" style="font-size: 9px; padding: 2px 4px;">${chainLabel}</span>`
                : `<span class="badge bg-success" style="font-size: 9px; padding: 2px 4px;">${chainLabel}</span>`;

            // Escape values for safe HTML insertion
            const safeCaseId = escapeAttr(caseId);
            const safeServerAddr = escapeAttr(c.server_address || window.wallet?.address || '');
            const safeTxHash = txHash ? escapeHtml(txHash.substring(0, 8)) : '';

            return `
                <tr>
                    <td>
                        <a href="#" onclick="cases.viewCase('${safeCaseId}'); return false;">
                            ${escapeHtml(caseId)}
                        </a>
                    </td>
                    <td><small>${new Date(createdDate).toLocaleDateString()}<br><span class="text-muted">${new Date(createdDate).toISOString().replace('T', ' ').substring(0, 19)} UTC</span></small></td>
                    <td>
                        ${pageCount} pages<br>
                        <small class="text-muted">${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}</small>
                    </td>
                    <td>
                        <span class="badge bg-${this.getStatusColor(status)}">
                            ${escapeHtml(status)}
                        </span>
                        ${networkBadge}
                        ${txHash ? `
                            <br>
                            <small style="font-size: 10px; line-height: 1.2;">
                                Tx: <code>${safeTxHash}...</code>
                                <a href="${window.getTronScanUrl ? window.getTronScanUrl(txHash) : 'https://tronscan.org/#/transaction/' + encodeURIComponent(txHash)}" target="_blank"
                                   class="text-info" title="View on TronScan">
                                    <i class="bi bi-box-arrow-up-right"></i>
                                </a>
                            </small>
                        ` : ''}
                        ${(alertTokenId || documentTokenId) ? `
                            <br>
                            <small style="font-size: 10px; color: #666;">
                                NFTs: ${alertTokenId ? `#${escapeHtml(alertTokenId)}` : ''} ${documentTokenId ? `#${escapeHtml(documentTokenId)}` : ''}
                            </small>
                        ` : ''}
                    </td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-primary" onclick="cases.resumeCase('${safeCaseId}')" title="Resume">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                            ${(c.served_at || c.servedAt || status === 'served' || status.toLowerCase() === 'served' || c.transactionHash || c.transaction_hash) ? `
                                <button class="btn btn-sm btn-primary" onclick="cases.viewServiceDetails('${safeCaseId}')" title="View Complete Service Details">
                                    <i class="bi bi-eye"></i> View
                                </button>
                                <button class="btn btn-sm btn-dark" onclick="cases.viewAuditLog('${safeCaseId}')" title="View Recipient Audit Log">
                                    <i class="bi bi-clipboard-data"></i> Audit
                                </button>
                                <button class="btn btn-sm btn-warning" onclick="cases.syncBlockchainData('${safeCaseId}')" title="Sync Blockchain Data">
                                    <i class="bi bi-cloud-download"></i>
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-danger" onclick="cases.deleteCase('${safeCaseId}', '${safeServerAddr}')" title="Delete">
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
        switch(status?.toLowerCase()) {
            case 'completed': 
            case 'served': 
                return 'success';
            case 'active': 
                return 'primary';
            case 'pending': 
                return 'warning';
            default: 
                return 'secondary';
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
            notices: [],
            serverAddress: window.wallet?.address || ''
        };
        
        // Save locally
        window.storage.saveCase(caseData);
        
        // Save to backend if connected
        if (window.wallet && window.wallet.connected) {
            try {
                const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
                await fetchWithTimeout(`${backendUrl}/api/cases`, {
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
                    const response = await fetchWithTimeout(`${backendUrl}/api/cases/${caseNumber}`, {
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
                const fields = ['caseNumber', 'issuingAgency', 'noticeType',
                               'responseDeadline', 'legalRights'];
                
                fields.forEach(field => {
                    const input = document.getElementById(field);
                    if (input && caseData.metadata[field]) {
                        input.value = caseData.metadata[field];
                    }
                });
                
                // Load recipients (handles both string and {address, label} formats)
                if (caseData.metadata.recipients && Array.isArray(caseData.metadata.recipients)) {
                    // Clear existing recipients
                    const recipientRows = document.querySelectorAll('.recipient-row');
                    recipientRows.forEach(row => {
                        const addrInput = row.querySelector('.recipient-input');
                        const labelInput = row.querySelector('.recipient-label');
                        if (addrInput) addrInput.value = '';
                        if (labelInput) labelInput.value = '';
                    });

                    // Add saved recipients
                    caseData.metadata.recipients.forEach((recipient, index) => {
                        const address = typeof recipient === 'string' ? recipient : recipient.address;
                        const label = typeof recipient === 'object' ? recipient.label : null;

                        if (index === 0) {
                            // Use the first recipient row
                            const firstRow = document.querySelector('.recipient-row');
                            if (firstRow) {
                                const addrInput = firstRow.querySelector('.recipient-input');
                                const labelInput = firstRow.querySelector('.recipient-label');
                                if (addrInput) addrInput.value = address || '';
                                if (labelInput && label) labelInput.value = label;
                            }
                        } else {
                            // Add additional recipient fields if needed
                            window.app.addRecipientField();
                            const rows = document.querySelectorAll('.recipient-row');
                            const row = rows[index];
                            if (row) {
                                const addrInput = row.querySelector('.recipient-input');
                                const labelInput = row.querySelector('.recipient-label');
                                if (addrInput) addrInput.value = address || '';
                                if (labelInput && label) labelInput.value = label;
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
                    const response = await fetchWithTimeout(`${backendUrl}/api/cases/${caseId}/pdf`, {
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
                const response = await fetchWithTimeout(`${backendUrl}/api/cases/by-number/${caseNumber}?serverAddress=${window.wallet.address}`, {
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
        
        // Get recipient count from various possible sources
        let recipientCount = 0;
        if (caseData.recipients) {
            recipientCount = Array.isArray(caseData.recipients) ? caseData.recipients.length : 
                             (typeof caseData.recipients === 'string' ? JSON.parse(caseData.recipients).length : 0);
        } else if (caseData.recipient_count) {
            recipientCount = caseData.recipient_count;
        } else if (caseData.recipientCount) {
            recipientCount = caseData.recipientCount;
        } else if (caseData.metadata?.recipients) {
            recipientCount = caseData.metadata.recipients.length;
        }
        
        // Get page count from various sources
        const pageCount = caseData.page_count || caseData.pageCount || caseData.documentCount || 
                         caseData.documents?.length || caseData.metadata?.pageCount || 1;
        
        // Get alert image from various sources
        const alertImage = caseData.alertImage || caseData.alert_image || caseData.alertPreview || 
                          caseData.alert_preview || caseData.metadata?.alertImage;
        
        // Build proper preview URLs
        const alertPreviewUrl = alertImage || `${backendUrl}/api/cases/${caseId}/preview`;
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
                                <div class="col-md-3">
                                    <strong>Created:</strong> ${new Date(caseData.createdAt || caseData.created_at).toLocaleDateString()}
                                </div>
                                <div class="col-md-3">
                                    <strong>Status:</strong> 
                                    <span class="badge bg-${this.getStatusColor(caseData.status || 'pending')}">
                                        ${caseData.status || 'Awaiting Service'}
                                    </span>
                                </div>
                                <div class="col-md-3">
                                    <strong>Recipients:</strong> ${recipientCount}
                                </div>
                                <div class="col-md-3">
                                    <strong>Pages:</strong> ${pageCount}
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
                                        ${this.generateNoticeRows(caseData)}
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
                const response = await fetchWithTimeout(`${backendUrl}/api/cases/${caseId}`, {
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
            const response = await fetchWithTimeout(`${backendUrl}/api/cases/${caseNumber}`, {
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
    
    // View complete service details with all options
    async viewServiceDetails(caseId) {
        try {
            if (!caseId) {
                window.app.showError('Invalid case ID');
                return;
            }

            // Get local case data first
            let caseData = this.getCaseData(caseId) || {};

            // ALWAYS try to fetch fresh data from backend (has token ID, tx hash, etc.)
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            try {
                const response = await fetchWithTimeout(`${backendUrl}/api/cases/${encodeURIComponent(caseId)}/service-data`, {
                    headers: { 'X-Server-Address': window.wallet?.address || '' }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.case) {
                        // Merge backend data with local data (backend takes precedence for key fields)
                        caseData = { ...caseData, ...data.case };
                        console.log('Merged case data with backend:', caseData);
                    }
                }
            } catch (fetchError) {
                console.log('Could not fetch from backend, using local data:', fetchError.message);
            }

            if (!caseData || Object.keys(caseData).length === 0) {
                window.app.showError('Case not found');
                return;
            }

            // Show comprehensive service details modal (pass caseId as fallback)
            this.showServiceDetailsModal(caseData, caseId);

        } catch (error) {
            console.error('Failed to view receipt:', error);
            window.app.showError('Failed to view receipt: ' + error.message);
        }
    },

    // Show comprehensive service details modal with all actions
    showServiceDetailsModal(caseData, fallbackCaseId = null) {
        const caseNumber = caseData.caseNumber || caseData.case_number || caseData.id || fallbackCaseId;

        // Validate we have a case number
        if (!caseNumber || caseNumber === 'undefined' || caseNumber === 'null') {
            console.error('showServiceDetailsModal: No valid case number found', { caseData, fallbackCaseId });
            window.app.showError('Unable to display service details: Case number not found');
            return;
        }

        console.log('showServiceDetailsModal: Using case number:', caseNumber);
        const txHash = caseData.transactionHash || caseData.transaction_hash;
        const alertTokenId = caseData.alertTokenId || caseData.alert_token_id;
        const documentTokenId = caseData.documentTokenId || caseData.document_token_id;
        const servedAt = caseData.servedAt || caseData.served_at;
        const recipients = caseData.recipients || [];
        // Get agency from all possible sources, including the metadata
        let agency = caseData.agency || caseData.issuingAgency;
        if (!agency && caseData.metadata) {
            const metadata = typeof caseData.metadata === 'string' ? JSON.parse(caseData.metadata) : caseData.metadata;
            agency = metadata.agency || metadata.issuingAgency;
        }
        if (!agency) {
            agency = 'via Blockserved.com'; // Default fallback
        }
        const serverAddress = caseData.serverAddress || caseData.server_address || window.wallet?.address;

        const modalHtml = `
            <div class="modal fade" id="receiptModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white no-print">
                            <h5 class="modal-title"><i class="bi bi-folder-open"></i> Service Details - Case ${caseNumber}</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <!-- Service Summary Section -->
                            <div class="card mb-3">
                                <div class="card-header bg-success text-white">
                                    <h6 class="mb-0"><i class="bi bi-check-circle-fill"></i> Service Summary</h6>
                                </div>
                                <div class="card-body">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <p><strong>Status:</strong> <span class="badge bg-success">Served</span></p>
                                            <p><strong>Date/Time Served:</strong> ${servedAt ? new Date(servedAt).toLocaleString() : 'Not Available'}</p>
                                            <p><strong>Issuing Agency:</strong> ${agency}</p>
                                            <p><strong>Recipients:</strong> ${recipients.length} address(es)</p>
                                        </div>
                                        <div class="col-md-6">
                                            <p><strong>Transaction Hash:</strong><br>
                                               <code style="font-size: 10px;">${txHash || 'Pending Sync'}</code></p>
                                            <p><strong>NFT Token ID:</strong> #${alertTokenId || 'Pending'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Action Buttons Section -->
                            <div class="card mb-3">
                                <div class="card-header bg-info text-white">
                                    <h6 class="mb-0"><i class="bi bi-tools"></i> Available Actions</h6>
                                </div>
                                <div class="card-body">
                                    <div class="row g-2">
                                        <div class="col-md-6">
                                            <button class="btn btn-primary w-100" onclick="cases.printDeliveryReceipt('${caseNumber}')">
                                                <i class="bi bi-printer"></i> Print Delivery Receipt
                                            </button>
                                        </div>
                                        <div class="col-md-6">
                                            <button class="btn btn-success w-100" onclick="cases.exportStampedDocument('${caseNumber}')">
                                                <i class="bi bi-file-earmark-pdf"></i> Export Stamped Document
                                            </button>
                                        </div>
                                        <div class="col-md-6">
                                            <button class="btn btn-dark w-100" onclick="cases.viewAuditLog('${caseNumber}')">
                                                <i class="bi bi-clipboard-data"></i> View Recipient Audit Log
                                            </button>
                                        </div>
                                        <div class="col-md-6">
                                            <button class="btn btn-warning w-100" onclick="cases.sendMessage('${caseNumber}')">
                                                <i class="bi bi-send"></i> Send Message
                                            </button>
                                        </div>
                                        ${txHash ? `
                                        <div class="col-md-6">
                                            <a href="${window.getTronScanUrl ? window.getTronScanUrl(txHash) : 'https://tronscan.org/#/transaction/' + txHash}" target="_blank" class="btn btn-info w-100">
                                                <i class="bi bi-box-arrow-up-right"></i> View on TronScan
                                            </a>
                                        </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Recipients List with Status -->
                            <div class="card mb-3">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <h6 class="mb-0"><i class="bi bi-people"></i> Recipients (${recipients.length})</h6>
                                    <button class="btn btn-sm btn-outline-primary" onclick="cases.fetchRecipientStatus('${caseNumber}')" title="Refresh status for all recipients">
                                        <i class="bi bi-arrow-clockwise"></i> Refresh Status
                                    </button>
                                </div>
                                <div class="card-body">
                                    <div class="list-group" id="recipientsStatusList">
                                        ${recipients.map((r, i) => {
                                            const addr = cases.getRecipientAddress(r);
                                            const label = cases.getRecipientLabel(r);
                                            return `
                                            <div class="list-group-item d-flex justify-content-between align-items-center" data-recipient="${addr}">
                                                <div>
                                                    ${label ? `<span class="badge bg-info me-2">${label}</span>` : ''}
                                                    <code>${addr}</code>
                                                    <span class="badge bg-secondary ms-2 recipient-status" data-recipient="${addr}">Checking...</span>
                                                </div>
                                                <button class="btn btn-sm btn-outline-dark"
                                                        onclick="cases.checkRecipientActivity('${addr}', '${caseNumber}')"
                                                        title="Check detailed activity">
                                                    <i class="bi bi-search"></i>
                                                </button>
                                            </div>`;
                                        }).join('')}
                                    </div>
                                </div>
                            </div>
                            
                            <!-- NFT Preview -->
                            ${caseData.alertImage || caseData.alert_preview ? `
                            <div class="card">
                                <div class="card-header">
                                    <h6 class="mb-0"><i class="bi bi-image"></i> NFT Preview</h6>
                                </div>
                                <div class="card-body text-center">
                                    <img src="${caseData.alertImage || caseData.alert_preview}" 
                                         style="max-width: 400px; border: 1px solid #ddd; border-radius: 8px;">
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer no-print">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing modal
        const existingModal = document.getElementById('receiptModal');
        if (existingModal) existingModal.remove();

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('receiptModal'));
        modal.show();

        // Fetch recipient status after modal is shown
        setTimeout(() => {
            this.fetchRecipientStatus(caseNumber);
        }, 100);

        // Clean up on close
        document.getElementById('receiptModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },

    // View audit log for a case
    async viewAuditLog(caseId) {
        try {
            // Validate caseId
            if (!caseId || caseId === 'undefined' || caseId === 'null') {
                console.error('viewAuditLog: Invalid caseId provided:', caseId);
                window.app.showError('Unable to fetch audit log: Invalid case ID');
                return;
            }

            // Get case data to find recipients
            let caseData = this.getCaseData(caseId);
            const caseNumber = caseData?.caseNumber || caseData?.case_number || caseId;

            console.log('viewAuditLog: Fetching audit for case:', caseNumber);
            window.app.showProcessing('Fetching audit logs...');

            // Fetch audit logs from backend (URL encode case number for spaces/special chars)
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            const response = await fetchWithTimeout(`${backendUrl}/api/audit/case/${encodeURIComponent(caseNumber)}`, {
                headers: { 'X-Server-Address': window.wallet?.address || '' }
            });

            window.app.hideProcessing();

            if (!response.ok) {
                throw new Error('Failed to fetch audit logs');
            }

            const auditData = await response.json();
            this.showAuditLogModal(caseNumber, auditData);
            
        } catch (error) {
            window.app.hideProcessing();
            console.error('Error fetching audit log:', error);
            window.app.showError('Failed to fetch audit log: ' + error.message);
        }
    },

    // Limit events shown in audit log to prevent browser hang
    MAX_AUDIT_EVENTS: 100,
    
    // Action type explanations for audit log
    actionExplainers: {
        'recipient_notice_query': {
            label: 'Checked Notices',
            badge: 'bg-info',
            description: 'The recipient connected their wallet to BlockServed.com and checked if they have any legal notices pending. This confirms they are aware of the service.'
        },
        'recipient_document_view': {
            label: 'Viewed Document',
            badge: 'bg-success',
            description: 'The recipient opened and viewed the legal document attached to this notice. This is strong evidence of actual notice and awareness of the document contents.'
        },
        'recipient_document_download': {
            label: 'Downloaded PDF',
            badge: 'bg-primary',
            description: 'The recipient downloaded a PDF copy of the legal document to their device. This indicates they wanted to keep a copy for their records.'
        },
        'wallet_connect': {
            label: 'Wallet Connected',
            badge: 'bg-secondary',
            description: 'The recipient connected their cryptocurrency wallet to the BlockServed platform. This is the first step in accessing served documents.'
        },
        'document_signed': {
            label: 'Document Signed',
            badge: 'bg-success',
            description: 'The recipient cryptographically signed the document using their wallet, providing irrefutable proof of receipt and acknowledgment.'
        },
        'notice_served': {
            label: 'Notice Served',
            badge: 'bg-warning',
            description: 'The legal notice was minted as an NFT and delivered to the recipient\'s blockchain address. This creates an immutable record of service.'
        },
        'view': {
            label: 'Viewed',
            badge: 'bg-info',
            description: 'The recipient viewed content related to this case.'
        },
        'view_alert': {
            label: 'Viewed Alert',
            badge: 'bg-info',
            description: 'The recipient viewed the alert notification for this legal notice.'
        },
        'view_document': {
            label: 'Viewed Document',
            badge: 'bg-success',
            description: 'The recipient opened and viewed the legal document.'
        },
        'decrypt': {
            label: 'Decrypted',
            badge: 'bg-primary',
            description: 'The recipient decrypted the encrypted document content, which requires wallet authentication.'
        },
        'accept': {
            label: 'Accepted',
            badge: 'bg-success',
            description: 'The recipient formally accepted or acknowledged the legal document.'
        },
        'download': {
            label: 'Downloaded',
            badge: 'bg-primary',
            description: 'The recipient downloaded a copy of the document.'
        }
    },

    // Parse user agent into readable browser/OS info
    parseUserAgent(ua) {
        if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };

        let browser = 'Unknown', os = 'Unknown', device = 'Desktop';

        // Detect OS
        if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
        else if (/Windows NT/.test(ua)) os = 'Windows';
        else if (/Mac OS X/.test(ua)) os = 'macOS';
        else if (/Android/.test(ua)) { os = 'Android'; device = 'Mobile'; }
        else if (/iPhone|iPad/.test(ua)) { os = 'iOS'; device = /iPad/.test(ua) ? 'Tablet' : 'Mobile'; }
        else if (/Linux/.test(ua)) os = 'Linux';

        // Detect browser
        if (/Edg\//.test(ua)) browser = 'Edge';
        else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
        else if (/Firefox\//.test(ua)) browser = 'Firefox';
        else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
        else if (/OPR\//.test(ua)) browser = 'Opera';

        return { browser, os, device };
    },

    // Format forensic details for display
    formatForensicDetails(event) {
        const parts = [];
        if (event.timezone) parts.push(`<i class="bi bi-clock"></i> ${event.timezone}`);
        if (event.language) {
            const lang = event.language.split(',')[0].split(';')[0].trim();
            parts.push(`<i class="bi bi-translate"></i> ${lang}`);
        }
        if (event.details) {
            const d = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
            if (d.walletProvider) parts.push(`<i class="bi bi-wallet2"></i> ${d.walletProvider}`);
            if (d.fingerprint) {
                const conf = d.fingerprintConfidence ? ` (${d.fingerprintConfidence}%)` : '';
                parts.push(`<i class="bi bi-fingerprint"></i> ${d.fingerprint.substring(0, 12)}...${conf}`);
            }
            if (d.screen_resolution) parts.push(`<i class="bi bi-display"></i> ${d.screen_resolution}`);
            if (d.visitorId) parts.push(`<i class="bi bi-person-badge"></i> ${d.visitorId}`);
        }
        return parts.length > 0 ? parts.join(' &nbsp; ') : '';
    },

    // Get formatted action badge with tooltip
    getActionBadge(action) {
        const explainer = this.actionExplainers[action] || {
            label: action.replace(/_/g, ' '),
            badge: 'bg-secondary',
            description: 'User activity recorded for this case.'
        };
        return `<span class="badge ${explainer.badge} action-badge"
                      style="cursor: pointer;"
                      data-bs-toggle="popover"
                      data-bs-trigger="click"
                      data-bs-placement="top"
                      data-bs-title="${explainer.label}"
                      data-bs-content="${explainer.description}">${explainer.label}</span>`;
    },

    // Check if an audit event belongs to a specific case
    _eventMatchesCase(event, caseNumber, alertTokenId, documentTokenId) {
        const tid = event.targetId;
        if (!tid) return false;
        const tidStr = String(tid);
        if (tidStr === String(caseNumber)) return true;
        if (alertTokenId && tidStr === String(alertTokenId)) return true;
        if (documentTokenId && tidStr === String(documentTokenId)) return true;
        // "Checked Notices" events can list comma-separated case numbers
        if (tidStr.includes(',') && tidStr.split(',').map(s => s.trim()).includes(String(caseNumber))) return true;
        return false;
    },

    // Toggle audit log filter between "This Case Only" and "All Wallet Activity"
    _toggleAuditFilter(addr, showAll) {
        const tableWrapper = document.querySelector(`[data-audit-recipient="${addr}"]`);
        if (!tableWrapper) return;
        const cardBody = tableWrapper.closest('.card-body');
        const rows = tableWrapper.querySelectorAll('tbody tr[data-case-match]');
        let visibleCount = 0;
        rows.forEach(tr => {
            if (showAll || tr.dataset.caseMatch === 'true') {
                tr.style.display = '';
                visibleCount++;
            } else {
                tr.style.display = 'none';
            }
        });
        const countEl = cardBody ? cardBody.querySelector('.audit-visible-count') : null;
        const totalCount = rows.length;
        if (countEl) {
            countEl.textContent = showAll
                ? `Showing all ${totalCount} events`
                : `Showing ${visibleCount} of ${totalCount} events (this case only)`;
        }
    },

    // Show audit log modal
    showAuditLogModal(caseNumber, auditData) {
        // Stash raw data for full-detail export
        this._lastAuditExport = { caseNumber, auditData };

        const { recipients, events } = auditData;
        const alertTokenId = auditData.alertTokenId;
        const documentTokenId = auditData.documentTokenId;
        const maxEventsPerRecipient = 50; // Limit to prevent browser hang

        // Group events by recipient address (handle both string and object formats)
        const eventsByRecipient = {};
        const recipientLabels = {}; // Map address -> label
        const eventCountByRecipient = {}; // Track total counts
        recipients.forEach(r => {
            const addr = this.getRecipientAddress(r);
            eventsByRecipient[addr] = [];
            eventCountByRecipient[addr] = 0;
            const label = this.getRecipientLabel(r);
            if (label) recipientLabels[addr] = label;
        });

        events.forEach(event => {
            if (eventsByRecipient[event.recipientWallet] !== undefined) {
                eventCountByRecipient[event.recipientWallet]++;
                // Only add up to max events per recipient
                if (eventsByRecipient[event.recipientWallet].length < maxEventsPerRecipient) {
                    eventsByRecipient[event.recipientWallet].push(event);
                }
            }
        });
        
        const modalHtml = `
            <div class="modal fade" id="auditLogModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header bg-dark text-white">
                            <h5 class="modal-title"><i class="bi bi-clipboard-data"></i> Recipient Audit Log - Case ${caseNumber}</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="bi bi-info-circle"></i> This log shows all recipient activity for viewing served documents.
                                <strong>Click on any action badge</strong> to see a detailed explanation of what it means.
                            </div>
                            
                            ${recipients.length === 0 ? `
                                <p class="text-muted">No recipients found for this case.</p>
                            ` : recipients.map(recipient => {
                                const addr = cases.getRecipientAddress(recipient);
                                const label = recipientLabels[addr];
                                return `
                                <div class="card mb-3">
                                    <div class="card-header">
                                        <h6 class="mb-0">
                                            <i class="bi bi-person"></i> Recipient: ${label ? `<span class="badge bg-info me-2">${label}</span>` : ''}<code>${addr}</code>
                                            ${eventsByRecipient[addr].length > 0 ?
                                                '<span class="badge bg-success float-end">Viewed</span>' :
                                                '<span class="badge bg-warning float-end">Not Viewed Yet</span>'
                                            }
                                        </h6>
                                    </div>
                                    <div class="card-body">
                                        ${eventsByRecipient[addr].length === 0 ?
                                            '<p class="text-muted mb-0"><i class="bi bi-clock"></i> This recipient has not accessed their notice yet</p>'
                                        : `
                                            <div class="d-flex justify-content-between align-items-center mb-2">
                                                <span class="text-muted small audit-visible-count"></span>
                                                <div class="form-check form-switch mb-0">
                                                    <input class="form-check-input" type="checkbox" id="auditToggle_${addr}" onchange="cases._toggleAuditFilter('${addr}', this.checked)">
                                                    <label class="form-check-label small" for="auditToggle_${addr}">All Wallet Activity</label>
                                                </div>
                                            </div>
                                            <div class="table-responsive" data-audit-recipient="${addr}">
                                                <table class="table table-sm">
                                                    <thead>
                                                        <tr>
                                                            <th>Time</th>
                                                            <th>Action</th>
                                                            <th>Notice</th>
                                                            <th>IP Address</th>
                                                            <th>Browser</th>
                                                            <th>Language</th>
                                                            <th>Timezone</th>
                                                            <th>Wallet</th>
                                                            <th style="cursor: help;" data-bs-toggle="tooltip" data-bs-placement="top" title="A unique device identifier generated from canvas rendering, GPU info (WebGL), audio processing, installed fonts, hardware specs, and browser plugins. The same device produces the same fingerprint across sessions — even without cookies.">Fingerprint <i class="bi bi-info-circle" style="font-size: 0.75rem;"></i></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        ${eventsByRecipient[addr].map(event => {
                                                            const ua = cases.parseUserAgent(event.userAgent);
                                                            const d = event.details ? (typeof event.details === 'string' ? JSON.parse(event.details) : event.details) : {};
                                                            const lang = event.language ? event.language.split(',')[0].split(';')[0].trim() : 'N/A';
                                                            const fpShort = d.fingerprint ? d.fingerprint.substring(0, 12) + '...' : 'N/A';
                                                            const fpConf = d.fingerprintConfidence ? d.fingerprintConfidence + '% confidence' : '';
                                                            const fpTooltip = d.fingerprint ? 'Derived from: canvas, WebGL (GPU), audio, fonts, hardware, plugins' + (fpConf ? ' — ' + fpConf : '') : '';
                                                            const matchesCase = cases._eventMatchesCase(event, caseNumber, alertTokenId, documentTokenId);
                                                            const noticeLabel = d.noticeType || event.targetId || '<span class="text-muted">—</span>';
                                                            const tsUTC = new Date(event.timestamp).toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';
                                                            return `
                                                            <tr data-case-match="${matchesCase}" ${!matchesCase ? 'style="display:none;"' : ''}>
                                                                <td><small>${tsUTC}</small></td>
                                                                <td>${cases.getActionBadge(event.action)}</td>
                                                                <td><small>${noticeLabel}</small></td>
                                                                <td><small><code>${event.ipAddress || 'N/A'}</code></small></td>
                                                                <td><small>${ua.browser} / ${ua.os}</small></td>
                                                                <td><small>${lang}</small></td>
                                                                <td><small>${event.timezone || 'N/A'}</small></td>
                                                                <td><small>${d.walletProvider || 'N/A'}</small></td>
                                                                <td><small><code ${fpTooltip ? `style="cursor: help;" data-bs-toggle="tooltip" data-bs-placement="top" title="${fpTooltip}"` : ''}>${fpShort}</code></small></td>
                                                            </tr>
                                                            `;
                                                        }).join('')}
                                                    </tbody>
                                                </table>
                                                ${eventCountByRecipient[addr] > eventsByRecipient[addr].length ?
                                                    `<p class="text-muted small mt-2 mb-0">
                                                        <i class="bi bi-info-circle"></i> Showing ${eventsByRecipient[addr].length} of ${eventCountByRecipient[addr]} events.
                                                        Export the log for complete data.
                                                    </p>` : ''
                                                }
                                            </div>
                                        `}
                                    </div>
                                </div>`;
                            }).join('')}
                            
                            <div class="text-center mt-3">
                                <p class="text-muted">
                                    <i class="bi bi-shield-check"></i> All activity is logged for legal compliance
                                </p>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-primary" onclick="cases.exportAuditLog('${caseNumber}')">
                                <i class="bi bi-download"></i> Export Log
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing modal
        const existingModal = document.getElementById('auditLogModal');
        if (existingModal) existingModal.remove();

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Initialize popovers for action badges
        const modalElement = document.getElementById('auditLogModal');
        const popoverTriggerList = modalElement.querySelectorAll('[data-bs-toggle="popover"]');
        popoverTriggerList.forEach(el => {
            new bootstrap.Popover(el, { html: true });
        });

        // Initialize tooltips
        const tooltipTriggerList = modalElement.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltipTriggerList.forEach(el => new bootstrap.Tooltip(el));

        // Initialize audit filter counts (default: "This Case Only")
        recipients.forEach(r => {
            const addr = this.getRecipientAddress(r);
            this._toggleAuditFilter(addr, false);
        });

        // Show modal
        const modal = new bootstrap.Modal(modalElement);
        modal.show();

        // Clean up on close (dispose popovers and tooltips)
        modalElement.addEventListener('hidden.bs.modal', function() {
            popoverTriggerList.forEach(el => {
                const popover = bootstrap.Popover.getInstance(el);
                if (popover) popover.dispose();
            });
            tooltipTriggerList.forEach(el => {
                const tooltip = bootstrap.Tooltip.getInstance(el);
                if (tooltip) tooltip.dispose();
            });
            this.remove();
        });
    },
    
    // Store tracking data for recipients (used by detail view)
    recipientTrackingData: {},

    // Fetch status for all recipients in a case
    async fetchRecipientStatus(caseNumber) {
        try {
            // Validate caseNumber
            if (!caseNumber || caseNumber === 'undefined' || caseNumber === 'null') {
                console.error('fetchRecipientStatus: Invalid caseNumber provided:', caseNumber);
                return;
            }

            const walletAddress = window.wallet?.address;
            if (!walletAddress) {
                console.log('No wallet connected, cannot fetch recipient status');
                return;
            }

            console.log('fetchRecipientStatus: Fetching status for case:', caseNumber);
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            const response = await fetchWithTimeout(`${backendUrl}/api/server/${walletAddress}/case/${encodeURIComponent(caseNumber)}/recipient-status?detailed=true`);

            if (!response.ok) {
                console.error('Failed to fetch recipient status:', response.status);
                return;
            }

            const data = await response.json();

            if (data.success && data.recipients) {
                // Store tracking data for later use
                this.recipientTrackingData[caseNumber] = {};

                // Update status badges for each recipient
                data.recipients.forEach(recipientData => {
                    // Store tracking data
                    this.recipientTrackingData[caseNumber][recipientData.recipient] = recipientData;

                    const badge = document.querySelector(`.recipient-status[data-recipient="${recipientData.recipient}"]`);
                    if (badge) {
                        // Determine badge color based on status
                        let badgeClass = 'bg-secondary';
                        let statusText = recipientData.status;

                        if (recipientData.status === 'Signed For') {
                            badgeClass = 'bg-success';
                            statusText = '✓ Signed For';
                        } else if (recipientData.status === 'Viewed') {
                            badgeClass = 'bg-info';
                            statusText = '👁 Viewed';
                        } else {
                            badgeClass = 'bg-warning text-dark';
                            statusText = '📬 Delivered';
                        }

                        badge.className = `badge ${badgeClass} ms-2 recipient-status`;
                        badge.setAttribute('data-recipient', recipientData.recipient);
                        badge.setAttribute('data-case', caseNumber);
                        badge.style.cursor = 'pointer';
                        badge.innerHTML = statusText;
                        badge.onclick = () => this.showRecipientTrackingDetails(recipientData.recipient, caseNumber);

                        // Build tooltip with tracking info
                        let tooltip = [];
                        if (recipientData.viewed_at) {
                            tooltip.push(`Viewed: ${new Date(recipientData.viewed_at).toLocaleString()}`);
                        }
                        if (recipientData.signed_at) {
                            tooltip.push(`Signed: ${new Date(recipientData.signed_at).toLocaleString()}`);
                        }
                        if (recipientData.tracking?.geolocation?.city) {
                            tooltip.push(`Location: ${recipientData.tracking.geolocation.city}, ${recipientData.tracking.geolocation.country}`);
                        }
                        if (recipientData.tracking?.ip_address) {
                            tooltip.push(`IP: ${recipientData.tracking.ip_address}`);
                        }
                        tooltip.push('Click for details');
                        badge.title = tooltip.join('\n');
                    }
                });

                console.log('Updated recipient status with tracking:', data.summary);
            }

        } catch (error) {
            console.error('Error fetching recipient status:', error);
        }
    },

    // Show detailed tracking information for a recipient
    showRecipientTrackingDetails(recipientAddress, caseNumber) {
        const trackingData = this.recipientTrackingData[caseNumber]?.[recipientAddress];
        if (!trackingData) {
            window.app.showInfo('No tracking data available for this recipient');
            return;
        }

        const tracking = trackingData.tracking || {};
        const geo = tracking.geolocation || {};

        // Build modal HTML
        const modalHtml = `
            <div class="modal fade" id="trackingDetailModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-dark text-white">
                            <h5 class="modal-title"><i class="bi bi-geo-alt"></i> Recipient Tracking Details</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <!-- Recipient Info -->
                            <div class="card mb-3">
                                <div class="card-header bg-light">
                                    <h6 class="mb-0"><i class="bi bi-person"></i> Recipient</h6>
                                </div>
                                <div class="card-body">
                                    <code class="fs-6">${recipientAddress}</code>
                                    <span class="badge ${trackingData.status === 'Signed For' ? 'bg-success' : trackingData.status === 'Viewed' ? 'bg-info' : 'bg-warning text-dark'} ms-2">
                                        ${trackingData.status}
                                    </span>
                                </div>
                            </div>

                            <!-- Status Timeline -->
                            <div class="card mb-3">
                                <div class="card-header bg-light">
                                    <h6 class="mb-0"><i class="bi bi-clock-history"></i> Status Timeline</h6>
                                </div>
                                <div class="card-body">
                                    <ul class="list-group list-group-flush">
                                        <li class="list-group-item d-flex justify-content-between">
                                            <span><i class="bi bi-send-check text-success"></i> Delivered</span>
                                            <span class="text-muted">On blockchain mint</span>
                                        </li>
                                        ${trackingData.viewed ? `
                                        <li class="list-group-item d-flex justify-content-between">
                                            <span><i class="bi bi-eye text-info"></i> Viewed</span>
                                            <span>${trackingData.viewed_at ? new Date(trackingData.viewed_at).toLocaleString() : 'Yes'}</span>
                                        </li>
                                        ` : `
                                        <li class="list-group-item d-flex justify-content-between text-muted">
                                            <span><i class="bi bi-eye-slash"></i> Not Yet Viewed</span>
                                            <span>-</span>
                                        </li>
                                        `}
                                        ${trackingData.signed ? `
                                        <li class="list-group-item d-flex justify-content-between">
                                            <span><i class="bi bi-pen text-success"></i> Signed For</span>
                                            <span>${trackingData.signed_at ? new Date(trackingData.signed_at).toLocaleString() : 'Yes'}</span>
                                        </li>
                                        ` : `
                                        <li class="list-group-item d-flex justify-content-between text-muted">
                                            <span><i class="bi bi-pen"></i> Not Yet Signed</span>
                                            <span>-</span>
                                        </li>
                                        `}
                                    </ul>
                                    ${trackingData.view_count > 1 ? `<small class="text-muted mt-2 d-block">Total views: ${trackingData.view_count}</small>` : ''}
                                </div>
                            </div>

                            <!-- Geolocation & Connection Info -->
                            ${tracking.ip_address || geo.city ? `
                            <div class="card mb-3">
                                <div class="card-header bg-light">
                                    <h6 class="mb-0"><i class="bi bi-globe"></i> Connection Information</h6>
                                </div>
                                <div class="card-body">
                                    <table class="table table-sm mb-0">
                                        ${tracking.ip_address ? `
                                        <tr>
                                            <td class="fw-bold" style="width: 120px">IP Address</td>
                                            <td><code>${tracking.ip_address}</code></td>
                                        </tr>
                                        ` : ''}
                                        ${geo.city ? `
                                        <tr>
                                            <td class="fw-bold">City</td>
                                            <td>${geo.city}${geo.region ? `, ${geo.region}` : ''}</td>
                                        </tr>
                                        ` : ''}
                                        ${geo.country ? `
                                        <tr>
                                            <td class="fw-bold">Country</td>
                                            <td>${geo.country}</td>
                                        </tr>
                                        ` : ''}
                                        ${geo.timezone ? `
                                        <tr>
                                            <td class="fw-bold">Timezone</td>
                                            <td>${geo.timezone}</td>
                                        </tr>
                                        ` : ''}
                                        ${geo.isp ? `
                                        <tr>
                                            <td class="fw-bold">ISP</td>
                                            <td>${geo.isp}</td>
                                        </tr>
                                        ` : ''}
                                        ${tracking.language ? `
                                        <tr>
                                            <td class="fw-bold">Language</td>
                                            <td>${tracking.language}</td>
                                        </tr>
                                        ` : ''}
                                        ${tracking.last_connection ? `
                                        <tr>
                                            <td class="fw-bold">Last Connected</td>
                                            <td>${new Date(tracking.last_connection).toLocaleString()}</td>
                                        </tr>
                                        ` : ''}
                                    </table>
                                </div>
                            </div>
                            ` : `
                            <div class="alert alert-secondary">
                                <i class="bi bi-info-circle"></i> No connection tracking data available yet.
                                Tracking data is recorded when the recipient visits BlockServed.
                            </div>
                            `}

                            <!-- Connection History -->
                            ${tracking.connection_history && tracking.connection_history.length > 0 ? `
                            <div class="card mb-3">
                                <div class="card-header bg-light">
                                    <h6 class="mb-0"><i class="bi bi-list-ul"></i> Connection History</h6>
                                </div>
                                <div class="card-body">
                                    <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
                                        <table class="table table-sm table-striped mb-0">
                                            <thead>
                                                <tr>
                                                    <th>Time</th>
                                                    <th>IP</th>
                                                    <th>Location</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${tracking.connection_history.map(conn => `
                                                <tr>
                                                    <td>${conn.connected_at ? new Date(conn.connected_at).toLocaleString() : '-'}</td>
                                                    <td><code>${conn.ip_address || '-'}</code></td>
                                                    <td>${conn.city && conn.country ? `${conn.city}, ${conn.country}` : '-'}</td>
                                                </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            ` : ''}

                            <!-- Browser/Device Info -->
                            ${tracking.user_agent ? `
                            <div class="card">
                                <div class="card-header bg-light">
                                    <h6 class="mb-0"><i class="bi bi-laptop"></i> Browser Information</h6>
                                </div>
                                <div class="card-body">
                                    <small class="text-muted text-break">${tracking.user_agent}</small>
                                </div>
                            </div>
                            ` : ''}

                            ${trackingData.signature_tx ? `
                            <div class="card mt-3">
                                <div class="card-header bg-success text-white">
                                    <h6 class="mb-0"><i class="bi bi-patch-check"></i> Blockchain Signature</h6>
                                </div>
                                <div class="card-body">
                                    <p class="mb-2"><strong>Transaction Hash:</strong></p>
                                    <code class="text-break">${trackingData.signature_tx}</code>
                                    <a href="${window.getTronScanUrl ? window.getTronScanUrl(trackingData.signature_tx) : 'https://tronscan.org/#/transaction/' + trackingData.signature_tx}" target="_blank" class="btn btn-sm btn-outline-success mt-2">
                                        <i class="bi bi-box-arrow-up-right"></i> View on TronScan
                                    </a>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('trackingDetailModal');
        if (existingModal) existingModal.remove();

        // Add and show modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('trackingDetailModal'));
        modal.show();

        // Cleanup on close
        document.getElementById('trackingDetailModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },

    // Check individual recipient activity (legacy - now uses tracking details)
    async checkRecipientActivity(recipientAddress, caseNumber) {
        // First try to show from cached tracking data
        if (this.recipientTrackingData[caseNumber]?.[recipientAddress]) {
            this.showRecipientTrackingDetails(recipientAddress, caseNumber);
            return;
        }

        // Otherwise fetch and then show
        try {
            window.app.showProcessing('Fetching recipient tracking data...');
            await this.fetchRecipientStatus(caseNumber);
            window.app.hideProcessing();

            if (this.recipientTrackingData[caseNumber]?.[recipientAddress]) {
                this.showRecipientTrackingDetails(recipientAddress, caseNumber);
            } else {
                window.app.showInfo(`No tracking data available for recipient ${recipientAddress.substring(0, 8)}...`);
            }

        } catch (error) {
            window.app.hideProcessing();
            console.error('Error checking recipient activity:', error);
            window.app.showError('Failed to fetch recipient tracking data');
        }
    },
    
    // Print delivery receipt with proper formatting
    async printDeliveryReceipt(caseNumber) {
        // Use the full printReceipt function which properly generates the receipt
        await this.printReceipt(caseNumber);
    },
    
    // Export stamped document
    async exportStampedDocument(caseNumber) {
        try {
            // Get case data
            const caseData = this.getCaseData(caseNumber) || 
                           this.currentCases.find(c => c.case_number === caseNumber || c.caseNumber === caseNumber);
            
            if (!caseData) {
                window.app.showError('Case not found');
                return;
            }
            
            // Use proof-of-service module if available
            if (window.proofOfService && window.proofOfService.exportStampedDocuments) {
                await window.proofOfService.exportStampedDocuments(caseData);
            } else {
                // Fallback to basic export
                await this.exportStamped(caseNumber);
            }
        } catch (error) {
            console.error('Error exporting stamped document:', error);
            window.app.showError('Failed to export stamped document');
        }
    },
    
    // Export audit log as CSV with full forensic data
    exportAuditLog(caseNumber) {
        const stashed = this._lastAuditExport;
        if (!stashed || !stashed.auditData) {
            window.app?.showError('No audit data available. Please open the audit log first.');
            return;
        }

        const { auditData } = stashed;
        const { recipients, events } = auditData;

        // Build recipient lookup
        const recipientLabels = {};
        (recipients || []).forEach(r => {
            const addr = this.getRecipientAddress(r);
            const label = this.getRecipientLabel(r);
            if (label) recipientLabels[addr] = label;
        });

        // CSV headers — full forensic detail
        const headers = [
            'Case Number', 'Notice/Case ID', 'Recipient', 'Recipient Label', 'Timestamp (UTC)', 'Timestamp (Local)',
            'Action', 'IP Address', 'Browser', 'OS', 'Device',
            'Language', 'Timezone', 'Wallet Provider',
            'Fingerprint ID', 'Fingerprint Confidence',
            'Screen Resolution', 'Visitor ID',
            'Full User Agent'
        ];

        const rows = [headers];

        events.forEach(event => {
            const ua = this.parseUserAgent(event.userAgent);
            const d = event.details ? (typeof event.details === 'string' ? JSON.parse(event.details) : event.details) : {};
            const lang = event.language ? event.language.split(',')[0].split(';')[0].trim() : '';
            const wallet = event.recipientWallet || event.wallet || '';
            const label = recipientLabels[wallet] || '';

            rows.push([
                caseNumber,
                event.targetId || '',
                wallet,
                label,
                event.timestamp ? new Date(event.timestamp).toISOString() : '',
                event.timestamp ? new Date(event.timestamp).toLocaleString() : '',
                event.action || '',
                event.ipAddress || '',
                ua.browser || '',
                ua.os || '',
                ua.device || '',
                lang,
                event.timezone || '',
                d.walletProvider || '',
                d.fingerprint || '',
                d.fingerprintConfidence || '',
                d.screen_resolution || '',
                d.visitorId || '',
                event.userAgent || ''
            ]);
        });

        // Convert to CSV (escape quotes)
        const csv = rows.map(row =>
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        // Download
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_log_case_${caseNumber}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    // Print proof of service receipt
    async printReceipt(caseId) {
        try {
            if (!caseId || caseId === 'undefined' || caseId === 'null') {
                console.error('printReceipt: Invalid caseId provided:', caseId);
                window.app.showError('Unable to print receipt: Invalid case ID');
                return;
            }

            console.log('printReceipt: Printing receipt for case:', caseId);

            // First fetch fresh data from backend
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            let serviceData = null;

            try {
                const response = await fetchWithTimeout(`${backendUrl}/api/cases/${encodeURIComponent(caseId)}/service-data`, {
                    headers: { 'X-Server-Address': window.wallet?.address || '' }
                });
                if (response.ok) {
                    const data = await response.json();
                    serviceData = data.case;
                    console.log('Fetched service data from backend:', serviceData);
                }
            } catch (e) {
                console.log('Could not fetch from backend, using local data');
            }

            // Get local case data as fallback
            let caseData = this.getCaseData(caseId) || {};

            // Merge backend data with local data (backend takes precedence)
            if (serviceData) {
                caseData = { ...caseData, ...serviceData };
            }

            if (!caseData || Object.keys(caseData).length === 0) {
                window.app.showError('Case not found');
                return;
            }

            // Get transaction hash from various possible field names
            const transactionHash = serviceData?.transactionHash || serviceData?.transaction_hash ||
                                   caseData.transactionHash || caseData.transaction_hash ||
                                   caseData.metadata?.transactionHash;

            if (!transactionHash) {
                window.app.showError('No transaction hash found for this case. Please ensure the case has been served.');
                return;
            }

            // Get server/wallet address
            const serverAddress = serviceData?.serverAddress || serviceData?.server_address ||
                                 caseData.serverAddress || caseData.server_address ||
                                 window.wallet?.address || window.tronWeb?.defaultAddress?.base58;

            // Get recipients
            let recipients = serviceData?.recipients || caseData.recipients || caseData.metadata?.recipients || [];
            if (typeof recipients === 'string') {
                try { recipients = JSON.parse(recipients); } catch (e) { recipients = [recipients]; }
            }

            // Get chain info from backend data or derive from current network
            const chainId = serviceData?.chain || caseData.chain || (window.getCurrentChainId ? window.getCurrentChainId() : 'tron-mainnet');
            const chainInfo = window.getChainInfo ? window.getChainInfo(chainId) : null;

            // Get fee breakdown from various sources
            const feeBreakdown = serviceData?.feeBreakdown || caseData.feeBreakdown || caseData.metadata?.feeBreakdown;
            const recipientCount = recipients.length || 1;

            // Get fee config for fallback values
            const feeConfig = window.app?.feeConfig || {
                serviceFeeInTRX: 10,
                recipientFundingInTRX: 20,
                totalPerNoticeInTRX: 30
            };

            // Prepare case data for receipt generation
            const receiptData = {
                caseNumber: serviceData?.caseNumber || caseData.caseNumber || caseData.case_number || caseId,
                serverAddress: serverAddress,
                servedAt: serviceData?.servedAt || serviceData?.served_at || caseData.servedAt || caseData.served_at,
                transactionHash: transactionHash,
                alertTokenId: serviceData?.alertTokenId || serviceData?.alert_token_id || caseData.alertTokenId || caseData.alert_token_id,
                documentTokenId: serviceData?.documentTokenId || serviceData?.document_token_id || caseData.documentTokenId || caseData.document_token_id,
                recipients: recipients,
                documents: caseData.documents || [],
                agency: serviceData?.agency || caseData.agency || caseData.metadata?.issuingAgency || caseData.metadata?.agency,
                noticeType: serviceData?.noticeType || caseData.noticeType || caseData.metadata?.noticeType || 'Legal Notice',
                metadata: caseData.metadata || {},
                alertImage: serviceData?.alertImage || serviceData?.alertPreview || caseData.alertImage || caseData.alertPreview || caseData.alert_image,
                ipfsHash: serviceData?.ipfsHash || serviceData?.ipfsDocument || caseData.ipfsHash || caseData.ipfsDocument,
                chain: chainId,
                chainName: chainInfo?.name || 'Blockchain',
                explorerUrl: serviceData?.explorerUrl || (window.getExplorerTxUrl ? window.getExplorerTxUrl(transactionHash, chainId) : null),
                // Fee breakdown for Page 4 (exact costs, not estimates)
                serviceFeePerRecipient: feeBreakdown?.perRecipient?.serviceFee || serviceData?.serviceFeePerRecipient || feeConfig.serviceFeeInTRX,
                recipientFundingPerRecipient: feeBreakdown?.perRecipient?.recipientFunding || serviceData?.recipientFundingPerRecipient || feeConfig.recipientFundingInTRX,
                totalServiceFees: feeBreakdown?.serviceFee || serviceData?.totalServiceFees || serviceData?.serviceFee || (feeConfig.serviceFeeInTRX * recipientCount),
                totalRecipientFunding: feeBreakdown?.recipientFunding || serviceData?.totalRecipientFunding || serviceData?.recipientFunding || (feeConfig.recipientFundingInTRX * recipientCount),
                totalTransactionCost: feeBreakdown?.total || serviceData?.totalTransactionCost || serviceData?.totalCost,
                recipientCount: recipientCount,
                notificationMessages: serviceData?.notificationMessages || caseData.notificationMessages || caseData.metadata?.notificationMessages || []
            };

            console.log('Receipt data prepared:', receiptData);

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
            if (!caseId) {
                window.app.showError('Invalid case ID');
                return;
            }

            // Get case data
            let caseData = this.getCaseData(caseId);

            if (!caseData) {
                window.app.showError('Case not found');
                return;
            }
            
            // Ensure we have IPFS document - check multiple possible field names
            const ipfsHash = caseData.ipfsDocument || caseData.ipfs_document ||
                           caseData.ipfsHash || caseData.ipfs_hash ||
                           caseData.metadata?.ipfsHash || caseData.metadata?.ipfs_hash ||
                           caseData.metadata?.ipfsDocument || caseData.metadata?.ipfs_document;

            if (!ipfsHash) {
                // Try to fetch from backend if not in local cache
                console.log('IPFS hash not in local cache, fetching from backend...');
                try {
                    const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
                    const response = await fetchWithTimeout(`${backendUrl}/api/cases/${encodeURIComponent(caseId)}/service-data`, {
                        headers: { 'X-Server-Address': window.wallet?.address || '' }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (data.case?.ipfsHash || data.case?.ipfsDocument) {
                            caseData.ipfsHash = data.case.ipfsHash || data.case.ipfsDocument;
                        }
                    }
                } catch (e) {
                    console.log('Could not fetch IPFS hash from backend:', e.message);
                }

                // Check again after backend fetch
                const finalIpfsHash = caseData.ipfsHash || caseData.ipfsDocument;
                if (!finalIpfsHash) {
                    window.app.showError('No IPFS document found for this case. The document may still be processing.');
                    return;
                }
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
    
    // Sync all served cases with blockchain data
    async syncAllServedCases() {
        try {
            // Get all cases
            const cases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
            
            // Filter served cases that have transaction hashes
            const servedCases = cases.filter(c => 
                (c.status === 'served' || c.served_at || c.servedAt || c.transactionHash) &&
                (c.transactionHash || c.transaction_hash || c.txHash)
            );
            
            if (servedCases.length === 0) {
                window.app.showInfo('No served cases found to sync');
                return;
            }
            
            const confirmSync = confirm(`Found ${servedCases.length} served case(s) to sync with blockchain.\n\nThis may take a moment. Continue?`);
            if (!confirmSync) return;
            
            window.app.showInfo(`Syncing ${servedCases.length} cases...`);
            
            let successCount = 0;
            let failCount = 0;
            
            for (const caseData of servedCases) {
                const caseId = caseData.caseNumber || caseData.case_number || caseData.id;
                console.log(`Syncing case ${caseId}...`);
                
                try {
                    // Use the existing sync function but suppress individual alerts
                    await this.syncBlockchainDataSilent(caseId);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to sync case ${caseId}:`, error);
                    failCount++;
                }
                
                // Small delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Show summary
            let message = `✅ Sync complete!\n\n`;
            message += `Successfully synced: ${successCount} cases\n`;
            if (failCount > 0) {
                message += `Failed to sync: ${failCount} cases\n`;
            }
            
            alert(message);
            
            // Reload cases display
            await this.loadCases();
            
        } catch (error) {
            console.error('Failed to sync all cases:', error);
            window.app.showError('Failed to sync all cases: ' + error.message);
        }
    },
    
    // Silent version of syncBlockchainData for batch operations
    async syncBlockchainDataSilent(caseId) {
        // Get case data
        let caseData = this.getCaseData(caseId);
        
        if (!caseData) {
            throw new Error('Case not found');
        }
        
        // We need a transaction hash to query the blockchain
        const txHash = caseData.transactionHash || caseData.transaction_hash || caseData.txHash;
        
        if (!txHash) {
            throw new Error('No transaction hash found');
        }
        
        console.log('Syncing blockchain data for tx:', txHash);
        
        // Fetch transaction info from blockchain
        if (!window.tronWeb) {
            throw new Error('TronWeb not connected');
        }
        
        // Get transaction details
        const txInfo = await window.tronWeb.trx.getTransactionInfo(txHash);
        
        if (!txInfo || !txInfo.id) {
            throw new Error('Transaction not found on blockchain');
        }
        
        // Extract data from transaction
        const blockNumber = txInfo.blockNumber;
        const blockTimestamp = txInfo.blockTimeStamp;
        const contractAddress = txInfo.contract_address;
        
        // Extract token IDs from logs
        let alertTokenId = null;
        let documentTokenId = null;
        let recipientAddresses = [];
        
        if (txInfo.log && txInfo.log.length > 0) {
            // Look for Transfer events (topic[0] is the event signature)
            const transferEventSig = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
            
            txInfo.log.forEach(log => {
                if (log.topics && log.topics[0] === transferEventSig) {
                    // Transfer event: topics[1] = from, topics[2] = to, topics[3] = tokenId
                    if (log.topics.length >= 4) {
                        const toAddress = '0x' + log.topics[2].substring(26); // Remove padding
                        const tokenIdHex = log.topics[3];
                        const tokenId = parseInt(tokenIdHex, 16);
                        
                        // Convert to TRON address
                        try {
                            const tronAddress = window.tronWeb.address.fromHex(toAddress);
                            if (!recipientAddresses.includes(tronAddress)) {
                                recipientAddresses.push(tronAddress);
                            }
                        } catch (e) {
                            console.log('Could not convert address:', toAddress);
                        }
                        
                        // Assign token IDs (first is alert, second is document)
                        if (!alertTokenId) {
                            alertTokenId = tokenId;
                        } else if (!documentTokenId) {
                            documentTokenId = tokenId;
                        }
                        
                        console.log(`Found NFT Transfer: Token #${tokenId} to ${toAddress}`);
                    }
                }
            });
        }
        
        // Update case data with blockchain info
        const updatedData = {
            ...caseData,
            transactionHash: txHash,
            alertTokenId: alertTokenId || caseData.alertTokenId,
            documentTokenId: documentTokenId || caseData.documentTokenId,
            blockNumber: blockNumber,
            blockTimestamp: blockTimestamp,
            contractAddress: contractAddress,
            recipients: recipientAddresses.length > 0 ? recipientAddresses : caseData.recipients,
            servedAt: blockTimestamp ? new Date(blockTimestamp).toISOString() : caseData.servedAt,
            status: 'served',
            syncedAt: new Date().toISOString()
        };
        
        // Update in local storage
        const cases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
        const caseIndex = cases.findIndex(c => 
            c.caseNumber === caseId || 
            c.case_number === caseId || 
            c.id === caseId
        );
        
        if (caseIndex >= 0) {
            cases[caseIndex] = { ...cases[caseIndex], ...updatedData };
            this.safeLocalStorageSet('legalnotice_cases', JSON.stringify(cases));
            console.log('✅ Case updated with blockchain data:', caseId);
        }
        
        return updatedData;
    },
    
    // Sync blockchain data for a served case
    async syncBlockchainData(caseId) {
        try {
            if (!caseId) {
                window.app.showError('Invalid case ID');
                return;
            }

            // Show loading indicator
            window.app.showInfo('Syncing data from backend and blockchain...');

            // Get case data
            let caseData = this.getCaseData(caseId);
            const caseNumber = caseData?.caseNumber || caseData?.case_number || caseId;

            // First try to fetch from backend
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            try {
                const response = await fetchWithTimeout(`${backendUrl}/api/cases/${encodeURIComponent(caseNumber)}/service-data`, {
                    headers: {
                        'X-Server-Address': window.wallet?.address || ''
                    }
                });
                
                if (response.ok) {
                    const serviceData = await response.json();
                    if (serviceData.success && serviceData.case) {
                        console.log(`Got complete service data from backend for case ${caseNumber}`);
                        caseData = { ...caseData, ...serviceData.case };
                        
                        // Update local storage with backend data
                        const localCases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
                        const caseIndex = localCases.findIndex(c => 
                            c.caseNumber === caseNumber || c.case_number === caseNumber
                        );
                        
                        if (caseIndex >= 0) {
                            localCases[caseIndex] = { ...localCases[caseIndex], ...serviceData.case };
                            this.safeLocalStorageSet('legalnotice_cases', JSON.stringify(localCases));
                        }
                        
                        // Reload the cases display
                        await this.loadCases();
                        window.app.showSuccess('✅ Case data synced from backend');
                        return;
                    }
                }
            } catch (error) {
                console.error('Failed to fetch from backend, trying blockchain:', error);
            }
            
            if (!caseData) {
                window.app.showError('Case not found');
                return;
            }
            
            // We need a transaction hash to query the blockchain
            let txHash = caseData.transactionHash || caseData.transaction_hash || caseData.txHash;
            
            if (!txHash) {
                // Try to find transaction by searching recent transactions
                const userChoice = confirm('No transaction hash found. Would you like to enter it manually?');
                
                if (userChoice) {
                    const inputTxHash = prompt('Enter the transaction hash for this case:');
                    if (inputTxHash && inputTxHash.length === 64) {
                        txHash = inputTxHash;
                        caseData.transactionHash = inputTxHash;
                    } else {
                        window.app.showError('Invalid transaction hash');
                        return;
                    }
                } else {
                    window.app.showError('Cannot sync without transaction hash');
                    return;
                }
            }
            
            console.log('Syncing blockchain data for tx:', caseData.transactionHash);
            
            // Fetch transaction info from blockchain
            if (window.tronWeb) {
                try {
                    // Get transaction details
                    const txInfo = await window.tronWeb.trx.getTransactionInfo(caseData.transactionHash);
                    console.log('Transaction info:', txInfo);
                    
                    if (!txInfo || !txInfo.id) {
                        window.app.showError('Transaction not found on blockchain');
                        return;
                    }
                    
                    // Extract data from transaction
                    const blockNumber = txInfo.blockNumber;
                    const blockTimestamp = txInfo.blockTimeStamp;
                    const contractAddress = txInfo.contract_address;
                    
                    // Extract token IDs from logs
                    let alertTokenId = null;
                    let documentTokenId = null;
                    let recipientAddresses = [];
                    
                    if (txInfo.log && txInfo.log.length > 0) {
                        // Look for Transfer events (topic[0] is the event signature)
                        const transferEventSig = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
                        
                        txInfo.log.forEach(log => {
                            if (log.topics && log.topics[0] === transferEventSig) {
                                // Transfer event: topics[1] = from, topics[2] = to, topics[3] = tokenId
                                if (log.topics.length >= 4) {
                                    const toAddress = '0x' + log.topics[2].substring(26); // Remove padding
                                    const tokenIdHex = log.topics[3];
                                    const tokenId = parseInt(tokenIdHex, 16);
                                    
                                    // Convert to TRON address
                                    try {
                                        const tronAddress = window.tronWeb.address.fromHex(toAddress);
                                        if (!recipientAddresses.includes(tronAddress)) {
                                            recipientAddresses.push(tronAddress);
                                        }
                                    } catch (e) {
                                        console.log('Could not convert address:', toAddress);
                                    }
                                    
                                    // Assign token IDs (first is alert, second is document)
                                    if (!alertTokenId) {
                                        alertTokenId = tokenId;
                                    } else if (!documentTokenId) {
                                        documentTokenId = tokenId;
                                    }
                                    
                                    console.log(`Found NFT Transfer: Token #${tokenId} to ${toAddress}`);
                                }
                            }
                        });
                    }
                    
                    // Update case data with blockchain info
                    const updatedData = {
                        ...caseData,
                        transactionHash: caseData.transactionHash,
                        alertTokenId: alertTokenId || caseData.alertTokenId,
                        documentTokenId: documentTokenId || caseData.documentTokenId,
                        blockNumber: blockNumber,
                        blockTimestamp: blockTimestamp,
                        contractAddress: contractAddress,
                        recipients: recipientAddresses.length > 0 ? recipientAddresses : caseData.recipients,
                        servedAt: blockTimestamp ? new Date(blockTimestamp).toISOString() : caseData.servedAt,
                        status: 'served',
                        syncedAt: new Date().toISOString()
                    };
                    
                    // Update in local storage
                    const cases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
                    const caseIndex = cases.findIndex(c => 
                        c.caseNumber === caseId || 
                        c.case_number === caseId || 
                        c.id === caseId
                    );
                    
                    if (caseIndex >= 0) {
                        cases[caseIndex] = { ...cases[caseIndex], ...updatedData };
                        this.safeLocalStorageSet('legalnotice_cases', JSON.stringify(cases));
                        console.log('✅ Case updated with blockchain data');
                    }
                    
                    // Show success message with details
                    let message = `✅ Blockchain data synced successfully!\n\n`;
                    message += `Block: #${blockNumber}\n`;
                    if (alertTokenId) message += `Alert Token ID: #${alertTokenId}\n`;
                    if (documentTokenId) message += `Document Token ID: #${documentTokenId}\n`;
                    if (recipientAddresses.length > 0) {
                        message += `Recipients: ${recipientAddresses.length} found\n`;
                    }
                    
                    alert(message);
                    
                    // Reload cases display
                    await this.loadCases();
                    
                } catch (error) {
                    console.error('Error fetching transaction info:', error);
                    window.app.showError('Failed to fetch blockchain data: ' + error.message);
                }
            } else {
                window.app.showError('TronWeb not connected. Please connect wallet first.');
            }
            
        } catch (error) {
            console.error('Failed to sync blockchain data:', error);
            window.app.showError('Failed to sync: ' + error.message);
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
    },
    
    // Generate notice rows for the service details table
    generateNoticeRows(caseData) {
        // Check if case has been served and has NFT IDs
        const alertTokenId = caseData.alertTokenId || caseData.alert_token_id;
        const documentTokenId = caseData.documentTokenId || caseData.document_token_id;
        const servedAt = caseData.servedAt || caseData.served_at;
        
        // Get recipients list
        let recipients = [];
        if (caseData.recipients) {
            if (Array.isArray(caseData.recipients)) {
                recipients = caseData.recipients;
            } else if (typeof caseData.recipients === 'string') {
                try {
                    recipients = JSON.parse(caseData.recipients);
                } catch (e) {
                    console.error('Error parsing recipients:', e);
                    recipients = [];
                }
            }
        } else if (caseData.metadata?.recipients) {
            recipients = caseData.metadata.recipients;
        }
        
        // Get notice type and agency
        const noticeType = caseData.noticeType || caseData.metadata?.noticeType || 'Legal Notice';
        const agency = caseData.agency || caseData.issuingAgency || caseData.metadata?.agency || 
                      caseData.metadata?.issuingAgency || 'via Blockserved.com';
        
        // If case has been served, show the actual notices
        if (alertTokenId && recipients.length > 0) {
            return recipients.map(recipient => {
                const addr = this.getRecipientAddress(recipient);
                const label = this.getRecipientLabel(recipient);
                return `
                <tr>
                    <td>
                        Alert: #${alertTokenId}<br>
                        Doc: #${documentTokenId || 'N/A'}
                    </td>
                    <td>${label ? `<span class="badge bg-info me-1">${label}</span>` : ''}${this.formatAddress(addr)}</td>
                    <td>${noticeType}</td>
                    <td>${servedAt ? new Date(servedAt).toLocaleDateString() : 'Pending'}</td>
                    <td>
                        <button class="btn btn-sm btn-info"
                                onclick="window.open('https://blockserved.com?case=${encodeURIComponent(caseData.case_number || caseData.caseNumber)}', '_blank')">
                            <i class="bi bi-eye"></i> View
                        </button>
                    </td>
                </tr>`;
            }).join('');
        }
        
        // If we have old-style notices array
        if (caseData.notices && caseData.notices.length > 0) {
            return caseData.notices.map(n => `
                <tr>
                    <td>${n.noticeId ? n.noticeId.substring(0, 8) + '...' : 'N/A'}</td>
                    <td>${this.formatAddress(n.recipient)}</td>
                    <td>${n.type || noticeType}</td>
                    <td>${n.timestamp ? new Date(n.timestamp).toLocaleDateString() : 'N/A'}</td>
                    <td>
                        <button class="btn btn-sm btn-info"
                                onclick="window.open('https://blockserved.com?case=${encodeURIComponent(n.caseNumber || caseData.case_number || caseData.caseNumber)}', '_blank')">
                            View
                        </button>
                    </td>
                </tr>
            `).join('');
        }
        
        // No notices served yet
        return '<tr><td colspan="5" class="text-center text-muted">No notices served yet</td></tr>';
    },

    // Send message transfers to recipients of an already-served case
    async sendMessage(caseNumber) {
        try {
            if (!window.wallet?.connected) {
                window.app.showError('Please connect your wallet first.');
                return;
            }
            if (!window.contract?.sendNotificationTransfer) {
                window.app.showError('Contract not initialized. Please connect your wallet and try again.');
                return;
            }

            // Find case data from local storage
            const allCases = window.storage.get('cases') || [];
            const legalNoticeCases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
            let caseData = allCases.find(c => (c.caseNumber || c.case_number || c.id) === caseNumber)
                        || legalNoticeCases.find(c => (c.caseNumber || c.case_number || c.id) === caseNumber);

            // Try backend if not found locally
            if (!caseData) {
                const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
                const resp = await fetchWithTimeout(`${backendUrl}/api/cases/by-number/${encodeURIComponent(caseNumber)}`, {
                    headers: { 'X-Server-Address': window.wallet.address }
                });
                if (resp.ok) {
                    const result = await resp.json();
                    caseData = result.success ? result.case : null;
                }
            }

            if (!caseData) {
                window.app.showError('Case not found: ' + caseNumber);
                return;
            }

            const recipients = caseData.recipients || [];
            if (recipients.length === 0) {
                window.app.showError('No recipients found for this case.');
                return;
            }

            const recipientAddresses = recipients.map(r => typeof r === 'string' ? r : r.address);
            const noticeType = caseData.noticeType || caseData.notice_type
                || (caseData.metadata && (typeof caseData.metadata === 'string' ? JSON.parse(caseData.metadata) : caseData.metadata).noticeType)
                || 'Legal Notice';
            const agency = caseData.agency || caseData.issuingAgency
                || (caseData.metadata && (typeof caseData.metadata === 'string' ? JSON.parse(caseData.metadata) : caseData.metadata).agency)
                || 'via Blockserved.com';
            const defaultMemo = `Legal Notice: ${noticeType} - Visit www.blockserved.com to view notice. Reference: ${agency}, Case #${caseNumber}`;

            // Close the service details modal to avoid stacking
            const receiptModal = document.getElementById('receiptModal');
            if (receiptModal) {
                const bsModal = bootstrap.Modal.getInstance(receiptModal);
                if (bsModal) bsModal.hide();
                await new Promise(r => setTimeout(r, 400));
            }

            let sent = 0;
            let skipped = 0;
            let failed = 0;
            const notificationMessages = [];

            for (let i = 0; i < recipientAddresses.length; i++) {
                const approval = await showNotificationApproval(
                    recipientAddresses[i], defaultMemo, i + 1, recipientAddresses.length
                );

                if (approval.action === 'skipAll') {
                    for (let j = i; j < recipientAddresses.length; j++) {
                        notificationMessages.push({ address: recipientAddresses[j], message: '', status: 'skipped' });
                    }
                    skipped += recipientAddresses.length - i;
                    break;
                }
                if (approval.action === 'skip') {
                    notificationMessages.push({ address: recipientAddresses[i], message: '', status: 'skipped' });
                    skipped++;
                    continue;
                }

                // Show processing while TronLink signs
                if (window.app?.showProcessing) {
                    window.app.showProcessing('Sending message...', `${i + 1} of ${recipientAddresses.length}`);
                }

                const result = await window.contract.sendNotificationTransfer(
                    recipientAddresses[i], approval.message
                );

                if (window.app?.hideProcessing) window.app.hideProcessing();

                if (!result.success) {
                    notificationMessages.push({ address: recipientAddresses[i], message: approval.message, status: 'failed' });
                    failed++;
                    console.warn(`Notification transfer failed for ${recipientAddresses[i]}:`, result.error);
                    if (result.error && (result.error.includes('Confirmation declined') || result.error.includes('reject'))) {
                        for (let j = i + 1; j < recipientAddresses.length; j++) {
                            notificationMessages.push({ address: recipientAddresses[j], message: '', status: 'skipped' });
                        }
                        skipped += recipientAddresses.length - i - 1;
                        break;
                    }
                } else {
                    notificationMessages.push({ address: recipientAddresses[i], message: approval.message, status: 'sent' });
                    sent++;
                    console.log(`Notification sent to ${recipientAddresses[i]}: ${result.txId}`);
                }

                // Rate limiting: 5-second delay between transfers to avoid TronGrid 429s
                if (i < recipientAddresses.length - 1) {
                    await new Promise(r => setTimeout(r, 5000));
                }
            }

            // Save notification messages to backend
            if (notificationMessages.length > 0) {
                try {
                    const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
                    await fetchWithTimeout(`${backendUrl}/api/cases/${encodeURIComponent(caseNumber)}/notification-messages`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messages: notificationMessages })
                    });
                    console.log(`Saved ${notificationMessages.length} notification messages to backend`);
                } catch (saveErr) {
                    console.warn('Failed to save notification messages to backend:', saveErr);
                }
            }

            // Show summary — prominent warning if any failed
            const failedMsgs = notificationMessages.filter(n => n.status === 'failed');
            if (failedMsgs.length > 0) {
                const failedAddrs = failedMsgs.map(n => {
                    const a = n.address || '?';
                    return a.length > 18 ? a.slice(0, 8) + '...' + a.slice(-6) : a;
                }).join(', ');
                window.app.showWarning(
                    `${sent} sent, ${failedMsgs.length} FAILED. Retry with "Send Message" for: ${failedAddrs}`
                );
                console.error(`MESSAGE FAILURE: ${failedMsgs.length} of ${recipientAddresses.length} messages failed for case ${caseNumber}:`, failedMsgs);
            } else if (sent > 0) {
                let summary = `Messages complete: ${sent} sent`;
                if (skipped > 0) summary += `, ${skipped} skipped`;
                window.app.showSuccess(summary);
            } else {
                let summary = `Messages complete: ${sent} sent`;
                if (skipped > 0) summary += `, ${skipped} skipped`;
                window.app.showWarning(summary);
            }

        } catch (error) {
            console.error('Send message error:', error);
            if (window.app?.hideProcessing) window.app.hideProcessing();
            window.app.showError('Failed to send messages: ' + error.message);
        }
    }
};

console.log('Cases module loaded');