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
                                    <h4 style="color: var(--primary); margin-bottom: 1rem;">Method 1: Open in TronLink Browser (Recommended)</h4>
                                    <ol style="text-align: left; padding-left: 1.5rem; line-height: 1.8;">
                                        <li>Open <strong>TronLink app</strong> on your phone</li>
                                        <li>Tap the <strong>Discover</strong> or <strong>Browser</strong> tab at the bottom</li>
                                        <li>Enter this URL: <br>
                                            <div style="background: var(--bg-primary); padding: 0.5rem; border-radius: 4px; margin: 0.5rem 0; word-break: break-all;">
                                                <strong>${window.location.origin}</strong>
                                            </div>
                                        </li>
                                        <li>The wallet will connect automatically</li>
                                    </ol>
                                    
                                    <button class="btn btn-primary" style="width: 100%; margin-top: 1rem;" 
                                            onclick="copyToClipboard('${window.location.origin}')">
                                        <i class="fas fa-copy"></i> Copy URL
                                    </button>
                                </div>
                                
                                <div style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px;">
                                    <h4 style="color: var(--primary); margin-bottom: 1rem;">Method 2: Direct Link</h4>
                                    <p style="text-align: left; margin-bottom: 1rem;">
                                        If you have TronLink installed, try opening directly:
                                    </p>
                                    <a href="https://link.tronlink.org/open?url=${encodeURIComponent(window.location.origin)}" 
                                       target="_blank" 
                                       class="btn btn-secondary" 
                                       style="width: 100%;">
                                        <i class="fas fa-external-link-alt"></i> Open in TronLink
                                    </a>
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