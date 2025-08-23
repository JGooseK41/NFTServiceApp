/**
 * Query Tron blockchain for all NFTs minted from our contract
 * This will find all 38 tokens and their recipients
 */

const TronWeb = require('tronweb');
require('dotenv').config();

// Initialize TronWeb for Nile testnet
const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY }
});

// Contract addresses - update these with your actual contract addresses
const CONTRACTS = {
    // Add your contract addresses here
    // You can find these in your deployment logs or transaction history
    ALERT_NFT: 'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh', // Example - replace with actual
    DOCUMENT_NFT: null // If you have a separate document NFT contract
};

async function queryAllNFTs() {
    console.log('\n========================================');
    console.log('QUERYING BLOCKCHAIN FOR ALL NFTS');
    console.log('========================================\n');
    
    const allNFTs = [];
    
    try {
        // Get contract instance
        const contractAddress = CONTRACTS.ALERT_NFT;
        if (!contractAddress) {
            console.log('Please set the contract address in CONTRACTS.ALERT_NFT');
            return;
        }
        
        console.log(`Querying contract: ${contractAddress}`);
        const contract = await tronWeb.contract().at(contractAddress);
        
        // Get total supply to know how many NFTs exist
        let totalSupply = 0;
        try {
            const supply = await contract.totalSupply().call();
            totalSupply = parseInt(supply.toString());
            console.log(`Total NFTs minted: ${totalSupply}`);
        } catch (e) {
            console.log('Could not get totalSupply, trying alternative methods...');
            // Try to query up to token ID 50 to find all existing tokens
            totalSupply = 50;
        }
        
        // Query each token ID
        console.log('\nQuerying individual NFTs:');
        console.log('Token ID | Owner Address | Case Number (if available)');
        console.log('---------|---------------|---------------------------');
        
        for (let tokenId = 1; tokenId <= totalSupply; tokenId++) {
            try {
                // Get owner of token
                const owner = await contract.ownerOf(tokenId).call();
                const ownerAddress = tronWeb.address.fromHex(owner);
                
                // Try to get token URI for metadata
                let caseNumber = null;
                try {
                    const uri = await contract.tokenURI(tokenId).call();
                    // Parse case number from URI if it contains it
                    if (uri && uri.includes('case')) {
                        const match = uri.match(/case[_-]?(\d+-\d+)/i);
                        if (match) caseNumber = match[1];
                    }
                } catch (e) {
                    // No tokenURI method or error
                }
                
                allNFTs.push({
                    tokenId: tokenId,
                    owner: ownerAddress,
                    caseNumber: caseNumber
                });
                
                console.log(`${tokenId.toString().padStart(8)} | ${ownerAddress} | ${caseNumber || 'Unknown'}`);
                
            } catch (e) {
                // Token doesn't exist or was burned
                if (!e.message.includes('nonexistent')) {
                    console.log(`${tokenId.toString().padStart(8)} | Error: ${e.message.substring(0, 50)}`);
                }
            }
        }
        
        // Also query Transfer events to get historical data
        console.log('\n\nQuerying Transfer events from blockchain:');
        console.log('===========================================');
        
        try {
            // Get contract creation transaction to find when it was deployed
            const contractInfo = await tronWeb.trx.getContract(contractAddress);
            console.log('Contract name:', contractInfo.name);
            
            // Query events - get all Transfer events
            const events = await tronWeb.event.getEventsByContractAddress(
                contractAddress,
                {
                    eventName: 'Transfer',
                    size: 200 // Get up to 200 events
                }
            );
            
            console.log(`\nFound ${events.length} Transfer events`);
            
            // Process events to find minting (from address 0)
            const mintEvents = events.filter(e => 
                e.result.from === '0x0000000000000000000000000000000000000000' ||
                e.result.from === 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb' // Null address on Tron
            );
            
            console.log(`Found ${mintEvents.length} minting events`);
            
            mintEvents.forEach(event => {
                const tokenId = event.result.tokenId;
                const to = tronWeb.address.fromHex(event.result.to);
                const blockNumber = event.block;
                const txHash = event.transaction;
                
                console.log(`\nMint Event:`);
                console.log(`  Token ID: ${tokenId}`);
                console.log(`  Minted to: ${to}`);
                console.log(`  Block: ${blockNumber}`);
                console.log(`  TX Hash: ${txHash}`);
                
                // Update our NFT list with this info
                const existing = allNFTs.find(n => n.tokenId == tokenId);
                if (existing) {
                    existing.mintTx = txHash;
                    existing.mintBlock = blockNumber;
                    existing.originalOwner = to;
                }
            });
            
        } catch (e) {
            console.log('Error querying events:', e.message);
        }
        
        // Summary
        console.log('\n========================================');
        console.log('SUMMARY');
        console.log('========================================\n');
        
        console.log(`Total NFTs found: ${allNFTs.length}`);
        
        // Group by owner
        const ownerGroups = {};
        allNFTs.forEach(nft => {
            if (!ownerGroups[nft.owner]) {
                ownerGroups[nft.owner] = [];
            }
            ownerGroups[nft.owner].push(nft.tokenId);
        });
        
        console.log(`\nNFTs by Owner:`);
        Object.entries(ownerGroups).forEach(([owner, tokenIds]) => {
            console.log(`  ${owner}: ${tokenIds.length} NFTs (IDs: ${tokenIds.join(', ')})`);
        });
        
        // Return data for database reconstruction
        return allNFTs;
        
    } catch (error) {
        console.error('Error querying blockchain:', error);
        return [];
    }
}

// Export for use in other scripts
module.exports = { queryAllNFTs };

// Run if called directly
if (require.main === module) {
    queryAllNFTs().then(nfts => {
        console.log('\nExporting data for database reconstruction...');
        console.log(JSON.stringify(nfts, null, 2));
    });
}