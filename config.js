// Configuration file for NFT Service App
// Update these values before deployment

const CONFIG = {
    // Contract addresses for different networks
    contracts: {
        tron: {
            mainnet: 'YOUR_TRON_MAINNET_CONTRACT_ADDRESS',
            nile: '41cc5e2e4f3df88f8f75f77c02f7f2cda50911427d', // Current testnet contract
            shasta: 'YOUR_SHASTA_CONTRACT_ADDRESS'
        },
        evm: {
            ethereum: 'YOUR_ETHEREUM_CONTRACT_ADDRESS',
            bsc: 'YOUR_BSC_CONTRACT_ADDRESS',
            polygon: 'YOUR_POLYGON_CONTRACT_ADDRESS'
        }
    },
    
    // Fee collector address (receives all fees)
    feeCollector: 'YOUR_FEE_COLLECTOR_ADDRESS',
    
    // Initial admin addresses (granted admin role on deployment)
    admins: [
        'YOUR_ADMIN_ADDRESS_1',
        'YOUR_ADMIN_ADDRESS_2'
    ],
    
    // API endpoints
    api: {
        ipfsGateway: 'https://gateway.pinata.cloud/ipfs/',
        ipfsApi: 'https://api.pinata.cloud',
        emailService: 'https://api.emailservice.com/v1/',
        smsService: 'https://api.smsservice.com/v1/'
    },
    
    // Energy rental configuration
    energyRental: {
        enabled: true,
        maxPricePerUnit: 15, // Max 15 TRX per 100k energy
        energyPerNotice: 500000, // Estimated energy per notice
        energyBuffer: 1.2 // 20% buffer
    },
    
    // UI Configuration
    ui: {
        maxBatchSize: 20, // Maximum recipients for batch operations
        paginationSize: 50, // Items per page
        sessionTimeout: 3600000, // 1 hour in milliseconds
        debugMode: false
    },
    
    // Feature flags
    features: {
        batchOperations: true,
        advancedFiltering: true,
        exportFunctionality: true,
        emailNotifications: false,
        smsNotifications: false,
        energyRental: true
    }
};

// For use in browser
if (typeof window !== 'undefined') {
    window.APP_CONFIG = CONFIG;
}

// For use in Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}