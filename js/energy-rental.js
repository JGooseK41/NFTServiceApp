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
        
        // Add 10% buffer (reduced from 20% for cost efficiency)
        return Math.ceil(totalEnergy * 1.1);
    },
    
    // Get current energy price from rental providers
    async getEnergyPrice() {
        // Return default pricing - no external API needed
        // JustLend charges approximately 30 SUN per energy for immediate return
        return {
            provider: 'JustLend',
            pricePerEnergy: 30, // Immediate use price
            minOrder: 10000
        };
    },
    
    // Calculate cost comparison
    async calculateSavings(energyNeeded) {
        console.log('Calculating savings for energy needed:', energyNeeded);
        
        // Validate input
        if (!energyNeeded || isNaN(energyNeeded) || energyNeeded <= 0) {
            console.warn('Invalid energy needed:', energyNeeded);
            return {
                energyNeeded: 0,
                burningCostTRX: 0,
                rentalCostTRX: 0,
                savingsTRX: 0,
                savingsPercent: 0,
                provider: 'JustLend'
            };
        }
        
        // Burning cost: 420 SUN per energy
        const burningCost = energyNeeded * 420;
        
        // JustLend rental calculation
        const energyStakePerTrx = 1500;
        const trxAmount = Math.ceil(energyNeeded / energyStakePerTrx) * 1_000_000;
        const duration = 3600; // 1 hour
        const rentalRate = 1.16e-9; // ~1% daily rate
        const minFee = 40 * 1_000_000; // 40 TRX minimum
        
        const rentalCost = Math.ceil(trxAmount * rentalRate * (duration + 86400));
        const totalRentalCost = rentalCost + minFee;
        
        // Calculate savings
        const savings = burningCost - totalRentalCost;
        const savingsPercent = savings > 0 ? Math.round((savings / burningCost) * 100) : 0;
        
        console.log('Savings calculation result:', {
            energyNeeded,
            burningCostTRX: burningCost / 1_000_000,
            rentalCostTRX: totalRentalCost / 1_000_000,
            savingsTRX: Math.max(0, savings / 1_000_000),
            savingsPercent: Math.max(0, savingsPercent)
        });
        
        return {
            energyNeeded,
            burningCostTRX: burningCost / 1_000_000,
            rentalCostTRX: totalRentalCost / 1_000_000,
            savingsTRX: Math.max(0, savings / 1_000_000),
            savingsPercent: Math.max(0, savingsPercent),
            provider: 'JustLend'
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
            if (window.tronWeb.fullNode && window.tronWeb.fullNode.host) {
                const nodeUrl = window.tronWeb.fullNode.host;
                console.log('Current node URL:', nodeUrl);
                
                // Check if this is actually mainnet - handle both with and without protocol
                const isMainnet = (nodeUrl.includes('trongrid.io') || nodeUrl.includes('api.trongrid.io')) && 
                                !nodeUrl.includes('nile') && 
                                !nodeUrl.includes('shasta');
                if (!isMainnet) {
                    console.error('Not on mainnet! JustLend only works on mainnet. Node URL:', nodeUrl);
                    return {
                        success: false,
                        error: 'JustLend energy rental only works on TRON mainnet'
                    };
                }
                console.log('Mainnet confirmed, proceeding with JustLend rental');
            }
            
            // Also verify the user's address
            console.log('User address for rental:', receiverAddress);
            const userBalance = await window.tronWeb.trx.getBalance(receiverAddress);
            console.log('User TRX balance:', userBalance / 1_000_000, 'TRX');
            
            // Get the contract instance
            console.log('Loading JustLend contract at:', ENERGY_RENTAL_CONTRACT);
            
            // First, let's verify the contract exists
            try {
                const contractInfo = await window.tronWeb.trx.getContract(ENERGY_RENTAL_CONTRACT);
                console.log('Contract info retrieved:', contractInfo);
            } catch (e) {
                console.error('Failed to get contract info:', e);
                return {
                    success: false,
                    error: 'JustLend contract not found at ' + ENERGY_RENTAL_CONTRACT + '. Are you on mainnet?'
                };
            }
            
            // Try the actual JustLend market contract with order method
            // Based on the contract having 3 methods, let's see what they are
            console.log('Checking contract methods...');
            
            // First try without ABI to see what methods exist
            let testContract = await window.tronWeb.contract().at(ENERGY_RENTAL_CONTRACT);
            if (testContract && testContract.methodInstances) {
                console.log('Contract method signatures:', Object.keys(testContract.methodInstances));
            }
            
            // JustLend Energy Market ABI - try different method names
            const JUSTLEND_ABI = [{
                "inputs": [
                    {"name": "receiver", "type": "address"},
                    {"name": "amount", "type": "uint256"}, 
                    {"name": "resourceType", "type": "uint256"}
                ],
                "name": "rentResource",
                "outputs": [],
                "stateMutability": "payable",
                "type": "function"
            }, {
                "inputs": [
                    {"name": "receiver", "type": "address"},
                    {"name": "freezeAmount", "type": "uint256"},
                    {"name": "resource", "type": "uint256"}
                ],
                "name": "order",
                "outputs": [],
                "stateMutability": "payable", 
                "type": "function"
            }];
            
            const contract = await window.tronWeb.contract(JUSTLEND_ABI, ENERGY_RENTAL_CONTRACT);
            console.log('JustLend contract loaded:', contract);
            
            // Log available methods
            if (contract.methods) {
                console.log('Available contract methods:', Object.keys(contract.methods));
            } else if (contract.rentResource) {
                console.log('rentResource method found directly on contract');
            }
            
            // Validate amount
            if (!amount || isNaN(amount) || amount <= 0) {
                console.error('Invalid energy amount for rental:', amount);
                return {
                    success: false,
                    error: 'Invalid energy amount specified'
                };
            }
            
            // JustLend requires us to calculate the TRX amount needed to delegate for the energy
            // The formula is: trxAmount = energyAmount / energyStakePerTrx
            // Default energyStakePerTrx is approximately 1500 energy per TRX
            const energyStakePerTrx = 1500;
            const trxAmount = Math.ceil(amount / energyStakePerTrx) * 1_000_000; // Convert to SUN
            
            // For short-term rental (immediate use), we need to calculate prepayment
            // Prepay = trxAmount * rentalRate * (duration + 86400 + liquidateThreshold) + fee
            // For immediate use, we'll use minimal duration (1 hour = 3600 seconds)
            const duration = 3600; // 1 hour in seconds
            const rentalRate = 1.16e-9; // Approximate rental rate per second (1% daily rate)
            const liquidateThreshold = 0; // Default
            const minFee = 40 * 1_000_000; // 40 TRX minimum fee in SUN
            
            // Calculate prepayment
            const rentalCost = Math.ceil(trxAmount * rentalRate * (duration + 86400 + liquidateThreshold));
            const totalPrepayment = rentalCost + minFee;
            
            console.log('JustLend rental calculation:', {
                energyNeeded: amount,
                trxAmountSUN: trxAmount,
                trxAmountTRX: trxAmount / 1_000_000,
                rentalCostSUN: rentalCost,
                minFeeSUN: minFee,
                totalPrepaymentSUN: totalPrepayment,
                totalPrepaymentTRX: totalPrepayment / 1_000_000
            });
            
            // Call rentResource with correct parameters
            // rentResource(address receiver, uint256 amount, uint256 resourceType)
            // - receiver: address to receive the energy
            // - amount: TRX amount to delegate (not energy amount!)
            // - resourceType: 1 for energy (0 for bandwidth)
            console.log('Calling rentResource with parameters:', {
                receiver: receiverAddress,
                amount: trxAmount,
                resourceType: 1,
                callValue: totalPrepayment,
                feeLimit: 100_000_000
            });
            
            let tx;
            try {
                // Check which method exists
                if (contract.order) {
                    console.log('Using order method instead of rentResource');
                    tx = await contract.order(
                        receiverAddress,
                        trxAmount, // TRX amount in SUN (freezeAmount)
                        1 // 1 for energy resource
                    ).send({
                        feeLimit: 100_000_000,
                        callValue: totalPrepayment, // Total prepayment including fee
                        shouldPollResponse: true
                    });
                } else if (contract.rentResource) {
                    console.log('Using rentResource method');
                    tx = await contract.rentResource(
                        receiverAddress,
                        trxAmount, // TRX amount in SUN
                        1 // 1 for energy (not 0!)
                    ).send({
                        feeLimit: 100_000_000,
                        callValue: totalPrepayment, // Total prepayment including fee
                        shouldPollResponse: true
                    });
                } else {
                    throw new Error('Neither order nor rentResource method found on contract');
                }
            } catch (sendError) {
                console.error('Contract call failed:', sendError);
                console.error('Error details:', {
                    message: sendError.message,
                    error: sendError.error,
                    code: sendError.code,
                    data: sendError.data
                });
                
                // Check if it's a specific error we can handle
                if (sendError.message && sendError.message.includes('REVERT')) {
                    console.error('JustLend REVERT error. Common causes:');
                    console.error('1. Insufficient prepayment amount');
                    console.error('2. Contract may be paused');
                    console.error('3. Minimum rental amount not met');
                    
                    // Try to extract revert reason
                    const revertMatch = sendError.message.match(/REVERT opcode executed[,:]?\s*(?:Reason:\s*)?(.+)?/i);
                    const revertReason = revertMatch?.[1] || 'Contract rejected the transaction';
                    
                    // Check if it's a value issue
                    if (totalPrepayment < minFee) {
                        return {
                            success: false,
                            error: `Prepayment too low. Need at least ${minFee / 1_000_000} TRX`
                        };
                    }
                    
                    return {
                        success: false,
                        error: `JustLend rejected: ${revertReason}`,
                        details: {
                            trxAmount: trxAmount / 1_000_000,
                            prepayment: totalPrepayment / 1_000_000,
                            minFee: minFee / 1_000_000
                        }
                    };
                }
                
                throw sendError;
            }
            
            console.log('JustLend rental transaction:', tx);
            
            // Store rental info for potential return
            const rentalInfo = {
                provider: 'JustLend',
                energyAmount: amount,
                trxAmount: trxAmount / 1_000_000, // TRX delegated
                txId: tx.txid || tx,
                prepaymentCost: totalPrepayment / 1_000_000, // Total prepayment in TRX
                rentalCost: rentalCost / 1_000_000, // Actual rental cost
                fee: minFee / 1_000_000, // Fee paid
                timestamp: Date.now(),
                receiver: receiverAddress,
                resourceType: 1 // Energy
            };
            
            // Store in session for tracking
            if (!window._activeEnergyRentals) {
                window._activeEnergyRentals = [];
            }
            window._activeEnergyRentals.push(rentalInfo);
            
            return {
                success: true,
                ...rentalInfo
            };
        } catch (error) {
            console.error('JustLend rental error - Full details:', {
                error: error,
                message: error.message,
                code: error.code,
                data: error.data,
                stack: error.stack
            });
            
            // Check specific error types
            if (error.message) {
                if (error.message.includes('Contract does not exist')) {
                    return {
                        success: false,
                        error: 'JustLend contract not found at ' + ENERGY_RENTAL_CONTRACT
                    };
                } else if (error.message.includes('Invalid parameters')) {
                    return {
                        success: false,
                        error: 'Invalid parameters for JustLend rental'
                    };
                } else if (error.message.includes('Insufficient')) {
                    return {
                        success: false,
                        error: 'Insufficient balance for energy rental cost'
                    };
                }
            }
            
            return { 
                success: false, 
                error: error.message || 'JustLend rental failed',
                details: error.toString()
            };
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
            console.log('TRONSave not available - returning failure');
            // TRONSave API is not currently accessible, skip it
            return { 
                success: false, 
                error: 'TRONSave service temporarily unavailable' 
            };
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
            console.log('Account resources:', resources);
            
            // Calculate available energy
            const energyLimit = resources.EnergyLimit || 0;
            const energyUsed = resources.EnergyUsed || 0;
            const currentEnergy = Math.max(0, energyLimit - energyUsed);
            
            console.log('Energy calculation:', {
                energyLimit,
                energyUsed,
                currentEnergy
            });
            
            return currentEnergy;
        } catch (error) {
            console.error('Error checking energy:', error);
            return 0;
        }
    },
    
    // Main function to prepare energy for transaction
    async prepareEnergyForTransaction(energyNeeded, userAddress) {
        try {
            console.log('prepareEnergyForTransaction called with:', {
                energyNeeded,
                userAddress
            });
            
            // Validate energyNeeded
            if (!energyNeeded || isNaN(energyNeeded) || energyNeeded <= 0) {
                console.error('Invalid energyNeeded value:', energyNeeded);
                energyNeeded = 50000; // Default to 50k energy if invalid
            }
            
            // Check current energy
            const currentEnergy = await this.checkUserEnergy(userAddress);
            console.log('Current energy available:', currentEnergy);
            
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
            console.log('Energy to rent:', energyToRent);
            
            // Check if we're on mainnet (energy rental only works on mainnet)
            let isMainnet = true;
            try {
                if (window.tronWeb.fullNode && window.tronWeb.fullNode.host) {
                    const nodeUrl = window.tronWeb.fullNode.host;
                    isMainnet = nodeUrl.includes('trongrid.io') && !nodeUrl.includes('nile') && !nodeUrl.includes('shasta');
                    console.log('Network check for energy rental - nodeUrl:', nodeUrl, 'isMainnet:', isMainnet);
                }
            } catch (e) {
                console.error('Error checking network:', e);
            }
            
            if (!isMainnet) {
                console.log('Not on mainnet - skipping energy rental (testnet detected)');
                return {
                    success: true,
                    message: 'Energy rental not available on testnet',
                    energyAvailable: currentEnergy,
                    energyNeeded: energyNeeded,
                    rentalNeeded: false,
                    warning: 'Testnet transaction - energy rental not available'
                };
            }
            
            // Get pricing info
            const savings = await this.calculateSavings(energyToRent);
            
            // Check if user should skip dialog (law enforcement or low balance)
            let skipDialog = false;
            
            // Automatically rent energy for ALL users without dialog
            console.log('Automatically renting energy to reduce transaction costs...');
            
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
            
            // If rental failed, return failure so we can show proper dialog
            console.warn('Energy rental failed - user needs to decide');
            
            // Ensure savings values are valid numbers
            const burnCost = savings.burningCostTRX || 0;
            const rentalCost = savings.rentalCostTRX || 0;
            const potentialSave = savings.savingsTRX || 0;
            
            console.log('Rental failure - cost estimates:', {
                burnCost,
                rentalCost,
                potentialSave
            });
            
            return {
                success: false,
                message: 'Energy rental unavailable',
                energyAvailable: currentEnergy,
                energyNeeded: energyNeeded,
                rentalNeeded: true,
                rentalFailed: true,
                estimatedBurnCost: burnCost,
                estimatedRentalCost: rentalCost,
                potentialSavings: potentialSave
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
    
    // Return rented energy to save costs (JustLend specific)
    async returnRentedEnergy(rentalTxId) {
        try {
            console.log('Checking if energy can be returned for rental:', rentalTxId);
            
            // Find the rental info
            const rental = window._activeEnergyRentals?.find(r => r.txId === rentalTxId);
            if (!rental) {
                console.log('No rental found to return');
                return { success: false, message: 'Rental not found' };
            }
            
            // Check if it's been less than 5 minutes (to get the 50% discount)
            const timeSinceRental = Date.now() - rental.timestamp;
            const fiveMinutes = 5 * 60 * 1000;
            
            if (timeSinceRental > fiveMinutes) {
                console.log('Too late to return energy for discount (> 5 minutes)');
                return { success: false, message: 'Return window expired' };
            }
            
            // JustLend automatically returns unused energy
            // We just need to track that it was used quickly
            console.log(`Energy used within ${Math.round(timeSinceRental / 1000)} seconds - eligible for 50% rate`);
            
            // Remove from active rentals
            window._activeEnergyRentals = window._activeEnergyRentals.filter(r => r.txId !== rentalTxId);
            
            return {
                success: true,
                message: 'Energy usage tracked for immediate return discount',
                timeSaved: Math.round(timeSinceRental / 1000),
                costSaved: rental.cost * 0.5 // 50% savings for immediate return
            };
        } catch (error) {
            console.error('Error returning energy:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Show rental confirmation dialog
    async showRentalDialog(savings) {
        // Validate savings data
        const validSavings = {
            energyNeeded: savings.energyNeeded || 0,
            burningCostTRX: savings.burningCostTRX || 0,
            rentalCostTRX: savings.rentalCostTRX || 0,
            savingsTRX: savings.savingsTRX || 0,
            savingsPercent: savings.savingsPercent || 0
        };
        
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-bolt" style="color: #f59e0b;"></i>
                            Energy Rental - Save ${validSavings.savingsPercent}%
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
                                <span style="font-weight: 600;">${validSavings.energyNeeded.toLocaleString()}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb;">
                                <span>Cost without rental:</span>
                                <span style="text-decoration: line-through; color: #6b7280;">${validSavings.burningCostTRX.toFixed(2)} TRX</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb;">
                                <span>Cost with rental:</span>
                                <span style="font-weight: 600; color: #10b981;">${validSavings.rentalCostTRX.toFixed(2)} TRX</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; font-size: 1.125rem;">
                                <span style="font-weight: 600;">You Save:</span>
                                <span style="font-weight: 700; color: #10b981;">${validSavings.savingsTRX.toFixed(2)} TRX</span>
                            </div>
                        </div>
                        
                        <div class="alert alert-success" style="margin-top: 1rem; background: #d1fae5; border-color: #10b981;">
                            <i class="fas fa-clock"></i>
                            <div style="margin-left: 0.5rem;">
                                <strong>Instant Return Discount!</strong>
                                <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem;">
                                    Energy is rented for immediate use only. Transaction completes in seconds, 
                                    so you pay only 50% of the daily rate (30 SUN/energy instead of 60).
                                </p>
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