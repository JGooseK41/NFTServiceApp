/**
 * TronLink Connection v2 - Simplified approach
 * Uses TronLink's recommended connection method for mobile
 */

(function() {
    console.log('TronLink Connection v2 initialized');
    
    // Override the connection method with a simpler approach
    if (window.mobileWalletConnector) {
        window.mobileWalletConnector.connectTronLinkApp = async function() {
            console.log('Using TronLink Connection v2...');
            
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isMobile) {
                // For mobile, the best approach is to open in TronLink's DApp browser
                // This avoids the external request error entirely
                
                // First check if we're already in TronLink
                if (window.tronWeb && window.tronWeb.ready) {
                    console.log('Already in TronLink browser');
                    handleConnection();
                    this.closeModal();
                    return;
                }
                
                // Show instructions for mobile users
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
                                        <i class="fas fa-mobile-alt"></i> Connect Using TronLink Browser
                                    </h4>
                                    <ol style="text-align: left; padding-left: 1.5rem; line-height: 2; font-size: 1.05rem;">
                                        <li>Open <strong>TronLink app</strong> on your phone</li>
                                        <li>Tap the <strong>Discover</strong> or <strong>Browser</strong> tab 
                                            <span style="color: var(--text-muted); font-size: 0.9rem;">(bottom of screen)</span>
                                        </li>
                                        <li>Enter or paste this URL: <br>
                                            <div style="background: var(--bg-primary); padding: 0.75rem; border-radius: 8px; margin: 0.75rem 0; word-break: break-all; font-family: monospace;">
                                                <strong style="color: var(--primary); font-size: 1.1rem;">${window.location.origin}</strong>
                                            </div>
                                        </li>
                                        <li>The wallet will <strong>connect automatically</strong></li>
                                    </ol>
                                    
                                    <button class="btn btn-primary" style="width: 100%; margin-top: 1.5rem; font-size: 1.1rem; padding: 1rem;" 
                                            onclick="copyToClipboard('${window.location.origin}')">
                                        <i class="fas fa-copy"></i> Copy Website URL
                                    </button>
                                </div>
                                
                                <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
                                    <p style="color: var(--text-muted); font-size: 0.9rem;">
                                        Don't have TronLink? 
                                        <a href="https://www.tronlink.org/download" target="_blank" style="color: var(--primary);">
                                            Download here
                                        </a>
                                    </p>
                                </div>
                                
                                <button class="btn btn-secondary" style="width: 100%; margin-top: 1rem;" 
                                        onclick="mobileWalletConnector.closeModal()">
                                    Cancel
                                </button>
                            </div>
                        `;
                    }
                }
            } else {
                // Desktop - use extension
                if (window.tronWeb && window.tronWeb.ready) {
                    console.log('TronLink extension detected');
                    handleConnection();
                    this.closeModal();
                } else {
                    // Show extension installation instructions
                    this.showMessage(
                        'TronLink Extension Required',
                        'Please install the TronLink browser extension from ' +
                        '<a href="https://www.tronlink.org/download" target="_blank">tronlink.org</a> ' +
                        'and refresh this page.'
                    );
                }
            }
        };
    }
    
    // Handle TronLink deep link
    window.handleTronLinkDeepLink = function(event) {
        event.preventDefault();
        
        const url = window.location.origin;
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isAndroid = /Android/i.test(navigator.userAgent);
        
        // Try different URL schemes based on platform
        let deepLinkUrl;
        
        if (isIOS) {
            // iOS scheme
            deepLinkUrl = `tronlinkoutside://dapp?url=${encodeURIComponent(url)}`;
        } else if (isAndroid) {
            // Android scheme
            deepLinkUrl = `tronlink://dapp?url=${encodeURIComponent(url)}`;
        } else {
            // Fallback for desktop
            window.open('https://www.tronlink.org/download', '_blank');
            return;
        }
        
        // Try to open the deep link
        window.location.href = deepLinkUrl;
        
        // If deep link fails, show alternative
        setTimeout(() => {
            if (document.hasFocus() || document.visibilityState === 'visible') {
                // We're still here, deep link probably failed
                // Update the UI to show the URL to copy
                const btn = event.target.closest('a');
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-info-circle"></i> Copy URL above and paste in TronLink browser';
                    btn.onclick = function() {
                        copyToClipboard(url);
                    };
                }
            }
        }, 2000);
    };
    
    // Copy to clipboard function
    window.copyToClipboard = function(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            
            // Show success message
            const btn = event.target;
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            btn.classList.add('success');
            
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.classList.remove('success');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
        
        document.body.removeChild(textarea);
    };
    
    // Handle successful connection
    function handleConnection() {
        if (!window.tronWeb || !window.tronWeb.ready) {
            console.error('TronLink not ready');
            return;
        }
        
        const address = window.tronWeb.defaultAddress.base58;
        console.log('Connected to TronLink:', address);
        
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
        
        // Initialize unified system if available
        if (window.unifiedSystem) {
            window.unifiedSystem.init();
        }
    }
    
    // Auto-detect TronLink when page loads
    let checkCount = 0;
    const checkInterval = setInterval(() => {
        checkCount++;
        
        if (window.tronWeb && window.tronWeb.ready) {
            console.log('TronLink detected automatically');
            clearInterval(checkInterval);
            handleConnection();
        } else if (checkCount > 10) {
            // Stop checking after 5 seconds
            clearInterval(checkInterval);
        }
    }, 500);
    
    // Listen for TronLink events
    if (window.addEventListener) {
        window.addEventListener('tronLink#initialized', handleConnection);
        window.addEventListener('message', function(e) {
            if (e.data && e.data.message && e.data.message.action === 'connect') {
                handleConnection();
            }
        });
    }
    
})();

console.log('✅ TronLink Connection v2 loaded - Simplified mobile connection');