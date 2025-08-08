// Automated Energy Rental Integration
// Seamlessly rents energy before transactions to save on fees

const EnergyRental = {
    // Supported rental providers with updated information
    providers: {
        justlend: {
            name: 'JustLend DAO',
            contract: 'TU2MJ5Veik1LRAgjeSzEdvmDYx7mefJZvd',
            methodId: 'fd8527a1',
            enabled: true,
            priority: 1
        },
        tronenergy: {
            name: 'TRONEnergy.market',
            url: 'https://tronenergy.market',
            enabled: true,
            priority: 2
        },
        renttrx: {
            name: 'RentTRXEnergy',
            url: 'https://renttrxenergy.com',
            enabled: true,
            priority: 3
        },
        manual: {
            name: 'Manual Staking',
            url: 'https://tronscan.org/#/sr/representatives',
            enabled: true,
            priority: 4
        }
    },
    
    // Estimate energy needed for notice creation
    estimateEnergyNeeded(hasDocument, isBatch = false, batchSize = 1) {
        // Updated energy costs based on actual usage (~1 million for NFT minting)
        const BASE_ENERGY = 800000; // Base NFT minting transaction
        const DOCUMENT_ENERGY = 100000; // Additional for document storage
        const IPFS_ENERGY = 50000; // IPFS metadata operations
        const PER_NOTICE_ENERGY = 900000; // Per notice in batch
        
        let totalEnergy = BASE_ENERGY;
        
        if (hasDocument) {
            totalEnergy += DOCUMENT_ENERGY;
        }
        
        totalEnergy += IPFS_ENERGY;
        
        if (isBatch) {
            totalEnergy = PER_NOTICE_ENERGY * batchSize;
        }
        
        // Add 30% buffer to ensure enough energy while tuning
        return Math.ceil(totalEnergy * 1.3);
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
            
            // JustLend Energy Rental Contract (verified from GitHub issue #6013)
            const ENERGY_RENTAL_CONTRACT = this.providers.justlend.contract;
            
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
            console.log('Loading test contract to check methods...');
            let testContract = await window.tronWeb.contract().at(ENERGY_RENTAL_CONTRACT);
            if (testContract) {
                console.log('Test contract loaded, analyzing structure...');
                
                // Check method instances
                if (testContract.methodInstances) {
                    const methodSigs = Object.keys(testContract.methodInstances);
                    console.log('Method signatures found:', methodSigs);
                    
                    // Try to decode method names
                    for (const sig of methodSigs) {
                        const methodInfo = testContract.methodInstances[sig];
                        console.log(`Method ${sig}:`, methodInfo);
                    }
                }
                
                // Check for specific methods
                console.log('Has rentResource?', !!testContract.rentResource);
                console.log('Has order?', !!testContract.order);
                
                // List all function properties
                const allMethods = [];
                for (let key in testContract) {
                    if (typeof testContract[key] === 'function') {
                        allMethods.push(key);
                    }
                }
                console.log('All function properties:', allMethods);
            }
            
            // JustLend Energy Rental Contract ABI from GitHub issue #6013
            // Method signature: fd8527a1
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
            
            // JustLend energy rental calculation
            // Based on JustLend documentation:
            // - Energy rental price is 60 sun/day per energy
            // - If returned immediately (within minutes), only 30 sun/day
            // - Security deposit = Energy amount * Unit price + Liquidation fee
            
            // Calculate the TRX amount to delegate (this is NOT what we pay)
            // This is the amount of TRX that would need to be staked to get this energy
            const energyStakePerTrx = 1500; // Approximately 1500 energy per TRX staked
            let trxAmountToDelegate = Math.ceil(amount / energyStakePerTrx) * 1_000_000; // Convert to SUN
            
            // Ensure minimum delegation amount
            const MIN_DELEGATION = 1_000_000; // 1 TRX minimum in SUN
            if (trxAmountToDelegate < MIN_DELEGATION) {
                console.log(`Delegation amount ${trxAmountToDelegate / 1_000_000} TRX is below minimum, setting to 1 TRX`);
                trxAmountToDelegate = MIN_DELEGATION;
            }
            
            // Calculate the actual rental cost based on JustLend's pricing
            // 60 sun per energy per day, but we get 50% discount for immediate return
            const sunPerEnergyPerDay = 30; // 30 sun for immediate use (50% discount)
            const rentalDays = 1; // We're renting for immediate use
            const rentalCost = amount * sunPerEnergyPerDay * rentalDays; // Total rental cost in SUN
            
            // Calculate security deposit
            // Security deposit = Energy amount * Unit price * 0.75 (for safety margin)
            const securityDeposit = Math.ceil(amount * sunPerEnergyPerDay * 0.75);
            
            // Add liquidation fee (minimum fee)
            const liquidationFee = 10 * 1_000_000; // 10 TRX liquidation fee
            
            // Calculate total prepayment (rent + security deposit + liquidation fee)
            const totalPrepayment = rentalCost + securityDeposit + liquidationFee;
            
            console.log('JustLend prepayment calculation:', {
                energyAmount: amount,
                trxToDelegate: trxAmountToDelegate / 1_000_000,
                rentalCostSUN: rentalCost,
                rentalCostTRX: rentalCost / 1_000_000,
                securityDepositSUN: securityDeposit,
                securityDepositTRX: securityDeposit / 1_000_000,
                liquidationFeeTRX: liquidationFee / 1_000_000,
                totalPrepaymentSUN: totalPrepayment,
                totalPrepaymentTRX: totalPrepayment / 1_000_000
            });
            
            console.log('JustLend final parameters:', {
                energyNeeded: amount,
                delegationAmountSUN: trxAmountToDelegate,
                delegationAmountTRX: trxAmountToDelegate / 1_000_000,
                totalCostSUN: totalPrepayment,
                totalCostTRX: totalPrepayment / 1_000_000
            });
            
            // Call rentResource with correct parameters based on GitHub issue #6013:
            // - receiver: address to receive the energy (must be activated, not a contract)
            // - amount: TRX amount to delegate for energy (in SUN)
            // - resourceType: 0 for bandwidth, 1 for energy
            console.log('Calling rentResource with parameters:', {
                receiver: receiverAddress,
                amount: trxAmountToDelegate,
                amountInTRX: trxAmountToDelegate / 1_000_000,
                resourceType: 1, // 1 for energy!
                callValue: totalPrepayment,
                callValueInTRX: totalPrepayment / 1_000_000,
                feeLimit: 100_000_000
            });
            
            let tx;
            try {
                // Check which method exists
                if (contract.rentResource) {
                    console.log('Using rentResource method');
                    console.log('Final parameters for rentResource:');
                    console.log('  receiver:', receiverAddress);
                    console.log('  amount:', trxAmountToDelegate, 'SUN =', trxAmountToDelegate / 1_000_000, 'TRX');
                    console.log('  resourceType:', 1, '(energy)');
                    console.log('  callValue:', totalPrepayment, 'SUN =', totalPrepayment / 1_000_000, 'TRX');
                    
                    // Try different ways to send the transaction
                    try {
                        tx = await contract.methods.rentResource(
                            receiverAddress,
                            trxAmountToDelegate, // TRX amount to delegate in SUN
                            1 // 1 for energy, 0 for bandwidth
                        ).send({
                            feeLimit: 100_000_000,
                            callValue: totalPrepayment, // Total prepayment in SUN
                            shouldPollResponse: true,
                            from: window.tronWeb.defaultAddress.base58
                        });
                    } catch (methodError) {
                        console.log('contract.methods failed, trying direct call:', methodError);
                        // Fallback to direct method call
                        tx = await contract.rentResource(
                            receiverAddress,
                            trxAmountToDelegate, // TRX amount to delegate in SUN
                            1 // 1 for energy, 0 for bandwidth
                        ).send({
                            feeLimit: 100_000_000,
                            callValue: totalPrepayment, // Total prepayment in SUN
                            shouldPollResponse: true
                        });
                    }
                    
                    // Check if transaction is valid
                    if (!tx || (Array.isArray(tx) && tx.length === 0)) {
                        console.error('JustLend transaction failed - empty result returned');
                        throw new Error('JustLend transaction failed - no transaction ID returned');
                    }
                } else if (contract.order) {
                    console.log('Using order method as fallback');
                    tx = await contract.order(
                        receiverAddress,
                        trxAmountToDelegate, // TRX amount to delegate in SUN
                        1 // 1 for energy
                    ).send({
                        feeLimit: 100_000_000,
                        callValue: totalPrepayment,
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
                if (sendError.message) {
                    console.error('JustLend error details:', sendError);
                    
                    // Common error patterns and user-friendly messages
                    if (sendError.message.includes('REVERT')) {
                        const revertMatch = sendError.message.match(/REVERT opcode executed[,:]?\s*(?:Reason:\s*)?(.+)?/i);
                        const revertReason = revertMatch?.[1] || 'Transaction rejected';
                        
                        // Check specific revert reasons
                        if (sendError.message.includes('Not enough security deposit')) {
                            console.error('Security deposit insufficient. Current calculation:', {
                                energyAmount: amount,
                                calculatedDeposit: securityDeposit / 1_000_000,
                                totalPrepayment: totalPrepayment / 1_000_000
                            });
                            
                            // Try with increased security deposit
                            const increasedDeposit = Math.ceil(amount * 60); // Try with full 60 sun per energy
                            const increasedTotal = rentalCost + increasedDeposit + liquidationFee;
                            
                            return {
                                success: false,
                                error: 'Insufficient security deposit for JustLend',
                                userMessage: `JustLend requires ${(increasedTotal / 1_000_000).toFixed(2)} TRX security deposit. Current wallet may have insufficient balance.`,
                                requiredAmount: increasedTotal / 1_000_000,
                                currentCalculation: totalPrepayment / 1_000_000,
                                fallbackOptions: this.getAlternativeOptions(amount, receiverAddress)
                            };
                        }
                        
                        // Check if receiver is a contract
                        try {
                            const accountInfo = await window.tronWeb.trx.getAccount(receiverAddress);
                            if (accountInfo && accountInfo.is_contract) {
                                return {
                                    success: false,
                                    error: 'JustLend cannot rent to contract addresses',
                                    userMessage: 'Energy rental is only available for regular wallet addresses.',
                                    fallbackOptions: this.getAlternativeOptions(amount, receiverAddress)
                                };
                            }
                            
                            if (!accountInfo || !accountInfo.address) {
                                return {
                                    success: false,
                                    error: 'Account not activated',
                                    userMessage: 'The wallet must be activated on TRON before renting energy.',
                                    fallbackOptions: this.getAlternativeOptions(amount, receiverAddress)
                                };
                            }
                        } catch (e) {
                            console.error('Could not verify account:', e);
                        }
                        
                        return {
                            success: false,
                            error: `JustLend error: ${revertReason}`,
                            userMessage: 'JustLend rental failed. Please try alternative options.',
                            fallbackOptions: this.getAlternativeOptions(amount, receiverAddress)
                        };
                    }
                    
                    if (sendError.message.includes('Insufficient balance')) {
                        return {
                            success: false,
                            error: 'Insufficient TRX balance',
                            userMessage: 'Not enough TRX for energy rental. Please add more TRX or use alternative options.',
                            fallbackOptions: this.getAlternativeOptions(amount, receiverAddress)
                        };
                    }
                }
                
                throw sendError;
            }
            
            console.log('JustLend rental transaction result:', tx);
            console.log('Transaction type:', typeof tx);
            console.log('Transaction is array:', Array.isArray(tx));
            
            // Extract transaction ID properly
            let txId = null;
            if (tx && typeof tx === 'string') {
                txId = tx;
            } else if (tx && tx.txid) {
                txId = tx.txid;
            } else if (tx && tx.transaction && tx.transaction.txID) {
                txId = tx.transaction.txID;
            } else {
                console.error('Could not extract transaction ID from result:', tx);
                throw new Error('JustLend transaction completed but no transaction ID found');
            }
            
            console.log('Extracted transaction ID:', txId);
            
            // Store rental info for potential return
            const rentalInfo = {
                provider: 'JustLend',
                energyAmount: amount,
                trxDelegated: trxAmountToDelegate / 1_000_000, // TRX delegated
                txId: txId,
                totalCost: totalPrepayment / 1_000_000, // Total prepayment in TRX
                rentalCost: rentalCost / 1_000_000, // Actual rental cost
                securityDeposit: securityDeposit / 1_000_000, // Security deposit
                liquidationFee: liquidationFee / 1_000_000, // Liquidation fee
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
                ...rentalInfo,
                cost: rentalInfo.totalCost // Add cost property for receipt
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
    
    // Main rental function - tries multiple providers with improved fallback
    async rentEnergy(amount, receiverAddress) {
        console.log('Attempting to rent energy:', { amount, receiverAddress });
        
        // Track attempted providers
        const attempts = [];
        
        // Try JustLend first (if on mainnet)
        if (await this.isMainnet()) {
            const justlendResult = await this.rentFromJustLend(amount, receiverAddress);
            attempts.push({ provider: 'JustLend', result: justlendResult });
            
            if (justlendResult.success) {
                return justlendResult;
            }
        }
        
        // Return detailed failure with alternatives
        const alternatives = this.getAlternativeOptions(amount, receiverAddress);
        const burnCost = (amount * 420) / 1_000_000;
        
        return {
            success: false,
            error: 'Automated energy rental unavailable',
            attempts: attempts,
            alternatives: alternatives,
            burnCost: burnCost,
            userMessage: 'Energy rental services are currently unavailable. Please choose an alternative option.',
            showAlternatives: true
        };
    },
    
    // Check if on mainnet
    async isMainnet() {
        try {
            if (window.tronWeb && window.tronWeb.fullNode && window.tronWeb.fullNode.host) {
                const nodeUrl = window.tronWeb.fullNode.host;
                return nodeUrl.includes('trongrid.io') && !nodeUrl.includes('nile') && !nodeUrl.includes('shasta');
            }
        } catch (e) {
            console.error('Error checking network:', e);
        }
        return false;
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
            
            // If rental failed, return detailed failure with alternatives
            console.warn('Energy rental failed - showing alternatives to user');
            
            // Ensure savings values are valid numbers
            const burnCost = rentalResult.burnCost || savings.burningCostTRX || 0;
            const rentalCost = savings.rentalCostTRX || 0;
            const potentialSave = savings.savingsTRX || 0;
            
            console.log('Rental failure - returning alternatives:', {
                burnCost,
                alternatives: rentalResult.alternatives,
                attempts: rentalResult.attempts
            });
            
            return {
                success: false,
                message: rentalResult.userMessage || 'Energy rental unavailable',
                energyAvailable: currentEnergy,
                energyNeeded: energyNeeded,
                energyToRent: energyToRent,
                rentalNeeded: true,
                rentalFailed: true,
                estimatedBurnCost: burnCost,
                estimatedRentalCost: rentalCost,
                potentialSavings: potentialSave,
                alternatives: rentalResult.alternatives,
                showAlternatives: true,
                attempts: rentalResult.attempts
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
    
    // Get alternative options when JustLend fails
    getAlternativeOptions(energyAmount, receiverAddress) {
        const burnCost = (energyAmount * 420) / 1_000_000; // 420 SUN per energy
        
        return [
            {
                type: 'burn',
                name: 'Burn TRX for Energy',
                description: `Pay ~${burnCost.toFixed(2)} TRX to proceed immediately`,
                cost: burnCost,
                action: 'proceed',
                icon: 'fa-fire'
            },
            {
                type: 'external',
                name: 'TRONEnergy Market (Manual Rental)',
                description: 'Rent energy externally then return here',
                detailedInstructions: `
                    <ol style="text-align: left; margin-top: 0.5rem; font-size: 0.875rem;">
                        <li>Connect your current wallet (${receiverAddress.substring(0, 6)}...${receiverAddress.slice(-4)})</li>
                        <li>Rent approximately <strong>1,500,000 energy</strong> for <strong>5 minutes</strong></li>
                        <li>Sign the transaction and wait for your order to be filled</li>
                        <li>Once energy arrives in your wallet, return to TheBlockService</li>
                        <li>Click "Proceed with Transaction" to complete your NFT creation</li>
                    </ol>
                    <p style="margin-top: 0.5rem; font-size: 0.75rem; color: #fbbf24;">
                        <strong>Important:</strong> Keep this tab open while renting energy!
                    </p>
                `,
                url: `https://tronenergy.market?amount=1500000&receiver=${receiverAddress}`,
                action: 'external',
                icon: 'fa-external-link-alt',
                estimatedCost: Math.ceil((1500000 * 30) / 1_000_000), // Rough estimate at 30 sun per energy
                energyToRent: 1500000
            },
            {
                type: 'stake',
                name: 'Stake TRX (Recommended)',
                description: 'Get permanent energy by staking TRX',
                url: 'https://tronscan.org/#/sr/representatives',
                action: 'stake',
                icon: 'fa-lock'
            },
            {
                type: 'cancel',
                name: 'Cancel Transaction',
                description: 'Do not proceed with the transaction',
                action: 'cancel',
                icon: 'fa-times'
            }
        ];
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
    },
    
    // Show alternatives dialog when rental fails
    async showAlternativesDialog(energyResult) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-bolt" style="color: #f59e0b;"></i>
                            Energy Required for Transaction
                        </h3>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning" style="background: #fef3c7; border-color: #f59e0b;">
                            <i class="fas fa-exclamation-triangle"></i>
                            <div>
                                <strong>Automated energy rental is currently unavailable.</strong>
                                <p style="margin: 0.5rem 0 0 0;">You need ${energyResult.energyToRent?.toLocaleString() || energyResult.energyNeeded?.toLocaleString()} energy to complete this transaction.</p>
                            </div>
                        </div>
                        
                        <h4 style="margin-top: 1.5rem; margin-bottom: 1rem;">Please choose an option:</h4>
                        
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            ${energyResult.alternatives.map(option => `
                                <div class="energy-option" style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; cursor: pointer; transition: all 0.2s;"
                                     onmouseover="this.style.backgroundColor='#f9fafb'; this.style.borderColor='#3b82f6';"
                                     onmouseout="this.style.backgroundColor=''; this.style.borderColor='#e5e7eb';"
                                     onclick="window.energyAlternativeResolve('${option.action}', ${JSON.stringify(option).replace(/"/g, '&quot;')})">
                                    <div style="display: flex; align-items: start; gap: 1rem;">
                                        <div style="font-size: 1.5rem; color: ${option.action === 'proceed' ? '#ef4444' : option.action === 'external' ? '#3b82f6' : option.action === 'stake' ? '#10b981' : '#6b7280'};">
                                            <i class="fas ${option.icon}"></i>
                                        </div>
                                        <div style="flex: 1;">
                                            <h5 style="margin: 0; font-size: 1.125rem; font-weight: 600;">${option.name}</h5>
                                            <p style="margin: 0.25rem 0 0 0; color: #6b7280;">${option.description}</p>
                                            ${option.detailedInstructions ? option.detailedInstructions : ''}
                                            ${option.cost ? `<p style="margin: 0.5rem 0 0 0; font-weight: 600; color: #dc2626;">Cost: ~${option.cost.toFixed(2)} TRX</p>` : ''}
                                            ${option.estimatedCost && !option.cost ? `<p style="margin: 0.5rem 0 0 0; font-weight: 600; color: #059669;">Estimated Cost: ~${option.estimatedCost} TRX</p>` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        ${energyResult.attempts && energyResult.attempts.length > 0 ? `
                            <details style="margin-top: 1.5rem;">
                                <summary style="cursor: pointer; color: #6b7280;">Technical Details</summary>
                                <div style="margin-top: 0.5rem; padding: 0.5rem; background: #f3f4f6; border-radius: 4px; font-size: 0.875rem;">
                                    ${energyResult.attempts.map(attempt => `
                                        <div>
                                            <strong>${attempt.provider}:</strong> ${attempt.result.error || 'Failed'}
                                        </div>
                                    `).join('')}
                                </div>
                            </details>
                        ` : ''}
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Set up promise resolution
            window.energyAlternativeResolve = (action, option) => {
                delete window.energyAlternativeResolve;
                modal.remove();
                resolve({ action, option });
            };
        });
    }
};

// Make it globally available
window.EnergyRental = EnergyRental;