/**
 * Decryption Helper Module
 * Provides consistent decryption functionality based on our proven methods
 */

const DecryptionHelper = {
    /**
     * Generate decryption instructions for a notice
     */
    generateInstructions: function(ipfsHash, encryptionKey) {
        return {
            title: "How to Decrypt Your Document",
            webTool: {
                url: `${window.location.origin}/decrypt-document.html?ipfs=${ipfsHash}&key=${encryptionKey}`,
                instructions: "Click the link above to decrypt your document using our web tool"
            },
            manual: {
                step1: "Download encrypted data from IPFS:",
                ipfsUrl: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
                step2: "Use your decryption key:",
                key: encryptionKey,
                step3: "Decrypt using CryptoJS or compatible AES-256-CBC decryption",
                code: `
// JavaScript Example
const CryptoJS = require('crypto-js');
const encryptedData = 'YOUR_ENCRYPTED_DATA_FROM_IPFS';
const key = '${encryptionKey}';
const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
const document = decrypted.toString(CryptoJS.enc.Utf8);
                `
            }
        };
    },

    /**
     * Decrypt data using CryptoJS (client-side)
     */
    decryptData: function(encryptedData, encryptionKey) {
        try {
            if (!encryptedData || !encryptionKey) {
                throw new Error('Missing encrypted data or key');
            }

            // Check if data is encrypted
            if (encryptedData.startsWith('U2FsdGVkX1')) {
                // Decrypt using CryptoJS
                const decrypted = CryptoJS.AES.decrypt(encryptedData, encryptionKey);
                const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
                
                if (!decryptedText) {
                    throw new Error('Decryption failed - invalid key');
                }
                
                // Parse the result
                if (decryptedText.startsWith('data:image')) {
                    return { success: true, type: 'image', data: decryptedText };
                } else {
                    try {
                        const parsed = JSON.parse(decryptedText);
                        return { success: true, type: 'json', data: parsed };
                    } catch (e) {
                        return { success: true, type: 'text', data: decryptedText };
                    }
                }
            } else if (encryptedData.startsWith('data:image')) {
                // Already a data URL, not encrypted
                return { success: true, type: 'image', data: encryptedData };
            } else {
                // Try to parse as JSON
                try {
                    const parsed = JSON.parse(encryptedData);
                    return { success: true, type: 'json', data: parsed };
                } catch (e) {
                    throw new Error('Unknown data format');
                }
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Fetch and decrypt from IPFS
     */
    fetchAndDecrypt: async function(ipfsHash, encryptionKey) {
        try {
            // Try multiple gateways
            const gateways = [
                'https://gateway.pinata.cloud/ipfs/',
                'https://ipfs.io/ipfs/',
                'https://cloudflare-ipfs.com/ipfs/'
            ];
            
            let encryptedData = null;
            
            for (const gateway of gateways) {
                try {
                    const response = await fetch(gateway + ipfsHash);
                    if (response.ok) {
                        encryptedData = await response.text();
                        break;
                    }
                } catch (e) {
                    console.log(`Gateway ${gateway} failed, trying next...`);
                }
            }
            
            if (!encryptedData) {
                throw new Error('Failed to fetch from IPFS');
            }
            
            // Decrypt the data
            return this.decryptData(encryptedData, encryptionKey);
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Add decryption info to a receipt
     */
    addToReceipt: function(receiptElement, ipfsHash, encryptionKey) {
        const decryptSection = document.createElement('div');
        decryptSection.className = 'decryption-info';
        decryptSection.style.cssText = `
            margin-top: 20px;
            padding: 15px;
            background: #f0f8ff;
            border: 2px solid #4a90e2;
            border-radius: 8px;
        `;
        
        decryptSection.innerHTML = `
            <h3 style="color: #4a90e2; margin-bottom: 10px;">🔐 Document Access Information</h3>
            <p style="margin-bottom: 10px;">Your document is securely encrypted. Use the information below to access it:</p>
            
            <div style="background: white; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
                <strong>IPFS Hash:</strong><br>
                <code style="word-break: break-all; font-size: 12px;">${ipfsHash}</code>
            </div>
            
            <div style="background: white; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
                <strong>Decryption Key:</strong><br>
                <code style="word-break: break-all; font-size: 12px;">${encryptionKey}</code>
            </div>
            
            <div style="margin-top: 15px;">
                <a href="${window.location.origin}/decrypt-document.html?ipfs=${ipfsHash}&key=${encryptionKey}" 
                   target="_blank"
                   style="display: inline-block; padding: 10px 20px; background: #4a90e2; color: white; text-decoration: none; border-radius: 5px;">
                    Decrypt Document Online
                </a>
            </div>
            
            <p style="margin-top: 10px; font-size: 12px; color: #666;">
                <strong>Important:</strong> Keep this information secure. Anyone with the decryption key can access your document.
            </p>
        `;
        
        receiptElement.appendChild(decryptSection);
    },

    /**
     * Test the decryption process
     */
    testDecryption: function() {
        console.log('Testing decryption process...');
        
        // Create test data
        const testData = { test: true, timestamp: new Date().toISOString() };
        const testKey = 'test-key-' + Date.now();
        
        // Encrypt
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(testData), testKey).toString();
        console.log('Encrypted:', encrypted.substring(0, 50) + '...');
        
        // Decrypt
        const result = this.decryptData(encrypted, testKey);
        console.log('Decryption result:', result);
        
        if (result.success && result.data.test === true) {
            console.log('✅ Decryption test passed!');
            return true;
        } else {
            console.error('❌ Decryption test failed!');
            return false;
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DecryptionHelper;
}