/**
 * ENERGY RENTAL OVERRIDE
 * Fixes the issue where system adds unwanted buffers to energy rental
 * Forces exact amount user specifies
 */

console.log('🔧 Loading Energy Rental Override...');

// Store original function
if (window.StreamlinedEnergyFlow && window.StreamlinedEnergyFlow.proceedToRental) {
    window.originalProceedToRental = window.StreamlinedEnergyFlow.proceedToRental;
}

// Override the rental function to respect user input
window.forceExactEnergyRental = async function(exactAmount) {
    console.log(`⚡ FORCING EXACT RENTAL: ${exactAmount.toLocaleString()} energy`);
    console.log('  NO buffers will be added!');
    
    try {
        // Get current energy
        const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
        const currentEnergy = account.energy || 0;
        
        console.log(`📊 Current energy: ${currentEnergy.toLocaleString()}`);
        console.log(`📊 Requesting exactly: ${exactAmount.toLocaleString()}`);
        
        // Calculate exact deficit (no buffer)
        const deficit = Math.max(0, exactAmount - currentEnergy);
        
        if (deficit === 0) {
            console.log('✅ Already have enough energy!');
            return { success: true, message: 'Sufficient energy' };
        }
        
        console.log(`📊 Exact deficit: ${deficit.toLocaleString()} energy`);
        
        // Get pricing for EXACT amount (no buffer)
        const estimate = await window.TronSaveAPI.estimateTRXv2(deficit, 3600, 'MEDIUM');
        
        if (!estimate.success) {
            throw new Error('Failed to get estimate: ' + estimate.error);
        }
        
        console.log(`💰 Cost for ${deficit} energy: ${estimate.estimateTrx / 1000000} TRX`);
        
        // Create order for EXACT amount
        const order = await window.TronSaveAPI.createEnergyOrderV2(
            deficit,  // EXACT amount, no buffer
            3600,     // 1 hour
            'MEDIUM'
        );
        
        if (!order.success) {
            throw new Error('Failed to create order: ' + order.error);
        }
        
        console.log('✅ Energy rental successful (exact amount)!');
        return { success: true, txId: order.txId };
        
    } catch (error) {
        console.error('Energy rental failed:', error);
        return { success: false, error: error.message };
    }
};

// Override the UI input handler to prevent buffer addition
if (window.StreamlinedEnergyFlow) {
    // Replace the proceedToRental function
    window.StreamlinedEnergyFlow.proceedToRental = async function() {
        console.log('🔌 Using override - no buffers added!');
        
        const userInput = document.getElementById('energyAmountInput');
        const userAmount = userInput ? parseInt(userInput.value) : 3500000;
        
        console.log(`User requested: ${userAmount.toLocaleString()} energy`);
        console.log('NO BUFFERS WILL BE ADDED');
        
        // Use exact amount
        return await forceExactEnergyRental(userAmount);
    };
    
    // Also override the direct rental function
    window.StreamlinedEnergyFlow.rentExactEnergy = async function(amount) {
        console.log(`📍 Renting EXACTLY ${amount} energy (no buffers)`);
        return await forceExactEnergyRental(amount);
    };
}

// Add UI helper to set exact amount
window.setExactEnergyAmount = function(amount) {
    const input = document.getElementById('energyAmountInput');
    if (input) {
        input.value = amount;
        console.log(`✅ Set exact amount: ${amount.toLocaleString()}`);
        console.log('This amount will be rented WITHOUT any buffers');
    }
};

// Add console helper
window.rentExactEnergy = async function(amount) {
    console.log(`🎯 Renting exactly ${amount} energy...`);
    return await forceExactEnergyRental(amount);
};

console.log('✅ Energy Rental Override loaded');
console.log('');
console.log('📝 Usage:');
console.log('  rentExactEnergy(3500000) - Rent exactly 3.5M energy');
console.log('  setExactEnergyAmount(3500000) - Set UI to exact amount');
console.log('');
console.log('NO MORE UNWANTED BUFFERS!');