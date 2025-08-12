/**
 * Transaction Pre-flight Check System
 * Validates ALL transaction parameters BEFORE renting energy to prevent wasted TRX
 */

console.log('🛡️ Initializing transaction pre-flight check system...');

window.TransactionPreflightCheck = {
    
    /**
     * Perform comprehensive validation before any energy rental or transaction
     */
    async validateBeforeEnergyRental(transactionData) {
        console.log('✈️ PREFLIGHT CHECK: Validating transaction before energy rental...');
        
        const errors = [];
        const warnings = [];
        
        try {
            // 1. Check wallet connection
            if (!window.tronWeb || !window.tronWeb.defaultAddress?.base58) {
                errors.push('❌ No wallet connected');
                return { valid: false, errors, warnings };
            }
            
            const walletAddress = window.tronWeb.defaultAddress.base58;
            console.log('✅ Wallet connected:', walletAddress);
            
            // 2. Check contract connection
            if (!window.legalContract) {
                errors.push('❌ Smart contract not connected');
                return { valid: false, errors, warnings };
            }
            console.log('✅ Contract connected');
            
            // 3. Validate transaction data structure
            if (!transactionData) {
                errors.push('❌ No transaction data provided');
                return { valid: false, errors, warnings };
            }
            
            const { recipients, data, notice } = transactionData;
            
            // 4. Validate recipients
            if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
                errors.push('❌ No recipients specified');
                return { valid: false, errors, warnings };
            }
            
            for (let i = 0; i < recipients.length; i++) {
                const recipient = recipients[i];
                if (!recipient.recipient_address) {
                    errors.push(`❌ Recipient ${i + 1}: Missing address`);
                } else if (!window.tronWeb.isAddress(recipient.recipient_address)) {
                    errors.push(`❌ Recipient ${i + 1}: Invalid address format: ${recipient.recipient_address}`);
                }
            }
            
            if (errors.length === 0) {
                console.log(`✅ ${recipients.length} recipient(s) validated`);
            }
            
            // 5. Validate fees (CRITICAL - this was causing the error)
            const creationFee = data?.creationFee;
            const sponsorshipFee = data?.sponsorshipFee;
            const sponsorFees = data?.sponsorFees || false;
            
            // Check if fees are defined and valid numbers
            if (creationFee === undefined || creationFee === null || isNaN(creationFee)) {
                errors.push(`❌ Invalid creation fee: ${creationFee} (should be a number)`);
                data.creationFee = 25; // Set default
                warnings.push('⚠️ Using default creation fee: 25 TRX');
            }
            
            if (sponsorFees && (sponsorshipFee === undefined || sponsorshipFee === null || isNaN(sponsorshipFee))) {
                errors.push(`❌ Invalid sponsorship fee: ${sponsorshipFee} (should be a number)`);
                data.sponsorshipFee = 10; // Set default
                warnings.push('⚠️ Using default sponsorship fee: 10 TRX per recipient');
            }
            
            // Calculate total fee
            const totalFeeTRX = (data.creationFee || 25) + 
                               (sponsorFees ? (data.sponsorshipFee || 10) * recipients.length : 0);
            const totalFeeSUN = totalFeeTRX * 1_000_000;
            
            if (isNaN(totalFeeSUN) || totalFeeSUN < 0) {
                errors.push(`❌ Invalid total fee calculation: ${totalFeeSUN} SUN`);
            } else {
                console.log(`✅ Fee calculation valid: ${totalFeeTRX} TRX (${totalFeeSUN} SUN)`);
            }
            
            // 6. Check user's TRX balance
            const balance = await window.tronWeb.trx.getBalance(walletAddress);
            const balanceTRX = balance / 1_000_000;
            
            // Need enough for: transaction fee + energy rental cost (typically 88-100 TRX)
            const estimatedEnergyRentalCost = 100; // TRX for energy rental
            const totalNeeded = totalFeeTRX + estimatedEnergyRentalCost;
            
            if (balanceTRX < totalNeeded) {
                errors.push(`❌ Insufficient TRX balance. Have: ${balanceTRX.toFixed(2)} TRX, Need: ~${totalNeeded.toFixed(2)} TRX (${totalFeeTRX} for transaction + ~${estimatedEnergyRentalCost} for energy)`);
            } else {
                console.log(`✅ Sufficient balance: ${balanceTRX.toFixed(2)} TRX (need ~${totalNeeded.toFixed(2)} TRX)`);
            }
            
            // 7. Validate required fields
            if (!notice?.case_number) {
                errors.push('❌ Missing case number');
            }
            
            if (!notice?.issuing_agency) {
                warnings.push('⚠️ Missing issuing agency');
            }
            
            if (!notice?.notice_type) {
                warnings.push('⚠️ Missing notice type');
            }
            
            // 8. Validate IPFS data if present
            if (data?.encryptedIPFS) {
                if (!data.encryptedIPFS.startsWith('Qm') && !data.encryptedIPFS.startsWith('bafy')) {
                    warnings.push('⚠️ IPFS hash format may be invalid');
                }
            }
            
            // 9. Check if we're in the right network
            const nodeUrl = window.tronWeb.fullNode.host;
            if (!nodeUrl.includes('trongrid.io') && !nodeUrl.includes('tronstack.io')) {
                warnings.push(`⚠️ Using non-standard node: ${nodeUrl}`);
            }
            
            // 10. Test contract method availability
            try {
                if (recipients.length > 1) {
                    if (!window.legalContract.serveNoticeBatch) {
                        errors.push('❌ Contract missing serveNoticeBatch method');
                    }
                } else {
                    if (!window.legalContract.serveNotice) {
                        errors.push('❌ Contract missing serveNotice method');
                    }
                }
            } catch (e) {
                errors.push('❌ Cannot verify contract methods: ' + e.message);
            }
            
            // 11. Build the transaction parameters for final validation
            const txParams = {
                feeLimit: 2000_000_000,
                callValue: totalFeeSUN,
                shouldPollResponse: true
            };
            
            if (isNaN(txParams.callValue)) {
                errors.push('❌ CallValue is NaN - transaction will fail!');
            }
            
            // Return validation result
            const isValid = errors.length === 0;
            
            return {
                valid: isValid,
                errors,
                warnings,
                summary: {
                    recipients: recipients.length,
                    totalFeeTRX,
                    totalFeeSUN,
                    balanceTRX,
                    estimatedTotalCost: totalNeeded,
                    txParams
                }
            };
            
        } catch (error) {
            console.error('Preflight check error:', error);
            errors.push('❌ Preflight check failed: ' + error.message);
            return { valid: false, errors, warnings };
        }
    },
    
    /**
     * Show validation results to user
     */
    showValidationResults(validation) {
        if (!validation.valid) {
            console.error('🚫 TRANSACTION BLOCKED - VALIDATION FAILED');
            console.error('Errors found:', validation.errors);
            
            // Show alert to user
            const errorMsg = 'Transaction validation failed:\n\n' + 
                           validation.errors.join('\n') + 
                           (validation.warnings.length > 0 ? '\n\nWarnings:\n' + validation.warnings.join('\n') : '');
            
            alert(errorMsg);
            
            // Throw error to stop execution
            throw new Error('Transaction validation failed. Not proceeding with energy rental.');
        }
        
        if (validation.warnings.length > 0) {
            console.warn('⚠️ Validation warnings:', validation.warnings);
        }
        
        console.log('✅ All preflight checks passed!');
        console.log('Summary:', validation.summary);
        
        return true;
    }
};

// Override the transaction execution to include preflight check
if (window.TransactionStaging) {
    const originalExecute = window.TransactionStaging.executeTransaction;
    
    window.TransactionStaging.executeTransaction = async function(transactionId, skipSimulation = false) {
        console.log('🛡️ Running preflight check before transaction...');
        
        // Get the staged transaction
        const stagedTx = this.stagedTransactions.get(transactionId);
        if (!stagedTx) {
            throw new Error('Transaction not found: ' + transactionId);
        }
        
        // Run preflight check BEFORE any energy rental
        const validation = await window.TransactionPreflightCheck.validateBeforeEnergyRental(stagedTx);
        
        // Block transaction if validation fails
        if (!validation.valid) {
            window.TransactionPreflightCheck.showValidationResults(validation);
            // This will throw an error and stop execution
        }
        
        // Only proceed if validation passed
        console.log('✅ Preflight check passed, proceeding with transaction...');
        return await originalExecute.call(this, transactionId, skipSimulation);
    };
}

// Also intercept energy rental directly
if (window.EnergyRentalService) {
    const originalRentEnergy = window.EnergyRentalService.rentEnergy;
    
    window.EnergyRentalService.rentEnergy = async function(amount, options) {
        console.log('🛡️ Intercepting energy rental for validation...');
        
        // Check if we're in a transaction context
        if (window.currentTransactionData) {
            const validation = await window.TransactionPreflightCheck.validateBeforeEnergyRental(window.currentTransactionData);
            
            if (!validation.valid) {
                console.error('🚫 BLOCKING ENERGY RENTAL - Transaction validation failed!');
                window.TransactionPreflightCheck.showValidationResults(validation);
                // This will throw error and stop rental
            }
        }
        
        return await originalRentEnergy.call(this, amount, options);
    };
}

// Manual validation function
window.validateTransaction = async function(txData) {
    const validation = await window.TransactionPreflightCheck.validateBeforeEnergyRental(txData || window.currentTransactionData);
    
    if (validation.valid) {
        console.log('✅ Transaction is valid and ready to proceed');
    } else {
        console.error('❌ Transaction has errors:', validation.errors);
    }
    
    return validation;
};

console.log('✅ Transaction preflight check system loaded!');
console.log('   All transactions will be validated BEFORE energy rental');
console.log('   This prevents wasting TRX on failed transactions');
console.log('   Use validateTransaction() to manually check');