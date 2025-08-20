/**
 * Decryption Service for Recipients
 * Applies all the knowledge gained from IPFS recovery
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https = require('https');

/**
 * Correct CryptoJS decryption implementation (proven to work)
 */
function decryptCryptoJS(encryptedString, passphrase) {
    try {
        // The entire string IS the base64 encoded data
        const encryptedData = Buffer.from(encryptedString, 'base64');
        
        // Verify it starts with "Salted__"
        const header = encryptedData.slice(0, 8).toString('utf8');
        if (header !== 'Salted__') {
            throw new Error(`Invalid encrypted format. Expected "Salted__" header.`);
        }
        
        // Extract salt and ciphertext
        const salt = encryptedData.slice(8, 16);
        const ciphertext = encryptedData.slice(16);
        
        // Derive key and IV using MD5 (OpenSSL's EVP_BytesToKey method)
        const keyAndIV = deriveKeyAndIV(passphrase, salt);
        
        // Decrypt using AES-256-CBC
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyAndIV.key, keyAndIV.iv);
        decipher.setAutoPadding(true);
        
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted.toString('utf8');
    } catch (error) {
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

/**
 * OpenSSL's EVP_BytesToKey implementation (used by CryptoJS)
 */
function deriveKeyAndIV(passphrase, salt) {
    const password = Buffer.from(passphrase, 'utf8');
    const keyLen = 32; // AES-256
    const ivLen = 16;  // AES block size
    
    let derivedBytes = Buffer.alloc(0);
    let currentBlock = Buffer.alloc(0);
    
    while (derivedBytes.length < keyLen + ivLen) {
        const hash = crypto.createHash('md5');
        hash.update(currentBlock);
        hash.update(password);
        if (salt) {
            hash.update(salt);
        }
        currentBlock = hash.digest();
        derivedBytes = Buffer.concat([derivedBytes, currentBlock]);
    }
    
    return {
        key: derivedBytes.slice(0, keyLen),
        iv: derivedBytes.slice(keyLen, keyLen + ivLen)
    };
}

/**
 * Download from IPFS
 */
function downloadFromIPFS(ipfsHash) {
    return new Promise((resolve, reject) => {
        // Try multiple gateways for reliability
        const gateways = [
            'https://gateway.pinata.cloud/ipfs/',
            'https://ipfs.io/ipfs/',
            'https://cloudflare-ipfs.com/ipfs/'
        ];
        
        let attemptIndex = 0;
        
        const tryNextGateway = () => {
            if (attemptIndex >= gateways.length) {
                reject(new Error('Unable to download from IPFS. All gateways failed.'));
                return;
            }
            
            const url = gateways[attemptIndex] + ipfsHash;
            attemptIndex++;
            
            https.get(url, (res) => {
                if (res.statusCode !== 200) {
                    tryNextGateway();
                    return;
                }
                
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', () => tryNextGateway());
        };
        
        tryNextGateway();
    });
}

/**
 * API endpoint to decrypt document for recipients
 * Can be called from frontend or used directly
 */
router.post('/decrypt-document', async (req, res) => {
    try {
        const { ipfsHash, encryptionKey, encryptedData } = req.body;
        
        if (!encryptionKey) {
            return res.status(400).json({
                success: false,
                error: 'Encryption key is required'
            });
        }
        
        let dataToDecrypt;
        
        // If encrypted data is provided directly, use it
        if (encryptedData) {
            dataToDecrypt = encryptedData;
        } 
        // Otherwise, download from IPFS
        else if (ipfsHash) {
            try {
                dataToDecrypt = await downloadFromIPFS(ipfsHash);
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to download from IPFS',
                    details: error.message
                });
            }
        } else {
            return res.status(400).json({
                success: false,
                error: 'Either ipfsHash or encryptedData must be provided'
            });
        }
        
        // Check if data needs decryption
        let decryptedData;
        
        if (dataToDecrypt.startsWith('U2FsdGVkX1')) {
            // Data is encrypted with CryptoJS
            const decryptedString = decryptCryptoJS(dataToDecrypt, encryptionKey);
            
            // The decrypted data might be JSON or a direct data URL
            if (decryptedString.startsWith('data:image')) {
                // Direct data URL after decryption
                decryptedData = {
                    type: 'direct_image',
                    document: decryptedString
                };
            } else {
                // Try to parse as JSON
                try {
                    decryptedData = JSON.parse(decryptedString);
                    decryptedData.type = 'json_data';
                } catch (e) {
                    // If not JSON, treat as document data
                    decryptedData = {
                        type: 'raw_data',
                        document: decryptedString
                    };
                }
            }
        } else if (dataToDecrypt.startsWith('data:image')) {
            // Data is not encrypted, just a direct data URL
            decryptedData = {
                type: 'unencrypted_image',
                document: dataToDecrypt
            };
        } else {
            // Try to parse as JSON (might be unencrypted JSON)
            try {
                decryptedData = JSON.parse(dataToDecrypt);
                decryptedData.type = 'unencrypted_json';
            } catch (e) {
                return res.status(400).json({
                    success: false,
                    error: 'Unknown data format',
                    details: 'Data is not encrypted, not a data URL, and not valid JSON'
                });
            }
        }
        
        // Return the decrypted data
        res.json({
            success: true,
            data: decryptedData,
            message: 'Document decrypted successfully'
        });
        
    } catch (error) {
        console.error('Decryption error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Endpoint to get decryption instructions
 */
router.get('/decryption-instructions', (req, res) => {
    const { ipfsHash, encryptionKey } = req.query;
    
    const instructions = {
        overview: 'Your document has been encrypted for security. Use your decryption key to access it.',
        methods: [
            {
                name: 'Method 1: Use Our Web Tool',
                steps: [
                    'Visit the decryption page',
                    'Enter your IPFS hash and encryption key',
                    'Click "Decrypt Document"',
                    'Your document will be displayed'
                ],
                url: `/decrypt?ipfs=${ipfsHash || 'YOUR_IPFS_HASH'}&key=${encryptionKey || 'YOUR_KEY'}`
            },
            {
                name: 'Method 2: Use Our API',
                steps: [
                    'Send a POST request to /api/decrypt/decrypt-document',
                    'Include ipfsHash and encryptionKey in the request body',
                    'The decrypted document will be returned'
                ],
                example: {
                    url: '/api/decrypt/decrypt-document',
                    method: 'POST',
                    body: {
                        ipfsHash: ipfsHash || 'YOUR_IPFS_HASH',
                        encryptionKey: encryptionKey || 'YOUR_ENCRYPTION_KEY'
                    }
                }
            },
            {
                name: 'Method 3: Manual Decryption (Technical)',
                steps: [
                    'Download the encrypted data from IPFS',
                    'Use CryptoJS or compatible AES decryption',
                    'The data uses AES-256-CBC with MD5 key derivation',
                    'The result will be a data URL or JSON with document data'
                ],
                code: `
// Node.js example
const CryptoJS = require('crypto-js');
const https = require('https');

// Download from IPFS
const ipfsHash = '${ipfsHash || 'YOUR_IPFS_HASH'}';
const encryptionKey = '${encryptionKey || 'YOUR_KEY'}';

https.get(\`https://gateway.pinata.cloud/ipfs/\${ipfsHash}\`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        // Decrypt
        const decrypted = CryptoJS.AES.decrypt(data, encryptionKey);
        const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
        
        // Parse result
        if (decryptedText.startsWith('data:image')) {
            console.log('Document is a direct image data URL');
            // Save or display the image
        } else {
            const parsed = JSON.parse(decryptedText);
            console.log('Document data:', parsed);
        }
    });
});`
            }
        ],
        security: [
            'Keep your encryption key secure and private',
            'Never share your key via email or unsecured channels',
            'Verify the IPFS hash matches what was provided',
            'Use HTTPS when transmitting your key'
        ],
        troubleshooting: [
            'If decryption fails, verify you have the correct key',
            'Ensure the entire encrypted string is used (starts with U2FsdGVkX1)',
            'Try different IPFS gateways if download fails',
            'Contact support if you continue to have issues'
        ]
    };
    
    res.json(instructions);
});

/**
 * Test endpoint to verify decryption is working
 */
router.post('/test-decryption', (req, res) => {
    try {
        // Create a test encrypted string
        const CryptoJS = require('crypto-js');
        const testData = { test: true, message: 'Decryption is working!' };
        const testKey = 'test-key-123';
        
        // Encrypt
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(testData), testKey).toString();
        
        // Decrypt using our implementation
        const decrypted = decryptCryptoJS(encrypted, testKey);
        const parsed = JSON.parse(decrypted);
        
        res.json({
            success: true,
            encrypted: encrypted.substring(0, 50) + '...',
            decrypted: parsed,
            message: 'Decryption service is working correctly'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;