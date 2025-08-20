/**
 * Fix Energy Check Errors
 * Ensures energy check works even when TronWeb isn't fully initialized
 */

(function() {
    console.log('🔧 Fixing energy check errors...');
    
    // Override the checkCurrentEnergy function with safer version
    if (window.EnergyRentalFix) {
        const originalCheck = window.EnergyRentalFix.checkCurrentEnergy;
        
        window.EnergyRentalFix.checkCurrentEnergy = async function() {
            try {
                // Wait for TronWeb to be ready
                if (!window.tronWeb || !window.tronWeb.ready) {
                    console.log('⏳ Waiting for TronWeb before checking energy...');
                    return { current: 0, limit: 0, percentage: 0 };
                }
                
                // Check if trx object exists
                if (!window.tronWeb.trx) {
                    console.log('⚠️ TronWeb.trx not available yet');
                    return { current: 0, limit: 0, percentage: 0 };
                }
                
                // Check if we have a default address
                if (!window.tronWeb.defaultAddress || !window.tronWeb.defaultAddress.base58) {
                    console.log('⚠️ No wallet connected');
                    return { current: 0, limit: 0, percentage: 0 };
                }
                
                // Now safe to check energy
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
                console.log('Energy check error (safe):', error.message);
                return { current: 0, limit: 0, percentage: 0 };
            }
        };
    }
    
    // Also fix the checkEnergyBeforeTransaction function
    window.checkEnergyBeforeTransaction = async function() {
        try {
            // Wait for TronWeb
            if (!window.tronWeb || !window.tronWeb.ready) {
                console.log('⏳ Wallet not connected yet');
                return false;
            }
            
            const energyStatus = await window.EnergyRentalFix.checkCurrentEnergy();
            const requiredEnergy = 3000000; // 3M energy minimum
            
            if (energyStatus.current < requiredEnergy) {
                console.warn(`⚠️ LOW ENERGY: ${energyStatus.current.toLocaleString()} / ${requiredEnergy.toLocaleString()} required`);
                
                // Show energy rental modal if available
                if (window.showEnergyRentalModal) {
                    window.showEnergyRentalModal();
                }
                
                return false;
            }
            
            console.log('✅ Sufficient energy available');
            return true;
            
        } catch (error) {
            console.log('Energy check error:', error.message);
            return false;
        }
    };
    
    // Fix consolidation status check
    if (window.ConsolidatedSponsorship) {
        const originalIsConsolidation = window.ConsolidatedSponsorship.isConsolidationActive;
        
        window.ConsolidatedSponsorship.isConsolidationActive = async function() {
            try {
                // Wait for contract to be ready
                if (!window.legalContract) {
                    console.log('⏳ Contract not ready for consolidation check');
                    return false;
                }
                
                // Check if sponsorshipFee method exists
                if (!window.legalContract.sponsorshipFee) {
                    console.log('⚠️ sponsorshipFee method not available');
                    return false;
                }
                
                const fee = await window.legalContract.sponsorshipFee().call();
                const feeInTrx = window.tronWeb ? window.tronWeb.fromSun(fee) : 0;
                
                // Consolidated = 10 TRX, Old = 2 TRX
                return feeInTrx >= 10;
                
            } catch (error) {
                console.log('Consolidation check error:', error.message);
                return false;
            }
        };
    }
    
    console.log('✅ Energy check fixes applied');
    console.log('   - Safe energy checking when TronWeb not ready');
    console.log('   - Safe consolidation status checking');
    
})();