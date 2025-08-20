/**
 * Automatic Transaction Preflight System
 * Runs completely automatically without user intervention
 * Silently validates, fixes issues, and only proceeds if safe
 */

console.log('🤖 Loading Automatic Preflight System...');

window.AutomaticPreflightSystem = {
    
    /**
     * Silently validate and fix transaction data
     */
    async validateAndPrepareTransaction(txData) {
        console.log('🔍 Auto-validating transaction...');
        
        try {
            // Fix data types automatically
            if (txData.data) {
                // Convert fees to numbers if they're strings
                if (typeof txData.data.creationFee === 'string') {
                    txData.data.creationFee = parseFloat(txData.data.creationFee) || 25;
                }
                if (typeof txData.data.sponsorshipFee === 'string') {
                    txData.data.sponsorshipFee = parseFloat(txData.data.sponsorshipFee) || 10;
                }
                if (typeof txData.data.sponsorFees === 'string') {
                    txData.data.sponsorFees = txData.data.sponsorFees === 'true';
                }
                
                // Ensure fees are valid
                if (isNaN(txData.data.creationFee) || txData.data.creationFee < 0) {
                    console.warn('Auto-fixing invalid creation fee');
                    txData.data.creationFee = 25;
                }
                if (isNaN(txData.data.sponsorshipFee) || txData.data.sponsorshipFee < 0) {
                    console.warn('Auto-fixing invalid sponsorship fee');
                    txData.data.sponsorshipFee = 10;
                }
            }
            
            // Calculate fees correctly
            const recipientCount = txData.recipients?.length || 0;
            const creationFee = txData.data?.creationFee || 25;
            const sponsorshipFee = txData.data?.sponsorshipFee || 10;
            const sponsorFees = txData.data?.sponsorFees || false;
            const totalFeeTRX = creationFee + (sponsorFees ? sponsorshipFee * recipientCount : 0);
            const totalFeeSUN = totalFeeTRX * 1_000_000;
            
            // Store calculated fees for later use
            txData.calculatedFees = {
                creationFee,
                sponsorshipFee,
                totalFeeTRX,
                totalFeeSUN,
                isValid: !isNaN(totalFeeSUN) && totalFeeSUN >= 0
            };
            
            console.log('✅ Auto-validation complete:', {
                recipients: recipientCount,
                totalFeeTRX,
                valid: txData.calculatedFees.isValid
            });
            
            return txData.calculatedFees.isValid;
            
        } catch (error) {
            console.error('Auto-validation error:', error);
            return false;
        }
    },
    
    /**
     * Silently test if transaction will succeed
     */
    async quickSimulation(contractCall) {
        try {
            // Try a quick simulation without actually sending
            await contractCall.call({
                from: window.tronWeb.defaultAddress.base58
            });
            return { success: true, error: null };
        } catch (error) {
            return { 
                success: false, 
                error: error.message || 'Simulation failed'
            };
        }
    },
    
    /**
     * Automatically handle energy requirements
     */
    async handleEnergyAutomatically(energyNeeded) {
        console.log(`⚡ Auto-handling energy requirement: ${energyNeeded}`);
        
        try {
            // Check current energy
            const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
            const currentEnergy = account.energy || 0;
            
            if (currentEnergy >= energyNeeded) {
                console.log('✅ Sufficient energy available');
                return { success: true, method: 'existing' };
            }
            
            // Need to rent energy - do it automatically
            if (window.EnergyRental) {
                console.log('🔄 Auto-renting energy...');
                const result = await window.EnergyRental.rentFromJustLend(
                    energyNeeded - currentEnergy,
                    window.tronWeb.defaultAddress.base58
                );
                
                if (result.success) {
                    console.log('✅ Energy rented successfully');
                    return { success: true, method: 'rented' };
                }
            }
            
            // Fallback to burning TRX
            console.log('⚠️ Will burn TRX for energy');
            return { success: true, method: 'burn' };
            
        } catch (error) {
            console.error('Energy handling error:', error);
            // Continue anyway - will burn TRX
            return { success: true, method: 'burn' };
        }
    }
};

// Override transaction staging with automatic preflight
if (window.TransactionStaging) {
    const originalExecute = window.TransactionStaging.executeTransaction;
    
    window.TransactionStaging.executeTransaction = async function(transactionId, skipSimulation = false) {
        console.log('🤖 Automatic preflight running...');
        
        try {
            // Get transaction data
            const stagedData = await this.getTransaction(transactionId);
            if (!stagedData.success) {
                throw new Error('Failed to retrieve staged transaction');
            }
            
            const txData = stagedData.completeData;
            
            // Step 1: Auto-validate and fix data
            const isValid = await window.AutomaticPreflightSystem.validateAndPrepareTransaction(txData);
            
            if (!isValid) {
                console.error('Transaction data cannot be auto-fixed');
                throw new Error('Invalid transaction data - cannot proceed');
            }
            
            // Step 2: Build contract call for simulation
            const recipients = txData.recipients;
            const data = txData.data;
            const notice = txData.notice;
            
            let contractCall;
            if (recipients.length > 1) {
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
            
            // Step 3: Quick simulation
            const simResult = await window.AutomaticPreflightSystem.quickSimulation(contractCall);
            
            if (!simResult.success) {
                console.error('❌ Transaction will fail:', simResult.error);
                
                // Check if it's an energy issue
                if (simResult.error.includes('energy') || simResult.error.includes('bandwidth')) {
                    console.log('Proceeding anyway - energy issue will be handled');
                } else {
                    // Critical error - don't waste TRX
                    throw new Error(`Transaction will fail: ${simResult.error}`);
                }
            }
            
            // Step 4: Estimate energy needs
            let energyNeeded = 400000; // Default
            try {
                if (window.TransactionEstimator) {
                    const estimation = await window.TransactionEstimator.estimateTransactionEnergy(contractCall);
                    energyNeeded = estimation.estimatedEnergy || 400000;
                }
            } catch (e) {
                console.log('Using default energy estimate');
            }
            
            // Step 5: Auto-handle energy
            await window.AutomaticPreflightSystem.handleEnergyAutomatically(energyNeeded);
            
            // Step 6: Proceed with transaction - but skip the original simulation
            console.log('✅ Automatic preflight complete - proceeding with transaction');
            
            // Call original with skipSimulation=true since we already did it
            return await originalExecute.call(this, transactionId, true);
            
        } catch (error) {
            console.error('Automatic preflight failed:', error);
            throw error;
        }
    };
}

// Override energy rental to be automatic
if (window.EnergyRental) {
    const originalRentFromJustLend = window.EnergyRental.rentFromJustLend;
    
    window.EnergyRental.rentFromJustLend = async function(energyNeeded, userAddress) {
        console.log('🤖 Auto-processing energy rental...');
        
        // Just do it - no prompts
        try {
            const result = await originalRentFromJustLend.call(this, energyNeeded, userAddress);
            if (!result.success) {
                console.warn('Energy rental failed, will burn TRX instead');
            }
            return result;
        } catch (error) {
            console.error('Energy rental error:', error);
            return {
                success: false,
                error: error.message,
                skipped: true
            };
        }
    };
}

// Intercept and fix contract sends automatically
const interceptContractSend = () => {
    if (!window.legalContract) return;
    
    ['serveNotice', 'serveNoticeBatch'].forEach(methodName => {
        if (!window.legalContract[methodName]) return;
        
        const original = window.legalContract[methodName];
        window.legalContract[methodName] = function(...args) {
            const result = original.apply(this, args);
            
            // Intercept the send method
            const originalSend = result.send;
            result.send = async function(options) {
                // Auto-fix callValue if needed
                if (isNaN(options.callValue) || options.callValue < 0) {
                    console.warn('Auto-fixing invalid callValue');
                    
                    // Calculate correct fee
                    let correctFee = 25 * 1_000_000; // Default 25 TRX in SUN
                    
                    if (methodName === 'serveNoticeBatch') {
                        const batchSize = args[0]?.length || 1;
                        const sponsorFees = args[0]?.[0]?.[8] || false;
                        correctFee = (25 + (sponsorFees ? 10 * batchSize : 0)) * 1_000_000;
                    } else {
                        const sponsorFees = args[8] || false;
                        correctFee = (25 + (sponsorFees ? 10 : 0)) * 1_000_000;
                    }
                    
                    options.callValue = correctFee;
                    console.log(`Set callValue to ${correctFee} SUN`);
                }
                
                return await originalSend.call(this, options);
            };
            
            return result;
        };
    });
};

// Apply interception when contract is ready
const waitForContract = setInterval(() => {
    if (window.legalContract) {
        interceptContractSend();
        clearInterval(waitForContract);
        console.log('✅ Contract methods intercepted for auto-fixing');
    }
}, 100);

// Also intercept transaction estimator to remove prompts
if (window.TransactionEstimator) {
    window.TransactionEstimator.showEnergyOptionsDialog = function(estimation, callback) {
        console.log('🤖 Auto-selecting energy option: rent');
        // Always choose rent automatically
        setTimeout(() => callback('rent'), 0);
    };
}

console.log('✅ Automatic Preflight System loaded!');
console.log('   - Runs silently without user interaction');
console.log('   - Auto-fixes data type issues');
console.log('   - Auto-handles energy rental');
console.log('   - Only blocks if transaction will definitely fail');