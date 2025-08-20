/**
 * Official TronLink Integration
 * Based on TronLink documentation for proper connection
 */

(function() {
    console.log('TronLink Official Integration loaded');
    
    // Check for TronLink and request authorization
    async function connectTronLink() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 10 seconds (100 * 100ms)
            
            const checkInterval = setInterval(async () => {
                attempts++;
                
                // Check if TronLink is available
                if (window.tronLink && window.tronWeb) {
                    clearInterval(checkInterval);
                    
                    try {
                        // Check if already connected
                        if (window.tronLink.ready && window.tronWeb.defaultAddress.base58) {
                            console.log('TronLink already connected:', window.tronWeb.defaultAddress.base58);
                            resolve({
                                connected: true,
                                address: window.tronWeb.defaultAddress.base58,
                                alreadyConnected: true
                            });
                            return;
                        }
                        
                        // Request user authorization using the official method
                        console.log('Requesting TronLink authorization...');
                        const res = await window.tronLink.request({
                            method: 'tron_requestAccounts'
                        });
                        
                        console.log('TronLink response:', res);
                        
                        if (res.code === 200) {
                            // User accepted authorization
                            // Wait a moment for tronWeb to update
                            setTimeout(() => {
                                if (window.tronWeb && window.tronWeb.defaultAddress.base58) {
                                    resolve({
                                        connected: true,
                                        address: window.tronWeb.defaultAddress.base58
                                    });
                                } else {
                                    reject(new Error('Failed to get address after authorization'));
                                }
                            }, 500);
                        } else if (res.code === 4000) {
                            // In queue, no need to repeat
                            console.log('Authorization request already in queue');
                            reject(new Error('Authorization request already pending'));
                        } else if (res.code === 4001) {
                            // User rejected
                            console.log('User rejected authorization');
                            reject(new Error('User rejected the connection request'));
                        } else {
                            reject(new Error(`Unknown response code: ${res.code}`));
                        }
                    } catch (error) {
                        console.error('Error requesting TronLink authorization:', error);
                        reject(error);
                    }
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    reject(new Error('TronLink not detected. Please install TronLink extension or use TronLink mobile browser.'));
                }
            }, 100);
        });
    }
    
    // Update the mobile wallet connector if it exists
    if (window.mobileWalletConnector) {
        const originalConnect = window.mobileWalletConnector.connectTronLinkApp;
        
        window.mobileWalletConnector.connectTronLinkApp = async function() {
            console.log('Using official TronLink connection method...');
            
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            try {
                // Try to connect using the official method
                const result = await connectTronLink();
                
                if (result.connected) {
                    // Update UI
                    handleSuccessfulConnection(result.address);
                    this.closeModal();
                }
            } catch (error) {
                console.error('Connection error:', error);
                
                if (error.message.includes('not detected')) {
                    // TronLink not found
                    if (isMobile) {
                        // Show mobile instructions
                        showMobileInstructions.call(this);
                    } else {
                        // Show desktop instructions
                        this.showMessage(
                            'TronLink Extension Required',
                            'Please install the TronLink browser extension from ' +
                            '<a href="https://www.tronlink.org/download" target="_blank">tronlink.org</a> ' +
                            'and refresh this page.'
                        );
                    }
                } else if (error.message.includes('rejected')) {
                    // User rejected
                    this.showError('Connection cancelled by user');
                } else {
                    // Other error
                    this.showError(error.message);
                }
            }
        };
    }
    
    // Show mobile instructions
    function showMobileInstructions() {
        const modal = document.querySelector('.mobile-wallet-modal');
        if (modal) {
            const content = modal.querySelector('.mobile-wallet-options');
            if (content) {
                content.innerHTML = `
                    <div style="padding: 2rem;">
                        <h3 style="margin-bottom: 1.5rem; text-align: center;">
                            <i class="fas fa-mobile-alt" style="color: var(--primary);"></i> 
                            Connect with TronLink Mobile
                        </h3>
                        
                        <div style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                            <h4 style="color: var(--primary); margin-bottom: 1rem;">
                                <i class="fas fa-info-circle"></i> TronLink Not Detected
                            </h4>
                            <p style="margin-bottom: 1rem;">
                                To connect on mobile, you need to open this website from within the TronLink app:
                            </p>
                            <ol style="text-align: left; padding-left: 1.5rem; line-height: 2;">
                                <li>Open <strong>TronLink app</strong></li>
                                <li>Tap <strong>Discover</strong> or <strong>Browser</strong> tab</li>
                                <li>Enter this URL:
                                    <div style="background: var(--bg-primary); padding: 0.75rem; border-radius: 8px; margin: 0.5rem 0; word-break: break-all; font-family: monospace;">
                                        <strong style="color: var(--primary);">${window.location.origin}</strong>
                                    </div>
                                </li>
                                <li>Connection will be automatic</li>
                            </ol>
                            
                            <button class="btn btn-primary" style="width: 100%; margin-top: 1rem;" 
                                    onclick="copyToClipboard('${window.location.origin}')">
                                <i class="fas fa-copy"></i> Copy URL
                            </button>
                        </div>
                        
                        <button class="btn btn-secondary" style="width: 100%;" 
                                onclick="mobileWalletConnector.closeModal()">
                            Close
                        </button>
                    </div>
                `;
            }
        }
    }
    
    // Handle successful connection
    function handleSuccessfulConnection(address) {
        console.log('Successfully connected to TronLink:', address);
        
        // Update connect button
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.innerHTML = `<i class="fas fa-check-circle"></i> ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
            connectBtn.classList.add('connected');
        }
        
        // Show success notification
        if (window.uiManager && window.uiManager.showNotification) {
            window.uiManager.showNotification('success', 'Connected to TronLink!');
        }
        
        // Initialize app features
        if (window.initializeApp) {
            window.initializeApp();
        }
        
        // Initialize unified system
        if (window.unifiedSystem) {
            window.unifiedSystem.init();
        }
    }
    
    // Auto-connect on page load if TronLink is ready
    window.addEventListener('load', async () => {
        // Give TronLink time to inject
        setTimeout(async () => {
            if (window.tronLink && window.tronLink.ready && window.tronWeb && window.tronWeb.defaultAddress.base58) {
                console.log('TronLink detected and ready on page load');
                handleSuccessfulConnection(window.tronWeb.defaultAddress.base58);
            }
        }, 500);
    });
    
    // Listen for TronLink state changes
    window.addEventListener('message', function(e) {
        if (e.data && e.data.message && e.data.message.action === 'setAccount') {
            console.log('TronLink account changed');
            if (window.tronWeb && window.tronWeb.defaultAddress.base58) {
                handleSuccessfulConnection(window.tronWeb.defaultAddress.base58);
            }
        }
        
        if (e.data && e.data.message && e.data.message.action === 'disconnect') {
            console.log('TronLink disconnected');
            const connectBtn = document.getElementById('connectBtn');
            if (connectBtn) {
                connectBtn.innerHTML = '<i class="fas fa-wallet"></i> Connect Wallet';
                connectBtn.classList.remove('connected');
            }
        }
    });
    
})();

console.log('✅ TronLink Official Integration initialized');