/**
 * Transaction Energy Estimator
 * Simulates transactions to get exact energy requirements before rental
 */

window.TransactionEstimator = {
    /**
     * Estimate energy for a transaction without executing it
     */
    async estimateTransactionEnergy(contractCall) {
        try {
            console.log('Estimating transaction energy requirements...');
            
            // First, try to trigger the transaction with minimal parameters to get energy requirement
            // This will fail but give us the actual energy needed
            const testResult = await contractCall.send({
                feeLimit: 1000_000_000,
                callValue: 0, // Use 0 for simulation to trigger "Insufficient balance" if energy is the issue
                shouldPollResponse: false
            }).catch(async (error) => {
                console.log('Simulation error (expected):', error.message);
                
                // Parse various error patterns for energy requirements
                const errorMsg = error.message || error.toString();
                
                // Pattern 1: "CONTRACT_EXE_ERROR : Not enough energy for"
                // Pattern 2: "Insufficient energy"
                // Pattern 3: "Need X energy"
                // Pattern 4: "energy required: X"
                // Pattern 5: The transaction may fail with actual energy used in the error
                
                const patterns = [
                    /energy[:\s]+(\d+)/i,
                    /(\d+)\s*energy/i,
                    /need[s]?\s+(\d+)\s+energy/i,
                    /require[ds]?\s+(\d+)\s+energy/i,
                    /energy_required[:\s]+(\d+)/i,
                    /energy_used[:\s]+(\d+)/i,
                    /consumed_energy[:\s]+(\d+)/i
                ];
                
                for (const pattern of patterns) {
                    const match = errorMsg.match(pattern);
                    if (match) {
                        const energy = parseInt(match[1]);
                        if (energy > 0) {
                            console.log('Extracted energy requirement from error:', energy);
                            return {
                                success: true,
                                estimatedEnergy: energy,
                                estimatedBurn: (energy * 420) / 1_000_000,
                                estimatedRental: (energy * 30) / 1_000_000,
                                fromError: true
                            };
                        }
                    }
                }
                
                // If we have Invalid callValue error, it means the transaction would work
                // but we need to estimate based on contract complexity
                if (errorMsg.includes('Invalid callValue') || errorMsg.includes('Insufficient balance')) {
                    console.log('Transaction structure is valid, using default estimates');
                    return this.getDefaultEstimate();
                }
                
                throw error;
            });
            
            // Get the energy estimation from the transaction
            if (transaction && transaction.energy_used) {
                return {
                    success: true,
                    estimatedEnergy: transaction.energy_used,
                    estimatedBurn: (transaction.energy_used * 420) / 1_000_000, // TRX if burned
                    estimatedRental: (transaction.energy_used * 30) / 1_000_000 // TRX if rented
                };
            }
            
            // Fallback: Use contract.method.call() to simulate
            console.log('Trying simulation approach...');
            const simulationResult = await this.simulateTransaction(contractCall);
            return simulationResult;
            
        } catch (error) {
            console.error('Energy estimation error:', error);
            
            // Parse error message for energy requirements
            if (error.message) {
                // Look for patterns like "Need 500000 energy"
                const patterns = [
                    /need\s+(\d+)\s+energy/i,
                    /require\s+(\d+)\s+energy/i,
                    /energy.*?(\d{6,})/i,
                    /(\d{6,}).*energy/i
                ];
                
                for (const pattern of patterns) {
                    const match = error.message.match(pattern);
                    if (match) {
                        const energy = parseInt(match[1]);
                        return {
                            success: true,
                            estimatedEnergy: energy,
                            estimatedBurn: (energy * 420) / 1_000_000,
                            estimatedRental: (energy * 30) / 1_000_000,
                            fromError: true
                        };
                    }
                }
            }
            
            // Default fallback based on transaction type
            return this.getDefaultEstimate();
        }
    },
    
    /**
     * Simulate transaction to get energy cost
     */
    async simulateTransaction(contractCall) {
        try {
            // Get current account resources
            const accountResources = await window.tronWeb.trx.getAccountResources(
                window.tronWeb.defaultAddress.base58
            );
            const currentEnergy = accountResources.EnergyLimit || 0;
            
            console.log('Current energy available:', currentEnergy);
            
            // If we have enough energy, we can simulate
            if (currentEnergy > 100000) {
                // Try to execute with _isConstant flag
                const result = await contractCall.send({
                    feeLimit: 1000_000_000,
                    callValue: 0,
                    _isConstant: true
                });
                
                if (result && result.energy_used) {
                    return {
                        success: true,
                        estimatedEnergy: result.energy_used,
                        estimatedBurn: (result.energy_used * 420) / 1_000_000,
                        estimatedRental: (result.energy_used * 30) / 1_000_000
                    };
                }
            }
            
            // Fallback to default estimate
            return this.getDefaultEstimate();
            
        } catch (error) {
            console.error('Simulation error:', error);
            return this.getDefaultEstimate();
        }
    },
    
    /**
     * Get default estimate based on transaction type
     */
    getDefaultEstimate() {
        // Conservative estimates based on transaction history
        const recipients = window.getAllRecipients ? window.getAllRecipients().length : 1;
        const hasDocument = document.querySelector('input[name="deliveryMethod"]:checked')?.value === 'document';
        
        const baseEnergy = 300000;
        const documentEnergy = hasDocument ? 100000 : 0;
        const perRecipientEnergy = 50000 * (recipients - 1);
        
        const totalEnergy = baseEnergy + documentEnergy + perRecipientEnergy;
        
        return {
            success: true,
            estimatedEnergy: totalEnergy,
            estimatedBurn: (totalEnergy * 420) / 1_000_000,
            estimatedRental: (totalEnergy * 30) / 1_000_000,
            isDefault: true
        };
    },
    
    /**
     * Show energy options dialog
     */
    showEnergyOptionsDialog(estimation, onChoice) {
        // Calculate actual transaction fee
        const recipients = window.getAllRecipients ? window.getAllRecipients() : 
                          [document.getElementById('mintRecipient')?.value.trim() || ''];
        const sponsorFees = document.getElementById('sponsorTransactionFees')?.checked || false;
        const baseFee = 20; // Service fee
        const sponsorshipFee = sponsorFees ? 2 * recipients.length : 0;
        const totalFeeTRX = baseFee + sponsorshipFee;
        
        const dialog = document.createElement('div');
        dialog.className = 'energy-options-dialog';
        dialog.innerHTML = `
            <style>
                .energy-options-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.9);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .energy-options-container {
                    background: #1a1b23;
                    border: 1px solid #2d2e3f;
                    border-radius: 16px;
                    padding: 32px;
                    max-width: 600px;
                    width: 90%;
                }
                
                .energy-title {
                    font-size: 24px;
                    font-weight: 600;
                    color: #fff;
                    margin-bottom: 24px;
                    text-align: center;
                }
                
                .energy-estimate {
                    background: #0f172a;
                    border: 1px solid #1e293b;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 24px;
                }
                
                .estimate-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    color: #94a3b8;
                }
                
                .estimate-value {
                    color: #fff;
                    font-weight: 600;
                }
                
                .energy-option {
                    border: 2px solid #2d2e3f;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 16px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .energy-option:hover {
                    border-color: #3b82f6;
                    background: rgba(59, 130, 246, 0.05);
                }
                
                .option-recommended {
                    border-color: #10b981;
                    background: rgba(16, 185, 129, 0.05);
                }
                
                .option-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #fff;
                    margin-bottom: 8px;
                }
                
                .option-cost {
                    font-size: 24px;
                    font-weight: 700;
                    color: #3b82f6;
                    margin-bottom: 8px;
                }
                
                .option-description {
                    color: #94a3b8;
                    font-size: 14px;
                    line-height: 1.5;
                }
                
                .recommended-badge {
                    display: inline-block;
                    background: #10b981;
                    color: #fff;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    margin-left: 12px;
                }
                
                .energy-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 24px;
                }
                
                .energy-btn {
                    flex: 1;
                    padding: 12px 24px;
                    border-radius: 8px;
                    border: none;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .energy-btn-cancel {
                    background: #374151;
                    color: #d1d5db;
                }
                
                .energy-btn-cancel:hover {
                    background: #4b5563;
                }
                
                .estimate-note {
                    font-size: 12px;
                    color: #64748b;
                    font-style: italic;
                    margin-top: 4px;
                }
                
                .total-cost-summary {
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid #3b82f6;
                    border-radius: 8px;
                    padding: 12px;
                    margin-top: 16px;
                }
                
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    font-weight: 600;
                    color: #3b82f6;
                }
            </style>
            
            <div class="energy-options-overlay">
                <div class="energy-options-container">
                    <h2 class="energy-title">⚡ Choose Energy Payment Method</h2>
                    
                    <div class="energy-estimate">
                        <div class="estimate-row">
                            <span>Energy Required:</span>
                            <span class="estimate-value">${estimation.estimatedEnergy.toLocaleString()} units</span>
                        </div>
                        <div class="estimate-row">
                            <span>Transaction Fee:</span>
                            <span class="estimate-value">${totalFeeTRX} TRX</span>
                        </div>
                        ${estimation.fromError ? '<div class="estimate-note">* Energy estimated from simulation</div>' : ''}
                        ${estimation.isDefault ? '<div class="estimate-note">* Using default estimates</div>' : ''}
                    </div>
                    
                    <div class="energy-option option-recommended" onclick="TransactionEstimator.selectEnergyOption('rent')">
                        <div class="option-title">
                            Rent Energy
                            <span class="recommended-badge">RECOMMENDED</span>
                        </div>
                        <div class="option-cost">~${estimation.estimatedRental.toFixed(2)} TRX</div>
                        <div class="option-description">
                            Rent energy from JustLend marketplace. Save up to 93% compared to burning TRX.
                            Energy rental may take 1-2 minutes to process.
                        </div>
                    </div>
                    
                    <div class="energy-option" onclick="TransactionEstimator.selectEnergyOption('burn')">
                        <div class="option-title">Burn TRX for Energy</div>
                        <div class="option-cost">~${estimation.estimatedBurn.toFixed(2)} TRX</div>
                        <div class="option-description">
                            Pay full price by burning TRX directly. Instant but more expensive.
                            Use this if JustLend is unavailable or you need immediate execution.
                        </div>
                    </div>
                    
                    <div class="total-cost-summary">
                        <div class="total-row">
                            <span>Total with Energy Rental:</span>
                            <span>~${(totalFeeTRX + estimation.estimatedRental).toFixed(2)} TRX</span>
                        </div>
                        <div class="total-row" style="color: #94a3b8; font-weight: normal; font-size: 14px; margin-top: 4px;">
                            <span>Total with Burning:</span>
                            <span>~${(totalFeeTRX + estimation.estimatedBurn).toFixed(2)} TRX</span>
                        </div>
                    </div>
                    
                    <div class="energy-actions">
                        <button class="energy-btn energy-btn-cancel" onclick="TransactionEstimator.cancelTransaction()">
                            Cancel Transaction
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Store callback for user choice
        this.currentChoiceCallback = onChoice;
    },
    
    /**
     * Handle energy option selection
     */
    selectEnergyOption(choice) {
        // Remove dialog
        document.querySelector('.energy-options-overlay')?.remove();
        
        // Execute callback with choice
        if (this.currentChoiceCallback) {
            this.currentChoiceCallback(choice);
            this.currentChoiceCallback = null;
        }
    },
    
    /**
     * Cancel transaction
     */
    cancelTransaction() {
        // Remove dialog
        document.querySelector('.energy-options-overlay')?.remove();
        
        // Execute callback with cancel
        if (this.currentChoiceCallback) {
            this.currentChoiceCallback('cancel');
            this.currentChoiceCallback = null;
        }
    }
};

console.log('Transaction Energy Estimator loaded');