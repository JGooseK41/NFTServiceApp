// Notices Module - Handles the complete notice creation workflow

// Helper to safely convert BigInt to Number for JSON serialization
function toBigIntSafe(value) {
    if (typeof value === 'bigint') {
        return Number(value);
    }
    if (typeof value === 'string' && value.endsWith('n')) {
        return Number(value.slice(0, -1));
    }
    return value;
}

// Helper to extract addresses from recipients (handles both old [string] and new [{address, label}] formats)
function getRecipientAddresses(recipients) {
    if (!recipients || recipients.length === 0) return [];
    return recipients.map(r => typeof r === 'string' ? r : r.address);
}

// Helper to get recipient label by address
function getRecipientLabel(recipients, address) {
    if (!recipients) return null;
    const recipient = recipients.find(r =>
        (typeof r === 'string' ? r : r.address) === address
    );
    return recipient && typeof recipient === 'object' ? recipient.label : null;
}

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
    
    // Main notice creation workflow - Creates legal service NFT for all recipients
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
            // Document stored encrypted on backend, only thumbnail goes to IPFS
            const recipientAddresses = getRecipientAddresses(data.recipients);
            const documentData = await window.documents.processDocuments(data.documents, {
                encrypt: true,           // Encrypt document for backend storage
                useIPFS: true,          // Upload thumbnail to IPFS for NFT display
                recipientAddress: recipientAddresses.join(', '), // All recipients
                caseNumber: data.caseNumber,
                agency: data.agency || data.issuingAgency,  // Pass agency for Alert NFT
                noticeType: data.noticeType,               // Pass notice type for display
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
                
                // Use v5 contract's batch function (contract needs addresses only)
                const batchResult = await window.contract.createBatchNotices({
                    recipients: recipientAddresses,
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
                    noticeEmail: data.noticeEmail || '',  // Case-specific contact email
                    noticePhone: data.noticePhone || '',  // Case-specific contact phone
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
                    recipient: recipientAddresses[0],
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
                    noticeEmail: data.noticeEmail || '',  // Case-specific contact email
                    noticePhone: data.noticePhone || '',  // Case-specific contact phone
                    legalRights: 'View full document at www.BlockServed.com for info on your rights and next steps',  // Hardcoded
                    sponsorFees: false
                };

                // Check if using Lite contract (single NFT per serve)
                const isLiteContract = window.contract?.isLiteContract?.() ||
                    window.getCurrentNetwork?.()?.contractType === 'lite';

                // Create Alert NFT (works for both V5 and Lite)
                const alertResult = await window.contract.createAlertNFT(nftData);

                let documentResult = { txId: null, success: true };

                if (!isLiteContract) {
                    // V5 contract: Also create Document NFT (second NFT for signature)
                    documentResult = await window.contract.createDocumentNFT({
                        ...nftData,
                        legalRights: 'View full document at www.BlockServed.com for info on your rights and next steps'
                    });
                } else {
                    // Lite contract: Single NFT per serve (no separate Document NFT)
                    console.log('Lite contract: Single NFT created (no separate Document NFT)');
                    documentResult = { txId: alertResult.txId, success: true };
                }

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
            
            // Step 8.5: Extract token IDs and mark case as served
            let alertTokenId = null;
            let documentTokenId = null;
            
            // Try to get token IDs from transaction
            try {
                if (window.tronWeb) {
                    // Get transaction info to extract token IDs from logs
                    const txInfo = await window.tronWeb.trx.getTransactionInfo(txResult.alertTx);
                    if (txInfo && txInfo.log) {
                        // Look for Transfer events in logs
                        for (const log of txInfo.log) {
                            if (log.topics && log.topics.length >= 4) {
                                // Transfer event has signature, from, to, tokenId
                                const tokenIdHex = log.topics[3];
                                if (tokenIdHex) {
                                    const tokenId = parseInt(tokenIdHex, 16);
                                    if (!alertTokenId) {
                                        alertTokenId = tokenId;
                                    } else if (!documentTokenId) {
                                        documentTokenId = tokenId;
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.log('Could not extract token IDs from transaction:', error);
            }
            
            // For Lite contract, document_token_id = alert_token_id + 1
            // Do NOT guess token IDs - let the backend be the source of truth
            if (alertTokenId && !documentTokenId) {
                documentTokenId = alertTokenId + 1;
            }
            // If we still don't have token IDs, leave them null - backend will handle it

            // Convert BigInt values to numbers for JSON serialization
            alertTokenId = toBigIntSafe(alertTokenId);
            documentTokenId = toBigIntSafe(documentTokenId);

            // Always save service data to backend using the case number from form
            // Trim whitespace to prevent URL encoding issues (e.g., "test 5 " -> "test%205%20")
            const caseIdentifier = (data.caseNumber || window.app?.currentCaseId || '').trim();
            if (caseIdentifier) {
                try {
                    // Store alert image for receipt
                    const alertImage = thumbnail;

                    // Send complete service data to backend
                    const backendUrl = window.config?.backendUrl || 'https://nftserviceapp.onrender.com';
                    console.log(`Saving service data to backend for case: ${caseIdentifier}`);
                    console.log('Recipients:', data.recipients || [data.recipient]);

                    const serviceUpdateResponse = await fetch(`${backendUrl}/api/cases/${encodeURIComponent(caseIdentifier)}/service-complete`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Server-Address': window.wallet?.address || window.serverAddress
                        },
                        body: JSON.stringify({
                            transactionHash: txResult.alertTx,
                            alertTokenId: typeof alertTokenId === 'bigint' ? alertTokenId.toString() : alertTokenId,
                            documentTokenId: typeof documentTokenId === 'bigint' ? documentTokenId.toString() : documentTokenId,
                            alertImage: alertImage, // Base64 image
                            ipfsHash: documentData.ipfsHash,
                            encryptionKey: documentData.encryptionKey || '',
                            recipients: data.recipients || [data.recipient],
                            agency: data.issuingAgency || data.agency,
                            noticeType: data.noticeType || 'Legal Notice',
                            pageCount: documentData.pageCount || 1,
                            servedAt: new Date().toISOString(),
                            serverAddress: window.wallet?.address || window.serverAddress,
                            chain: window.getCurrentChainId ? window.getCurrentChainId() : 'tron-mainnet',
                            explorerUrl: window.getExplorerTxUrl ? window.getExplorerTxUrl(txResult.alertTx) : null,
                            metadata: {
                                noticeText: data.noticeText,
                                caseDetails: data.caseDetails,
                                deadline: data.deadline || '',
                                thumbnailUrl: documentData.thumbnailUrl,
                                diskUrl: documentData.diskUrl
                            }
                        })
                    });

                    if (serviceUpdateResponse.ok) {
                        const result = await serviceUpdateResponse.json();
                        console.log('✅ Case service data stored in backend:', result);
                    } else {
                        const errorText = await serviceUpdateResponse.text();
                        console.error('Failed to update backend:', serviceUpdateResponse.status, errorText);
                    }

                    // Also update local storage as a cache (but backend is source of truth)
                    const cases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
                    const caseIndex = cases.findIndex(c =>
                        c.caseNumber === caseIdentifier ||
                        c.id === caseIdentifier
                    );

                    if (caseIndex >= 0) {
                        cases[caseIndex].status = 'served';
                        cases[caseIndex].servedAt = new Date().toISOString();
                        cases[caseIndex].transactionHash = txResult.alertTx;
                        cases[caseIndex].alertTokenId = alertTokenId;
                        cases[caseIndex].documentTokenId = documentTokenId;
                        cases[caseIndex].alertImage = alertImage;
                        cases[caseIndex].recipients = data.recipients || [data.recipient];
                        // Store IPFS hash for document retrieval
                        cases[caseIndex].ipfsDocument = documentData.ipfsHash;
                        cases[caseIndex].ipfsHash = documentData.ipfsHash;
                        cases[caseIndex].encryptionKey = documentData.encryptionKey;
                        localStorage.setItem('legalnotice_cases', JSON.stringify(cases));
                    }

                } catch (error) {
                    console.error('Failed to update case service data:', error);
                    // Don't fail the whole transaction, just log the error
                }
            } else {
                console.warn('No case identifier available - service data not saved to backend');
            }
            
            // Step 9: Generate receipt (with error handling for BigInt issues)
            let receipt = null;
            try {
                receipt = await this.generateReceipt({
                    noticeId,
                    alertTxId: txResult.alertTx,
                    documentTxId: txResult.documentTx,
                    type: 'Legal Service Package',
                    recipients: data.recipients,
                    caseNumber: data.caseNumber,
                    timestamp: new Date().toISOString(),
                    serverId,
                    thumbnail,
                    encrypted: data.encrypt !== false,
                    ipfsHash: documentData.ipfsHash,
                    encryptionKey: documentData.encryptionKey
                });
            } catch (receiptError) {
                console.error('Failed to generate receipt:', receiptError);
                // Create a basic receipt without problematic fields
                receipt = {
                    receiptId: `RCPT-${noticeId}`,
                    noticeId,
                    alertTxId: String(txResult.alertTx || ''),
                    documentTxId: String(txResult.documentTx || ''),
                    caseNumber: data.caseNumber,
                    generatedAt: new Date().toISOString(),
                    verificationUrl: window.getTronScanUrl ? window.getTronScanUrl(txResult.alertTx) : `https://tronscan.org/#/transaction/${txResult.alertTx}`,
                    accessUrl: `https://blockserved.com?case=${encodeURIComponent(data.caseNumber || noticeId)}`,
                    ipfsHash: documentData.ipfsHash,
                    encryptionKey: documentData.encryptionKey
                };
            }

            // Show success confirmation with receipt
            this.showSuccessConfirmation({
                success: true,
                noticeId,
                alertTxId: txResult.alertTx,
                documentTxId: txResult.documentTx,
                receipt,
                viewUrl: `https://blockserved.com?case=${encodeURIComponent(data.caseNumber || noticeId)}`,
                caseNumber: data.caseNumber,
                recipients: data.recipients,
                thumbnail,
                timestamp: new Date().toISOString(),
                ipfsHash: documentData.ipfsHash,
                encryptionKey: documentData.encryptionKey
            });
            
            return {
                success: true,
                noticeId,
                alertTxId: txResult.alertTx,
                documentTxId: txResult.documentTx,
                receipt,
                viewUrl: `https://blockserved.com?case=${encodeURIComponent(data.caseNumber || noticeId)}`,
                message: 'Legal service NFT created successfully'
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
                recipients: data.recipients,
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
        
        // Validate each recipient (handle both string and {address, label} formats)
        for (const recipient of data.recipients) {
            const address = typeof recipient === 'string' ? recipient : recipient.address;
            const label = typeof recipient === 'object' && recipient.label ? ` (${recipient.label})` : '';
            if (!window.wallet || !window.wallet.isValidAddress || !window.wallet.isValidAddress(address)) {
                // Basic validation if wallet module not ready
                if (!address || !address.startsWith('T') || address.length !== 34) {
                    throw new Error(`Invalid recipient address${label}: ${address || 'empty'}`);
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
    
    // Get or create server ID (wallet address + optional agency ID)
    async getServerId() {
        // Server ID is now based on wallet address
        const walletAddress = window.wallet?.address;
        if (!walletAddress) {
            console.error('Wallet not connected, cannot generate server ID');
            return 'UNKNOWN';
        }

        // Check if we have a registered agency ID
        let agencyId = localStorage.getItem('legalnotice_agency_id');

        // If no agency ID, try to register with backend to get one
        if (!agencyId) {
            try {
                const response = await fetch(getApiUrl('registerServer'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet_address: walletAddress,
                        server_id: walletAddress,  // Use wallet as server ID
                        server_name: 'Process Server',
                        agency_name: 'Legal Services'
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    // Backend may return an agency ID
                    if (data.agencyId) {
                        agencyId = data.agencyId;
                        localStorage.setItem('legalnotice_agency_id', agencyId);
                    }
                }
            } catch (error) {
                // Registration not available - that's fine, we'll use wallet address only
                console.log('Server registration not available, using wallet address as server ID');
            }
        }

        // Build server ID: wallet address + optional agency ID
        let serverId = walletAddress;
        if (agencyId) {
            serverId = `${walletAddress}-${agencyId}`;
        }

        // Store in localStorage for consistency
        localStorage.setItem(getConfig('storage.keys.serverId'), serverId);

        return serverId;
    },

    // Set agency ID manually (called from settings or admin)
    setAgencyId(agencyId) {
        if (agencyId && agencyId.trim()) {
            localStorage.setItem('legalnotice_agency_id', agencyId.trim());
            // Clear cached server ID so it gets regenerated
            localStorage.removeItem(getConfig('storage.keys.serverId'));
            console.log('Agency ID set:', agencyId);
        }
    },

    // Get current agency ID
    getAgencyId() {
        return localStorage.getItem('legalnotice_agency_id') || null;
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
        // Convert any BigInt values to strings to avoid serialization errors
        const sanitizeForJSON = (obj) => {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'bigint') {
                    result[key] = value.toString();
                } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                    result[key] = sanitizeForJSON(value);
                } else if (Array.isArray(value)) {
                    result[key] = value.map(item => 
                        typeof item === 'bigint' ? item.toString() : 
                        (item && typeof item === 'object' ? sanitizeForJSON(item) : item)
                    );
                } else {
                    result[key] = value;
                }
            }
            return result;
        };
        
        const receipt = sanitizeForJSON({
            ...data,
            receiptId: `RCPT-${data.noticeId}`,
            generatedAt: new Date().toISOString(),
            verificationUrl: window.getTronScanUrl ? window.getTronScanUrl(data.txId) : `https://tronscan.org/#/transaction/${data.txId}`,
            accessUrl: `https://blockserved.com?case=${encodeURIComponent(data.caseNumber || data.noticeId)}`
        });

        // Store receipt locally (with quota handling)
        try {
            let receipts = JSON.parse(localStorage.getItem(getConfig('storage.keys.receipts')) || '[]');
            receipts.push(receipt);

            // Try to save, trim old receipts if quota exceeded
            try {
                localStorage.setItem(getConfig('storage.keys.receipts'), JSON.stringify(receipts));
            } catch (quotaError) {
                if (quotaError.name === 'QuotaExceededError') {
                    console.log('LocalStorage full, trimming old receipts...');
                    // Keep only the last 50 receipts
                    receipts = receipts.slice(-50);
                    localStorage.setItem(getConfig('storage.keys.receipts'), JSON.stringify(receipts));
                } else {
                    throw quotaError;
                }
            }
        } catch (e) {
            console.warn('Could not save receipt to localStorage:', e.message);
        }

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
                window.open(`https://blockserved.com?case=${encodeURIComponent(noticeId)}`, '_blank');
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
    
    // Store last mint result for print/export functions
    lastMintResult: null,

    // Format recipients array for modal display
    formatRecipientsForModal(recipients) {
        if (!recipients || recipients.length === 0) {
            return '<small>No recipients</small>';
        }

        return recipients.map((r, idx) => {
            const addr = typeof r === 'string' ? r : r.address;
            const label = typeof r === 'object' && r.label ? `[${r.label}] ` : '';
            return `<small>${idx + 1}. ${label}${addr}</small>`;
        }).join('<br>');
    },

    // Show success confirmation modal with receipt options
    showSuccessConfirmation(data) {
        // Check if using Lite contract (single NFT) or V5 (dual NFT)
        const isLiteContract = window.contract?.isLiteContract?.() ||
            window.getCurrentNetwork?.()?.contractType === 'lite' ||
            data.alertTxId === data.documentTxId; // Same TX means single NFT

        // Store the mint result so print/export functions can access it
        const chainId = window.getCurrentChainId ? window.getCurrentChainId() : 'tron-mainnet';
        const chainInfo = window.getChainInfo ? window.getChainInfo(chainId) : null;

        this.lastMintResult = {
            caseNumber: data.caseNumber,
            alertTxId: data.alertTxId,
            documentTxId: data.documentTxId,
            recipients: data.recipients,
            timestamp: data.timestamp,
            thumbnail: data.thumbnail,
            receipt: data.receipt,
            ipfsHash: data.ipfsHash || data.receipt?.ipfsHash || null,
            encryptionKey: data.encryptionKey || data.receipt?.encryptionKey || null,
            isLiteContract: isLiteContract,
            chain: chainId,
            chainName: chainInfo?.name || 'TRON',
            explorerUrl: window.getExplorerTxUrl ? window.getExplorerTxUrl(data.alertTxId, chainId) : null
        };

        // Build blockchain confirmation section based on contract type
        const blockchainSection = isLiteContract ? `
            <li><strong>NFT Transaction:</strong><br>
                <small class="text-break">
                    <a href="${window.getTronScanUrl ? window.getTronScanUrl(data.alertTxId) : 'https://tronscan.org/#/transaction/' + data.alertTxId}"
                       target="_blank" class="text-decoration-none">
                        ${String(data.alertTxId).substring(0, 20)}...
                        <i class="bi bi-box-arrow-up-right"></i>
                    </a>
                </small>
            </li>
        ` : `
            <li><strong>Alert NFT TX:</strong><br>
                <small class="text-break">
                    <a href="${window.getTronScanUrl ? window.getTronScanUrl(data.alertTxId) : 'https://tronscan.org/#/transaction/' + data.alertTxId}"
                       target="_blank" class="text-decoration-none">
                        ${String(data.alertTxId).substring(0, 20)}...
                        <i class="bi bi-box-arrow-up-right"></i>
                    </a>
                </small>
            </li>
            <li><strong>Document NFT TX:</strong><br>
                <small class="text-break">
                    <a href="${window.getTronScanUrl ? window.getTronScanUrl(data.documentTxId) : 'https://tronscan.org/#/transaction/' + data.documentTxId}"
                       target="_blank" class="text-decoration-none">
                        ${String(data.documentTxId).substring(0, 20)}...
                        <i class="bi bi-box-arrow-up-right"></i>
                    </a>
                </small>
            </li>
        `;

        const modalHtml = `
            <div class="modal fade" id="mintSuccessModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-check-circle-fill me-2"></i>
                                Legal Service NFT Minted Successfully!
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-success mb-3">
                                <strong>✅ Success!</strong> Your legal notice has been minted as an NFT on the blockchain.
                            </div>

                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <h6>Service Details:</h6>
                                    <ul class="list-unstyled">
                                        <li><strong>Case Number:</strong> ${data.caseNumber}</li>
                                        <li><strong>Recipient${data.recipients && data.recipients.length > 1 ? 's' : ''}:</strong><br>
                                            ${this.formatRecipientsForModal(data.recipients)}
                                        </li>
                                        <li><strong>Served At:</strong> ${new Date(data.timestamp).toLocaleString()}</li>
                                    </ul>
                                </div>
                                <div class="col-md-6">
                                    <h6>Blockchain Confirmation:</h6>
                                    <ul class="list-unstyled">
                                        ${blockchainSection}
                                    </ul>
                                </div>
                            </div>

                            <div class="form-check mb-3">
                                <input class="form-check-input" type="checkbox" id="includeNFTImage" checked>
                                <label class="form-check-label" for="includeNFTImage">
                                    Include NFT image in receipt
                                </label>
                            </div>

                            ${data.thumbnail ? `
                            <div class="text-center mb-3" id="nftImagePreview">
                                <h6>NFT Preview:</h6>
                                <img src="${data.thumbnail}" class="img-fluid" style="max-height: 200px; border: 1px solid #dee2e6;">
                            </div>
                            ` : ''}

                            <div class="alert alert-info">
                                <strong>Recipient Access:</strong> The recipient can view and download their documents at:<br>
                                <a href="${data.viewUrl}" target="_blank">${data.viewUrl}</a>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onclick="notices.printServiceReceipt('${data.caseNumber}')">
                                <i class="bi bi-printer"></i> Print Service Receipt
                            </button>
                            <button type="button" class="btn btn-success" onclick="notices.exportStampedDocs('${data.caseNumber}')">
                                <i class="bi bi-file-earmark-pdf"></i> Export Stamped Documents
                            </button>
                            <button type="button" class="btn btn-info" onclick="window.app.navigate('cases')" data-bs-dismiss="modal">
                                <i class="bi bi-folder"></i> View Cases
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
    
    // Print service receipt directly using fresh mint data
    async printServiceReceipt(caseNumber) {
        try {
            // First check if we have fresh mint data
            if (this.lastMintResult && this.lastMintResult.caseNumber === caseNumber) {
                console.log('Using fresh mint data for receipt:', this.lastMintResult);

                // Use unified receipt style via proofOfService module
                if (window.proofOfService && window.proofOfService.printReceipt) {
                    // Convert fresh mint data to receipt format
                    const receiptData = {
                        caseNumber: this.lastMintResult.caseNumber,
                        serverAddress: window.wallet?.address || window.tronWeb?.defaultAddress?.base58,
                        servedAt: this.lastMintResult.timestamp,
                        transactionHash: this.lastMintResult.alertTxId,
                        alertTokenId: this.lastMintResult.receipt?.alertTokenId,
                        documentTokenId: this.lastMintResult.receipt?.documentTokenId,
                        recipients: this.lastMintResult.recipients || [],
                        alertImage: this.lastMintResult.thumbnail,
                        ipfsHash: this.lastMintResult.ipfsHash,
                        chain: this.lastMintResult.chain,
                        chainName: this.lastMintResult.chainName,
                        explorerUrl: this.lastMintResult.explorerUrl
                    };
                    await window.proofOfService.printReceipt(receiptData);
                } else {
                    // Fallback to simple PDF if proofOfService not available
                    await this.generateReceiptPDF(this.lastMintResult);
                }
                return;
            }

            // Fallback to cases module lookup
            if (window.cases && window.cases.printReceipt) {
                await window.cases.printReceipt(caseNumber);
            } else {
                console.error('No fresh mint data and cases module not available');
                window.app.showError('Receipt data not available. Please try again from the Cases tab.');
            }
        } catch (error) {
            console.error('Failed to print receipt:', error);
            window.app.showError('Failed to print receipt: ' + error.message);
        }
    },

    // Generate receipt PDF directly
    async generateReceiptPDF(data) {
        // Load jsPDF if needed
        await this.loadJSPDF();

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Check if single NFT (Lite contract)
        const isLiteContract = data.isLiteContract || data.alertTxId === data.documentTxId;

        // Title
        doc.setFontSize(20);
        doc.text('PROOF OF SERVICE', 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.text('Blockchain-Verified Legal Notice Delivery', 105, 30, { align: 'center' });

        // Success badge
        doc.setFillColor(40, 167, 69);
        doc.rect(65, 35, 80, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text('SUCCESSFULLY DELIVERED', 105, 41, { align: 'center' });
        doc.setTextColor(0, 0, 0);

        let y = 55;

        // Service Details section
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Service Details', 20, y);
        doc.setFont(undefined, 'normal');
        y += 10;

        doc.setFontSize(10);
        doc.text(`Case Number: ${data.caseNumber}`, 20, y);
        y += 7;
        doc.text(`Date Served: ${new Date(data.timestamp).toLocaleDateString()}`, 20, y);
        y += 7;
        doc.text(`Time Served: ${new Date(data.timestamp).toLocaleTimeString()}`, 20, y);
        y += 12;

        // Recipient section
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Recipient Information', 20, y);
        doc.setFont(undefined, 'normal');
        y += 10;

        doc.setFontSize(10);
        // Handle recipient as string or {address, label} object
        const recipientAddr = data.recipient && typeof data.recipient === 'object' ? data.recipient.address : data.recipient;
        const recipientLabel = data.recipient && typeof data.recipient === 'object' ? data.recipient.label : null;
        if (recipientLabel) {
            doc.text(`Recipient Label: ${recipientLabel}`, 20, y);
            y += 7;
        }
        doc.text(`Wallet Address: ${recipientAddr || 'N/A'}`, 20, y);
        y += 7;
        doc.text(`Access URL: https://blockserved.com?case=${encodeURIComponent(data.caseNumber || '')}`, 20, y);
        y += 12;

        // Blockchain Verification section
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Blockchain Verification', 20, y);
        doc.setFont(undefined, 'normal');
        y += 10;

        doc.setFontSize(10);
        doc.text('NFT Transaction:', 20, y);
        y += 7;
        doc.setFontSize(8);
        doc.text(String(data.alertTxId || 'N/A'), 20, y);
        y += 10;

        doc.setFontSize(10);
        const tronScanUrl = window.getTronScanUrl ? window.getTronScanUrl(data.alertTxId) : `https://tronscan.org/#/transaction/${data.alertTxId}`;
        doc.text(`Verification URL: ${tronScanUrl}`, 20, y);
        y += 15;

        // Add thumbnail if available and checkbox is checked
        const includeImage = document.getElementById('includeNFTImage')?.checked ?? true;
        if (includeImage && data.thumbnail) {
            try {
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text('NFT Preview', 20, y);
                y += 5;
                doc.addImage(data.thumbnail, 'PNG', 20, y, 60, 80);
                y += 85;
            } catch (e) {
                console.log('Could not add thumbnail to PDF:', e);
            }
        }

        // Footer
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('This document certifies that legal notice was successfully delivered via blockchain technology.', 105, 280, { align: 'center' });
        doc.text(`Generated: ${new Date().toLocaleString()} | BlockServed.com`, 105, 285, { align: 'center' });

        // Save PDF
        doc.save(`proof_of_service_${data.caseNumber}.pdf`);
    },

    // Export stamped documents directly using fresh mint data
    async exportStampedDocs(caseNumber) {
        try {
            // First check if we have fresh mint data
            if (this.lastMintResult && this.lastMintResult.caseNumber === caseNumber) {
                console.log('Using fresh mint data for export:', this.lastMintResult);
                await this.generateStampedDocumentPDF(this.lastMintResult);
                return;
            }

            // Fallback to cases module lookup
            if (window.cases && window.cases.exportStamped) {
                await window.cases.exportStamped(caseNumber);
            } else {
                console.error('No fresh mint data and cases module not available');
                window.app.showError('Document data not available. Please try again from the Cases tab.');
            }
        } catch (error) {
            console.error('Failed to export stamped documents:', error);
            window.app.showError('Failed to export: ' + error.message);
        }
    },

    // Generate stamped document PDF - fetches actual document and adds stamp overlay
    async generateStampedDocumentPDF(data) {
        try {
            // Show loading
            if (window.app && window.app.showProcessing) {
                window.app.showProcessing('Fetching and stamping document...');
            }

            // Load PDF-lib and CryptoJS (for decryption)
            await this.loadPDFLib();
            await this.loadCryptoJS();

            // Fetch the original document
            let pdfBytes = null;
            let isEncrypted = false;

            // Try IPFS first
            if (data.ipfsHash) {
                console.log('Fetching document from IPFS:', data.ipfsHash);
                const ipfsGateway = 'https://gateway.pinata.cloud/ipfs/';
                try {
                    const response = await fetch(`${ipfsGateway}${data.ipfsHash}`);
                    if (response.ok) {
                        pdfBytes = await response.arrayBuffer();
                        isEncrypted = true; // IPFS documents are always encrypted
                        console.log('Document fetched from IPFS, size:', pdfBytes.byteLength, 'encrypted:', isEncrypted);
                    }
                } catch (e) {
                    console.log('IPFS fetch failed, trying backend...');
                }
            }

            // Try backend if IPFS failed - use server endpoint (not recipient endpoint)
            if (!pdfBytes) {
                const backendUrl = window.AppConfig?.backend?.baseUrl || 'https://nftserviceapp.onrender.com';
                const serverAddress = window.app?.state?.userAddress || '';
                try {
                    // Use the server PDF endpoint which doesn't require recipient auth
                    const response = await fetch(`${backendUrl}/api/cases/${encodeURIComponent(data.caseNumber)}/pdf?serverAddress=${serverAddress}`);
                    if (response.ok) {
                        pdfBytes = await response.arrayBuffer();
                        // Backend serves unencrypted documents
                        isEncrypted = false;
                        console.log('Document fetched from backend, size:', pdfBytes.byteLength);
                    }
                } catch (e) {
                    console.log('Backend fetch failed:', e.message);
                }
            }

            if (!pdfBytes) {
                throw new Error('Could not fetch original document');
            }

            // Decrypt if necessary
            if (isEncrypted && data.encryptionKey) {
                console.log('Decrypting document with encryption key...');
                try {
                    // IPFS stores the encrypted string (Base64 OpenSSL format), not binary
                    // Convert ArrayBuffer back to string
                    const uint8Array = new Uint8Array(pdfBytes);
                    let encryptedString = '';
                    for (let i = 0; i < uint8Array.length; i++) {
                        encryptedString += String.fromCharCode(uint8Array[i]);
                    }

                    console.log('Encrypted string length:', encryptedString.length);
                    console.log('Encrypted string preview:', encryptedString.substring(0, 50) + '...');

                    // Decrypt using CryptoJS AES (expects Base64 cipher string)
                    const decrypted = CryptoJS.AES.decrypt(encryptedString, data.encryptionKey);

                    if (!decrypted || decrypted.sigBytes <= 0) {
                        throw new Error('Decryption produced empty result');
                    }

                    // Convert WordArray to Uint8Array (raw binary PDF data)
                    const decryptedWords = decrypted.words;
                    const sigBytes = decrypted.sigBytes;
                    const decryptedArray = new Uint8Array(sigBytes);

                    for (let i = 0; i < sigBytes; i++) {
                        decryptedArray[i] = (decryptedWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                    }

                    pdfBytes = decryptedArray.buffer;
                    console.log('Document decrypted, new size:', pdfBytes.byteLength);

                    // Verify PDF header
                    const pdfHeader = new TextDecoder().decode(decryptedArray.slice(0, 5));
                    if (pdfHeader !== '%PDF-') {
                        console.warn('Decrypted content does not appear to be a PDF, header:', pdfHeader);
                    }
                } catch (decryptError) {
                    console.error('Decryption failed:', decryptError);
                    // Try using documents module's decrypt function as fallback
                    if (window.documents && window.documents.decryptDocument) {
                        try {
                            // The documents module expects the encrypted string, not ArrayBuffer
                            const uint8Array = new Uint8Array(pdfBytes);
                            let encryptedString = '';
                            for (let i = 0; i < uint8Array.length; i++) {
                                encryptedString += String.fromCharCode(uint8Array[i]);
                            }
                            const decryptedBlob = await window.documents.decryptDocument(encryptedString, data.encryptionKey);
                            pdfBytes = await decryptedBlob.arrayBuffer();
                            console.log('Document decrypted via documents module, size:', pdfBytes.byteLength);
                        } catch (fallbackError) {
                            console.error('Fallback decryption also failed:', fallbackError);
                            throw new Error('Failed to decrypt document - encryption key may be invalid');
                        }
                    } else {
                        throw new Error('Failed to decrypt document: ' + decryptError.message);
                    }
                }
            } else if (isEncrypted && !data.encryptionKey) {
                console.warn('Document is encrypted but no encryption key provided');
                throw new Error('Document is encrypted but no encryption key available');
            }

            // Load the PDF
            const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            const pages = pdfDoc.getPages();

            // Embed font
            const helveticaBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
            const helvetica = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

            // Prepare stamp text
            const txHash = String(data.alertTxId || '').substring(0, 32) + '...';
            const servedDate = new Date(data.timestamp).toLocaleDateString();
            const servedTime = new Date(data.timestamp).toLocaleTimeString();

            // Add stamp to each page
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();

                // Stamp position (bottom right corner) - wider to fit text
                const stampWidth = 250;
                const stampHeight = 65;
                const stampX = width - stampWidth - 15;
                const stampY = 15;

                // Draw stamp background with red border
                page.drawRectangle({
                    x: stampX,
                    y: stampY,
                    width: stampWidth,
                    height: stampHeight,
                    color: PDFLib.rgb(1, 0.95, 0.95),
                    borderColor: PDFLib.rgb(0.8, 0, 0),
                    borderWidth: 2,
                    opacity: 0.95
                });

                // "SERVED VIA WWW.BLOCKSERVED.COM" text - RED
                page.drawText('SERVED VIA WWW.BLOCKSERVED.COM', {
                    x: stampX + 8,
                    y: stampY + 48,
                    size: 9,
                    font: helveticaBold,
                    color: PDFLib.rgb(0.8, 0, 0)
                });

                // Date/time - dark red
                page.drawText(`${servedDate} ${servedTime}`, {
                    x: stampX + 8,
                    y: stampY + 35,
                    size: 8,
                    font: helvetica,
                    color: PDFLib.rgb(0.5, 0, 0)
                });

                // Transaction hash - dark red
                page.drawText(`TX: ${txHash}`, {
                    x: stampX + 8,
                    y: stampY + 22,
                    size: 6,
                    font: helvetica,
                    color: PDFLib.rgb(0.5, 0, 0)
                });

                // Verification URL - red
                page.drawText('Verify: www.blockserved.com', {
                    x: stampX + 8,
                    y: stampY + 10,
                    size: 6,
                    font: helvetica,
                    color: PDFLib.rgb(0.6, 0, 0)
                });
            }

            // Save the stamped PDF
            const stampedPdfBytes = await pdfDoc.save();

            // Download
            const blob = new Blob([stampedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stamped_${data.caseNumber}.pdf`;
            a.click();
            URL.revokeObjectURL(url);

            if (window.app && window.app.hideProcessing) {
                window.app.hideProcessing();
            }

            console.log('Stamped document generated successfully');

        } catch (error) {
            console.error('Failed to generate stamped document:', error);
            if (window.app && window.app.hideProcessing) {
                window.app.hideProcessing();
            }
            window.app?.showError?.('Failed to generate stamped document: ' + error.message);
        }
    },

    // Load PDF-lib library
    async loadPDFLib() {
        return new Promise((resolve) => {
            if (window.PDFLib) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    },

    // Load jsPDF library
    async loadJSPDF() {
        return new Promise((resolve) => {
            if (window.jspdf) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
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
                                <li><strong>Recipient${data.recipients && data.recipients.length > 1 ? 's' : ''}:</strong><br>
                                    ${this.formatRecipientsForModal(data.recipients)}
                                </li>
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
                    ${(data.recipients || [data.recipient]).filter(Boolean).map((r, idx) => {
                        const addr = typeof r === 'string' ? r : r.address;
                        const label = typeof r === 'object' && r.label ? ` (${r.label})` : '';
                        return `<div class="detail-row">
                            <span class="label">${(data.recipients || []).length > 1 ? `Recipient ${idx + 1}:` : 'Wallet Address:'}</span>
                            <span class="value">${addr}${label}</span>
                        </div>`;
                    }).join('')}
                    <div class="detail-row">
                        <span class="label">Access URL:</span>
                        <span class="value">${data.viewUrl}</span>
                    </div>
                </div>
                
                <div class="section">
                    <div class="section-title">Blockchain Confirmation</div>
                    <div class="detail-row">
                        <span class="label">NFT Transaction:</span>
                        <span class="value tx-hash">${data.alertTxId}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Verification:</span>
                        <span class="value">View on TronScan: ${window.getTronScanUrl ? window.getTronScanUrl(data.alertTxId) : 'https://tronscan.org/#/transaction/' + data.alertTxId}</span>
                    </div>
                </div>

                ${includeImage && data.thumbnail ? `
                <div class="section">
                    <div class="section-title">NFT Image</div>
                    <img src="${data.thumbnail}" class="nft-image" alt="Legal Notice NFT">
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