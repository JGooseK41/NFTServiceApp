/**
 * DIAGNOSE CONTRACT CONNECTION FAILURES
 * Comprehensive diagnostic to identify why contracts aren't connecting
 */

console.log('🔬 DIAGNOSING CONTRACT CONNECTION FAILURES');
console.log('=' .repeat(70));

window.DiagnoseContractFailure = {
    
    async runFullDiagnostic() {
        console.log('\n🚀 Starting comprehensive diagnostic...\n');
        
        const results = {
            tronWeb: {},
            network: {},
            contracts: {},
            abi: {},
            permissions: {}
        };
        
        // Step 1: Check TronWeb initialization
        console.log('1️⃣ CHECKING TRONWEB INITIALIZATION');
        console.log('─'.repeat(50));
        results.tronWeb = await this.checkTronWeb();
        
        // Step 2: Check network connection
        console.log('\n2️⃣ CHECKING NETWORK CONNECTION');
        console.log('─'.repeat(50));
        results.network = await this.checkNetwork();
        
        // Step 3: Test contract addresses
        console.log('\n3️⃣ TESTING CONTRACT ADDRESSES');
        console.log('─'.repeat(50));
        results.contracts = await this.testContractAddresses();
        
        // Step 4: Check ABI loading
        console.log('\n4️⃣ CHECKING ABI COMPATIBILITY');
        console.log('─'.repeat(50));
        results.abi = await this.checkABI();
        
        // Step 5: Check permissions
        console.log('\n5️⃣ CHECKING PERMISSIONS');
        console.log('─'.repeat(50));
        results.permissions = await this.checkPermissions();
        
        // Summary
        this.printSummary(results);
        
        return results;
    },
    
    async checkTronWeb() {
        const status = {
            exists: false,
            ready: false,
            wallet: null,
            version: null,
            nodes: {}
        };
        
        try {
            // Check if TronWeb exists
            if (typeof window.tronWeb !== 'undefined') {
                status.exists = true;
                console.log('✅ TronWeb is loaded');
                
                // Check if ready
                if (window.tronWeb.ready) {
                    status.ready = true;
                    console.log('✅ TronWeb is ready');
                } else {
                    console.log('⚠️ TronWeb not ready yet');
                }
                
                // Check wallet
                if (window.tronWeb.defaultAddress) {
                    status.wallet = window.tronWeb.defaultAddress.base58;
                    console.log('✅ Wallet connected:', status.wallet);
                } else {
                    console.log('❌ No wallet connected');
                }
                
                // Check nodes
                if (window.tronWeb.fullNode) {
                    status.nodes.fullNode = window.tronWeb.fullNode.host;
                    console.log('📡 Full Node:', status.nodes.fullNode);
                }
                if (window.tronWeb.solidityNode) {
                    status.nodes.solidityNode = window.tronWeb.solidityNode.host;
                    console.log('📡 Solidity Node:', status.nodes.solidityNode);
                }
                if (window.tronWeb.eventServer) {
                    status.nodes.eventServer = window.tronWeb.eventServer.host;
                    console.log('📡 Event Server:', status.nodes.eventServer);
                }
                
                // Check version
                try {
                    if (window.tronWeb.version) {
                        status.version = window.tronWeb.version;
                        console.log('📦 TronWeb version:', status.version);
                    }
                } catch (e) {
                    // Version might not be available
                }
                
            } else {
                console.log('❌ TronWeb not found in window object');
                console.log('   Please ensure TronLink is installed and connected');
            }
        } catch (error) {
            console.error('❌ Error checking TronWeb:', error.message);
        }
        
        return status;
    },
    
    async checkNetwork() {
        const network = {
            connected: false,
            chainId: null,
            networkName: null,
            blockNumber: null,
            apiConnection: false
        };
        
        try {
            // Check if we can get block info
            const block = await window.tronWeb.trx.getCurrentBlock();
            if (block) {
                network.connected = true;
                network.blockNumber = block.block_header.raw_data.number;
                console.log('✅ Connected to network');
                console.log('📦 Current block:', network.blockNumber);
                
                // Determine network
                if (window.tronWeb.fullNode.host.includes('api.trongrid')) {
                    network.networkName = 'Mainnet';
                } else if (window.tronWeb.fullNode.host.includes('nile')) {
                    network.networkName = 'Nile Testnet';
                } else if (window.tronWeb.fullNode.host.includes('shasta')) {
                    network.networkName = 'Shasta Testnet';
                } else {
                    network.networkName = 'Custom';
                }
                console.log('🌐 Network:', network.networkName);
            }
            
            // Test API connection
            try {
                const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
                network.apiConnection = true;
                console.log('✅ API connection working');
            } catch (e) {
                console.log('⚠️ API connection issue:', e.message);
            }
            
        } catch (error) {
            console.error('❌ Network connection error:', error.message);
        }
        
        return network;
    },
    
    async testContractAddresses() {
        const contracts = {
            alert: { address: 'TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb', status: 'unknown' },
            document: { address: 'TNmRbJvnH45pXFux3eDVDN7Dm9NuQyitUx', status: 'unknown' },
            legacy: { address: 'TGqVLmkM5Dz9S7iRLCuhVzUe8YhRxnKQQq', status: 'unknown' },
            deployed: { address: 'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh', status: 'unknown' }
        };
        
        for (const [name, info] of Object.entries(contracts)) {
            console.log(`\nTesting ${name} contract: ${info.address}`);
            
            try {
                // Method 1: Try contract.at()
                console.log('  Method 1: contract.at()...');
                try {
                    const contract = await window.tronWeb.contract().at(info.address);
                    if (contract) {
                        info.status = 'connected';
                        console.log('    ✅ Connected via contract.at()');
                        
                        // Try to call a method
                        try {
                            const supply = await contract.totalSupply().call();
                            info.totalSupply = Number(supply.toString());
                            console.log(`    ✅ totalSupply() works: ${info.totalSupply}`);
                        } catch (e) {
                            console.log('    ⚠️ totalSupply() failed:', e.message);
                        }
                    }
                } catch (e) {
                    console.log('    ❌ contract.at() failed:', e.message);
                }
                
                // Method 2: Try getContract
                console.log('  Method 2: getContract()...');
                try {
                    const contractInfo = await window.tronWeb.trx.getContract(info.address);
                    if (contractInfo && contractInfo.contract_address) {
                        console.log('    ✅ Contract exists on chain');
                        info.onChain = true;
                        
                        if (contractInfo.abi && contractInfo.abi.entrys) {
                            info.abiMethods = contractInfo.abi.entrys.length;
                            console.log(`    ✅ ABI has ${info.abiMethods} methods`);
                        }
                    }
                } catch (e) {
                    console.log('    ❌ getContract() failed:', e.message);
                }
                
                // Method 3: Try direct call
                console.log('  Method 3: Direct triggerSmartContract...');
                try {
                    const result = await window.tronWeb.transactionBuilder.triggerSmartContract(
                        info.address,
                        'totalSupply()',
                        {},
                        [],
                        window.tronWeb.defaultAddress.base58
                    );
                    
                    if (result && result.result) {
                        console.log('    ✅ Direct call successful');
                        info.directCall = true;
                    }
                } catch (e) {
                    console.log('    ❌ Direct call failed:', e.message);
                }
                
            } catch (error) {
                info.status = 'error';
                info.error = error.message;
                console.error(`  ❌ Overall error:`, error.message);
            }
        }
        
        return contracts;
    },
    
    async checkABI() {
        const abiStatus = {
            hasDefaultABI: false,
            canLoadABI: false,
            testContract: null
        };
        
        try {
            // Check if we have a default TRC721 ABI
            console.log('Checking for TRC721 ABI...');
            
            // Try to create a contract with a minimal ABI
            const minimalABI = [
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
                }
            ];
            
            try {
                const testContract = window.tronWeb.contract(minimalABI, 'TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb');
                if (testContract) {
                    abiStatus.canLoadABI = true;
                    console.log('✅ Can create contract with custom ABI');
                    
                    // Try to call a method
                    const supply = await testContract.totalSupply().call();
                    console.log('✅ Custom ABI contract works, supply:', supply.toString());
                    abiStatus.testContract = true;
                }
            } catch (e) {
                console.log('❌ Cannot use custom ABI:', e.message);
            }
            
        } catch (error) {
            console.error('❌ ABI check error:', error.message);
        }
        
        return abiStatus;
    },
    
    async checkPermissions() {
        const permissions = {
            canSign: false,
            canCall: false,
            accountType: null
        };
        
        try {
            // Check if we can sign transactions
            if (window.tronWeb && window.tronWeb.defaultAddress) {
                permissions.canSign = true;
                console.log('✅ Can sign transactions');
                
                // Check account type
                const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
                if (account.type) {
                    permissions.accountType = account.type;
                    console.log('Account type:', account.type);
                }
                
                permissions.canCall = true;
                console.log('✅ Can make contract calls');
            }
        } catch (error) {
            console.error('❌ Permission check error:', error.message);
        }
        
        return permissions;
    },
    
    printSummary(results) {
        console.log('\n' + '='.repeat(70));
        console.log('📊 DIAGNOSTIC SUMMARY');
        console.log('='.repeat(70));
        
        // Identify main issues
        const issues = [];
        
        if (!results.tronWeb.exists) {
            issues.push('❌ CRITICAL: TronWeb not found');
        } else if (!results.tronWeb.ready) {
            issues.push('⚠️ TronWeb not ready');
        }
        
        if (!results.tronWeb.wallet) {
            issues.push('❌ No wallet connected');
        }
        
        if (!results.network.connected) {
            issues.push('❌ Not connected to TRON network');
        }
        
        // Check contract issues
        let contractIssues = 0;
        for (const [name, info] of Object.entries(results.contracts)) {
            if (info.status !== 'connected' && !info.directCall) {
                contractIssues++;
            }
        }
        if (contractIssues > 0) {
            issues.push(`⚠️ ${contractIssues} contracts not accessible`);
        }
        
        if (issues.length === 0) {
            console.log('✅ All systems operational!');
        } else {
            console.log('🔴 ISSUES DETECTED:');
            issues.forEach(issue => console.log('  ' + issue));
        }
        
        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        
        if (!results.tronWeb.exists || !results.tronWeb.ready) {
            console.log('1. Ensure TronLink extension is installed');
            console.log('2. Connect wallet to the dApp');
            console.log('3. Refresh the page after connecting');
        }
        
        if (contractIssues > 0) {
            console.log('1. Verify you are on the correct network (Mainnet)');
            console.log('2. Try using direct contract calls instead of contract.at()');
            console.log('3. Consider using custom ABI initialization');
        }
        
        // Suggest workaround
        console.log('\n🔧 SUGGESTED WORKAROUND:');
        console.log('Use direct triggerSmartContract calls instead of contract.at()');
        console.log('Example for Alert #27:');
        console.log(`
const result = await window.tronWeb.transactionBuilder.triggerSmartContract(
    'TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb',
    'tokenURI(uint256)',
    {},
    [{type: 'uint256', value: 27}],
    window.tronWeb.defaultAddress.base58
);
        `);
    },
    
    // Quick test for Alert #27
    async testAlert27Direct() {
        console.log('\n🎯 TESTING ALERT #27 WITH DIRECT CALL\n');
        
        try {
            const result = await window.tronWeb.transactionBuilder.triggerSmartContract(
                'TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb',
                'tokenURI(uint256)',
                {},
                [{type: 'uint256', value: 27}],
                window.tronWeb.defaultAddress.base58
            );
            
            if (result && result.result) {
                console.log('✅ Direct call successful!');
                
                // Decode the result
                const hex = result.constant_result[0];
                try {
                    const uri = window.tronWeb.toUtf8(hex);
                    console.log('Token URI:', uri.substring(0, 100) + '...');
                    
                    if (uri.startsWith('data:application/json;base64,')) {
                        console.log('✅ Alert #27 is using BASE64 encoding!');
                    } else if (uri.includes('ipfs')) {
                        console.log('⚠️ Alert #27 is using IPFS');
                    }
                } catch (e) {
                    // Try alternate decoding
                    const decoded = window.tronWeb.utils.abi.decodeParams(['string'], hex)[0];
                    console.log('Decoded URI:', decoded.substring(0, 100) + '...');
                }
                
                return true;
            }
        } catch (error) {
            console.error('❌ Direct call failed:', error.message);
            return false;
        }
    }
};

// Auto-run diagnostic
DiagnoseContractFailure.runFullDiagnostic().then(() => {
    console.log('\n💡 To test Alert #27 directly, run:');
    console.log('    DiagnoseContractFailure.testAlert27Direct()');
});

console.log('\n📚 AVAILABLE COMMANDS:');
console.log('DiagnoseContractFailure.runFullDiagnostic() - Full system check');
console.log('DiagnoseContractFailure.checkTronWeb() - Check TronWeb only');
console.log('DiagnoseContractFailure.testContractAddresses() - Test all contracts');
console.log('DiagnoseContractFailure.testAlert27Direct() - Direct test of Alert #27');