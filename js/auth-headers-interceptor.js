/**
 * AUTH HEADERS INTERCEPTOR
 * Must be loaded BEFORE any other scripts that make API calls
 * Automatically adds authentication headers to all backend API requests
 */

(function() {
    console.log('🔐 Installing auth headers interceptor...');
    
    // Store original fetch
    const originalFetch = window.fetch;
    
    // Override fetch globally
    window.fetch = async function(url, options = {}) {
        // Check if this is a backend API call
        if (typeof url === 'string' && 
            (url.includes('/api/notices') || 
             url.includes('nftserviceapp.onrender.com') ||
             url.includes('/api/sync') ||
             url.includes('/api/documents') ||
             url.includes('/api/images'))) {
            
            // Ensure headers object exists
            if (!options.headers) {
                options.headers = {};
            }
            
            // Convert Headers object to plain object if needed
            if (options.headers instanceof Headers) {
                const newHeaders = {};
                options.headers.forEach((value, key) => {
                    newHeaders[key] = value;
                });
                options.headers = newHeaders;
            }
            
            // Add authentication headers if not already present
            if (!options.headers['X-Wallet-Address']) {
                // Try multiple sources for wallet address
                const walletAddress = 
                    window.tronWeb?.defaultAddress?.base58 || 
                    localStorage.getItem('walletAddress') || 
                    localStorage.getItem('currentWalletAddress') ||
                    '';
                
                if (walletAddress) {
                    options.headers['X-Wallet-Address'] = walletAddress;
                    console.log('Added X-Wallet-Address:', walletAddress.substring(0, 6) + '...');
                }
            }
            
            if (!options.headers['X-Server-Address']) {
                // Try multiple sources for server address
                const serverAddress = 
                    localStorage.getItem('serverAddress') || 
                    localStorage.getItem('currentServerAddress') ||
                    window.tronWeb?.defaultAddress?.base58 || 
                    '';
                
                if (serverAddress) {
                    options.headers['X-Server-Address'] = serverAddress;
                }
            }
            
            // Log the request for debugging
            if (url.includes('/api/notices') && url.includes('/images')) {
                console.log('📸 Image request:', url, 'Headers:', options.headers);
            }
        }
        
        // Call original fetch
        return originalFetch.call(this, url, options);
    };
    
    // Also intercept XMLHttpRequest for completeness
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        this._method = method;
        return originalXHROpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function() {
        if (this._url && 
            (this._url.includes('/api/notices') || 
             this._url.includes('nftserviceapp.onrender.com'))) {
            
            const walletAddress = 
                window.tronWeb?.defaultAddress?.base58 || 
                localStorage.getItem('walletAddress') || 
                '';
            
            const serverAddress = 
                localStorage.getItem('serverAddress') || 
                window.tronWeb?.defaultAddress?.base58 || 
                '';
            
            if (walletAddress) {
                this.setRequestHeader('X-Wallet-Address', walletAddress);
            }
            
            if (serverAddress) {
                this.setRequestHeader('X-Server-Address', serverAddress);
            }
        }
        
        return originalXHRSend.apply(this, arguments);
    };
    
    console.log('✅ Auth headers interceptor installed');
    
    // Store addresses when wallet connects
    window.addEventListener('walletConnected', function(event) {
        if (event.detail && event.detail.address) {
            localStorage.setItem('walletAddress', event.detail.address);
            localStorage.setItem('currentWalletAddress', event.detail.address);
            console.log('💾 Stored wallet address:', event.detail.address.substring(0, 6) + '...');
        }
    });
    
    // Also watch for TronWeb ready
    if (window.tronWeb && window.tronWeb.ready) {
        const address = window.tronWeb.defaultAddress.base58;
        if (address) {
            localStorage.setItem('walletAddress', address);
            localStorage.setItem('currentWalletAddress', address);
        }
    }
})();