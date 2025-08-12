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
     * Estimate TRX cost using v2 API (more accurate)
     */
    async estimateTRXv2(resourceAmount, durationSec = 3600) {
        try {
            const response = await fetch(`${this.getApiUrl('v2')}/estimate-buy-resource`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    resourceAmount: resourceAmount,
                    unitPrice: 'MEDIUM',  // LOW, MEDIUM, HIGH
                    resourceType: 'ENERGY',
                    durationSec: durationSec
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to estimate price');
            }
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.message);
            }
            
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
            // Step 1: Estimate cost
            const estimate = await this.estimateTRXv2(resourceAmount, durationSec);
            if (!estimate.success) {
                throw new Error('Failed to estimate: ' + estimate.error);
            }
            
            if (!estimate.isFullyAvailable) {
                console.warn(`Only ${estimate.availableResource} energy available, requested ${resourceAmount}`);
            }
            
            // Step 2: Build signed transaction
            const senderAddress = window.tronWeb?.defaultAddress?.base58;
            if (!senderAddress) {
                throw new Error('No wallet connected');
            }
            
            const signedTx = await this.buildSignedTransaction(estimate.estimateTrx, senderAddress);
            
            // Step 3: Create order
            const response = await fetch(`${this.getApiUrl('v2')}/buy-resource`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    resourceType: 'ENERGY',
                    resourceAmount: resourceAmount,
                    unitPrice: estimate.unitPrice,
                    allowPartialFill: true,
                    receiver: receiverAddress || senderAddress,
                    durationSec: durationSec,
                    signedTx: signedTx,
                    options: {}
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
                            Energy Purchase Successful!
                        </h3>
                        <div style="color: #d1d5db; font-size: 0.875rem;">
                            Order ID: ${result.orderId}<br>
                            Energy Delivered: ${result.energyDelivered?.toLocaleString()}
                        </div>
                    </div>
                    
                    <button onclick="StreamlinedEnergyFlow.proceed()" style="
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
                    <div style="
                        background: rgba(239, 68, 68, 0.1);
                        border: 1px solid rgba(239, 68, 68, 0.3);
                        border-radius: 8px;
                        padding: 16px;
                        margin-bottom: 24px;
                    ">
                        <h3 style="color: #ef4444; margin-bottom: 8px;">
                            Purchase Failed
                        </h3>
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
        
        const energyNeeded = this.energyNeeded;
        const duration = 3600; // 1 hour in seconds for v2 API
        
        console.log('🔌 Initiating TronSave direct energy rental...');
        
        // Always use signed transaction method for universal compatibility
        window.TronSaveAPI.AUTH_METHOD = 'signtx';
        
        try {
            // Show loading
            window.TronSaveAPI.showPurchaseProgress(energyNeeded, '1 hour');
            
            // Execute purchase with signed transaction
            const result = await window.TronSaveAPI.createEnergyOrderV2(energyNeeded, duration);
            
            if (result.success) {
                window.TronSaveAPI.showPurchaseSuccess(result);
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

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    window.TronSaveAPI.initialize();
});

console.log('✅ TronSave API Integration loaded');
console.log('   - Direct energy purchase via API');
console.log('   - No need to leave the website');
console.log('   - Automatic order tracking');
console.log('   - Secure API key storage');