/**
 * FIX ENERGY RENTAL USAGE
 * Ensures rented energy is actually applied to transactions
 */

console.log('🔧 Fixing energy rental usage issue...');

// The problem: You rented 88 TRX worth of energy but it's not being used
// The transaction still wants to burn your TRX instead of using rented energy

window.EnergyRentalFix = {
    
    // Check actual energy after rental
    async verifyRentalSuccess() {
        console.log('🔍 Verifying energy rental...');
        
        try {
            const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
            
            // Check different energy types
            const freeEnergy = account.free_net_limit || 0;
            const energy = account.energy || 0;
            const frozenEnergy = account.frozen_supply_balance || 0;
            
            console.log('📊 Energy Status:');
            console.log(`  Regular Energy: ${energy.toLocaleString()}`);
            console.log(`  Free Energy: ${freeEnergy.toLocaleString()}`);
            console.log(`  Frozen Energy: ${frozenEnergy.toLocaleString()}`);
            
            // Check if we have DELEGATED energy (from rental)
            const resources = await window.tronWeb.trx.getAccountResources(window.tronWeb.defaultAddress.base58);
            
            console.log('📊 Resource Details:', resources);
            
            if (resources.EnergyLimit) {
                console.log(`  Total Energy Limit: ${resources.EnergyLimit.toLocaleString()}`);
            }
            if (resources.EnergyUsed) {
                console.log(`  Energy Used: ${resources.EnergyUsed.toLocaleString()}`);
            }
            if (resources.DelegatedEnergyLimit) {
                console.log(`  ✅ DELEGATED Energy (from rental): ${resources.DelegatedEnergyLimit.toLocaleString()}`);
            }
            
            const totalAvailable = (resources.EnergyLimit || 0) - (resources.EnergyUsed || 0);
            console.log(`  📊 Total Available Energy: ${totalAvailable.toLocaleString()}`);
            
            return {
                available: totalAvailable,
                delegated: resources.DelegatedEnergyLimit || 0,
                used: resources.EnergyUsed || 0
            };
            
        } catch (error) {
            console.error('Error checking energy:', error);
            return { available: 0, delegated: 0, used: 0 };
        }
    },
    
    // Rent energy with proper parameters
    async rentEnergyProperly(recipientAddress) {
        console.log('⚡ Renting energy with proper delegation...');
        
        try {
            // JustLend V2 contract address (mainnet)
            const JUSTLEND_V2 = 'TXbA1feywp4zuyVAkCNj1n5lXBLuGcSkVd';
            
            // Get the contract
            const justLend = await window.tronWeb.contract().at(JUSTLEND_V2);
            
            // Energy rental parameters
            const energyAmount = 100000; // Amount of energy to rent (in units)
            const duration = 3; // Duration in days
            const price = 88 * 1_000_000; // 88 TRX in SUN
            
            console.log('📝 Rental parameters:');
            console.log(`  Recipient: ${recipientAddress}`);
            console.log(`  Energy: ${energyAmount.toLocaleString()}`);
            console.log(`  Duration: ${duration} days`);
            console.log(`  Cost: 88 TRX`);
            
            // Call the proper rental function
            const result = await justLend.rentEnergy(
                recipientAddress, // Who gets the energy
                energyAmount,     // How much energy
                duration          // For how long
            ).send({
                callValue: price,
                feeLimit: 100_000_000,
                shouldPollResponse: true
            });
            
            console.log('✅ Energy rental transaction:', result);
            
            // Wait for delegation to take effect
            console.log('⏳ Waiting for delegation to activate...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Verify the rental worked
            const status = await this.verifyRentalSuccess();
            
            if (status.delegated > 0) {
                console.log(`✅ SUCCESS! You now have ${status.delegated.toLocaleString()} delegated energy`);
            } else {
                console.warn('⚠️ Delegation not showing yet, but transaction was successful');
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Energy rental failed:', error);
            throw error;
        }
    },
    
    // Alternative: Use TronWeb's delegate resource function
    async rentUsingDelegation() {
        console.log('⚡ Attempting delegation-based rental...');
        
        try {
            const receiverAddress = window.tronWeb.defaultAddress.base58;
            const energyAmount = 3200000; // 3.2M energy
            const duration = 3 * 86400000; // 3 days in milliseconds
            
            // This delegates energy to yourself
            const result = await window.tronWeb.transactionBuilder.delegateResource(
                receiverAddress,
                energyAmount,
                'ENERGY',
                receiverAddress, // Delegate to yourself
                false, // Not locked
                duration
            );
            
            const signedTx = await window.tronWeb.trx.sign(result);
            const broadcast = await window.tronWeb.trx.sendRawTransaction(signedTx);
            
            console.log('✅ Delegation result:', broadcast);
            
            return broadcast;
            
        } catch (error) {
            console.error('Delegation failed:', error);
            return null;
        }
    },
    
    // Fix transaction to use available energy
    async executeWithRentedEnergy(transactionFunction, params) {
        console.log('🚀 Executing transaction with rented energy...');
        
        // First check our energy status
        const energyStatus = await this.verifyRentalSuccess();
        
        console.log(`📊 Available energy: ${energyStatus.available.toLocaleString()}`);
        
        if (energyStatus.available < 2400000) {
            console.warn('⚠️ Insufficient energy even after rental!');
            console.log('The rental may not have been properly delegated to your address');
            
            // Try to help diagnose
            console.log('Possible issues:');
            console.log('1. Energy was rented but not delegated to your address');
            console.log('2. Energy rental contract used was incorrect');
            console.log('3. Need to wait longer for delegation to activate');
            
            if (!confirm('Energy seems insufficient. Continue anyway?')) {
                throw new Error('Transaction cancelled - insufficient energy');
            }
        }
        
        // Execute the transaction with proper fee limit
        try {
            console.log('📤 Sending transaction...');
            
            // Set a higher fee limit to ensure we can use the energy
            const result = await transactionFunction({
                ...params,
                feeLimit: 500_000_000, // 500 TRX max fee limit
                shouldPollResponse: true
            });
            
            console.log('✅ Transaction successful:', result);
            return result;
            
        } catch (error) {
            console.error('❌ Transaction failed:', error);
            
            // Check if it's an energy issue
            if (error.message?.includes('energy') || error.message?.includes('bandwidth')) {
                console.error('This is an energy/bandwidth issue');
                console.log('Solutions:');
                console.log('1. Freeze TRX for energy: ~100 TRX frozen = 1.5M energy');
                console.log('2. Use energy rental from energy.tronpulse.io');
                console.log('3. Wait and try during low network usage times');
            }
            
            throw error;
        }
    }
};

// Add diagnostic button to check energy status
(function() {
    console.log('Adding energy diagnostic tools...');
    
    // Create floating diagnostic button
    const diagButton = document.createElement('button');
    diagButton.innerHTML = '⚡ Check Energy';
    diagButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        z-index: 10000;
        font-weight: bold;
    `;
    
    diagButton.onclick = async () => {
        const status = await EnergyRentalFix.verifyRentalSuccess();
        
        const message = `
Energy Status:
- Available: ${status.available.toLocaleString()}
- Delegated: ${status.delegated.toLocaleString()}
- Used: ${status.used.toLocaleString()}

Need 2.4M for your transaction
${status.available >= 2400000 ? '✅ Sufficient energy!' : '❌ Insufficient energy!'}
        `;
        
        alert(message);
    };
    
    document.body.appendChild(diagButton);
})();

// Override transaction functions to check energy first
if (window.legalContract) {
    const originalServeNotice = window.legalContract.serveNotice;
    
    window.legalContract.serveNotice = function(...args) {
        console.log('🔍 Checking energy before transaction...');
        
        // Check energy first
        EnergyRentalFix.verifyRentalSuccess().then(status => {
            if (status.available < 2400000) {
                console.warn(`⚠️ Low energy! Only ${status.available.toLocaleString()} available`);
            }
        });
        
        // Continue with original function
        return originalServeNotice.apply(this, args);
    };
}

console.log('✅ Energy rental fix loaded');
console.log('Click the "⚡ Check Energy" button to see your energy status');