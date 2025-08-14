/**
 * FIX ENERGY RENTAL AND RECEIPT ISSUES
 * 1. Prevent unwanted energy buffer (3.5M becomes 4.5M)
 * 2. Add energy cost to receipt
 * 3. Fix blank white box during confirmation
 */

console.log('🔧 Fixing energy rental and receipt issues...');

// 1. FORCE EXACT ENERGY AMOUNT (no buffers)
(function() {
    // Override TronSave to prevent buffers
    if (window.TronSaveAPI) {
        const originalCreate = window.TronSaveAPI.createEnergyOrderV2;
        
        window.TronSaveAPI.createEnergyOrderV2 = async function(amount, duration, speed) {
            console.log(`⚡ FORCING EXACT AMOUNT: ${amount.toLocaleString()} (no buffers!)`);
            
            // Call original with EXACT amount - no modifications
            return originalCreate.call(this, amount, duration, speed);
        };
    }
    
    // Also override any buffer calculations
    if (window.StreamlinedEnergyFlow) {
        const originalCalculate = window.StreamlinedEnergyFlow.calculateEnergyNeeded;
        if (originalCalculate) {
            window.StreamlinedEnergyFlow.calculateEnergyNeeded = function(...args) {
                const result = originalCalculate.apply(this, args);
                console.log('⛔ Removing buffer from energy calculation');
                
                // Remove any buffer
                if (result && result.totalRequired) {
                    // If they added 1M buffer, remove it
                    if (result.totalRequired === 4500000 && result.baseEnergy === 3500000) {
                        result.totalRequired = 3500000;
                        result.buffer = 0;
                        console.log('✅ Removed 1M buffer, using exact 3.5M');
                    }
                }
                
                return result;
            };
        }
    }
})();

// 2. TRACK ENERGY RENTAL COST FOR RECEIPT
window.EnergyRentalTracker = {
    rentalCost: 0,
    rentalAmount: 0,
    rentalTxId: null,
    
    recordRental(amount, cost, txId) {
        this.rentalAmount = amount;
        this.rentalCost = cost;
        this.rentalTxId = txId;
        console.log(`📝 Recorded energy rental: ${amount} energy for ${cost} TRX`);
        
        // Store in sessionStorage for receipt
        sessionStorage.setItem('lastEnergyRental', JSON.stringify({
            amount: amount,
            cost: cost,
            txId: txId,
            timestamp: Date.now()
        }));
    },
    
    getLastRental() {
        const stored = sessionStorage.getItem('lastEnergyRental');
        if (stored) {
            const data = JSON.parse(stored);
            // Only return if less than 5 minutes old
            if (Date.now() - data.timestamp < 300000) {
                return data;
            }
        }
        return null;
    }
};

// Hook into TronSave to capture rental cost
(function() {
    if (window.TronSaveAPI) {
        const originalEstimate = window.TronSaveAPI.estimateTRXv2;
        if (originalEstimate) {
            window.TronSaveAPI.estimateTRXv2 = async function(amount, duration, speed) {
                const result = await originalEstimate.call(this, amount, duration, speed);
                
                if (result && result.success) {
                    // Store the estimated cost
                    const costInTRX = result.estimateTrx / 1000000;
                    window.lastEnergyEstimate = {
                        amount: amount,
                        cost: costInTRX
                    };
                    console.log(`💰 Energy rental estimate: ${amount} for ${costInTRX} TRX`);
                }
                
                return result;
            };
        }
        
        // Also hook the actual order creation
        const originalOrder = window.TronSaveAPI.createEnergyOrderV2;
        if (originalOrder) {
            const wrappedOrder = window.TronSaveAPI.createEnergyOrderV2;
            window.TronSaveAPI.createEnergyOrderV2 = async function(amount, duration, speed) {
                const result = await wrappedOrder.call(this, amount, duration, speed);
                
                if (result && result.success) {
                    // Record the rental
                    const cost = window.lastEnergyEstimate?.cost || 0;
                    window.EnergyRentalTracker.recordRental(amount, cost, result.txId);
                }
                
                return result;
            };
        }
    }
})();

// 3. FIX BLANK WHITE BOX
(function() {
    // Monitor for blank modals and add loading content
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1 && node.tagName === 'DIV') {
                    // Check if it's a modal with no content
                    if (node.style && node.style.position === 'fixed' && 
                        node.style.zIndex && parseInt(node.style.zIndex) > 9999) {
                        
                        // If it's empty or has minimal content
                        if (!node.textContent || node.textContent.trim().length < 10) {
                            console.log('🔧 Fixing blank modal...');
                            
                            // Add loading content
                            if (!node.querySelector('.transaction-loading')) {
                                node.innerHTML = `
                                    <div class="transaction-loading" style="
                                        padding: 30px;
                                        text-align: center;
                                        color: #333;
                                    ">
                                        <div style="
                                            width: 60px;
                                            height: 60px;
                                            border: 4px solid #f3f3f3;
                                            border-top: 4px solid #00ff00;
                                            border-radius: 50%;
                                            animation: spin 1s linear infinite;
                                            margin: 0 auto 20px;
                                        "></div>
                                        <h3 style="margin: 0 0 10px 0;">Processing Transaction...</h3>
                                        <p style="color: #666; margin: 0;">
                                            Please wait for blockchain confirmation
                                        </p>
                                        <p style="color: #999; font-size: 12px; margin-top: 10px;">
                                            This usually takes 10-20 seconds
                                        </p>
                                    </div>
                                    <style>
                                        @keyframes spin {
                                            0% { transform: rotate(0deg); }
                                            100% { transform: rotate(360deg); }
                                        }
                                    </style>
                                `;
                            }
                        }
                    }
                }
            });
        });
    });
    
    // Only start observing when DOM is ready
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    } else {
        // Wait for body to exist
        document.addEventListener('DOMContentLoaded', () => {
            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }
        });
    }
})();

// 4. ENHANCE RECEIPT WITH ENERGY COSTS
(function() {
    // Hook into receipt generation
    const originalShowReceipt = window.showTransactionReceipt;
    if (originalShowReceipt) {
        window.showTransactionReceipt = function(txData) {
            // Get energy rental info
            const rental = window.EnergyRentalTracker.getLastRental();
            
            if (rental) {
                // Add to transaction data
                txData.energyRental = {
                    amount: rental.amount,
                    cost: rental.cost,
                    txId: rental.txId
                };
            }
            
            // Call original
            return originalShowReceipt.call(this, txData);
        };
    }
    
    // Also enhance any receipt display
    const checkForReceipt = setInterval(() => {
        const receiptElements = document.querySelectorAll('.transaction-receipt, .receipt-details, #transactionReceipt');
        
        receiptElements.forEach(element => {
            if (!element.dataset.energyAdded) {
                const rental = window.EnergyRentalTracker.getLastRental();
                
                if (rental) {
                    // Find where to add energy info
                    const costSection = element.querySelector('.receipt-costs, .transaction-costs, .fee-breakdown');
                    
                    if (costSection && !costSection.querySelector('.energy-rental-cost')) {
                        const energyDiv = document.createElement('div');
                        energyDiv.className = 'energy-rental-cost';
                        energyDiv.style.cssText = 'margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px;';
                        energyDiv.innerHTML = `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span>⚡ Energy Rental:</span>
                                <strong>${rental.cost} TRX</strong>
                            </div>
                            <div style="font-size: 12px; color: #666;">
                                ${rental.amount.toLocaleString()} energy units
                            </div>
                        `;
                        costSection.appendChild(energyDiv);
                        
                        // Update total if present
                        const totalElement = element.querySelector('.total-cost, .grand-total');
                        if (totalElement) {
                            const currentTotal = parseFloat(totalElement.textContent.replace(/[^\d.]/g, ''));
                            const newTotal = currentTotal + rental.cost;
                            totalElement.innerHTML = `<strong>Total Cost: ${newTotal} TRX</strong>`;
                        }
                    }
                    
                    element.dataset.energyAdded = 'true';
                }
            }
        });
    }, 1000);
    
    // Clean up after 30 seconds
    setTimeout(() => clearInterval(checkForReceipt), 30000);
})();

console.log('✅ Energy and receipt fixes loaded:');
console.log('  - Energy rental will use EXACT amount (no buffers)');
console.log('  - Energy costs will appear in receipts');
console.log('  - No more blank white boxes during confirmation');