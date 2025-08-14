/**
 * Check NFTs via TronScan API
 */

const CONTRACT_ADDRESS = 'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh';
const WALLET_ADDRESS = 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH'; // The wallet user mentioned

async function checkWalletNFTs() {
    console.log('='.repeat(70));
    console.log('🔍 CHECKING NFTs VIA TRONSCAN API');
    console.log('='.repeat(70));
    console.log(`Contract: ${CONTRACT_ADDRESS}`);
    console.log(`Wallet: ${WALLET_ADDRESS}`);
    console.log('');
    
    // Check NFT holdings for the wallet
    const url = `https://apilist.tronscanapi.com/api/account/tokens?address=${WALLET_ADDRESS}&limit=200`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            console.log('NFTs found in wallet:');
            console.log('-'.repeat(70));
            
            // Filter for our contract
            const ourNFTs = data.data.filter(token => 
                token.tokenId && 
                (token.tokenAbbr === 'LNNFT' || 
                 token.tokenName?.includes('Legal') ||
                 token.tokenId.includes(CONTRACT_ADDRESS))
            );
            
            if (ourNFTs.length > 0) {
                console.log(`Found ${ourNFTs.length} Legal Notice NFTs:`);
                
                ourNFTs.forEach(nft => {
                    console.log(`\n📍 Token: ${nft.tokenName || 'Unknown'}`);
                    console.log(`   ID: ${nft.tokenId}`);
                    console.log(`   Type: ${nft.tokenType}`);
                    console.log(`   Balance: ${nft.balance}`);
                    
                    if (nft.tokenId) {
                        // Extract the actual token number if it's in format contract_tokenNum
                        const parts = nft.tokenId.split('_');
                        if (parts.length > 1) {
                            const tokenNum = parts[parts.length - 1];
                            console.log(`   Token #: ${tokenNum}`);
                            
                            // Check if odd (Alert) or even (Document)
                            const num = parseInt(tokenNum);
                            if (!isNaN(num)) {
                                if (num % 2 === 1) {
                                    console.log(`   Type: Alert NFT`);
                                } else {
                                    console.log(`   Type: Document NFT`);
                                }
                            }
                        }
                    }
                });
            } else {
                console.log('No Legal Notice NFTs found in this wallet');
            }
            
            // Show all NFTs for debugging
            console.log('\n' + '-'.repeat(70));
            console.log('All NFT/tokens in wallet:');
            data.data.forEach(token => {
                if (token.tokenType === 'trc721') {
                    console.log(`• ${token.tokenName} (${token.tokenAbbr}): ${token.balance}`);
                }
            });
            
        } else {
            console.log('No tokens found in wallet');
        }
        
    } catch (error) {
        console.log('Error fetching wallet data:', error.message);
    }
    
    // Also check specific NFT info
    console.log('\n' + '='.repeat(70));
    console.log('CHECKING SPECIFIC NFT METADATA');
    console.log('='.repeat(70));
    
    // Check contract NFT list
    const contractUrl = `https://apilist.tronscanapi.com/api/contract/nft-trc721-inventory?contract=${CONTRACT_ADDRESS}&limit=50`;
    
    try {
        const response = await fetch(contractUrl);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            console.log(`\nFound ${data.total} NFTs minted from contract:`);
            console.log('-'.repeat(70));
            
            // Group by Alert vs Document
            const alerts = [];
            const documents = [];
            
            data.data.forEach(nft => {
                const tokenId = parseInt(nft.tokenId);
                if (tokenId % 2 === 1) {
                    alerts.push(tokenId);
                } else {
                    documents.push(tokenId);
                }
                
                console.log(`Token #${tokenId}: Owner ${nft.ownerAddress}`);
                
                // Check if this is #1, #13, or #19
                if (tokenId === 1 || tokenId === 13 || tokenId === 19) {
                    console.log(`   ⭐ This is Alert #${tokenId} that user mentioned`);
                }
            });
            
            console.log('\n' + '-'.repeat(70));
            console.log(`Alert NFTs (odd IDs): ${alerts.sort((a,b) => a-b).join(', ')}`);
            console.log(`Document NFTs (even IDs): ${documents.sort((a,b) => a-b).join(', ')}`);
            
            // Analysis
            console.log('\n' + '='.repeat(70));
            console.log('📊 ANALYSIS');
            console.log('='.repeat(70));
            
            if (alerts.includes(1)) {
                console.log('✅ Alert #1 exists');
            }
            if (alerts.includes(13)) {
                console.log('✅ Alert #13 exists (user says it shows)');
            }
            if (alerts.includes(19)) {
                console.log('✅ Alert #19 exists (user says it doesn\'t show)');
            }
            
            console.log('\nPossible reasons for display differences:');
            console.log('1. Token metadata URIs are set differently');
            console.log('2. IPFS pins expired for some tokens');
            console.log('3. Wallet caching issues');
            console.log('4. Different minting transactions used different metadata methods');
            
        } else {
            console.log('No NFTs found for this contract');
        }
        
    } catch (error) {
        console.log('Error fetching contract data:', error.message);
    }
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}

checkWalletNFTs().catch(console.error);