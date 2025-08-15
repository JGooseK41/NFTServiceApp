/**
 * FIX CHECK ALERT #27 
 * Properly checks Alert #27 with correct contract addresses
 */

console.log('🔧 FIXING ALERT #27 CHECK');
console.log('=' .repeat(70));

window.CheckAlert27Fixed = {
    
    // Known contract addresses
    contracts: {
        alert: 'TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb',  // Alert NFT contract
        document: 'TNmRbJvnH45pXFux3eDVDN7Dm9NuQyitUx', // Document NFT contract
        legacy: 'TGqVLmkM5Dz9S7iRLCuhVzUe8YhRxnKQQq'  // Legacy contract
    },
    
    async findCorrectContract() {
        console.log('\n🔍 Finding correct contract...\n');
        
        for (const [name, address] of Object.entries(this.contracts)) {
            try {
                console.log(`Testing ${name} contract: ${address}`);
                const contract = await window.tronWeb.contract().at(address);
                
                // Try to get total supply
                const supply = await contract.totalSupply().call();
                const supplyNum = Number(supply.toString());
                
                if (supplyNum >= 27) {
                    console.log(`✅ Found working contract: ${name} (${address})`);
                    console.log(`   Total supply: ${supplyNum}`);
                    
                    // Try to get token 27
                    try {
                        const uri = await contract.tokenURI(27).call();
                        console.log(`   Token #27 exists!`);
                        return { contract, address, name };
                    } catch (e) {
                        console.log(`   Token #27 not found in this contract`);
                    }
                }
            } catch (error) {
                console.log(`   ❌ Not accessible or wrong ABI`);
            }
        }
        
        return null;
    },
    
    async checkTokenURI() {
        console.log('\n📡 Checking Alert #27 metadata...\n');
        
        try {
            // Find the correct contract
            const contractInfo = await this.findCorrectContract();
            
            if (!contractInfo) {
                console.error('❌ Could not find contract with token #27');
                
                // Try manual approach
                console.log('\n🔧 Trying manual contract connection...');
                return await this.manualCheck();
            }
            
            const { contract, address, name } = contractInfo;
            console.log(`\n✅ Using ${name} contract: ${address}\n`);
            
            // Get the tokenURI
            const tokenURI = await contract.tokenURI(27).call();
            
            console.log('📌 Token URI for Alert #27:');
            console.log(tokenURI);
            console.log('\n' + '─'.repeat(50) + '\n');
            
            // Analyze the URI
            this.analyzeURI(tokenURI);
            
            // Decode if base64
            if (tokenURI.startsWith('data:')) {
                await this.decodeDataURI(tokenURI);
            } else if (tokenURI.includes('ipfs')) {
                await this.fetchIPFSMetadata(tokenURI);
            }
            
            return tokenURI;
            
        } catch (error) {
            console.error('❌ Error:', error.message);
            return await this.fallbackCheck();
        }
    },
    
    async manualCheck() {
        console.log('Attempting manual token URI fetch...\n');
        
        try {
            // Direct call using tronWeb
            const result = await window.tronWeb.transactionBuilder.triggerSmartContract(
                'TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb',
                'tokenURI(uint256)',
                {},
                [{type: 'uint256', value: 27}],
                window.tronWeb.defaultAddress.base58
            );
            
            if (result.result) {
                const uri = window.tronWeb.toUtf8(result.constant_result[0]);
                console.log('✅ Manual fetch successful!');
                console.log('URI:', uri);
                this.analyzeURI(uri);
                return uri;
            }
        } catch (e) {
            console.error('Manual fetch failed:', e);
        }
    },
    
    async fallbackCheck() {
        console.log('\n🔄 FALLBACK: Checking recent transactions...\n');
        
        try {
            // Check recent transactions for minting events
            const events = await window.tronWeb.getEventByContractAddress(
                'TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb',
                {
                    eventName: 'Transfer',
                    size: 50
                }
            );
            
            const token27Events = events.filter(e => 
                e.result && e.result.tokenId && 
                Number(e.result.tokenId) === 27
            );
            
            if (token27Events.length > 0) {
                console.log('✅ Found token #27 in events');
                console.log('Minted in transaction:', token27Events[0].transaction);
            } else {
                console.log('❌ Token #27 not found in recent events');
            }
        } catch (e) {
            console.error('Event check failed:', e);
        }
    },
    
    analyzeURI(uri) {
        console.log('🔬 URI STRUCTURE ANALYSIS:');
        console.log('─'.repeat(50));
        
        if (!uri) {
            console.log('❌ No URI to analyze');
            return;
        }
        
        if (uri.startsWith('data:application/json;base64,')) {
            console.log('✅ Format: BASE64 DATA URI');
            console.log('✅ Self-contained (no external dependencies)');
            console.log('✅ Will display in wallets without IPFS');
            console.log('✅ THIS IS THE CORRECT FORMAT');
        } else if (uri.includes('ipfs://')) {
            console.log('⚠️ Format: IPFS URI');
            console.log('⚠️ Requires IPFS gateway');
            console.log('⚠️ May not display in wallets');
            console.log('❌ THIS NEEDS TO BE FIXED TO BASE64');
        } else if (uri.includes('gateway.pinata.cloud')) {
            console.log('⚠️ Format: PINATA GATEWAY URL');
            console.log('⚠️ Depends on external service');
            console.log('❌ THIS NEEDS TO BE FIXED TO BASE64');
        } else {
            console.log('❓ Format: UNKNOWN');
            console.log('First 100 chars:', uri.substring(0, 100));
        }
        
        console.log('\n' + '─'.repeat(50) + '\n');
    },
    
    async decodeDataURI(dataURI) {
        console.log('🔓 DECODING BASE64 METADATA:');
        console.log('─'.repeat(50));
        
        try {
            const base64Data = dataURI.split(',')[1];
            const jsonString = atob(base64Data);
            const metadata = JSON.parse(jsonString);
            
            console.log('\n📋 Decoded Metadata:');
            console.log('Name:', metadata.name || 'Not set');
            console.log('Description:', (metadata.description || '').substring(0, 100) + '...');
            
            // Check image
            if (metadata.image) {
                if (metadata.image.startsWith('data:image')) {
                    console.log('\n✅ IMAGE: BASE64 ENCODED');
                    const imageSizeKB = Math.round(metadata.image.length * 0.75 / 1024);
                    console.log(`Size: ~${imageSizeKB} KB`);
                } else if (metadata.image.includes('ipfs')) {
                    console.log('\n⚠️ IMAGE: IPFS LINK');
                    console.log('URL:', metadata.image);
                } else {
                    console.log('\n❓ IMAGE: Unknown format');
                }
            } else {
                console.log('\n❌ No image in metadata');
            }
            
            // Check attributes
            if (metadata.attributes && metadata.attributes.length > 0) {
                console.log('\n📊 Attributes:');
                metadata.attributes.forEach(attr => {
                    console.log(`  - ${attr.trait_type}: ${attr.value}`);
                });
            }
            
            return metadata;
            
        } catch (error) {
            console.error('❌ Decode error:', error);
        }
    },
    
    async fetchIPFSMetadata(uri) {
        console.log('🌐 FETCHING FROM IPFS:');
        console.log('─'.repeat(50));
        
        try {
            let gatewayUrl = uri;
            if (uri.startsWith('ipfs://')) {
                const hash = uri.replace('ipfs://', '');
                gatewayUrl = `https://gateway.pinata.cloud/ipfs/${hash}`;
            }
            
            console.log('Gateway URL:', gatewayUrl);
            console.log('⚠️ This relies on external gateway availability');
            
            const response = await fetch(gatewayUrl);
            if (response.ok) {
                const metadata = await response.json();
                console.log('\nFetched successfully');
                console.log('Name:', metadata.name);
                
                if (metadata.image) {
                    if (metadata.image.includes('ipfs')) {
                        console.log('⚠️ Image also on IPFS (double dependency)');
                    }
                }
                
                return metadata;
            } else {
                console.log('❌ Failed to fetch:', response.status);
            }
            
        } catch (error) {
            console.error('❌ IPFS fetch error:', error);
        }
    },
    
    async checkBackendStorage() {
        console.log('\n💾 CHECKING BACKEND STORAGE:');
        console.log('─'.repeat(50));
        
        try {
            const response = await fetch('https://nftserviceapp.onrender.com/api/notices/27/images', {
                headers: {
                    'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58 || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
                    'X-Server-Address': 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Backend response received');
                console.log('Alert Image:', data.alertImage ? '✅ Present' : '❌ Missing');
                console.log('Document Image:', data.documentImage ? '✅ Present' : '❌ Missing');
                
                if (!data.alertImage && !data.documentImage) {
                    console.log('\n⚠️ No images in backend - may need to sync from blockchain');
                }
            } else {
                console.log('❌ Backend error:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('❌ Backend check failed:', error);
        }
    },
    
    async runFullCheck() {
        console.log('🚀 RUNNING COMPREHENSIVE CHECK FOR ALERT #27\n');
        
        // Check blockchain
        await this.checkTokenURI();
        
        // Check backend
        await this.checkBackendStorage();
        
        console.log('\n' + '=' .repeat(70));
        console.log('📊 FINAL ASSESSMENT:');
        console.log('─'.repeat(50));
        console.log('If URI is BASE64: ✅ Alert will work properly');
        console.log('If URI is IPFS: ❌ Alert needs to be updated to BASE64');
        console.log('\nTo fix IPFS alerts, use the conversion tools we created.');
    }
};

// Replace the broken check
window.CheckAlert27 = window.CheckAlert27Fixed;

// Auto-run
CheckAlert27Fixed.runFullCheck();

console.log('\n📚 COMMANDS:');
console.log('CheckAlert27.runFullCheck() - Complete check');
console.log('CheckAlert27.checkTokenURI() - Just check metadata');
console.log('CheckAlert27.checkBackendStorage() - Just check backend');