const pinataSDK = require('@pinata/sdk');

exports.handler = async function(event, context) {
    // CORS headers for browser compatibility
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    
    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers
        };
    }
    
    // Get Pinata API keys from environment variables
    if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
        console.error('Missing Pinata API keys in environment variables');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Server configuration error: Missing API keys'
            })
        };
    }
    
    const pinata = pinataSDK(
        process.env.PINATA_API_KEY, 
        process.env.PINATA_SECRET_KEY
    );
    
    try {
        // Check if body exists
        if (!event.body) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Missing request body'
                })
            };
        }
        
        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body);
        } catch (error) {
            console.error('Failed to parse request body:', error);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Invalid JSON in request body'
                })
            };
        }
        
        // Check for image in request
        if (!body.image) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Missing image data in request'
                })
            };
        }
        
        let base64Image = body.image;
        
        // Strip data URL prefix if present (data:image/jpeg;base64,...)
        if (base64Image.startsWith('data:')) {
            const base64Index = base64Image.indexOf(',');
            if (base64Index !== -1) {
                base64Image = base64Image.substring(base64Index + 1);
            }
        }
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(base64Image, 'base64');
        
        // Upload to IPFS via Pinata
        const result = await pinata.pinFileToIPFS(imageBuffer, {
            pinataMetadata: {
                name: `legal-document-${Date.now()}`,
            },
            pinataOptions: {
                cidVersion: 0
            }
        });
        
        // Return the IPFS hash
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                ipfsHash: result.IpfsHash
            })
        };
    } catch (error) {
        console.error('IPFS upload error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: error.message || 'Internal server error'
            })
        };
    }
};
