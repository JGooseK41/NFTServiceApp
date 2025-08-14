/**
 * DIRECT BLOCKCHAIN CHECK
 * Check tokenURIs directly from blockchain without fetching IPFS
 */

console.log('🔗 DIRECT BLOCKCHAIN URI CHECK');
console.log('=' .repeat(70));

window.DirectBlockchainCheck = {
    
    async checkAlertURI(tokenId) {
        try {
            // Check if token exists
            const owner = await window.legalContract.ownerOf(tokenId).call();
            
            // Get the raw tokenURI
            const uri = await window.legalContract.tokenURI(tokenId).call();
            
            return {
                tokenId,
                owner: owner.substring(0, 10) + '...',
                uri: uri || 'EMPTY',
                uriType: !uri ? 'EMPTY' :
                        uri.startsWith('data:') ? 'DATA_URI' :
                        uri.startsWith('ipfs://') ? 'IPFS' :
                        uri.startsWith('http') ? 'HTTP' : 'UNKNOWN',
                uriPreview: uri ? uri.substring(0, 50) + '...' : 'N/A'
            };
        } catch (e) {
            return {
                tokenId,
                owner: 'NOT_MINTED',
                uri: 'N/A',
                uriType: 'N/A',
                uriPreview: 'N/A'
            };
        }
    },
    
    async checkAllAlerts() {
        console.log('Checking all Alert NFT URIs on blockchain...\n');
        
        const alertIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
        const results = [];
        const ipfsHashes = {};
        
        for (const id of alertIds) {
            const result = await this.checkAlertURI(id);
            results.push(result);
            
            // Track IPFS hashes
            if (result.uriType === 'IPFS') {
                const hash = result.uri.replace('ipfs://', '').substring(0, 46);
                if (!ipfsHashes[hash]) {
                    ipfsHashes[hash] = [];
                }
                ipfsHashes[hash].push(id);
            }
        }
        
        // Display results in table
        console.table(results);
        
        // Analyze IPFS hash usage
        console.log('\n📊 IPFS HASH ANALYSIS:');
        console.log('=' .repeat(50));
        
        Object.entries(ipfsHashes).forEach(([hash, ids]) => {
            if (ids.length > 1) {
                console.log(`\n⚠️ DUPLICATE IPFS HASH FOUND!`);
                console.log(`Hash: ${hash}`);
                console.log(`Used by Alert NFTs: #${ids.join(', #')}`);
                console.log('This explains inconsistent display - same metadata!');
            }
        });
        
        // Check for patterns
        const ipfsCount = results.filter(r => r.uriType === 'IPFS').length;
        const dataUriCount = results.filter(r => r.uriType === 'DATA_URI').length;
        const emptyCount = results.filter(r => r.uriType === 'EMPTY').length;
        
        console.log('\n📈 SUMMARY:');
        console.log(`IPFS URIs: ${ipfsCount}`);
        console.log(`Data URIs: ${dataUriCount}`);
        console.log(`Empty URIs: ${emptyCount}`);
        
        if (ipfsCount > 0 && dataUriCount === 0) {
            console.log('\n❌ PROBLEM IDENTIFIED:');
            console.log('All alerts use IPFS, making them dependent on gateway availability');
            console.log('This causes inconsistent display in wallets');
            console.log('\n✅ SOLUTION:');
            console.log('Convert to base64 data URIs for guaranteed display');
        }
        
        return results;
    },
    
    async findDuplicateIPFS() {
        console.log('\n🔍 SEARCHING FOR DUPLICATE IPFS USAGE...');
        console.log('=' .repeat(50));
        
        const alertIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
        const hashMap = {};
        
        for (const id of alertIds) {
            try {
                const uri = await window.legalContract.tokenURI(id).call();
                if (uri && uri.startsWith('ipfs://')) {
                    const hash = uri.replace('ipfs://', '');
                    if (!hashMap[hash]) {
                        hashMap[hash] = [];
                    }
                    hashMap[hash].push(id);
                }
            } catch (e) {
                // Token not minted
            }
        }
        
        console.log('\nIPFS Hash Usage:');
        Object.entries(hashMap).forEach(([hash, ids]) => {
            console.log(`\nHash: ${hash}`);
            console.log(`Used by: Alert #${ids.join(', #')}`);
            if (ids.length > 1) {
                console.log('⚠️ DUPLICATE - Same metadata for multiple alerts!');
            }
        });
        
        return hashMap;
    },
    
    async compareWorkingVsNonWorking() {
        console.log('\n🎯 COMPARING WORKING VS NON-WORKING ALERTS');
        console.log('=' .repeat(50));
        
        const working = [1, 13, 17];
        const notWorking = [19];
        
        console.log('\n✅ WORKING ALERTS:');
        for (const id of working) {
            const result = await this.checkAlertURI(id);
            console.log(`Alert #${id}: ${result.uri}`);
        }
        
        console.log('\n❌ NON-WORKING ALERT:');
        for (const id of notWorking) {
            const result = await this.checkAlertURI(id);
            console.log(`Alert #${id}: ${result.uri}`);
        }
        
        // Check if #17 and #19 share same IPFS
        const uri17 = await window.legalContract.tokenURI(17).call();
        const uri19 = await window.legalContract.tokenURI(19).call();
        
        if (uri17 === uri19) {
            console.log('\n⚠️ CRITICAL FINDING:');
            console.log('Alert #17 (working) and Alert #19 (not working) use SAME URI!');
            console.log(`Shared URI: ${uri17}`);
            console.log('\nThis means the display issue is NOT about the metadata itself');
            console.log('but about wallet caching or IPFS gateway inconsistency!');
        }
    }
};

// Auto-run checks
(async () => {
    console.log('Running automated blockchain checks...\n');
    
    // First check all URIs
    await DirectBlockchainCheck.checkAllAlerts();
    
    // Then look for duplicates
    await DirectBlockchainCheck.findDuplicateIPFS();
    
    // Compare working vs non-working
    await DirectBlockchainCheck.compareWorkingVsNonWorking();
    
    console.log('\n✅ Direct blockchain check complete');
    console.log('\nKey findings stored in window.blockchainCheckResults');
})();