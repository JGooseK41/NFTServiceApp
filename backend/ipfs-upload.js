/**
 * IPFS Upload Handler using Pinata
 */

const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Check if Pinata is configured (check env vars each time)
const isPinataConfigured = () => {
    const hasApiKeys = process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY;
    const hasJWT = process.env.PINATA_JWT;
    
    if (!hasApiKeys && !hasJWT) {
        console.log('Pinata check: API_KEY exists?', !!process.env.PINATA_API_KEY);
        console.log('Pinata check: SECRET_KEY exists?', !!process.env.PINATA_SECRET_KEY);
        console.log('Pinata check: JWT exists?', !!process.env.PINATA_JWT);
    }
    
    return hasApiKeys || hasJWT;
};

// Upload file to IPFS via Pinata
async function uploadToIPFS(fileBuffer, filename, metadata = {}) {
    if (!isPinataConfigured()) {
        console.warn('⚠️ Pinata not configured - returning placeholder IPFS hash');
        // Return a placeholder hash for development
        return {
            success: true,
            ipfsHash: `placeholder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            placeholder: true
        };
    }

    try {
        const formData = new FormData();
        formData.append('file', fileBuffer, filename);
        
        // Add metadata
        const pinataMetadata = JSON.stringify({
            name: filename,
            keyvalues: metadata
        });
        formData.append('pinataMetadata', pinataMetadata);

        // Configure headers with fresh env vars
        const headers = {
            ...formData.getHeaders()
        };

        if (process.env.PINATA_JWT) {
            headers['Authorization'] = `Bearer ${process.env.PINATA_JWT}`;
        } else if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY) {
            headers['pinata_api_key'] = process.env.PINATA_API_KEY;
            headers['pinata_secret_api_key'] = process.env.PINATA_SECRET_KEY;
        } else {
            console.error('Pinata credentials not found in environment');
            throw new Error('Pinata not configured');
        }

        const response = await axios.post(
            'https://api.pinata.cloud/pinning/pinFileToIPFS',
            formData,
            { headers }
        );

        console.log('✅ File uploaded to IPFS:', response.data.IpfsHash);
        return {
            success: true,
            ipfsHash: response.data.IpfsHash,
            pinSize: response.data.PinSize,
            timestamp: response.data.Timestamp
        };
    } catch (error) {
        console.error('❌ IPFS upload failed:', error.message);
        
        // Return placeholder in development
        if (process.env.NODE_ENV !== 'production') {
            return {
                success: true,
                ipfsHash: `dev_placeholder_${Date.now()}`,
                placeholder: true,
                error: error.message
            };
        }
        
        throw error;
    }
}

// Express route handler
function setupIPFSRoutes(app) {
    // Upload document endpoint
    app.post('/api/uploadDocument', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file provided' });
            }

            const metadata = req.body.pinataMetadata ? 
                JSON.parse(req.body.pinataMetadata) : {};

            const result = await uploadToIPFS(
                req.file.buffer,
                req.file.originalname,
                metadata.keyvalues || {}
            );

            res.json(result);
        } catch (error) {
            console.error('Upload endpoint error:', error);
            res.status(500).json({ 
                error: 'Failed to upload to IPFS',
                message: error.message 
            });
        }
    });

    // Test Pinata connection
    app.get('/api/pinata/test', async (req, res) => {
        try {
            if (!isPinataConfigured()) {
                return res.json({
                    configured: false,
                    message: 'Pinata not configured - set PINATA_API_KEY and PINATA_SECRET_KEY or PINATA_JWT'
                });
            }

            const headers = process.env.PINATA_JWT ? 
                { 'Authorization': `Bearer ${process.env.PINATA_JWT}` } :
                {
                    'pinata_api_key': process.env.PINATA_API_KEY,
                    'pinata_secret_api_key': process.env.PINATA_SECRET_KEY
                };

            const response = await axios.get(
                'https://api.pinata.cloud/data/testAuthentication',
                { headers }
            );

            res.json({
                configured: true,
                authenticated: true,
                message: response.data.message
            });
        } catch (error) {
            res.status(500).json({
                configured: true,
                authenticated: false,
                error: error.message
            });
        }
    });

    // Log Pinata configuration status on startup
    if (isPinataConfigured()) {
        console.log('✅ IPFS upload routes configured with Pinata');
        // Test Pinata connection
        const headers = process.env.PINATA_JWT ? 
            { 'Authorization': `Bearer ${process.env.PINATA_JWT}` } :
            {
                'pinata_api_key': process.env.PINATA_API_KEY,
                'pinata_secret_api_key': process.env.PINATA_SECRET_KEY
            };
        
        axios.get('https://api.pinata.cloud/data/testAuthentication', { headers })
            .then(() => console.log('✅ Pinata connection verified'))
            .catch(err => console.error('⚠️ Pinata connection failed:', err.message));
    } else {
        console.log('⚠️ IPFS routes configured but Pinata credentials not found');
        console.log('   Set PINATA_API_KEY and PINATA_SECRET_KEY or PINATA_JWT in environment');
    }
}

module.exports = {
    uploadToIPFS,
    setupIPFSRoutes,
    isPinataConfigured
};