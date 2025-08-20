/**
 * TronLink Mobile Connection Fix
 * Fixes the "Invalid external request data" error
 */

(function() {
    console.log('TronLink Mobile Fix loaded');
    
    // Override the mobile connector's TronLink connection method
    if (window.mobileWalletConnector) {
        const originalConnect = window.mobileWalletConnector.connectTronLinkApp;
        
        window.mobileWalletConnector.connectTronLinkApp = async function() {
            console.log('Using fixed TronLink connection method...');
            
            try {
                // Method 1: Use TronLink's standard browser connection
                // This works when the user opens the DApp from within TronLink's browser
                if (window.tronWeb && window.tronWeb.ready) {
                    console.log('TronLink already connected');
                    await handleTronLinkConnection();
                    this.closeModal();
                    return;
                }
                
                // Method 2: Use proper deep link format for TronLink
                // According to TronLink documentation, the format should be:
                const dappUrl = window.location.href;
                const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
                const isAndroid = /Android/i.test(navigator.userAgent);
                
                let deepLink;
                
                if (isIOS) {
                    // iOS: Use the tronlinkoutside scheme
                    // Format: tronlinkoutside://pull.activity?param=<encoded_json>
                    const params = {
                        activityType: 'dapp',
                        activityData: {
                            url: dappUrl,
                            dappName: 'BlockServed',
                            protocol: 'TronLink',
                            version: '1.0'
                        }
                    };
                    deepLink = `tronlinkoutside://pull.activity?param=${encodeURIComponent(JSON.stringify(params))}`;
                } else if (isAndroid) {
                    // Android: Use the tronlink scheme with proper intent
                    // Format: tronlink://open/dapp?param=<encoded_json>
                    const params = {
                        url: dappUrl,
                        dappName: 'BlockServed',
                        chain: 'tron'
                    };
                    deepLink = `tronlink://open/dapp?param=${encodeURIComponent(JSON.stringify(params))}`;
                } else {
                    // Desktop fallback
                    this.showError('Please use TronLink mobile app or browser extension');
                    return;
                }
                
                console.log('Opening TronLink with deep link:', deepLink);
                
                // Method 3: Alternative approach using universal link
                const universalLink = `https://www.tronlink.org/dl/open?url=${encodeURIComponent(dappUrl)}`;
                
                // Try the deep link first
                const opened = window.open(deepLink, '_blank');
                
                if (!opened) {
                    // If popup blocked, use location.href
                    window.location.href = deepLink;
                }
                
                // Set a timeout to check if the app opened
                setTimeout(() => {
                    // If we're still here and the page has focus, the app didn't open
                    if (document.hasFocus() || document.visibilityState === 'visible') {
                        console.log('Deep link may have failed, trying universal link...');
                        
                        // Show instructions to the user
                        this.showMessage(
                            'Opening TronLink...', 
                            'If TronLink doesn\'t open automatically, ' +
                            '<a href="' + universalLink + '" target="_blank">click here</a> or ' +
                            'open TronLink app manually and navigate to this website from the DApp browser.'
                        );
                    }
                }, 2000);
                
            } catch (error) {
                console.error('Error connecting to TronLink:', error);
                this.showError('Failed to connect. Please open this website from TronLink\'s DApp browser.');
            }
        };
    }
    
    // Handle successful TronLink connection
    async function handleTronLinkConnection() {
        if (!window.tronWeb || !window.tronWeb.ready) {
            console.error('TronLink not ready');
            return;
        }
        
        const address = window.tronWeb.defaultAddress.base58;
        console.log('Connected to TronLink:', address);
        
        // Update UI
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.innerHTML = `<i class="fas fa-check-circle"></i> ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
            connectBtn.classList.add('connected');
        }
        
        // Show success message
        if (window.uiManager && window.uiManager.showNotification) {
            window.uiManager.showNotification('success', 'Connected to TronLink successfully!');
        }
        
        // Initialize the app
        if (window.initializeApp) {
            window.initializeApp();
        }
    }
    
    // Check for TronLink on page load
    window.addEventListener('load', function() {
        // Give TronLink time to inject
        setTimeout(() => {
            if (window.tronWeb && window.tronWeb.ready) {
                console.log('TronLink detected on load');
                handleTronLinkConnection();
            }
        }, 500);
    });
    
    // Listen for TronLink injection
    window.addEventListener('tronLink#initialized', handleTronLinkConnection);
    
    // Alternative: Poll for TronLink
    let pollCount = 0;
    const pollInterval = setInterval(() => {
        pollCount++;
        if (window.tronWeb && window.tronWeb.ready) {
            console.log('TronLink detected via polling');
            clearInterval(pollInterval);
            handleTronLinkConnection();
        } else if (pollCount > 20) {
            // Stop after 10 seconds
            clearInterval(pollInterval);
        }
    }, 500);
    
})();

console.log('✅ TronLink Mobile Fix initialized');