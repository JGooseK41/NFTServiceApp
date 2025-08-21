/**
 * STREAMLINED ENERGY FLOW
 * Clean, themed energy rental experience with natural flow
 */

console.log('🎨 Loading Streamlined Energy Flow...');

window.StreamlinedEnergyFlow = {
    
    currentStep: 1,
    energyNeeded: 0,
    rentalCompleted: false,
    
    /**
     * Main entry point - alias for showEnergyModal
     */
    show(params) {
        return this.showEnergyModal(params);
    },
    
    /**
     * Show streamlined energy modal
     */
    showEnergyModal(params) {
        // Store params for later use
        this._modalParams = params;
        
        // For 2.5MB documents, we KNOW it needs 3.5M energy
        if (params.documentSizeMB >= 2.5) {
            this.energyNeeded = 3500000; // Use actual blockchain requirement
            this.adjustedEnergyNeeded = 3500000;
            console.log('📄 Large document (2.5MB+) - using proven 3.5M energy requirement');
        } else if (params.documentSizeMB > 0) {
            // Use 1.4M per MB based on actual blockchain data
            const ENERGY_PER_MB = 1400000;
            this.energyNeeded = Math.ceil(params.documentSizeMB * ENERGY_PER_MB * 1.1); // 10% buffer
            this.adjustedEnergyNeeded = this.energyNeeded;
            console.log(`📄 Document (${params.documentSizeMB}MB) - calculated ${this.energyNeeded} energy`);
        } else {
            this.energyNeeded = params.energyDetails?.total || 400000;
            this.adjustedEnergyNeeded = this.energyNeeded;
        }
        
        this.currentStep = 1;
        
        // Remove any existing modal
        const existing = document.getElementById('streamlined-energy-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'streamlined-energy-modal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(10, 10, 10, 0.95);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(5px);
            animation: fadeIn 0.3s ease;
        `;
        
        const container = document.createElement('div');
        container.className = 'energy-modal-container';
        container.style.cssText = `
            background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%);
            border: 1px solid #333;
            border-radius: 12px;
            width: 90%;
            max-width: 500px;
            max-height: 85vh;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        `;
        
        container.innerHTML = this.getStepContent(params);
        modal.appendChild(container);
        document.body.appendChild(modal);
        
        // Add animations
        this.addAnimations();
    },
    
    /**
     * Get content for current step
     */
    getStepContent(params) {
        const needsRental = params.currentEnergy < params.energyDetails.total;
        const deficit = Math.max(0, params.energyDetails.total - params.currentEnergy);
        
        if (!needsRental) {
            return this.getSuccessContent(params);
        }
        
        switch(this.currentStep) {
            case 1:
                return this.getStep1Content(params, deficit);
            case 2:
                return this.getStep2Content(deficit);
            case 3:
                return this.getStep3Content();
            case 4:
                return this.getVerificationContent();
            default:
                return this.getStep1Content(params, deficit);
        }
    },
    
    /**
     * Step 1: Show energy requirement
     */
    getStep1Content(params, deficit) {
        const burnCost = params.energyDetails.estimatedTRXBurn;
        const rentalCost = (deficit * 0.000025).toFixed(2);
        const savings = (parseFloat(burnCost) - parseFloat(rentalCost)).toFixed(2);
        
        // Don't reset if we already have an adjusted amount
        // The adjustedEnergyNeeded is set in showEnergyModal
        
        return `
            <!-- Header -->
            <div style="
                padding: 24px;
                border-bottom: 1px solid #333;
            ">
                <h2 style="
                    margin: 0;
                    color: #0ea5e9;
                    font-size: 1.5rem;
                    font-weight: 600;
                ">Energy Required</h2>
            </div>
            
            <!-- Content -->
            <div style="padding: 24px;">
                <!-- Status Card -->
                <div style="
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                ">
                    <div style="
                        display: flex;
                        align-items: center;
                        margin-bottom: 12px;
                    ">
                        <div style="
                            width: 8px;
                            height: 8px;
                            background: #ef4444;
                            border-radius: 50%;
                            margin-right: 8px;
                            animation: pulse 2s infinite;
                        "></div>
                        <span style="color: #ef4444; font-weight: 500;">Insufficient Energy</span>
                    </div>
                    <div style="color: #d1d5db; line-height: 1.6;">
                        Estimated requirement: <strong style="color: #fff;">${params.energyDetails.total.toLocaleString()}</strong> energy<br>
                        You currently have: <strong style="color: #fff;">${params.currentEnergy.toLocaleString()}</strong> energy
                    </div>
                </div>
                
                <!-- Manual Adjustment -->
                <div style="
                    background: rgba(14, 165, 233, 0.1);
                    border: 1px solid rgba(14, 165, 233, 0.3);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                ">
                    <div style="color: #0ea5e9; font-weight: 500; margin-bottom: 12px;">
                        ⚡ Adjust Energy Amount (Optional)
                    </div>
                    <div style="color: #9ca3af; font-size: 0.875rem; margin-bottom: 8px;">
                        If you know the actual requirement differs, you can adjust it here:
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="number" 
                            id="energy-adjustment-input"
                            value="${this.adjustedEnergyNeeded}"
                            min="${params.currentEnergy}"
                            step="100000"
                            style="
                                flex: 1;
                                padding: 10px;
                                background: rgba(0, 0, 0, 0.3);
                                border: 1px solid #0ea5e9;
                                border-radius: 6px;
                                color: white;
                                font-size: 1rem;
                                font-family: monospace;
                            "
                            onchange="StreamlinedEnergyFlow.updateEnergyAmount(this.value)"
                        />
                        <div style="color: #9ca3af; padding: 0 8px;">energy</div>
                    </div>
                    <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                        <!-- Preset amounts -->
                        <button onclick="StreamlinedEnergyFlow.setEnergyAmount(3500000)" style="
                            padding: 6px 12px;
                            background: rgba(0, 0, 0, 0.3);
                            border: 1px solid #333;
                            border-radius: 4px;
                            color: #9ca3af;
                            font-size: 0.75rem;
                            cursor: pointer;
                        ">3.5M</button>
                        <button onclick="StreamlinedEnergyFlow.setEnergyAmount(4000000)" style="
                            padding: 6px 12px;
                            background: rgba(0, 0, 0, 0.3);
                            border: 1px solid #333;
                            border-radius: 4px;
                            color: #9ca3af;
                            font-size: 0.75rem;
                            cursor: pointer;
                        ">4M</button>
                        <button onclick="StreamlinedEnergyFlow.setEnergyAmount(5000000)" style="
                            padding: 6px 12px;
                            background: rgba(0, 0, 0, 0.3);
                            border: 1px solid #333;
                            border-radius: 4px;
                            color: #9ca3af;
                            font-size: 0.75rem;
                            cursor: pointer;
                        ">5M</button>
                        
                        <!-- Subtract buttons -->
                        <button onclick="StreamlinedEnergyFlow.subtractEnergyAmount(1000000)" style="
                            padding: 6px 12px;
                            background: rgba(239, 68, 68, 0.1);
                            border: 1px solid rgba(239, 68, 68, 0.3);
                            border-radius: 4px;
                            color: #ef4444;
                            font-size: 0.75rem;
                            cursor: pointer;
                        ">-1M</button>
                        <button onclick="StreamlinedEnergyFlow.subtractEnergyAmount(500000)" style="
                            padding: 6px 12px;
                            background: rgba(239, 68, 68, 0.1);
                            border: 1px solid rgba(239, 68, 68, 0.3);
                            border-radius: 4px;
                            color: #ef4444;
                            font-size: 0.75rem;
                            cursor: pointer;
                        ">-500k</button>
                        
                        <!-- Add buttons -->
                        <button onclick="StreamlinedEnergyFlow.addEnergyAmount(500000)" style="
                            padding: 6px 12px;
                            background: rgba(16, 185, 129, 0.1);
                            border: 1px solid rgba(16, 185, 129, 0.3);
                            border-radius: 4px;
                            color: #10b981;
                            font-size: 0.75rem;
                            cursor: pointer;
                        ">+500k</button>
                        <button onclick="StreamlinedEnergyFlow.addEnergyAmount(1000000)" style="
                            padding: 6px 12px;
                            background: rgba(16, 185, 129, 0.1);
                            border: 1px solid rgba(16, 185, 129, 0.3);
                            border-radius: 4px;
                            color: #10b981;
                            font-size: 0.75rem;
                            cursor: pointer;
                        ">+1M</button>
                    </div>
                </div>
                
                <!-- Cost Comparison -->
                <div style="margin-bottom: 24px;">
                    <h3 style="color: #d1d5db; font-size: 0.875rem; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
                        Cost Options
                    </h3>
                    
                    <!-- Burn Option -->
                    <div style="
                        background: rgba(17, 17, 17, 0.5);
                        border: 1px solid #333;
                        border-radius: 8px;
                        padding: 12px;
                        margin-bottom: 8px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <div>
                            <div style="color: #9ca3af; font-size: 0.875rem;">Burn TRX (Not Recommended)</div>
                            <div style="color: #ef4444; font-weight: 600; font-size: 1.125rem;">${burnCost} TRX</div>
                        </div>
                        <div style="
                            background: rgba(239, 68, 68, 0.1);
                            color: #ef4444;
                            padding: 4px 8px;
                            border-radius: 4px;
                            font-size: 0.75rem;
                        ">Expensive</div>
                    </div>
                    
                    <!-- Rental Option -->
                    <div style="
                        background: rgba(16, 185, 129, 0.1);
                        border: 1px solid rgba(16, 185, 129, 0.3);
                        border-radius: 8px;
                        padding: 12px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <div>
                            <div style="color: #9ca3af; font-size: 0.875rem;">Rent Energy (Recommended)</div>
                            <div style="color: #10b981; font-weight: 600; font-size: 1.125rem;">${rentalCost} TRX</div>
                        </div>
                        <div style="
                            background: rgba(16, 185, 129, 0.1);
                            color: #10b981;
                            padding: 4px 8px;
                            border-radius: 4px;
                            font-size: 0.75rem;
                        ">Save ${savings} TRX</div>
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div style="display: flex; gap: 12px;">
                    <button onclick="StreamlinedEnergyFlow.proceedToRental()" style="
                        flex: 1;
                        background: linear-gradient(135deg, #0ea5e9, #0284c7);
                        color: white;
                        border: none;
                        padding: 12px;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                        Rent Energy →
                    </button>
                    <button onclick="StreamlinedEnergyFlow.burnTRX()" style="
                        background: transparent;
                        color: #9ca3af;
                        border: 1px solid #333;
                        padding: 12px 20px;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                    " onmouseover="this.style.borderColor='#666'" onmouseout="this.style.borderColor='#333'">
                        Burn TRX
                    </button>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="
                padding: 16px 24px;
                border-top: 1px solid #333;
                background: rgba(0, 0, 0, 0.2);
            ">
                <button onclick="StreamlinedEnergyFlow.cancel()" style="
                    color: #9ca3af;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 0.875rem;
                ">Cancel Transaction</button>
            </div>
        `;
    },
    
    /**
     * Step 2: Select marketplace
     */
    getStep2Content(deficit) {
        const marketplaces = [
            { name: 'TronSave', url: 'https://tronsave.io', time: '~30 seconds', trust: 'HIGH' },
            { name: 'TR.Energy', url: 'https://tr.energy', time: '~1 minute', trust: 'HIGH' },
            { name: 'Tron Energy Market', url: 'https://tronenergy.market', time: '~30 seconds', trust: 'HIGH' },
            { name: 'Feee.io', url: 'https://feee.io', time: '~30 seconds', trust: 'MEDIUM' }
        ];
        
        return `
            <!-- Header with progress -->
            <div style="
                padding: 24px;
                border-bottom: 1px solid #333;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                ">
                    <div style="
                        width: 24px;
                        height: 24px;
                        background: #0ea5e9;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 0.75rem;
                        font-weight: 600;
                    ">1</div>
                    <div style="flex: 1; height: 2px; background: #0ea5e9;"></div>
                    <div style="
                        width: 24px;
                        height: 24px;
                        background: #0ea5e9;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 0.75rem;
                        font-weight: 600;
                    ">2</div>
                    <div style="flex: 1; height: 2px; background: #333;"></div>
                    <div style="
                        width: 24px;
                        height: 24px;
                        background: #333;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #666;
                        font-size: 0.75rem;
                        font-weight: 600;
                    ">3</div>
                </div>
                <h2 style="
                    margin: 0;
                    color: #0ea5e9;
                    font-size: 1.5rem;
                    font-weight: 600;
                ">Choose Energy Provider</h2>
            </div>
            
            <!-- Content -->
            <div style="padding: 24px;">
                <div style="
                    background: rgba(14, 165, 233, 0.1);
                    border: 1px solid rgba(14, 165, 233, 0.3);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 20px;
                    color: #d1d5db;
                    font-size: 0.875rem;
                ">
                    <strong>Energy needed:</strong> ${deficit.toLocaleString()} units
                </div>
                
                <!-- Marketplace Options -->
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${marketplaces.map(m => `
                        <button onclick="StreamlinedEnergyFlow.openMarketplace('${m.url}', '${m.name}')" style="
                            background: rgba(17, 17, 17, 0.5);
                            border: 1px solid #333;
                            border-radius: 8px;
                            padding: 16px;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                        " onmouseover="this.style.borderColor='#0ea5e9'; this.style.background='rgba(14, 165, 233, 0.05)'" 
                           onmouseout="this.style.borderColor='#333'; this.style.background='rgba(17, 17, 17, 0.5)'">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="color: #fff; font-weight: 600; margin-bottom: 4px;">${m.name}</div>
                                    <div style="color: #9ca3af; font-size: 0.75rem;">${m.time}</div>
                                </div>
                                <div style="
                                    background: ${m.trust === 'HIGH' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(251, 191, 36, 0.1)'};
                                    color: ${m.trust === 'HIGH' ? '#10b981' : '#fbbf24'};
                                    padding: 4px 8px;
                                    border-radius: 4px;
                                    font-size: 0.75rem;
                                ">${m.trust === 'HIGH' ? 'Verified' : 'Use Caution'}</div>
                            </div>
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <!-- Footer -->
            <div style="
                padding: 16px 24px;
                border-top: 1px solid #333;
                background: rgba(0, 0, 0, 0.2);
                display: flex;
                justify-content: space-between;
            ">
                <button onclick="StreamlinedEnergyFlow.goBack()" style="
                    color: #9ca3af;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 0.875rem;
                ">← Back</button>
                <button onclick="StreamlinedEnergyFlow.cancel()" style="
                    color: #9ca3af;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 0.875rem;
                ">Cancel</button>
            </div>
        `;
    },
    
    /**
     * Step 3: Rental instructions
     */
    getStep3Content() {
        return `
            <!-- Header with progress -->
            <div style="
                padding: 24px;
                border-bottom: 1px solid #333;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                ">
                    <div style="
                        width: 24px;
                        height: 24px;
                        background: #10b981;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 0.75rem;
                    ">✓</div>
                    <div style="flex: 1; height: 2px; background: #0ea5e9;"></div>
                    <div style="
                        width: 24px;
                        height: 24px;
                        background: #10b981;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 0.75rem;
                    ">✓</div>
                    <div style="flex: 1; height: 2px; background: #0ea5e9;"></div>
                    <div style="
                        width: 24px;
                        height: 24px;
                        background: #0ea5e9;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 0.75rem;
                        font-weight: 600;
                    ">3</div>
                </div>
                <h2 style="
                    margin: 0;
                    color: #0ea5e9;
                    font-size: 1.5rem;
                    font-weight: 600;
                ">Complete Rental</h2>
            </div>
            
            <!-- Content -->
            <div style="padding: 24px;">
                <div style="
                    background: rgba(251, 191, 36, 0.1);
                    border: 1px solid rgba(251, 191, 36, 0.3);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 20px;
                    color: #fbbf24;
                    font-size: 0.875rem;
                ">
                    ⚠️ A new tab has opened with the energy marketplace
                </div>
                
                <!-- Instructions -->
                <div style="margin-bottom: 24px;">
                    <h3 style="color: #d1d5db; font-size: 1rem; margin-bottom: 16px;">Quick Steps:</h3>
                    <ol style="
                        margin: 0;
                        padding-left: 20px;
                        color: #9ca3af;
                        line-height: 2;
                    ">
                        <li>Enter your wallet address (already copied)</li>
                        <li>Enter energy amount: <strong style="color: #fff;">${this.energyNeeded.toLocaleString()}</strong></li>
                        <li>Complete payment with TRX</li>
                        <li>Wait 10-30 seconds for energy</li>
                    </ol>
                </div>
                
                <!-- Wallet Address -->
                <div style="
                    background: rgba(17, 17, 17, 0.5);
                    border: 1px solid #333;
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 20px;
                ">
                    <div style="color: #9ca3af; font-size: 0.75rem; margin-bottom: 4px;">Your Wallet Address (Copied!)</div>
                    <div style="
                        color: #0ea5e9;
                        font-family: monospace;
                        font-size: 0.875rem;
                        word-break: break-all;
                    ">${window.tronWeb?.defaultAddress?.base58 || 'Not connected'}</div>
                </div>
                
                <!-- Verification Button -->
                <button onclick="StreamlinedEnergyFlow.verifyRental()" style="
                    width: 100%;
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white;
                    border: none;
                    padding: 14px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 1rem;
                " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                    I've Completed the Rental →
                </button>
            </div>
            
            <!-- Footer -->
            <div style="
                padding: 16px 24px;
                border-top: 1px solid #333;
                background: rgba(0, 0, 0, 0.2);
                display: flex;
                justify-content: space-between;
            ">
                <button onclick="StreamlinedEnergyFlow.goBack()" style="
                    color: #9ca3af;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 0.875rem;
                ">← Back</button>
                <button onclick="StreamlinedEnergyFlow.cancel()" style="
                    color: #9ca3af;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 0.875rem;
                ">Cancel</button>
            </div>
        `;
    },
    
    /**
     * Step 4: Verification
     */
    getVerificationContent() {
        return `
            <!-- Header -->
            <div style="
                padding: 24px;
                border-bottom: 1px solid #333;
            ">
                <h2 style="
                    margin: 0;
                    color: #0ea5e9;
                    font-size: 1.5rem;
                    font-weight: 600;
                ">Verifying Energy...</h2>
            </div>
            
            <!-- Content -->
            <div style="padding: 48px 24px; text-align: center;">
                <div style="
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 24px;
                    border: 3px solid #0ea5e9;
                    border-top-color: transparent;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                "></div>
                <div style="color: #d1d5db; font-size: 1.125rem; margin-bottom: 8px;">
                    Checking your energy balance...
                </div>
                <div style="color: #9ca3af; font-size: 0.875rem;">
                    This usually takes 5-10 seconds
                </div>
            </div>
        `;
    },
    
    /**
     * Success content (sufficient energy)
     */
    getSuccessContent(params) {
        return `
            <!-- Header -->
            <div style="
                padding: 24px;
                border-bottom: 1px solid #333;
            ">
                <h2 style="
                    margin: 0;
                    color: #10b981;
                    font-size: 1.5rem;
                    font-weight: 600;
                ">Energy Verified ✓</h2>
            </div>
            
            <!-- Content -->
            <div style="padding: 24px;">
                <div style="
                    background: rgba(16, 185, 129, 0.1);
                    border: 1px solid rgba(16, 185, 129, 0.3);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 24px;
                    text-align: center;
                ">
                    <div style="
                        font-size: 3rem;
                        margin-bottom: 12px;
                    ">✅</div>
                    <div style="color: #10b981; font-size: 1.125rem; font-weight: 600; margin-bottom: 8px;">
                        Sufficient Energy Available
                    </div>
                    <div style="color: #d1d5db;">
                        You have ${params.currentEnergy.toLocaleString()} energy
                    </div>
                </div>
                
                <button onclick="StreamlinedEnergyFlow.proceed()" style="
                    width: 100%;
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white;
                    border: none;
                    padding: 14px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 1rem;
                " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                    Continue with Transaction →
                </button>
            </div>
        `;
    },
    
    /**
     * Navigation functions
     */
    proceedToRental() {
        this.currentStep = 2;
        this.updateContent();
    },
    
    openMarketplace(url, name) {
        // For now, always open TronSave externally for manual rental
        // The API integration needs configuration first
        
        const energyAmount = this.adjustedEnergyNeeded || this.energyNeeded || 3500000;
        console.log(`🔌 Opening ${name} for manual rental of ${energyAmount} energy`);
        
        // Copy wallet address to clipboard for easy pasting
        if (window.tronWeb?.defaultAddress?.base58) {
            navigator.clipboard.writeText(window.tronWeb.defaultAddress.base58);
            console.log('Wallet address copied to clipboard');
        }
        
        // Open marketplace in new tab
        window.open(url, '_blank');
        
        // Move to instructions
        this.currentStep = 3;
        this.updateContent();
    },
    
    async verifyRental() {
        this.currentStep = 4;
        this.updateContent();
        
        // Wait a bit then check energy
        setTimeout(async () => {
            const status = await window.ManualEnergyRental?.checkEnergyStatus();
            const currentEnergy = status?.energy?.total || 0;
            
            if (currentEnergy >= this.energyNeeded * 0.9) { // Allow 10% margin
                this.rentalCompleted = true;
                this.showSuccess(currentEnergy);
            } else {
                this.showRetry(currentEnergy);
            }
        }, 3000);
    },
    
    showSuccess(currentEnergy) {
        const container = document.querySelector('.energy-modal-container');
        if (!container) return;
        
        container.innerHTML = `
            <!-- Header -->
            <div style="
                padding: 24px;
                border-bottom: 1px solid #333;
            ">
                <h2 style="
                    margin: 0;
                    color: #10b981;
                    font-size: 1.5rem;
                    font-weight: 600;
                ">Energy Rental Successful!</h2>
            </div>
            
            <!-- Content -->
            <div style="padding: 24px;">
                <div style="
                    background: rgba(16, 185, 129, 0.1);
                    border: 1px solid rgba(16, 185, 129, 0.3);
                    border-radius: 8px;
                    padding: 24px;
                    margin-bottom: 24px;
                    text-align: center;
                ">
                    <div style="
                        font-size: 3rem;
                        margin-bottom: 12px;
                        animation: scaleIn 0.5s ease;
                    ">🎉</div>
                    <div style="color: #10b981; font-size: 1.125rem; font-weight: 600; margin-bottom: 8px;">
                        Energy Successfully Added!
                    </div>
                    <div style="color: #d1d5db;">
                        Current Energy: <strong style="color: #fff;">${currentEnergy.toLocaleString()}</strong>
                    </div>
                </div>
                
                <button onclick="StreamlinedEnergyFlow.proceed()" style="
                    width: 100%;
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white;
                    border: none;
                    padding: 14px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 1rem;
                " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                    Continue with Transaction →
                </button>
            </div>
        `;
    },
    
    showRetry(currentEnergy) {
        const container = document.querySelector('.energy-modal-container');
        if (!container) return;
        
        container.innerHTML = `
            <!-- Header -->
            <div style="
                padding: 24px;
                border-bottom: 1px solid #333;
            ">
                <h2 style="
                    margin: 0;
                    color: #fbbf24;
                    font-size: 1.5rem;
                    font-weight: 600;
                ">Energy Not Detected</h2>
            </div>
            
            <!-- Content -->
            <div style="padding: 24px;">
                <div style="
                    background: rgba(251, 191, 36, 0.1);
                    border: 1px solid rgba(251, 191, 36, 0.3);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 24px;
                ">
                    <div style="color: #fbbf24; font-weight: 600; margin-bottom: 8px;">
                        Energy rental not detected yet
                    </div>
                    <div style="color: #d1d5db; font-size: 0.875rem; line-height: 1.5;">
                        Current: ${currentEnergy.toLocaleString()} | Needed: ${this.energyNeeded.toLocaleString()}
                    </div>
                </div>
                
                <div style="display: flex; gap: 12px;">
                    <button onclick="StreamlinedEnergyFlow.verifyRental()" style="
                        flex: 1;
                        background: linear-gradient(135deg, #0ea5e9, #0284c7);
                        color: white;
                        border: none;
                        padding: 12px;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                    ">
                        Check Again
                    </button>
                    <button onclick="StreamlinedEnergyFlow.currentStep = 2; StreamlinedEnergyFlow.updateContent()" style="
                        flex: 1;
                        background: transparent;
                        color: #9ca3af;
                        border: 1px solid #333;
                        padding: 12px;
                        border-radius: 8px;
                        cursor: pointer;
                    ">
                        Try Another Service
                    </button>
                </div>
            </div>
        `;
    },
    
    goBack() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateContent();
        }
    },
    
    updateContent() {
        const container = document.querySelector('.energy-modal-container');
        if (!container) return;
        
        // Get params stored when modal was opened
        const params = this._modalParams || {};
        container.innerHTML = this.getStepContent(params);
    },
    
    burnTRX() {
        if (confirm('⚠️ This will burn TRX from your wallet. Are you sure?')) {
            this.proceed();
        }
    },
    
    proceed() {
        const modal = document.getElementById('streamlined-energy-modal');
        if (modal) modal.remove();
        
        // Also remove mandatory energy dialog if it exists
        const mandatoryDialog = document.getElementById('mandatory-energy-dialog');
        if (mandatoryDialog) mandatoryDialog.remove();
        
        // Show success message and let user review balance
        alert('Energy rental complete!\n\nYour wallet balance has been updated.\nYou can now review your balance and proceed with minting.');
        
        // Refresh wallet display to show new energy balance
        if (window.wallet && window.wallet.updateDisplay) {
            window.wallet.updateDisplay();
        }
        
        // Don't auto-proceed - user will manually click mint button
        console.log('Energy rental flow complete. User can now review and mint manually.');
    },
    
    cancel() {
        const modal = document.getElementById('streamlined-energy-modal');
        if (modal) modal.remove();
        
        if (window.uiManager) {
            window.uiManager.showNotification('info', 'Transaction cancelled');
        }
    },
    
    // Helper functions for energy adjustment
    updateEnergyAmount(value) {
        const newAmount = parseInt(value);
        if (newAmount && newAmount > 0) {
            this.adjustedEnergyNeeded = newAmount;
            this.energyNeeded = newAmount;  // Update both for compatibility
            console.log(`✅ Energy amount updated to: ${newAmount.toLocaleString()}`);
            
            // Update the display if we're on step 1
            if (this.currentStep === 1) {
                // Recalculate costs with new amount
                const params = this._originalParams;
                if (params) {
                    params.energyDetails.total = newAmount;
                    // Update the deficit calculation
                    const deficit = Math.max(0, newAmount - params.currentEnergy);
                    const burnCost = (deficit * 0.000071).toFixed(2);  // TronSave rate
                    console.log(`  New rental cost: ~${burnCost} TRX for ${deficit.toLocaleString()} energy`);
                }
            }
        }
    },
    
    setEnergyAmount(amount) {
        const input = document.getElementById('energy-adjustment-input');
        if (input) {
            input.value = amount;
            this.updateEnergyAmount(amount);
        }
    },
    
    addEnergyAmount(amount) {
        const input = document.getElementById('energy-adjustment-input');
        if (input) {
            const current = parseInt(input.value) || 0;
            const newAmount = current + amount;
            input.value = newAmount;
            this.updateEnergyAmount(newAmount);
        }
    },
    
    subtractEnergyAmount(amount) {
        const input = document.getElementById('energy-adjustment-input');
        if (input) {
            const current = parseInt(input.value) || 0;
            const newAmount = Math.max(500000, current - amount); // Minimum 500k energy
            input.value = newAmount;
            this.updateEnergyAmount(newAmount);
        }
    },
    
    /**
     * Add CSS animations
     */
    addAnimations() {
        if (document.getElementById('streamlined-animations')) return;
        
        const style = document.createElement('style');
        style.id = 'streamlined-animations';
        style.innerHTML = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            @keyframes scaleIn {
                from { transform: scale(0.5); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
};

// DON'T override - let MandatoryEnergyCheck do its job properly
// It will call StreamlinedEnergyFlow when rental is needed

console.log('✅ Streamlined Energy Flow loaded');
console.log('   - Clean, themed interface');
console.log('   - Step-by-step guidance');
console.log('   - Automatic verification');
console.log('   - Natural user flow');