/**
 * CHECK WALLET NFT HOLDINGS
 * Query all NFTs held by a specific address
 */

console.log('🔍 Loading wallet NFT checker...');

window.CheckWalletNFTs = {
    
    // Check NFTs for a specific wallet
    async checkWallet(address) {
        console.log('\n' + '='.repeat(70));
        console.log(`🔍 Checking NFTs for wallet: ${address}`);
        console.log('='.repeat(70));
        
        if (!window.legalContract) {
            console.error('❌ Contract not loaded');
            return;
        }
        
        try {
            // Get balance
            const balance = await window.legalContract.balanceOf(address).call();
            const balanceNum = Number(balance.toString());
            console.log(`\n📊 Total NFTs owned: ${balanceNum}`);
            
            if (balanceNum === 0) {
                console.log('No NFTs found in this wallet');
                return;
            }
            
            // Get each token
            const tokens = [];
            for (let i = 0; i < balanceNum; i++) {
                try {
                    const tokenId = await window.legalContract.tokenOfOwnerByIndex(address, i).call();
                    const tokenIdNum = Number(tokenId.toString());
                    tokens.push(tokenIdNum);
                    
                    console.log(`\n📍 Token #${tokenIdNum}:`);
                    
                    // Get token type
                    const tokenType = await window.legalContract.tokenTypes(tokenIdNum).call();
                    console.log(`   Type: ${tokenType === 0 ? '🚨 Alert NFT' : '📄 Document NFT'}`);
                    
                    // Get metadata URI
                    const uri = await window.legalContract.tokenURI(tokenIdNum).call();
                    if (uri) {
                        console.log(`   ✅ Has metadata: ${uri.substring(0, 50)}...`);
                        
                        // Try to fetch metadata
                        if (uri.startsWith('ipfs://')) {
                            const httpUrl = uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
                            try {
                                const response = await fetch(httpUrl);
                                const metadata = await response.json();
                                console.log(`   Name: ${metadata.name}`);
                                console.log(`   Description: ${metadata.description?.substring(0, 100)}...`);
                                console.log(`   Image: ${metadata.image ? '✅ Has image' : '❌ No image'}`);
                            } catch (e) {
                                console.log('   ⚠️ Could not fetch metadata from IPFS');
                            }
                        } else if (uri.startsWith('data:')) {
                            try {
                                const base64 = uri.split(',')[1];
                                const metadata = JSON.parse(atob(base64));
                                console.log(`   Name: ${metadata.name}`);
                                console.log(`   Description: ${metadata.description?.substring(0, 100)}...`);
                                console.log(`   Image: ${metadata.image ? '✅ Has image' : '❌ No image'}`);
                            } catch (e) {
                                console.log('   ⚠️ Could not parse data URI');
                            }
                        }
                    } else {
                        console.log(`   ❌ NO METADATA URI - This token won't display properly!`);
                    }
                    
                    // If it's an Alert, check for linked Document
                    if (tokenType === 0) {
                        try {
                            const alertNotice = await window.legalContract.alertNotices(tokenIdNum).call();
                            if (alertNotice && alertNotice.documentId) {
                                console.log(`   📎 Linked Document ID: #${alertNotice.documentId}`);
                            }
                        } catch (e) {
                            // Ignore
                        }
                    }
                    
                } catch (error) {
                    console.error(`Error checking token ${i}:`, error);
                }
            }
            
            console.log('\n' + '='.repeat(70));
            console.log('SUMMARY:');
            console.log(`Total NFTs: ${balanceNum}`);
            console.log(`Token IDs: ${tokens.join(', ')}`);
            
            // Check for metadata issues
            const missingMetadata = [];
            for (const tokenId of tokens) {
                const uri = await window.legalContract.tokenURI(tokenId).call();
                if (!uri) {
                    missingMetadata.push(tokenId);
                }
            }
            
            if (missingMetadata.length > 0) {
                console.log(`\n⚠️ PROBLEM: Tokens without metadata: ${missingMetadata.join(', ')}`);
                console.log('These tokens will NOT display in wallets!');
            } else {
                console.log('\n✅ All tokens have metadata');
            }
            
            console.log('='.repeat(70));
            
        } catch (error) {
            console.error('Error checking wallet:', error);
        }
    },
    
    // Quick check for the recipient
    async checkRecipient() {
        await this.checkWallet('TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH');
    },
    
    // Check your own wallet
    async checkMyWallet() {
        if (window.tronWeb && window.tronWeb.defaultAddress) {
            await this.checkWallet(window.tronWeb.defaultAddress.base58);
        } else {
            console.error('Wallet not connected');
        }
    },
    
    // Compare metadata between tokens
    async compareAllTokens() {
        console.log('\n🔬 Analyzing all tokens for patterns...\n');
        
        const totalSupply = await window.legalContract.totalSupply().call();
        const total = Number(totalSupply.toString());
        
        const withMetadata = [];
        const withoutMetadata = [];
        
        for (let i = 1; i <= total; i++) {
            try {
                const uri = await window.legalContract.tokenURI(i).call();
                if (uri && uri.length > 0) {
                    withMetadata.push(i);
                } else {
                    withoutMetadata.push(i);
                }
            } catch (e) {
                // Token might not exist
            }
        }
        
        console.log(`✅ Tokens WITH metadata: ${withMetadata.join(', ') || 'none'}`);
        console.log(`❌ Tokens WITHOUT metadata: ${withoutMetadata.join(', ') || 'none'}`);
        
        // Look for patterns
        if (withoutMetadata.length > 0) {
            // Check if it's even/odd pattern
            const allEven = withoutMetadata.every(id => id % 2 === 0);
            const allOdd = withoutMetadata.every(id => id % 2 === 1);
            
            if (allEven) {
                console.log('\n💡 Pattern detected: All Document NFTs (even IDs) lack metadata');
            } else if (allOdd) {
                console.log('\n💡 Pattern detected: All Alert NFTs (odd IDs) lack metadata');
            }
            
            // Check token types
            for (const id of withoutMetadata.slice(0, 3)) {
                const tokenType = await window.legalContract.tokenTypes(id).call();
                console.log(`Token #${id} type: ${tokenType === 0 ? 'Alert' : 'Document'}`);
            }
        }
    }
};

// Auto-check the recipient
console.log('✅ Wallet NFT checker loaded');
console.log('');
console.log('Checking recipient wallet automatically...');
CheckWalletNFTs.checkRecipient();

console.log('\nCommands:');
console.log('  CheckWalletNFTs.checkRecipient()  - Check TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH');
console.log('  CheckWalletNFTs.checkMyWallet()   - Check your connected wallet');
console.log('  CheckWalletNFTs.compareAllTokens() - Analyze metadata patterns');