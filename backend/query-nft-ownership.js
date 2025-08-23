const axios = require('axios');
require('dotenv').config();

// Correct contract address
const NFT_CONTRACT = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

// TronScan API (often more reliable than TronGrid for NFT data)
async function queryNFTOwnershipViaTronScan() {
    console.log('=== QUERYING NFT OWNERSHIP FROM BLOCKCHAIN ===\n');
    console.log(`Contract: ${NFT_CONTRACT}\n`);
    
    try {
        // Query TronScan for NFT token holders
        const url = `https://apilist.tronscan.org/api/token_trc721/holders?contract=${NFT_CONTRACT}&limit=100&start=0`;
        
        console.log('Fetching NFT inventory from TronScan...\n');
        const response = await axios.get(url);
        
        if (response.data && response.data.nft_tokens) {
            const tokens = response.data.nft_tokens;
            console.log(`Found ${tokens.length} NFTs in contract\n`);
            
            // Group by owner
            const ownershipMap = new Map();
            
            tokens.forEach(token => {
                const tokenId = token.token_id;
                const owner = token.owner_address;
                
                if (!ownershipMap.has(owner)) {
                    ownershipMap.set(owner, []);
                }
                ownershipMap.get(owner).push(parseInt(tokenId));
            });
            
            // Display ownership
            console.log('=== NFT OWNERSHIP BY WALLET ===\n');
            
            for (const [owner, tokenIds] of ownershipMap.entries()) {
                // Sort token IDs
                tokenIds.sort((a, b) => a - b);
                
                // Separate Alert (odd) and Document (even) NFTs
                const alertNFTs = tokenIds.filter(id => id % 2 === 1);
                const documentNFTs = tokenIds.filter(id => id % 2 === 0);
                
                console.log(`Wallet: ${owner}`);
                if (alertNFTs.length > 0) {
                    console.log(`  Alert NFTs (odd): ${alertNFTs.join(', ')}`);
                }
                if (documentNFTs.length > 0) {
                    console.log(`  Document NFTs (even): ${documentNFTs.join(', ')}`);
                }
                console.log('');
            }
            
            // Find Alert NFTs owned by recipients (not the contract)
            console.log('=== ALERT NFTs OWNED BY RECIPIENTS ===\n');
            
            const recipientAlerts = [];
            for (const [owner, tokenIds] of ownershipMap.entries()) {
                // Skip if owner is the contract itself
                if (owner === NFT_CONTRACT) {
                    console.log(`Contract owns: ${tokenIds.join(', ')} (Document NFTs stay here)\n`);
                    continue;
                }
                
                const alertNFTs = tokenIds.filter(id => id % 2 === 1);
                if (alertNFTs.length > 0) {
                    recipientAlerts.push({ owner, alertNFTs });
                    console.log(`${owner}:`);
                    console.log(`  Alert NFTs: ${alertNFTs.join(', ')}`);
                    console.log(`  Paired Document NFTs: ${alertNFTs.map(id => id + 1).join(', ')}\n`);
                }
            }
            
            // Generate recovery data
            console.log('=== RECOVERY DATA FOR DATABASE ===\n');
            console.log('SQL to add missing notices:\n');
            
            recipientAlerts.forEach(({ owner, alertNFTs }) => {
                alertNFTs.forEach(alertId => {
                    const documentId = alertId + 1;
                    const caseNumber = `24-CV-${String(alertId).padStart(6, '0')}`;
                    
                    console.log(`-- For Alert NFT #${alertId} owned by ${owner}`);
                    console.log(`INSERT INTO case_service_records (`);
                    console.log(`  case_number, alert_token_id, document_token_id,`);
                    console.log(`  recipients, served_at, transaction_hash,`);
                    console.log(`  ipfs_hash, encryption_key, accepted`);
                    console.log(`) VALUES (`);
                    console.log(`  '${caseNumber}', '${alertId}', '${documentId}',`);
                    console.log(`  '["${owner}"]', NOW(), 'recovered_${alertId}',`);
                    console.log(`  'QmRecovered${alertId}', 'key_${alertId}', false`);
                    console.log(`) ON CONFLICT (alert_token_id) DO NOTHING;\n`);
                });
            });
            
            return recipientAlerts;
            
        } else {
            console.log('No NFT data returned from TronScan');
        }
        
    } catch (error) {
        console.error('Error querying TronScan:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Alternative: Query via TronGrid
async function queryNFTOwnershipViaTronGrid() {
    console.log('\n=== ALTERNATIVE: QUERYING VIA TRONGRID ===\n');
    
    const alertIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37];
    
    for (const tokenId of alertIds) {
        try {
            const url = `https://api.trongrid.io/v1/contracts/${NFT_CONTRACT}/tokens/${tokenId}`;
            const response = await axios.get(url, {
                headers: process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {}
            });
            
            if (response.data && response.data.data) {
                const data = response.data.data;
                console.log(`Alert NFT #${tokenId}: Owner = ${data.owner_address || 'Unknown'}`);
            }
        } catch (err) {
            console.log(`Alert NFT #${tokenId}: Failed to query`);
        }
    }
}

// Run both methods
async function main() {
    await queryNFTOwnershipViaTronScan();
    // Uncomment to also try TronGrid:
    // await queryNFTOwnershipViaTronGrid();
}

main();