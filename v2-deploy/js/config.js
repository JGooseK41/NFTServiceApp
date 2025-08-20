// Configuration for LegalNotice v2
window.AppConfig = {
    // Network Configuration
    network: {
        mainnet: {
            fullHost: 'https://api.trongrid.io',
            contractAddress: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', // v5 Enumerable contract
            chainId: '0x2b6653dc'
        },
        nile: {
            fullHost: 'https://nile.trongrid.io',
            contractAddress: '', // Add if you have testnet contract
            chainId: '0x8dd8f8'
        },
        current: 'mainnet' // Change to 'nile' for testnet
    },
    
    // Backend Configuration
    backend: {
        // Using relative URLs to work with your existing backend
        baseUrl: window.location.hostname === 'localhost' 
            ? 'http://localhost:3001' 
            : 'https://nft-legal-service-backend.onrender.com',
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
            getCases: '/api/cases',
            
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

// Initialize configuration
console.log('LegalNotice v2 Config Loaded');
console.log('Network:', window.AppConfig.network.current);
console.log('Backend:', window.AppConfig.backend.baseUrl);
console.log('Contract:', getCurrentNetwork().contractAddress);