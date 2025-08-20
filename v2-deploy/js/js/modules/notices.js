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
            const documentData = await window.documents.processDocuments(data.documents, {
                encrypt: data.encrypt !== false, // Default to encrypted
                recipientAddress: data.recipients.join(', '), // All recipients
                caseNumber: data.caseNumber,
                type: 'legal_document'
            });
            
            const thumbnail = documentData.thumbnail;
            console.log('Documents consolidated into single PDF:', documentData);
            
            // Step 5: Store notice in backend first
            const backendNotice = await this.storeNoticeInBackend({
                noticeId,
                type: 'batch',
                recipients: data.recipients, // Store all recipients
                caseNumber: data.caseNumber,
                noticeText: data.noticeText,
                thumbnail,
                ipfsHash: documentData.ipfsHash,
                encryptionKey: documentData.encryptionKey,
                pageCount: documentData.pageCount,
                serverId
            });
            
            // Step 6: Check energy and prompt if needed
            const energyCheck = await this.checkEnergy(data.type);
            if (!energyCheck.sufficient) {
                await this.promptEnergyRental(energyCheck.required);
            }
            
            // Step 7: Create NFTs for all recipients (batch or individual)
            let txResults = [];
            
            // Check if we should use batch (multiple recipients)
            if (data.recipients.length > 1) {
                console.log(`Creating batch notices for ${data.recipients.length} recipients...`);
                
                // Use v5 contract's batch function
                const batchResult = await window.contract.createBatchNotices({
                    recipients: data.recipients,
                    noticeId,
                    caseNumber: data.caseNumber,
                    noticeText: data.noticeText,
                    serverId,
                    serverTimestamp: Math.floor(Date.now() / 1000),
                    thumbnail,
                    encrypted: data.encrypt !== false,
                    ipfsHash: documentData.ipfsHash,
                    encryptionKey: documentData.encryptionKey || '',
                    pageCount: documentData.pageCount || 1,
                    deadline: data.deadline || '',
                    agency: 'Legal Services',
                    legalRights: 'You have the right to respond to this legal notice',
                    sponsorFees: false
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
                    thumbnail,
                    encrypted: data.encrypt !== false,
                    ipfsHash: documentData.ipfsHash,
                    pageCount: documentData.pageCount || 1,
                    deadline: data.deadline || '',
                    agency: 'Legal Services',
                    legalRights: 'You have the right to respond to this legal notice within the specified timeframe',
                    sponsorFees: false
                };
                
                // Create Alert NFT
                const alertResult = await window.contract.createAlertNFT(nftData);
                
                // Create Document NFT
                const documentResult = await window.contract.createDocumentNFT({
                    ...nftData,
                    legalRights: 'This document requires your signature. Please review and sign by the deadline.'
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
            throw error;
        }
    },
    
    // Validate notice data
    validateNoticeData(data) {
        if (!data.recipient || !window.wallet.isValidAddress(data.recipient)) {
            throw new Error('Invalid recipient address');
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
            // Register new server
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
                // Generate fallback ID
                serverId = `PS-${window.wallet.address.substring(0, 8)}-${Date.now()}`;
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
    
    // Store notice in backend
    async storeNoticeInBackend(data) {
        const response = await fetch(getApiUrl('createNotice'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Failed to store notice in backend');
        }
        
        return await response.json();
    },
    
    // Update notice with transaction info
    async updateNoticeWithTransaction(noticeId, txId) {
        const response = await fetch(getApiUrl('getNotice', { id: noticeId }), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ txId })
        });
        
        return response.ok;
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
            // Fetch notice from backend
            const response = await fetch(getApiUrl('getNotice', { id: noticeId }));
            
            if (!response.ok) {
                throw new Error('Notice not found');
            }
            
            const notice = await response.json();
            
            // Display notice viewer
            this.displayNoticeViewer(notice);
            
        } catch (error) {
            console.error('Failed to view notice:', error);
            if (window.app) {
                window.app.showError('Notice not found');
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