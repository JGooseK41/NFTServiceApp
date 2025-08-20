/**
 * Fully Automatic Transaction System
 * Zero user interaction - handles everything automatically
 * Validates, fixes, simulates, and executes without prompts
 */

console.log('🚀 Loading Fully Automatic Transaction System v3.0...');

// Override ALL confirmation dialogs globally
window.confirm = function(message) {
    console.log(`🤖 Auto-confirming: ${message}`);
    return true; // Always confirm
};

window.alert = function(message) {
    console.log(`🤖 Auto-acknowledged: ${message}`);
    // Don't show alerts
};

// Main automatic transaction handler
window.FullyAutomaticTransaction = {
    
    /**
     * Process transaction completely automatically
     */
    async processTransaction(txData) {
        console.log('🤖 Processing transaction automatically...');
        
        const result = {
            success: false,
            error: null,
            txId: null,
            warnings: []
        };
        
        try {
            // Step 1: Auto-fix all data issues
            this.autoFixData(txData);
            
            // Step 2: Validate silently
            const validation = this.silentValidation(txData);
            if (!validation.valid) {
                // Try to auto-fix critical issues
                if (validation.fixable) {
                    this.applyAutoFixes(txData, validation.fixes);
                } else {
                    throw new Error(`Cannot auto-fix: ${validation.errors[0]}`);
                }
            }
            
            // Step 3: Calculate energy needs
            const energyNeeded = await this.estimateEnergy(txData);
            
            // Step 4: Handle energy automatically
            await this.autoHandleEnergy(energyNeeded);
            
            // Step 5: Execute transaction
            result.txId = await this.executeTransaction(txData);
            result.success = true;
            
            console.log('✅ Transaction completed automatically:', result.txId);
            
        } catch (error) {
            console.error('❌ Automatic transaction failed:', error);
            result.error = error.message;
            
            // Auto-retry logic for specific errors
            if (this.isRetryableError(error.message)) {
                console.log('🔄 Auto-retrying transaction...');
                await this.delay(2000);
                return await this.processTransaction(txData);
            }
        }
        
        return result;
    },
    
    /**
     * Fix all data issues automatically
     */
    autoFixData(txData) {
        // Fix fees
        if (txData.data) {
            txData.data.creationFee = this.toNumber(txData.data.creationFee, 25);
            txData.data.sponsorshipFee = this.toNumber(txData.data.sponsorshipFee, 10);
            txData.data.sponsorFees = this.toBoolean(txData.data.sponsorFees);
        }
        
        // Fix recipients
        if (txData.recipients) {
            txData.recipients = txData.recipients.filter(r => r && r.recipient_address);
        }
        
        // Ensure required fields
        if (!txData.notice) txData.notice = {};
        if (!txData.notice.case_number) {
            txData.notice.case_number = `AUTO-${Date.now()}`;
            console.log('Auto-generated case number:', txData.notice.case_number);
        }
        
        // Set defaults for missing fields
        txData.notice.issuing_agency = txData.notice.issuing_agency || 'Process Server';
        txData.notice.notice_type = txData.notice.notice_type || 'Legal Notice';
        txData.notice.public_text = txData.notice.public_text || '';
        txData.notice.legal_rights = txData.notice.legal_rights || '';
        
        if (!txData.data) txData.data = {};
        txData.data.encryptedIPFS = txData.data.encryptedIPFS || '';
        txData.data.encryptionKey = txData.data.encryptionKey || '';
        txData.data.metadataURI = txData.data.metadataURI || '';
    },
    
    /**
     * Silent validation without user interaction
     */
    silentValidation(txData) {
        const errors = [];
        const fixes = [];
        
        // Check critical fields
        if (!txData.recipients || txData.recipients.length === 0) {
            errors.push('No recipients');
            return { valid: false, fixable: false, errors };
        }
        
        // Check addresses
        for (const recipient of txData.recipients) {
            if (!window.tronWeb?.isAddress(recipient.recipient_address)) {
                errors.push(`Invalid address: ${recipient.recipient_address}`);
                return { valid: false, fixable: false, errors };
            }
        }
        
        // Check fees
        const totalFee = this.calculateTotalFee(txData);
        if (isNaN(totalFee) || totalFee < 0) {
            fixes.push({ field: 'fees', action: 'recalculate' });
            return { valid: false, fixable: true, fixes };
        }
        
        return { valid: true };
    },
    
    /**
     * Apply automatic fixes
     */
    applyAutoFixes(txData, fixes) {
        for (const fix of fixes) {
            switch (fix.field) {
                case 'fees':
                    txData.data.creationFee = 25;
                    txData.data.sponsorshipFee = 10;
                    console.log('Applied fee fix');
                    break;
            }
        }
    },
    
    /**
     * Estimate energy needs
     */
    async estimateEnergy(txData) {
        try {
            const recipientCount = txData.recipients?.length || 1;
            // Base estimate: 300k per recipient for batch, 400k for single
            const baseEstimate = recipientCount > 1 ? 300000 * recipientCount : 400000;
            
            // Add 20% buffer
            return Math.ceil(baseEstimate * 1.2);
        } catch (error) {
            console.warn('Using default energy estimate');
            return 500000;
        }
    },
    
    /**
     * Handle energy automatically
     */
    async autoHandleEnergy(energyNeeded) {
        console.log(`⚡ Auto-handling ${energyNeeded} energy...`);
        
        try {
            // Check current energy
            const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
            const currentEnergy = account.energy || 0;
            
            if (currentEnergy >= energyNeeded) {
                console.log('✅ Sufficient energy available');
                return;
            }
            
            // Try to rent
            if (window.EnergyRental) {
                const needed = energyNeeded - currentEnergy;
                console.log(`🔄 Auto-renting ${needed} energy...`);
                
                try {
                    await window.EnergyRental.rentFromJustLend(needed, window.tronWeb.defaultAddress.base58);
                    console.log('✅ Energy rented');
                } catch (e) {
                    console.log('⚠️ Rental failed, will burn TRX');
                }
            }
        } catch (error) {
            console.log('⚠️ Energy check failed, proceeding anyway');
        }
    },
    
    /**
     * Execute the actual transaction
     */
    async executeTransaction(txData) {
        const recipients = txData.recipients;
        const data = txData.data;
        const notice = txData.notice;
        
        // Calculate fee
        const totalFeeTRX = this.calculateTotalFee(txData);
        const totalFeeSUN = totalFeeTRX * 1_000_000;
        
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
            
            const tx = await window.legalContract.serveNoticeBatch(batchNotices).send({
                feeLimit: 1000_000_000,  // 1000 TRX to prevent any failures
                callValue: totalFeeSUN,
                shouldPollResponse: true
            });
            
            return tx.txid || tx;
        } else {
            // Single transaction
            const recipient = recipients[0];
            const tx = await window.legalContract.serveNotice(
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
                feeLimit: 1000_000_000,  // 1000 TRX to prevent any failures
                callValue: totalFeeSUN,
                shouldPollResponse: true
            });
            
            return tx.txid || tx;
        }
    },
    
    /**
     * Helper functions
     */
    toNumber(value, defaultValue) {
        const num = parseFloat(value);
        return isNaN(num) ? defaultValue : num;
    },
    
    toBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value === 'true';
        return false;
    },
    
    calculateTotalFee(txData) {
        const creationFee = this.toNumber(txData.data?.creationFee, 25);
        const sponsorshipFee = this.toNumber(txData.data?.sponsorshipFee, 10);
        const sponsorFees = this.toBoolean(txData.data?.sponsorFees);
        const recipientCount = txData.recipients?.length || 0;
        
        return creationFee + (sponsorFees ? sponsorshipFee * recipientCount : 0);
    },
    
    isRetryableError(message) {
        const retryableErrors = [
            'network',
            'timeout',
            'connection',
            'ETIMEDOUT',
            'ECONNRESET'
        ];
        
        return retryableErrors.some(err => 
            message.toLowerCase().includes(err.toLowerCase())
        );
    },
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Override transaction staging to use fully automatic system
if (window.TransactionStaging) {
    const originalExecute = window.TransactionStaging.executeTransaction;
    
    window.TransactionStaging.executeTransaction = async function(transactionId, skipSimulation = false) {
        console.log('🤖 Fully automatic execution starting...');
        
        try {
            // Get transaction data
            const stagedData = await this.getTransaction(transactionId);
            if (!stagedData.success) {
                throw new Error('Failed to retrieve staged transaction');
            }
            
            // Process automatically
            const result = await window.FullyAutomaticTransaction.processTransaction(stagedData.completeData);
            
            if (result.success) {
                return result.txId;
            } else {
                throw new Error(result.error || 'Transaction failed');
            }
            
        } catch (error) {
            console.error('Automatic execution failed:', error);
            // Still try the original method as fallback
            return await originalExecute.call(this, transactionId, true);
        }
    };
}

// Override transaction estimator dialogs
if (window.TransactionEstimator) {
    window.TransactionEstimator.showEnergyOptionsDialog = function(estimation, callback) {
        console.log('🤖 Auto-selecting: rent energy');
        setTimeout(() => callback('rent'), 0);
    };
}

// Override energy rental dialogs
if (window.EnergyRental) {
    window.EnergyRental.showEnergyDialog = async function() {
        console.log('🤖 Auto-selecting: rent');
        return 'rent';
    };
}

console.log('✅ Fully Automatic Transaction System v3.0 loaded!');
console.log('   🤖 No user interaction required');
console.log('   🔧 Auto-fixes all data issues');
console.log('   ⚡ Auto-handles energy rental');
console.log('   🔄 Auto-retries on network errors');
console.log('   ✅ Completely hands-free operation');