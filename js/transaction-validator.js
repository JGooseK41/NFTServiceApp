/**
 * Transaction Validator Module
 * Validates transactions on backend BEFORE renting energy
 * Prevents wasted energy rental on failed transactions
 */

window.TransactionValidator = {
    API_BASE: window.location.hostname === 'localhost' 
        ? 'http://localhost:3001/api/validate'
        : 'https://nftservice-backend.onrender.com/api/validate',
    
    /**
     * Prepare and validate transaction on backend
     * @param {Object} transactionData - Transaction details
     * @param {File} thumbnailFile - Optional thumbnail file
     * @param {File} documentFile - Optional document file
     * @returns {Object} Validation result with transaction ID
     */
    async prepareTransaction(transactionData, thumbnailFile = null, documentFile = null) {
        try {
            console.log('Preparing transaction for validation:', transactionData);
            
            // Create form data
            const formData = new FormData();
            
            // Add transaction data
            formData.append('recipients', JSON.stringify(transactionData.recipients || []));
            formData.append('caseNumber', transactionData.caseNumber || '');
            formData.append('serverAddress', transactionData.serverAddress || '');
            formData.append('noticeType', transactionData.noticeType || 'Legal Notice');
            formData.append('issuingAgency', transactionData.issuingAgency || '');
            formData.append('publicText', transactionData.publicText || '');
            formData.append('hasDocument', transactionData.hasDocument || false);
            formData.append('sponsorFees', transactionData.sponsorFees || false);
            formData.append('network', window.currentNetwork || 'mainnet');
            
            // Add files if provided
            if (thumbnailFile) {
                formData.append('thumbnail', thumbnailFile);
            }
            if (documentFile) {
                formData.append('document', documentFile);
            }
            
            // Send to backend for validation
            const response = await fetch(`${this.API_BASE}/prepare-transaction`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Validation failed');
            }
            
            console.log('Transaction validation result:', result);
            
            // Show validation results to user
            if (result.success) {
                this.showValidationSuccess(result);
            }
            
            return result;
            
        } catch (error) {
            console.error('Transaction preparation error:', error);
            throw error;
        }
    },
    
    /**
     * Execute a prepared transaction after energy is ready
     * @param {string} transactionId - ID from prepare step
     * @param {string} txHash - Blockchain transaction hash
     * @param {number} energyRented - Amount of energy rented
     */
    async executeTransaction(transactionId, txHash, energyRented = 0) {
        try {
            const response = await fetch(`${this.API_BASE}/execute-transaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    transactionId,
                    txHash,
                    energyRented
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Execution failed');
            }
            
            return result;
            
        } catch (error) {
            console.error('Transaction execution error:', error);
            throw error;
        }
    },
    
    /**
     * Get prepared transaction details
     * @param {string} transactionId - Transaction ID to fetch
     */
    async getTransaction(transactionId) {
        try {
            const response = await fetch(`${this.API_BASE}/transaction/${transactionId}`);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to fetch transaction');
            }
            
            return result;
            
        } catch (error) {
            console.error('Error fetching transaction:', error);
            throw error;
        }
    },
    
    /**
     * Show validation success dialog with cost breakdown
     */
    showValidationSuccess(validationResult) {
        const estimates = validationResult.estimates;
        
        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'validation-dialog';
        dialog.innerHTML = `
            <style>
                .validation-dialog {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: var(--gray-900);
                    border: 1px solid var(--gray-700);
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 500px;
                    z-index: 10000;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
                }
                
                .validation-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                }
                
                .validation-header i {
                    color: var(--success);
                    font-size: 24px;
                }
                
                .validation-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }
                
                .validation-content {
                    margin-bottom: 20px;
                }
                
                .cost-breakdown {
                    background: var(--gray-800);
                    border-radius: 8px;
                    padding: 16px;
                    margin: 16px 0;
                }
                
                .cost-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid var(--gray-700);
                }
                
                .cost-row:last-child {
                    border-bottom: none;
                    font-weight: 600;
                    color: var(--success);
                    padding-top: 12px;
                }
                
                .cost-label {
                    color: var(--text-secondary);
                }
                
                .cost-value {
                    color: var(--text-primary);
                }
                
                .validation-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }
                
                .validation-btn {
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }
                
                .validation-btn-primary {
                    background: var(--accent-blue);
                    color: white;
                }
                
                .validation-btn-primary:hover {
                    background: var(--accent-blue-dark);
                }
                
                .validation-btn-secondary {
                    background: var(--gray-700);
                    color: var(--text-primary);
                }
                
                .validation-btn-secondary:hover {
                    background: var(--gray-600);
                }
                
                .warning-box {
                    background: rgba(245, 158, 11, 0.1);
                    border: 1px solid var(--warning);
                    border-radius: 8px;
                    padding: 12px;
                    margin: 16px 0;
                    color: var(--warning);
                    font-size: 0.9rem;
                }
            </style>
            
            <div class="validation-header">
                <i class="fas fa-check-circle"></i>
                <div class="validation-title">Transaction Validated</div>
            </div>
            
            <div class="validation-content">
                <p style="color: var(--text-secondary); margin-bottom: 16px;">
                    Your transaction has been validated and is ready to proceed.
                </p>
                
                <div class="cost-breakdown">
                    <div class="cost-row">
                        <span class="cost-label">Transaction Fee:</span>
                        <span class="cost-value">${estimates.transactionFeeTRX.toFixed(2)} TRX</span>
                    </div>
                    <div class="cost-row">
                        <span class="cost-label">Energy Required:</span>
                        <span class="cost-value">${(estimates.energyRequired / 1000000).toFixed(1)}M</span>
                    </div>
                    <div class="cost-row">
                        <span class="cost-label">Energy Cost (Burning):</span>
                        <span class="cost-value">${estimates.energyCostTRX.toFixed(2)} TRX</span>
                    </div>
                    <div class="cost-row">
                        <span class="cost-label">Energy Cost (Rental):</span>
                        <span class="cost-value">${estimates.rentalCostTRX.toFixed(2)} TRX</span>
                    </div>
                    <div class="cost-row">
                        <span class="cost-label">You Save with Rental:</span>
                        <span class="cost-value">${estimates.savingsWithRental.toFixed(2)} TRX</span>
                    </div>
                </div>
                
                <div class="warning-box">
                    <i class="fas fa-info-circle"></i>
                    Transaction expires in ${validationResult.expiresIn}
                </div>
            </div>
            
            <div class="validation-actions">
                <button class="validation-btn validation-btn-secondary" onclick="this.closest('.validation-dialog').remove()">
                    Cancel
                </button>
                <button class="validation-btn validation-btn-primary" onclick="TransactionValidator.proceedWithEnergy('${validationResult.transactionId}')">
                    Proceed with Energy Rental
                </button>
            </div>
        `;
        
        document.body.appendChild(dialog);
    },
    
    /**
     * Proceed with energy rental after validation
     */
    async proceedWithEnergy(transactionId) {
        try {
            // Close dialog
            document.querySelector('.validation-dialog')?.remove();
            
            // Store transaction ID for later
            window.preparedTransactionId = transactionId;
            
            // Get transaction details
            const txDetails = await this.getTransaction(transactionId);
            const estimates = txDetails.transaction.data;
            
            // Now rent energy
            if (window.EnergyRental) {
                const energyResult = await window.EnergyRental.prepareEnergyForTransaction(
                    estimates.energyRequired || 1500000,
                    window.tronWeb.defaultAddress.base58
                );
                
                if (energyResult.success) {
                    // Energy is ready, now execute the actual blockchain transaction
                    console.log('Energy ready, executing blockchain transaction...');
                    
                    // Call the original create function with prepared data
                    if (window.executePrepparedTransaction) {
                        window.executePrepparedTransaction(transactionId);
                    }
                } else {
                    throw new Error('Energy rental failed');
                }
            }
            
        } catch (error) {
            console.error('Error proceeding with energy:', error);
            if (window.uiManager) {
                window.uiManager.showNotification('error', 'Failed to rent energy: ' + error.message);
            }
        }
    }
};

console.log('Transaction Validator module loaded');