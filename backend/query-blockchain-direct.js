const TronWebModule = require('tronweb');
require('dotenv').config();

// TronWeb v6 uses a different initialization
const TronWeb = TronWebModule.TronWeb || TronWebModule;

// Initialize TronWeb
const tronWeb = typeof TronWeb === 'function' ? new TronWeb({
    fullHost: 'https://api.trongrid.io',
    headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY || '' }
}) : TronWeb;

// Correct contract address
const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

// Known wallets to check
const KNOWN_WALLETS = [
    'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH',  // Has Alert NFTs: 1, 17, 29, 37
    'TBjqKep',  // Partial address, has Alert NFTs: 13, 19, 27, 35
];

async function checkNFTOwnership() {
    console.log('=== CHECKING NFT OWNERSHIP ON BLOCKCHAIN ===\n');
    console.log(`Contract: ${CONTRACT_ADDRESS}\n`);
    
    try {
        // Load contract
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
        
        // Check total supply if available
        try {
            const totalSupply = await contract.totalSupply().call();
            console.log(`Total NFTs minted: ${totalSupply}\n`);
        } catch (e) {
            console.log('Could not get total supply\n');
        }
        
        // Check ownership for specific Alert NFT IDs
        const alertIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37];
        
        console.log('Checking ownership of Alert NFTs (odd numbers):\n');
        
        const ownershipMap = new Map();
        
        for (const tokenId of alertIds) {
            try {
                // Try to get owner of token
                const owner = await contract.ownerOf(tokenId).call();
                const ownerBase58 = tronWeb.address.fromHex(owner);
                
                console.log(`Alert NFT #${tokenId}: ${ownerBase58}`);
                
                if (!ownershipMap.has(ownerBase58)) {
                    ownershipMap.set(ownerBase58, []);
                }
                ownershipMap.get(ownerBase58).push(tokenId);
                
            } catch (err) {
                console.log(`Alert NFT #${tokenId}: Not minted or error`);
            }
        }
        
        // Check Document NFTs (even numbers)
        console.log('\nChecking ownership of Document NFTs (even numbers):\n');
        
        const documentIds = alertIds.map(id => id + 1);
        let contractOwnsCount = 0;
        
        for (const tokenId of documentIds) {
            try {
                const owner = await contract.ownerOf(tokenId).call();
                const ownerBase58 = tronWeb.address.fromHex(owner);
                
                if (ownerBase58 === CONTRACT_ADDRESS) {
                    contractOwnsCount++;
                } else {
                    console.log(`Document NFT #${tokenId}: ${ownerBase58} (unexpected!)`);
                }
            } catch (err) {
                // Token doesn't exist
            }
        }
        
        console.log(`Contract owns ${contractOwnsCount} Document NFTs (as expected)\n`);
        
        // Summary
        console.log('=== OWNERSHIP SUMMARY ===\n');
        
        for (const [owner, tokens] of ownershipMap.entries()) {
            if (owner !== CONTRACT_ADDRESS) {
                console.log(`Wallet: ${owner}`);
                console.log(`  Alert NFTs: ${tokens.sort((a,b) => a-b).join(', ')}`);
                console.log(`  Paired Document NFTs: ${tokens.map(t => t+1).join(', ')}\n`);
            }
        }
        
        // Generate database update
        console.log('=== DATABASE UPDATE NEEDED ===\n');
        
        for (const [owner, tokens] of ownershipMap.entries()) {
            if (owner !== CONTRACT_ADDRESS) {
                for (const alertId of tokens) {
                    console.log(`Alert NFT #${alertId}:`);
                    console.log(`  Owner: ${owner}`);
                    console.log(`  Document NFT: #${alertId + 1}`);
                    console.log(`  Add to case_service_records with recipient: ${owner}\n`);
                }
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Alternative: Check wallet balances
async function checkWalletBalances() {
    console.log('\n=== CHECKING KNOWN WALLET BALANCES ===\n');
    
    for (const wallet of KNOWN_WALLETS) {
        if (wallet.length < 34) {
            console.log(`Skipping partial address: ${wallet}\n`);
            continue;
        }
        
        try {
            // Query TRC721 token balance
            const url = `https://api.trongrid.io/v1/accounts/${wallet}/tokens`;
            const response = await fetch(url, {
                headers: process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {}
            });
            
            const data = await response.json();
            
            console.log(`Wallet: ${wallet}`);
            
            if (data.data) {
                const nftTokens = data.data.filter(t => t.tokenId && t.tokenAbbr);
                if (nftTokens.length > 0) {
                    console.log(`  Found ${nftTokens.length} tokens`);
                    nftTokens.forEach(token => {
                        if (token.tokenId && token.balance) {
                            console.log(`    Token: ${token.tokenAbbr || token.tokenName} (Balance: ${token.balance})`);
                        }
                    });
                } else {
                    console.log('  No NFTs found via this method');
                }
            }
            console.log('');
            
        } catch (err) {
            console.log(`Error checking ${wallet}: ${err.message}\n`);
        }
    }
}

async function main() {
    await checkNFTOwnership();
    await checkWalletBalances();
}

main();