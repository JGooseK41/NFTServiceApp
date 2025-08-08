// Enhanced Automated Energy Rental Integration
// Supports multiple providers with automatic fallback

const EnhancedEnergyRental = {
    // Configuration for different providers
    providers: {
        justlend: {
            name: 'JustLend DAO',
            enabled: true,
            priority: 1,
            contract: 'TU2MJ5Veik1LRAgjeSzEdvmDYx7mefJZvd',
            methodId: 'fd8527a1'
        },
        energyStore: {
            name: 'Energy.Store',
            enabled: false, // Requires API credentials
            priority: 2,
            apiUrl: 'https://energy.store/api',
            apiId: null, // Set via config
            apiKey: null  // Set via config
        },
        tronenergy: {
            name: 'TRONEnergy.market',
            enabled: true,
            priority: 3,
            url: 'https://tronenergy.market'
        }
    },

    // Configuration management
    config: {
        autoRentEnabled: true,
        maxRetries: 3,
        retryDelay: 2000, // ms
        preferredProvider: 'justlend',
        energyBuffer: 1.3, // 30% buffer
        minRentalDuration: 300, // 5 minutes in seconds
        apiCredentials: {},
        proxyUrl: null // URL for Energy.Store proxy server
    },

    // Initialize with config
    init(config = {}) {
        Object.assign(this.config, config);
        
        // Set API credentials if provided
        if (config.energyStoreApiId && config.energyStoreApiKey) {
            this.providers.energyStore.apiId = config.energyStoreApiId;
            this.providers.energyStore.apiKey = config.energyStoreApiKey;
            this.providers.energyStore.enabled = true;
            
            // If Energy.Store is configured and preferred, update priorities
            if (config.preferredProvider === 'energyStore') {
                this.providers.energyStore.priority = 1;
                this.providers.justlend.priority = 2;
                this.providers.tronenergy.priority = 3;
            }
        }
        
        console.log('Enhanced Energy Rental initialized:', {
            ...this.config,
            energyStoreEnabled: this.providers.energyStore.enabled,
            priorities: Object.entries(this.providers)
                .filter(([_, p]) => p.enabled)
                .map(([k, p]) => `${k}: ${p.priority}`)
        });
    },

    // Estimate energy needed with better calculation
    estimateEnergyNeeded(options = {}) {
        const {
            hasDocument = false,
            isBatch = false,
            batchSize = 1,
            documentSize = 0,
            ipfsUpload = true
        } = options;

        // Base energy costs
        const BASE_NFT_MINT = 800000;
        const DOCUMENT_STORAGE = 100000;
        const IPFS_OPERATION = 50000;
        const LARGE_DOCUMENT_EXTRA = 50000;
        const MINIMUM_RENTAL = 1500000; // Minimum 1.5M energy
        
        let totalEnergy = BASE_NFT_MINT;
        
        if (hasDocument) {
            totalEnergy += DOCUMENT_STORAGE;
            if (documentSize > 500000) { // > 500KB
                totalEnergy += LARGE_DOCUMENT_EXTRA;
            }
        }
        
        if (ipfsUpload) {
            totalEnergy += IPFS_OPERATION;
        }
        
        if (isBatch) {
            totalEnergy *= batchSize;
        }
        
        // Apply buffer
        totalEnergy = Math.ceil(totalEnergy * this.config.energyBuffer);
        
        // Ensure minimum rental amount
        return Math.max(totalEnergy, MINIMUM_RENTAL);
    },

    // Energy.Store API integration
    async rentFromEnergyStore(amount, receiverAddress) {
        // Check if we should use proxy or direct API
        const useProxy = this.config.proxyUrl !== null;
        
        if (!useProxy && !this.providers.energyStore.enabled) {
            return { 
                success: false, 
                error: 'Energy.Store API not configured (no proxy or credentials)' 
            };
        }

        try {
            // Ensure minimum rental amount (Energy.Store min is 65,000 but we want 1.5M)
            const MINIMUM_RENTAL = 1500000;
            const rentalAmount = Math.max(amount, MINIMUM_RENTAL);
            
            console.log(`Energy.Store rental: requested ${amount}, renting ${rentalAmount} (min: ${MINIMUM_RENTAL})`);
            
            let response;
            
            if (useProxy) {
                // Use proxy server to avoid CORS
                console.log('Using Energy.Store proxy:', this.config.proxyUrl);
                
                response = await fetch(`${this.config.proxyUrl}/api/energy/createOrder`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        quantity: rentalAmount,
                        period: 1, // 1 hour minimum
                        receiver: receiverAddress
                    })
                });
            } else {
                // Direct API call (will fail in browser due to CORS)
                const { apiUrl, apiId, apiKey } = this.providers.energyStore;
                
                // Prepare request data
                const requestData = {
                    quantity: rentalAmount,
                    period: 1, // 1 hour minimum
                    receiver: receiverAddress
                };
                
                // Calculate signature
                const signature = await this.calculateEnergyStoreSignature(requestData, apiKey);
                
                // Make API request
                response = await fetch(`${apiUrl}/createOrder`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-ID': apiId,
                        'SIGNATURE': signature
                    },
                    body: JSON.stringify(requestData)
                });
            }
            
            const result = await response.json();
            
            if (result.status === 'success' || result.status === 'created') {
                return {
                    success: true,
                    provider: 'Energy.Store',
                    orderId: result.orderID,
                    cost: result.cost,
                    energyAmount: result.actualQuantity || rentalAmount, // Use actual rented amount
                    requestedAmount: amount, // Original request
                    txId: result.transactionId
                };
            } else {
                return {
                    success: false,
                    error: result.message || 'Energy.Store rental failed'
                };
            }
        } catch (error) {
            console.error('Energy.Store rental error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // Calculate Energy.Store API signature
    async calculateEnergyStoreSignature(data, apiKey) {
        // Sort keys alphabetically
        const sortedData = Object.keys(data)
            .sort()
            .reduce((obj, key) => {
                obj[key] = data[key];
                return obj;
            }, {});
        
        const jsonString = JSON.stringify(sortedData);
        
        // Use Web Crypto API for HMAC-SHA256
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(apiKey),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign(
            'HMAC',
            key,
            encoder.encode(jsonString)
        );
        
        // Convert to hex
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    // Enhanced JustLend integration with better error handling
    async rentFromJustLendEnhanced(amount, receiverAddress) {
        try {
            // Ensure minimum rental amount
            const MINIMUM_RENTAL = 1500000;
            const rentalAmount = Math.max(amount, MINIMUM_RENTAL);
            
            console.log(`JustLend rental: requested ${amount}, renting ${rentalAmount} (min: ${MINIMUM_RENTAL})`);
            
            // Check network
            if (!await this.isMainnet()) {
                return {
                    success: false,
                    error: 'JustLend only works on mainnet'
                };
            }

            // Verify account is not a contract
            const accountInfo = await window.tronWeb.trx.getAccount(receiverAddress);
            if (accountInfo?.is_contract) {
                return {
                    success: false,
                    error: 'Cannot rent energy for contract addresses'
                };
            }

            // Check balance
            const balance = await window.tronWeb.trx.getBalance(receiverAddress);
            const requiredBalance = this.calculateJustLendCost(rentalAmount);
            
            if (balance < requiredBalance.totalCost) {
                return {
                    success: false,
                    error: 'Insufficient TRX balance',
                    required: requiredBalance.totalCost / 1_000_000,
                    available: balance / 1_000_000
                };
            }

            // Attempt rental with retry logic
            let lastError = null;
            for (let i = 0; i < this.config.maxRetries; i++) {
                try {
                    const result = await this.executeJustLendRental(rentalAmount, receiverAddress);
                    if (result.success) {
                        return result;
                    }
                    lastError = result.error;
                } catch (error) {
                    lastError = error.message;
                    console.error(`JustLend attempt ${i + 1} failed:`, error);
                }
                
                if (i < this.config.maxRetries - 1) {
                    await this.delay(this.config.retryDelay);
                }
            }

            return {
                success: false,
                error: lastError || 'JustLend rental failed after retries'
            };

        } catch (error) {
            console.error('JustLend enhanced rental error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // Execute JustLend rental transaction
    async executeJustLendRental(amount, receiverAddress) {
        const CONTRACT_ADDRESS = this.providers.justlend.contract;
        const costs = this.calculateJustLendCost(amount);
        
        // Load contract with ABI
        const ABI = [{
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
        
        const contract = await window.tronWeb.contract(ABI, CONTRACT_ADDRESS);
        
        // Execute transaction
        const tx = await contract.rentResource(
            receiverAddress,
            costs.delegationAmount,
            1 // Energy
        ).send({
            feeLimit: 100_000_000,
            callValue: costs.totalCost,
            shouldPollResponse: true
        });
        
        // Extract transaction ID
        const txId = tx?.txid || tx?.transaction?.txID || tx;
        
        if (!txId) {
            throw new Error('No transaction ID returned');
        }
        
        return {
            success: true,
            provider: 'JustLend',
            txId: txId,
            energyAmount: amount,
            cost: costs.totalCost / 1_000_000
        };
    },

    // Calculate JustLend costs
    calculateJustLendCost(energyAmount) {
        const ENERGY_PER_TRX = 1500;
        const SUN_PER_ENERGY = 30; // Immediate return rate
        const MIN_FEE = 40 * 1_000_000; // 40 TRX minimum
        
        const delegationAmount = Math.ceil(energyAmount / ENERGY_PER_TRX) * 1_000_000;
        const rentalCost = energyAmount * SUN_PER_ENERGY;
        const securityDeposit = Math.ceil(rentalCost * 0.75);
        const liquidationFee = 10 * 1_000_000;
        
        return {
            delegationAmount,
            rentalCost,
            securityDeposit,
            liquidationFee,
            totalCost: rentalCost + securityDeposit + liquidationFee
        };
    },

    // Main automated rental function with provider fallback
    async rentEnergyAutomated(amount, receiverAddress) {
        console.log('Starting automated energy rental:', { amount, receiverAddress });
        
        const attempts = [];
        const sortedProviders = Object.entries(this.providers)
            .filter(([_, p]) => p.enabled)
            .sort((a, b) => a[1].priority - b[1].priority);
        
        // Try each provider in order
        for (const [key, provider] of sortedProviders) {
            console.log(`Trying provider: ${provider.name}`);
            
            let result;
            switch (key) {
                case 'justlend':
                    result = await this.rentFromJustLendEnhanced(amount, receiverAddress);
                    break;
                case 'energyStore':
                    result = await this.rentFromEnergyStore(amount, receiverAddress);
                    break;
                case 'tronenergy':
                    // TRONEnergy.market requires manual intervention
                    result = {
                        success: false,
                        error: 'Manual rental required',
                        manualUrl: `${provider.url}?amount=${amount}&receiver=${receiverAddress}`
                    };
                    break;
                default:
                    result = { success: false, error: 'Provider not implemented' };
            }
            
            attempts.push({ provider: provider.name, result });
            
            if (result.success) {
                console.log(`Successfully rented energy from ${provider.name}`);
                return result;
            }
        }
        
        // All providers failed
        return {
            success: false,
            error: 'All automated rental attempts failed',
            attempts,
            fallbackOptions: this.getFallbackOptions(amount, receiverAddress)
        };
    },

    // Check current energy and rent if needed
    async ensureEnergy(requiredEnergy, userAddress) {
        try {
            // Check current energy
            const currentEnergy = await this.checkUserEnergy(userAddress);
            console.log(`Current energy: ${currentEnergy}, Required: ${requiredEnergy}`);
            
            if (currentEnergy >= requiredEnergy) {
                return {
                    success: true,
                    message: 'Sufficient energy available',
                    energyAvailable: currentEnergy
                };
            }
            
            // Calculate deficit
            const energyDeficit = requiredEnergy - currentEnergy;
            console.log(`Energy deficit: ${energyDeficit}`);
            
            // Attempt automated rental
            if (this.config.autoRentEnabled) {
                const rentalResult = await this.rentEnergyAutomated(energyDeficit, userAddress);
                
                if (rentalResult.success) {
                    // For JustLend, wait for energy to arrive
                    if (rentalResult.provider === 'JustLend') {
                        const energyArrived = await this.waitForEnergy(userAddress, requiredEnergy, 60000); // 60 second timeout
                        
                        if (!energyArrived) {
                            console.warn('Energy did not arrive in time, but proceeding anyway');
                        }
                    }
                    // For Energy.Store, energy should be instant
                    
                    return {
                        success: true,
                        message: `Rented ${energyDeficit} energy from ${rentalResult.provider}`,
                        rentalTxId: rentalResult.txId,
                        cost: rentalResult.cost
                    };
                }
                
                // Rental failed, return options
                return {
                    success: false,
                    message: 'Automated rental failed',
                    currentEnergy,
                    requiredEnergy,
                    deficit: energyDeficit,
                    fallbackOptions: rentalResult.fallbackOptions
                };
            }
            
            return {
                success: false,
                message: 'Insufficient energy and auto-rent disabled',
                currentEnergy,
                requiredEnergy,
                deficit: energyDeficit
            };
            
        } catch (error) {
            console.error('Energy check error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // Wait for energy to arrive after rental
    async waitForEnergy(address, targetAmount, timeout = 60000) { // Increased to 60 seconds
        const startTime = Date.now();
        const checkInterval = 3000; // Check every 3 seconds
        let lastEnergy = 0;
        
        console.log(`Waiting for energy to arrive. Target: ${targetAmount}`);
        
        while (Date.now() - startTime < timeout) {
            const currentEnergy = await this.checkUserEnergy(address);
            
            if (currentEnergy !== lastEnergy) {
                console.log(`Energy update: ${currentEnergy} / ${targetAmount}`);
                lastEnergy = currentEnergy;
            }
            
            // Consider successful if we have at least 90% of target (some may be consumed by check)
            if (currentEnergy >= targetAmount * 0.9) {
                console.log('Sufficient energy arrived:', currentEnergy);
                return true;
            }
            
            await this.delay(checkInterval);
        }
        
        // Final check
        const finalEnergy = await this.checkUserEnergy(address);
        if (finalEnergy >= targetAmount * 0.9) {
            console.log('Energy arrived on final check:', finalEnergy);
            return true;
        }
        
        console.warn(`Timeout waiting for energy. Final: ${finalEnergy}, Target: ${targetAmount}`);
        
        // Return true anyway if we have reasonable energy (may proceed with partial)
        if (finalEnergy >= 500000) { // At least 500k energy
            console.log('Proceeding with partial energy:', finalEnergy);
            return true;
        }
        
        return false;
    },

    // Check user's current energy
    async checkUserEnergy(address) {
        try {
            const resources = await window.tronWeb.trx.getAccountResources(address);
            const energyLimit = resources.EnergyLimit || 0;
            const energyUsed = resources.EnergyUsed || 0;
            return Math.max(0, energyLimit - energyUsed);
        } catch (error) {
            console.error('Error checking energy:', error);
            return 0;
        }
    },

    // Check if on mainnet
    async isMainnet() {
        try {
            const nodeUrl = window.tronWeb?.fullNode?.host || '';
            return nodeUrl.includes('trongrid.io') && 
                   !nodeUrl.includes('nile') && 
                   !nodeUrl.includes('shasta');
        } catch (e) {
            return false;
        }
    },

    // Get fallback options when automated rental fails
    getFallbackOptions(amount, receiverAddress) {
        const burnCost = (amount * 420) / 1_000_000;
        
        return [
            {
                type: 'burn',
                name: 'Burn TRX (Proceed Anyway)',
                description: `Pay ~${burnCost.toFixed(2)} TRX transaction fee`,
                cost: burnCost,
                action: 'proceed'
            },
            {
                type: 'manual',
                name: 'Manual Energy Rental',
                description: 'Rent energy manually from TRONEnergy.market',
                url: `https://tronenergy.market?amount=${amount}&receiver=${receiverAddress}`,
                action: 'manual',
                instructions: [
                    'Click to open TRONEnergy.market',
                    `Rent ${amount.toLocaleString()} energy for 5 minutes`,
                    'Complete the transaction',
                    'Return here and click "Continue"'
                ]
            },
            {
                type: 'stake',
                name: 'Stake TRX for Energy',
                description: 'Get permanent energy by staking TRX',
                url: 'https://tronscan.org/#/sr/representatives',
                action: 'stake'
            },
            {
                type: 'cancel',
                name: 'Cancel Transaction',
                description: 'Do not proceed with the transaction',
                action: 'cancel'
            }
        ];
    },

    // Utility: delay function
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // Show progress dialog during rental
    showRentalProgress(message = 'Renting energy...') {
        const existingDialog = document.getElementById('energyRentalProgress');
        if (existingDialog) {
            existingDialog.remove();
        }
        
        const dialog = document.createElement('div');
        dialog.id = 'energyRentalProgress';
        dialog.className = 'modal';
        dialog.style.display = 'block';
        dialog.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-body" style="text-align: center; padding: 2rem;">
                    <div class="spinner" style="margin: 0 auto 1rem;">
                        <i class="fas fa-circle-notch fa-spin fa-3x" style="color: #3b82f6;"></i>
                    </div>
                    <h4>${message}</h4>
                    <p style="color: #6b7280; margin-top: 0.5rem;">
                        This may take a few seconds...
                    </p>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
        
        return dialog;
    },

    // Hide progress dialog
    hideRentalProgress() {
        const dialog = document.getElementById('energyRentalProgress');
        if (dialog) {
            dialog.remove();
        }
    },

    // Main entry point for automated rental
    async handleEnergyRental(options = {}) {
        const {
            energyNeeded,
            userAddress,
            showProgress = true,
            autoApprove = true
        } = options;
        
        if (showProgress) {
            this.showRentalProgress('Checking energy balance...');
        }
        
        try {
            // Ensure sufficient energy
            const result = await this.ensureEnergy(energyNeeded, userAddress);
            
            if (showProgress) {
                this.hideRentalProgress();
            }
            
            if (result.success) {
                if (result.rentalTxId) {
                    // Show success notification
                    this.showNotification(
                        'success',
                        `Energy rented successfully! Saved ${result.cost ? result.cost.toFixed(2) : '0'} TRX`
                    );
                }
                return result;
            } else {
                // Show options dialog if rental failed
                if (result.fallbackOptions && !autoApprove) {
                    return await this.showFallbackDialog(result);
                }
                return result;
            }
            
        } catch (error) {
            if (showProgress) {
                this.hideRentalProgress();
            }
            
            console.error('Energy rental error:', error);
            this.showNotification('error', 'Energy rental failed: ' + error.message);
            
            return {
                success: false,
                error: error.message
            };
        }
    },

    // Show notification
    showNotification(type, message) {
        if (window.uiManager?.showNotification) {
            window.uiManager.showNotification(type, message);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    },

    // Show fallback options dialog
    async showFallbackDialog(result) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>Energy Rental Options</h3>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            Automated energy rental is unavailable. Please choose an option:
                        </div>
                        
                        <div style="margin-top: 1rem;">
                            ${result.fallbackOptions.map((option, index) => `
                                <div class="option-card" style="padding: 1rem; margin: 0.5rem 0; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer;"
                                     onclick="window.resolveEnergyOption('${option.action}', ${index})">
                                    <h4>${option.name}</h4>
                                    <p style="color: #6b7280;">${option.description}</p>
                                    ${option.cost ? `<p style="font-weight: 600;">Cost: ${option.cost.toFixed(2)} TRX</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            window.resolveEnergyOption = (action, index) => {
                modal.remove();
                delete window.resolveEnergyOption;
                
                const option = result.fallbackOptions[index];
                
                if (action === 'manual' && option.url) {
                    window.open(option.url, '_blank');
                    // Show waiting dialog
                    this.showWaitingForEnergyDialog(result.requiredEnergy, result.currentEnergy);
                } else if (action === 'stake' && option.url) {
                    window.open(option.url, '_blank');
                }
                
                resolve({
                    ...result,
                    userChoice: action,
                    selectedOption: option
                });
            };
        });
    },

    // Show waiting dialog after manual rental
    showWaitingForEnergyDialog(requiredEnergy, currentEnergy) {
        const dialog = document.createElement('div');
        dialog.className = 'modal';
        dialog.style.display = 'block';
        dialog.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Waiting for Energy Rental</h3>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        Complete the energy rental in the opened tab, then return here.
                    </div>
                    
                    <div style="margin: 1rem 0;">
                        <p>Current Energy: <span id="currentEnergyDisplay">${currentEnergy.toLocaleString()}</span></p>
                        <p>Required Energy: <strong>${requiredEnergy.toLocaleString()}</strong></p>
                    </div>
                    
                    <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                            Cancel
                        </button>
                        <button class="btn btn-primary" onclick="window.checkEnergyAndProceed()">
                            <i class="fas fa-check"></i>
                            Check Energy & Continue
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        window.checkEnergyAndProceed = async () => {
            const userAddress = window.tronWeb.defaultAddress.base58;
            const currentEnergy = await this.checkUserEnergy(userAddress);
            
            document.getElementById('currentEnergyDisplay').textContent = currentEnergy.toLocaleString();
            
            if (currentEnergy >= requiredEnergy) {
                dialog.remove();
                delete window.checkEnergyAndProceed;
                
                // Trigger the original transaction
                if (window.createLegalNotice) {
                    window.createLegalNotice();
                }
            } else {
                alert(`Still insufficient energy. Current: ${currentEnergy.toLocaleString()}, Required: ${requiredEnergy.toLocaleString()}`);
            }
        };
    }
};

// Export for use
window.EnhancedEnergyRental = EnhancedEnergyRental;

// Initialize with default config
EnhancedEnergyRental.init();