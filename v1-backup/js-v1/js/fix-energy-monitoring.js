/**
 * FIX ENERGY MONITORING
 * Provides real-time energy balance monitoring after rental
 */

console.log('🔋 FIXING ENERGY MONITORING');
console.log('=' .repeat(70));

window.EnergyMonitor = {
    targetEnergy: 0,
    currentEnergy: 0,
    checkInterval: null,
    onComplete: null,
    
    async getCurrentEnergy() {
        try {
            const account = await window.tronWeb.trx.getAccount();
            const energy = account.energy || 0;
            const energyLimit = account.energy_limit || 0;
            return { current: energy, limit: energyLimit };
        } catch (error) {
            console.error('Error getting energy:', error);
            return { current: 0, limit: 0 };
        }
    },
    
    showMonitoringModal(targetEnergy, callback) {
        this.targetEnergy = targetEnergy;
        this.onComplete = callback;
        
        // Remove existing modal if any
        const existing = document.getElementById('energyMonitorModal');
        if (existing) existing.remove();
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'energyMonitorModal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                        background: rgba(0,0,0,0.8); z-index: 10000; 
                        display: flex; align-items: center; justify-content: center;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            border-radius: 20px; padding: 40px; max-width: 500px; 
                            box-shadow: 0 20px 60px rgba(0,0,0,0.3); color: white;">
                    
                    <h2 style="margin: 0 0 20px 0; font-size: 28px; text-align: center;">
                        ⚡ Energy Rental in Progress
                    </h2>
                    
                    <div style="background: rgba(255,255,255,0.1); border-radius: 15px; 
                                padding: 20px; margin: 20px 0;">
                        <div style="font-size: 18px; margin-bottom: 15px;">
                            Waiting for energy to arrive...
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                            <span>Current Energy:</span>
                            <span id="currentEnergy" style="font-weight: bold; font-size: 20px;">
                                Checking...
                            </span>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                            <span>Target Energy:</span>
                            <span style="font-weight: bold; font-size: 20px;">
                                ${targetEnergy.toLocaleString()}
                            </span>
                        </div>
                        
                        <div style="margin-top: 20px;">
                            <div style="background: rgba(0,0,0,0.3); border-radius: 10px; 
                                        height: 30px; overflow: hidden;">
                                <div id="energyProgress" style="background: linear-gradient(90deg, #00ff88, #00ccff);
                                     height: 100%; width: 0%; transition: width 0.5s; 
                                     display: flex; align-items: center; justify-content: center;">
                                    <span id="progressText" style="font-size: 14px; font-weight: bold;">0%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <div id="energyStatus" style="font-size: 16px; margin-bottom: 20px;">
                            ⏳ Energy rental typically takes 10-30 seconds...
                        </div>
                        
                        <button id="proceedBtn" style="background: #00ff88; color: #1a1a2e; 
                                padding: 15px 40px; border: none; border-radius: 10px; 
                                font-size: 18px; font-weight: bold; cursor: not-allowed; 
                                opacity: 0.5; display: none;" disabled>
                            Proceed with Transaction
                        </button>
                        
                        <button onclick="EnergyMonitor.cancel()" 
                                style="background: transparent; color: white; 
                                       border: 2px solid white; padding: 10px 30px; 
                                       border-radius: 10px; font-size: 16px; 
                                       cursor: pointer; margin-top: 10px;">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Start monitoring
        this.startMonitoring();
    },
    
    async startMonitoring() {
        const updateEnergy = async () => {
            const energy = await this.getCurrentEnergy();
            this.currentEnergy = energy.current;
            
            const currentElem = document.getElementById('currentEnergy');
            const progressElem = document.getElementById('energyProgress');
            const progressText = document.getElementById('progressText');
            const statusElem = document.getElementById('energyStatus');
            const proceedBtn = document.getElementById('proceedBtn');
            
            if (currentElem) {
                currentElem.textContent = this.currentEnergy.toLocaleString();
            }
            
            const progress = Math.min(100, (this.currentEnergy / this.targetEnergy) * 100);
            if (progressElem) {
                progressElem.style.width = progress + '%';
                progressText.textContent = Math.round(progress) + '%';
            }
            
            if (this.currentEnergy >= this.targetEnergy) {
                // Energy received!
                clearInterval(this.checkInterval);
                
                if (statusElem) {
                    statusElem.innerHTML = '✅ Energy received! Ready to proceed.';
                }
                
                if (proceedBtn) {
                    proceedBtn.style.opacity = '1';
                    proceedBtn.style.cursor = 'pointer';
                    proceedBtn.disabled = false;
                    proceedBtn.style.display = 'inline-block';
                    proceedBtn.onclick = () => this.proceed();
                }
            } else if (this.currentEnergy > 0) {
                if (statusElem) {
                    statusElem.innerHTML = `⏳ Receiving energy... ${Math.round(progress)}% complete`;
                }
            }
        };
        
        // Check immediately
        updateEnergy();
        
        // Then check every 2 seconds
        this.checkInterval = setInterval(updateEnergy, 2000);
        
        // Timeout after 2 minutes
        setTimeout(() => {
            if (this.currentEnergy < this.targetEnergy) {
                clearInterval(this.checkInterval);
                const statusElem = document.getElementById('energyStatus');
                if (statusElem) {
                    statusElem.innerHTML = '⚠️ Energy rental timeout. You may proceed anyway or retry.';
                }
                const proceedBtn = document.getElementById('proceedBtn');
                if (proceedBtn) {
                    proceedBtn.style.opacity = '1';
                    proceedBtn.style.cursor = 'pointer';
                    proceedBtn.disabled = false;
                    proceedBtn.style.display = 'inline-block';
                    proceedBtn.textContent = 'Proceed Anyway';
                    proceedBtn.onclick = () => this.proceed();
                }
            }
        }, 120000);
    },
    
    proceed() {
        clearInterval(this.checkInterval);
        const modal = document.getElementById('energyMonitorModal');
        if (modal) modal.remove();
        
        if (this.onComplete) {
            this.onComplete();
        }
    },
    
    cancel() {
        clearInterval(this.checkInterval);
        const modal = document.getElementById('energyMonitorModal');
        if (modal) modal.remove();
    }
};

// Override energy rental completion
const originalEnergyComplete = window.onEnergyRentalComplete;
window.onEnergyRentalComplete = function(targetEnergy) {
    console.log('Energy rental initiated, monitoring balance...');
    
    EnergyMonitor.showMonitoringModal(targetEnergy || 150000, () => {
        // Continue with original flow
        if (originalEnergyComplete) {
            originalEnergyComplete(targetEnergy);
        } else {
            // Continue with transaction
            if (window.proceedWithTransaction) {
                window.proceedWithTransaction();
            }
        }
    });
};

console.log('✅ Energy monitoring system ready!');