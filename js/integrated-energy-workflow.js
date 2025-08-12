/**
 * INTEGRATED ENERGY WORKFLOW
 * Replaces broken JustLend rental with Manual Energy Manager
 * Shows energy check FIRST before any transaction
 */

console.log('🚀 Loading Integrated Energy Workflow...');

window.IntegratedEnergyWorkflow = {
    
    // Check and prepare energy BEFORE transaction
    async checkAndPrepareEnergy(documentSizeMB = 0, recipientCount = 1) {
        console.log('⚡ Checking energy requirements FIRST...');
        
        // Ensure Manual Energy Rental is loaded
        if (!window.ManualEnergyRental) {
            console.error('Manual Energy Rental not loaded!');
            return { proceed: false, error: 'Energy manager not available' };
        }
        
        // Calculate energy needed with breakdown
        const energyDetails = window.ManualEnergyRental.calculateEnergyNeeded(
            documentSizeMB, 
            recipientCount, 
            true // include breakdown
        );
        
        // Store for later use
        this.lastDocumentSizeMB = documentSizeMB;
        this.lastRecipientCount = recipientCount;
        this.lastEnergyDetails = energyDetails;
        
        console.log('📊 Energy calculation:', energyDetails);
        
        // Check current energy status
        const status = await window.ManualEnergyRental.checkEnergyStatus();
        const currentEnergy = status?.energy?.total || 0;
        
        // Determine if rental is needed
        const needsRental = currentEnergy < energyDetails.total;
        
        if (needsRental) {
            console.log(`⚠️ Energy rental needed! Have: ${currentEnergy}, Need: ${energyDetails.total}`);
            
            // Show integrated energy dialog
            const userChoice = await this.showIntegratedEnergyDialog({
                energyDetails,
                currentEnergy,
                needsRental,
                documentSizeMB,
                recipientCount
            });
            
            return userChoice;
        } else {
            console.log(`✅ Sufficient energy! Have: ${currentEnergy}, Need: ${energyDetails.total}`);
            return { 
                proceed: true, 
                energySufficient: true,
                currentEnergy,
                energyNeeded: energyDetails.total
            };
        }
    },
    
    // Show integrated energy dialog (replaces the broken JustLend modal)
    async showIntegratedEnergyDialog(params) {
        return new Promise((resolve) => {
            // Remove any existing dialog
            const existing = document.getElementById('integrated-energy-dialog');
            if (existing) existing.remove();
            
            const dialog = document.createElement('div');
            dialog.id = 'integrated-energy-dialog';
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.3s;
            `;
            
            // Get rental recommendations
            const recommendations = window.ManualEnergyRental.getRentalRecommendations(
                params.energyDetails.total, 
                '1h'
            ).then(recs => {
                const bestOption = recs.recommendations?.[0];
                
                dialog.innerHTML = `
                    <div style="
                        background: linear-gradient(135deg, #1a1a2e, #16213e);
                        border-radius: 15px;
                        padding: 30px;
                        max-width: 600px;
                        width: 90%;
                        color: white;
                        font-family: Arial, sans-serif;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                    ">
                        <h2 style="color: #ff4444; margin-bottom: 20px; text-align: center;">
                            ⚡ Energy Required for Transaction
                        </h2>
                        
                        <!-- Energy Status -->
                        <div style="background: rgba(255,68,68,0.1); border: 1px solid #ff4444; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div>
                                    <div style="color: #aaa; font-size: 0.9em;">Your Energy:</div>
                                    <div style="color: ${params.currentEnergy > 100000 ? '#ffff00' : '#ff4444'}; font-weight: bold; font-size: 1.1em;">
                                        ${params.currentEnergy.toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div style="color: #aaa; font-size: 0.9em;">Energy Needed:</div>
                                    <div style="color: #ff4444; font-weight: bold; font-size: 1.1em;">
                                        ${params.energyDetails.total.toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div style="color: #aaa; font-size: 0.9em;">Deficit:</div>
                                    <div style="color: #ff0000; font-weight: bold; font-size: 1.1em;">
                                        ${Math.max(0, params.energyDetails.total - params.currentEnergy).toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div style="color: #aaa; font-size: 0.9em;">If Burned:</div>
                                    <div style="color: #ff0000; font-weight: bold; font-size: 1.1em;">
                                        ${params.energyDetails.estimatedTRXBurn} TRX
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Energy Breakdown -->
                        <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <h4 style="color: #00ffff; margin: 0 0 10px 0;">📊 Energy Breakdown:</h4>
                            <div style="font-size: 0.9em; line-height: 1.6;">
                                <div style="display: grid; grid-template-columns: auto auto; gap: 5px;">
                                    <span>Base Contract:</span>
                                    <span style="text-align: right;">${params.energyDetails.breakdown.baseContract.toLocaleString()}</span>
                                    <span>NFT Minting:</span>
                                    <span style="text-align: right;">${params.energyDetails.breakdown.nftMinting.toLocaleString()}</span>
                                    ${params.documentSizeMB > 0 ? `
                                        <span>Document (${params.documentSizeMB}MB):</span>
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
                        
                        <!-- Options -->
                        <div style="background: rgba(0,255,0,0.1); border: 1px solid #00ff00; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <h4 style="color: #00ff00; margin: 0 0 10px 0;">💰 Save Money with Energy Rental:</h4>
                            ${bestOption ? `
                                <div style="margin: 10px 0;">
                                    <strong>${bestOption.service}</strong> - ${bestOption.note}<br>
                                    <span style="color: #ffff00;">
                                        Rent ${params.energyDetails.total.toLocaleString()} energy for 
                                        <strong>${bestOption.bestPrice.cost} TRX</strong> (1 hour)
                                    </span><br>
                                    <span style="color: #00ff88; font-weight: bold;">
                                        Save ${(parseFloat(params.energyDetails.estimatedTRXBurn) - parseFloat(bestOption.bestPrice.cost)).toFixed(2)} TRX!
                                    </span>
                                </div>
                            ` : `
                                <div>Calculating best rental options...</div>
                            `}
                        </div>
                        
                        <!-- Warning -->
                        <div style="background: rgba(255,255,0,0.1); border: 1px solid #ffff00; padding: 10px; border-radius: 5px; margin-bottom: 20px;">
                            <strong style="color: #ffff00;">⚠️ Important:</strong><br>
                            Without energy rental, this transaction will burn <strong style="color: #ff4444;">${params.energyDetails.estimatedTRXBurn} TRX</strong> from your wallet!
                        </div>
                        
                        <!-- Action Buttons -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                            <button onclick="IntegratedEnergyWorkflow.handleRentEnergy()" style="
                                background: linear-gradient(135deg, #00ff00, #00aa00);
                                color: black;
                                border: none;
                                padding: 12px;
                                border-radius: 8px;
                                font-weight: bold;
                                cursor: pointer;
                                font-size: 1em;
                            ">
                                ⚡ Rent Energy First
                            </button>
                            
                            <button onclick="IntegratedEnergyWorkflow.handleBurnTRX()" style="
                                background: linear-gradient(135deg, #ff9900, #ff6600);
                                color: white;
                                border: none;
                                padding: 12px;
                                border-radius: 8px;
                                font-weight: bold;
                                cursor: pointer;
                                font-size: 1em;
                            ">
                                🔥 Burn ${params.energyDetails.estimatedTRXBurn} TRX
                            </button>
                            
                            <button onclick="IntegratedEnergyWorkflow.handleCancel()" style="
                                background: #444;
                                color: white;
                                border: none;
                                padding: 12px;
                                border-radius: 8px;
                                font-weight: bold;
                                cursor: pointer;
                                font-size: 1em;
                            ">
                                ❌ Cancel
                            </button>
                        </div>
                        
                        <div style="margin-top: 15px; text-align: center;">
                            <a href="#" onclick="EnergyGuide && document.getElementById('energy-guide-modal').style.display='block'; return false;" 
                               style="color: #00ffff; text-decoration: none; font-size: 0.9em;">
                                ❓ What is energy and why does rental save money?
                            </a>
                        </div>
                    </div>
                `;
                
                // Store resolve function
                window._energyDialogResolve = resolve;
            });
            
            document.body.appendChild(dialog);
        });
    },
    
    // Handle rent energy button
    handleRentEnergy() {
        const dialog = document.getElementById('integrated-energy-dialog');
        if (dialog) dialog.remove();
        
        // ONLY use TronSave
        if (window.StreamlinedEnergyFlow) {
            // Store last params for TronSave
            this.lastParams = {
                documentSizeMB: this.lastDocumentSizeMB || 0,
                recipientCount: this.lastRecipientCount || 1,
                energyDetails: this.lastEnergyDetails || {}
            };
            
            window.StreamlinedEnergyFlow.show({
                energyDetails: this.lastParams.energyDetails,
                documentSizeMB: this.lastParams.documentSizeMB,
                recipientCount: this.lastParams.recipientCount
            });
            return; // Don't show wait dialog for TronSave
        } else if (window.TronSaveAPI) {
            window.TronSaveAPI.showEnergyRentalForm();
            return; // Don't show wait dialog for TronSave
        } else {
            alert('TronSave energy rental is loading. Please try again in a moment.');
            return;
        }
        
        // Show waiting message (this code won't be reached anymore)
        const waitDialog = document.createElement('div');
        waitDialog.id = 'energy-wait-dialog';
        waitDialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid #00ff00;
            border-radius: 10px;
            padding: 20px;
            color: white;
            z-index: 100001;
            text-align: center;
            max-width: 400px;
        `;
        waitDialog.innerHTML = `
            <h3 style="color: #00ff00; margin-bottom: 15px;">⚡ Energy Rental Instructions</h3>
            <ol style="text-align: left; line-height: 1.8;">
                <li>Use the Energy Manager panel to calculate exact needs</li>
                <li>Click on a rental service link</li>
                <li>Complete the rental (takes 10-30 seconds)</li>
                <li>Click "Check Energy" to verify</li>
                <li>Click "Continue" below when ready</li>
            </ol>
            <button onclick="IntegratedEnergyWorkflow.checkEnergyAndContinue()" style="
                margin-top: 15px;
                padding: 10px 20px;
                background: linear-gradient(135deg, #00ff00, #00aa00);
                color: black;
                border: none;
                border-radius: 5px;
                font-weight: bold;
                cursor: pointer;
            ">
                ✅ Check Energy & Continue
            </button>
            <button onclick="IntegratedEnergyWorkflow.cancelWait()" style="
                margin-top: 10px;
                padding: 8px 16px;
                background: #666;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                display: block;
                width: 100%;
            ">
                Cancel
            </button>
        `;
        document.body.appendChild(waitDialog);
        
        if (window._energyDialogResolve) {
            window._energyDialogResolve({ proceed: false, action: 'rent' });
        }
    },
    
    // Handle burn TRX button
    handleBurnTRX() {
        const dialog = document.getElementById('integrated-energy-dialog');
        if (dialog) dialog.remove();
        
        if (window._energyDialogResolve) {
            window._energyDialogResolve({ proceed: true, action: 'burn' });
        }
    },
    
    // Handle cancel button
    handleCancel() {
        const dialog = document.getElementById('integrated-energy-dialog');
        if (dialog) dialog.remove();
        
        if (window._energyDialogResolve) {
            window._energyDialogResolve({ proceed: false, action: 'cancel' });
        }
    },
    
    // Check energy after rental and continue
    async checkEnergyAndContinue() {
        const waitDialog = document.getElementById('energy-wait-dialog');
        if (waitDialog) waitDialog.remove();
        
        // Check energy status
        const status = await window.ManualEnergyRental.checkEnergyStatus();
        const currentEnergy = status?.energy?.total || 0;
        
        if (currentEnergy > 1000000) {
            // Sufficient energy now
            if (window.uiManager) {
                window.uiManager.showNotification('success', 
                    `✅ Energy verified! You have ${currentEnergy.toLocaleString()} energy. Proceeding with transaction...`);
            }
            
            // Resume the transaction
            if (window.createLegalNotice) {
                window.createLegalNotice();
            }
        } else {
            alert(`Energy still insufficient. Current: ${currentEnergy.toLocaleString()}\n\nPlease complete the rental or try a different service.`);
            this.handleRentEnergy();
        }
    },
    
    // Cancel wait dialog
    cancelWait() {
        const waitDialog = document.getElementById('energy-wait-dialog');
        if (waitDialog) waitDialog.remove();
    }
};

// Override the broken JustLend rental function
window.EnergyRental = window.EnergyRental || {};
window.EnergyRental.prepareEnergyForTransaction = async function(energyNeeded, receiverAddress) {
    console.log('🔄 Redirecting to Manual Energy Rental (JustLend disabled)...');
    
    // Calculate document size from current form
    const documentInput = document.getElementById('documentUploadInput');
    const documentSizeMB = documentInput?.files?.[0] ? 
        (documentInput.files[0].size / (1024 * 1024)) : 0;
    
    // Get recipient count
    const recipients = window.getAllRecipients ? window.getAllRecipients() : 
                      [document.getElementById('mintRecipient')?.value.trim() || ''];
    
    // Use integrated workflow
    const result = await window.IntegratedEnergyWorkflow.checkAndPrepareEnergy(
        documentSizeMB, 
        recipients.length
    );
    
    return {
        success: result.proceed,
        skipped: result.action === 'burn',
        action: result.action
    };
};

// Override the staging workflow to use our integrated energy check
if (window.TransactionStaging) {
    const originalExecute = window.TransactionStaging.executeTransaction;
    
    window.TransactionStaging.executeTransaction = async function(transactionId, skipSimulation) {
        console.log('🚀 Using integrated energy workflow for staging...');
        
        // Get transaction data
        const stagedData = await this.getTransaction(transactionId);
        const txData = stagedData.completeData;
        
        // Calculate document size
        const documentSizeMB = txData.data?.documentSize ? 
            (txData.data.documentSize / (1024 * 1024)) : 0;
        
        // Check energy FIRST
        const energyResult = await window.IntegratedEnergyWorkflow.checkAndPrepareEnergy(
            documentSizeMB,
            txData.recipients.length
        );
        
        if (!energyResult.proceed) {
            throw new Error('Transaction cancelled - energy preparation required');
        }
        
        // Continue with original execution
        return originalExecute.call(this, transactionId, true); // Skip the broken simulation
    };
}

// Initialize
console.log('✅ Integrated Energy Workflow loaded');
console.log('   - Manual Energy Rental integrated into transaction flow');
console.log('   - JustLend automated rental disabled');
console.log('   - Energy check happens FIRST before transaction');