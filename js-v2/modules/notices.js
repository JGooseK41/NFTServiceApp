// Notices Module - Handles the complete notice creation workflow
window.notices = {
    
    // Initialize module
    async init() {
        console.log('Initializing notices module...');
        
        // Load required libraries
        await this.loadDependencies();
    },
    
    // Load dependencies
    async loadDependencies() {
        // Ensure documents module is loaded
        if (window.documents) {
            await window.documents.init();
        }
        
        // Load CryptoJS for encryption if needed
        if (!window.CryptoJS) {
            await this.loadCryptoJS();
        }
    },
    
    // Main notice creation workflow - Creates both Alert and Document NFTs for all recipients
    async createNotice(data) {
        try {
            console.log('Creating legal service package for recipients:', data.recipients);
            
            // Step 1: Validate inputs
            this.validateNoticeData(data);
            
            // Step 2: Generate unique notice ID
            const noticeId = this.generateNoticeId();
            
            // Step 3: Get server ID (process server info)
            const serverId = await this.getServerId();
            
            // Step 4: Process documents (always required now)
            console.log('Processing and consolidating PDFs...');
            
            // Process multiple PDFs into ONE consolidated document (shared by all recipients)
            // IMPORTANT: Enable IPFS upload for permanent immutable storage
            const documentData = await window.documents.processDocuments(data.documents, {
                encrypt: true,           // ALWAYS encrypt for IPFS
                useIPFS: true,          // ENABLE IPFS upload for immutable record
                recipientAddress: data.recipients.join(', '), // All recipients
                caseNumber: data.caseNumber,
                type: 'legal_document'
            });
            
            // Use thumbnail URL for NFT metadata (not base64 data)
            const thumbnailUrl = documentData.thumbnailUrl;
            const thumbnail = documentData.thumbnail; // Keep for local UI only
            
            console.log('Documents consolidated with optimized thumbnail:', {
                thumbnailUrl,
                thumbnailForUI: thumbnail ? 'Available for local display' : 'Not available',
                ipfsHash: documentData.ipfsHash
            });
            
            // Step 5: Skip storing notice in backend - Case Manager already has everything
            // The actual notice will be tracked after blockchain confirmation
            console.log('Notice data prepared, proceeding to NFT minting...');
            
            // Step 6: Energy check is handled by the main app flow
            console.log('Energy requirements handled by main app flow');
            
            // Step 7: Create NFTs for all recipients (batch or individual)
            let txResults = [];
            
            // Check if we should use batch (multiple recipients)
            if (data.recipients.length > 1) {
                console.log(`Creating batch notices for ${data.recipients.length} recipients...`);
                console.log('window.contract available:', !!window.contract);
                console.log('window.contract methods:', window.contract ? Object.keys(window.contract) : 'undefined');
                
                // Ensure contract module is available
                if (!window.contract) {
                    throw new Error('Contract module not initialized. Please ensure wallet is connected.');
                }
                
                if (!window.contract.createBatchNotices) {
                    throw new Error('createBatchNotices method not found in contract module');
                }
                
                // Use v5 contract's batch function
                const batchResult = await window.contract.createBatchNotices({
                    recipients: data.recipients,
                    noticeId,
                    caseNumber: data.caseNumber,
                    noticeText: data.noticeText,
                    serverId,
                    serverTimestamp: Math.floor(Date.now() / 1000),
                    thumbnail: null, // Don't send base64 data
                    thumbnailUrl: documentData.thumbnailUrl, // Send URL instead
                    encrypted: data.encrypt !== false,
                    ipfsHash: documentData.ipfsHash,  // Will be null if not using IPFS
                    diskUrl: documentData.diskUrl,     // The actual PDF URL on server
                    encryptionKey: documentData.encryptionKey || '',
                    pageCount: documentData.pageCount || 1,
                    deadline: data.deadline || '',
                    agency: data.issuingAgency || data.agency || 'Legal Services',  // From form
                    legalRights: 'View full document at www.BlockServed.com for info on your rights and next steps',  // Hardcoded
                    sponsorFees: false,
                    caseDetails: data.caseDetails || data.noticeText
                });
                
                txResults.push(batchResult);
                
            } else {
                // Single recipient - use regular method
                console.log('Creating notices for single recipient...');
                
                const nftData = {
                    noticeId,
                    recipient: data.recipients[0],
                    caseNumber: data.caseNumber,
                    noticeText: data.noticeText,
                    serverId,
                    serverTimestamp: Math.floor(Date.now() / 1000),
                    thumbnail: null, // Don't send base64
                    thumbnailUrl: documentData.thumbnailUrl, // Send URL instead
                    encrypted: data.encrypt !== false,
                    ipfsHash: documentData.ipfsHash,
                    pageCount: documentData.pageCount || 1,
                    deadline: data.deadline || '',
                    agency: data.issuingAgency || data.agency || 'Legal Services',  // From form
                    legalRights: 'View full document at www.BlockServed.com for info on your rights and next steps',  // Hardcoded
                    sponsorFees: false
                };
                
                // Create Alert NFT
                const alertResult = await window.contract.createAlertNFT(nftData);
                
                // Create Document NFT
                const documentResult = await window.contract.createDocumentNFT({
                    ...nftData,
                    legalRights: 'View full document at www.BlockServed.com for info on your rights and next steps'  // Hardcoded
                });
                
                txResults.push({
                    alertTx: alertResult.txId,
                    documentTx: documentResult.txId,
                    success: alertResult.success && documentResult.success
                });
            }
            
            const txResult = txResults[0]; // For now, use first result
            
            // Step 8: Update backend with transaction info
            await this.updateNoticeWithTransaction(noticeId, {
                alertTx: txResult.alertTx,
                documentTx: txResult.documentTx
            });
            
            // Step 8.5: Mark case as served if we have a case ID
            if (window.app && window.app.currentCaseId) {
                try {
                    // Initialize case management client if needed
                    if (!window.caseManager) {
                        const CaseManagementClient = window.CaseManagementClient || (await import('/js/case-management-client.js')).default;
                        window.caseManager = new CaseManagementClient();
                    }
                    
                    // Mark the case as served with transaction hashes
                    const servedResult = await window.caseManager.markCaseAsServed(
                        window.app.currentCaseId,
                        txResult.alertTx,     // Transaction hash for Alert NFT
                        txResult.alertTx,     // Alert NFT ID (using tx hash as ID)
                        txResult.documentTx   // Document NFT ID (using tx hash as ID)
                    );
                    
                    if (servedResult.success) {
                        console.log('✅ Case marked as served in backend:', window.app.currentCaseId);
                    }
                } catch (error) {
                    console.error('Failed to mark case as served:', error);
                    // Don't fail the whole transaction, just log the error
                }
            }
            
            // Step 9: Generate receipt
            const receipt = await this.generateReceipt({
                noticeId,
                alertTxId: txResult.alertTx,
                documentTxId: txResult.documentTx,
                type: 'Legal Service Package',
                recipient: data.recipient,
                caseNumber: data.caseNumber,
                timestamp: new Date().toISOString(),
                serverId,
                thumbnail,
                encrypted: data.encrypt !== false,
                ipfsHash: documentData.ipfsHash
            });
            
            // Show success confirmation with receipt
            this.showSuccessConfirmation({
                success: true,
                noticeId,
                alertTxId: txResult.alertTx,
                documentTxId: txResult.documentTx,
                receipt,
                viewUrl: `https://blockserved.com/notice/${noticeId}`,
                caseNumber: data.caseNumber,
                recipient: data.recipient,
                thumbnail,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                noticeId,
                alertTxId: txResult.alertTx,
                documentTxId: txResult.documentTx,
                receipt,
                viewUrl: `https://blockserved.com/notice/${noticeId}`,
                message: 'Legal service package created successfully (Alert + Document NFTs)'
            };
            
        } catch (error) {
            console.error('Failed to create notice:', error);
            
            // Check if this is a batch minting failure
            if (error.batchMintingFailed && error.recipients) {
                // Show options for selective minting
                const userChoice = await this.showBatchFailureOptions(error);
                
                if (userChoice && userChoice.selectedRecipients && userChoice.selectedRecipients.length > 0) {
                    // User selected specific recipients to mint to
                    console.log('User selected recipients for individual minting:', userChoice.selectedRecipients);
                    
                    const result = await window.contract.mintToSelectedRecipients(
                        userChoice.selectedRecipients,
                        {
                            ...data,
                            batchNotices: error.batchNotices,
                            ipfsHash: documentData.ipfsHash,
                            encryptionKey: documentData.encryptionKey,
                            metadataURI: metadata
                        }
                    );
                    
                    if (result.success) {
                        // Show mixed success message
                        this.showMixedSuccessConfirmation({
                            ...result,
                            caseNumber: data.caseNumber,
                            totalRecipients: data.recipients.length,
                            mintedRecipients: userChoice.selectedRecipients
                        });
                        
                        return {
                            success: true,
                            partial: true,
                            ...result
                        };
                    }
                }
                
                // User cancelled or no recipients selected
                throw new Error('Batch minting failed and user chose not to mint individually');
            }
            
            // Show failure confirmation for other errors
            this.showFailureConfirmation({
                error: error.message,
                caseNumber: data.caseNumber,
                recipient: data.recipient,
                timestamp: new Date().toISOString()
            });
            
            throw error;
        }
    },
    
    // Validate notice data
    validateNoticeData(data) {
        if (!data.recipients || data.recipients.length === 0) {
            throw new Error('At least one recipient address is required');
        }
        
        // Validate each recipient
        for (const recipient of data.recipients) {
            if (!window.wallet || !window.wallet.isValidAddress || !window.wallet.isValidAddress(recipient)) {
                // Basic validation if wallet module not ready
                if (!recipient.startsWith('T') || recipient.length !== 34) {
                    throw new Error(`Invalid recipient address: ${recipient}`);
                }
            }
        }
        
        if (!data.caseNumber) {
            throw new Error('Case number is required');
        }
        
        if (!data.noticeText) {
            throw new Error('Notice description is required');
        }
        
        if (!data.documents || data.documents.length === 0) {
            throw new Error('At least one PDF document is required');
        }
    },
    
    // Generate unique notice ID
    generateNoticeId() {
        // Generate a unique ID using timestamp and random string
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `${timestamp}-${random}`;
    },
    
    // Get or create server ID
    async getServerId() {
        // Check localStorage first
        let serverId = localStorage.getItem(getConfig('storage.keys.serverId'));
        
        if (!serverId) {
            try {
                // Try to register new server
                const response = await fetch(getApiUrl('registerServer'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        address: window.wallet.address,
                        name: 'Process Server',
                        agency: 'Legal Services',
                        timestamp: Date.now()
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    serverId = data.serverId;
                    localStorage.setItem(getConfig('storage.keys.serverId'), serverId);
                } else {
                    throw new Error('Server registration endpoint not available');
                }
            } catch (error) {
                // Generate fallback ID - this is fine, server registration is optional
                console.log('Server registration not available, using fallback ID');
                serverId = `PS-${window.wallet.address.substring(0, 8)}-${Date.now()}`;
                localStorage.setItem(getConfig('storage.keys.serverId'), serverId);
            }
        }
        
        return serverId;
    },
    
    // Create alert thumbnail for notices without documents
    async createAlertThumbnail(data) {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 1000;
        const ctx = canvas.getContext('2d');
        
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Red header
        ctx.fillStyle = '#dc3545';
        ctx.fillRect(0, 0, canvas.width, 150);
        
        // Header text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LEGAL NOTICE', canvas.width / 2, 80);
        
        ctx.font = '24px Arial';
        ctx.fillText('Delivered via Blockchain', canvas.width / 2, 120);
        
        // Notice details
        ctx.fillStyle = 'black';
        ctx.font = '20px Arial';
        ctx.textAlign = 'left';
        
        let y = 200;
        const lineHeight = 35;
        
        // Case number
        ctx.font = 'bold 20px Arial';
        ctx.fillText('Case Number:', 50, y);
        ctx.font = '20px Arial';
        ctx.fillText(data.caseNumber, 200, y);
        y += lineHeight;
        
        // Date
        ctx.font = 'bold 20px Arial';
        ctx.fillText('Date Served:', 50, y);
        ctx.font = '20px Arial';
        ctx.fillText(new Date().toLocaleDateString(), 200, y);
        y += lineHeight;
        
        // Time
        ctx.font = 'bold 20px Arial';
        ctx.fillText('Time:', 50, y);
        ctx.font = '20px Arial';
        ctx.fillText(new Date().toLocaleTimeString(), 200, y);
        y += lineHeight * 2;
        
        // Notice text (wrapped)
        ctx.font = 'bold 20px Arial';
        ctx.fillText('Notice:', 50, y);
        y += lineHeight;
        
        ctx.font = '18px Arial';
        const words = data.noticeText.split(' ');
        let line = '';
        const maxWidth = canvas.width - 100;
        
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, 50, y);
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, 50, y);
        
        // Footer with access instructions
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, canvas.height - 200, canvas.width, 200);
        
        ctx.fillStyle = 'black';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('IMPORTANT NOTICE', canvas.width / 2, canvas.height - 150);
        
        ctx.font = '20px Arial';
        ctx.fillText('You have been served legal documents', canvas.width / 2, canvas.height - 110);
        ctx.fillText('View and respond at:', canvas.width / 2, canvas.height - 70);
        
        ctx.fillStyle = '#007bff';
        ctx.font = 'bold 28px Arial';
        ctx.fillText('blockserved.com', canvas.width / 2, canvas.height - 30);
        
        // Convert to data URI
        return canvas.toDataURL('image/png', 0.9);
    },
    
    // Check energy availability
    async checkEnergy(noticeType) {
        const resources = await window.wallet.getAccountResources();
        const required = noticeType === 'alert' ? 65000 : 75000;
        
        return {
            sufficient: resources.energy.available >= required,
            available: resources.energy.available,
            required: required,
            deficit: Math.max(0, required - resources.energy.available)
        };
    },
    
    // Prompt user to rent energy
    async promptEnergyRental(required) {
        const message = `
            You need ${required} energy to complete this transaction.
            Would you like to rent energy from TronSave?
        `;
        
        if (confirm(message)) {
            // Open TronSave in new tab
            window.open('https://tronsave.io', '_blank');
            
            // Wait for user to complete rental
            await this.waitForEnergyRental();
        }
    },
    
    // Wait for energy rental to complete
    async waitForEnergyRental() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(async () => {
                const resources = await window.wallet.getAccountResources();
                if (resources.energy.available >= 65000) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 5000);
            
            // Timeout after 5 minutes
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 300000);
        });
    },
    
    // Store notice in backend (DEPRECATED - Case Manager handles this)
    async storeNoticeInBackend(data) {
        // Skip API call - Case Manager already has the data
        console.log('Notice tracking handled by Case Manager');
        return {
            success: true,
            noticeId: data.noticeId,
            caseNumber: data.caseNumber
        };
    },
    
    // Update notice with transaction info (handled by case manager)
    async updateNoticeWithTransaction(noticeId, txData) {
        // This is now handled by the case manager's markCaseAsServed
        console.log('Transaction info will be stored via Case Manager');
        return true;
    },
    
    // Generate receipt
    async generateReceipt(data) {
        const receipt = {
            ...data,
            receiptId: `RCPT-${data.noticeId}`,
            generatedAt: new Date().toISOString(),
            verificationUrl: `https://tronscan.org/#/transaction/${data.txId}`,
            accessUrl: `https://blockserved.com/notice/${data.noticeId}`
        };
        
        // Store receipt locally
        const receipts = JSON.parse(localStorage.getItem(getConfig('storage.keys.receipts')) || '[]');
        receipts.push(receipt);
        localStorage.setItem(getConfig('storage.keys.receipts'), JSON.stringify(receipts));
        
        return receipt;
    },
    
    // View notice (for recipients)
    async viewNotice(noticeId) {
        try {
            // For V2, notices are viewed through the recipient portal
            // Try to get from local storage first
            const receipts = JSON.parse(localStorage.getItem(getConfig('storage.keys.receipts')) || '[]');
            const notice = receipts.find(r => r.noticeId === noticeId);
            
            if (notice) {
                // Display locally stored notice
                this.displayNoticeViewer(notice);
            } else {
                // Redirect to recipient portal
                console.log('Redirecting to recipient portal for notice viewing');
                window.open(`https://blockserved.com/notice/${noticeId}`, '_blank');
            }
            
        } catch (error) {
            console.error('Failed to view notice:', error);
            if (window.app) {
                window.app.showError('Notice not found - please check blockserved.com');
            }
        }
    },
    
    // Display notice viewer modal
    displayNoticeViewer(notice) {
        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="noticeViewerModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Legal Notice - ${notice.caseNumber}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Notice Details</h6>
                                    <p><strong>Type:</strong> ${notice.type}</p>
                                    <p><strong>Case:</strong> ${notice.caseNumber}</p>
                                    <p><strong>Served:</strong> ${new Date(notice.timestamp).toLocaleString()}</p>
                                    <p><strong>Description:</strong> ${notice.noticeText}</p>
                                </div>
                                <div class="col-md-6">
                                    <h6>Preview</h6>
                                    <img src="${notice.thumbnail}" class="img-fluid" alt="Notice preview">
                                </div>
                            </div>
                            ${notice.ipfsHash ? `
                                <div class="mt-3">
                                    <button class="btn btn-primary" onclick="notices.downloadDocument('${notice.ipfsHash}', '${notice.encryptionKey}')">
                                        Download Full Document
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            ${notice.type === 'document' ? `
                                <button class="btn btn-success" onclick="notices.signDocument('${notice.noticeId}')">
                                    Sign Document
                                </button>
                            ` : ''}
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('noticeViewerModal'));
        modal.show();
        
        // Clean up on close
        document.getElementById('noticeViewerModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },
    
    // Download document from IPFS
    async downloadDocument(ipfsHash, encryptionKey) {
        try {
            const url = `${getConfig('storage.ipfsGateway')}${ipfsHash}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Failed to download document');
            }
            
            let blob = await response.blob();
            
            // Decrypt if needed
            if (encryptionKey) {
                const decrypted = await window.documents.decryptDocument(blob, encryptionKey);
                blob = decrypted;
            }
            
            // Create download link
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `legal_document_${Date.now()}.pdf`;
            a.click();
            
            URL.revokeObjectURL(downloadUrl);
            
        } catch (error) {
            console.error('Failed to download document:', error);
            if (window.app) {
                window.app.showError('Failed to download document');
            }
        }
    },
    
    // Sign document (for recipients)
    async signDocument(noticeId) {
        // This would implement document signing logic
        console.log('Signing document:', noticeId);
        alert('Document signing will be implemented');
    },
    
    // Show success confirmation modal with receipt options
    showSuccessConfirmation(data) {
        const modalHtml = `
            <div class="modal fade" id="mintSuccessModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-check-circle-fill me-2"></i>
                                NFT Minting Successful!
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-success mb-3">
                                <strong>✅ Success!</strong> Your legal notice NFTs have been minted on the blockchain.
                            </div>
                            
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <h6>Transaction Details:</h6>
                                    <ul class="list-unstyled">
                                        <li><strong>Case Number:</strong> ${data.caseNumber}</li>
                                        <li><strong>Recipient:</strong> <small>${data.recipient}</small></li>
                                        <li><strong>Timestamp:</strong> ${new Date(data.timestamp).toLocaleString()}</li>
                                    </ul>
                                </div>
                                <div class="col-md-6">
                                    <h6>Blockchain Confirmation:</h6>
                                    <ul class="list-unstyled">
                                        <li><strong>Alert NFT TX:</strong><br>
                                            <small class="text-break">
                                                <a href="https://tronscan.org/#/transaction/${data.alertTxId}" 
                                                   target="_blank" class="text-decoration-none">
                                                    ${data.alertTxId.substring(0, 20)}...
                                                    <i class="bi bi-box-arrow-up-right"></i>
                                                </a>
                                            </small>
                                        </li>
                                        <li><strong>Document NFT TX:</strong><br>
                                            <small class="text-break">
                                                <a href="https://tronscan.org/#/transaction/${data.documentTxId}" 
                                                   target="_blank" class="text-decoration-none">
                                                    ${data.documentTxId.substring(0, 20)}...
                                                    <i class="bi bi-box-arrow-up-right"></i>
                                                </a>
                                            </small>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                            
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="checkbox" id="includeNFTImage" checked>
                                <label class="form-check-label" for="includeNFTImage">
                                    Include Alert NFT image in receipt
                                </label>
                            </div>
                            
                            ${data.thumbnail ? `
                            <div class="text-center mb-3" id="nftImagePreview">
                                <h6>Alert NFT Preview:</h6>
                                <img src="${data.thumbnail}" class="img-fluid" style="max-height: 200px; border: 1px solid #dee2e6;">
                            </div>
                            ` : ''}
                            
                            <div class="alert alert-info">
                                <strong>Recipient Access:</strong> The recipient can view and download their documents at:<br>
                                <a href="${data.viewUrl}" target="_blank">${data.viewUrl}</a>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onclick="notices.generateProofOfDelivery('${encodeURIComponent(JSON.stringify(data))}')">
                                <i class="bi bi-file-earmark-pdf"></i> Generate Proof of Delivery
                            </button>
                            <button type="button" class="btn btn-success" onclick="notices.printReceipt('${encodeURIComponent(JSON.stringify(data))}')">
                                <i class="bi bi-printer"></i> Print Receipt
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing modal
        const existing = document.getElementById('mintSuccessModal');
        if (existing) existing.remove();
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('mintSuccessModal'));
        modal.show();
        
        // Clean up on close
        document.getElementById('mintSuccessModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },
    
    // Show failure confirmation modal
    showFailureConfirmation(data) {
        const modalHtml = `
            <div class="modal fade" id="mintFailureModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-x-circle-fill me-2"></i>
                                NFT Minting Failed
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-danger">
                                <strong>❌ Transaction Failed</strong><br>
                                ${data.error}
                            </div>
                            
                            <h6>Details:</h6>
                            <ul>
                                <li><strong>Case Number:</strong> ${data.caseNumber}</li>
                                <li><strong>Recipient:</strong> ${data.recipient}</li>
                                <li><strong>Time:</strong> ${new Date(data.timestamp).toLocaleString()}</li>
                            </ul>
                            
                            <div class="alert alert-info">
                                <strong>What to do:</strong>
                                <ol>
                                    <li>Check your wallet balance</li>
                                    <li>Ensure you have enough TRX for fees</li>
                                    <li>Verify the recipient address is valid</li>
                                    <li>Try again or contact support</li>
                                </ol>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onclick="location.reload()">
                                <i class="bi bi-arrow-clockwise"></i> Try Again
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing modal
        const existing = document.getElementById('mintFailureModal');
        if (existing) existing.remove();
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('mintFailureModal'));
        modal.show();
        
        // Clean up on close
        document.getElementById('mintFailureModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },
    
    // Generate proof of delivery PDF
    async generateProofOfDelivery(encodedData) {
        const data = JSON.parse(decodeURIComponent(encodedData));
        const includeImage = document.getElementById('includeNFTImage')?.checked ?? true;
        
        // Create receipt HTML
        const receiptHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Proof of Delivery - ${data.caseNumber}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .header { text-align: center; border-bottom: 3px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                    .title { font-size: 24px; font-weight: bold; color: #333; }
                    .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
                    .section { margin-bottom: 25px; }
                    .section-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                    .detail-row { margin-bottom: 8px; }
                    .label { font-weight: bold; display: inline-block; width: 150px; }
                    .value { color: #555; word-break: break-all; }
                    .tx-hash { font-family: monospace; font-size: 12px; color: #0066cc; }
                    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666; }
                    .nft-image { max-width: 300px; margin: 20px auto; display: block; border: 1px solid #ddd; }
                    .success-badge { background: #28a745; color: white; padding: 5px 10px; border-radius: 3px; display: inline-block; }
                    @media print { body { margin: 20px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">PROOF OF DELIVERY</div>
                    <div class="subtitle">Legal Notice Service via Blockchain</div>
                    <div style="margin-top: 10px;">
                        <span class="success-badge">✓ SUCCESSFULLY DELIVERED</span>
                    </div>
                </div>
                
                <div class="section">
                    <div class="section-title">Service Details</div>
                    <div class="detail-row">
                        <span class="label">Case Number:</span>
                        <span class="value">${data.caseNumber}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Service Date:</span>
                        <span class="value">${new Date(data.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Service Time:</span>
                        <span class="value">${new Date(data.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Notice ID:</span>
                        <span class="value">${data.noticeId}</span>
                    </div>
                </div>
                
                <div class="section">
                    <div class="section-title">Recipient Information</div>
                    <div class="detail-row">
                        <span class="label">Wallet Address:</span>
                        <span class="value">${data.recipient}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Access URL:</span>
                        <span class="value">${data.viewUrl}</span>
                    </div>
                </div>
                
                <div class="section">
                    <div class="section-title">Blockchain Confirmation</div>
                    <div class="detail-row">
                        <span class="label">Alert NFT TX:</span>
                        <span class="value tx-hash">${data.alertTxId}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Document NFT TX:</span>
                        <span class="value tx-hash">${data.documentTxId}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Verification:</span>
                        <span class="value">View on TronScan: https://tronscan.org/#/transaction/${data.alertTxId}</span>
                    </div>
                </div>
                
                ${includeImage && data.thumbnail ? `
                <div class="section">
                    <div class="section-title">Alert NFT Image</div>
                    <img src="${data.thumbnail}" class="nft-image" alt="Alert NFT">
                </div>
                ` : ''}
                
                <div class="footer">
                    <p>This document certifies that legal notice was successfully delivered via blockchain technology.</p>
                    <p>Generated: ${new Date().toLocaleString()} | TheBlockService.com</p>
                </div>
            </body>
            </html>
        `;
        
        // Open in new window for saving/printing
        const printWindow = window.open('', '_blank');
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
    },
    
    // Print receipt directly
    printReceipt(encodedData) {
        this.generateProofOfDelivery(encodedData);
        setTimeout(() => {
            window.print();
        }, 500);
    },
    
    // Show batch failure options to user
    async showBatchFailureOptions(error) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <h2>⚠️ Batch Minting Failed</h2>
                    <p>The batch minting process failed for ${error.recipients.length} recipients.</p>
                    <p style="color: #ff6b6b; margin: 10px 0;">
                        <strong>Note:</strong> Individual minting will cost approximately ${error.recipients.length}x more in gas fees.
                    </p>
                    
                    <div style="margin: 20px 0;">
                        <h3>Select recipients to mint individually:</h3>
                        <div style="max-height: 200px; overflow-y: auto; border: 1px solid #333; padding: 10px; background: #1a1a1a;">
                            ${error.recipients.map((recipient, index) => `
                                <label style="display: block; margin: 5px 0; cursor: pointer;">
                                    <input type="checkbox" value="${recipient}" checked style="margin-right: 10px;">
                                    ${recipient}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: space-between;">
                        <button id="selectAll" class="btn-secondary">Select All</button>
                        <button id="selectNone" class="btn-secondary">Select None</button>
                    </div>
                    
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button id="proceedSelected" class="btn-primary">Mint to Selected</button>
                        <button id="cancelMint" class="btn-secondary">Cancel</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add event handlers
            modal.querySelector('#selectAll').onclick = () => {
                modal.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
            };
            
            modal.querySelector('#selectNone').onclick = () => {
                modal.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            };
            
            modal.querySelector('#proceedSelected').onclick = () => {
                const selected = Array.from(modal.querySelectorAll('input[type="checkbox"]:checked'))
                    .map(cb => cb.value);
                modal.remove();
                resolve({ selectedRecipients: selected });
            };
            
            modal.querySelector('#cancelMint').onclick = () => {
                modal.remove();
                resolve({ selectedRecipients: [] });
            };
        });
    },
    
    // Show mixed success confirmation
    showMixedSuccessConfirmation(data) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>✅ Partial Success</h2>
                <p>Successfully minted to ${data.successCount} of ${data.mintedRecipients.length} selected recipients.</p>
                
                ${data.failedCount > 0 ? `
                    <div style="margin: 20px 0; padding: 10px; background: #2a1a1a; border: 1px solid #ff6b6b;">
                        <h3>Failed Recipients (${data.failedCount}):</h3>
                        ${data.results.filter(r => !r.success).map(r => `
                            <div style="margin: 5px 0;">
                                ${r.recipient}: ${r.error}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <button onclick="this.closest('.modal-overlay').remove()" class="btn-primary">OK</button>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    // Load CryptoJS
    async loadCryptoJS() {
        return new Promise((resolve) => {
            if (window.CryptoJS) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
};

console.log('Notices module loaded');