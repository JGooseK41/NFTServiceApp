/**
 * Fix Contract Connection
 * Ensures contract properly connects and methods are available
 */

(function() {
    console.log('🔌 Fixing contract connection...');
    
    const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN'; // V5 Mainnet
    
    // Use complete ABI if available, otherwise use partial
    const V5_ABI = window.COMPLETE_CONTRACT_ABI || [
        {
            "constant": false,
            "inputs": [
                {"name": "recipient", "type": "address"},
                {"name": "encryptedIPFS", "type": "string"},
                {"name": "encryptionKey", "type": "string"},
                {"name": "issuingAgency", "type": "string"},
                {"name": "noticeType", "type": "string"},
                {"name": "caseNumber", "type": "string"},
                {"name": "caseDetails", "type": "string"},
                {"name": "legalRights", "type": "string"},
                {"name": "sponsorFees", "type": "bool"},
                {"name": "metadataURI", "type": "string"}
            ],
            "name": "serveNotice",
            "outputs": [
                {"name": "", "type": "uint256"},
                {"name": "", "type": "uint256"}
            ],
            "stateMutability": "payable",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "creationFee",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "serviceFee",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "sponsorshipFee",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "totalSupply",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [{"name": "", "type": "uint256"}],
            "name": "processServers",
            "outputs": [
                {"name": "serverAddress", "type": "address"},
                {"name": "agencyName", "type": "string"},
                {"name": "serverName", "type": "string"},
                {"name": "email", "type": "string"},
                {"name": "isActive", "type": "bool"}
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [{"name": "", "type": "address"}],
            "name": "serverById",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [{"name": "tokenId", "type": "uint256"}],
            "name": "tokenURI",
            "outputs": [{"name": "", "type": "string"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [{"name": "owner", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [{"name": "", "type": "uint256"}],
            "name": "alerts",
            "outputs": [
                {"name": "alertId", "type": "uint256"},
                {"name": "serverAddress", "type": "address"},
                {"name": "recipientAddress", "type": "address"},
                {"name": "encryptedIPFS", "type": "string"},
                {"name": "encryptionKey", "type": "string"},
                {"name": "timestamp", "type": "uint256"},
                {"name": "noticeType", "type": "string"},
                {"name": "caseNumber", "type": "string"},
                {"name": "documentId", "type": "uint256"}
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [
                {"name": "role", "type": "bytes32"},
                {"name": "account", "type": "address"}
            ],
            "name": "hasRole",
            "outputs": [{"name": "", "type": "bool"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "DEFAULT_ADMIN_ROLE",
            "outputs": [{"name": "", "type": "bytes32"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "PROCESS_SERVER_ROLE",
            "outputs": [{"name": "", "type": "bytes32"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "ADMIN_ROLE",
            "outputs": [{"name": "", "type": "bytes32"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": false,
            "inputs": [
                {
                    "name": "batchNotices",
                    "type": "tuple[]",
                    "components": [
                        {"name": "recipient", "type": "address"},
                        {"name": "encryptedIPFS", "type": "string"},
                        {"name": "encryptionKey", "type": "string"},
                        {"name": "issuingAgency", "type": "string"},
                        {"name": "noticeType", "type": "string"},
                        {"name": "caseNumber", "type": "string"},
                        {"name": "caseDetails", "type": "string"},
                        {"name": "legalRights", "type": "string"},
                        {"name": "sponsorFees", "type": "bool"},
                        {"name": "metadataURI", "type": "string"}
                    ]
                }
            ],
            "name": "serveNoticeBatch",
            "outputs": [],
            "stateMutability": "payable",
            "type": "function"
        }
    ];
    
    let initAttempts = 0;
    const MAX_ATTEMPTS = 10;
    
    async function initializeContract() {
        initAttempts++;
        
        // Check if TronWeb is ready
        if (!window.tronWeb || !window.tronWeb.ready) {
            console.log(`⏳ Waiting for TronWeb... (attempt ${initAttempts}/${MAX_ATTEMPTS})`);
            if (initAttempts < MAX_ATTEMPTS) {
                setTimeout(initializeContract, 1000);
            } else {
                console.error('❌ TronWeb not available after 10 seconds');
            }
            return;
        }
        
        try {
            // Initialize contract with V5 ABI
            const contract = await window.tronWeb.contract(V5_ABI, CONTRACT_ADDRESS);
            
            // Verify contract methods exist
            if (!contract.creationFee || !contract.serviceFee) {
                throw new Error('Contract methods not available');
            }
            
            // Test contract connection
            const creationFee = await contract.creationFee().call();
            const serviceFee = await contract.serviceFee().call();
            
            // Store contract globally
            window.legalContract = contract;
            window.CONTRACT_ADDRESS = CONTRACT_ADDRESS;
            window.CONTRACT_ABI = V5_ABI;
            
            console.log('✅ Contract connected successfully!');
            console.log(`   Creation Fee: ${window.tronWeb.fromSun(creationFee)} TRX`);
            console.log(`   Service Fee: ${window.tronWeb.fromSun(serviceFee)} TRX`);
            
            // Trigger contract ready event
            window.dispatchEvent(new Event('contractReady'));
            
            // Re-initialize systems that depend on contract
            reinitializeDependentSystems();
            
        } catch (error) {
            console.error('❌ Contract initialization failed:', error);
            if (initAttempts < MAX_ATTEMPTS) {
                console.log(`🔄 Retrying in 2 seconds... (attempt ${initAttempts}/${MAX_ATTEMPTS})`);
                setTimeout(initializeContract, 2000);
            }
        }
    }
    
    function reinitializeDependentSystems() {
        console.log('🔄 Re-initializing dependent systems...');
        
        // Re-initialize UnifiedNoticeSystem if it exists
        if (window.unifiedSystem && window.unifiedSystem.init) {
            console.log('   - UnifiedNoticeSystem');
            window.unifiedSystem.init();
        }
        
        // Re-initialize ContractFixV001 if it exists
        if (window.ContractFixV001 && window.ContractFixV001.initialize) {
            console.log('   - ContractFixV001');
            window.ContractFixV001.initialize();
        }
        
        // Trigger system reload event
        window.dispatchEvent(new Event('systemReload'));
        
        console.log('✅ Systems re-initialized');
    }
    
    // Manual initialization function
    window.forceContractInit = async function() {
        console.log('🔧 Forcing contract initialization...');
        initAttempts = 0;
        await initializeContract();
    };
    
    // Check contract status
    window.checkContractStatus = function() {
        if (!window.legalContract) {
            console.log('❌ Contract not initialized');
            console.log('   Run: forceContractInit()');
            return false;
        }
        
        console.log('✅ Contract is connected');
        console.log(`   Address: ${CONTRACT_ADDRESS}`);
        console.log('   Methods available:', Object.keys(window.legalContract).filter(k => typeof window.legalContract[k] === 'function'));
        return true;
    };
    
    // Start initialization
    initializeContract();
    
    console.log('✅ Contract connection fix loaded');
    console.log('   Commands:');
    console.log('   forceContractInit() - Force re-initialization');
    console.log('   checkContractStatus() - Check connection status');
    
})();