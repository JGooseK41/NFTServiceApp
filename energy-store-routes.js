// Energy.Store API Routes
// Add this to your existing Express backend on Render

const crypto = require('crypto');
const fetch = require('node-fetch');

// Energy.Store API credentials
const ENERGY_STORE_CONFIG = {
    API_ID: process.env.ENERGY_STORE_API_ID || '17933',
    API_KEY: process.env.ENERGY_STORE_API_KEY || '2b14f71f7068f600a36323032ce7f8cf3079c89a7345521f2aeada792a6c83a1',
    API_URL: 'https://energy.store/api'
};

// Calculate HMAC-SHA256 signature
function calculateSignature(data, apiKey) {
    // Sort keys alphabetically
    const sortedData = Object.keys(data)
        .sort()
        .reduce((obj, key) => {
            obj[key] = data[key];
            return obj;
        }, {});
    
    const jsonString = JSON.stringify(sortedData);
    return crypto.createHmac('sha256', apiKey).update(jsonString).digest('hex');
}

// Export the routes to add to your existing Express app
module.exports = function(app) {
    
    // Create order endpoint
    app.post('/api/energy/createOrder', async (req, res) => {
        try {
            const { quantity, period, receiver } = req.body;
            
            // Validate input
            if (!quantity || !receiver) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Missing required parameters: quantity and receiver'
                });
            }
            
            // Ensure minimum 1.5M energy
            const rentalAmount = Math.max(quantity, 1500000);
            
            console.log(`Energy.Store createOrder: ${rentalAmount} energy for ${receiver}`);
            
            // Prepare request data
            const requestData = {
                quantity: rentalAmount,
                period: period || 1, // Default to 1 hour
                receiver: receiver
            };
            
            // Calculate signature
            const signature = calculateSignature(requestData, ENERGY_STORE_CONFIG.API_KEY);
            
            // Make request to Energy.Store
            const response = await fetch(`${ENERGY_STORE_CONFIG.API_URL}/createOrder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-ID': ENERGY_STORE_CONFIG.API_ID,
                    'SIGNATURE': signature
                },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            
            // Add our own fields
            if (result.status === 'success' || result.status === 'created') {
                result.actualQuantity = rentalAmount;
                result.requestedQuantity = quantity;
                console.log(`Energy.Store order created: ${result.orderID}, cost: ${result.cost} TRX`);
            } else {
                console.error('Energy.Store order failed:', result.message);
            }
            
            res.json(result);
            
        } catch (error) {
            console.error('Energy.Store proxy error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to process energy rental',
                error: error.message
            });
        }
    });
    
    // Check order endpoint
    app.post('/api/energy/checkOrder', async (req, res) => {
        try {
            const { orderID } = req.body;
            
            if (!orderID) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Missing required parameter: orderID'
                });
            }
            
            const requestData = { orderID };
            const signature = calculateSignature(requestData, ENERGY_STORE_CONFIG.API_KEY);
            
            const response = await fetch(`${ENERGY_STORE_CONFIG.API_URL}/checkOrder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-ID': ENERGY_STORE_CONFIG.API_ID,
                    'SIGNATURE': signature
                },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            res.json(result);
            
        } catch (error) {
            console.error('Check order error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to check order status',
                error: error.message
            });
        }
    });
    
    // Check address endpoint
    app.post('/api/energy/checkAddress', async (req, res) => {
        try {
            const { address } = req.body;
            
            if (!address) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Missing required parameter: address'
                });
            }
            
            const requestData = { address };
            const signature = calculateSignature(requestData, ENERGY_STORE_CONFIG.API_KEY);
            
            const response = await fetch(`${ENERGY_STORE_CONFIG.API_URL}/checkAddress`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-ID': ENERGY_STORE_CONFIG.API_ID,
                    'SIGNATURE': signature
                },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            res.json(result);
            
        } catch (error) {
            console.error('Check address error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to check address',
                error: error.message
            });
        }
    });
    
    console.log('Energy.Store routes initialized');
};