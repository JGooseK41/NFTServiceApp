/**
 * FIX TRONWEB CONTRACT CONNECTION
 * Addresses the "Invalid contract address provided" error
 */

console.log('🔧 FIXING TRONWEB CONTRACT CONNECTION');
console.log('=' .repeat(70));

window.FixTronWebContract = {
    
    // Test if the issue is with contract.at()
    async testContractAt() {
        console.log('\n🔍 Testing contract.at() method...\n');
        
        const testAddress = 'TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb';
        
        try {
            console.log('Testing with address:', testAddress);
            
            // Method 1: Direct contract.at()
            console.log('Method 1: Direct contract.at()...');
            const contract = await window.tronWeb.contract().at(testAddress);
            console.log('✅ Success! Contract loaded');
            return contract;
            
        } catch (error) {
            console.log('❌ contract.at() failed:', error.message);
            
            // Try alternative methods
            return await this.tryAlternatives(testAddress);
        }
    },
    
    async tryAlternatives(address) {
        console.log('\n🔄 Trying alternative methods...\n');
        
        // Method 2: Get contract info first
        try {
            console.log('Method 2: Getting contract info first...');
            const contractInfo = await window.tronWeb.trx.getContract(address);
            
            if (contractInfo && contractInfo.abi) {
                console.log('✅ Contract info retrieved');
                console.log('Creating contract instance with ABI...');
                
                const contract = window.tronWeb.contract(contractInfo.abi.entrys, address);
                console.log('✅ Contract created with ABI!');
                return contract;
            }
        } catch (e) {
            console.log('❌ Method 2 failed:', e.message);
        }
        
        // Method 3: Use minimal TRC721 ABI
        try {
            console.log('\nMethod 3: Using minimal TRC721 ABI...');
            const minimalABI = this.getTRC721ABI();
            const contract = window.tronWeb.contract(minimalABI, address);
            console.log('✅ Contract created with minimal ABI!');
            return contract;
        } catch (e) {
            console.log('❌ Method 3 failed:', e.message);
        }
        
        return null;
    },
    
    getTRC721ABI() {
        return [
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
    },
    
    // Direct method to check Alert #27
    async checkAlert27Direct() {
        console.log('\n🎯 CHECKING ALERT #27 WITH DIRECT CALL\n');
        
        try {
            // Use triggerSmartContract directly
            const result = await window.tronWeb.transactionBuilder.triggerSmartContract(
                'TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb',
                'tokenURI(uint256)',
                {
                    feeLimit: 1000000
                },
                [
                    {type: 'uint256', value: 27}
                ],
                window.tronWeb.defaultAddress.base58
            );
            
            if (result && result.result) {
                console.log('✅ Direct call successful!');
                
                // Decode the result
                if (result.constant_result && result.constant_result[0]) {
                    const hex = result.constant_result[0];
                    
                    // Try different decoding methods
                    let uri = '';
                    
                    // Method 1: Direct UTF8
                    try {
                        uri = window.tronWeb.toUtf8(hex);
                    } catch (e) {
                        // Method 2: ABI decode
                        try {
                            const decoded = window.tronWeb.utils.abi.decodeParams(['string'], hex);
                            uri = decoded[0];
                        } catch (e2) {
                            console.log('Could not decode result');
                        }
                    }
                    
                    if (uri) {
                        console.log('\n📋 Token URI for Alert #27:');
                        console.log('─'.repeat(50));
                        
                        if (uri.startsWith('data:application/json;base64,')) {
                            console.log('✅✅✅ USING BASE64 ENCODING ✅✅✅');
                            console.log('This alert will display properly in wallets!');
                            
                            // Decode the metadata
                            const base64 = uri.split(',')[1];
                            const json = atob(base64);
                            const metadata = JSON.parse(json);
                            
                            console.log('\nMetadata:');
                            console.log('  Name:', metadata.name);
                            console.log('  Description:', metadata.description?.substring(0, 50) + '...');
                            
                            if (metadata.image) {
                                if (metadata.image.startsWith('data:image')) {
                                    console.log('  Image: ✅ BASE64 (fully self-contained)');
                                } else {
                                    console.log('  Image: ⚠️ External URL');
                                }
                            }
                            
                        } else if (uri.includes('ipfs')) {
                            console.log('⚠️⚠️⚠️ USING IPFS ⚠️⚠️⚠️');
                            console.log('This needs to be converted to BASE64!');
                            console.log('IPFS URI:', uri);
                        } else {
                            console.log('Unknown format:', uri.substring(0, 100));
                        }
                        
                        return uri;
                    }
                }
            }
        } catch (error) {
            console.error('❌ Direct call failed:', error.message);
            console.log('\nThis might be because:');
            console.log('1. The contract address is wrong');
            console.log('2. Token #27 doesn\'t exist');
            console.log('3. Network connection issue');
        }
        
        return null;
    },
    
    // Create a working contract instance
    async getWorkingContract() {
        console.log('\n🔨 Creating working contract instance...\n');
        
        const address = 'TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb';
        
        // Try to get a working contract
        let contract = await this.testContractAt();
        
        if (contract) {
            console.log('✅ Contract instance created successfully!');
            
            // Store it globally for easy access
            window.alertContract = contract;
            console.log('Contract stored as: window.alertContract');
            
            return contract;
        } else {
            console.log('❌ Could not create contract instance');
            console.log('Using direct calls instead');
            
            // Create a wrapper that uses direct calls
            window.alertContract = {
                tokenURI: async (tokenId) => {
                    const result = await window.tronWeb.transactionBuilder.triggerSmartContract(
                        address,
                        'tokenURI(uint256)',
                        {feeLimit: 1000000},
                        [{type: 'uint256', value: tokenId}],
                        window.tronWeb.defaultAddress.base58
                    );
                    
                    if (result && result.constant_result && result.constant_result[0]) {
                        try {
                            return window.tronWeb.toUtf8(result.constant_result[0]);
                        } catch (e) {
                            const decoded = window.tronWeb.utils.abi.decodeParams(['string'], result.constant_result[0]);
                            return decoded[0];
                        }
                    }
                    throw new Error('Failed to get tokenURI');
                },
                
                totalSupply: async () => {
                    const result = await window.tronWeb.transactionBuilder.triggerSmartContract(
                        address,
                        'totalSupply()',
                        {feeLimit: 1000000},
                        [],
                        window.tronWeb.defaultAddress.base58
                    );
                    
                    if (result && result.constant_result && result.constant_result[0]) {
                        const decoded = window.tronWeb.utils.abi.decodeParams(['uint256'], result.constant_result[0]);
                        return decoded[0];
                    }
                    throw new Error('Failed to get totalSupply');
                }
            };
            
            console.log('✅ Direct call wrapper created as: window.alertContract');
            return window.alertContract;
        }
    },
    
    // Full diagnostic and fix
    async diagnoseAndFix() {
        console.log('🚀 Running full diagnostic and fix...\n');
        
        // Step 1: Check TronWeb
        if (!window.tronWeb) {
            console.log('❌ TronWeb not found!');
            return;
        }
        console.log('✅ TronWeb found');
        
        // Step 2: Check wallet
        if (!window.tronWeb.defaultAddress?.base58) {
            console.log('❌ No wallet connected!');
            return;
        }
        console.log('✅ Wallet connected:', window.tronWeb.defaultAddress.base58);
        
        // Step 3: Test contract connection
        await this.testContractAt();
        
        // Step 4: Check Alert #27
        await this.checkAlert27Direct();
        
        // Step 5: Create working instance
        await this.getWorkingContract();
        
        console.log('\n' + '='.repeat(70));
        console.log('DIAGNOSTIC COMPLETE!');
        console.log('='.repeat(70));
    }
};

// Auto-run diagnostic
FixTronWebContract.diagnoseAndFix();

console.log('\n📚 AVAILABLE COMMANDS:');
console.log('FixTronWebContract.diagnoseAndFix() - Full diagnostic and fix');
console.log('FixTronWebContract.checkAlert27Direct() - Check Alert #27 directly');
console.log('FixTronWebContract.getWorkingContract() - Get working contract instance');
console.log('\nAfter running, use: window.alertContract.tokenURI(27)');