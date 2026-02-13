// Configuration for LegalNotice v2
window.AppConfig = {
    // Chain Registry - Static mapping for all supported chains
    // Used for display and explorer URLs regardless of current network
    chains: {
        'tron-mainnet': {
            id: 'tron-mainnet',
            name: 'TRON Mainnet',
            shortName: 'TRON',
            explorer: 'https://tronscan.org',
            explorerTxPath: '/#/transaction/',
            explorerAddressPath: '/#/address/',
            currency: 'TRX',
            icon: 'tron'
        },
        'tron-nile': {
            id: 'tron-nile',
            name: 'TRON Nile Testnet',
            shortName: 'TRON Nile',
            explorer: 'https://nile.tronscan.org',
            explorerTxPath: '/#/transaction/',
            explorerAddressPath: '/#/address/',
            currency: 'TRX',
            icon: 'tron',
            isTestnet: true
        },
        'eth-mainnet': {
            id: 'eth-mainnet',
            name: 'Ethereum Mainnet',
            shortName: 'Ethereum',
            explorer: 'https://etherscan.io',
            explorerTxPath: '/tx/',
            explorerAddressPath: '/address/',
            currency: 'ETH',
            icon: 'ethereum'
        },
        'eth-sepolia': {
            id: 'eth-sepolia',
            name: 'Ethereum Sepolia Testnet',
            shortName: 'Sepolia',
            explorer: 'https://sepolia.etherscan.io',
            explorerTxPath: '/tx/',
            explorerAddressPath: '/address/',
            currency: 'ETH',
            icon: 'ethereum',
            isTestnet: true
        },
        'base-mainnet': {
            id: 'base-mainnet',
            name: 'Base Mainnet',
            shortName: 'Base',
            explorer: 'https://basescan.org',
            explorerTxPath: '/tx/',
            explorerAddressPath: '/address/',
            currency: 'ETH',
            icon: 'base'
        },
        'base-sepolia': {
            id: 'base-sepolia',
            name: 'Base Sepolia Testnet',
            shortName: 'Base Sepolia',
            explorer: 'https://sepolia.basescan.org',
            explorerTxPath: '/tx/',
            explorerAddressPath: '/address/',
            currency: 'ETH',
            icon: 'base',
            isTestnet: true
        }
    },

    // Network Configuration - Optimized for Lite Contract
    // Single NFT per serve, simplified fee structure
    network: {
        nile: {
            fullHost: 'https://nile.trongrid.io',
            contractAddress: 'TTnn2wPhKX1AAEuavkqbj9G9LfXy5uoMNz',
            chainId: '0x8dd8f8',
            contractType: 'lite-v2',
            chain: 'tron-nile'
        },
        mainnet: {
            fullHost: 'https://api.trongrid.io',
            contractAddress: 'TAWScLCb73qn9FqgwoUZgTt5T3cwYKTWXq',
            chainId: '0x2b6653dc',
            contractType: 'lite',
            chain: 'tron-mainnet'
        },
        current: 'nile' // Current active network (testing new contract)
    },
    
    // Backend Configuration
    backend: {
        // Using relative URLs to work with your existing backend
        baseUrl: window.location.hostname === 'localhost' 
            ? 'http://localhost:3001' 
            : 'https://nftserviceapp.onrender.com',
        endpoints: {
            // Notice endpoints
            createNotice: '/api/notices',
            getNotice: '/api/notices/:id',
            getNotices: '/api/notices',
            
            // Document endpoints
            uploadDocument: '/api/documents/upload',
            getDocument: '/api/documents/:id',
            uploadPDF: '/api/documents/upload-pdf',
            getPDF: '/api/documents/pdf/:filename',
            
            // Case endpoints
            createCase: '/api/cases',
            getCase: '/api/cases/:id',
            getCases: '/api/servers/:serverAddress/simple-cases',
            
            // Server registration
            registerServer: '/api/server/register',
            getServerInfo: '/api/server/info',
            
            // Images/receipts
            uploadImage: '/api/images/upload',
            getImage: '/api/images/:id'
        }
    },
    
    // Smart Contract Configuration
    contract: {
        // Fee settings (in TRX)
        defaultServiceFee: 10,
        
        // Energy estimates
        energyEstimates: {
            createAlert: 65000,
            createDocument: 75000,
            updateFee: 30000,
            grantRole: 40000
        },
        
        // Role definitions
        roles: {
            DEFAULT_ADMIN_ROLE: '0x0000000000000000000000000000000000000000000000000000000000000000',
            PROCESS_SERVER_ROLE: '0x9a92bf3818086a9bc9c8993fc551e796975ad86e56e648d4a3c3e8d756cc039c',
            LAW_ENFORCEMENT_ROLE: '0x8b67c2f26e3ee6218e15b47b42c91bb96e2c5755077bd9f2a0701fc43c4a93f5'
        }
    },
    
    // Storage Configuration
    storage: {
        // Use existing IPFS gateway from your app
        ipfsGateway: 'https://gateway.pinata.cloud/ipfs/',
        
        // Local storage keys
        keys: {
            wallet: 'legalnotice_wallet',
            serverId: 'legalnotice_server_id',
            cases: 'legalnotice_cases',
            receipts: 'legalnotice_receipts',
            settings: 'legalnotice_settings'
        }
    },
    
    // Energy Rental Services
    energy: {
        providers: {
            tronsave: {
                enabled: true,
                apiUrl: 'https://tronsave.io',
                minEnergy: 65000,
                buffer: 1.2 // 20% buffer
            },
            manual: {
                enabled: true,
                marketplaces: [
                    { name: 'TronSave', url: 'https://tronsave.io' },
                    { name: 'Energy Market', url: 'https://energy.market' }
                ]
            }
        }
    },
    
    // UI Configuration
    ui: {
        // Animation durations
        animationSpeed: 300,
        
        // Toast notifications
        toastDuration: 5000,
        
        // Pagination
        itemsPerPage: 20,
        
        // File upload limits
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedFileTypes: ['.pdf']
    },
    
    // Feature Flags
    features: {
        enableBatchServing: true,
        enableEncryption: false, // Can enable later
        enableIPFS: true,
        enableEnergyRental: true,
        enableMobileRedirect: true,
        requireServerRegistration: true
    },
    
    // Development/Debug Settings
    debug: {
        enabled: window.location.hostname === 'localhost',
        logTransactions: true,
        logApiCalls: true,
        mockWallet: false
    }
};

// Helper function to get config value
window.getConfig = function(path) {
    const keys = path.split('.');
    let value = window.AppConfig;
    
    for (const key of keys) {
        value = value[key];
        if (value === undefined) {
            console.warn(`Config key not found: ${path}`);
            return null;
        }
    }
    
    return value;
};

// Helper to get current network config
window.getCurrentNetwork = function() {
    const current = window.AppConfig.network.current;
    return window.AppConfig.network[current];
};

// Helper to get current chain ID from network config
window.getCurrentChainId = function() {
    const network = window.getCurrentNetwork();
    return network?.chain || 'tron-mainnet';
};

// Helper to get chain info from registry
window.getChainInfo = function(chainId) {
    // If no chainId provided, use current network's chain
    if (!chainId) {
        chainId = window.getCurrentChainId();
    }
    return window.AppConfig.chains[chainId] || window.AppConfig.chains['tron-mainnet'];
};

// Helper to get explorer transaction URL for any chain
window.getExplorerTxUrl = function(txHash, chainId) {
    const chain = window.getChainInfo(chainId);
    if (!txHash) return chain.explorer;
    return chain.explorer + chain.explorerTxPath + txHash;
};

// Helper to get explorer address URL for any chain
window.getExplorerAddressUrl = function(address, chainId) {
    const chain = window.getChainInfo(chainId);
    if (!address) return chain.explorer;
    return chain.explorer + chain.explorerAddressPath + address;
};

// Legacy helper - get TronScan URL for current network (backwards compatible)
window.getTronScanUrl = function(txHash) {
    return window.getExplorerTxUrl(txHash, window.getCurrentChainId());
};

// Legacy helper - get TronScan base URL (backwards compatible)
window.getTronScanBase = function() {
    const chain = window.getChainInfo(window.getCurrentChainId());
    return chain.explorer;
};

// Helper to get API endpoint URL
window.getApiUrl = function(endpoint, params = {}) {
    const baseUrl = window.AppConfig.backend.baseUrl;
    let url = window.AppConfig.backend.endpoints[endpoint];
    
    if (!url) {
        console.error(`Unknown endpoint: ${endpoint}`);
        return null;
    }
    
    // Replace parameters in URL
    for (const [key, value] of Object.entries(params)) {
        url = url.replace(`:${key}`, value);
    }
    
    return baseUrl + url;
};

/**
 * Fetch with timeout - wraps native fetch with AbortController timeout.
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options (headers, method, body, etc.)
 * @param {number} timeoutMs - Timeout in milliseconds (default: 15000)
 * @returns {Promise<Response>}
 */
window.fetchWithTimeout = function(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const existingSignal = options.signal;

    // If caller already provided a signal, don't override it
    if (existingSignal) {
        return fetch(url, options);
    }

    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => {
        clearTimeout(timeoutId);
    });
};

// Initialize configuration
console.log('LegalNotice v2 Config Loaded');
console.log('Network:', window.AppConfig.network.current);
console.log('Backend:', window.AppConfig.backend.baseUrl);
console.log('Contract:', getCurrentNetwork().contractAddress);