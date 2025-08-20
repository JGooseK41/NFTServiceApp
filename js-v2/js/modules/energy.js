// Energy Module - Handles energy rental and monitoring
window.energy = {
    providers: {},
    monitoring: false,
    
    // Initialize module
    async init() {
        console.log('Initializing energy module...');
        this.loadProviders();
    },
    
    // Load energy providers
    loadProviders() {
        this.providers = getConfig('energy.providers');
    },
    
    // Check current energy
    async checkEnergy() {
        if (!window.wallet || !window.wallet.connected) {
            return { available: 0, required: 65000, sufficient: false };
        }
        
        const resources = await window.wallet.getAccountResources();
        const required = 65000; // Base requirement
        
        return {
            available: resources.energy.available,
            required: required,
            sufficient: resources.energy.available >= required,
            deficit: Math.max(0, required - resources.energy.available)
        };
    },
    
    // Estimate energy for transaction
    estimateEnergy(transactionType) {
        const estimates = getConfig('contract.energyEstimates');
        return estimates[transactionType] || 65000;
    },
    
    // Rent energy automatically
    async rentEnergy(amount) {
        try {
            // Check if auto-rental is enabled
            if (!this.providers.tronsave.enabled) {
                return this.manualRental(amount);
            }
            
            // Try TronSave API
            const result = await this.rentFromTronSave(amount);
            if (result.success) {
                return result;
            }
            
            // Fallback to manual
            return this.manualRental(amount);
            
        } catch (error) {
            console.error('Energy rental failed:', error);
            return this.manualRental(amount);
        }
    },
    
    // Rent from TronSave
    async rentFromTronSave(amount) {
        try {
            // This would integrate with TronSave API
            // For now, redirect to TronSave
            const url = `https://tronsave.io/?amount=${amount}&address=${window.wallet.address}`;
            window.open(url, '_blank');
            
            return {
                success: false,
                manual: true,
                url: url
            };
            
        } catch (error) {
            console.error('TronSave rental failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Manual rental flow
    manualRental(amount) {
        const message = `
You need ${amount} energy to complete this transaction.

Please rent energy from one of these marketplaces:
- TronSave: https://tronsave.io
- Energy Market: https://energy.market

Click OK to open TronSave in a new tab.
        `;
        
        if (confirm(message)) {
            window.open('https://tronsave.io', '_blank');
        }
        
        return {
            success: false,
            manual: true
        };
    },
    
    // Monitor energy levels
    startMonitoring(callback, interval = 5000) {
        if (this.monitoring) {
            return;
        }
        
        this.monitoring = true;
        this.monitorInterval = setInterval(async () => {
            const energy = await this.checkEnergy();
            if (callback) {
                callback(energy);
            }
        }, interval);
    },
    
    // Stop monitoring
    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitoring = false;
        }
    },
    
    // Wait for energy to be available
    async waitForEnergy(required, timeout = 300000) {
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(async () => {
                const energy = await this.checkEnergy();
                
                if (energy.available >= required) {
                    clearInterval(checkInterval);
                    resolve(true);
                }
                
                if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error('Energy rental timeout'));
                }
            }, 5000);
        });
    },
    
    // Display energy status
    displayStatus(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        this.checkEnergy().then(energy => {
            const percentage = Math.min(100, (energy.available / energy.required) * 100);
            const color = energy.sufficient ? 'success' : 'warning';
            
            element.innerHTML = `
                <div class="progress">
                    <div class="progress-bar bg-${color}" style="width: ${percentage}%">
                        ${energy.available} / ${energy.required} Energy
                    </div>
                </div>
            `;
        });
    },
    
    // Pre-flight check before transaction
    async preflightCheck(transactionType) {
        const required = this.estimateEnergy(transactionType);
        const energy = await this.checkEnergy();
        
        if (!energy.sufficient) {
            const shouldRent = confirm(`
You need ${energy.deficit} more energy for this transaction.
Current: ${energy.available}
Required: ${required}

Would you like to rent energy now?
            `);
            
            if (shouldRent) {
                const result = await this.rentEnergy(energy.deficit);
                
                if (result.manual) {
                    // Wait for manual rental
                    try {
                        await this.waitForEnergy(required);
                        return { success: true };
                    } catch (error) {
                        return { success: false, error: 'Energy rental timeout' };
                    }
                }
                
                return result;
            }
            
            return { success: false, error: 'Insufficient energy' };
        }
        
        return { success: true };
    }
};

console.log('Energy module loaded');