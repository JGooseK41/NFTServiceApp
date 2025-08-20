/**
 * CONTRACT CONNECTION FIX
 * Permanent solution for "Invalid contract address provided" errors
 */

(function() {
    console.log('🔧 Loading Contract Connection Fix...');
    
    // Store original contract method
    const originalContractAt = window.tronWeb?.contract?.().at;
    
    // Create enhanced contract connection method
    window.ContractHelper = {
        
        // Main method to get a working contract instance
        async getContract(address, abi = null) {
            console.log(`Connecting to contract: ${address}`);
            
            // Try Method 1: Standard contract.at()
            try {
                const contract = await window.tronWeb.contract().at(address);
                console.log('✅ Connected via standard method');
                return contract;
            } catch (e) {
                console.log('⚠️ Standard method failed, trying alternatives...');
            }
            
            // Try Method 2: Get ABI from chain and create contract
            try {
                const contractInfo = await window.tronWeb.trx.getContract(address);
                if (contractInfo && contractInfo.abi && contractInfo.abi.entrys) {
                    const contract = window.tronWeb.contract(contractInfo.abi.entrys, address);
                    console.log('✅ Connected via ABI from chain');
                    return contract;
                }
            } catch (e) {
                console.log('⚠️ ABI from chain failed');
            }
            
            // Try Method 3: Use provided or default TRC721 ABI
            try {
                const trc721ABI = abi || [
                    {
                        "constant": true,
                        "inputs": [{"name": "tokenId", "type": "uint256"}],
                        "name": "tokenURI",
                        "outputs": [{"name": "", "type": "string"}],
                        "type": "function"
                    },
                    {
                        "constant": true,
                        "inputs": [],
                        "name": "totalSupply",
                        "outputs": [{"name": "", "type": "uint256"}],
                        "type": "function"
                    },
                    {
                        "constant": true,
                        "inputs": [{"name": "tokenId", "type": "uint256"}],
                        "name": "ownerOf",
                        "outputs": [{"name": "", "type": "address"}],
                        "type": "function"
                    },
                    {
                        "constant": true,
                        "inputs": [],
                        "name": "name",
                        "outputs": [{"name": "", "type": "string"}],
                        "type": "function"
                    },
                    {
                        "constant": true,
                        "inputs": [],
                        "name": "symbol",
                        "outputs": [{"name": "", "type": "string"}],
                        "type": "function"
                    }
                ];
                
                const contract = window.tronWeb.contract(trc721ABI, address);
                console.log('✅ Connected via TRC721 ABI');
                return contract;
            } catch (e) {
                console.log('❌ All connection methods failed:', e.message);
                throw new Error('Could not connect to contract: ' + address);
            }
        },
        
        // Quick method to check Alert #27
        async checkAlert27() {
            console.log('\n🔍 Checking Alert #27...\n');
            
            try {
                const alertContract = await this.getContract('TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb');
                const uri = await alertContract.tokenURI(27).call();
                
                console.log('Token URI retrieved successfully!');
                
                if (uri.startsWith('data:application/json;base64,')) {
                    console.log('✅ Alert #27 is using BASE64 encoding - GOOD!');
                    
                    // Decode and show metadata
                    const base64 = uri.split(',')[1];
                    const json = atob(base64);
                    const metadata = JSON.parse(json);
                    
                    console.log('Metadata:');
                    console.log('  Name:', metadata.name);
                    console.log('  Type:', metadata.attributes?.find(a => a.trait_type === 'Type')?.value);
                    
                    if (metadata.image?.startsWith('data:image')) {
                        console.log('  Image: ✅ Also BASE64 encoded');
                    } else if (metadata.image?.includes('ipfs')) {
                        console.log('  Image: ⚠️ Using IPFS');
                    }
                    
                } else if (uri.includes('ipfs')) {
                    console.log('⚠️ Alert #27 is using IPFS - needs conversion to BASE64');
                    console.log('IPFS URI:', uri);
                } else {
                    console.log('Unknown format:', uri.substring(0, 100));
                }
                
                return uri;
                
            } catch (error) {
                console.error('Error checking Alert #27:', error.message);
                return null;
            }
        },
        
        // Get all contract instances
        async getAllContracts() {
            const contracts = {};
            
            const addresses = {
                alert: 'TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb',
                document: 'TNmRbJvnH45pXFux3eDVDN7Dm9NuQyitUx',
                legacy: 'TGqVLmkM5Dz9S7iRLCuhVzUe8YhRxnKQQq'
            };
            
            for (const [name, address] of Object.entries(addresses)) {
                try {
                    contracts[name] = await this.getContract(address);
                    console.log(`✅ ${name} contract connected`);
                } catch (e) {
                    console.log(`❌ ${name} contract failed`);
                }
            }
            
            return contracts;
        },
        
        // Check multiple alerts
        async checkAlerts(startId, endId) {
            console.log(`\nChecking alerts ${startId} to ${endId}...\n`);
            
            const alertContract = await this.getContract('TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb');
            const results = [];
            
            for (let id = startId; id <= endId; id += 2) { // Alerts are odd numbers
                try {
                    const uri = await alertContract.tokenURI(id).call();
                    const isBase64 = uri.startsWith('data:application/json;base64,');
                    const isIPFS = uri.includes('ipfs');
                    
                    results.push({
                        id,
                        format: isBase64 ? 'BASE64' : isIPFS ? 'IPFS' : 'Unknown',
                        status: isBase64 ? '✅' : '⚠️'
                    });
                    
                    console.log(`Alert #${id}: ${results[results.length - 1].status} ${results[results.length - 1].format}`);
                } catch (e) {
                    console.log(`Alert #${id}: ❌ Error or doesn't exist`);
                }
            }
            
            return results;
        }
    };
    
    // Auto-initialize on load
    if (window.tronWeb && window.tronWeb.ready) {
        console.log('✅ Contract Helper loaded and ready');
        console.log('Commands:');
        console.log('  ContractHelper.checkAlert27() - Check Alert #27');
        console.log('  ContractHelper.checkAlerts(23, 31) - Check range of alerts');
        console.log('  ContractHelper.getAllContracts() - Get all contract instances');
    } else {
        console.log('⚠️ Waiting for TronWeb...');
        
        const checkInterval = setInterval(() => {
            if (window.tronWeb && window.tronWeb.ready) {
                clearInterval(checkInterval);
                console.log('✅ TronWeb ready, Contract Helper available');
            }
        }, 1000);
    }
    
})();