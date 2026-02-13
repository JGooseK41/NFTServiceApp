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

// Helper to format date/time in UTC for consistency
function formatUTC(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function formatUTCDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[0];
}

function formatUTCTime(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[1].replace(/\.\d{3}Z$/, '') + ' UTC';
}

// HTML escape helper to prevent XSS
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Show notification approval modal and wait for user decision
function showNotificationApproval(recipientAddress, defaultMessage, index, total) {
    return new Promise((resolve) => {
        document.getElementById('notifCounter').textContent = `(${index} of ${total})`;
        document.getElementById('notifRecipientAddress').textContent = recipientAddress;
        document.getElementById('notifMessage').value = defaultMessage;

        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('notificationApprovalModal'));

        function cleanup() {
            document.getElementById('notifSendBtn').removeEventListener('click', onSend);
            document.getElementById('notifSkipBtn').removeEventListener('click', onSkip);
            document.getElementById('notifSkipAllBtn').removeEventListener('click', onSkipAll);
        }

        function onSend() {
            const message = document.getElementById('notifMessage').value.trim();
            cleanup();
            modal.hide();
            resolve({ action: 'send', message });
        }

        function onSkip() {
            cleanup();
            modal.hide();
            resolve({ action: 'skip', message: '' });
        }

        function onSkipAll() {
            cleanup();
            modal.hide();
            resolve({ action: 'skipAll', message: '' });
        }

        document.getElementById('notifSendBtn').addEventListener('click', onSend);
        document.getElementById('notifSkipBtn').addEventListener('click', onSkip);
        document.getElementById('notifSkipAllBtn').addEventListener('click', onSkipAll);

        modal.show();
    });
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
            if (window.app?.updateProcessing) {
                window.app.updateProcessing('Processing documents...', 'Encrypting and uploading your PDFs');
            }
            
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
            if (window.app?.updateProcessing) {
                window.app.updateProcessing('Minting NFT on blockchain...', 'Please confirm the transaction in your wallet');
            }

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
                    agency: data.issuingAgency || data.agency || 'via Blockserved.com',  // From form
                    noticeEmail: data.noticeEmail || '',  // Case-specific contact email
                    noticePhone: data.noticePhone || '',  // Case-specific contact phone
                    legalRights: 'View full document at www.BlockServed.com for info on your rights and next steps',  // Hardcoded
                    sponsorFees: false
                });
                
                txResults.push(batchResult);
                
            } else {
                // Single recipient - Lite contract creates one NFT
                console.log('Creating NFT for single recipient...');

                const nftData = {
                    noticeId,
                    recipient: recipientAddresses[0],
                    caseNumber: data.caseNumber,
                    serverId,
                    serverTimestamp: Math.floor(Date.now() / 1000),
                    thumbnail: null,
                    thumbnailUrl: documentData.thumbnailUrl,
                    encrypted: data.encrypt !== false,
                    ipfsHash: documentData.ipfsHash,
                    pageCount: documentData.pageCount || 1,
                    deadline: data.deadline || '',
                    agency: data.issuingAgency || data.agency || 'via Blockserved.com',
                    noticeEmail: data.noticeEmail || '',
                    noticePhone: data.noticePhone || '',
                    legalRights: 'View full document at www.BlockServed.com for info on your rights and next steps',
                    sponsorFees: false
                };

                // Lite contract: Single NFT per serve
                const alertResult = await window.contract.createAlertNFT(nftData);
                console.log('NFT created successfully');

                txResults.push({
                    alertTx: alertResult.txId,
                    tokenId: alertResult.tokenId,
                    success: alertResult.success
                });
            }

            const txResult = txResults[0]; // For now, use first result

            // Step 8: Update backend with transaction info (Lite: single transaction)
            if (window.app?.updateProcessing) {
                window.app.updateProcessing('Confirming transaction...', 'Waiting for blockchain confirmation — this may take a moment');
            }
            await this.updateNoticeWithTransaction(noticeId, {
                alertTx: txResult.alertTx
            });

            // Step 8.5: Extract token IDs and mark case as served
            // Handle both single (tokenId) and batch (tokenIds array) results
            let alertTokenId = txResult.tokenId ||
                               (txResult.tokenIds && txResult.tokenIds.length > 0 ? txResult.tokenIds[0] : null);
            let documentTokenId = null;

            console.log('Token ID from contract result:', alertTokenId);
            console.log('Full txResult:', JSON.stringify(txResult, null, 2));

            // If we didn't get token ID from contract, try multiple methods with retries
            if (!alertTokenId) {
                console.log('Token ID not in contract result, attempting extraction...');

                // Method 1: Try TronGrid events API (most reliable)
                const extractFromEventsApi = async (txHash, retries = 5) => {
                    const chainInfo = window.getChainInfo ? window.getChainInfo() : null;
                    const isMainnet = chainInfo?.id === 'tron-mainnet';
                    const apiBase = isMainnet ? 'https://api.trongrid.io' : 'https://nile.trongrid.io';
                    const contractAddress = window.contract?.address || getCurrentNetwork().contractAddress;

                    for (let attempt = 1; attempt <= retries; attempt++) {
                        try {
                            // Wait for transaction to be indexed (mainnet can take 3-6s)
                            await new Promise(r => setTimeout(r, attempt * 2000));

                            const url = `${apiBase}/v1/contracts/${contractAddress}/events?event_name=Transfer&limit=10`;
                            console.log(`Token extraction attempt ${attempt}/${retries} from: ${url}`);

                            const response = await fetchWithTimeout(url);
                            if (response.ok) {
                                const data = await response.json();
                                if (data.success && data.data) {
                                    const event = data.data.find(e => e.transaction_id === txHash);
                                    if (event && event.result && event.result.tokenId) {
                                        console.log(`✅ Token ID extracted from events API: ${event.result.tokenId}`);
                                        return parseInt(event.result.tokenId);
                                    }
                                }
                            }
                        } catch (e) {
                            console.log(`Events API attempt ${attempt} failed:`, e.message);
                        }
                    }
                    return null;
                };

                // Method 2: Try getTransactionInfo (fallback)
                const extractFromTxInfo = async (txHash) => {
                    try {
                        if (window.tronWeb) {
                            const txInfo = await window.tronWeb.trx.getTransactionInfo(txHash);
                            if (txInfo && txInfo.log) {
                                for (const log of txInfo.log) {
                                    if (log.topics && log.topics.length >= 4) {
                                        const tokenIdHex = log.topics[3];
                                        if (tokenIdHex) {
                                            const tokenId = parseInt(tokenIdHex, 16);
                                            console.log(`✅ Token ID extracted from txInfo: ${tokenId}`);
                                            return tokenId;
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.log('txInfo extraction failed:', e.message);
                    }
                    return null;
                };

                // Try events API first (more reliable), then txInfo
                alertTokenId = await extractFromEventsApi(txResult.alertTx);
                if (!alertTokenId) {
                    alertTokenId = await extractFromTxInfo(txResult.alertTx);
                }

                if (alertTokenId) {
                    console.log(`Token ID successfully extracted: ${alertTokenId}`);
                } else {
                    console.warn('Could not extract token ID - will show as N/A');
                }
            }
            
            // Lite contract: Single NFT per serve - no document token ID
            // The alert token IS the only token - it represents both delivery proof AND document access
            // Do NOT fabricate a documentTokenId - it doesn't exist on the blockchain
            documentTokenId = null;

            // Convert BigInt values to numbers for JSON serialization
            alertTokenId = toBigIntSafe(alertTokenId);
            documentTokenId = toBigIntSafe(documentTokenId);

            // Always save service data to backend using the case number from form
            // Trim whitespace to prevent URL encoding issues (e.g., "test 5 " -> "test%205%20")
            if (window.app?.updateProcessing) {
                window.app.updateProcessing('Saving service record...', 'Storing proof of service to the database');
            }
            const caseIdentifier = (data.caseNumber || window.app?.currentCaseId || '').trim();
            if (caseIdentifier) {
                try {
                    // Store alert image for receipt
                    const alertImage = thumbnail;

                    // Send complete service data to backend with retry logic
                    const backendUrl = window.config?.backendUrl || 'https://nftserviceapp.onrender.com';
                    console.log(`Saving service data to backend for case: ${caseIdentifier}`);
                    console.log('Recipients:', data.recipients || [data.recipient]);

                    // Lite contract: Only alert token ID (no document token)
                    const servicePayload = {
                        transactionHash: txResult.alertTx,
                        alertTokenId: typeof alertTokenId === 'bigint' ? alertTokenId.toString() : alertTokenId,
                        documentTokenId: null, // Lite contract: single NFT, no separate document token
                        alertImage: alertImage,
                        ipfsHash: documentData.ipfsHash,
                        encryptionKey: documentData.encryptionKey || '',
                        recipients: data.recipients || [data.recipient],
                        agency: data.issuingAgency || data.agency,
                        noticeType: data.noticeType || 'Legal Notice',
                        pageCount: documentData.pageCount || 1,
                        servedAt: new Date().toISOString(),
                        serverAddress: window.wallet?.address || window.serverAddress,
                        chain: window.getCurrentChainId ? window.getCurrentChainId() : 'tron-nile',
                        explorerUrl: window.getExplorerTxUrl ? window.getExplorerTxUrl(txResult.alertTx) : null,
                        contractType: 'lite', // Indicate Lite contract
                        metadata: {
                            deadline: data.deadline || '',
                            thumbnailUrl: documentData.thumbnailUrl,
                            diskUrl: documentData.diskUrl
                        }
                    };

                    // Retry logic for backend update - try up to 3 times
                    let backendUpdateSuccess = false;
                    let lastError = null;
                    const maxRetries = 3;

                    console.log('=== SERVICE-COMPLETE CALL STARTING ===');
                    console.log('Case identifier:', caseIdentifier);
                    console.log('Token ID:', alertTokenId);
                    console.log('Transaction:', txResult.alertTx);

                    for (let attempt = 1; attempt <= maxRetries && !backendUpdateSuccess; attempt++) {
                        try {
                            console.log(`Backend update attempt ${attempt}/${maxRetries}...`);

                            // Use non-transactional endpoint to avoid transaction issues on Render
                            const serviceUpdateResponse = await fetchWithTimeout(
                                `${backendUrl}/api/cases/${encodeURIComponent(caseIdentifier)}/service-complete-notx`,
                                {
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'X-Server-Address': window.wallet?.address || window.serverAddress
                                    },
                                    body: JSON.stringify(servicePayload)
                                }
                            );

                            if (serviceUpdateResponse.ok) {
                                const result = await serviceUpdateResponse.json();
                                // Check for success flag
                                if (result.success) {
                                    console.log('✅ Case service data stored:', result);
                                    backendUpdateSuccess = true;
                                } else {
                                    // Backend returned 200 but success:false
                                    lastError = result.error || 'Unknown error';
                                    console.error(`Backend returned success:false:`, result);
                                }
                            } else {
                                const errorText = await serviceUpdateResponse.text();
                                lastError = `HTTP ${serviceUpdateResponse.status}: ${errorText}`;
                                console.error(`Backend update attempt ${attempt} failed:`, lastError);

                                // Wait before retry (exponential backoff)
                                if (attempt < maxRetries) {
                                    await new Promise(r => setTimeout(r, 1000 * attempt));
                                }
                            }
                        } catch (fetchError) {
                            lastError = fetchError.message;
                            console.error(`Backend update attempt ${attempt} error:`, fetchError);

                            // Wait before retry
                            if (attempt < maxRetries) {
                                await new Promise(r => setTimeout(r, 1000 * attempt));
                            }
                        }
                    }

                    // If backend update failed after all retries, warn the user
                    if (!backendUpdateSuccess) {
                        console.error('❌ Backend update failed after all retries:', lastError);
                        // Show a non-blocking warning - the NFT was minted successfully
                        if (window.app && window.app.showWarning) {
                            window.app.showWarning(
                                'NFT minted successfully, but case status sync had issues. ' +
                                'Your case may appear as "draft" temporarily. ' +
                                'Refresh the Cases tab to see the updated status.'
                            );
                        }
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
                        cases[caseIndex].tokenId = alertTokenId; // Lite: single token
                        cases[caseIndex].alertImage = alertImage;
                        cases[caseIndex].recipients = data.recipients || [data.recipient];
                        cases[caseIndex].ipfsHash = documentData.ipfsHash;
                        cases[caseIndex].encryptionKey = documentData.encryptionKey;
                        cases[caseIndex].contractType = 'lite';
                        try {
                            localStorage.setItem('legalnotice_cases', JSON.stringify(cases));
                        } catch (quotaError) {
                            if (quotaError.name === 'QuotaExceededError') {
                                // Remove alertImage from older cases to free space
                                for (let i = 0; i < cases.length; i++) {
                                    if (i !== caseIndex && cases[i].alertImage) {
                                        delete cases[i].alertImage;
                                    }
                                }
                                localStorage.setItem('legalnotice_cases', JSON.stringify(cases));
                            } else {
                                throw quotaError;
                            }
                        }
                    }

                } catch (error) {
                    console.error('Failed to update case service data:', error);
                    // Don't fail the whole transaction, but warn the user
                    if (window.app && window.app.showWarning) {
                        window.app.showWarning(
                            'NFT minted successfully, but case status sync failed: ' + error.message + '. ' +
                            'Your case may appear as "draft". Please try refreshing.'
                        );
                    }
                }
            } else {
                console.warn('No case identifier available - service data not saved to backend');
            }

            // Step 8.5: Send TRX notification transfers with user approval
            // Shows approval popup for each recipient so user can review/edit memo before sending
            const notificationMessages = [];
            try {
                const recipientAddresses = getRecipientAddresses(data.recipients);
                if (recipientAddresses.length > 0 && window.contract?.sendNotificationTransfer) {
                    const defaultMemo = `Legal Notice: ${data.noticeType || 'Legal Document'} - Visit www.blockserved.com to view notice. Reference: ${data.issuingAgency || 'N/A'}, Case #${data.caseNumber || 'N/A'}`;

                    // Hide processing modal and wait for backdrop cleanup before showing approval modal
                    if (window.app?.hideProcessing) window.app.hideProcessing();
                    await new Promise(r => setTimeout(r, 300));

                    for (let i = 0; i < recipientAddresses.length; i++) {
                        // Show approval popup — user can edit message, skip, or skip all
                        const approval = await showNotificationApproval(
                            recipientAddresses[i], defaultMemo, i + 1, recipientAddresses.length
                        );

                        if (approval.action === 'skipAll') {
                            // Mark all remaining recipients as skipped
                            for (let j = i; j < recipientAddresses.length; j++) {
                                notificationMessages.push({ address: recipientAddresses[j], message: '', status: 'skipped' });
                            }
                            break;
                        }
                        if (approval.action === 'skip') {
                            notificationMessages.push({ address: recipientAddresses[i], message: '', status: 'skipped' });
                            continue;
                        }

                        // Show processing while TronLink signs
                        if (window.app?.showProcessing) {
                            window.app.showProcessing('Sending notification...', `${i + 1} of ${recipientAddresses.length}`);
                        }

                        const result = await window.contract.sendNotificationTransfer(
                            recipientAddresses[i], approval.message
                        );

                        if (window.app?.hideProcessing) window.app.hideProcessing();

                        if (!result.success) {
                            notificationMessages.push({ address: recipientAddresses[i], message: approval.message, status: 'failed' });
                            console.warn(`Notification transfer failed for ${recipientAddresses[i]}:`, result.error);
                            if (result.error && (result.error.includes('Confirmation declined') || result.error.includes('reject'))) {
                                console.log('User rejected notification transfer, skipping remaining');
                                // Mark remaining as skipped
                                for (let j = i + 1; j < recipientAddresses.length; j++) {
                                    notificationMessages.push({ address: recipientAddresses[j], message: '', status: 'skipped' });
                                }
                                break;
                            }
                        } else {
                            notificationMessages.push({ address: recipientAddresses[i], message: approval.message, status: 'sent' });
                            console.log(`Notification sent to ${recipientAddresses[i]}: ${result.txId}`);
                        }

                        // Rate limiting: 3-second delay after each transfer to avoid TronGrid 429s
                        // Also ensures hideProcessing() backdrop cleanup (150ms) completes
                        await new Promise(r => setTimeout(r, 3000));
                    }
                }
            } catch (notifyError) {
                console.warn('Notification transfers failed (non-blocking):', notifyError);
            }

            // Step 9: Generate receipt with fee breakdown
            if (window.app?.showProcessing) {
                window.app.showProcessing('Generating service receipt...', 'Almost done!');
            }
            let receipt = null;
            try {
                // Get payment details from transaction result (exact amounts)
                const paymentDetails = txResult.paymentDetails || {};
                const recipientCount = data.recipients?.length || 1;

                // Use exact values from transaction, fallback to config
                const feeConfig = window.app?.feeConfig || {
                    serviceFeeInTRX: 100,
                    recipientFundingInTRX: 1,
                    totalPerNoticeInTRX: 101
                };
                const notificationAmountTRX = window.contract?.notificationAmountTRX || 5;

                receipt = await this.generateReceipt({
                    noticeId,
                    transactionHash: txResult.alertTx,
                    tokenId: alertTokenId,
                    type: 'Legal Notice',
                    recipients: data.recipients,
                    caseNumber: data.caseNumber,
                    timestamp: new Date().toISOString(),
                    serverId,
                    serverAddress: window.wallet?.address || '',
                    thumbnail,
                    ipfsHash: documentData.ipfsHash,
                    contractType: 'lite',
                    notificationMessages,
                    // Fee breakdown with exact amounts from transaction
                    feeBreakdown: {
                        serviceFee: paymentDetails.totalServiceFees || (feeConfig.serviceFeeInTRX * recipientCount),
                        recipientFunding: paymentDetails.totalRecipientFunding || (feeConfig.recipientFundingInTRX * recipientCount),
                        notificationTransfer: paymentDetails.totalNotificationTransfers || (notificationAmountTRX * recipientCount),
                        totalPaymentTRX: paymentDetails.totalWithNotifications || paymentDetails.totalWithNotification || ((feeConfig.totalPerNoticeInTRX + notificationAmountTRX) * recipientCount),
                        perRecipient: {
                            serviceFee: paymentDetails.serviceFeePerRecipient || paymentDetails.serviceFee || feeConfig.serviceFeeInTRX,
                            recipientFunding: paymentDetails.recipientFundingPerRecipient || paymentDetails.recipientFunding || feeConfig.recipientFundingInTRX,
                            notificationTransfer: paymentDetails.notificationTransferPerRecipient || paymentDetails.notificationTransfer || notificationAmountTRX
                        },
                        recipientCount
                    }
                });
            } catch (receiptError) {
                console.error('Failed to generate receipt:', receiptError);
                // Create a basic receipt
                receipt = {
                    receiptId: `RCPT-${noticeId}`,
                    noticeId,
                    transactionHash: String(txResult.alertTx || ''),
                    tokenId: alertTokenId,
                    caseNumber: data.caseNumber,
                    generatedAt: new Date().toISOString(),
                    verificationUrl: window.getExplorerTxUrl ? window.getExplorerTxUrl(txResult.alertTx) : `https://nile.tronscan.org/#/transaction/${txResult.alertTx}`,
                    accessUrl: `https://blockserved.com?case=${encodeURIComponent(data.caseNumber || noticeId)}`,
                    ipfsHash: documentData.ipfsHash,
                    contractType: 'lite'
                };
            }

            // Show success confirmation
            this.showSuccessConfirmation({
                success: true,
                noticeId,
                alertTxId: txResult.alertTx,
                documentTxId: txResult.alertTx, // Same for Lite contract
                tokenId: alertTokenId,
                receipt,
                viewUrl: `https://blockserved.com?case=${encodeURIComponent(data.caseNumber || noticeId)}`,
                caseNumber: data.caseNumber,
                recipients: data.recipients,
                thumbnail,
                timestamp: new Date().toISOString(),
                ipfsHash: documentData.ipfsHash
            });

            return {
                success: true,
                noticeId,
                transactionHash: txResult.alertTx,
                tokenId: alertTokenId,
                receipt,
                viewUrl: `https://blockserved.com?case=${encodeURIComponent(data.caseNumber || noticeId)}`,
                message: 'Legal notice NFT created successfully'
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
                const response = await fetchWithTimeout(getApiUrl('registerServer'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet_address: walletAddress,
                        server_id: walletAddress,  // Use wallet as server ID
                        server_name: 'Process Server',
                        agency_name: 'via Blockserved.com'
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
        ctx.fillText(formatUTCDate(new Date()), 200, y);
        y += lineHeight;
        
        // Time
        ctx.font = 'bold 20px Arial';
        ctx.fillText('Time:', 50, y);
        ctx.font = '20px Arial';
        ctx.fillText(formatUTCTime(new Date()), 200, y);
        y += lineHeight * 2;
        
        // Notice text (wrapped) - optional field
        if (data.noticeText) {
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
        }
        
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
                    // Aggressively trim - keep only last 10 receipts
                    receipts = receipts.slice(-10);
                    try {
                        localStorage.setItem(getConfig('storage.keys.receipts'), JSON.stringify(receipts));
                    } catch (e) {
                        // Still full - clear receipts entirely and save just this one
                        receipts = receipts.slice(-1);
                        localStorage.setItem(getConfig('storage.keys.receipts'), JSON.stringify(receipts));
                    }
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
                            <h5 class="modal-title">Legal Notice - ${escapeHtml(notice.caseNumber)}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Notice Details</h6>
                                    <p><strong>Type:</strong> ${escapeHtml(notice.type)}</p>
                                    <p><strong>Case:</strong> ${escapeHtml(notice.caseNumber)}</p>
                                    <p><strong>Served:</strong> ${formatUTC(notice.timestamp)}</p>
                                    ${notice.noticeText ? `<p><strong>Description:</strong> ${escapeHtml(notice.noticeText)}</p>` : ''}
                                </div>
                                <div class="col-md-6">
                                    <h6>Preview</h6>
                                    <img src="${escapeHtml(notice.thumbnail)}" class="img-fluid" alt="Notice preview">
                                </div>
                            </div>
                            ${notice.ipfsHash ? `
                                <div class="mt-3">
                                    <button class="btn btn-primary" onclick="notices.downloadDocument('${escapeHtml(notice.ipfsHash)}', '${escapeHtml(notice.encryptionKey)}')">
                                        Download Full Document
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            ${notice.type === 'document' ? `
                                <button class="btn btn-success" onclick="notices.signDocument('${escapeHtml(notice.noticeId)}')">
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
            const response = await fetchWithTimeout(url);

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
            const label = typeof r === 'object' && r.label ? `[${escapeHtml(r.label)}] ` : '';
            return `<small>${idx + 1}. ${label}${escapeHtml(addr)}</small>`;
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
            tokenId: data.tokenId, // Store tokenId at top level
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
        console.log('Stored lastMintResult with tokenId:', data.tokenId);

        // Build blockchain confirmation section based on contract type
        const blockchainSection = isLiteContract ? `
            <li><strong>NFT Transaction:</strong><br>
                <small class="text-break">
                    <a href="${escapeHtml(window.getTronScanUrl ? window.getTronScanUrl(data.alertTxId) : 'https://tronscan.org/#/transaction/' + data.alertTxId)}"
                       target="_blank" class="text-decoration-none">
                        ${escapeHtml(String(data.alertTxId).substring(0, 20))}...
                        <i class="bi bi-box-arrow-up-right"></i>
                    </a>
                </small>
            </li>
        ` : `
            <li><strong>Alert NFT TX:</strong><br>
                <small class="text-break">
                    <a href="${escapeHtml(window.getTronScanUrl ? window.getTronScanUrl(data.alertTxId) : 'https://tronscan.org/#/transaction/' + data.alertTxId)}"
                       target="_blank" class="text-decoration-none">
                        ${escapeHtml(String(data.alertTxId).substring(0, 20))}...
                        <i class="bi bi-box-arrow-up-right"></i>
                    </a>
                </small>
            </li>
            <li><strong>Document NFT TX:</strong><br>
                <small class="text-break">
                    <a href="${escapeHtml(window.getTronScanUrl ? window.getTronScanUrl(data.documentTxId) : 'https://tronscan.org/#/transaction/' + data.documentTxId)}"
                       target="_blank" class="text-decoration-none">
                        ${escapeHtml(String(data.documentTxId).substring(0, 20))}...
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
                                        <li><strong>Case Number:</strong> ${escapeHtml(data.caseNumber)}</li>
                                        <li><strong>Recipient${data.recipients && data.recipients.length > 1 ? 's' : ''}:</strong><br>
                                            ${this.formatRecipientsForModal(data.recipients)}
                                        </li>
                                        <li><strong>Served At:</strong> ${formatUTC(data.timestamp)}</li>
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
                                <img src="${escapeHtml(data.thumbnail)}" class="img-fluid" style="max-height: 200px; border: 1px solid #dee2e6;">
                            </div>
                            ` : ''}

                            <div class="alert alert-info">
                                <strong>Recipient Access:</strong> The recipient can view and download their documents at:<br>
                                <a href="${escapeHtml(data.viewUrl)}" target="_blank">${escapeHtml(data.viewUrl)}</a>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onclick="notices.printServiceReceipt('${escapeHtml(data.caseNumber)}')">
                                <i class="bi bi-printer"></i> Print Service Receipt
                            </button>
                            <button type="button" class="btn btn-success" onclick="notices.exportStampedDocs('${escapeHtml(data.caseNumber)}')">
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
            console.log('printServiceReceipt called with:', caseNumber);
            console.log('lastMintResult:', this.lastMintResult);

            // First check if we have fresh mint data (use loose comparison for type flexibility)
            if (this.lastMintResult && String(this.lastMintResult.caseNumber) === String(caseNumber)) {
                console.log('Using fresh mint data for receipt:', this.lastMintResult);

                // Use unified receipt style via proofOfService module
                if (window.proofOfService && window.proofOfService.printReceipt) {
                    // Convert fresh mint data to receipt format
                    // Token ID can be in multiple places - check all
                    const tokenId = this.lastMintResult.tokenId ||
                                   this.lastMintResult.receipt?.alertTokenId ||
                                   this.lastMintResult.receipt?.tokenId;

                    const receiptData = {
                        caseNumber: this.lastMintResult.caseNumber,
                        serverAddress: window.wallet?.address || window.tronWeb?.defaultAddress?.base58,
                        servedAt: this.lastMintResult.timestamp,
                        transactionHash: this.lastMintResult.alertTxId,
                        alertTokenId: tokenId,
                        documentTokenId: this.lastMintResult.receipt?.documentTokenId,
                        recipients: this.lastMintResult.recipients || [],
                        alertImage: this.lastMintResult.thumbnail,
                        ipfsHash: this.lastMintResult.ipfsHash,
                        chain: this.lastMintResult.chain,
                        chainName: this.lastMintResult.chainName,
                        explorerUrl: this.lastMintResult.explorerUrl,
                        feeBreakdown: this.lastMintResult.receipt?.feeBreakdown
                    };
                    console.log('Receipt data with tokenId:', tokenId);
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

    // Generate receipt PDF - optimized for 3 clean pages with up to 10 recipients
    async generateReceiptPDF(data) {
        await this.loadJSPDF();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Get all recipients
        const recipients = data.recipients || [data.recipient].filter(Boolean);
        const recipientCount = recipients.length;

        // ==================== PAGE 1: Header & Case Details ====================
        // Title header
        doc.setFontSize(22);
        doc.setFont(undefined, 'bold');
        doc.text('PROOF OF SERVICE', 105, 25, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text('Blockchain-Verified Legal Notice Delivery', 105, 35, { align: 'center' });

        // Success badge
        doc.setFillColor(40, 167, 69);
        doc.roundedRect(55, 42, 100, 12, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('SUCCESSFULLY DELIVERED', 105, 50, { align: 'center' });
        doc.setTextColor(0, 0, 0);

        let y = 70;

        // Case Information Box
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.rect(15, y - 5, 180, 45);

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Case Information', 20, y + 3);
        doc.setFont(undefined, 'normal');
        y += 15;

        doc.setFontSize(11);
        doc.text(`Case Number:`, 20, y);
        doc.setFont(undefined, 'bold');
        doc.text(`${data.caseNumber || 'N/A'}`, 70, y);
        doc.setFont(undefined, 'normal');
        y += 10;

        doc.text(`Date Served:`, 20, y);
        doc.text(`${formatUTCDate(data.timestamp)}`, 70, y);
        y += 10;

        doc.text(`Time Served:`, 20, y);
        doc.text(`${formatUTCTime(data.timestamp)}`, 70, y);
        y += 20;

        // Recipient Summary
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(`Recipients (${recipientCount})`, 20, y);
        doc.setFont(undefined, 'normal');
        y += 12;

        // Show recipients on page 1 (up to 5)
        const recipientsPage1 = Math.min(5, recipientCount);
        doc.setFontSize(10);
        for (let i = 0; i < recipientsPage1; i++) {
            const r = recipients[i];
            const addr = typeof r === 'object' ? r.address : r;
            const label = typeof r === 'object' && r.label ? ` (${r.label})` : '';

            doc.setFont(undefined, 'bold');
            doc.text(`${i + 1}.`, 20, y);
            doc.setFont(undefined, 'normal');
            doc.text(`${addr}${label}`, 28, y);
            y += 8;
        }

        if (recipientCount > 5) {
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text(`... and ${recipientCount - 5} more (see page 2)`, 28, y);
            doc.setTextColor(0, 0, 0);
        }

        // Page 1 footer
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Page 1 of 3', 105, 285, { align: 'center' });
        doc.setTextColor(0, 0, 0);

        // ==================== PAGE 2: Blockchain Verification ====================
        doc.addPage();
        y = 25;

        // Continue recipients if more than 5
        if (recipientCount > 5) {
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(`Recipients (continued)`, 20, y);
            doc.setFont(undefined, 'normal');
            y += 12;

            doc.setFontSize(10);
            for (let i = 5; i < recipientCount; i++) {
                const r = recipients[i];
                const addr = typeof r === 'object' ? r.address : r;
                const label = typeof r === 'object' && r.label ? ` (${r.label})` : '';

                doc.setFont(undefined, 'bold');
                doc.text(`${i + 1}.`, 20, y);
                doc.setFont(undefined, 'normal');
                doc.text(`${addr}${label}`, 28, y);
                y += 8;
            }
            y += 10;
        }

        // Blockchain Verification Box
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(248, 249, 250);
        doc.rect(15, y - 5, 180, 55, 'FD');

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Blockchain Verification', 20, y + 3);
        doc.setFont(undefined, 'normal');
        y += 15;

        doc.setFontSize(10);
        doc.text('Transaction Hash:', 20, y);
        y += 8;
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text(String(data.alertTxId || data.transactionHash || 'N/A'), 20, y);
        doc.setFont(undefined, 'normal');
        y += 12;

        doc.setFontSize(10);
        doc.text('Token ID:', 20, y);
        doc.setFont(undefined, 'bold');
        doc.text(String(data.tokenId || data.alertTokenId || 'Pending'), 70, y);
        doc.setFont(undefined, 'normal');
        y += 12;

        const explorerUrl = window.getExplorerTxUrl ?
            window.getExplorerTxUrl(data.alertTxId || data.transactionHash) :
            `https://nile.tronscan.org/#/transaction/${data.alertTxId || data.transactionHash}`;
        doc.text('Verify at:', 20, y);
        doc.setTextColor(0, 102, 204);
        doc.text(explorerUrl, 50, y);
        doc.setTextColor(0, 0, 0);
        y += 20;

        // Document Access
        doc.setDrawColor(200, 200, 200);
        doc.rect(15, y - 5, 180, 35);

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Document Access', 20, y + 3);
        doc.setFont(undefined, 'normal');
        y += 15;

        doc.setFontSize(10);
        doc.text('Recipients can view and download documents at:', 20, y);
        y += 10;
        doc.setTextColor(0, 102, 204);
        doc.setFont(undefined, 'bold');
        doc.text(`https://blockserved.com?case=${encodeURIComponent(data.caseNumber || '')}`, 20, y);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');

        // Page 2 footer
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Page 2 of 3', 105, 285, { align: 'center' });
        doc.setTextColor(0, 0, 0);

        // ==================== PAGE 3: NFT Preview & Certification ====================
        doc.addPage();
        y = 25;

        // NFT Preview
        const includeImage = document.getElementById('includeNFTImage')?.checked ?? true;
        if (includeImage && data.thumbnail) {
            try {
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text('NFT Preview', 105, y, { align: 'center' });
                y += 10;

                // Center the image
                const imgWidth = 100;
                const imgHeight = 130;
                doc.addImage(data.thumbnail, 'PNG', (210 - imgWidth) / 2, y, imgWidth, imgHeight);
                y += imgHeight + 15;
            } catch (e) {
                console.log('Could not add thumbnail to PDF:', e);
                y += 10;
            }
        }

        // Server Affirmation / Attestation Box
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(1);
        doc.rect(15, y, 180, 85);

        y += 10;
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('SERVER AFFIRMATION', 105, y, { align: 'center' });
        y += 12;

        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        const affirmText = [
            'I, the undersigned, hereby declare under penalty of perjury under the laws of the',
            'applicable jurisdiction that:',
            '',
            `On ${formatUTCDate(data.timestamp)} at ${formatUTCTime(data.timestamp)}, I caused the legal`,
            `documents referenced in Case No. ${data.caseNumber || 'N/A'} to be served upon the recipient(s)`,
            'listed herein via blockchain technology.',
            '',
            'Service was effectuated by transferring a Non-Fungible Token (NFT) containing',
            'notice of the legal documents to the recipient\'s blockchain wallet address.'
        ];
        affirmText.forEach(line => {
            doc.text(line, 20, y);
            y += 6;
        });

        // Signature line
        y += 8;
        doc.setLineWidth(0.5);
        doc.line(20, y, 120, y);
        doc.setFontSize(9);
        doc.text('Process Server Signature', 20, y + 5);

        doc.line(130, y, 190, y);
        doc.text('Date', 130, y + 5);

        y += 15;
        doc.setFontSize(8);
        doc.text(`Server Wallet: ${data.serverAddress || window.wallet?.address || 'N/A'}`, 20, y);

        // Final footer
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('This is an official Proof of Service document from TheBlockService', 105, 270, { align: 'center' });
        doc.text(`Generated: ${formatUTC(new Date())}`, 105, 277, { align: 'center' });
        doc.text('www.BlockServed.com | Blockchain-Powered Legal Service', 105, 284, { align: 'center' });

        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Page 3 of 3', 105, 292, { align: 'center' });
        doc.setTextColor(0, 0, 0);

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
                    const response = await fetchWithTimeout(`${ipfsGateway}${data.ipfsHash}`);
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
                    const response = await fetchWithTimeout(`${backendUrl}/api/cases/${encodeURIComponent(data.caseNumber)}/pdf?serverAddress=${serverAddress}`);
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

            // Prepare stamp text - check multiple possible field names for transaction hash
            const txHashFull = data.alertTxId || data.transactionHash || data.txId || '';
            const txHash = txHashFull ? String(txHashFull).substring(0, 40) + '...' : 'N/A';
            const servedDate = formatUTCDate(data.timestamp);
            const servedTime = formatUTCTime(data.timestamp);

            console.log('Stamp data - txHash:', txHash, 'date:', servedDate, 'time:', servedTime);

            // Add stamp to each page
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();

                // Stamp position (bottom right corner) - wider to fit full hash
                const stampWidth = 280;
                const stampHeight = 70;
                const stampX = width - stampWidth - 10;
                const stampY = 10;

                // Draw semi-transparent stamp background with red border
                // More transparent (0.6) so underlying document is visible
                page.drawRectangle({
                    x: stampX,
                    y: stampY,
                    width: stampWidth,
                    height: stampHeight,
                    color: PDFLib.rgb(1, 0.98, 0.98),
                    borderColor: PDFLib.rgb(0.8, 0, 0),
                    borderWidth: 2,
                    opacity: 0.65
                });

                // "SERVED VIA WWW.BLOCKSERVED.COM" text - RED, bold
                page.drawText('SERVED VIA WWW.BLOCKSERVED.COM', {
                    x: stampX + 10,
                    y: stampY + 55,
                    size: 10,
                    font: helveticaBold,
                    color: PDFLib.rgb(0.7, 0, 0)
                });

                // Date/time - dark text for readability
                page.drawText(`${servedDate} ${servedTime}`, {
                    x: stampX + 10,
                    y: stampY + 42,
                    size: 8,
                    font: helveticaBold,
                    color: PDFLib.rgb(0.3, 0, 0)
                });

                // Transaction hash - IMPORTANT: Show full hash for verification
                page.drawText(`TX: ${txHash}`, {
                    x: stampX + 10,
                    y: stampY + 28,
                    size: 7,
                    font: helvetica,
                    color: PDFLib.rgb(0.2, 0.2, 0.2)
                });

                // Verification URL
                page.drawText('Verify at: www.blockserved.com', {
                    x: stampX + 10,
                    y: stampY + 14,
                    size: 7,
                    font: helveticaBold,
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
                                ${escapeHtml(data.error)}
                            </div>

                            <h6>Details:</h6>
                            <ul>
                                <li><strong>Case Number:</strong> ${escapeHtml(data.caseNumber)}</li>
                                <li><strong>Recipient${data.recipients && data.recipients.length > 1 ? 's' : ''}:</strong><br>
                                    ${this.formatRecipientsForModal(data.recipients)}
                                </li>
                                <li><strong>Time:</strong> ${formatUTC(data.timestamp)}</li>
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
        let data;
        try {
            data = JSON.parse(decodeURIComponent(encodedData));
        } catch (e) {
            console.error('Error parsing proof of delivery data:', e);
            alert('Error loading delivery data');
            return;
        }
        const includeImage = document.getElementById('includeNFTImage')?.checked ?? true;
        
        // Create receipt HTML
        const receiptHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Proof of Delivery - ${escapeHtml(data.caseNumber)}</title>
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
                        <span class="value">${escapeHtml(data.caseNumber)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Service Date:</span>
                        <span class="value">${formatUTCDate(data.timestamp)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Service Time:</span>
                        <span class="value">${formatUTCTime(data.timestamp)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Notice ID:</span>
                        <span class="value">${escapeHtml(data.noticeId)}</span>
                    </div>
                </div>
                
                <div class="section">
                    <div class="section-title">Recipient Information</div>
                    ${(data.recipients || [data.recipient]).filter(Boolean).map((r, idx) => {
                        const addr = typeof r === 'string' ? r : r.address;
                        const label = typeof r === 'object' && r.label ? ` (${escapeHtml(r.label)})` : '';
                        return `<div class="detail-row">
                            <span class="label">${(data.recipients || []).length > 1 ? `Recipient ${idx + 1}:` : 'Wallet Address:'}</span>
                            <span class="value">${escapeHtml(addr)}${label}</span>
                        </div>`;
                    }).join('')}
                    <div class="detail-row">
                        <span class="label">Access URL:</span>
                        <span class="value">${escapeHtml(data.viewUrl)}</span>
                    </div>
                </div>
                
                <div class="section">
                    <div class="section-title">Blockchain Confirmation</div>
                    <div class="detail-row">
                        <span class="label">NFT Transaction:</span>
                        <span class="value tx-hash">${escapeHtml(data.alertTxId)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Verification:</span>
                        <span class="value">View on TronScan: ${escapeHtml(window.getTronScanUrl ? window.getTronScanUrl(data.alertTxId) : 'https://tronscan.org/#/transaction/' + data.alertTxId)}</span>
                    </div>
                </div>

                ${includeImage && data.thumbnail ? `
                <div class="section">
                    <div class="section-title">NFT Image</div>
                    <img src="${escapeHtml(data.thumbnail)}" class="nft-image" alt="Legal Notice NFT">
                </div>
                ` : ''}
                
                <div class="footer">
                    <p>This document certifies that legal notice was successfully delivered via blockchain technology.</p>
                    <p>Generated: ${formatUTC(new Date())} | TheBlockService.com</p>
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
                                    <input type="checkbox" value="${escapeHtml(recipient)}" checked style="margin-right: 10px;">
                                    ${escapeHtml(recipient)}
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
                                ${escapeHtml(r.recipient)}: ${escapeHtml(r.error)}
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