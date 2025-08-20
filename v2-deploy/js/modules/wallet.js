// Wallet Module - Handles TronLink connection and transactions
window.wallet = {
    tronWeb: null,
    address: null,
    connected: false,
    
    // Initialize wallet module
    async init() {
        console.log('Initializing wallet module...');
        
        // Check for TronLink
        if (window.tronLink) {
            // TronLink is installed
            console.log('TronLink detected');
        } else if (window.tronWeb) {
            // Old TronLink or TronLink browser
            console.log('TronWeb detected');
        } else {
            console.log('No wallet detected');
        }
    },
    
    // Connect to wallet
    async connect() {
        try {
            // Try TronLink-specific connection if available
            if (window.tronLink) {
                try {
                    const response = await window.tronLink.request({ method: 'tron_requestAccounts' });
                    console.log('TronLink request response:', response);
                    
                    // Wait for TronWeb to be ready after requesting accounts
                    let tries = 0;
                    while (!window.tronWeb || !window.tronWeb.ready) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        tries++;
                        if (tries > 10) {
                            throw new Error('TronWeb failed to initialize after account request');
                        }
                    }
                    
                } catch (error) {
                    console.log('TronLink request error:', error);
                    // Check if user rejected
                    if (error.code === 4001 || error.message?.includes('rejected')) {
                        throw new Error('Connection cancelled by user');
                    }
                    // Continue with fallback if TronLink request fails
                }
            }
            
            // Check if TronWeb is ready (either from TronLink request or already connected)
            if (window.tronWeb && window.tronWeb.ready) {
                this.tronWeb = window.tronWeb;
                this.address = this.tronWeb.defaultAddress.base58;
                this.connected = true;
                
                // Set up event listeners
                this.setupEventListeners();
                
                console.log('Connected to wallet:', this.address);
                return true;
                
            } else {
                // No wallet available or not ready
                if (window.tronLink) {
                    throw new Error('Please unlock your TronLink wallet and try again');
                } else {
                    this.promptInstallWallet();
                    return false;
                }
            }
            
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            throw error;
        }
    },
    
    // Set up event listeners for wallet events
    setupEventListeners() {
        // TronLink event listeners - wrapped in try/catch for compatibility
        try {
            if (window.addEventListener) {
                // Listen for TronLink events via window messages
                window.addEventListener('message', (e) => {
                    if (e.data?.message?.action === 'accountsChanged') {
                        console.log('Account changed:', e.data.message.data);
                        this.handleAccountChange(e.data.message.data);
                    }
                    if (e.data?.message?.action === 'chainChanged') {
                        console.log('Chain changed:', e.data.message.data);
                        window.location.reload();
                    }
                });
            }
            
            // Try modern TronLink event system if available
            if (window.tronLink && typeof window.tronLink.on === 'function') {
                window.tronLink.on('accountsChanged', (accounts) => {
                    console.log('Account changed:', accounts);
                    this.handleAccountChange(accounts);
                });
                
                window.tronLink.on('chainChanged', (chainId) => {
                    console.log('Chain changed:', chainId);
                    window.location.reload();
                });
            }
        } catch (error) {
            console.log('Event listeners setup skipped:', error.message);
            // Continue without event listeners - wallet will still work
        }
    },
    
    // Handle account change
    handleAccountChange(accounts) {
        if (accounts && accounts.length > 0) {
            this.address = accounts[0];
            // Reload app with new account
            if (window.app && window.app.handleAccountChange) {
                window.app.handleAccountChange(accounts[0]);
            }
        } else {
            // Disconnected
            this.disconnect();
        }
    },
    
    // Disconnect wallet
    disconnect() {
        this.tronWeb = null;
        this.address = null;
        this.connected = false;
        
        // Clear saved data
        localStorage.removeItem(getConfig('storage.keys.wallet'));
        
        // Reload page
        window.location.reload();
    },
    
    // Get wallet balance
    async getBalance() {
        if (!this.connected || !this.tronWeb) {
            throw new Error('Wallet not connected');
        }
        
        try {
            const balance = await this.tronWeb.trx.getBalance(this.address);
            return balance / 1e6; // Convert from SUN to TRX
        } catch (error) {
            console.error('Failed to get balance:', error);
            throw error;
        }
    },
    
    // Get account resources (energy and bandwidth)
    async getAccountResources() {
        if (!this.connected || !this.tronWeb) {
            throw new Error('Wallet not connected');
        }
        
        try {
            const account = await this.tronWeb.trx.getAccountResources(this.address);
            
            return {
                energy: {
                    available: (account.EnergyLimit || 0) - (account.EnergyUsed || 0),
                    total: account.EnergyLimit || 0,
                    used: account.EnergyUsed || 0
                },
                bandwidth: {
                    available: (account.freeNetLimit || 0) + (account.NetLimit || 0) - (account.freeNetUsed || 0) - (account.NetUsed || 0),
                    total: (account.freeNetLimit || 0) + (account.NetLimit || 0),
                    used: (account.freeNetUsed || 0) + (account.NetUsed || 0)
                }
            };
        } catch (error) {
            console.error('Failed to get account resources:', error);
            throw error;
        }
    },
    
    // Sign message
    async signMessage(message) {
        if (!this.connected || !this.tronWeb) {
            throw new Error('Wallet not connected');
        }
        
        try {
            const signature = await this.tronWeb.trx.sign(message);
            return signature;
        } catch (error) {
            console.error('Failed to sign message:', error);
            throw error;
        }
    },
    
    // Send transaction
    async sendTransaction(transaction) {
        if (!this.connected || !this.tronWeb) {
            throw new Error('Wallet not connected');
        }
        
        try {
            // Sign and send transaction
            const signedTx = await this.tronWeb.trx.sign(transaction);
            const result = await this.tronWeb.trx.sendRawTransaction(signedTx);
            
            if (result.result) {
                return result.txid;
            } else {
                throw new Error(result.message || 'Transaction failed');
            }
        } catch (error) {
            console.error('Failed to send transaction:', error);
            throw error;
        }
    },
    
    // Prompt user to install wallet
    promptInstallWallet() {
        const message = `
            TronLink wallet is required to use this application.
            Please install TronLink from: https://www.tronlink.org
        `;
        
        if (window.app) {
            window.app.showError(message);
        } else {
            alert(message);
        }
    },
    
    // Check if connected to correct network
    async checkNetwork() {
        if (!this.connected || !this.tronWeb) {
            return false;
        }
        
        try {
            const network = await this.tronWeb.trx.getChainParameters();
            const expectedChainId = getCurrentNetwork().chainId;
            
            // Compare chain IDs
            // Note: This is simplified, you may need to adjust based on actual chain ID format
            return true; // For now, assume correct network
            
        } catch (error) {
            console.error('Failed to check network:', error);
            return false;
        }
    },
    
    // Switch to correct network
    async switchNetwork() {
        const networkName = getConfig('network.current');
        const message = `Please switch to ${networkName} network in TronLink`;
        
        if (window.app) {
            window.app.showError(message);
        } else {
            alert(message);
        }
    },
    
    // Format address for display
    formatAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    },
    
    // Validate address
    isValidAddress(address) {
        if (!address || typeof address !== 'string') {
            return false;
        }
        
        // TRON addresses start with 'T' and are 34 characters long
        if (!address.startsWith('T') || address.length !== 34) {
            return false;
        }
        
        try {
            // Use TronWeb to validate if available
            if (this.tronWeb) {
                return this.tronWeb.isAddress(address);
            }
            
            // Basic validation
            return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
        } catch (error) {
            return false;
        }
    }
};

console.log('Wallet module loaded');