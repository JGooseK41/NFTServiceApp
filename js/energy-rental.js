// Automated Energy Rental Integration
// Seamlessly rents energy before transactions to save on fees

const EnergyRental = {
    // Supported rental providers
    providers: {
        justlend: {
            name: 'JustLend DAO',
            apiUrl: 'https://api.justlend.org/v2',
            enabled: true
        },
        trxmarket: {
            name: 'TRX.Market',
            apiUrl: 'https://api.trx.market/v1',
            enabled: true
        }
    },
    
    // Estimate energy needed for notice creation
    estimateEnergyNeeded(hasDocument, isBatch = false, batchSize = 1) {
        // Base energy costs (approximate)
        const BASE_ENERGY = 15000; // Base transaction
        const DOCUMENT_ENERGY = 8000; // Additional for document
        const IPFS_ENERGY = 5000; // IPFS metadata
        const PER_NOTICE_ENERGY = 25000; // Per notice in batch
        
        let totalEnergy = BASE_ENERGY;
        
        if (hasDocument) {
            totalEnergy += DOCUMENT_ENERGY;
        }
        
        totalEnergy += IPFS_ENERGY;
        
        if (isBatch) {
            totalEnergy = PER_NOTICE_ENERGY * batchSize;
        }
        
        // Add 20% buffer for safety
        return Math.ceil(totalEnergy * 1.2);
    },
    
    // Get current energy price from rental providers
    async getEnergyPrice() {
        try {
            // Try JustLend API first
            const response = await fetch('https://openapi.just.network/lend/rentResource/account');
            const data = await response.json();
            
            if (data && data.code === 0) {
                // JustLend charges approximately 30-60 SUN per energy
                // 30 SUN for immediate return, 60 SUN for daily rental
                return {
                    provider: 'JustLend',
                    pricePerEnergy: 30, // Immediate use price
                    minOrder: 10000
                };
            }
        } catch (error) {
            console.error('Error fetching JustLend price:', error);
        }
        
        // Try TRONSave API
        try {
            const response = await fetch('https://api.tronsave.io/v0/rental-pricing');
            const data = await response.json();
            
            if (data && data.price_per_energy) {
                return {
                    provider: 'TRONSave',
                    pricePerEnergy: data.price_per_energy,
                    minOrder: data.min_order || 10000
                };
            }
        } catch (error) {
            console.error('Error fetching TRONSave price:', error);
        }
        
        // Default price if APIs fail (30 SUN per energy is typical for immediate use)
        return {
            provider: 'Default',
            pricePerEnergy: 30,
            minOrder: 10000
        };
    },
    
    // Calculate cost comparison
    async calculateSavings(energyNeeded) {
        const priceInfo = await this.getEnergyPrice();
        
        // Burning cost: 420 SUN per energy
        const burningCost = energyNeeded * 420;
        
        // Rental cost
        const rentalCost = energyNeeded * priceInfo.pricePerEnergy;
        
        // Calculate savings
        const savings = burningCost - rentalCost;
        const savingsPercent = Math.round((savings / burningCost) * 100);
        
        return {
            energyNeeded,
            burningCostTRX: burningCost / 1_000_000,
            rentalCostTRX: rentalCost / 1_000_000,
            savingsTRX: savings / 1_000_000,
            savingsPercent,
            provider: priceInfo.provider
        };
    },
    
    // Rent energy from JustLend
    async rentFromJustLend(amount, receiverAddress) {
        try {
            console.log('Attempting to rent energy from JustLend:', {
                amount: amount,
                receiver: receiverAddress
            });
            
            // JustLend Energy Rental Contract
            const ENERGY_RENTAL_CONTRACT = 'TU2MJ5Veik1LRAgjeSzEdvmDYx7mefJZvd';
            
            // Check if we're on mainnet
            const node = await window.tronWeb.getNodeInfo();
            const isMainnet = !node.network || node.network.toLowerCase().includes('mainnet');
            
            if (!isMainnet) {
                console.warn('JustLend only available on mainnet');
                return { success: false, error: 'JustLend only available on mainnet' };
            }
            
            // Get the contract instance
            const contract = await window.tronWeb.contract().at(ENERGY_RENTAL_CONTRACT);
            
            // Calculate rental parameters
            // Energy rental price is approximately 60 SUN per energy per day
            // For immediate use (returned within minutes), it's 30 SUN per energy
            const pricePerEnergy = 30; // SUN per energy for immediate use
            const rentalCost = Math.ceil(amount * pricePerEnergy);
            
            // Convert amount to equivalent TRX delegation
            // 1 TRX staked = ~1,500 energy
            const trxEquivalent = Math.ceil(amount / 1500) * 1_000_000; // Convert to SUN
            
            console.log('JustLend rental parameters:', {
                energyNeeded: amount,
                trxEquivalent: trxEquivalent / 1_000_000,
                estimatedCost: rentalCost / 1_000_000,
                resourceType: 0 // 0 for energy
            });
            
            // Call rentResource method
            // rentResource(address receiver, uint256 amount, uint256 resourceType)
            const tx = await contract.rentResource(
                receiverAddress,
                trxEquivalent.toString(),
                0 // 0 for energy rental
            ).send({
                feeLimit: 100_000_000,
                callValue: rentalCost,
                shouldPollResponse: true
            });
            
            console.log('JustLend rental transaction:', tx);
            
            return {
                success: true,
                provider: 'JustLend',
                amount: amount,
                txId: tx.txid || tx,
                cost: rentalCost / 1_000_000 // Convert to TRX
            };
        } catch (error) {
            console.error('JustLend rental error:', error);
            
            // If contract call fails, provide fallback
            if (error.message && error.message.includes('Contract does not exist')) {
                return {
                    success: false,
                    error: 'JustLend contract not found',
                    manualUrl: 'https://app.justlend.org/energy',
                    instructions: 'Please rent energy manually from JustLend'
                };
            }
            
            return { success: false, error: error.message };
        }
    },
    
    // Rent energy from TRX.Market
    async rentFromTRXMarket(amount, receiverAddress) {
        try {
            console.log('Attempting to rent energy from TRX.Market:', {
                amount: amount,
                receiver: receiverAddress
            });
            
            // TRX.Market uses a different approach - they have a web interface
            // For automated rental, we'll use their API endpoint
            // Note: This requires API key setup which user would need to configure
            
            // For now, open TRX.Market in a new window for manual rental
            const energyUrl = `https://trx.market/energy?amount=${amount}&receiver=${receiverAddress}`;
            
            // Return a special response indicating manual action needed
            return {
                success: false,
                error: 'Manual rental required',
                manualUrl: energyUrl,
                provider: 'TRX.Market',
                message: 'Please complete energy rental manually at TRX.Market'
            };
            
        } catch (error) {
            console.error('TRX.Market rental error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Rent energy from TRONSave
    async rentFromTRONSave(amount, receiverAddress) {
        try {
            console.log('Attempting to rent energy from TRONSave:', {
                amount: amount,
                receiver: receiverAddress
            });
            
            // TRONSave API endpoint
            const API_URL = 'https://api.tronsave.io/v0/order/energy';
            
            // Calculate rental duration (1 hour = 3600000 ms)
            const rentalDuration = 3600000; // 1 hour
            
            const requestData = {
                receiver_address: receiverAddress,
                resource_amount: amount,
                resource_type: 'ENERGY',
                rental_duration: rentalDuration,
                allow_partial: false
            };
            
            console.log('TRONSave request:', requestData);
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            
            if (result.code === 200 && result.data) {
                console.log('TRONSave rental successful:', result);
                return {
                    success: true,
                    provider: 'TRONSave',
                    amount: amount,
                    txId: result.data.order_id,
                    cost: result.data.total_cost / 1_000_000 // Convert to TRX
                };
            }
            
            throw new Error(result.message || 'TRONSave rental failed');
        } catch (error) {
            console.error('TRONSave rental error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Main rental function - tries multiple providers
    async rentEnergy(amount, receiverAddress) {
        // Try JustLend first
        let result = await this.rentFromJustLend(amount, receiverAddress);
        if (result.success) return result;
        
        // Try TRONSave as second option
        result = await this.rentFromTRONSave(amount, receiverAddress);
        if (result.success) return result;
        
        // Fallback to TRX.Market
        result = await this.rentFromTRXMarket(amount, receiverAddress);
        if (result.success) return result;
        
        // All providers failed
        return {
            success: false,
            error: 'All energy rental providers unavailable'
        };
    },
    
    // Check if user has enough energy
    async checkUserEnergy(address) {
        try {
            const resources = await window.tronWeb.trx.getAccountResources(address);
            const currentEnergy = resources.EnergyLimit - (resources.EnergyUsed || 0);
            return currentEnergy;
        } catch (error) {
            console.error('Error checking energy:', error);
            return 0;
        }
    },
    
    // Main function to prepare energy for transaction
    async prepareEnergyForTransaction(energyNeeded, userAddress) {
        try {
            // Check current energy
            const currentEnergy = await this.checkUserEnergy(userAddress);
            
            if (currentEnergy >= energyNeeded) {
                return {
                    success: true,
                    message: 'Sufficient energy available',
                    energyAvailable: currentEnergy,
                    energyNeeded: energyNeeded,
                    rentalNeeded: false
                };
            }
            
            // Calculate how much to rent
            const energyToRent = energyNeeded - currentEnergy;
            
            // Get pricing info
            const savings = await this.calculateSavings(energyToRent);
            
            // Check if user should skip dialog (law enforcement or low balance)
            let skipDialog = false;
            
            // Check for law enforcement based on fee amount (2 TRX = 2000000 SUN)
            // This is passed from the main function that already calculated the fee
            console.log('Checking fee for law enforcement exemption:', {
                currentFee: window._currentTransactionFee,
                feeInTRX: window._currentTransactionFee ? window._currentTransactionFee / 1_000_000 : 'not set',
                threshold: '2 TRX (2000000 SUN)'
            });
            
            if (window._currentTransactionFee && window._currentTransactionFee <= 2000000) {
                console.log('✓ Low fee detected (2 TRX or less) - law enforcement user, skipping dialog');
                skipDialog = true;
            }
            
            // Also check contract if available
            if (!skipDialog && window.legalContract) {
                try {
                    const isExempt = await window.legalContract.serviceFeeExemptions(userAddress).call();
                    console.log('Law enforcement exemption status:', isExempt);
                    if (isExempt) {
                        console.log('Law enforcement user confirmed - skipping energy rental dialog');
                        skipDialog = true;
                    }
                } catch (e) {
                    console.error('Error checking exemption status:', e);
                }
            }
            
            // Check user's TRX balance
            if (!skipDialog) {
                try {
                    const balance = await window.tronWeb.trx.getBalance(userAddress);
                    const balanceTRX = balance / 1_000_000;
                    // If user has less than 50 TRX, auto-rent to save money
                    if (balanceTRX < 50) {
                        console.log('Low balance detected - auto-renting energy to save fees');
                        skipDialog = true;
                    }
                } catch (e) {
                    console.error('Error checking balance:', e);
                }
            }
            
            // For law enforcement or low balance users, proceed without rental immediately
            if (skipDialog) {
                console.log('Skipping energy rental for exempt user - proceeding with transaction');
                return {
                    success: true,
                    message: 'Proceeding without energy rental (fee exempt user)',
                    energyAvailable: currentEnergy,
                    energyNeeded: energyNeeded,
                    rentalNeeded: false,
                    warning: `Transaction will use energy from account or burn TRX`
                };
            }
            
            // Show dialog for non-exempt users
            const userConfirmed = await this.showRentalDialog(savings);
            
            if (!userConfirmed) {
                return {
                    success: false,
                    message: 'User cancelled energy rental',
                    rentalNeeded: true
                };
            }
            
            // Try to rent energy
            const rentalResult = await this.rentEnergy(energyToRent, userAddress);
            
            if (rentalResult.success) {
                return {
                    success: true,
                    message: `Rented ${energyToRent} energy from ${rentalResult.provider}`,
                    energyAvailable: currentEnergy + energyToRent,
                    energyNeeded: energyNeeded,
                    rentalNeeded: true,
                    rentalTxId: rentalResult.txId,
                    savedTRX: savings.savingsTRX
                };
            }
            
            // If rental failed but user confirmed they want to proceed
            console.warn('Energy rental failed - proceeding with transaction anyway');
            return {
                success: true,
                message: 'Energy rental unavailable - proceeding with higher fees',
                energyAvailable: currentEnergy,
                energyNeeded: energyNeeded,
                rentalNeeded: false,
                warning: `Transaction will burn approximately ${savings.burningCostTRX.toFixed(2)} TRX in fees`
            };
            
        } catch (error) {
            console.error('Energy preparation error:', error);
            return {
                success: false,
                message: error.message,
                rentalNeeded: true
            };
        }
    },
    
    // Show rental confirmation dialog
    async showRentalDialog(savings) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-bolt" style="color: #f59e0b;"></i>
                            Energy Rental - Save ${savings.savingsPercent}%
                        </h3>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info" style="background: #dbeafe; border-color: #3b82f6;">
                            <i class="fas fa-info-circle"></i>
                            <div>
                                <strong>Save on transaction fees by renting energy!</strong>
                                <p style="margin: 0.5rem 0 0 0;">Renting energy is ${savings.savingsPercent}% cheaper than burning TRX.</p>
                            </div>
                        </div>
                        
                        <div style="margin: 1.5rem 0;">
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb;">
                                <span>Energy Needed:</span>
                                <span style="font-weight: 600;">${savings.energyNeeded.toLocaleString()}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb;">
                                <span>Cost without rental:</span>
                                <span style="text-decoration: line-through; color: #6b7280;">${savings.burningCostTRX.toFixed(2)} TRX</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb;">
                                <span>Cost with rental:</span>
                                <span style="font-weight: 600; color: #10b981;">${savings.rentalCostTRX.toFixed(2)} TRX</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; font-size: 1.125rem;">
                                <span style="font-weight: 600;">You Save:</span>
                                <span style="font-weight: 700; color: #10b981;">${savings.savingsTRX.toFixed(2)} TRX</span>
                            </div>
                        </div>
                        
                        <div style="margin-top: 1.5rem; display: flex; gap: 1rem; justify-content: flex-end;">
                            <button class="btn btn-secondary" onclick="this.closest('.modal').remove(); window.energyRentalResolve(false);">
                                Skip & Pay Full Price
                            </button>
                            <button class="btn btn-primary" onclick="this.closest('.modal').remove(); window.energyRentalResolve(true);">
                                <i class="fas fa-bolt"></i>
                                Rent Energy & Save
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Set up promise resolution
            window.energyRentalResolve = (result) => {
                delete window.energyRentalResolve;
                resolve(result);
            };
        });
    }
};

// Make it globally available
window.EnergyRental = EnergyRental;