/**
 * QUICK ALERT STATUS CHECK
 * Check all Alert NFTs to see their current tokenURI status
 */

console.log('🔍 QUICK ALERT STATUS CHECK');
console.log('=' .repeat(50));

(async function() {
    const alertIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
    const results = [];
    
    for (const id of alertIds) {
        try {
            // Check if token exists
            await window.legalContract.ownerOf(id).call();
            
            // Get tokenURI
            const uri = await window.legalContract.tokenURI(id).call();
            
            let status = '';
            let displayStatus = '';
            
            if (!uri || uri === '') {
                status = 'EMPTY';
                displayStatus = '❌ Empty URI';
            } else if (uri.startsWith('data:application/json;base64,')) {
                status = 'BASE64';
                displayStatus = '✅ Base64 Data URI';
                
                // Try to decode and check image
                try {
                    const base64Data = uri.replace('data:application/json;base64,', '');
                    const metadata = JSON.parse(atob(base64Data));
                    if (metadata.image && metadata.image.startsWith('data:image')) {
                        displayStatus += ' (with image)';
                    } else {
                        displayStatus += ' (no embedded image)';
                    }
                } catch (e) {
                    displayStatus += ' (invalid)';
                }
            } else if (uri.startsWith('ipfs://')) {
                status = 'IPFS';
                displayStatus = '⚠️ IPFS';
            } else if (uri.startsWith('http')) {
                status = 'HTTP';
                displayStatus = '⚠️ HTTP';
            } else {
                status = 'UNKNOWN';
                displayStatus = '❓ Unknown';
            }
            
            results.push({
                'Alert #': id,
                'Status': displayStatus,
                'Shows in Wallet?': status === 'BASE64' ? 'YES ✅' : 'MAYBE ⚠️'
            });
            
        } catch (e) {
            results.push({
                'Alert #': id,
                'Status': '❌ Not minted',
                'Shows in Wallet?': 'NO ❌'
            });
        }
    }
    
    console.table(results);
    
    // Summary
    const base64Count = results.filter(r => r.Status.includes('Base64')).length;
    const emptyCount = results.filter(r => r.Status.includes('Empty')).length;
    const ipfsCount = results.filter(r => r.Status.includes('IPFS')).length;
    
    console.log('\n📊 SUMMARY:');
    console.log(`✅ Base64 Data URIs: ${base64Count}`);
    console.log(`❌ Empty URIs: ${emptyCount}`);
    console.log(`⚠️ IPFS URIs: ${ipfsCount}`);
    
    if (emptyCount > 0) {
        console.log('\n⚠️ ALERTS WITH EMPTY URIs NEED FIXING!');
        console.log('These will never display in wallets.');
    }
    
    window.alertStatusResults = results;
    console.log('\nResults saved to window.alertStatusResults');
})();