// Energy.Store API Proxy Server
// This Node.js server handles Energy.Store API calls to avoid CORS issues

const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// Energy.Store API credentials
const API_ID = process.env.ENERGY_STORE_API_ID || '17933';
const API_KEY = process.env.ENERGY_STORE_API_KEY || '2b14f71f7068f600a36323032ce7f8cf3079c89a7345521f2aeada792a6c83a1';
const API_URL = 'https://energy.store/api';

// Enable CORS for your domain
app.use(cors({
    origin: [
        'https://theblockservice.com',
        'https://www.theblockservice.com',
        'http://localhost:3000',
        'http://localhost:8080'
    ],
    credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'Energy.Store Proxy' });
});

// Calculate HMAC-SHA256 signature
function calculateSignature(data) {
    // Sort keys alphabetically
    const sortedData = Object.keys(data)
        .sort()
        .reduce((obj, key) => {
            obj[key] = data[key];
            return obj;
        }, {});
    
    const jsonString = JSON.stringify(sortedData);
    return crypto.createHmac('sha256', API_KEY).update(jsonString).digest('hex');
}

// Proxy endpoint for Energy.Store createOrder
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
        
        // Prepare request data
        const requestData = {
            quantity: rentalAmount,
            period: period || 1, // Default to 1 hour
            receiver: receiver
        };
        
        // Calculate signature
        const signature = calculateSignature(requestData);
        
        // Make request to Energy.Store
        const response = await fetch(`${API_URL}/createOrder`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-ID': API_ID,
                'SIGNATURE': signature
            },
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        // Add our own fields
        if (result.status === 'success' || result.status === 'created') {
            result.actualQuantity = rentalAmount;
            result.requestedQuantity = quantity;
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

// Proxy endpoint for Energy.Store checkOrder
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
        const signature = calculateSignature(requestData);
        
        const response = await fetch(`${API_URL}/checkOrder`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-ID': API_ID,
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

// Proxy endpoint for Energy.Store checkAddress
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
        const signature = calculateSignature(requestData);
        
        const response = await fetch(`${API_URL}/checkAddress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-ID': API_ID,
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

// Start server
app.listen(PORT, () => {
    console.log(`Energy.Store proxy server running on port ${PORT}`);
    console.log(`API_ID: ${API_ID}`);
    console.log(`Endpoints:`);
    console.log(`  POST /api/energy/createOrder`);
    console.log(`  POST /api/energy/checkOrder`);
    console.log(`  POST /api/energy/checkAddress`);
    console.log(`  GET /health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    app.close(() => {
        console.log('HTTP server closed');
    });
});