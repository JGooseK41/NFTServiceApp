// IPFS Integration using Pinata
// This module handles actual IPFS uploads for NFT metadata and documents

const IPFSIntegration = {
    // Decode obfuscated configuration
    decodeConfig(encoded) {
        try {
            // Reverse the string, then base64 decode
            const reversed = encoded.split('').reverse().join('');
            const decoded = atob(reversed);
            return decoded;
        } catch (e) {
            return null;
        }
    },
    
    // Get Pinata configuration
    getConfig() {
        // First check for encoded default config
        if (window.PINATA_CONFIG && window.PINATA_CONFIG.encodedKey) {
            try {
                const apiKey = this.decodeConfig(window.PINATA_CONFIG.encodedKey);
                const secretKey = this.decodeConfig(window.PINATA_CONFIG.encodedSecret);
                if (apiKey && secretKey) {
                    return { apiKey, secretKey };
                }
            } catch (e) {
                console.error('Error decoding config:', e);
            }
        }
        
        // Then check localStorage for admin overrides
        const storedConfig = localStorage.getItem('pinataConfig');
        if (storedConfig) {
            try {
                return JSON.parse(storedConfig);
            } catch (e) {
                console.error('Error parsing stored Pinata config:', e);
            }
        }
        
        return null;
    },
    
    // Save Pinata configuration
    saveConfig(apiKey, secretKey) {
        const config = { apiKey, secretKey };
        localStorage.setItem('pinataConfig', JSON.stringify(config));
        window.PINATA_CONFIG = config;
        return config;
    },
    
    // Upload to Pinata IPFS
    async uploadToPinata(data, metadata = {}) {
        const config = this.getConfig();
        
        if (!config || !config.apiKey) {
            console.warn('No Pinata configuration found. Using fallback storage.');
            return this.uploadToFallbackStorage(data);
        }
        
        try {
            // Determine if data is JSON or binary
            let blob;
            let isJSON = false;
            
            if (typeof data === 'object' && !data.startsWith) {
                // JSON data
                blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                isJSON = true;
            } else if (data.startsWith && data.startsWith('data:')) {
                // Base64 data URL - convert to blob
                const response = await fetch(data);
                blob = await response.blob();
            } else {
                // String data
                blob = new Blob([data], { type: 'text/plain' });
            }
            
            // Create form data
            const formData = new FormData();
            formData.append('file', blob);
            
            // Add Pinata metadata
            const pinataMetadata = {
                name: metadata.name || `legal-notice-${Date.now()}`,
                keyvalues: {
                    type: metadata.type || 'legal-document',
                    timestamp: new Date().toISOString(),
                    ...metadata.keyvalues
                }
            };
            
            formData.append('pinataMetadata', JSON.stringify(pinataMetadata));
            
            // Upload to Pinata
            const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
                method: 'POST',
                headers: {
                    'pinata_api_key': config.apiKey,
                    'pinata_secret_api_key': config.secretKey
                },
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Pinata upload failed: ${error}`);
            }
            
            const result = await response.json();
            console.log('Successfully uploaded to IPFS:', result.IpfsHash);
            
            return result.IpfsHash;
            
        } catch (error) {
            console.error('Error uploading to Pinata:', error);
            // Fall back to local storage
            return this.uploadToFallbackStorage(data);
        }
    },
    
    // Fallback to local storage (for testing without Pinata)
    async uploadToFallbackStorage(data) {
        // Generate deterministic hash for the data
        let dataString;
        if (typeof data === 'object' && !data.startsWith) {
            dataString = JSON.stringify(data);
        } else {
            dataString = data;
        }
        
        const hash = 'Qm' + await this.sha256(dataString);
        
        // Store in localStorage with prefix
        try {
            localStorage.setItem(`ipfs_${hash}`, dataString);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                // Clear old IPFS data
                this.clearOldIPFSData();
                // Try again
                localStorage.setItem(`ipfs_${hash}`, dataString);
            }
        }
        
        console.warn('Using fallback storage. Hash:', hash);
        return hash;
    },
    
    // SHA256 hash function
    async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        // Convert to base58-like format similar to IPFS CID
        return hashHex.substring(0, 44);
    },
    
    // Fetch from IPFS
    async fetchFromIPFS(hash) {
        // First try Pinata gateway
        try {
            const response = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`);
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('json')) {
                    return await response.json();
                }
                return await response.text();
            }
        } catch (error) {
            console.error('Error fetching from Pinata:', error);
        }
        
        // Try public IPFS gateway
        try {
            const response = await fetch(`https://ipfs.io/ipfs/${hash}`);
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('json')) {
                    return await response.json();
                }
                return await response.text();
            }
        } catch (error) {
            console.error('Error fetching from IPFS.io:', error);
        }
        
        // Fall back to localStorage
        const stored = localStorage.getItem(`ipfs_${hash}`);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return stored;
            }
        }
        
        throw new Error(`Could not fetch IPFS content: ${hash}`);
    },
    
    // Clear old IPFS data from localStorage
    clearOldIPFSData() {
        const keys = Object.keys(localStorage);
        const ipfsKeys = keys.filter(key => key.startsWith('ipfs_'));
        
        // Sort by key and remove oldest half
        if (ipfsKeys.length > 10) {
            ipfsKeys.sort();
            const toRemove = ipfsKeys.slice(0, Math.floor(ipfsKeys.length / 2));
            toRemove.forEach(key => localStorage.removeItem(key));
            console.log(`Cleared ${toRemove.length} old IPFS entries`);
        }
    },
    
    // Test Pinata connection
    async testConnection(apiKey, secretKey) {
        try {
            const response = await fetch('https://api.pinata.cloud/data/testAuthentication', {
                headers: {
                    'pinata_api_key': apiKey,
                    'pinata_secret_api_key': secretKey
                }
            });
            
            return response.ok;
        } catch (error) {
            console.error('Error testing Pinata connection:', error);
            return false;
        }
    }
};

// Export for use
window.IPFSIntegration = IPFSIntegration;

// Override the uploadToIPFS function in SimpleEncryption to use real IPFS
if (window.SimpleEncryption) {
    window.SimpleEncryption.uploadToIPFS = async function(data) {
        return await IPFSIntegration.uploadToPinata(data, {
            name: 'encrypted-legal-document',
            type: 'encrypted-document'
        });
    };
    
    window.SimpleEncryption.fetchFromIPFS = async function(hash) {
        return await IPFSIntegration.fetchFromIPFS(hash);
    };
}

// Override the uploadToIPFS function in ThumbnailGenerator to use real IPFS
document.addEventListener('DOMContentLoaded', function() {
    // Wait for ThumbnailGenerator to be loaded
    if (window.ThumbnailGenerator && window.SimpleEncryption) {
        // Override SimpleEncryption's uploadToIPFS first
        window.SimpleEncryption.uploadToIPFS = async function(data) {
            return await IPFSIntegration.uploadToPinata(data, {
                name: 'encrypted-legal-document',
                type: 'encrypted-document'
            });
        };
        
        // Then override ThumbnailGenerator's usage
        const originalProcessDocument = window.ThumbnailGenerator.processDocumentForNFT;
        window.ThumbnailGenerator.processDocumentForNFT = async function(documentData, noticeDetails, noticeId) {
            // Temporarily override the uploadToIPFS for this operation
            const originalUpload = window.SimpleEncryption.uploadToIPFS;
            
            window.SimpleEncryption.uploadToIPFS = async function(data) {
                if (typeof data === 'string' && data.startsWith('data:image')) {
                    return await IPFSIntegration.uploadToPinata(data, {
                        name: 'legal-notice-thumbnail',
                        type: 'nft-image'
                    });
                } else if (typeof data === 'string') {
                    // JSON metadata
                    return await IPFSIntegration.uploadToPinata(data, {
                        name: 'legal-notice-metadata',
                        type: 'nft-metadata'
                    });
                }
                return await originalUpload(data);
            };
            
            // Call the original function
            const result = await originalProcessDocument.call(this, documentData, noticeDetails, noticeId);
            
            // Restore original function
            window.SimpleEncryption.uploadToIPFS = originalUpload;
            
            return result;
        };
    }
});