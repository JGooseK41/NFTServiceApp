/**
 * Transaction Staging Module
 * Uses backend as single source of truth for all transaction data
 */

window.TransactionStaging = {
    API_BASE: window.location.hostname === 'localhost' 
        ? 'http://localhost:3001/api/stage'
        : 'https://nftserviceapp.onrender.com/api/stage',
    
    currentTransactionId: null,
    
    /**
     * Stage a complete transaction on the backend
     * All data goes to backend FIRST
     */
    async stageTransaction(formData) {
        try {
            console.log('Staging transaction on backend...');
            
            // Create FormData object for multipart upload
            const uploadData = new FormData();
            
            // Get form values
            const recipients = window.getAllRecipients ? window.getAllRecipients() : 
                              [document.getElementById('mintRecipient')?.value.trim() || ''];
            const publicText = document.getElementById('noticeText')?.value.trim() || '';
            const noticeType = document.getElementById('noticeType')?.value || 'Legal Notice';
            const customType = document.getElementById('customNoticeType')?.value.trim() || '';
            const caseNumber = document.getElementById('mintCaseNumber')?.value.trim() || '';
            const issuingAgency = document.getElementById('issuingAgency')?.value.trim() || '';
            const tokenName = document.getElementById('mintTokenName')?.value.trim() || 'Legal Notice';
            const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked')?.value || 'document';
            const sponsorFees = document.getElementById('sponsorTransactionFees')?.checked || false;
            
            // Add all data fields
            uploadData.append('recipients', JSON.stringify(recipients));
            uploadData.append('noticeType', customType || noticeType);
            uploadData.append('caseNumber', caseNumber);
            uploadData.append('issuingAgency', issuingAgency);
            uploadData.append('publicText', publicText);
            uploadData.append('tokenName', tokenName);
            uploadData.append('deliveryMethod', deliveryMethod);
            uploadData.append('sponsorFees', sponsorFees);
            uploadData.append('hasDocument', deliveryMethod === 'document');
            uploadData.append('requiresSignature', deliveryMethod === 'document');
            
            // Add server info
            uploadData.append('serverAddress', window.tronWeb?.defaultAddress?.base58 || '');
            uploadData.append('serverName', 'Legal Notice Server');
            uploadData.append('network', window.currentNetwork || 'mainnet');
            uploadData.append('contractAddress', window.legalContract?.address || '');
            
            // Add fees - Match what the contract actually expects
            // serviceFee is 20 TRX, creationFee is 0 TRX, sponsorshipFee is 2 TRX
            uploadData.append('creationFee', '20');  // This is actually the service fee
            uploadData.append('sponsorshipFee', '2'); // 2 TRX per recipient for sponsorship
            
            // Handle files
            const thumbnailInput = document.getElementById('uploadInput');
            const documentInput = document.getElementById('documentUploadInput');
            
            if (thumbnailInput?.files?.[0]) {
                uploadData.append('thumbnail', thumbnailInput.files[0]);
            }
            
            if (documentInput?.files?.[0]) {
                uploadData.append('document', documentInput.files[0]);
            }
            
            // If we have encrypted data, add it
            if (window.encryptedDocumentBlob) {
                uploadData.append('encryptedDocument', window.encryptedDocumentBlob, 'encrypted.dat');
                uploadData.append('encryptionKey', window.currentEncryptionKey || '');
            }
            
            // If we have IPFS data, add it
            if (window.currentIPFSHash) {
                uploadData.append('ipfsHash', window.currentIPFSHash);
                uploadData.append('encryptedIPFS', window.encryptedIPFSHash || '');
                uploadData.append('metadataURI', window.currentMetadataURI || '');
            }
            
            // Send to backend
            const response = await fetch(`${this.API_BASE}/transaction`, {
                method: 'POST',
                body: uploadData
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Failed to stage transaction');
            }
            
            console.log('Transaction staged successfully:', result);
            
            // Store transaction ID
            this.currentTransactionId = result.transactionId;
            window.stagedTransactionId = result.transactionId;
            
            // Show staging success
            this.showStagingSuccess(result);
            
            return result;
            
        } catch (error) {
            console.error('Transaction staging error:', error);
            throw error;
        }
    },
    
    /**
     * Retrieve staged transaction data from backend
     */
    async getTransaction(transactionId) {
        try {
            const response = await fetch(`${this.API_BASE}/transaction/${transactionId}`);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to fetch transaction');
            }
            
            return result;
            
        } catch (error) {
            console.error('Error fetching staged transaction:', error);
            throw error;
        }
    },
    
    /**
     * Execute blockchain transaction using staged data
     * Backend is the source of all transaction parameters
     */
    async executeTransaction(transactionId, skipSimulation = false) {
        try {
            console.log('Executing transaction from staged data:', transactionId);
            
            // Get complete transaction data from backend
            const stagedData = await this.getTransaction(transactionId);
            
            if (!stagedData.success) {
                throw new Error('Failed to retrieve staged transaction');
            }
            
            const txData = stagedData.completeData;
            const notice = txData.notice;
            const recipients = txData.recipients;
            const data = txData.data;
            
            console.log('Executing with backend data:', txData);
            
            // First, simulate the transaction to get actual energy requirements
            if (!skipSimulation && window.TransactionEstimator && !window.SKIP_ENERGY_ESTIMATION) {
                try {
                    console.log('Simulating transaction to estimate energy requirements...');
                    
                    // Build the contract call for simulation
                    let contractCall;
                    if (recipients.length > 1) {
                        // Batch transaction
                        const batchNotices = recipients.map(r => [
                            r.recipient_address,
                            data.encryptedIPFS || '',
                            data.encryptionKey || '',
                            notice.issuing_agency || '',
                            notice.notice_type || '',
                            notice.case_number || '',
                            notice.public_text || '',
                            notice.legal_rights || '',
                            data.sponsorFees || false,
                            data.metadataURI || ''
                        ]);
                        contractCall = window.legalContract.serveNoticeBatch(batchNotices);
                    } else {
                        // Single transaction
                        const recipient = recipients[0];
                        contractCall = window.legalContract.serveNotice(
                            recipient.recipient_address,
                            data.encryptedIPFS || '',
                            data.encryptionKey || '',
                            notice.issuing_agency || '',
                            notice.notice_type || '',
                            notice.case_number || '',
                            notice.public_text || '',
                            notice.legal_rights || '',
                            data.sponsorFees || false,
                            data.metadataURI || ''
                        );
                    }
                    
                    // Estimate energy
                    const estimation = await window.TransactionEstimator.estimateTransactionEnergy(contractCall);
                    console.log('Energy estimation result:', estimation);
                    
                    // Show energy options dialog and wait for user choice
                    const userChoice = await new Promise((resolve) => {
                        window.TransactionEstimator.showEnergyOptionsDialog(estimation, resolve);
                    });
                    
                    if (userChoice === 'cancel') {
                        throw new Error('Transaction cancelled by user');
                    }
                    
                    // Proceed based on user choice
                    if (userChoice === 'rent' && window.EnergyRental) {
                        try {
                            // Update status to energy phase
                            if (window.TransactionStatus) {
                                window.TransactionStatus.updatePhase('energy');
                            }
                            
                            // Use the actual estimated energy from simulation
                            const energyNeeded = estimation.estimatedEnergy;
                            console.log('Renting energy based on simulation:', energyNeeded, 'units');
                            
                            const energyResult = await window.EnergyRental.prepareEnergyForTransaction(
                                energyNeeded,
                                window.tronWeb.defaultAddress.base58
                            );
                            
                            if (!energyResult.success && !energyResult.skipped) {
                                console.warn('Energy rental failed');
                                if (!confirm('Energy rental failed. Proceed with burning TRX instead?')) {
                                    throw new Error('Transaction cancelled - energy rental failed');
                                }
                            }
                        } catch (energyError) {
                            console.error('Energy rental error:', energyError);
                            if (!confirm('Energy rental failed. Proceed with burning TRX instead?')) {
                                throw new Error('Transaction cancelled - energy rental failed');
                            }
                        }
                    }
                    // If user chose 'burn', we just proceed without rental
                    
                } catch (simError) {
                    console.error('Simulation error:', simError);
                    // If simulation fails, fall back to old behavior with default estimates
                    if (window.EnergyRental && !window.SKIP_ENERGY_RENTAL) {
                        const energy = txData.energy;
                        const energyNeeded = energy.estimated_energy || 400000;
                        
                        if (confirm(`Could not simulate transaction. Estimate ${energyNeeded} energy needed. Proceed with rental?`)) {
                            try {
                                const energyResult = await window.EnergyRental.prepareEnergyForTransaction(
                                    energyNeeded,
                                    window.tronWeb.defaultAddress.base58
                                );
                                
                                if (!energyResult.success && !energyResult.skipped) {
                                    console.warn('Energy rental failed');
                                }
                            } catch (energyError) {
                                console.error('Energy rental error:', energyError);
                            }
                        }
                    }
                }
            }
            
            // Update status to transaction phase
            if (window.TransactionStatus) {
                window.TransactionStatus.updatePhase('transaction');
            }
            
            // Prepare blockchain transaction parameters from backend data
            let blockchainTx;
            let alertIds = [];
            let documentIds = [];
            
            if (recipients.length > 1) {
                // Batch transaction
                const batchNotices = recipients.map(r => [
                    r.recipient_address,                    // address recipient
                    data.encryptedIPFS || '',               // string encryptedIPFS
                    data.encryptionKey || '',               // string encryptionKey
                    notice.issuing_agency || '',            // string issuingAgency
                    notice.notice_type || '',               // string noticeType
                    notice.case_number || '',               // string caseNumber
                    notice.public_text || '',               // string caseDetails
                    notice.legal_rights || '',              // string legalRights
                    data.sponsorFees || false,              // bool sponsorFees
                    data.metadataURI || ''                  // string metadataURI
                ]);
                
                console.log('Executing batch transaction with backend data:', batchNotices);
                
                // Calculate the total fee in TRX - ENSURE NUMBERS NOT STRINGS
                const creationFee = parseFloat(data.creationFee) || 25;
                const sponsorshipFee = parseFloat(data.sponsorshipFee) || 10;
                const totalFeeTRX = creationFee + (data.sponsorFees ? sponsorshipFee * recipients.length : 0);
                console.log('Total fee calculation:', {
                    creationFee: creationFee,
                    sponsorshipFee: sponsorshipFee,
                    recipientCount: recipients.length,
                    sponsorFees: data.sponsorFees,
                    totalFeeTRX: totalFeeTRX,
                    totalFeeSUN: totalFeeTRX * 1_000_000
                });
                
                blockchainTx = await window.legalContract.serveNoticeBatch(batchNotices).send({
                    feeLimit: 500_000_000,
                    callValue: totalFeeTRX * 1_000_000, // Convert TRX to SUN directly (don't use toSun on already TRX values)
                    shouldPollResponse: true
                });
                
                // Extract IDs from result
                if (blockchainTx && Array.isArray(blockchainTx)) {
                    if (blockchainTx.length >= 2 && Array.isArray(blockchainTx[0]) && Array.isArray(blockchainTx[1])) {
                        alertIds = blockchainTx[0].map(id => id.toString());
                        documentIds = blockchainTx[1].map(id => id.toString());
                    }
                }
                
            } else {
                // Single transaction
                const recipient = recipients[0];
                
                console.log('Executing single transaction with backend data');
                
                // Calculate the total fee in TRX - ENSURE NUMBERS NOT STRINGS
                const creationFee = parseFloat(data.creationFee) || 25;
                const sponsorshipFee = parseFloat(data.sponsorshipFee) || 10;
                const totalFeeTRX = creationFee + (data.sponsorFees ? sponsorshipFee : 0);
                console.log('Single transaction fee calculation:', {
                    creationFee: creationFee,
                    sponsorshipFee: sponsorshipFee,
                    sponsorFees: data.sponsorFees,
                    totalFeeTRX: totalFeeTRX,
                    totalFeeSUN: totalFeeTRX * 1_000_000
                });
                
                blockchainTx = await window.legalContract.serveNotice(
                    recipient.recipient_address,
                    data.encryptedIPFS || '',
                    data.encryptionKey || '',
                    notice.issuing_agency || '',
                    notice.notice_type || '',
                    notice.case_number || '',
                    notice.public_text || '',
                    notice.legal_rights || '',
                    data.sponsorFees || false,
                    data.metadataURI || ''
                ).send({
                    feeLimit: 100_000_000,
                    callValue: totalFeeTRX * 1_000_000, // Convert TRX to SUN directly (don't use toSun on already TRX values)
                    shouldPollResponse: true
                });
                
                // Extract IDs
                if (blockchainTx) {
                    alertIds = [blockchainTx.alertId?.toString() || recipient.notice_id];
                    documentIds = [blockchainTx.documentId?.toString() || `${recipient.notice_id}_doc`];
                }
            }
            
            const txHash = typeof blockchainTx === 'string' ? blockchainTx : blockchainTx.txid || blockchainTx.transactionHash;
            
            // Update status to confirmation phase
            if (window.TransactionStatus) {
                window.TransactionStatus.updatePhase('confirmation');
            }
            
            // Notify backend of execution
            const executeResponse = await fetch(`${this.API_BASE}/execute/${transactionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    blockchainTxHash: txHash,
                    alertIds: alertIds,
                    documentIds: documentIds,
                    energyUsed: 0 // Will be updated later
                })
            });
            
            const executeResult = await executeResponse.json();
            
            if (!executeResult.success) {
                console.error('Backend update failed:', executeResult);
                // Transaction succeeded but backend update failed - not critical
            }
            
            console.log('Transaction executed and backend updated:', executeResult);
            
            return {
                success: true,
                transactionId,
                blockchainTxHash: txHash,
                alertIds,
                documentIds,
                recipients: executeResult.recipients || recipients
            };
            
        } catch (error) {
            console.error('Transaction execution error:', error);
            throw error;
        }
    },
    
    /**
     * Show staging success dialog
     */
    showStagingSuccess(stagingResult) {
        const estimates = stagingResult.estimates;
        
        // Create overlay first
        const overlay = document.createElement('div');
        overlay.className = 'staging-dialog-overlay';
        overlay.innerHTML = `
            <style>
                .staging-dialog-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .staging-dialog {
                    background: #1a1b23;
                    border: 1px solid #2d2e3f;
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 500px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
                }
                
                .staging-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                }
                
                .staging-header i {
                    color: var(--success);
                    font-size: 24px;
                }
                
                .staging-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }
                
                .staging-info {
                    background: var(--gray-800);
                    border-radius: 8px;
                    padding: 16px;
                    margin: 16px 0;
                }
                
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid var(--gray-700);
                }
                
                .info-row:last-child {
                    border-bottom: none;
                }
                
                .info-label {
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }
                
                .info-value {
                    color: var(--text-primary);
                    font-weight: 500;
                }
                
                .cost-summary {
                    background: rgba(34, 197, 94, 0.1);
                    border: 1px solid var(--success);
                    border-radius: 8px;
                    padding: 12px;
                    margin: 16px 0;
                }
                
                .staging-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 20px;
                }
                
                .staging-btn {
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }
                
                .staging-btn-primary {
                    background: var(--accent-blue);
                    color: white;
                }
                
                .staging-btn-primary:hover {
                    background: var(--accent-blue-dark);
                }
                
                .staging-btn-secondary {
                    background: var(--gray-700);
                    color: var(--text-primary);
                }
            </style>
            
            <div class="staging-header">
                <i class="fas fa-database"></i>
                <div class="staging-title">Transaction Staged</div>
            </div>
            
            <div class="staging-content">
                <p style="color: var(--text-secondary); margin-bottom: 16px;">
                    All data has been saved to the backend. Ready to execute on blockchain.
                </p>
                
                <div class="staging-info">
                    <div class="info-row">
                        <span class="info-label">Transaction ID:</span>
                        <span class="info-value" style="font-family: monospace; font-size: 0.85rem;">${stagingResult.transactionId}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Recipients:</span>
                        <span class="info-value">${stagingResult.recipients.length}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Status:</span>
                        <span class="info-value" style="color: var(--success);">Ready</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Expires:</span>
                        <span class="info-value">30 minutes</span>
                    </div>
                </div>
                
                <div class="cost-summary">
                    <div style="font-weight: 600; margin-bottom: 8px;">Cost Summary:</div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Transaction Fee:</span>
                        <span>${estimates.totalFeeTRX.toFixed(2)} TRX</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Energy (with rental):</span>
                        <span>~${estimates.rentalCostTRX.toFixed(2)} TRX</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-weight: 600; padding-top: 8px; border-top: 1px solid rgba(34, 197, 94, 0.3); margin-top: 8px;">
                        <span>Total:</span>
                        <span>~${(estimates.totalFeeTRX + estimates.rentalCostTRX).toFixed(2)} TRX</span>
                    </div>
                </div>
            </div>
            
            <div class="staging-actions">
                <button class="staging-btn staging-btn-secondary" onclick="this.closest('.staging-dialog-overlay').remove()">
                    Cancel
                </button>
                <button class="staging-btn staging-btn-primary" onclick="TransactionStaging.proceedWithExecution('${stagingResult.transactionId}')">
                    Execute on Blockchain
                </button>
            </div>
        </div>`;
        
        document.body.appendChild(overlay);
    },
    
    /**
     * Proceed with blockchain execution
     */
    async proceedWithExecution(transactionId) {
        try {
            // Close dialog
            document.querySelector('.staging-dialog-overlay')?.remove();
            
            // Show status modal with staging phase
            if (window.TransactionStatus) {
                window.TransactionStatus.show('staging');
            } else if (window.showProcessing) {
                window.showProcessing('Executing blockchain transaction...');
            }
            
            // Execute the transaction
            const result = await this.executeTransaction(transactionId);
            
            if (result.success) {
                // Show success in status modal
                if (window.TransactionStatus) {
                    window.TransactionStatus.showSuccess(result);
                } else {
                    if (window.uiManager) {
                        window.uiManager.showNotification('success', 
                            `Transaction successful! Hash: ${result.blockchainTxHash}`);
                    }
                    
                    // Show success UI
                    if (window.showTransactionSuccess) {
                        window.showTransactionSuccess(result);
                    }
                }
            }
            
            if (window.hideProcessing) {
                window.hideProcessing();
            }
            
            return result;
            
        } catch (error) {
            console.error('Execution error:', error);
            
            // Show error in status modal
            if (window.TransactionStatus) {
                window.TransactionStatus.showError(error.message);
            } else {
                if (window.hideProcessing) {
                    window.hideProcessing();
                }
                
                if (window.uiManager) {
                    window.uiManager.showNotification('error', 
                        'Transaction failed: ' + error.message);
                }
            }
            
            throw error;
        }
    }
};

// Override createLegalNotice to use staging
window.createLegalNoticeWithStaging = async function() {
    try {
        // Validate wallet connection
        if (!window.legalContract || !window.tronWeb?.defaultAddress) {
            if (window.uiManager) {
                window.uiManager.showNotification('error', 'Please connect wallet first');
            }
            return;
        }
        
        // Stage transaction on backend
        const stagingResult = await window.TransactionStaging.stageTransaction();
        
        // Transaction is now staged and ready for execution
        // User will click "Execute on Blockchain" to proceed
        
    } catch (error) {
        console.error('Transaction staging error:', error);
        if (window.uiManager) {
            window.uiManager.showNotification('error', 'Failed to stage transaction: ' + error.message);
        }
    }
};

console.log('Transaction Staging module loaded - Backend is source of truth');