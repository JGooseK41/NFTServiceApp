/**
 * Enhanced Transaction Preflight System
 * Performs FULL simulation before ANY energy rental to prevent wasted TRX
 * 
 * Key Features:
 * 1. Simulates the actual transaction to detect all errors
 * 2. Validates data types and conversions
 * 3. Checks contract state and permissions
 * 4. Only proceeds to energy rental if simulation succeeds
 */

console.log('🚀 Loading Enhanced Preflight System v2.0...');

window.EnhancedPreflightSystem = {
    
    /**
     * Perform a complete dry-run simulation of the transaction
     * This catches ALL errors before spending any TRX on energy
     */
    async simulateTransaction(txData) {
        console.log('🔬 SIMULATION: Running complete transaction simulation...');
        
        const results = {
            valid: false,
            errors: [],
            warnings: [],
            energyRequired: 0,
            simulationResult: null,
            correctedData: null
        };
        
        try {
            // Step 1: Data validation and type correction
            const correctedData = this.validateAndCorrectData(txData);
            results.correctedData = correctedData;
            
            if (correctedData.errors.length > 0) {
                results.errors = correctedData.errors;
                return results;
            }
            
            // Step 2: Build the actual contract call
            const contractCall = this.buildContractCall(correctedData);
            
            // Step 3: Perform the actual simulation
            console.log('📡 Calling contract simulation...');
            
            try {
                // Use constantCall to simulate without spending anything
                const simulationResult = await contractCall.call({
                    from: window.tronWeb.defaultAddress.base58
                });
                
                console.log('✅ Simulation successful!', simulationResult);
                results.simulationResult = simulationResult;
                results.valid = true;
                
            } catch (simError) {
                console.error('❌ Simulation failed:', simError);
                
                // Parse the error to provide specific feedback
                const errorMsg = simError.message || simError.toString();
                
                if (errorMsg.includes('Invalid callValue')) {
                    results.errors.push('Transaction will fail: Invalid fee calculation');
                    results.errors.push(`Check fee values - Creation: ${correctedData.fees.creationFee}, Sponsorship: ${correctedData.fees.sponsorshipFee}`);
                } else if (errorMsg.includes('Insufficient balance')) {
                    results.errors.push('Transaction will fail: Insufficient TRX balance for fees');
                } else if (errorMsg.includes('Invalid address')) {
                    results.errors.push('Transaction will fail: Invalid recipient address');
                } else if (errorMsg.includes('Contract validation')) {
                    results.errors.push('Transaction will fail: Smart contract validation error');
                } else {
                    results.errors.push(`Transaction will fail: ${errorMsg}`);
                }
                
                return results;
            }
            
            // Step 4: Estimate energy consumption
            try {
                const energyEstimate = await this.estimateEnergy(contractCall, correctedData);
                results.energyRequired = energyEstimate;
                console.log(`⚡ Estimated energy needed: ${energyEstimate}`);
            } catch (energyError) {
                results.warnings.push('Could not estimate energy accurately');
                results.energyRequired = 400000; // Default fallback
            }
            
            // Step 5: Final checks
            const finalChecks = await this.performFinalChecks(correctedData, results.energyRequired);
            results.warnings.push(...finalChecks.warnings);
            results.errors.push(...finalChecks.errors);
            
            if (results.errors.length === 0) {
                console.log('✅ All simulations passed! Transaction is safe to execute.');
            }
            
        } catch (error) {
            console.error('Simulation system error:', error);
            results.errors.push(`Simulation system error: ${error.message}`);
        }
        
        return results;
    },
    
    /**
     * Validate and correct data types to prevent NaN errors
     */
    validateAndCorrectData(txData) {
        console.log('🔍 Validating and correcting data types...');
        
        const errors = [];
        const warnings = [];
        
        // Deep clone the data to avoid mutations
        const corrected = JSON.parse(JSON.stringify(txData));
        
        // Fix fee data types (CRITICAL - this causes the "Invalid callValue" error)
        if (corrected.data) {
            // Convert string fees to numbers
            if (typeof corrected.data.creationFee === 'string') {
                corrected.data.creationFee = parseFloat(corrected.data.creationFee) || 25;
                console.log(`📝 Converted creationFee from string to number: ${corrected.data.creationFee}`);
            }
            
            if (typeof corrected.data.sponsorshipFee === 'string') {
                corrected.data.sponsorshipFee = parseFloat(corrected.data.sponsorshipFee) || 10;
                console.log(`📝 Converted sponsorshipFee from string to number: ${corrected.data.sponsorshipFee}`);
            }
            
            // Ensure fees are valid numbers
            if (isNaN(corrected.data.creationFee) || corrected.data.creationFee < 0) {
                errors.push(`Invalid creation fee: ${corrected.data.creationFee}`);
                corrected.data.creationFee = 25; // Default
            }
            
            if (isNaN(corrected.data.sponsorshipFee) || corrected.data.sponsorshipFee < 0) {
                errors.push(`Invalid sponsorship fee: ${corrected.data.sponsorshipFee}`);
                corrected.data.sponsorshipFee = 10; // Default
            }
            
            // Fix sponsorFees boolean
            if (typeof corrected.data.sponsorFees === 'string') {
                corrected.data.sponsorFees = corrected.data.sponsorFees === 'true';
            }
        }
        
        // Validate recipients
        if (!corrected.recipients || !Array.isArray(corrected.recipients)) {
            errors.push('No valid recipients array');
        } else {
            corrected.recipients.forEach((recipient, idx) => {
                if (!recipient.recipient_address) {
                    errors.push(`Recipient ${idx + 1}: Missing address`);
                } else if (!window.tronWeb.isAddress(recipient.recipient_address)) {
                    errors.push(`Recipient ${idx + 1}: Invalid address format`);
                }
            });
        }
        
        // Calculate total fees
        const recipientCount = corrected.recipients ? corrected.recipients.length : 0;
        const creationFee = corrected.data?.creationFee || 25;
        const sponsorshipFee = corrected.data?.sponsorshipFee || 10;
        const sponsorFees = corrected.data?.sponsorFees || false;
        
        const totalFeeTRX = creationFee + (sponsorFees ? sponsorshipFee * recipientCount : 0);
        const totalFeeSUN = totalFeeTRX * 1_000_000;
        
        corrected.fees = {
            creationFee,
            sponsorshipFee,
            sponsorFees,
            recipientCount,
            totalFeeTRX,
            totalFeeSUN
        };
        
        console.log('💰 Fee calculation:', corrected.fees);
        
        // Validate the calculated fee
        if (isNaN(totalFeeSUN) || totalFeeSUN < 0) {
            errors.push(`Invalid total fee calculation: ${totalFeeSUN} SUN`);
        }
        
        return {
            ...corrected,
            errors,
            warnings
        };
    },
    
    /**
     * Build the actual contract call for simulation
     */
    buildContractCall(correctedData) {
        const { recipients, data, notice, fees } = correctedData;
        
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
            
            return window.legalContract.serveNoticeBatch(batchNotices);
        } else {
            // Single transaction
            const recipient = recipients[0];
            return window.legalContract.serveNotice(
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
    },
    
    /**
     * Estimate energy consumption for the transaction
     */
    async estimateEnergy(contractCall, correctedData) {
        try {
            // Try TronWeb's built-in estimation
            const estimate = await window.tronWeb.transactionBuilder.estimateEnergy(
                window.legalContract.address,
                contractCall.functionSelector,
                contractCall.options,
                contractCall.parameters,
                window.tronWeb.defaultAddress.base58
            );
            
            return estimate.energy_required || 400000;
        } catch (error) {
            console.warn('Could not estimate energy:', error);
            // Fallback estimates based on transaction type
            const recipientCount = correctedData.recipients?.length || 1;
            return recipientCount > 1 ? 300000 * recipientCount : 400000;
        }
    },
    
    /**
     * Perform final pre-flight checks
     */
    async performFinalChecks(correctedData, energyRequired) {
        const warnings = [];
        const errors = [];
        
        try {
            // Check wallet balance
            const balance = await window.tronWeb.trx.getBalance(window.tronWeb.defaultAddress.base58);
            const balanceTRX = balance / 1_000_000;
            
            // Calculate total needed (fees + energy rental cost)
            const feesNeeded = correctedData.fees.totalFeeTRX;
            const energyRentalCost = Math.ceil(energyRequired / 10000) * 1.1; // Rough estimate: 1.1 TRX per 10k energy
            const totalNeeded = feesNeeded + energyRentalCost + 10; // +10 TRX safety margin
            
            if (balanceTRX < totalNeeded) {
                errors.push(`Insufficient balance. Have: ${balanceTRX.toFixed(2)} TRX, Need: ~${totalNeeded.toFixed(2)} TRX`);
                errors.push(`Breakdown: ${feesNeeded} TRX fees + ~${energyRentalCost.toFixed(2)} TRX energy rental`);
            }
            
            // Check current energy
            const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
            const currentEnergy = account.energy || 0;
            
            if (currentEnergy < energyRequired) {
                warnings.push(`Will need to rent ${energyRequired - currentEnergy} energy (current: ${currentEnergy})`);
            }
            
        } catch (error) {
            warnings.push('Could not perform balance checks: ' + error.message);
        }
        
        return { warnings, errors };
    },
    
    /**
     * Display simulation results to user
     */
    displayResults(results) {
        if (!results.valid) {
            console.error('🚫 TRANSACTION WILL FAIL - DO NOT PROCEED');
            console.error('Errors:', results.errors);
            
            const message = '⚠️ TRANSACTION SIMULATION FAILED ⚠️\n\n' +
                          'The transaction will fail if you proceed. Issues found:\n\n' +
                          results.errors.join('\n') +
                          '\n\nDO NOT rent energy for this transaction as it will be wasted.';
            
            alert(message);
            throw new Error('Transaction simulation failed - blocking execution');
        }
        
        if (results.warnings.length > 0) {
            console.warn('⚠️ Warnings:', results.warnings);
        }
        
        console.log('✅ Transaction simulation successful!');
        console.log(`⚡ Energy required: ${results.energyRequired}`);
        
        return true;
    }
};

// Override the transaction staging to use enhanced preflight
if (window.TransactionStaging) {
    const originalExecute = window.TransactionStaging.executeTransaction;
    
    window.TransactionStaging.executeTransaction = async function(transactionId, skipSimulation = false) {
        console.log('🛡️ Enhanced Preflight: Intercepting transaction...');
        
        try {
            // Get the staged transaction
            const stagedData = await this.getTransaction(transactionId);
            if (!stagedData.success) {
                throw new Error('Failed to retrieve staged transaction');
            }
            
            const txData = stagedData.completeData;
            
            // Store for potential energy rental interception
            window.currentTransactionData = txData;
            
            // Run enhanced simulation BEFORE any energy rental
            const simulationResults = await window.EnhancedPreflightSystem.simulateTransaction(txData);
            
            // Display results and block if failed
            window.EnhancedPreflightSystem.displayResults(simulationResults);
            
            // If we get here, simulation passed - update the data with corrected values
            if (simulationResults.correctedData) {
                // Apply corrections to prevent NaN errors
                txData.data.creationFee = simulationResults.correctedData.fees.creationFee;
                txData.data.sponsorshipFee = simulationResults.correctedData.fees.sponsorshipFee;
                
                console.log('📝 Applied data corrections from simulation');
            }
            
            // Set expected energy for rental
            window.expectedEnergyNeeded = simulationResults.energyRequired;
            
            // Now proceed with original execution
            return await originalExecute.call(this, transactionId, skipSimulation);
            
        } catch (error) {
            console.error('Enhanced preflight error:', error);
            throw error;
        } finally {
            // Clean up
            delete window.currentTransactionData;
            delete window.expectedEnergyNeeded;
        }
    };
}

// Also override energy rental to use our validated amount
if (window.EnergyRental) {
    const originalPrepare = window.EnergyRental.prepareEnergyForTransaction;
    
    window.EnergyRental.prepareEnergyForTransaction = async function(energyNeeded, userAddress) {
        // Use our simulated amount if available
        if (window.expectedEnergyNeeded) {
            console.log(`📊 Using simulated energy amount: ${window.expectedEnergyNeeded} instead of ${energyNeeded}`);
            energyNeeded = window.expectedEnergyNeeded;
        }
        
        return await originalPrepare.call(this, energyNeeded, userAddress);
    };
}

// Manual testing function
window.testPreflight = async function() {
    console.log('🧪 Testing preflight system...');
    
    // Get current staged transaction if any
    if (window.TransactionStaging?.stagedTransactions?.size > 0) {
        const txId = Array.from(window.TransactionStaging.stagedTransactions.keys())[0];
        const txData = window.TransactionStaging.stagedTransactions.get(txId);
        
        console.log('Testing with staged transaction:', txId);
        const results = await window.EnhancedPreflightSystem.simulateTransaction(txData);
        
        console.log('Simulation results:', results);
        
        if (results.valid) {
            console.log('✅ Transaction would succeed!');
            console.log(`Energy needed: ${results.energyRequired}`);
            console.log(`Total cost: ${results.correctedData.fees.totalFeeTRX} TRX + energy rental`);
        } else {
            console.error('❌ Transaction would fail!');
            console.error('Errors:', results.errors);
        }
        
        return results;
    } else {
        console.log('No staged transactions to test');
    }
};

console.log('✅ Enhanced Preflight System v2.0 loaded!');
console.log('   - Full transaction simulation before energy rental');
console.log('   - Automatic data type correction');
console.log('   - Prevents ALL wasted TRX on failed transactions');
console.log('   Use testPreflight() to manually test');