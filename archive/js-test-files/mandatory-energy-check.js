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
        
        // Calculate document size - check multiple sources
        const documentInput = document.getElementById('documentUploadInput');
        let documentSizeMB = 0;
        
        if (documentInput?.files?.[0]) {
            documentSizeMB = documentInput.files[0].size / (1024 * 1024);
            console.log('📄 Document from input:', documentSizeMB.toFixed(2), 'MB');
        } else if (window.encryptedDocumentBlob) {
            documentSizeMB = window.encryptedDocumentBlob.size / (1024 * 1024);
            console.log('📄 Document from encrypted blob:', documentSizeMB.toFixed(2), 'MB');
        } else if (window.currentDocumentSize) {
            documentSizeMB = window.currentDocumentSize / (1024 * 1024);
            console.log('📄 Document from stored size:', documentSizeMB.toFixed(2), 'MB');
        }
        
        // OVERRIDE: If we know it's a large document, use 2.5MB minimum
        if (documentSizeMB > 0 && documentSizeMB < 2.5) {
            console.log('⚠️ Document detected but seems small, using 2.5MB minimum for safety');
            documentSizeMB = 2.5;
        } else if (documentSizeMB === 0) {
            console.log('⚠️ No document size detected - assuming 2.5MB document for safety');
            documentSizeMB = 2.5;
        }
        
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
        
        // Calculate document size - check multiple sources
        const documentInput = document.getElementById('documentUploadInput');
        let documentSizeMB = 0;
        
        if (documentInput?.files?.[0]) {
            documentSizeMB = documentInput.files[0].size / (1024 * 1024);
            console.log('📄 Document from input:', documentSizeMB.toFixed(2), 'MB');
        } else if (window.encryptedDocumentBlob) {
            documentSizeMB = window.encryptedDocumentBlob.size / (1024 * 1024);
            console.log('📄 Document from encrypted blob:', documentSizeMB.toFixed(2), 'MB');
        } else if (window.currentDocumentSize) {
            documentSizeMB = window.currentDocumentSize / (1024 * 1024);
            console.log('📄 Document from stored size:', documentSizeMB.toFixed(2), 'MB');
        }
        
        // OVERRIDE: If we know it's a large document, use 2.5MB minimum
        if (documentSizeMB > 0 && documentSizeMB < 2.5) {
            console.log('⚠️ Document detected but seems small, using 2.5MB minimum for safety');
            documentSizeMB = 2.5;
        } else if (documentSizeMB === 0) {
            console.log('⚠️ No document size detected - assuming 2.5MB document for safety');
            documentSizeMB = 2.5;
        }
        
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
        
        const needsRental = params.currentEnergy < params.energyDetails.total;
        
        console.log('🔍 Energy check:');
        console.log('   Current energy:', params.currentEnergy?.toLocaleString());
        console.log('   Required energy:', params.energyDetails.total?.toLocaleString());
        console.log('   Needs rental?', needsRental);
        
        // ALWAYS use StreamlinedEnergyFlow for the UI
        if (window.StreamlinedEnergyFlow) {
            window.StreamlinedEnergyFlow.show({
                energyDetails: params.energyDetails,
                documentSizeMB: params.documentSizeMB,
                recipientCount: params.recipientCount,
                currentEnergy: params.currentEnergy,
                originalFunction: params.originalFunction
            });
            return;
        }
        
        // Fallback if StreamlinedEnergyFlow not loaded
        if (!needsRental) {
            // Have enough energy - proceed
            console.log('✅ Sufficient energy - proceeding with transaction');
            this.proceedWithTransaction(params.originalFunction);
            return;
        }
        
        // Need rental - open TronSave
        this.openRentalServices();
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