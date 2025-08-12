/**
 * TRONSAVE API INTEGRATION
 * Direct energy rental through TronSave API without leaving the website
 * Documentation: https://tronsave.io/api
 */

console.log('🔌 Loading TronSave API Integration...');

window.TronSaveAPI = {
    
    // API Configuration
    API_BASE_URL: 'https://api.tronsave.io/v1',
    API_KEY: null,
    
    // Energy pricing (update based on current rates)
    PRICING: {
        '1h': 0.000019,   // TRX per energy for 1 hour
        '12h': 0.000025,  // TRX per energy for 12 hours
        '1d': 0.000029,   // TRX per energy for 1 day
        '3d': 0.000034,   // TRX per energy for 3 days
        '7d': 0.000039    // TRX per energy for 7 days
    },
    
    /**
     * Initialize API with key
     */
    async initialize() {
        // Check if API key is stored
        this.API_KEY = localStorage.getItem('tronsave_api_key');
        
        if (!this.API_KEY) {
            console.log('TronSave API key not configured');
            return false;
        }
        
        // Verify API key is valid
        const isValid = await this.verifyApiKey();
        if (!isValid) {
            console.warn('TronSave API key is invalid');
            this.API_KEY = null;
            localStorage.removeItem('tronsave_api_key');
            return false;
        }
        
        console.log('✅ TronSave API initialized');
        return true;
    },
    
    /**
     * Set API Key
     */
    setApiKey(apiKey) {
        this.API_KEY = apiKey;
        localStorage.setItem('tronsave_api_key', apiKey);
        console.log('API key saved');
    },
    
    /**
     * Verify API key is valid
     */
    async verifyApiKey() {
        if (!this.API_KEY) return false;
        
        try {
            const response = await fetch(`${this.API_BASE_URL}/account/balance`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            return response.ok;
        } catch (error) {
            console.error('API verification failed:', error);
            return false;
        }
    },
    
    /**
     * Get account balance
     */
    async getAccountBalance() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/account/balance`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to get balance');
            }
            
            const data = await response.json();
            return {
                success: true,
                balance: data.balance,
                available: data.available_energy
            };
            
        } catch (error) {
            console.error('Balance check failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Create energy rental order via API
     */
    async createEnergyOrder(energyAmount, duration = '1h', recipientAddress) {
        try {
            if (!this.API_KEY) {
                throw new Error('API key not configured');
            }
            
            // Calculate price
            const pricePerUnit = this.PRICING[duration] || this.PRICING['1h'];
            const totalPrice = energyAmount * pricePerUnit;
            
            console.log(`📝 Creating order: ${energyAmount} energy for ${duration} = ${totalPrice.toFixed(2)} TRX`);
            
            const orderData = {
                type: 'ENERGY',
                amount: energyAmount,
                duration: duration,
                recipient: recipientAddress || window.tronWeb?.defaultAddress?.base58,
                price_limit: totalPrice * 1.1, // Allow 10% price variance
                auto_execute: true
            };
            
            const response = await fetch(`${this.API_BASE_URL}/orders/create`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'Content-Type': 'application/json'
                },
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
                orderId: result.order_id,
                status: result.status,
                price: result.price,
                estimatedTime: result.estimated_time || '30 seconds'
            };
            
        } catch (error) {
            console.error('Order creation failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Check order status
     */
    async checkOrderStatus(orderId) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/orders/${orderId}/status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to check order status');
            }
            
            const data = await response.json();
            return {
                success: true,
                status: data.status, // 'pending', 'processing', 'completed', 'failed'
                energyDelivered: data.energy_delivered,
                transactionHash: data.tx_hash
            };
            
        } catch (error) {
            console.error('Status check failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Complete energy purchase flow
     */
    async purchaseEnergy(energyAmount, duration = '1h') {
        try {
            // Step 1: Create order
            const orderResult = await this.createEnergyOrder(energyAmount, duration);
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
                    if (statusResult.status === 'completed') {
                        return {
                            success: true,
                            orderId: orderResult.orderId,
                            energyDelivered: statusResult.energyDelivered,
                            transactionHash: statusResult.transactionHash
                        };
                    } else if (statusResult.status === 'failed') {
                        throw new Error('Order failed to execute');
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
     * Show API configuration modal
     */
    showApiKeyModal() {
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
                    ">Configure TronSave API</h2>
                </div>
                
                <!-- Content -->
                <div style="padding: 24px;">
                    <div style="
                        background: rgba(14, 165, 233, 0.1);
                        border: 1px solid rgba(14, 165, 233, 0.3);
                        border-radius: 8px;
                        padding: 12px;
                        margin-bottom: 20px;
                        color: #d1d5db;
                        font-size: 0.875rem;
                        line-height: 1.5;
                    ">
                        <strong>Direct Energy Rental Available!</strong><br>
                        Enter your TronSave API key to rent energy directly without leaving this site.
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
                        <h4 style="color: #d1d5db; font-size: 0.875rem; margin-bottom: 12px;">How to get your API key:</h4>
                        <ol style="
                            margin: 0;
                            padding-left: 20px;
                            color: #9ca3af;
                            font-size: 0.875rem;
                            line-height: 1.8;
                        ">
                            <li>Visit <a href="https://tronsave.io" target="_blank" style="color: #0ea5e9;">TronSave.io</a></li>
                            <li>Create an Internal Account</li>
                            <li>Go to Developer → Get API Key</li>
                            <li>Copy and paste it here</li>
                        </ol>
                    </div>
                    
                    <div style="display: flex; gap: 12px;">
                        <button onclick="TronSaveAPI.saveApiKey()" style="
                            flex: 1;
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
                        <button onclick="TronSaveAPI.skipApiSetup()" style="
                            background: transparent;
                            color: #9ca3af;
                            border: 1px solid #333;
                            padding: 12px 20px;
                            border-radius: 8px;
                            cursor: pointer;
                        ">
                            Skip for Now
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
        const input = document.getElementById('tronsave-api-key-input');
        const apiKey = input?.value?.trim();
        
        if (!apiKey) {
            alert('Please enter an API key');
            return;
        }
        
        this.setApiKey(apiKey);
        
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
     * Skip API setup
     */
    skipApiSetup() {
        document.getElementById('tronsave-api-modal')?.remove();
        
        // Fall back to manual rental
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
        // Check if TronSave API is configured
        const hasApi = await window.TronSaveAPI.initialize();
        
        if (hasApi) {
            // Use API for direct purchase
            console.log('Using TronSave API for direct energy purchase');
            
            const energyNeeded = this.energyNeeded;
            const duration = '1h'; // Default to 1 hour
            
            // Store pending purchase
            window._pendingEnergyPurchase = { energyAmount: energyNeeded, duration };
            
            // Execute purchase
            window.TronSaveAPI.executePendingPurchase();
        } else {
            // Show API setup option
            if (confirm('Would you like to set up TronSave API for instant energy rental?')) {
                window.TronSaveAPI.showApiKeyModal();
            } else {
                // Continue with manual rental
                originalProceedToRental.call(this);
            }
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