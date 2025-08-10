/**
 * Mobile Wallet Connector for TRON
 * Handles WalletConnect, Deep Linking, and QR Code connections
 */

class MobileWalletConnector {
    constructor() {
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        this.isAndroid = /Android/i.test(navigator.userAgent);
        this.connectionMethod = null;
        this.walletConnectBridge = 'https://bridge.walletconnect.org';
        this.deepLinkTimeout = 3000; // 3 seconds to open app before showing QR
        this.connectionInProgress = false; // Prevent multiple connection attempts
        this.connectionTimeout = null; // Track timeout for cleanup
        this.eventListeners = []; // Track event listeners for cleanup
    }

    /**
     * Initialize mobile wallet connection UI
     */
    init() {
        console.log('Mobile Wallet Connector initialized');
        console.log('Is Mobile:', this.isMobile);
        console.log('Platform:', this.isIOS ? 'iOS' : this.isAndroid ? 'Android' : 'Desktop');
        
        // Add mobile connection button if on mobile
        if (this.isMobile) {
            this.setupMobileUI();
        }
        
        // Setup WalletConnect if available
        this.setupWalletConnect();
    }

    /**
     * Setup mobile-specific UI elements
     */
    setupMobileUI() {
        // Check if TronLink is already connected
        if (window.tronWeb && window.tronWeb.ready) {
            console.log('Wallet already connected');
            return;
        }

        // Replace or enhance the existing connect button for mobile
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn && !window.tronWeb) {
            connectBtn.innerHTML = '<i class="fas fa-wallet"></i> Connect Wallet';
            connectBtn.onclick = () => this.showMobileConnectionOptions();
        }
    }

    /**
     * Show mobile wallet connection options
     */
    showMobileConnectionOptions() {
        // Create modal with connection options
        const modal = document.createElement('div');
        modal.className = 'mobile-wallet-modal';
        modal.innerHTML = `
            <div class="mobile-wallet-overlay" onclick="mobileWalletConnector.closeModal()"></div>
            <div class="mobile-wallet-content">
                <div class="mobile-wallet-header">
                    <h2>Connect Wallet</h2>
                    <button class="close-btn" onclick="mobileWalletConnector.closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="mobile-wallet-options">
                    <!-- TronLink App -->
                    <button class="wallet-option" onclick="mobileWalletConnector.connectTronLinkApp()">
                        <img src="data:image/png;base64,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" alt="TronLink">
                        <div class="wallet-info">
                            <span class="wallet-name">TronLink</span>
                            <span class="wallet-desc">Connect using TronLink app</span>
                        </div>
                        <i class="fas fa-chevron-right"></i>
                    </button>

                    <!-- WalletConnect -->
                    <button class="wallet-option" onclick="mobileWalletConnector.connectWalletConnect()">
                        <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE4NSIgdmlld0JveD0iMCAwIDMwMCAxODUiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik02MS40Mzg1IDM2LjI1NkMxMTAuMzQ5IC0xMi4zMjM5IDE4OS42NSAtMTIuMzIzOSAyMzguNTYxIDM2LjI1NkwyNDQuNDQ4IDQyLjAxOTZDMjQ2Ljg5MyA0NC40NDI2IDI0Ni44OTMgNDguMjc1MyAyNDQuNDQ4IDUwLjY5ODNMMjI0LjE4IDcwLjY3NzRDMjIyLjk1OCA3MS44OTE5IDIyMC45MTEgNzEuODkxOSAyMTkuNjg5IDcwLjY3NzRMMjExLjAzOSA2Mi4xNTM4QzE4NS44NTMgMzcuMjY4MSAxNDQuODY5IDM3LjI2ODEgMTE5LjY4MyA2Mi4xNTM4TDExMC42NzEgNzAuOTg2MUMxMDkuNDQ5IDcyLjIwMDYgMTA3LjQwMiA3Mi4yMDA2IDEwNi4xODEgNzAuOTg2MUw4NS45MTI5IDUxLjAwN0M4My40Njc4IDQ4LjU4NCA4My40Njc4IDQ0Ljc1MTMgODUuOTEyOSA0Mi4zMjgzTDYxLjQzODUgMzYuMjU2WiIgZmlsbD0iIzNiOTlmYyIvPgo8cGF0aCBkPSJNMjgwLjY0IDc3LjAzNjZMMjk1LjMzNiA5MS41MzIzQzI5Ny43ODEgOTMuOTU1MyAyOTcuNzgxIDk3Ljc4OCAyOTUuMzM2IDEwMC4yMTFMMjE5LjY4OSAxNzUuMTJDMjE3LjI0NCAxNzcuNTQzIDIxMy4xNTEgMTc3LjU0MyAyMTAuNzA2IDE3NS4xMkwxNDQuMzY3IDEwOS4xMjdDMTQzLjE0NSAxMDcuOTE2IDE0MS4wOTggMTA3LjkxNiAxMzkuODc2IDEwOS4xMjdDMTM5Ljg3NSAxMDkuMTI3IDEzOS44NzUgMTA5LjEyNyAxMzkuODc1IDEwOS4xMjhMODkuMzMzNiAxNTkuMTFDODguMTExMyAxNjAuMzI0IDg2LjA2NDEgMTYwLjMyNCA4NC44NDE3IDE1OS4xMUw0LjU1NzQ5IDc5LjM0NTRDMi4xMTIyNiA3Ni45MjI0IDIuMTEyMjYgNzMuMDg5NyA0LjU1NzQ5IDcwLjY2NjdMMTkuMjUzMyA1Ni4xNzFDMjEuNjk4NSA1My43NDggMjUuNzkxNiA1My43NDggMjguMjM2OCA1Ni4xNzFMMTEwLjY3MSAxMzguMDA5QzExMS44OTMgMTM5LjIyMSAxMTMuOTQgMTM5LjIyMSAxMTUuMTYzIDEzOC4wMDlDMTE1LjE2NCAxMzguMDA5IDExNS4xNjQgMTM4LjAwOSAxMTUuMTY0IDEzOC4wMDhMMTgxLjUwMiA3Mi4wMTU2QzE4Mi43MjQgNzAuODAxMSAxODQuNzcxIDcwLjgwMTEgMTg1Ljk5NCA3Mi4wMTU2TDI2OC40MjggMTUzLjg1NEMyNjkuNjUgMTU1LjA2NiAyNzEuNjk3IDE1NS4wNjYgMjcyLjkyIDE1My44NTRMMjgwLjY0IDc3LjAzNjZaIiBmaWxsPSIjM2I5OWZjIi8+Cjwvc3ZnPg==" alt="WalletConnect">
                        <div class="wallet-info">
                            <span class="wallet-name">WalletConnect</span>
                            <span class="wallet-desc">Scan QR with any wallet</span>
                        </div>
                        <i class="fas fa-chevron-right"></i>
                    </button>

                    <!-- Trust Wallet -->
                    <button class="wallet-option" onclick="mobileWalletConnector.connectTrustWallet()">
                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAABHJJREFUaEPtmWlsVFUUx3/nvTczHaYz3Wih0FJaKCBQkIBgROMSFzcSjRFNTIwx8YMfNH4wJn4wMTExfvCDHzAmxhg1LtG4xAU1GjUuURZBZFMQKHuh+zLTznTmvWs6pTPMdN5MC4mJ5CYv8+677577O/9z7rnnCv5nQ/7L+v8XYLIDnOkJzFywZJFSZgUQBaSCJg2JCqIBtBT3VCRVSimO/frDhm3/SRfKT8vPnLd4qRXx3gRWA9cDOX7aT6kj4R9gA/CFUuzbuWnDD1MaP01lxwBqG1oWKMVbEt4EKvx2zp82EvZJxQuRcOi9wvyCv/zNMEGr/xdgztwFC+zMnHeBp4C0fy1pQ+LJbg7zGKxo7JySCrBiEPXAYcD0K4BNnUvD1i2vuaH+vqSAVdctu0FJ+TkQTK10anUlJAPCDLo23Njc8JUJIWQi7fMWXOxE/9uJgjOEOLJz04bf/QogD3l/YUC8MJGScpJWnneA2Jy6+kvTrKBqnCKCwT0wf9HS5x3HWZNeVhbd3tracrLjKmqSAqLhvnUl5TPvFcK6F0G2AKdWRySMIRgSzINcQRSxINKFOIUUtUiuREjpEVvRrlw21j8c+nxQ/HnUb9+JCvD++Q8sWRUNh9+pqKxcLIQRk+9Z0R3p48c39qH8LE0TABXrT51ACiHQ9AKkPzJJCFJ1k5mVNvMLLJq1VKsKWJQEBKX5OdJy+PuvQx9u3b5lPydmocQCQqFBzl5y8fPBwsKXy8qnV41ZqOSAYtZ7v3Q4bN3QTCA9k5yC4JiAyUJ5AgipoCQjSF1V5lhJBXgFlJv9oM+iUTWD5mN/bfvl+8/fE2LLLXaZhx1T7WhtXptVWfNQWzg0MJm+AE+8dYTXjCy2nRHCccZdbJruxGMKHZi7wBBZnq7EZ0R35pbyRfM0FeKy5qz/4KENa1dKKE0AEBwE0X7N6a3p/zHJmRlYWXb8VGMCRGkJMXTvBOzr5h6LQD8cB9dOcOyRckoJoYSRIYRvWWQAGP19+27L9gOoKAstQKRagNrHr4FewyXX5wOQX+j+Hw3Dtw9DVxvkFkJZVfJpjyxJEhsONuOkcLG/pLnf7+ZFAL0BQnH7gLuM3gHCkQGIxvgNJ5rNQWgBAj0Nv3wC/R6JoCZgzcMwpcQNP6qQisnQjJGSIlFEJEzsemQClCKvSAhD93wBE1/Ahg/XQO8p2PgZKCeFJXQUO6R7WVqZgYy1EUIkBuKJvdvGx40Sk7AKU8RiIRmAitXvuIJeRkoJLcX0T5B6rHCxSB1HtKn3m4SfCArpOJ6AJ5v3I+d9BWOJMBIihJ4qvLt1E5YJE5oQUkUFOOEBHHvwxJ7fNizWVP8aIUS1z3mMVRNC8zlEJGOK4bRFJW2kT+MzQyMopXgvEnJe7B0MNhw7smdA08RJy7Iyg8HME8Fg8KRt2ydQKtLT09Pa3t46PEXAZ5x/H1YiRfDU/wdQOKl6MiR8uu6/7Q9NdoD/eQL/Anx6K0+QJcJvAAAAAElFTkSuQmCC" alt="Trust Wallet">
                        <div class="wallet-info">
                            <span class="wallet-name">Trust Wallet</span>
                            <span class="wallet-desc">Connect using Trust Wallet</span>
                        </div>
                        <i class="fas fa-chevron-right"></i>
                    </button>

                    <!-- TokenPocket -->
                    <button class="wallet-option" onclick="mobileWalletConnector.connectTokenPocket()">
                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAABIFJREFUaEPtmVtsFFUYx3/fzOzs7na73V5oS0uhUKEgIAiIXAQUFRVQEzUxRh988IEH9cEHH3zwwQcffPDBBx9MjDEmGgkaFRUVBEQQkJtcSqFQoL3Q9rK93mZ3Z+aMmS272+3u7HYLJCaak+zszJkz3/n9v/P9z5kR/M+G+C/r/1+A/zoD/+sM/OcZKC0tLcnPz58ihJgKTAYmAWVAEZAL5AC+0et4gW6gE2gGmoQQTYqi3Ozr67vR1NTU+1AGcBxh5syZU3w+31NCiFXAcqDEiX6KMreAtcBPUspfm5ubz2UtgBcIVFVVLVFK7QCeBooyJW1jfwv4RCl1MDc396ifJNAOgBBiglLqCwnVQHa6wB2sHwVeBD4XQrS5AahdunRpSU5Ozrs+n+9NITLKk4uEaVIOAZvD4fC2vLy8Vsdqu3wFTJgw4ZKmaflOlDP4LxzHITo0lCzGaNJOlNOEiASiJGhwHQWqpZR/ORJACO12pMJYFGJnz3L7wgViAwMpddJLYPzCCmZVVZCXH0gSJRaLsbO3t/fF1tbWg65moLGqqmpLoVJba1esnDA9wUGhFDs/2MqtixdJLbKFBIwt8PDZZ57lqaeWoXBT16HQO1evtLzT0tJyyNFUWrt27dq8PdXVx6pFoCRhQa+ypKxHpCyJPYcOMCPQMZiApLGRlJJgR4iDlxtZZCSSRrIoRGQkSLFu3bqL+/fvn5e2BR599NG3qgP+91dIQcJEEiJekJg1eJTPj9q0+eM/eOOJItrChvGIKikOHu5gYXkg6aNdHRTJ6m3btl375ZdfNqYF8NyKFTsWZOcdSRm5p9eG5O0HQQkBW5rbYK23g+JCRJcJiU8xzfMW7Kuurj6UFsCqJ574oaq0sG/jyEJGaJOO7fbr6nj0oTp9k5lK+33dLJmWr0/IlE1p2P0C5s+ff7ampqbCtoCyLfOyDWqpLDaGGWwDo0s8GJ/PJ2vGJzUlTlkwC3bszG7J0qVP7K2uPpA2wP0I8Ey1wtFhVvCOC3mVY7hs6TJfVo7xFdIubJQQW7duPbJq06YXUs6AyyoUl4xJLI0RMvdtJi6+YF5hTT7YRaQJxkJCRgkxspmJiKc9A65dKJGBzCI4icJmQp1RrYBOkXu5U0vQSrvdKCxGAmMWWWakiGdT0HRZWMg0ZzJy5tJJGP+HBRSCyoXV3FVCiMR/sRmIDq/1ZOBRCCmN1zdSyLbAOtR5bJhJ6vROacPUcLRRnQ1dE+AwKUaKdlSHjMf7y5cv7/jhhx+4+9dJSrQxGdRqo/FCR3Rnk7UZtGm+lFJqQNyEhJ0IDGRxzCMEWA5lBJnGlhBiPiZ4EHZmswsJ5ue3JD1kJgshJRJFY2MjZWVlvhyP52Xe5Cv8gOv3mJaV7HO9fJxQgShwFHnMJCQlJOD3+y3bDcsJlblGJ6Vl3HYZ0OO0TT8ysDlsJ66tAMKRzp6ukN/vH+P1evuFkJE+P0MRiAeAznA4HPKOFKxRPdIJwT0Jd2+/HrTQ/3GFXN5Mvzf9I7yFnjnpY9wfWN8hn0/pGswAAAAASUVORK5CYII=" alt="TokenPocket">
                        <div class="wallet-info">
                            <span class="wallet-name">TokenPocket</span>
                            <span class="wallet-desc">Connect using TokenPocket</span>
                        </div>
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>

                <div class="mobile-wallet-footer">
                    <p>Don't have a wallet? <a href="https://www.tronlink.org/" target="_blank">Get one here</a></p>
                </div>

                <!-- QR Code Section (hidden by default) -->
                <div id="walletQRSection" style="display: none;">
                    <div class="qr-container">
                        <div id="walletQRCode"></div>
                        <p class="qr-instructions">Scan with your wallet app</p>
                        <button class="btn btn-secondary" onclick="mobileWalletConnector.showOptions()">
                            <i class="fas fa-arrow-left"></i> Back to options
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        if (!document.getElementById('mobileWalletStyles')) {
            const styles = document.createElement('style');
            styles.id = 'mobileWalletStyles';
            styles.innerHTML = `
                .mobile-wallet-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem;
                }

                .mobile-wallet-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                }

                .mobile-wallet-content {
                    position: relative;
                    background: var(--card-bg, #141414);
                    border-radius: 16px;
                    max-width: 420px;
                    width: 100%;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                }

                .mobile-wallet-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid var(--border-color, #262626);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .mobile-wallet-header h2 {
                    margin: 0;
                    font-size: 1.25rem;
                    color: var(--text-primary, #ffffff);
                }

                .close-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary, #d1d5db);
                    font-size: 1.5rem;
                    cursor: pointer;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    transition: all 0.2s;
                }

                .close-btn:hover {
                    background: var(--hover-bg, #1f1f1f);
                }

                .mobile-wallet-options {
                    padding: 1rem;
                }

                .wallet-option {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    padding: 1rem;
                    margin-bottom: 0.5rem;
                    background: var(--hover-bg, #1f1f1f);
                    border: 1px solid var(--border-color, #262626);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: var(--text-primary, #ffffff);
                }

                .wallet-option:hover {
                    background: var(--accent-blue, #0ea5e9);
                    border-color: var(--accent-blue, #0ea5e9);
                    transform: translateY(-2px);
                }

                .wallet-option img {
                    width: 40px;
                    height: 40px;
                    margin-right: 1rem;
                    border-radius: 8px;
                }

                .wallet-info {
                    flex: 1;
                    text-align: left;
                }

                .wallet-name {
                    display: block;
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                }

                .wallet-desc {
                    display: block;
                    font-size: 0.875rem;
                    color: var(--text-secondary, #d1d5db);
                    opacity: 0.8;
                }

                .wallet-option:hover .wallet-desc {
                    color: white;
                    opacity: 0.9;
                }

                .mobile-wallet-footer {
                    padding: 1rem 1.5rem;
                    border-top: 1px solid var(--border-color, #262626);
                    text-align: center;
                    font-size: 0.875rem;
                    color: var(--text-secondary, #d1d5db);
                }

                .mobile-wallet-footer a {
                    color: var(--accent-blue, #0ea5e9);
                    text-decoration: none;
                }
                
                /* Toast notifications */
                .wallet-toast {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transform: translateY(100px);
                    opacity: 0;
                    transition: all 0.3s ease;
                    z-index: 10001;
                    max-width: 90%;
                }
                
                .wallet-toast.show {
                    transform: translateY(0);
                    opacity: 1;
                }
                
                .wallet-toast.error {
                    background: #fee;
                    color: #dc2626;
                    border: 1px solid #fca5a5;
                }
                
                .wallet-toast.success {
                    background: #f0fdf4;
                    color: #16a34a;
                    border: 1px solid #86efac;
                }
                
                @media (max-width: 768px) {
                    .wallet-toast {
                        right: 10px;
                        left: 10px;
                        max-width: calc(100% - 20px);
                    }
                }

                .qr-container {
                    padding: 2rem;
                    text-align: center;
                }

                #walletQRCode {
                    display: inline-block;
                    padding: 1rem;
                    background: white;
                    border-radius: 12px;
                    margin-bottom: 1rem;
                }

                .qr-instructions {
                    color: var(--text-secondary, #d1d5db);
                    margin-bottom: 1rem;
                }

                @media (max-width: 480px) {
                    .mobile-wallet-content {
                        max-height: 90vh;
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(modal);
    }

    /**
     * Close the connection modal
     */
    closeModal() {
        const modal = document.querySelector('.mobile-wallet-modal');
        if (modal) {
            modal.remove();
        }
        
        // Clean up connection state
        this.connectionInProgress = false;
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }

    /**
     * Connect using TronLink mobile app with proper DApp connection
     */
    async connectTronLinkApp() {
        console.log('Attempting TronLink mobile connection...');
        
        // Prevent multiple simultaneous connection attempts
        if (this.connectionInProgress) {
            console.log('Connection already in progress');
            return;
        }
        
        this.connectionInProgress = true;
        
        try {
            // Prepare DApp connection data
            const dappData = {
                name: 'The Block Service',
                url: window.location.origin,
                icon: window.location.origin + '/favicon.ico'
            };
            
            // Create proper connection URL
            const connectionUrl = window.location.origin + window.location.pathname;
            
            // Different deep link formats for iOS and Android
            let deepLink;
            if (this.isIOS) {
                // iOS TronLink format
                deepLink = `tronlinkoutside://dapp/${encodeURIComponent(connectionUrl)}`;
            } else {
                // Android TronLink format  
                deepLink = `tronlink://dapp?url=${encodeURIComponent(connectionUrl)}`;
            }
            
            console.log('Deep link URL:', deepLink);
            
            // Try to open the app
            window.location.href = deepLink;
            
            // Clear any existing timeout
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
            }
            
            // Fallback to alternate method
            this.connectionTimeout = setTimeout(() => {
                // If we're still here, try alternate connection method
                if (document.hasFocus()) {
                    console.log('Deep link failed, trying alternate method...');
                    this.tryAlternateConnection();
                }
                this.connectionInProgress = false;
            }, this.deepLinkTimeout);
            
        } catch (error) {
            console.error('Error connecting to TronLink:', error);
            this.showError('Failed to connect to TronLink. Please make sure the app is installed.');
            this.connectionInProgress = false;
        }
    }

    /**
     * Connect using WalletConnect protocol or direct connection
     */
    async connectWalletConnect() {
        console.log('Initiating WalletConnect...');
        
        try {
            // Try direct TronWeb injection first
            if (this.isMobile) {
                // Check if wallet is injected
                if (window.tronWeb || window.tronLink) {
                    console.log('Found injected wallet, connecting...');
                    await this.connectInjectedWallet();
                    return;
                }
                
                // Try to trigger wallet browser
                const connectionUrl = window.location.origin + window.location.pathname;
                const wcUri = `https://link.trustwallet.com/open_url?url=${encodeURIComponent(connectionUrl)}`;
                window.location.href = wcUri;
                
                setTimeout(() => {
                    if (document.hasFocus()) {
                        this.showQRCode('WalletConnect');
                    }
                }, this.deepLinkTimeout);
            } else {
                // On desktop, show QR code
                this.showQRCode('WalletConnect');
            }
            
        } catch (error) {
            console.error('WalletConnect error:', error);
            this.showError('Failed to initialize WalletConnect.');
        }
    }

    /**
     * Connect using Trust Wallet with proper DApp format
     */
    async connectTrustWallet() {
        console.log('Attempting Trust Wallet connection...');
        
        try {
            const connectionUrl = window.location.origin + window.location.pathname;
            
            // Trust Wallet deep link format
            const deepLink = `trust://browser_enable?url=${encodeURIComponent(connectionUrl)}`;
            
            console.log('Trust Wallet deep link:', deepLink);
            window.location.href = deepLink;
            
            setTimeout(() => {
                if (document.hasFocus()) {
                    console.log('Trust Wallet deep link failed, showing QR code...');
                    this.showQRCode('Trust Wallet');
                }
            }, this.deepLinkTimeout);
            
        } catch (error) {
            console.error('Error connecting to Trust Wallet:', error);
            this.showError('Failed to connect to Trust Wallet.');
        }
    }

    /**
     * Connect using TokenPocket with proper DApp format
     */
    async connectTokenPocket() {
        console.log('Attempting TokenPocket connection...');
        
        try {
            const connectionUrl = window.location.origin + window.location.pathname;
            
            // TokenPocket deep link format
            const deepLink = `tpoutside://pull.activity?url=${encodeURIComponent(connectionUrl)}`;
            
            console.log('TokenPocket deep link:', deepLink);
            window.location.href = deepLink;
            
            setTimeout(() => {
                if (document.hasFocus()) {
                    console.log('TokenPocket deep link failed, showing QR code...');
                    this.showQRCode('TokenPocket');
                }
            }, this.deepLinkTimeout);
            
        } catch (error) {
            console.error('Error connecting to TokenPocket:', error);
            this.showError('Failed to connect to TokenPocket.');
        }
    }

    /**
     * Generate WalletConnect URI
     */
    async generateWalletConnectURI() {
        // This would typically use the WalletConnect SDK
        // For now, returning a placeholder
        const bridge = encodeURIComponent(this.walletConnectBridge);
        const key = this.generateKey();
        return `${key}@1?bridge=${bridge}&key=${key}`;
    }

    /**
     * Generate random key for WalletConnect
     */
    generateKey() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Show QR code for connection
     */
    showQRCode(walletName, uri = null) {
        const optionsSection = document.querySelector('.mobile-wallet-options');
        const qrSection = document.getElementById('walletQRSection');
        
        if (optionsSection && qrSection) {
            optionsSection.style.display = 'none';
            qrSection.style.display = 'block';
            
            // Generate QR code
            const qrContainer = document.getElementById('walletQRCode');
            qrContainer.innerHTML = ''; // Clear previous QR
            
            const connectionUri = uri || window.location.href;
            
            // Generate actual QR code
            try {
                if (typeof QRCode !== 'undefined') {
                    new QRCode(qrContainer, {
                        text: connectionUri,
                        width: 200,
                        height: 200,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.H
                    });
                } else {
                    // Fallback if QRCode library not loaded
                    qrContainer.innerHTML = `
                        <div style="width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; background: #f0f0f0; border-radius: 8px;">
                            <div style="text-align: center; color: #666;">
                                <i class="fas fa-qrcode" style="font-size: 48px; margin-bottom: 8px;"></i>
                                <p style="font-size: 12px;">QR Code for ${walletName}</p>
                                <p style="font-size: 10px; word-break: break-all;">${connectionUri.substring(0, 30)}...</p>
                            </div>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error generating QR code:', error);
                qrContainer.innerHTML = `<p style="color: #ff0000;">Error generating QR code</p>`;
            }
        }
    }

    /**
     * Show connection options
     */
    showOptions() {
        const optionsSection = document.querySelector('.mobile-wallet-options');
        const qrSection = document.getElementById('walletQRSection');
        
        if (optionsSection && qrSection) {
            optionsSection.style.display = 'block';
            qrSection.style.display = 'none';
        }
    }

    /**
     * Check if wallet is connected after app redirect
     */
    checkConnection() {
        // Check if TronWeb became available after redirect
        if (window.tronWeb && window.tronWeb.ready) {
            console.log('Wallet connected successfully!');
            this.closeModal();
            
            // Trigger wallet connected event
            window.dispatchEvent(new Event('walletConnected'));
            
            // Update UI
            this.updateConnectedUI();
            return true;
        }
        return false;
    }

    /**
     * Update UI after successful connection
     */
    updateConnectedUI() {
        const connectBtn = document.getElementById('connectBtn');
        const walletStatus = document.getElementById('walletStatus');
        const walletAddress = document.getElementById('walletAddress');
        
        if (window.tronWeb && window.tronWeb.defaultAddress) {
            const address = window.tronWeb.defaultAddress.base58;
            
            if (connectBtn) {
                connectBtn.style.display = 'none';
            }
            
            if (walletStatus) {
                walletStatus.style.display = 'none';
            }
            
            if (walletAddress) {
                walletAddress.style.display = 'flex';
                const shortAddress = address.substring(0, 6) + '...' + address.substring(address.length - 4);
                const addressText = document.getElementById('walletAddressText');
                if (addressText) {
                    addressText.textContent = shortAddress;
                }
            }
        }
    }
    
    /**
     * Try alternate connection method when deep link fails
     */
    async tryAlternateConnection() {
        console.log('Trying alternate connection method...');
        
        // Check if we're in an in-app browser
        if (this.isInAppBrowser()) {
            this.showInAppBrowserMessage();
        } else {
            // Show QR code as fallback
            this.showQRCode('TronLink');
        }
    }
    
    /**
     * Check if running in an in-app browser
     */
    isInAppBrowser() {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        
        // Check for common in-app browsers
        return /FBAN|FBAV|Instagram|TikTok|LinkedIn|Snapchat|Twitter/i.test(ua) ||
               (ua.indexOf('wv') > -1) || // Android WebView
               (ua.indexOf('Safari') === -1 && ua.indexOf('iPhone') > -1); // iOS WebView
    }
    
    /**
     * Show message for in-app browser users
     */
    showInAppBrowserMessage() {
        const modal = document.querySelector('.mobile-wallet-content');
        if (modal) {
            modal.innerHTML = `
                <div class="mobile-wallet-header">
                    <h2>Open in Browser</h2>
                    <button class="close-btn" onclick="mobileWalletConnector.closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 20px; text-align: center;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f59e0b; margin-bottom: 20px;"></i>
                    <h3>In-App Browser Detected</h3>
                    <p style="margin: 20px 0; color: #666;">
                        To connect your wallet, please open this page in your default browser 
                        (Safari, Chrome, etc.) instead of the in-app browser.
                    </p>
                    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0 0 10px 0; font-weight: bold;">How to open in browser:</p>
                        <ol style="text-align: left; margin: 0; padding-left: 20px;">
                            <li>Tap the menu icon (⋯ or ⋮)</li>
                            <li>Select "Open in Browser" or "Open in Safari/Chrome"</li>
                            <li>Connect your wallet from there</li>
                        </ol>
                    </div>
                    <button class="btn btn-primary" onclick="mobileWalletConnector.copyLink()">
                        <i class="fas fa-copy"></i> Copy Link
                    </button>
                </div>
            `;
        }
    }
    
    /**
     * Connect to injected wallet (for in-wallet browsers)
     */
    async connectInjectedWallet() {
        console.log('Attempting to connect to injected wallet...');
        
        try {
            if (window.tronLink) {
                // Request access to TronLink
                const res = await window.tronLink.request({ method: 'tron_requestAccounts' });
                console.log('TronLink connection response:', res);
                
                if (res.code === 200) {
                    console.log('Successfully connected to TronLink');
                    this.closeModal();
                    window.dispatchEvent(new Event('walletConnected'));
                    this.updateConnectedUI();
                } else {
                    throw new Error(res.message || 'Connection rejected');
                }
            } else if (window.tronWeb && window.tronWeb.ready) {
                // Already connected
                console.log('Wallet already connected');
                this.closeModal();
                window.dispatchEvent(new Event('walletConnected'));
                this.updateConnectedUI();
            } else {
                throw new Error('No wallet detected');
            }
        } catch (error) {
            console.error('Failed to connect to injected wallet:', error);
            this.showError('Failed to connect wallet: ' + error.message);
        }
    }
    
    /**
     * Copy current URL to clipboard
     */
    copyLink() {
        const url = window.location.href;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                this.showSuccess('Link copied! Paste it in your browser.');
            }).catch(() => {
                this.fallbackCopy(url);
            });
        } else {
            this.fallbackCopy(url);
        }
    }
    
    /**
     * Fallback copy method for older browsers
     */
    fallbackCopy(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            this.showSuccess('Link copied!');
        } catch (err) {
            this.showError('Failed to copy link');
        }
        document.body.removeChild(textArea);
    }
    
    /**
     * Show error message
     */
    showError(message) {
        console.error(message);
        
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'wallet-toast error';
        toast.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    /**
     * Show success message
     */
    showSuccess(message) {
        const toast = document.createElement('div');
        toast.className = 'wallet-toast success';
        toast.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize mobile wallet connector
window.mobileWalletConnector = new MobileWalletConnector();

// Auto-initialize on page load with cleanup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWalletConnector);
} else {
    initializeWalletConnector();
}

function initializeWalletConnector() {
    window.mobileWalletConnector.init();
    
    // Check for wallet connection on page focus (after returning from wallet app)
    const visibilityHandler = () => {
        if (!document.hidden) {
            setTimeout(() => {
                window.mobileWalletConnector.checkConnection();
            }, 500);
        }
    };
    
    const focusHandler = () => {
        setTimeout(() => {
            window.mobileWalletConnector.checkConnection();
        }, 500);
    };
    
    document.addEventListener('visibilitychange', visibilityHandler);
    window.addEventListener('focus', focusHandler);
    
    // Store handlers for cleanup
    window.mobileWalletConnector.eventListeners.push(
        { type: 'visibilitychange', handler: visibilityHandler, target: document },
        { type: 'focus', handler: focusHandler, target: window }
    );
}

// Cleanup function for SPA navigation
window.cleanupWalletConnector = function() {
    if (window.mobileWalletConnector) {
        // Remove all event listeners
        window.mobileWalletConnector.eventListeners.forEach(({ type, handler, target }) => {
            target.removeEventListener(type, handler);
        });
        window.mobileWalletConnector.eventListeners = [];
        
        // Clear timeouts
        if (window.mobileWalletConnector.connectionTimeout) {
            clearTimeout(window.mobileWalletConnector.connectionTimeout);
        }
    }
};

console.log('Mobile Wallet Connector loaded');