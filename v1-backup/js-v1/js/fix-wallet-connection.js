/**
 * FIX WALLET CONNECTION ISSUES
 * Prevents disconnection on tab switch and adds reconnection capability
 */

console.log('🔧 Fixing wallet connection issues...');

(function() {
    // Store original functions
    const originalShowTab = window.showTab;
    const originalDisconnectWallet = window.disconnectWallet;
    
    // Flag to track if we're switching tabs
    let isTabSwitching = false;
    
    // Override showTab to prevent disconnection
    window.showTab = function(tabName) {
        console.log('Switching to tab:', tabName);
        isTabSwitching = true;
        
        // Call original function
        if (originalShowTab) {
            originalShowTab.call(this, tabName);
        }
        
        // Reset flag
        setTimeout(() => {
            isTabSwitching = false;
        }, 100);
        
        // Ensure wallet stays connected
        ensureWalletConnected();
    };
    
    // Override disconnectWallet to prevent unwanted disconnections
    window.disconnectWallet = function() {
        // Only disconnect if not switching tabs
        if (!isTabSwitching) {
            console.log('Allowing wallet disconnection');
            if (originalDisconnectWallet) {
                originalDisconnectWallet.call(this);
            }
        } else {
            console.log('Prevented wallet disconnection during tab switch');
        }
    };
    
    // Function to ensure wallet stays connected
    function ensureWalletConnected() {
        // Check if TronWeb exists and should be connected
        if (window.tronWeb && window.tronWeb.defaultAddress && window.tronWeb.defaultAddress.base58) {
            // Update UI to show connected state
            const connectBtn = document.getElementById('connectBtn');
            const walletStatus = document.getElementById('walletStatus');
            const walletAddress = document.getElementById('walletAddress');
            const networkIndicator = document.getElementById('networkIndicator');
            const networkName = document.getElementById('networkName');
            
            if (connectBtn && walletStatus) {
                walletStatus.style.display = 'none';
                
                // Show wallet address
                if (walletAddress) {
                    walletAddress.style.display = 'block';
                    walletAddress.textContent = window.tronWeb.defaultAddress.base58.substring(0, 6) + '...' + 
                                               window.tronWeb.defaultAddress.base58.slice(-4);
                }
                
                // Update network indicator
                if (networkIndicator && networkName) {
                    networkName.textContent = 'Mainnet';
                    networkIndicator.classList.add('connected');
                }
                
                // Update connect button
                connectBtn.innerHTML = '<i class="fas fa-check-circle"></i> Connected';
                connectBtn.classList.remove('btn-primary');
                connectBtn.classList.add('btn-success');
                connectBtn.disabled = true;
            }
            
            // Ensure contract is connected
            ensureContractConnected();
        }
    }
    
    // Function to ensure contract stays connected
    function ensureContractConnected() {
        if (window.tronWeb && window.tronWeb.ready && !window.legalContract) {
            // Try to reconnect contract
            detectNetworkAndSetContract();
        }
    }
    
    // Add reconnect button if wallet gets disconnected
    function addReconnectButton() {
        const walletStatus = document.getElementById('walletStatus');
        const connectBtn = document.getElementById('connectBtn');
        
        // Check if wallet is disconnected
        if (walletStatus && walletStatus.style.display === 'block' && 
            walletStatus.textContent === 'Not Connected') {
            
            // Make connect button always visible and clickable
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.style.display = 'inline-block';
                connectBtn.classList.remove('btn-success');
                connectBtn.classList.add('btn-primary');
                connectBtn.innerHTML = '<i class="fas fa-link"></i> Reconnect Wallet';
                
                // Ensure onclick works
                connectBtn.onclick = async function() {
                    console.log('Reconnecting wallet...');
                    if (window.connectWallet) {
                        await window.connectWallet();
                    }
                };
            }
        }
    }
    
    // Check connection status periodically
    setInterval(() => {
        // Check if wallet should be connected but UI shows disconnected
        const walletStatus = document.getElementById('walletStatus');
        if (walletStatus && walletStatus.style.display === 'block') {
            if (window.tronWeb && window.tronWeb.ready) {
                // Wallet is actually connected but UI shows disconnected
                console.log('Fixing UI disconnect state');
                ensureWalletConnected();
            } else {
                // Wallet is actually disconnected - add reconnect button
                addReconnectButton();
            }
        }
    }, 1000);
    
    // Fix for served notices tab
    const deliveryTab = document.querySelector('[onclick*="showTab(\'delivery\')"]');
    if (deliveryTab) {
        deliveryTab.onclick = function(e) {
            e.preventDefault();
            window.showTab('delivery');
            // Ensure wallet stays connected
            setTimeout(ensureWalletConnected, 100);
        };
    }
    
    console.log('✅ Wallet connection fixes applied');
})();

// Also remove the perpetual loading screen
(function() {
    // Find and remove any stuck loading screens
    const removeStuckLoaders = () => {
        // Look for transaction status elements
        const transactionStatus = document.querySelector('.transaction-status');
        const processingOverlay = document.querySelector('.processing-overlay');
        const loadingIndicators = document.querySelectorAll('[class*="loading"], [class*="processing"]');
        
        loadingIndicators.forEach(indicator => {
            // Check if it's been showing for too long
            if (indicator.textContent && 
                (indicator.textContent.includes('Processing') || 
                 indicator.textContent.includes('processing'))) {
                
                // Check if it has been visible for more than 30 seconds
                if (!indicator.dataset.checkTime) {
                    indicator.dataset.checkTime = Date.now();
                } else if (Date.now() - parseInt(indicator.dataset.checkTime) > 30000) {
                    console.log('Removing stuck loading indicator:', indicator);
                    indicator.remove();
                }
            }
        });
        
        // Specifically target bottom-right processing message
        const bottomRightLoaders = document.querySelectorAll(`
            [style*="position: fixed"][style*="bottom"][style*="right"],
            [style*="position:fixed"][style*="bottom"][style*="right"]
        `);
        
        bottomRightLoaders.forEach(loader => {
            if (loader.textContent && loader.textContent.includes('transaction')) {
                console.log('Removing stuck transaction loader');
                loader.remove();
            }
        });
    };
    
    // Run immediately
    removeStuckLoaders();
    
    // Run periodically to catch any new stuck loaders
    setInterval(removeStuckLoaders, 5000);
    
    console.log('✅ Stuck loader removal active');
})();