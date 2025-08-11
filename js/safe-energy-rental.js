/**
 * Safe Energy Rental System
 * Prevents energy rental when transaction will fail
 */

console.log('🛡️ Loading Safe Energy Rental System...');

// Store original rental function
if (window.EnergyRental) {
    const originalRentFromJustLend = window.EnergyRental.rentFromJustLend;
    const originalPrepareEnergy = window.EnergyRental.prepareEnergyForTransaction;
    
    // Override JustLend rental
    window.EnergyRental.rentFromJustLend = async function(energyNeeded, userAddress) {
        console.log('🔒 Safe Energy Rental: Validating before JustLend rental...');
        
        // Check if we have current transaction data
        if (window.currentTransactionData) {
            // Quick validation of critical fields
            const data = window.currentTransactionData.data;
            
            // Check for NaN fees
            const creationFee = parseFloat(data?.creationFee);
            const sponsorshipFee = parseFloat(data?.sponsorshipFee);
            
            if (isNaN(creationFee) || isNaN(sponsorshipFee)) {
                console.error('❌ BLOCKING ENERGY RENTAL: Invalid fee values detected!');
                console.error('Creation fee:', data?.creationFee, '-> parsed:', creationFee);
                console.error('Sponsorship fee:', data?.sponsorshipFee, '-> parsed:', sponsorshipFee);
                
                alert('⚠️ Transaction has invalid fee values. Energy rental blocked to prevent wasting TRX.\n\nPlease refresh the page and try again.');
                
                return {
                    success: false,
                    error: 'Invalid fee values - rental blocked',
                    txId: null
                };
            }
            
            // Calculate total fee to check for NaN
            const recipients = window.currentTransactionData.recipients || [];
            const sponsorFees = data?.sponsorFees || false;
            const totalFeeTRX = creationFee + (sponsorFees ? sponsorshipFee * recipients.length : 0);
            const totalFeeSUN = totalFeeTRX * 1_000_000;
            
            if (isNaN(totalFeeSUN) || totalFeeSUN < 0) {
                console.error('❌ BLOCKING ENERGY RENTAL: Invalid total fee calculation!');
                console.error('Total fee would be NaN or negative:', totalFeeSUN);
                
                alert('⚠️ Transaction fee calculation is invalid. Energy rental blocked.\n\nThis would cause "Invalid callValue" error.');
                
                return {
                    success: false,
                    error: 'Invalid fee calculation - rental blocked',
                    txId: null
                };
            }
            
            console.log('✅ Fee validation passed:', {
                creationFee,
                sponsorshipFee,
                totalFeeTRX,
                totalFeeSUN
            });
        }
        
        // Proceed with original rental
        return await originalRentFromJustLend.call(this, energyNeeded, userAddress);
    };
    
    // Override prepare energy function
    window.EnergyRental.prepareEnergyForTransaction = async function(energyNeeded, userAddress) {
        console.log('🔒 Safe Energy Rental: Pre-validation check...');
        
        // Quick sanity checks
        if (!energyNeeded || isNaN(energyNeeded) || energyNeeded < 0) {
            console.error('❌ Invalid energy amount requested:', energyNeeded);
            return {
                success: false,
                error: 'Invalid energy amount',
                skipped: true
            };
        }
        
        // Check if transaction data exists and is valid
        if (window.currentTransactionData) {
            const quickCheck = validateTransactionQuick(window.currentTransactionData);
            if (!quickCheck.valid) {
                console.error('❌ Transaction validation failed - blocking energy rental');
                console.error('Errors:', quickCheck.errors);
                
                const shouldProceed = confirm(
                    '⚠️ WARNING: Transaction may fail!\n\n' +
                    quickCheck.errors.join('\n') +
                    '\n\nDo you still want to rent energy? (Not recommended)'
                );
                
                if (!shouldProceed) {
                    return {
                        success: false,
                        error: 'Transaction validation failed',
                        skipped: true
                    };
                }
            }
        }
        
        return await originalPrepareEnergy.call(this, energyNeeded, userAddress);
    };
}

// Quick validation function
function validateTransactionQuick(txData) {
    const errors = [];
    
    try {
        // Check data exists
        if (!txData.data) {
            errors.push('Missing transaction data');
            return { valid: false, errors };
        }
        
        // Check fees are valid numbers
        const creationFee = parseFloat(txData.data.creationFee);
        const sponsorshipFee = parseFloat(txData.data.sponsorshipFee);
        
        if (isNaN(creationFee)) {
            errors.push(`Invalid creation fee: ${txData.data.creationFee}`);
        }
        
        if (isNaN(sponsorshipFee)) {
            errors.push(`Invalid sponsorship fee: ${txData.data.sponsorshipFee}`);
        }
        
        // Check recipients
        if (!txData.recipients || !Array.isArray(txData.recipients) || txData.recipients.length === 0) {
            errors.push('No recipients specified');
        }
        
        // Check case number (required)
        if (!txData.notice?.case_number) {
            errors.push('Missing case number');
        }
        
    } catch (error) {
        errors.push('Validation error: ' + error.message);
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

// Also add a global check before any contract send
const originalSend = window.tronWeb?.contract?.send;
if (originalSend) {
    window.tronWeb.contract.send = function(options) {
        // Check for NaN callValue
        if (options && (isNaN(options.callValue) || options.callValue < 0)) {
            console.error('❌ BLOCKING TRANSACTION: Invalid callValue detected!');
            console.error('CallValue:', options.callValue);
            
            alert('⚠️ Transaction blocked: Invalid fee value (NaN or negative).\n\nThis would waste your energy rental.');
            
            throw new Error('Invalid callValue - transaction blocked to prevent waste');
        }
        
        return originalSend.call(this, options);
    };
}

console.log('✅ Safe Energy Rental System loaded!');
console.log('   - Validates fees before allowing energy rental');
console.log('   - Blocks rentals when transaction will fail');
console.log('   - Prevents wasting TRX on doomed transactions');