/**
 * FIND ALERT #27
 * Discovers which contract has Alert #27 and checks its metadata
 */

console.log('🔍 FINDING ALERT #27');
console.log('=' .repeat(70));

window.FindAlert27 = {
    
    async scanForContracts() {
        console.log('\n📡 Scanning for NFT contracts...\n');
        
        // Get recent transactions from wallet
        try {
            const address = window.tronWeb.defaultAddress.base58;
            console.log('Your wallet:', address);
            
            // Get account info
            const account = await window.tronWeb.trx.getAccount(address);
            console.log('Account has', account.assetV2?.length || 0, 'tokens');
            
            // Get recent transactions
            const transactions = await window.tronWeb.trx.getTransactionsRelated(address, 'all', 30, 0);
            
            // Find unique contract addresses
            const contracts = new Set();
            
            transactions.forEach(tx => {
                if (tx.raw_data && tx.raw_data.contract) {
                    tx.raw_data.contract.forEach(c => {
                        if (c.parameter && c.parameter.value && c.parameter.value.contract_address) {
                            const contractAddr = window.tronWeb.address.fromHex(c.parameter.value.contract_address);
                            contracts.add(contractAddr);
                        }
                    });
                }
            });
            
            console.log(`Found ${contracts.size} unique contracts in recent transactions:`);
            
            // Test each contract
            for (const contractAddr of contracts) {
                await this.testContract(contractAddr);
            }
            
        } catch (error) {
            console.error('Error scanning:', error);
        }
    },
    
    async testContract(address) {
        try {
            console.log(`\nTesting: ${address}`);
            
            // Try to connect as TRC721
            const contract = await window.tronWeb.contract().at(address);
            
            // Check if it has tokenURI method
            const abi = contract.abi || contract.methods;
            const hasTokenURI = Object.keys(abi).some(key => 
                key.includes('tokenURI') || abi[key].name === 'tokenURI'
            );
            
            if (!hasTokenURI) {
                console.log('  Not an NFT contract (no tokenURI)');
                return null;
            }
            
            // Try to get total supply
            try {
                const supply = await contract.totalSupply().call();
                const supplyNum = Number(supply.toString());
                console.log(`  ✅ NFT Contract! Total supply: ${supplyNum}`);
                
                // Check if it has token 27
                if (supplyNum >= 27) {
                    try {
                        const uri = await contract.tokenURI(27).call();
                        console.log(`  🎯 HAS TOKEN #27!`);
                        console.log(`  URI: ${uri.substring(0, 100)}...`);
                        
                        // Analyze this URI
                        this.analyzeToken27(uri, address);
                        return { address, uri };
                    } catch (e) {
                        console.log(`  Token #27 not minted yet`);
                    }
                }
            } catch (e) {
                console.log('  Could not get supply');
            }
            
        } catch (error) {
            console.log('  Not accessible');
        }
        
        return null;
    },
    
    analyzeToken27(uri, contractAddress) {
        console.log('\n' + '🎯'.repeat(20));
        console.log('FOUND ALERT #27!');
        console.log('Contract:', contractAddress);
        console.log('─'.repeat(50));
        
        if (uri.startsWith('data:application/json;base64,')) {
            console.log('✅✅✅ USING BASE64 ENCODING ✅✅✅');
            console.log('This is the correct format!');
            
            // Decode it
            try {
                const base64 = uri.split(',')[1];
                const json = atob(base64);
                const metadata = JSON.parse(json);
                
                console.log('\nMetadata:');
                console.log('  Name:', metadata.name);
                console.log('  Description:', metadata.description?.substring(0, 50) + '...');
                
                if (metadata.image) {
                    if (metadata.image.startsWith('data:image')) {
                        console.log('  Image: ✅ Also BASE64 (fully self-contained)');
                    } else if (metadata.image.includes('ipfs')) {
                        console.log('  Image: ⚠️ Using IPFS link');
                    }
                }
                
                // Show attributes
                if (metadata.attributes) {
                    console.log('\n  Attributes:');
                    metadata.attributes.forEach(attr => {
                        console.log(`    - ${attr.trait_type}: ${attr.value}`);
                    });
                }
                
            } catch (e) {
                console.log('Error decoding:', e);
            }
            
        } else if (uri.includes('ipfs')) {
            console.log('❌❌❌ USING IPFS ❌❌❌');
            console.log('This needs to be converted to BASE64!');
            console.log('IPFS URI:', uri);
        } else {
            console.log('❓ Unknown format:', uri.substring(0, 100));
        }
        
        console.log('─'.repeat(50));
    },
    
    async directCheck() {
        console.log('\n🎯 Direct check of known contracts...\n');
        
        // List of all possible contracts from your codebase
        const possibleContracts = [
            'TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb',
            'TNmRbJvnH45pXFux3eDVDN7Dm9NuQyitUx', 
            'TGqVLmkM5Dz9S7iRLCuhVzUe8YhRxnKQQq',
            'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh',  // From your deployment scripts
            'TD5QQn8HHCwzYk3J5knAwyL3m8Lz5G1xZE',  // Another possibility
        ];
        
        for (const addr of possibleContracts) {
            const result = await this.testContract(addr);
            if (result) {
                return result;
            }
        }
        
        console.log('\n❌ Could not find token #27 in any known contract');
        console.log('You may need to check your deployment records.');
    },
    
    async checkByTokenId() {
        console.log('\n🔢 Checking odd token IDs (alerts are odd numbers)...\n');
        
        // Since alerts are odd numbers, #27 is definitely an alert
        // Try to find any contract with odd-numbered tokens
        
        const testIds = [25, 27, 29]; // Recent odd IDs
        
        console.log('Looking for contracts with these alert IDs:', testIds.join(', '));
        
        // This will help identify which contract is being used
    },
    
    async run() {
        console.log('🚀 Starting comprehensive search for Alert #27...\n');
        
        // Method 1: Scan recent transactions
        await this.scanForContracts();
        
        // Method 2: Check known contracts
        await this.directCheck();
        
        console.log('\n' + '=' .repeat(70));
        console.log('Search complete!');
        console.log('\nIf Alert #27 was found:');
        console.log('  ✅ BASE64 = Good, will display properly');
        console.log('  ❌ IPFS = Needs conversion to BASE64');
    }
};

// Run the search
FindAlert27.run();

console.log('\n📚 Commands:');
console.log('FindAlert27.run() - Full search');
console.log('FindAlert27.scanForContracts() - Scan transactions');
console.log('FindAlert27.directCheck() - Check known contracts');