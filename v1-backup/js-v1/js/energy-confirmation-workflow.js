/**
 * ENERGY CONFIRMATION WORKFLOW
 * Better handling of energy rental delays and confirmation
 */

console.log('⚡ Loading improved energy confirmation workflow...');

window.EnergyConfirmationWorkflow = {
    
    // Check energy status with retries
    async waitForEnergy(targetAmount, maxRetries = 10, retryDelay = 3000) {
        console.log(`⏳ Waiting for ${targetAmount.toLocaleString()} energy to be confirmed...`);
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
                const currentEnergy = account.energy || 0;
                
                console.log(`Attempt ${attempt}/${maxRetries}: Current energy = ${currentEnergy.toLocaleString()}`);
                
                if (currentEnergy >= targetAmount) {
                    console.log('✅ Energy confirmed!');
                    return {
                        success: true,
                        energy: currentEnergy,
                        attempts: attempt
                    };
                }
                
                // Show progress to user
                if (window.uiManager?.showNotification) {
                    window.uiManager.showNotification('info', 
                        `Waiting for energy confirmation... (${attempt}/${maxRetries})`);
                }
                
                // Wait before next check
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
                
            } catch (error) {
                console.warn(`Energy check attempt ${attempt} failed:`, error);
            }
        }
        
        return {
            success: false,
            message: 'Energy confirmation timeout'
        };
    },
    
    // Improved rental with confirmation
    async rentEnergyWithConfirmation(amount, options = {}) {
        console.log('🚀 Starting energy rental with confirmation...');
        
        const {
            showProgress = true,
            maxWaitTime = 30000, // 30 seconds max
            checkInterval = 2000  // Check every 2 seconds
        } = options;
        
        try {
            // Get current energy
            const beforeAccount = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
            const beforeEnergy = beforeAccount.energy || 0;
            console.log(`Current energy: ${beforeEnergy.toLocaleString()}`);
            
            // Calculate needed amount
            const needed = Math.max(0, amount - beforeEnergy);
            if (needed === 0) {
                console.log('✅ Already have sufficient energy!');
                return { success: true, message: 'Sufficient energy available' };
            }
            
            console.log(`Need to rent: ${needed.toLocaleString()} energy`);
            
            // Show rental dialog
            if (showProgress) {
                this.showRentalProgress(needed);
            }
            
            // Initiate rental
            let rentalResult;
            if (window.TronSaveAPI) {
                // Use TronSave
                rentalResult = await window.TronSaveAPI.createEnergyOrderV2(
                    needed,
                    3600, // 1 hour
                    'MEDIUM'
                );
            } else {
                console.error('TronSave API not available');
                return { success: false, message: 'Energy rental service unavailable' };
            }
            
            if (!rentalResult.success) {
                throw new Error(rentalResult.error || 'Rental failed');
            }
            
            console.log('📝 Rental transaction sent:', rentalResult.txId);
            
            // Wait for confirmation with progress updates
            const maxAttempts = Math.floor(maxWaitTime / checkInterval);
            let confirmed = false;
            
            for (let i = 1; i <= maxAttempts; i++) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                
                const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
                const currentEnergy = account.energy || 0;
                
                // Update progress
                const progress = (i / maxAttempts) * 100;
                this.updateRentalProgress(progress, currentEnergy, amount);
                
                if (currentEnergy >= amount * 0.95) { // 95% threshold for success
                    confirmed = true;
                    console.log(`✅ Energy confirmed: ${currentEnergy.toLocaleString()}`);
                    break;
                }
            }
            
            // Close progress dialog
            this.closeRentalProgress();
            
            if (confirmed) {
                if (window.uiManager?.showNotification) {
                    window.uiManager.showNotification('success', 
                        '✅ Energy rental confirmed! Proceeding with transaction...');
                }
                return { success: true, confirmed: true };
            } else {
                // Energy might still be coming, give user options
                return await this.handleDelayedConfirmation(amount);
            }
            
        } catch (error) {
            console.error('Energy rental error:', error);
            this.closeRentalProgress();
            return { success: false, error: error.message };
        }
    },
    
    // Show rental progress dialog
    showRentalProgress(amount) {
        const dialog = document.createElement('div');
        dialog.id = 'energy-rental-progress';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 15px;
            z-index: 10000;
            min-width: 400px;
            color: white;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        `;
        
        dialog.innerHTML = `
            <h2 style="margin: 0 0 20px 0; font-size: 24px;">
                ⚡ Renting Energy...
            </h2>
            <div style="margin: 20px 0;">
                <div style="background: rgba(255,255,255,0.2); border-radius: 10px; height: 30px; overflow: hidden;">
                    <div id="energy-progress-bar" style="
                        background: linear-gradient(90deg, #00ff00, #00ff88);
                        height: 100%;
                        width: 0%;
                        transition: width 0.5s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                    ">0%</div>
                </div>
            </div>
            <div id="energy-status" style="text-align: center; margin: 20px 0;">
                Requesting ${amount.toLocaleString()} energy...
            </div>
            <div style="text-align: center; opacity: 0.8; font-size: 14px;">
                This usually takes 10-20 seconds
            </div>
        `;
        
        document.body.appendChild(dialog);
    },
    
    // Update progress
    updateRentalProgress(percent, current, target) {
        const bar = document.getElementById('energy-progress-bar');
        const status = document.getElementById('energy-status');
        
        if (bar) {
            bar.style.width = percent + '%';
            bar.textContent = Math.round(percent) + '%';
        }
        
        if (status) {
            status.innerHTML = `
                Current: ${current.toLocaleString()} / ${target.toLocaleString()} energy
                <br>
                <small>Waiting for blockchain confirmation...</small>
            `;
        }
    },
    
    // Close progress dialog
    closeRentalProgress() {
        const dialog = document.getElementById('energy-rental-progress');
        if (dialog) {
            dialog.remove();
        }
    },
    
    // Handle delayed confirmation
    async handleDelayedConfirmation(targetAmount) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 30px;
                border-radius: 10px;
                z-index: 10001;
                max-width: 500px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            `;
            
            modal.innerHTML = `
                <h3 style="color: #ff9900; margin: 0 0 15px 0;">
                    ⏳ Energy Rental Pending
                </h3>
                <p style="color: #333; line-height: 1.6;">
                    The energy rental is still being processed by the blockchain. 
                    This can take up to 30 seconds in some cases.
                </p>
                <p style="color: #666; font-size: 14px;">
                    You can wait for confirmation or proceed at your own risk.
                </p>
                <div style="margin-top: 20px; display: flex; gap: 10px;">
                    <button onclick="EnergyConfirmationWorkflow.continueWaiting(${targetAmount})" style="
                        flex: 1;
                        padding: 12px;
                        background: #00c851;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-weight: bold;
                    ">⏰ Keep Waiting</button>
                    <button onclick="EnergyConfirmationWorkflow.proceedAnyway()" style="
                        flex: 1;
                        padding: 12px;
                        background: #ff9900;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-weight: bold;
                    ">⚠️ Proceed Anyway</button>
                    <button onclick="EnergyConfirmationWorkflow.cancelRental()" style="
                        flex: 1;
                        padding: 12px;
                        background: #ff4444;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-weight: bold;
                    ">❌ Cancel</button>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Store resolve function
            window._energyResolve = resolve;
            window._energyModal = modal;
        });
    },
    
    // Continue waiting
    async continueWaiting(targetAmount) {
        if (window._energyModal) {
            window._energyModal.remove();
        }
        
        this.showRentalProgress(targetAmount);
        const result = await this.waitForEnergy(targetAmount, 10, 3000);
        this.closeRentalProgress();
        
        if (window._energyResolve) {
            window._energyResolve(result);
        }
    },
    
    // Proceed without confirmation
    proceedAnyway() {
        if (window._energyModal) {
            window._energyModal.remove();
        }
        if (window._energyResolve) {
            window._energyResolve({ 
                success: true, 
                warning: 'Proceeding without energy confirmation' 
            });
        }
    },
    
    // Cancel rental
    cancelRental() {
        if (window._energyModal) {
            window._energyModal.remove();
        }
        if (window._energyResolve) {
            window._energyResolve({ 
                success: false, 
                cancelled: true 
            });
        }
    }
};

// Override the existing energy check
(function() {
    if (window.IntegratedEnergyWorkflow) {
        const original = window.IntegratedEnergyWorkflow.checkAndRentEnergy;
        
        window.IntegratedEnergyWorkflow.checkAndRentEnergy = async function(requiredEnergy) {
            console.log('⚡ Using improved energy confirmation workflow...');
            
            // Use the new workflow
            const result = await EnergyConfirmationWorkflow.rentEnergyWithConfirmation(
                requiredEnergy,
                {
                    showProgress: true,
                    maxWaitTime: 30000,
                    checkInterval: 2000
                }
            );
            
            return result;
        };
    }
})();

console.log('✅ Energy confirmation workflow loaded');
console.log('Rental will now wait for blockchain confirmation with progress updates');