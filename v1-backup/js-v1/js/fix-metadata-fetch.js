/**
 * FIX METADATA FETCH ERROR
 * Handles invalid metadata URIs and HTML responses
 */

console.log('🔧 Fixing metadata fetch errors...');

// Override the metadata fetch in notice-workflow.js
(function() {
    // Store original fetch
    const originalFetch = window.fetch;
    
    // Override fetch to handle metadata errors
    window.fetch = async function(url, ...args) {
        // Check if this is a metadata fetch
        if (url && (url.includes('ipfs') || url.includes('metadata'))) {
            console.log('📡 Fetching metadata from:', url);
            
            try {
                const response = await originalFetch.call(this, url, ...args);
                
                // Check content type
                const contentType = response.headers.get('content-type');
                
                if (contentType && contentType.includes('text/html')) {
                    console.warn('⚠️ Received HTML instead of JSON from:', url);
                    console.warn('This usually means the metadata URL is invalid or returning 404');
                    
                    // Return a default metadata object instead of throwing
                    return {
                        ok: true,
                        json: async () => ({
                            name: 'Legal Notice NFT',
                            description: 'Legal notice delivered via blockchain',
                            image: 'https://nft-legal-service.netlify.app/images/legal-notice-nft.png',
                            error: 'Invalid metadata URL'
                        }),
                        headers: response.headers,
                        status: response.status
                    };
                }
                
                return response;
                
            } catch (error) {
                console.error('Metadata fetch error:', error);
                
                // Return default metadata on error
                return {
                    ok: false,
                    json: async () => ({
                        name: 'Legal Notice NFT',
                        description: 'Legal notice delivered via blockchain',
                        image: 'https://nft-legal-service.netlify.app/images/legal-notice-nft.png',
                        error: error.message
                    }),
                    headers: new Headers(),
                    status: 500
                };
            }
        }
        
        // For non-metadata requests, use original fetch
        return originalFetch.call(this, url, ...args);
    };
})();

// Fix the specific notice-workflow metadata fetch
if (window.NoticeWorkflow) {
    const original = NoticeWorkflow.prototype.fetchMetadata;
    if (original) {
        NoticeWorkflow.prototype.fetchMetadata = async function(uri) {
            console.log('🔍 Fetching metadata for URI:', uri);
            
            if (!uri || uri === 'undefined' || uri === 'null') {
                console.warn('Invalid metadata URI:', uri);
                return {
                    name: 'Legal Notice',
                    description: 'No metadata available',
                    image: 'https://nft-legal-service.netlify.app/images/legal-notice-nft.png'
                };
            }
            
            try {
                // Handle IPFS URIs
                if (uri.startsWith('ipfs://')) {
                    // Try multiple IPFS gateways
                    const gateways = [
                        'https://gateway.pinata.cloud/ipfs/',
                        'https://ipfs.io/ipfs/',
                        'https://cloudflare-ipfs.com/ipfs/'
                    ];
                    
                    for (const gateway of gateways) {
                        try {
                            const url = uri.replace('ipfs://', gateway);
                            const response = await fetch(url);
                            
                            if (response.ok) {
                                const text = await response.text();
                                
                                // Check if it's JSON
                                if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                                    return JSON.parse(text);
                                } else {
                                    console.warn('Response is not JSON:', text.substring(0, 100));
                                }
                            }
                        } catch (e) {
                            console.warn(`Gateway ${gateway} failed:`, e);
                        }
                    }
                }
                
                // Handle data URIs
                if (uri.startsWith('data:')) {
                    const base64 = uri.split(',')[1];
                    return JSON.parse(atob(base64));
                }
                
                // Handle HTTP(S) URIs
                if (uri.startsWith('http')) {
                    const response = await fetch(uri);
                    const text = await response.text();
                    
                    // Check if it's JSON
                    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                        return JSON.parse(text);
                    } else {
                        throw new Error('Response is not JSON');
                    }
                }
                
            } catch (error) {
                console.error('Error fetching metadata:', error);
            }
            
            // Return default metadata
            return {
                name: 'Legal Notice NFT',
                description: 'Metadata unavailable',
                image: 'https://nft-legal-service.netlify.app/images/legal-notice-nft.png',
                error: 'Failed to fetch metadata'
            };
        };
    }
}

// Also check what metadata URIs are actually being set
(function() {
    if (window.legalContract) {
        const originalTokenURI = window.legalContract.tokenURI;
        if (originalTokenURI) {
            window.legalContract.tokenURI = function(tokenId) {
                const result = originalTokenURI.call(this, tokenId);
                const originalCall = result.call;
                
                result.call = async function() {
                    const uri = await originalCall.call(this);
                    
                    console.log(`Token #${tokenId} URI:`, uri || '(empty)');
                    
                    if (!uri || uri === '' || uri === 'undefined') {
                        console.warn(`⚠️ Token #${tokenId} has no metadata URI!`);
                        console.warn('This token will NOT display in wallets');
                    }
                    
                    return uri;
                };
                
                return result;
            };
        }
    }
})();

console.log('✅ Metadata fetch error handling loaded');
console.log('Invalid metadata URIs will now return default metadata instead of crashing');