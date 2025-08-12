/**
 * TRONSAVE API INTEGRATION
 * Direct energy rental through TronSave API without leaving the website
 * Documentation: https://tronsave.io/api
 */

console.log('🔌 Loading TronSave API Integration...');

window.TronSaveAPI = {
    
    // API Configuration
    API_BASE_URL: 'https://api.tronsave.io',  // Production API base
    API_TEST_URL: 'https://api-dev.tronsave.io',  // Testnet API base
    TESTNET_WEBSITE: 'https://testnet.tronsave.io',  // Testnet website
    MAINNET_WEBSITE: 'https://tronsave.io',  // Mainnet website
    
    // TronSave receiver addresses for v2 API
    MAINNET_RECEIVER: 'TWZEhq5JuUVvGtutNgnRBATbF8BnHGyn4S',
    TESTNET_RECEIVER: 'TATT1UzHRikft98bRFqApFTsaSw73ycfoS',
    
    API_KEY: null,
    DEPOSIT_ADDRESS: null,  // Internal account deposit address
    AUTH_METHOD: 'apikey',  // 'apikey' or 'signtx' 
    API_VERSION: 'v0',  // 'v0' for API key, 'v2' for signed transactions
    USE_TESTNET: false,  // Toggle for testing
    
    // Duration mappings for UI display
    DURATION_LABELS: {
        3600000: '1 hour',
        21600000: '6 hours',
        43200000: '12 hours',
        86400000: '1 day',
        259200000: '3 days',
        604800000: '7 days'
    },
    
    /**
     * Initialize API - check if user has configuration
     */
    async initialize() {
        // Check stored configuration
        this.API_KEY = localStorage.getItem('tronsave_api_key');
        this.DEPOSIT_ADDRESS = localStorage.getItem('tronsave_deposit_address');
        this.AUTH_METHOD = localStorage.getItem('tronsave_auth_method') || 'signtx';  // Default to signed tx
        
        // Check if testnet mode is stored
        const storedTestnet = localStorage.getItem('tronsave_use_testnet');
        if (storedTestnet !== null) {
            this.USE_TESTNET = storedTestnet === 'true';
        }
        
        // Check which method is available
        if (this.AUTH_METHOD === 'apikey' && this.API_KEY) {
            // User has API key configured
            const isValid = await this.verifyAuth();
            if (isValid) {
                console.log(`✅ TronSave API initialized with user's API key`);
                return true;
            } else {
                console.warn('User API key is invalid, falling back to signed transactions');
                this.AUTH_METHOD = 'signtx';
                this.API_KEY = null;
            }
        }
        
        // Check if wallet is connected for signed transactions
        if (window.tronWeb && window.tronWeb.ready) {
            this.AUTH_METHOD = 'signtx';
            console.log(`✅ TronSave ready with signed transactions (${this.USE_TESTNET ? 'TESTNET' : 'MAINNET'})`);
            return true;
        }
        
        console.log('TronSave not configured - user needs to set up');
        return false;
    },
    
    /**
     * Set API Key and deposit address
     */
    setApiKey(apiKey, depositAddress = null) {
        this.API_KEY = apiKey;
        localStorage.setItem('tronsave_api_key', apiKey);
        
        if (depositAddress) {
            this.DEPOSIT_ADDRESS = depositAddress;
            localStorage.setItem('tronsave_deposit_address', depositAddress);
        }
        
        this.AUTH_METHOD = 'apikey';
        localStorage.setItem('tronsave_auth_method', 'apikey');
        
        console.log('API key and configuration saved');
    },
    
    /**
     * Set authentication method
     */
    setAuthMethod(method) {
        if (method === 'apikey' || method === 'signtx') {
            this.AUTH_METHOD = method;
            localStorage.setItem('tronsave_auth_method', method);
            console.log(`Authentication method set to: ${method}`);
        }
    },
    
    /**
     * Toggle testnet mode
     */
    setTestnetMode(useTestnet) {
        this.USE_TESTNET = useTestnet;
        localStorage.setItem('tronsave_use_testnet', useTestnet.toString());
        console.log(`Switched to ${useTestnet ? 'TESTNET' : 'MAINNET'} mode`);
    },
    
    /**
     * Get authentication headers based on method
     */
    async getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.AUTH_METHOD === 'apikey') {
            headers['apikey'] = this.API_KEY;
        } else if (this.AUTH_METHOD === 'signtx') {
            // Generate signature for each request
            const message = `TronSave Request: ${Date.now()}`;
            const signature = await this.signMessage(message);
            
            if (signature) {
                headers['address'] = window.tronWeb.defaultAddress.base58;
                headers['signature'] = signature;
                headers['message'] = message;
            }
        }
        
        return headers;
    },
    
    /**
     * Get current API URL based on network and version
     */
    getApiUrl(version = null) {
        const baseUrl = this.USE_TESTNET ? this.API_TEST_URL : this.API_BASE_URL;
        const apiVersion = version || this.API_VERSION;
        return `${baseUrl}/${apiVersion}`;
    },
    
    /**
     * Get TronSave receiver address based on network
     */
    getReceiverAddress() {
        return this.USE_TESTNET ? this.TESTNET_RECEIVER : this.MAINNET_RECEIVER;
    },
    
    /**
     * Verify authentication (API key or signature)
     */
    async verifyAuth() {
        if (this.AUTH_METHOD === 'apikey') {
            return await this.verifyApiKey();
        } else if (this.AUTH_METHOD === 'signtx') {
            return await this.verifySignature();
        }
        return false;
    },
    
    /**
     * Verify API key is valid using user-info endpoint
     */
    async verifyApiKey() {
        if (!this.API_KEY) return false;
        
        try {
            const response = await fetch(`${this.getApiUrl()}/user-info`, {
                method: 'GET',
                headers: {
                    'apikey': this.API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                // Store deposit address if available
                if (data.deposit_address) {
                    this.DEPOSIT_ADDRESS = data.deposit_address;
                    localStorage.setItem('tronsave_deposit_address', data.deposit_address);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('API verification failed:', error);
            return false;
        }
    },
    
    /**
     * Verify signature authentication
     */
    async verifySignature() {
        if (!window.tronWeb || !window.tronWeb.ready) {
            console.error('TronWeb not ready for signature auth');
            return false;
        }
        
        try {
            // Generate signature for authentication
            const message = `TronSave Auth: ${Date.now()}`;
            const signature = await this.signMessage(message);
            
            if (signature) {
                // Test with a simple API call using signature
                const response = await fetch(`${this.getApiUrl()}/user-info`, {
                    method: 'GET',
                    headers: {
                        'address': window.tronWeb.defaultAddress.base58,
                        'signature': signature,
                        'message': message,
                        'Content-Type': 'application/json'
                    }
                });
                
                return response.ok;
            }
            return false;
        } catch (error) {
            console.error('Signature verification failed:', error);
            return false;
        }
    },
    
    /**
     * Sign a message with TronWeb
     */
    async signMessage(message) {
        try {
            if (!window.tronWeb || !window.tronWeb.ready) {
                throw new Error('TronWeb not ready');
            }
            
            const signature = await window.tronWeb.trx.sign(message);
            return signature;
        } catch (error) {
            console.error('Failed to sign message:', error);
            return null;
        }
    },
    
    /**
     * Get user info (internal account balance)
     */
    async getUserInfo() {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.getApiUrl()}/user-info`, {
                method: 'GET',
                headers: headers
            });
            
            if (!response.ok) {
                throw new Error('Failed to get user info');
            }
            
            const data = await response.json();
            
            // Update stored deposit address if available
            if (data.deposit_address) {
                this.DEPOSIT_ADDRESS = data.deposit_address;
                localStorage.setItem('tronsave_deposit_address', data.deposit_address);
            }
            
            return {
                success: true,
                balance: data.balance || 0,
                depositAddress: data.deposit_address || this.DEPOSIT_ADDRESS,
                email: data.email,
                apiKey: data.apiKey
            };
            
        } catch (error) {
            console.error('User info check failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get order book to see available energy prices
     */
    async getOrderBook() {
        try {
            const response = await fetch(`${this.getApiUrl()}/order-book`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to get order book');
            }
            
            const data = await response.json();
            return {
                success: true,
                orders: data
            };
            
        } catch (error) {
            console.error('Order book fetch failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Estimate TRX cost for energy rental (v0 API)
     */
    async estimateTRX(energyAmount, duration = 3600000) {
        try {
            const response = await fetch(`${this.getApiUrl('v0')}/estimate-trx`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    resource_value: energyAmount,
                    resource_type: 'ENERGY',
                    period: duration  // Duration in milliseconds
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to estimate price');
            }
            
            const data = await response.json();
            return {
                success: true,
                estimated_trx: data.estimated_trx,
                unit_price: data.unit_price
            };
            
        } catch (error) {
            console.error('Price estimation failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Estimate TRX cost using v2 API (official TronSave estimation)
     * @param {number} resourceAmount - Amount of energy needed
     * @param {number} durationSec - Duration in seconds (default 1 hour)
     * @param {string} unitPrice - SLOW/MEDIUM/FAST or specific number
     * @param {object} options - Additional options like allowPartialFill
     */
    async estimateTRXv2(resourceAmount, durationSec = 3600, unitPrice = 'MEDIUM', options = {}) {
        try {
            console.log(`📊 Estimating cost via TronSave API...`);
            
            const requestBody = {
                resourceType: 'ENERGY',
                resourceAmount: resourceAmount,
                unitPrice: unitPrice,  // SLOW, MEDIUM, or FAST
                durationSec: durationSec,
                receiver: window.tronWeb?.defaultAddress?.base58,  // Optional
                options: {
                    allowPartialFill: true,
                    minResourceDelegateRequiredAmount: Math.min(32000, resourceAmount),
                    ...options
                }
            };
            
            console.log('Estimation request:', requestBody);
            
            const response = await fetch(`${this.getApiUrl('v2')}/estimate-buy-resource`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error('Failed to estimate price');
            }
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.message);
            }
            
            console.log('💰 TronSave Estimation Result:');
            console.log(`  Unit Price: ${result.data.unitPrice} SUN`);
            console.log(`  Total Cost: ${result.data.estimateTrx} SUN (${result.data.estimateTrx / 1000000} TRX)`);
            console.log(`  Available: ${result.data.availableResource} energy`);
            console.log(`  Can fulfill: ${result.data.availableResource >= resourceAmount ? '✅ Yes' : '⚠️ Partial'}`);
            
            return {
                success: true,
                unitPrice: result.data.unitPrice,
                durationSec: result.data.durationSec,
                estimateTrx: result.data.estimateTrx,
                availableResource: result.data.availableResource,
                isFullyAvailable: result.data.availableResource >= resourceAmount
            };
            
        } catch (error) {
            console.error('V2 price estimation failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Build and sign transaction for v2 API
     */
    async buildSignedTransaction(estimateTrx, senderAddress) {
        try {
            if (!window.tronWeb || !window.tronWeb.ready) {
                throw new Error('TronWeb not ready');
            }
            
            const receiverAddress = this.getReceiverAddress();
            
            // Build transaction to send TRX to TronSave
            const transaction = await window.tronWeb.transactionBuilder.sendTrx(
                receiverAddress,
                estimateTrx,  // Amount in SUN
                senderAddress
            );
            
            // Sign the transaction
            const signedTx = await window.tronWeb.trx.sign(transaction);
            
            return signedTx;
            
        } catch (error) {
            console.error('Failed to build signed transaction:', error);
            throw error;
        }
    },
    
    /**
     * Create energy order using v2 API (with signed transaction)
     */
    async createEnergyOrderV2(resourceAmount, durationSec = 3600, receiverAddress) {
        try {
            console.log(`📊 Requesting ${resourceAmount} energy for ${durationSec} seconds`);
            
            // Step 1: Use TronSave estimation API to get accurate pricing
            const estimate = await this.estimateTRXv2(resourceAmount, durationSec, 'MEDIUM', {
                allowPartialFill: true
            });
            
            if (!estimate.success) {
                throw new Error('Failed to estimate: ' + estimate.error);
            }
            
            console.log(`💰 TronSave Quote:`);
            console.log(`  Cost: ${estimate.estimateTrx / 1000000} TRX`);
            console.log(`  Available: ${estimate.availableResource} energy`);
            console.log(`  Unit Price: ${estimate.unitPrice} SUN`);
            
            // Adjust amount if not fully available
            let finalAmount = resourceAmount;
            if (!estimate.isFullyAvailable) {
                console.warn(`⚠️ Adjusting order: Only ${estimate.availableResource} available of ${resourceAmount} requested`);
                
                if (estimate.availableResource < resourceAmount * 0.8) {
                    // If less than 80% available, it might not be enough
                    console.warn('Less than 80% available, transaction might fail');
                }
                
                // Use what's available
                finalAmount = Math.min(resourceAmount, estimate.availableResource);
            }
            
            // Step 2: Build signed transaction
            const senderAddress = window.tronWeb?.defaultAddress?.base58;
            if (!senderAddress) {
                throw new Error('No wallet connected');
            }
            
            // Use the TronSave estimated amount for the transaction
            const signedTx = await this.buildSignedTransaction(estimate.estimateTrx, senderAddress);
            
            // Step 3: Create order with exact parameters from estimation
            const response = await fetch(`${this.getApiUrl('v2')}/buy-resource`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    resourceType: 'ENERGY',
                    resourceAmount: finalAmount,  // Use adjusted amount
                    unitPrice: estimate.unitPrice,  // Use price from estimation
                    allowPartialFill: true,
                    receiver: receiverAddress || senderAddress,
                    durationSec: durationSec,
                    signedTx: signedTx,
                    options: {
                        allowPartialFill: true
                    }
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Order creation failed');
            }
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.message);
            }
            
            console.log('✅ V2 Order created:', result);
            
            return {
                success: true,
                orderId: result.data.orderId,
                method: 'v2',
                estimatedTrx: estimate.estimateTrx / 1000000,  // Convert to TRX
                resourceAmount: resourceAmount
            };
            
        } catch (error) {
            console.error('V2 order creation failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Create energy rental order via API (internal-buy-energy endpoint) - v0
     */
    async createEnergyOrder(energyAmount, duration = 3600000, recipientAddress) {
        try {
            if (!this.API_KEY) {
                throw new Error('API key not configured');
            }
            
            // First estimate the price
            const estimate = await this.estimateTRX(energyAmount, duration);
            if (!estimate.success) {
                throw new Error('Failed to estimate price: ' + estimate.error);
            }
            
            const totalPrice = estimate.estimated_trx;
            
            console.log(`📝 Creating order: ${energyAmount} energy for ${duration}ms = ${totalPrice} TRX`);
            
            const orderData = {
                resource_value: energyAmount,
                resource_type: 'ENERGY',
                period: duration,  // Duration in milliseconds
                receive_address: recipientAddress || window.tronWeb?.defaultAddress?.base58,
                max_price: totalPrice * 1.1,  // Allow 10% price variance
                allow_partial_fill: true
            };
            
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.getApiUrl('v0')}/internal-buy-energy`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(orderData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Order creation failed');
            }
            
            const result = await response.json();
            console.log('✅ Order created:', result);
            
            return {
                success: true,
                orderId: result.id || result.order_id,
                status: result.status,
                price: totalPrice,
                estimatedTime: '10-30 seconds',
                orderData: result
            };
            
        } catch (error) {
            console.error('Order creation failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Check order status (get one order details)
     */
    async checkOrderStatus(orderId) {
        try {
            const response = await fetch(`${this.getApiUrl()}/orders/${orderId}`, {
                method: 'GET',
                headers: {
                    'apikey': this.API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to check order status');
            }
            
            const data = await response.json();
            return {
                success: true,
                status: data.status || data.order_status,  // Check both possible field names
                energyDelivered: data.resource_value || data.energy_delivered,
                transactionHash: data.tx_hash || data.transaction_hash,
                orderDetails: data
            };
            
        } catch (error) {
            console.error('Status check failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get order history for the internal account
     */
    async getOrderHistory() {
        try {
            const response = await fetch(`${this.getApiUrl()}/orders`, {
                method: 'GET',
                headers: {
                    'apikey': this.API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to get order history');
            }
            
            const data = await response.json();
            return {
                success: true,
                orders: data
            };
            
        } catch (error) {
            console.error('Order history fetch failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Convert duration string to milliseconds
     */
    durationToMilliseconds(duration) {
        const durations = {
            '1h': 3600000,      // 1 hour
            '6h': 21600000,     // 6 hours
            '12h': 43200000,    // 12 hours
            '1d': 86400000,     // 1 day
            '3d': 259200000,    // 3 days
            '7d': 604800000     // 7 days
        };
        return durations[duration] || 3600000;  // Default to 1 hour
    },
    
    /**
     * Complete energy purchase flow - choose method based on configuration
     */
    async purchaseEnergy(energyAmount, duration = '1h') {
        try {
            // Convert duration to seconds for v2 API
            const durationSec = duration > 86400 ? duration : 
                               typeof duration === 'string' ? this.durationToMilliseconds(duration) / 1000 : 
                               duration;
            
            let orderResult;
            
            // Choose method based on configuration
            if (this.API_KEY && this.AUTH_METHOD === 'apikey') {
                // Use API key method
                orderResult = await this.createEnergyOrderV2ApiKey(energyAmount, durationSec);
            } else if (window.tronWeb && window.tronWeb.ready) {
                // Use signed transaction method
                orderResult = await this.createEnergyOrderV2(energyAmount, durationSec);
            } else {
                throw new Error('No payment method available. Please configure TronSave.');
            }
            if (!orderResult.success) {
                throw new Error(orderResult.error);
            }
            
            // Step 2: Wait for completion (poll status)
            let attempts = 0;
            const maxAttempts = 30; // 30 seconds max wait
            
            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                
                const statusResult = await this.checkOrderStatus(orderResult.orderId);
                
                if (statusResult.success) {
                    // Check various status field names for compatibility
                    const status = statusResult.status || statusResult.orderDetails?.status;
                    if (status === 'completed' || status === 'success' || status === 'filled') {
                        return {
                            success: true,
                            orderId: orderResult.orderId,
                            energyDelivered: statusResult.energyDelivered,
                            transactionHash: statusResult.transactionHash
                        };
                    } else if (status === 'failed' || status === 'cancelled' || status === 'rejected') {
                        throw new Error('Order failed to execute: ' + status);
                    }
                }
                
                attempts++;
            }
            
            throw new Error('Order timeout - please check manually');
            
        } catch (error) {
            console.error('Purchase failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Show configuration modal with multiple options
     */
    showConfigModal() {
        const modal = document.createElement('div');
        modal.id = 'tronsave-api-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(10, 10, 10, 0.95);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(5px);
        `;
        
        modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%);
                border: 1px solid #333;
                border-radius: 12px;
                padding: 0;
                width: 90%;
                max-width: 500px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            ">
                <!-- Header -->
                <div style="
                    padding: 24px;
                    border-bottom: 1px solid #333;
                ">
                    <h2 style="
                        margin: 0;
                        color: #0ea5e9;
                        font-size: 1.5rem;
                        font-weight: 600;
                    ">Choose Energy Rental Method</h2>
                </div>
                
                <!-- Content -->
                <div style="padding: 24px;">
                    <!-- Method Selection -->
                    <div style="margin-bottom: 20px;">
                        <label style="
                            display: block;
                            color: #d1d5db;
                            font-size: 0.875rem;
                            margin-bottom: 8px;
                        ">Select Method:</label>
                        <select id="tronsave-method-select" onchange="TronSaveAPI.toggleMethodUI(this.value)" style="
                            width: 100%;
                            padding: 12px;
                            background: rgba(0, 0, 0, 0.3);
                            border: 1px solid #333;
                            border-radius: 8px;
                            color: white;
                            font-size: 0.875rem;
                        ">
                            <option value="signtx">Option 1: Direct Payment (Recommended)</option>
                            <option value="apikey">Option 2: TronSave Account (Advanced)</option>
                            <option value="manual">Option 3: Manual External Rental</option>
                        </select>
                    </div>
                    
                    <!-- Method 1: Signed Transaction -->
                    <div id="signtx-method" style="display: block;">
                        <div style="
                            background: rgba(16, 185, 129, 0.1);
                            border: 1px solid rgba(16, 185, 129, 0.3);
                            border-radius: 8px;
                            padding: 12px;
                            margin-bottom: 20px;
                            color: #d1d5db;
                            font-size: 0.875rem;
                        ">
                            <strong style="color: #10b981;">✅ Recommended: Direct Payment</strong><br>
                            • No account needed<br>
                            • Pay directly from your wallet<br>
                            • Instant energy delivery<br>
                            • Works for all users
                        </div>
                        <button onclick="TronSaveAPI.selectSignedTx()" style="
                            width: 100%;
                            background: linear-gradient(135deg, #10b981, #059669);
                            color: white;
                            border: none;
                            padding: 12px;
                            border-radius: 8px;
                            font-weight: 600;
                            cursor: pointer;
                        ">
                            Use Direct Payment Method
                        </button>
                    </div>
                    
                    <!-- Method 2: API Key -->
                    <div id="apikey-method" style="display: none;">
                        <div style="
                            background: rgba(14, 165, 233, 0.1);
                            border: 1px solid rgba(14, 165, 233, 0.3);
                            border-radius: 8px;
                            padding: 12px;
                            margin-bottom: 20px;
                            color: #d1d5db;
                            font-size: 0.875rem;
                        ">
                            <strong style="color: #0ea5e9;">TronSave Internal Account</strong><br>
                            • Requires TronSave account<br>
                            • Pre-fund with TRX<br>
                            • Use your own API key<br>
                            • For frequent users
                        </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="
                            display: block;
                            color: #d1d5db;
                            font-size: 0.875rem;
                            margin-bottom: 8px;
                        ">TronSave API Key</label>
                        <input type="text" id="tronsave-api-key-input" placeholder="Enter your API key" style="
                            width: 100%;
                            padding: 12px;
                            background: rgba(0, 0, 0, 0.3);
                            border: 1px solid #333;
                            border-radius: 8px;
                            color: white;
                            font-family: monospace;
                            font-size: 0.875rem;
                        " value="${this.API_KEY || ''}">
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="
                            display: block;
                            color: #d1d5db;
                            font-size: 0.875rem;
                            margin-bottom: 8px;
                        ">Deposit Address (Optional)</label>
                        <input type="text" id="tronsave-deposit-address-input" placeholder="Your TronSave deposit address" style="
                            width: 100%;
                            padding: 12px;
                            background: rgba(0, 0, 0, 0.3);
                            border: 1px solid #333;
                            border-radius: 8px;
                            color: white;
                            font-family: monospace;
                            font-size: 0.875rem;
                        " value="${this.DEPOSIT_ADDRESS || ''}">
                        <div style="
                            color: #9ca3af;
                            font-size: 0.75rem;
                            margin-top: 4px;
                        ">You'll get this after connecting on TronSave</div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #d1d5db; font-size: 0.875rem; margin-bottom: 12px;">Setup Instructions:</h4>
                        <div style="margin-bottom: 15px;">
                            <h5 style="color: #0ea5e9; font-size: 0.875rem; margin-bottom: 8px;">Step 1: Get API Key & Deposit Address</h5>
                            <ol style="
                                margin: 0 0 10px 0;
                                padding-left: 20px;
                                color: #9ca3af;
                                font-size: 0.875rem;
                                line-height: 1.8;
                            ">
                                <li>Visit <a href="${this.USE_TESTNET ? this.TESTNET_WEBSITE : this.MAINNET_WEBSITE}" target="_blank" style="color: #0ea5e9;">
                                    ${this.USE_TESTNET ? 'testnet.tronsave.io' : 'tronsave.io'}
                                </a></li>
                                <li>Click "Connect" and choose your wallet</li>
                                <li>Go to "Account Info"</li>
                                <li>Click "Login TRONSAVE" and sign</li>
                                <li>Copy API key & deposit address</li>
                            </ol>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <h5 style="color: #0ea5e9; font-size: 0.875rem; margin-bottom: 8px;">Step 2: Fund Your Account</h5>
                            <ol style="
                                margin: 0;
                                padding-left: 20px;
                                color: #9ca3af;
                                font-size: 0.875rem;
                                line-height: 1.8;
                            ">
                                <li>Click "Top up" on TronSave</li>
                                <li>Transfer TRX to deposit address (min 10 TRX)</li>
                                <li>First deposit: ~1 TRX activation fee</li>
                                <li>Balance updates in ~3 seconds</li>
                            </ol>
                        </div>
                        <div style="
                            background: rgba(251, 191, 36, 0.1);
                            border: 1px solid rgba(251, 191, 36, 0.3);
                            border-radius: 8px;
                            padding: 8px;
                            margin-bottom: 10px;
                            color: #fbbf24;
                            font-size: 0.75rem;
                        ">
                            <strong>Alternative:</strong> Use Telegram bot @BuyEnergyTronsave_bot
                        </div>
                    </div>
                    
                    <div style="
                        background: rgba(251, 191, 36, 0.1);
                        border: 1px solid rgba(251, 191, 36, 0.3);
                        border-radius: 8px;
                        padding: 12px;
                        margin-bottom: 20px;
                        color: #fbbf24;
                        font-size: 0.75rem;
                    ">
                        <strong>Network:</strong> Currently using ${this.USE_TESTNET ? 'TESTNET (Nile)' : 'MAINNET'} API<br>
                        <label style="display: flex; align-items: center; margin-top: 8px; cursor: pointer;">
                            <input type="checkbox" id="tronsave-testnet-toggle" 
                                ${this.USE_TESTNET ? 'checked' : ''} 
                                onchange="TronSaveAPI.setTestnetMode(this.checked)" 
                                style="margin-right: 8px;">
                            Use Testnet for Testing
                        </label>
                    </div>
                    
                        <button onclick="TronSaveAPI.saveApiKey()" style="
                            width: 100%;
                            background: linear-gradient(135deg, #0ea5e9, #0284c7);
                            color: white;
                            border: none;
                            padding: 12px;
                            border-radius: 8px;
                            font-weight: 600;
                            cursor: pointer;
                        ">
                            Save API Key
                        </button>
                    </div>
                    
                    <!-- Method 3: Manual -->
                    <div id="manual-method" style="display: none;">
                        <div style="
                            background: rgba(251, 191, 36, 0.1);
                            border: 1px solid rgba(251, 191, 36, 0.3);
                            border-radius: 8px;
                            padding: 12px;
                            margin-bottom: 20px;
                            color: #d1d5db;
                            font-size: 0.875rem;
                        ">
                            <strong style="color: #fbbf24;">Manual External Rental</strong><br>
                            • Use external marketplaces<br>
                            • TronSave.io, TR.Energy, etc.<br>
                            • Rent manually, then continue<br>
                        </div>
                        <button onclick="TronSaveAPI.useManualRental()" style="
                            width: 100%;
                            background: linear-gradient(135deg, #fbbf24, #f59e0b);
                            color: white;
                            border: none;
                            padding: 12px;
                            border-radius: 8px;
                            font-weight: 600;
                            cursor: pointer;
                        ">
                            Open External Marketplaces
                        </button>
                    </div>
                    
                    <div style="display: flex; gap: 12px; margin-top: 20px;">
                        <button onclick="document.getElementById('tronsave-api-modal')?.remove()" style="
                            width: 100%;
                            background: transparent;
                            color: #9ca3af;
                            border: 1px solid #333;
                            padding: 12px;
                            border-radius: 8px;
                            cursor: pointer;
                        ">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    /**
     * Save API key from modal
     */
    async saveApiKey() {
        const apiKeyInput = document.getElementById('tronsave-api-key-input');
        const depositInput = document.getElementById('tronsave-deposit-address-input');
        const apiKey = apiKeyInput?.value?.trim();
        const depositAddress = depositInput?.value?.trim();
        
        if (!apiKey) {
            alert('Please enter an API key');
            return;
        }
        
        this.setApiKey(apiKey, depositAddress);
        
        // Verify the key
        const isValid = await this.verifyApiKey();
        
        if (isValid) {
            alert('✅ API key verified and saved!');
            document.getElementById('tronsave-api-modal')?.remove();
            
            // Trigger energy purchase if we were in the middle of a transaction
            if (window._pendingEnergyPurchase) {
                this.executePendingPurchase();
            }
        } else {
            alert('❌ Invalid API key. Please check and try again.');
            this.API_KEY = null;
            localStorage.removeItem('tronsave_api_key');
        }
    },
    
    /**
     * Toggle method UI in modal
     */
    toggleMethodUI(method) {
        document.getElementById('signtx-method').style.display = method === 'signtx' ? 'block' : 'none';
        document.getElementById('apikey-method').style.display = method === 'apikey' ? 'block' : 'none';
        document.getElementById('manual-method').style.display = method === 'manual' ? 'block' : 'none';
    },
    
    /**
     * Select signed transaction method
     */
    selectSignedTx() {
        this.AUTH_METHOD = 'signtx';
        localStorage.setItem('tronsave_auth_method', 'signtx');
        document.getElementById('tronsave-api-modal')?.remove();
        
        // Continue with energy rental
        if (window._pendingEnergyPurchase) {
            this.executePendingPurchase();
        }
    },
    
    /**
     * Use manual rental
     */
    useManualRental() {
        document.getElementById('tronsave-api-modal')?.remove();
        
        // Open manual rental UI
        if (window.StreamlinedEnergyFlow) {
            window.StreamlinedEnergyFlow.currentStep = 2;
            window.StreamlinedEnergyFlow.updateContent();
        }
    },
    
    /**
     * Execute pending energy purchase
     */
    async executePendingPurchase() {
        if (!window._pendingEnergyPurchase) return;
        
        const { energyAmount, duration } = window._pendingEnergyPurchase;
        window._pendingEnergyPurchase = null;
        
        // Show loading state
        this.showPurchaseProgress(energyAmount, duration);
        
        // Execute purchase
        const result = await this.purchaseEnergy(energyAmount, duration);
        
        if (result.success) {
            this.showPurchaseSuccess(result);
        } else {
            this.showPurchaseError(result.error);
        }
    },
    
    /**
     * Show purchase progress
     */
    showPurchaseProgress(energyAmount, duration) {
        const modal = document.getElementById('streamlined-energy-modal');
        const container = modal?.querySelector('.energy-modal-container');
        
        if (container) {
            container.innerHTML = `
                <div style="
                    padding: 48px 24px;
                    text-align: center;
                ">
                    <div style="
                        width: 80px;
                        height: 80px;
                        margin: 0 auto 24px;
                        border: 3px solid #0ea5e9;
                        border-top-color: transparent;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    "></div>
                    <h3 style="color: #0ea5e9; margin-bottom: 8px;">
                        Purchasing Energy via API...
                    </h3>
                    <div style="color: #d1d5db;">
                        ${energyAmount.toLocaleString()} energy for ${duration}
                    </div>
                    <div style="color: #9ca3af; font-size: 0.875rem; margin-top: 8px;">
                        This usually takes 10-30 seconds
                    </div>
                </div>
            `;
        }
    },
    
    /**
     * Show purchase success
     */
    showPurchaseSuccess(result) {
        const modal = document.getElementById('streamlined-energy-modal');
        const container = modal?.querySelector('.energy-modal-container');
        
        if (container) {
            const hasWarning = result.warning;
            const finalEnergy = result.finalEnergy;
            const requiredEnergy = result.requiredEnergy;
            
            container.innerHTML = `
                <div style="padding: 24px;">
                    <div style="
                        background: rgba(16, 185, 129, 0.1);
                        border: 1px solid rgba(16, 185, 129, 0.3);
                        border-radius: 8px;
                        padding: 24px;
                        margin-bottom: 24px;
                        text-align: center;
                    ">
                        <div style="font-size: 3rem; margin-bottom: 12px;">🎉</div>
                        <h3 style="color: #10b981; margin-bottom: 8px;">
                            ${result.message || 'Energy Rental Successful!'}
                        </h3>
                        ${result.orderId ? `
                        <div style="color: #d1d5db; font-size: 0.875rem; margin-bottom: 12px;">
                            Order ID: ${result.orderId}
                        </div>
                        ` : ''}
                        ${finalEnergy ? `
                        <div style="
                            background: rgba(0, 0, 0, 0.2);
                            border-radius: 8px;
                            padding: 12px;
                            margin-top: 16px;
                        ">
                            <div style="
                                display: grid;
                                grid-template-columns: 1fr 1fr;
                                gap: 12px;
                                color: #d1d5db;
                                font-size: 0.875rem;
                            ">
                                <div>
                                    <div style="color: #9ca3af;">Current Energy:</div>
                                    <div style="color: #10b981; font-size: 1.125rem; font-weight: 600;">
                                        ${finalEnergy.toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div style="color: #9ca3af;">Required:</div>
                                    <div style="color: #0ea5e9; font-size: 1.125rem; font-weight: 600;">
                                        ${requiredEnergy.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            ${finalEnergy >= requiredEnergy ? `
                                <div style="
                                    color: #10b981;
                                    font-size: 0.875rem;
                                    margin-top: 8px;
                                    padding-top: 8px;
                                    border-top: 1px solid #333;
                                ">
                                    ✅ Sufficient energy confirmed
                                </div>
                            ` : ''}
                        </div>
                        ` : ''}
                    </div>
                    
                    ${hasWarning ? `
                    <div style="
                        background: rgba(251, 191, 36, 0.1);
                        border: 1px solid rgba(251, 191, 36, 0.3);
                        border-radius: 8px;
                        padding: 12px;
                        margin-bottom: 20px;
                        color: #fbbf24;
                        font-size: 0.875rem;
                    ">
                        ⚠️ ${result.warning}
                    </div>
                    ` : ''}
                    
                    <button onclick="TronSaveAPI.continueAfterRental()" style="
                        width: 100%;
                        background: linear-gradient(135deg, #10b981, #059669);
                        color: white;
                        border: none;
                        padding: 14px;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        font-size: 1rem;
                    ">
                        Continue with Transaction →
                    </button>
                </div>
            `;
        }
    },
    
    /**
     * Show purchase error
     */
    showPurchaseError(error) {
        const modal = document.getElementById('streamlined-energy-modal');
        const container = modal?.querySelector('.energy-modal-container');
        
        if (container) {
            container.innerHTML = `
                <div style="padding: 24px;">
                    <!-- Close button at top -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 style="color: #ef4444; margin: 0;">Purchase Failed</h3>
                        <button onclick="document.getElementById('streamlined-energy-modal')?.remove(); window.StreamlinedEnergyFlow?.hide()" style="
                            background: transparent;
                            border: none;
                            color: #9ca3af;
                            cursor: pointer;
                            font-size: 1.5rem;
                            padding: 4px;
                        ">✕</button>
                    </div>
                    
                    <div style="
                        background: rgba(239, 68, 68, 0.1);
                        border: 1px solid rgba(239, 68, 68, 0.3);
                        border-radius: 8px;
                        padding: 16px;
                        margin-bottom: 24px;
                    ">
                        <div style="color: #d1d5db; font-size: 0.875rem;">
                            ${error}
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 12px;">
                        <button onclick="TronSaveAPI.retryPurchase()" style="
                            flex: 1;
                            background: linear-gradient(135deg, #0ea5e9, #0284c7);
                            color: white;
                            border: none;
                            padding: 12px;
                            border-radius: 8px;
                            font-weight: 600;
                            cursor: pointer;
                        ">
                            Try Again
                        </button>
                        <button onclick="StreamlinedEnergyFlow.currentStep = 2; StreamlinedEnergyFlow.updateContent()" style="
                            flex: 1;
                            background: transparent;
                            color: #9ca3af;
                            border: 1px solid #333;
                            padding: 12px;
                            border-radius: 8px;
                            cursor: pointer;
                        ">
                            Use Manual Rental
                        </button>
                    </div>
                    
                    <!-- Exit button -->
                    <button onclick="document.getElementById('streamlined-energy-modal')?.remove(); window.StreamlinedEnergyFlow?.hide()" style="
                        width: 100%;
                        margin-top: 12px;
                        background: transparent;
                        color: #6b7280;
                        border: 1px solid #374151;
                        padding: 10px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 0.875rem;
                    ">
                        Cancel & Exit
                    </button>
                </div>
            `;
        }
    }
};

// Integrate with Streamlined Energy Flow
if (window.StreamlinedEnergyFlow) {
    const originalProceedToRental = window.StreamlinedEnergyFlow.proceedToRental;
    
    window.StreamlinedEnergyFlow.proceedToRental = async function() {
        // Check if wallet is connected
        if (!window.tronWeb || !window.tronWeb.ready) {
            alert('Please connect your wallet first to rent energy');
            return;
        }
        
        // Use the adjusted amount if user changed it
        const estimatedEnergy = this.adjustedEnergyNeeded || this.energyNeeded;
        const duration = 3600; // 1 hour in seconds for v2 API
        
        console.log('🔌 Initiating TronSave direct energy rental...');
        console.log(`  Original estimate: ${this.energyNeeded?.toLocaleString() || 'N/A'}`);
        console.log(`  User adjusted to: ${this.adjustedEnergyNeeded?.toLocaleString() || 'Not adjusted'}`);
        console.log(`  Using amount: ${estimatedEnergy.toLocaleString()}`);
        
        // IMPORTANT: Respect user's manual adjustment
        let actualEnergyNeeded = estimatedEnergy;
        
        // If user manually adjusted the amount, use their value directly
        if (this.adjustedEnergyNeeded && this.adjustedEnergyNeeded !== this.energyNeeded) {
            actualEnergyNeeded = this.adjustedEnergyNeeded;
            console.log(`  👤 User manually set energy to: ${actualEnergyNeeded.toLocaleString()}`);
            console.log(`  📝 Respecting user's choice - no additional buffers applied`);
        } else {
            // Only apply automatic calculations if user hasn't manually adjusted
            // For documents, calculate based on MB with 10% buffer
            if (this._originalParams && this._originalParams.documentSizeMB > 0) {
                const docSizeMB = this._originalParams.documentSizeMB;
                const ENERGY_PER_MB = 1400000; // Based on actual: 3.5M ÷ 2.5MB
                
                // Calculate: (MB × energy_per_mb) × 1.1 buffer
                const baseEnergy = docSizeMB * ENERGY_PER_MB;
                actualEnergyNeeded = Math.ceil(baseEnergy * 1.1);
                
                console.log(`  📄 Auto-calculated for document (${docSizeMB}MB):`);
                console.log(`     Formula: ${docSizeMB}MB × 1,400,000 energy/MB = ${baseEnergy.toLocaleString()}`);
                console.log(`     +10% buffer = ${actualEnergyNeeded.toLocaleString()} energy total`);
            } else if (estimatedEnergy > 1000000) {
                // For large non-document transactions, add safety buffer
                actualEnergyNeeded = Math.ceil(estimatedEnergy * 1.3);
                console.log(`  ⚡ Auto-calculated large transaction - adding 30% safety buffer`);
            }
        }
        
        console.log(`  Final energy requirement: ${actualEnergyNeeded.toLocaleString()}`);
        
        // Always use signed transaction method for universal compatibility
        window.TronSaveAPI.AUTH_METHOD = 'signtx';
        
        try {
            // Show loading
            window.TronSaveAPI.showPurchaseProgress(actualEnergyNeeded, '1 hour');
            
            // Step 1: Get TronSave pricing for the energy amount we need
            console.log('🔍 Getting TronSave pricing for energy requirement...');
            console.log(`  Requesting price for: ${actualEnergyNeeded} energy`);
            
            const estimate = await window.TronSaveAPI.estimateTRXv2(actualEnergyNeeded, duration, 'MEDIUM');
            
            if (!estimate.success) {
                throw new Error('Failed to get TronSave estimate: ' + estimate.error);
            }
            
            // Use the actual energy needed based on real blockchain requirements
            
            console.log('✅ TronSave Energy Estimation:');
            console.log(`  Requested: ${actualEnergyNeeded} energy`);
            console.log(`  Available in market: ${estimate.availableResource} energy`);
            console.log(`  Price per energy: ${estimate.unitPrice} SUN`);
            console.log(`  Total cost for full amount: ${estimate.estimateTrx / 1000000} TRX`);
            
            // Step 2: NOW check current energy balance
            let currentEnergy = 0;
            if (window.ManualEnergyRental) {
                const status = await window.ManualEnergyRental.checkEnergyStatus();
                currentEnergy = status?.energy?.total || 0;
                console.log(`🔋 Current energy in wallet: ${currentEnergy}`);
            }
            
            // Step 3: Calculate the deficit based on TronSave's estimation
            const deficit = Math.max(0, actualEnergyNeeded - currentEnergy);
            
            if (deficit === 0) {
                console.log('✅ Already have sufficient energy!');
                window.TronSaveAPI.showPurchaseSuccess({ 
                    resourceAmount: 0, 
                    method: 'none',
                    message: 'Already have sufficient energy'
                });
                return;
            }
            
            console.log(`📊 Energy Deficit Calculation:`);
            console.log(`  TronSave says we need: ${actualEnergyNeeded}`);
            console.log(`  Currently have: ${currentEnergy}`);
            console.log(`  Deficit: ${deficit}`);
            
            // Step 4: Add buffer to the deficit - but respect user's manual adjustment
            let deficitWithBuffer;
            if (this.adjustedEnergyNeeded && this.adjustedEnergyNeeded !== this.energyNeeded) {
                // User manually set amount - use minimal buffer (5%)
                deficitWithBuffer = Math.ceil(deficit * 1.05);
                console.log(`  👤 User set manually - deficit with minimal 5% buffer: ${deficitWithBuffer}`);
            } else {
                // System calculated - use normal 20% buffer
                deficitWithBuffer = Math.ceil(deficit * 1.2);
                console.log(`  🤖 System calculated - deficit with 20% buffer: ${deficitWithBuffer}`);
            }
            
            // Step 5: Get pricing for just the deficit amount
            console.log('💰 Getting price for deficit amount...');
            
            const deficitEstimate = await window.TronSaveAPI.estimateTRXv2(deficitWithBuffer, duration, 'MEDIUM');
            
            if (!deficitEstimate.success) {
                throw new Error('Failed to get deficit estimate: ' + deficitEstimate.error);
            }
            
            console.log('✅ Deficit Rental Pricing:');
            console.log(`  Renting: ${deficitWithBuffer} energy`);
            console.log(`  Available: ${deficitEstimate.availableResource} energy`);
            console.log(`  Cost: ${deficitEstimate.estimateTrx / 1000000} TRX`);
            
            // Step 6: Determine final amount to rent based on availability
            let finalAmountToRent = deficitWithBuffer;
            if (!deficitEstimate.isFullyAvailable) {
                console.warn(`⚠️ Only ${deficitEstimate.availableResource} available of ${deficitWithBuffer} requested`);
                
                // Check if available amount would still be sufficient
                const totalAfterRental = currentEnergy + deficitEstimate.availableResource;
                if (totalAfterRental < actualEnergyNeeded) {
                    console.warn(`⚠️ Even with available rental (${deficitEstimate.availableResource}), total energy (${totalAfterRental}) would be less than required (${actualEnergyNeeded})`);
                    if (!confirm(`Only ${deficitEstimate.availableResource} energy available. This might not be enough. Continue anyway?`)) {
                        window.TronSaveAPI.showPurchaseError('Insufficient energy available for rental');
                        return;
                    }
                }
                finalAmountToRent = deficitEstimate.availableResource;
            }
            
            // Step 7: Rent only the deficit amount
            console.log(`💳 Renting ${finalAmountToRent} energy from TronSave...`);
            const result = await window.TronSaveAPI.createEnergyOrderV2(finalAmountToRent, duration);
            
            if (result.success) {
                console.log('✅ Energy rental transaction completed, verifying energy arrival...');
                
                // Step 8: Wait for energy to be delegated and verify
                console.log('⏳ Waiting 5 seconds for energy delegation...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // Step 9: Check energy balance after rental
                let finalEnergy = 0;
                if (window.ManualEnergyRental) {
                    const finalStatus = await window.ManualEnergyRental.checkEnergyStatus();
                    finalEnergy = finalStatus?.energy?.total || 0;
                    console.log(`🔋 Energy balance after rental: ${finalEnergy}`);
                }
                
                // Step 10: Verify we have enough energy to proceed
                if (finalEnergy >= actualEnergyNeeded * 0.9) {  // Allow 10% margin
                    console.log('✅ Energy verification successful!');
                    console.log(`  Required: ${actualEnergyNeeded}`);
                    console.log(`  Have now: ${finalEnergy}`);
                    console.log(`  Surplus: ${finalEnergy - actualEnergyNeeded}`);
                    
                    window.TronSaveAPI.showPurchaseSuccess({
                        ...result,
                        finalEnergy: finalEnergy,
                        requiredEnergy: actualEnergyNeeded
                    });
                } else {
                    // Energy didn't arrive or not enough
                    console.error('⚠️ Energy verification failed!');
                    console.log(`  Required: ${actualEnergyNeeded}`);
                    console.log(`  Have now: ${finalEnergy}`);
                    console.log(`  Still short: ${actualEnergyNeeded - finalEnergy}`);
                    
                    // Check if we at least got some energy
                    const energyGained = finalEnergy - currentEnergy;
                    if (energyGained > 0) {
                        console.log(`  Energy gained from rental: ${energyGained}`);
                        
                        // Ask user if they want to proceed anyway or rent more
                        if (confirm(`Energy rental partially successful. You now have ${finalEnergy} energy but need ${actualEnergyNeeded}. Proceed anyway?`)) {
                            window.TronSaveAPI.showPurchaseSuccess({
                                ...result,
                                finalEnergy: finalEnergy,
                                requiredEnergy: actualEnergyNeeded,
                                warning: 'Proceeding with insufficient energy may result in TRX burn'
                            });
                        } else {
                            // Calculate remaining deficit
                            const remainingDeficit = Math.ceil((actualEnergyNeeded - finalEnergy) * 1.2);
                            console.log(`Need to rent additional ${remainingDeficit} energy`);
                            
                            // Retry with remaining amount
                            if (confirm(`Rent additional ${remainingDeficit} energy?`)) {
                                const additionalResult = await window.TronSaveAPI.createEnergyOrderV2(remainingDeficit, duration);
                                if (additionalResult.success) {
                                    // Wait and check again
                                    await new Promise(resolve => setTimeout(resolve, 5000));
                                    const recheckStatus = await window.ManualEnergyRental.checkEnergyStatus();
                                    const recheckEnergy = recheckStatus?.energy?.total || 0;
                                    
                                    if (recheckEnergy >= actualEnergyNeeded * 0.9) {
                                        window.TronSaveAPI.showPurchaseSuccess({
                                            ...additionalResult,
                                            finalEnergy: recheckEnergy,
                                            requiredEnergy: actualEnergyNeeded
                                        });
                                    } else {
                                        window.TronSaveAPI.showPurchaseError(`Still insufficient energy after additional rental. Have ${recheckEnergy}, need ${actualEnergyNeeded}`);
                                    }
                                } else {
                                    window.TronSaveAPI.showPurchaseError('Additional energy rental failed: ' + additionalResult.error);
                                }
                            } else {
                                window.TronSaveAPI.showPurchaseError('Energy rental incomplete. Please rent more energy manually.');
                            }
                        }
                    } else {
                        // No energy gained at all
                        console.error('❌ No energy was added to wallet!');
                        window.TronSaveAPI.showPurchaseError('Energy rental failed - no energy was added to your wallet. The rental may still be processing. Please wait and try again.');
                    }
                }
            } else {
                // Handle rejection or error
                if (result.error && result.error.includes('User rejected')) {
                    window.TronSaveAPI.showPurchaseError('Transaction cancelled');
                } else {
                    window.TronSaveAPI.showPurchaseError(result.error || 'Energy purchase failed');
                }
                
                // Offer manual alternative
                setTimeout(() => {
                    if (confirm('Would you like to try manual energy rental instead?')) {
                        originalProceedToRental.call(this);
                    }
                }, 1500);
            }
        } catch (error) {
            console.error('Energy rental error:', error);
            window.TronSaveAPI.showPurchaseError(error.message);
            
            // Fallback to manual
            setTimeout(() => {
                originalProceedToRental.call(this);
            }, 2000);
        }
    };
}

// Function to continue after successful rental
window.TronSaveAPI.continueAfterRental = async function() {
    console.log('✅ Energy rented, verifying before continuing...');
    
    // Close all energy-related modals
    document.getElementById('streamlined-energy-modal')?.remove();
    document.getElementById('mandatory-energy-dialog')?.remove();
    document.getElementById('tronsave-api-modal')?.remove();
    
    // Wait a moment for energy to be delegated
    console.log('Waiting 3 seconds for energy delegation...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check energy status to confirm
    if (window.ManualEnergyRental) {
        const status = await window.ManualEnergyRental.checkEnergyStatus();
        console.log(`Current energy after rental: ${status?.energy?.total || 0}`);
    }
    
    // Call the ORIGINAL transaction function directly
    // This bypasses all energy checks since we just rented
    if (window._originalCreateLegalNotice) {
        console.log('Calling original createLegalNotice...');
        window._originalCreateLegalNotice();
    } else if (window._originalCreateLegalNoticeWithStaging) {
        console.log('Calling original createLegalNoticeWithStaging...');
        window._originalCreateLegalNoticeWithStaging();
    } else if (window.TransactionStaging?.processTransaction) {
        console.log('Calling TransactionStaging.processTransaction...');
        window.TransactionStaging.processTransaction();
    } else {
        console.error('No transaction function found to continue!');
        alert('Transaction function not found. Please try creating the NFT again.');
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    window.TronSaveAPI.initialize();
});

console.log('✅ TronSave API Integration loaded');
console.log('   - Direct energy purchase via API');
console.log('   - No need to leave the website');
console.log('   - Automatic order tracking');
console.log('   - Secure API key storage');