/**
 * TRANSACTION RECOVERY SYSTEM
 * Saves failed transaction data so you can retry without re-uploading to IPFS
 */

window.TransactionRecovery = {
    
    // Storage key
    STORAGE_KEY: 'failed_transactions',
    CURRENT_KEY: 'current_transaction_attempt',
    
    // Save transaction attempt before sending
    saveTransactionAttempt(data) {
        console.log('💾 Saving transaction data for recovery...');
        
        const attemptData = {
            id: 'tx_' + Date.now(),
            timestamp: new Date().toISOString(),
            caseNumber: data.caseNumber,
            recipients: data.recipients || [data.recipient],
            noticeType: data.noticeType,
            documentIPFS: data.documentIPFS || data.encryptedIPFS,
            metadataURI: data.metadataURI,
            thumbnailIPFS: data.thumbnailIPFS,
            fees: data.fees,
            energy: data.energyRequired,
            status: 'pending',
            errorMessage: null,
            retryCount: 0,
            // Store all parameters for v5 contract
            v5Params: {
                recipient: data.recipient,
                encryptedIPFS: data.encryptedIPFS || data.documentIPFS,
                encryptionKey: data.encryptionKey,
                issuingAgency: data.issuingAgency || data.lawFirm,
                noticeType: data.noticeType,
                caseNumber: data.caseNumber,
                caseDetails: data.caseDetails || data.courtName,
                legalRights: data.legalRights || data.recipientInfo,
                sponsorFees: data.sponsorFees,
                metadataURI: data.metadataURI
            }
        };
        
        // Save to localStorage
        localStorage.setItem(this.CURRENT_KEY, JSON.stringify(attemptData));
        
        // Also add to failed transactions list
        this.addToFailedList(attemptData);
        
        console.log('✅ Transaction data saved with ID:', attemptData.id);
        return attemptData.id;
    },
    
    // Add to failed transactions list
    addToFailedList(attemptData) {
        let failed = this.getFailedTransactions();
        
        // Keep only last 10 failed transactions
        if (failed.length >= 10) {
            failed = failed.slice(-9);
        }
        
        failed.push(attemptData);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(failed));
    },
    
    // Mark transaction as failed with error
    markFailed(id, error) {
        console.log('❌ Marking transaction as failed:', id);
        
        let current = this.getCurrentAttempt();
        if (current && (current.id === id || !id)) {
            current.status = 'failed';
            current.errorMessage = error?.message || error;
            current.failedAt = new Date().toISOString();
            localStorage.setItem(this.CURRENT_KEY, JSON.stringify(current));
            this.updateFailedList(current);
        }
        
        // Show recovery options
        this.showRecoveryOptions(current);
    },
    
    // Update failed list
    updateFailedList(attemptData) {
        let failed = this.getFailedTransactions();
        const index = failed.findIndex(f => f.id === attemptData.id);
        
        if (index >= 0) {
            failed[index] = attemptData;
        } else {
            failed.push(attemptData);
        }
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(failed));
    },
    
    // Get current attempt
    getCurrentAttempt() {
        const data = localStorage.getItem(this.CURRENT_KEY);
        return data ? JSON.parse(data) : null;
    },
    
    // Get all failed transactions
    getFailedTransactions() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },
    
    // Retry last failed transaction
    async retryLast() {
        const current = this.getCurrentAttempt();
        
        if (!current) {
            console.log('❌ No failed transaction to retry');
            return null;
        }
        
        console.log('🔄 Retrying transaction:', current.id);
        console.log('  Case:', current.caseNumber);
        console.log('  IPFS already uploaded:', current.documentIPFS);
        console.log('  Metadata already created:', current.metadataURI);
        
        current.retryCount++;
        current.status = 'retrying';
        localStorage.setItem(this.CURRENT_KEY, JSON.stringify(current));
        
        // Check energy first
        const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
        const currentEnergy = account.energy || 0;
        console.log(`⚡ Current energy: ${currentEnergy.toLocaleString()}`);
        
        // Use the saved v5 parameters
        try {
            const result = await window.legalContract.serveNotice(
                current.v5Params.recipient,
                current.v5Params.encryptedIPFS,
                current.v5Params.encryptionKey,
                current.v5Params.issuingAgency,
                current.v5Params.noticeType,
                current.v5Params.caseNumber,
                current.v5Params.caseDetails,
                current.v5Params.legalRights,
                current.v5Params.sponsorFees,
                current.v5Params.metadataURI
            ).send({
                callValue: current.fees?.total || 27000000,
                feeLimit: 1000000000
            });
            
            console.log('✅ Retry successful! TX:', result);
            current.status = 'success';
            current.txId = result;
            current.succeededAt = new Date().toISOString();
            localStorage.setItem(this.CURRENT_KEY, JSON.stringify(current));
            
            return { success: true, txId: result };
            
        } catch (error) {
            console.error('Retry failed:', error);
            this.markFailed(current.id, error);
            return { success: false, error: error.message };
        }
    },
    
    // Show recovery options in console
    showRecoveryOptions(attemptData) {
        if (!attemptData) return;
        
        console.log('\n' + '='.repeat(60));
        console.log('💾 TRANSACTION SAVED FOR RECOVERY');
        console.log('='.repeat(60));
        console.log('Transaction ID:', attemptData.id);
        console.log('Case Number:', attemptData.caseNumber);
        console.log('IPFS Hash:', attemptData.documentIPFS);
        console.log('Metadata:', attemptData.metadataURI?.substring(0, 50) + '...');
        console.log('\n📋 RECOVERY OPTIONS:');
        console.log('1. Run: TransactionRecovery.retryLast()');
        console.log('2. View saved data: TransactionRecovery.getCurrentAttempt()');
        console.log('3. List all failed: TransactionRecovery.getFailedTransactions()');
        console.log('='.repeat(60) + '\n');
    },
    
    // Create recovery UI
    showRecoveryUI() {
        const failed = this.getFailedTransactions();
        
        if (failed.length === 0) {
            console.log('No failed transactions to recover');
            return;
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'transaction-recovery-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a1a;
            border: 2px solid #00ff00;
            padding: 20px;
            z-index: 10000;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            color: #00ff00;
            font-family: monospace;
        `;
        
        let html = `
            <h2 style="color: #00ff00;">💾 Failed Transaction Recovery</h2>
            <p>Found ${failed.length} failed transaction(s)</p>
            <hr style="border-color: #00ff00;">
        `;
        
        failed.forEach((tx, index) => {
            html += `
                <div style="margin: 15px 0; padding: 10px; border: 1px solid #333;">
                    <strong>Case: ${tx.caseNumber}</strong><br>
                    <small>Failed: ${new Date(tx.timestamp).toLocaleString()}</small><br>
                    <small>IPFS: ${tx.documentIPFS?.substring(0, 30)}...</small><br>
                    <small>Error: ${tx.errorMessage || 'Unknown'}</small><br>
                    <button onclick="TransactionRecovery.retryTransaction('${tx.id}')" 
                            style="margin-top: 10px; background: #00ff00; color: #000; padding: 5px 10px; border: none; cursor: pointer;">
                        🔄 Retry This Transaction
                    </button>
                </div>
            `;
        });
        
        html += `
            <hr style="border-color: #00ff00;">
            <button onclick="document.getElementById('transaction-recovery-modal').remove()" 
                    style="background: #ff0000; color: #fff; padding: 10px; border: none; cursor: pointer; width: 100%;">
                Close
            </button>
        `;
        
        modal.innerHTML = html;
        document.body.appendChild(modal);
    },
    
    // Retry specific transaction
    async retryTransaction(id) {
        const failed = this.getFailedTransactions();
        const tx = failed.find(f => f.id === id);
        
        if (!tx) {
            console.error('Transaction not found:', id);
            return;
        }
        
        // Set as current attempt
        localStorage.setItem(this.CURRENT_KEY, JSON.stringify(tx));
        
        // Close modal
        const modal = document.getElementById('transaction-recovery-modal');
        if (modal) modal.remove();
        
        // Retry
        return await this.retryLast();
    },
    
    // Clear all saved transactions
    clearAll() {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.CURRENT_KEY);
        console.log('✅ Cleared all saved transactions');
    }
};

// Hook into transaction failures
(function() {
    // Save original createLegalNotice if it exists
    if (window.createLegalNotice) {
        const originalCreate = window.createLegalNotice;
        
        window.createLegalNotice = async function(...args) {
            // Save transaction data before attempting
            const txData = args[0];
            const recoveryId = TransactionRecovery.saveTransactionAttempt(txData);
            
            try {
                const result = await originalCreate.apply(this, args);
                
                // Mark as successful
                const current = TransactionRecovery.getCurrentAttempt();
                if (current) {
                    current.status = 'success';
                    current.txId = result;
                    localStorage.setItem(TransactionRecovery.CURRENT_KEY, JSON.stringify(current));
                }
                
                return result;
                
            } catch (error) {
                // Mark as failed and show recovery options
                TransactionRecovery.markFailed(recoveryId, error);
                throw error;
            }
        };
    }
})();

// Add recovery button to UI
window.addEventListener('load', function() {
    const button = document.createElement('button');
    button.innerHTML = '💾 Recover Failed TX';
    button.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 20px;
        background: #ff9900;
        color: #000;
        padding: 10px 15px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        z-index: 9999;
        font-weight: bold;
    `;
    button.onclick = () => TransactionRecovery.showRecoveryUI();
    
    // Only show if there are failed transactions
    if (TransactionRecovery.getFailedTransactions().length > 0) {
        document.body.appendChild(button);
    }
});

console.log('✅ Transaction Recovery System loaded');
console.log('Failed transactions will be saved automatically');
console.log('Use: TransactionRecovery.retryLast() to retry');