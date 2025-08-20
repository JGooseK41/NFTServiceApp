/**
 * ENERGY RENTAL FIX
 * Handles energy rental delays and verification
 */

window.EnergyRentalFix = {
    
    // Check current energy level
    async checkCurrentEnergy() {
        try {
            const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
            const currentEnergy = account.energy || 0;
            const energyLimit = account.energy_limit || 0;
            
            console.log(`⚡ Current Energy: ${currentEnergy.toLocaleString()}`);
            console.log(`📊 Energy Limit: ${energyLimit.toLocaleString()}`);
            
            return {
                current: currentEnergy,
                limit: energyLimit,
                percentage: energyLimit > 0 ? (currentEnergy / energyLimit * 100).toFixed(1) : 0
            };
        } catch (error) {
            console.error('Error checking energy:', error);
            return { current: 0, limit: 0, percentage: 0 };
        }
    },
    
    // Wait for energy to arrive
    async waitForEnergy(targetEnergy = 3000000, maxWaitTime = 60000) {
        console.log(`⏳ Waiting for energy to reach ${targetEnergy.toLocaleString()}...`);
        
        const startTime = Date.now();
        const checkInterval = 5000; // Check every 5 seconds
        
        return new Promise((resolve, reject) => {
            const checkEnergy = async () => {
                const elapsed = Date.now() - startTime;
                
                if (elapsed > maxWaitTime) {
                    reject(new Error('Energy rental timeout - exceeded 60 seconds'));
                    return;
                }
                
                const energy = await this.checkCurrentEnergy();
                
                console.log(`⚡ Energy check: ${energy.current.toLocaleString()} / ${targetEnergy.toLocaleString()}`);
                
                if (energy.current >= targetEnergy) {
                    console.log('✅ Energy received!');
                    resolve(energy);
                } else {
                    console.log(`⏳ Still waiting... (${Math.floor(elapsed/1000)}s elapsed)`);
                    setTimeout(checkEnergy, checkInterval);
                }
            };
            
            checkEnergy();
        });
    },
    
    // Alternative: Proceed without rental (pay burn cost)
    proceedWithoutRental() {
        const confirmed = confirm(
            '⚠️ Energy rental is delayed.\n\n' +
            'You can:\n' +
            '1. Wait for energy (recommended)\n' +
            '2. Proceed without rental (will cost more TRX)\n\n' +
            'Proceed without rental?'
        );
        
        if (confirmed) {
            console.log('⚠️ Proceeding without energy rental - higher fees will apply');
            return true;
        }
        
        return false;
    },
    
    // Manual energy check and proceed
    async verifyAndProceed() {
        console.log('🔍 Verifying energy status...');
        
        // Check current energy
        const energy = await this.checkCurrentEnergy();
        
        // For 50-page document, we need about 700K energy
        const requiredEnergy = 700000;
        
        if (energy.current >= requiredEnergy) {
            console.log(`✅ Sufficient energy: ${energy.current.toLocaleString()}`);
            return { ready: true, energy: energy.current };
        }
        
        console.log(`⚠️ Insufficient energy: ${energy.current.toLocaleString()} / ${requiredEnergy.toLocaleString()}`);
        
        // Show options
        const message = `
Current Energy: ${energy.current.toLocaleString()}
Required: ${requiredEnergy.toLocaleString()}

OPTIONS:
1. Wait for rental to process (up to 60 seconds)
2. Try rental again
3. Proceed anyway (will burn TRX for energy)

What would you like to do?`;
        
        const choice = prompt(message + '\n\nEnter 1, 2, or 3:');
        
        switch(choice) {
            case '1':
                try {
                    const result = await this.waitForEnergy(requiredEnergy);
                    return { ready: true, energy: result.current };
                } catch (error) {
                    console.error('Energy wait timeout:', error);
                    return { ready: false, error: 'timeout' };
                }
                
            case '2':
                window.open('https://tronsave.io/#/energy', '_blank');
                alert('Complete the rental, then click OK to continue');
                return await this.verifyAndProceed(); // Recursive check
                
            case '3':
                return { ready: true, energy: energy.current, warning: 'proceeding_without_rental' };
                
            default:
                return { ready: false, error: 'cancelled' };
        }
    }
};

// Override the transaction flow to check energy first
window.checkEnergyBeforeTransaction = async function() {
    console.log('🔋 Energy Pre-Check Started');
    
    const result = await EnergyRentalFix.verifyAndProceed();
    
    if (result.ready) {
        if (result.warning) {
            console.log('⚠️ Proceeding with limited energy - expect higher fees');
        } else {
            console.log('✅ Energy verified - ready for transaction');
        }
        return true;
    } else {
        console.log('❌ Transaction cancelled - ' + (result.error || 'insufficient energy'));
        return false;
    }
};

// Auto-check energy on load
(async function() {
    const energy = await EnergyRentalFix.checkCurrentEnergy();
    
    if (energy.current < 100000) {
        console.log('⚠️ LOW ENERGY WARNING');
        console.log('Current energy:', energy.current.toLocaleString());
        console.log('Recommend renting energy before transactions');
    }
})();

console.log('✅ Energy Rental Fix loaded');
console.log('Use: window.checkEnergyBeforeTransaction() before submitting');