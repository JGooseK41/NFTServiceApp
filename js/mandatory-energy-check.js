/**
 * MANDATORY ENERGY CHECK
 * Forces energy verification BEFORE any transaction
 * Completely replaces JustLend with manual rental
 */

console.log('🔒 Loading Mandatory Energy Check System...');

// Wait for page to load then override functions
window.addEventListener('DOMContentLoaded', function() {
    // Store original functions after they're defined
    window._originalCreateLegalNotice = window.createLegalNotice;
    window._originalCreateLegalNoticeWithStaging = window.createLegalNoticeWithStaging;
    
    // Force override after a delay to ensure we override after all scripts load
    setTimeout(() => {
        overrideFunctions();
    }, 100);
});

// Store references globally for later use
let _originalCreateLegalNotice;
let _originalCreateLegalNoticeWithStaging;

function overrideFunctions() {
    _originalCreateLegalNotice = window.createLegalNotice;
    _originalCreateLegalNoticeWithStaging = window.createLegalNoticeWithStaging;
    
    // Store originals globally for TronSave to use
    window._originalCreateLegalNotice = _originalCreateLegalNotice;
    window._originalCreateLegalNoticeWithStaging = _originalCreateLegalNoticeWithStaging;
    
    // Override BOTH create functions to force energy check
    window.createLegalNotice = async function() {
        console.log('🚨 MANDATORY ENERGY CHECK INITIATED');
        
        // Check wallet connection first
        if (!window.legalContract || !window.tronWeb?.defaultAddress) {
            if (window.uiManager) {
                window.uiManager.showNotification('error', 'Please connect wallet first');
            }
            return;
        }
        
        // Calculate document size
        const documentInput = document.getElementById('documentUploadInput');
        const documentSizeMB = documentInput?.files?.[0] ? 
            (documentInput.files[0].size / (1024 * 1024)) : 0;
        
        // Get recipient count
        const recipients = window.getAllRecipients ? window.getAllRecipients() : 
                          [document.getElementById('mintRecipient')?.value.trim() || ''];
        
        // FORCE energy check - no way to bypass
        await window.MandatoryEnergyCheck.checkAndProceed(documentSizeMB, recipients.length, 'createLegalNotice');
    };
    
    window.createLegalNoticeWithStaging = async function() {
        console.log('🚨 MANDATORY ENERGY CHECK INITIATED (Staging)');
        
        // Check wallet connection first
        if (!window.legalContract || !window.tronWeb?.defaultAddress) {
            if (window.uiManager) {
                window.uiManager.showNotification('error', 'Please connect wallet first');
            }
            return;
        }
        
        // Calculate document size
        const documentInput = document.getElementById('documentUploadInput');
        const documentSizeMB = documentInput?.files?.[0] ? 
            (documentInput.files[0].size / (1024 * 1024)) : 0;
        
        // Get recipient count
        const recipients = window.getAllRecipients ? window.getAllRecipients() : 
                          [document.getElementById('mintRecipient')?.value.trim() || ''];
        
        // FORCE energy check - no way to bypass
        await window.MandatoryEnergyCheck.checkAndProceed(documentSizeMB, recipients.length, 'createLegalNoticeWithStaging');
    };
    
    console.log('✅ Transaction functions overridden with mandatory energy check');
}

window.MandatoryEnergyCheck = {
    
    async checkAndProceed(documentSizeMB, recipientCount, originalFunction) {
        console.log('📊 Calculating energy requirements...');
        console.log('   Document size:', documentSizeMB, 'MB');
        console.log('   Recipients:', recipientCount);
        
        // Ensure Manual Energy Rental is loaded
        if (!window.ManualEnergyRental) {
            console.error('Energy rental system not loaded!');
            alert('Energy system not ready. Please refresh the page.');
            return;
        }
        
        // Calculate energy needed with breakdown
        const energyDetails = window.ManualEnergyRental.calculateEnergyNeeded(
            documentSizeMB, 
            recipientCount, 
            true // include breakdown
        );
        
        console.log('⚡ Energy required:', energyDetails);
        console.log('   Total energy needed:', energyDetails.total?.toLocaleString() || 'Unknown');
        
        // Check current energy status
        const status = await window.ManualEnergyRental.checkEnergyStatus();
        const currentEnergy = status?.energy?.total || 0;
        
        // Show mandatory energy dialog
        this.showMandatoryEnergyDialog({
            energyDetails,
            currentEnergy,
            documentSizeMB,
            recipientCount,
            originalFunction
        });
    },
    
    showMandatoryEnergyDialog(params) {
        // Store params for later use
        this.lastParams = params;
        
        // Remove any existing dialog
        const existing = document.getElementById('mandatory-energy-dialog');
        if (existing) existing.remove();
        
        // Remove the floating button if it exists
        const floatingBtn = Array.from(document.querySelectorAll('button'))
            .find(btn => btn.textContent.includes('Energy Manager'));
        if (floatingBtn) floatingBtn.style.display = 'none';
        
        const needsRental = params.currentEnergy < params.energyDetails.total;
        const deficit = Math.max(0, params.energyDetails.total - params.currentEnergy);
        
        console.log('🔍 Energy check:');
        console.log('   Current energy:', params.currentEnergy?.toLocaleString());
        console.log('   Required energy:', params.energyDetails.total?.toLocaleString());
        console.log('   Needs rental?', needsRental);
        console.log('   Deficit:', deficit?.toLocaleString());
        
        const dialog = document.createElement('div');
        dialog.id = 'mandatory-energy-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.95);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s;
        `;
        
        // Get best rental option
        const bestRental = this.getBestRentalOption(params.energyDetails.total);
        
        dialog.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #1a1a2e, #16213e);
                border: 3px solid ${needsRental ? '#ff0000' : '#00ff00'};
                border-radius: 15px;
                padding: 30px;
                max-width: 700px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                color: white;
                font-family: Arial, sans-serif;
                box-shadow: 0 20px 60px rgba(0,0,0,0.8);
            ">
                <h1 style="color: ${needsRental ? '#ff0000' : '#00ff00'}; margin-bottom: 25px; text-align: center; font-size: 1.8em;">
                    ${needsRental ? '⚠️ ENERGY REQUIRED' : '✅ ENERGY CHECK'}
                </h1>
                
                <!-- Current Status -->
                <div style="background: ${needsRental ? 'rgba(255,0,0,0.1)' : 'rgba(0,255,0,0.1)'}; 
                            border: 2px solid ${needsRental ? '#ff0000' : '#00ff00'}; 
                            padding: 20px; border-radius: 10px; margin-bottom: 25px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 1.1em;">
                        <div>
                            <div style="color: #888; font-size: 0.9em;">Your Energy:</div>
                            <div style="color: ${params.currentEnergy > 100000 ? '#ffff00' : '#ff0000'}; font-weight: bold; font-size: 1.3em;">
                                ${params.currentEnergy.toLocaleString()}
                            </div>
                        </div>
                        <div>
                            <div style="color: #888; font-size: 0.9em;">Required:</div>
                            <div style="color: #ff4444; font-weight: bold; font-size: 1.3em;">
                                ${params.energyDetails.total.toLocaleString()}
                            </div>
                        </div>
                        ${needsRental ? `
                            <div>
                                <div style="color: #888; font-size: 0.9em;">Deficit:</div>
                                <div style="color: #ff0000; font-weight: bold; font-size: 1.3em;">
                                    ${deficit.toLocaleString()}
                                </div>
                            </div>
                            <div>
                                <div style="color: #888; font-size: 0.9em;">Burn Cost:</div>
                                <div style="color: #ff0000; font-weight: bold; font-size: 1.3em;">
                                    ${params.energyDetails.estimatedTRXBurn} TRX
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                ${needsRental ? `
                    <!-- Critical Warning -->
                    <div style="background: rgba(255,0,0,0.2); border: 2px solid #ff0000; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #ff0000; margin: 0 0 10px 0;">🚨 INSUFFICIENT ENERGY!</h3>
                        <p style="line-height: 1.6; margin: 0;">
                            You don't have enough energy for this transaction. You must either:
                        </p>
                        <ol style="margin: 10px 0 0 20px; line-height: 1.8;">
                            <li><strong style="color: #00ff00;">Rent Energy (Recommended)</strong> - Save ${(parseFloat(params.energyDetails.estimatedTRXBurn) - bestRental.cost).toFixed(2)} TRX</li>
                            <li><strong style="color: #ff9900;">Burn TRX</strong> - Pay ${params.energyDetails.estimatedTRXBurn} TRX in fees</li>
                            <li><strong>Cancel</strong> - Don't proceed with transaction</li>
                        </ol>
                    </div>
                    
                    <!-- Best Rental Option -->
                    <div style="background: rgba(0,255,0,0.1); border: 2px solid #00ff00; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #00ff00; margin: 0 0 10px 0;">💰 Recommended Rental:</h3>
                        <div style="font-size: 1.1em; line-height: 1.6;">
                            <strong>${bestRental.service}</strong><br>
                            Cost: <span style="color: #00ff00; font-weight: bold;">${bestRental.cost.toFixed(2)} TRX</span> for ${bestRental.duration}<br>
                            <span style="color: #00ff88;">You save: ${(parseFloat(params.energyDetails.estimatedTRXBurn) - bestRental.cost).toFixed(2)} TRX!</span>
                        </div>
                    </div>
                ` : `
                    <!-- Success Message -->
                    <div style="background: rgba(0,255,0,0.1); border: 2px solid #00ff00; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #00ff00; margin: 0 0 10px 0;">✅ Sufficient Energy!</h3>
                        <p style="line-height: 1.6; margin: 0;">
                            You have enough energy to complete this transaction without additional fees.
                        </p>
                    </div>
                `}
                
                <!-- Energy Breakdown -->
                <div style="background: rgba(0,0,0,0.4); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: #00ffff; margin: 0 0 10px 0;">📊 Energy Usage Breakdown:</h4>
                    <div style="font-size: 0.9em; line-height: 1.8;">
                        <div style="display: grid; grid-template-columns: auto auto; gap: 8px;">
                            <span>Base Contract:</span>
                            <span style="text-align: right;">${params.energyDetails.breakdown.baseContract.toLocaleString()}</span>
                            <span>NFT Minting:</span>
                            <span style="text-align: right;">${params.energyDetails.breakdown.nftMinting.toLocaleString()}</span>
                            ${params.documentSizeMB > 0 ? `
                                <span>Document (${params.documentSizeMB.toFixed(1)}MB):</span>
                                <span style="text-align: right;">${params.energyDetails.breakdown.documentStorage.toLocaleString()}</span>
                            ` : ''}
                            ${params.recipientCount > 1 ? `
                                <span>Batch (${params.recipientCount} recipients):</span>
                                <span style="text-align: right;">${(params.energyDetails.breakdown.perRecipient * params.recipientCount).toLocaleString()}</span>
                            ` : ''}
                            <span style="border-top: 1px solid #444; padding-top: 5px;">Safety Buffer:</span>
                            <span style="border-top: 1px solid #444; padding-top: 5px; text-align: right;">${params.energyDetails.buffer.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                    ${needsRental ? `
                        <button onclick="MandatoryEnergyCheck.openRentalServices()" style="
                            padding: 15px 30px;
                            background: linear-gradient(135deg, #00ff00, #00aa00);
                            color: black;
                            border: none;
                            border-radius: 10px;
                            font-weight: bold;
                            cursor: pointer;
                            font-size: 1.1em;
                            box-shadow: 0 5px 15px rgba(0,255,0,0.3);
                        ">
                            ⚡ Rent Energy Now
                        </button>
                        
                        <button onclick="MandatoryEnergyCheck.proceedWithBurn('${params.originalFunction}', ${params.energyDetails.estimatedTRXBurn})" style="
                            padding: 15px 30px;
                            background: linear-gradient(135deg, #ff9900, #ff6600);
                            color: white;
                            border: none;
                            border-radius: 10px;
                            font-weight: bold;
                            cursor: pointer;
                            font-size: 1.1em;
                        ">
                            🔥 Burn ${params.energyDetails.estimatedTRXBurn} TRX
                        </button>
                    ` : `
                        <button onclick="MandatoryEnergyCheck.proceedWithTransaction('${params.originalFunction}')" style="
                            padding: 15px 30px;
                            background: linear-gradient(135deg, #00ff00, #00aa00);
                            color: black;
                            border: none;
                            border-radius: 10px;
                            font-weight: bold;
                            cursor: pointer;
                            font-size: 1.1em;
                            box-shadow: 0 5px 15px rgba(0,255,0,0.3);
                        ">
                            ✅ Proceed with Transaction
                        </button>
                    `}
                    
                    <button onclick="MandatoryEnergyCheck.cancel()" style="
                        padding: 15px 30px;
                        background: #666;
                        color: white;
                        border: none;
                        border-radius: 10px;
                        font-weight: bold;
                        cursor: pointer;
                        font-size: 1.1em;
                    ">
                        ❌ Cancel
                    </button>
                </div>
                
                <div style="margin-top: 20px; text-align: center;">
                    <a href="#" onclick="document.getElementById('energy-guide-modal')?.style.display='block'; return false;" 
                       style="color: #00ffff; text-decoration: none; font-size: 0.9em;">
                        ❓ Learn more about energy and why rental saves money
                    </a>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
    },
    
    getBestRentalOption(energyNeeded) {
        // Get verified services from manual rental
        const services = window.ManualEnergyRental?.RENTAL_SERVICES || {};
        
        // Find cheapest 1-hour option
        let bestOption = {
            service: 'TokenGoodies',
            cost: energyNeeded * 0.000028,
            duration: '1 day',
            url: 'https://www.tokengoodies.com'
        };
        
        for (const [key, service] of Object.entries(services)) {
            if (service.pricing?.['1h']) {
                const cost = energyNeeded * service.pricing['1h'];
                if (cost < bestOption.cost) {
                    bestOption = {
                        service: service.name,
                        cost: cost,
                        duration: '1 hour',
                        url: service.url
                    };
                }
            } else if (service.pricing?.['1d']) {
                const cost = energyNeeded * service.pricing['1d'];
                if (cost < bestOption.cost * 2) { // Consider 1-day if not much more
                    bestOption = {
                        service: service.name,
                        cost: cost,
                        duration: '1 day',
                        url: service.url
                    };
                }
            }
        }
        
        return bestOption;
    },
    
    openRentalServices() {
        const dialog = document.getElementById('mandatory-energy-dialog');
        if (dialog) dialog.remove();
        
        // ONLY use TronSave - no other options
        if (window.StreamlinedEnergyFlow) {
            const energyDetails = this.lastParams?.energyDetails || {};
            window.StreamlinedEnergyFlow.show({
                energyDetails: energyDetails,
                documentSizeMB: this.lastParams?.documentSizeMB || 0,
                recipientCount: this.lastParams?.recipientCount || 1
            });
        } else if (window.TronSaveAPI) {
            // Direct TronSave if streamlined flow not available
            window.TronSaveAPI.showEnergyRentalForm();
        } else {
            alert('TronSave energy rental is loading. Please try again in a moment.');
        }
    },
    
    showRentalInstructions() {
        const instructions = document.createElement('div');
        instructions.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid #00ff00;
            border-radius: 10px;
            padding: 20px;
            color: white;
            z-index: 100002;
            max-width: 500px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.8);
        `;
        
        instructions.innerHTML = `
            <h3 style="color: #00ff00; margin: 0 0 15px 0;">⚡ Energy Rental Instructions</h3>
            <ol style="line-height: 1.8; margin: 10px 0;">
                <li>Choose a verified service from the list</li>
                <li>Enter your PUBLIC wallet address</li>
                <li>Select amount and duration</li>
                <li>Complete payment (10-30 seconds)</li>
                <li>Click button below when done</li>
            </ol>
            <button onclick="MandatoryEnergyCheck.checkAfterRental()" style="
                width: 100%;
                padding: 12px;
                background: linear-gradient(135deg, #00ff00, #00aa00);
                color: black;
                border: none;
                border-radius: 5px;
                font-weight: bold;
                cursor: pointer;
                margin-top: 15px;
            ">
                ✅ I've Completed Energy Rental - Continue
            </button>
            <button onclick="this.parentElement.remove()" style="
                width: 100%;
                padding: 10px;
                background: #666;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                margin-top: 10px;
            ">
                Cancel
            </button>
        `;
        
        document.body.appendChild(instructions);
    },
    
    async checkAfterRental() {
        // Remove instructions
        const instructions = Array.from(document.querySelectorAll('div'))
            .find(d => d.textContent.includes('Energy Rental Instructions'));
        if (instructions) instructions.remove();
        
        // Remove rental UI
        const rentalPanel = document.getElementById('secure-energy-panel') || 
                           document.getElementById('energy-rental-panel');
        if (rentalPanel) rentalPanel.remove();
        
        // Check energy again
        const status = await window.ManualEnergyRental.checkEnergyStatus();
        const currentEnergy = status?.energy?.total || 0;
        
        if (currentEnergy > 1000000) {
            if (window.uiManager) {
                window.uiManager.showNotification('success', 
                    `✅ Energy rental successful! You now have ${currentEnergy.toLocaleString()} energy.`);
            }
            
            // Restart the create process
            setTimeout(() => {
                if (window._originalCreateLegalNotice) {
                    window._originalCreateLegalNotice();
                } else if (window.TransactionStaging?.stageTransaction) {
                    window.TransactionStaging.stageTransaction();
                }
            }, 1000);
        } else {
            alert(`Energy still insufficient (${currentEnergy.toLocaleString()}). Please complete the rental or try a different service.`);
            this.openRentalServices();
        }
    },
    
    proceedWithBurn(originalFunction, burnAmount) {
        const dialog = document.getElementById('mandatory-energy-dialog');
        if (dialog) dialog.remove();
        
        if (confirm(`⚠️ WARNING: This will burn ${burnAmount} TRX from your wallet!\n\nAre you sure you want to proceed without renting energy?`)) {
            // Continue with original function
            if (originalFunction === 'createLegalNotice' && window._originalCreateLegalNotice) {
                window._originalCreateLegalNotice();
            } else if (originalFunction === 'createLegalNoticeWithStaging' && window._originalCreateLegalNoticeWithStaging) {
                window._originalCreateLegalNoticeWithStaging();
            }
        }
    },
    
    proceedWithTransaction(originalFunction) {
        const dialog = document.getElementById('mandatory-energy-dialog');
        if (dialog) dialog.remove();
        
        // Continue with original function
        if (originalFunction === 'createLegalNotice' && window._originalCreateLegalNotice) {
            window._originalCreateLegalNotice();
        } else if (originalFunction === 'createLegalNoticeWithStaging' && window._originalCreateLegalNoticeWithStaging) {
            window._originalCreateLegalNoticeWithStaging();
        }
    },
    
    cancel() {
        const dialog = document.getElementById('mandatory-energy-dialog');
        if (dialog) dialog.remove();
        
        if (window.uiManager) {
            window.uiManager.showNotification('info', 'Transaction cancelled');
        }
    }
};

// Completely disable JustLend
if (window.EnergyRental) {
    window.EnergyRental.rentFromJustLend = async function() {
        console.log('❌ JustLend is DISABLED - using Manual Energy Rental');
        return { success: false, error: 'JustLend disabled - use manual rental' };
    };
}

// Hide the floating energy manager button since it's now integrated
setTimeout(() => {
    const floatingBtn = Array.from(document.querySelectorAll('button'))
        .find(btn => btn.textContent.includes('Energy Manager'));
    if (floatingBtn) {
        floatingBtn.style.display = 'none';
        console.log('✅ Removed floating Energy Manager button - now integrated in workflow');
    }
}, 1000);

console.log('✅ Mandatory Energy Check System Loaded');
console.log('   - Energy check is now REQUIRED before any transaction');
console.log('   - JustLend completely disabled');
console.log('   - Manual rental integrated directly into workflow');
console.log('   - No way to bypass energy verification');