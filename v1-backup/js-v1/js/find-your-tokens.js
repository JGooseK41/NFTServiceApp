/**
 * Find Your Actual Token IDs
 * Helps identify which tokens belong to you
 */

async function findYourTokens() {
    console.log('\n🔍 FINDING YOUR TOKENS\n' + '='.repeat(50));
    
    const yourWallet = window.tronWeb.defaultAddress.base58;
    console.log('Your wallet:', yourWallet);
    console.log('');
    
    const contract = window.legalContract;
    if (!contract) {
        console.error('Contract not initialized');
        return;
    }
    
    const yourTokens = {
        alerts: [],
        documents: []
    };
    
    try {
        // Get total supply
        const totalSupply = await contract.totalSupply().call();
        const total = Number(totalSupply.toString());
        console.log('Total tokens minted:', total);
        console.log('Checking tokens...\n');
        
        // Check each token
        for (let i = 1; i <= Math.min(total, 100); i++) {
            try {
                const owner = await contract.ownerOf(i).call();
                const ownerAddress = tronWeb.address.fromHex(owner);
                
                if (ownerAddress.toLowerCase() === yourWallet.toLowerCase()) {
                    // This is your token
                    const isAlert = i % 2 !== 0;
                    
                    if (isAlert) {
                        yourTokens.alerts.push(i);
                        console.log(`✅ Token #${i} - YOUR ALERT NFT`);
                    } else {
                        yourTokens.documents.push(i);
                        console.log(`✅ Token #${i} - YOUR DOCUMENT NFT`);
                    }
                    
                    // Get more details
                    try {
                        const tokenURI = await contract.tokenURI(i).call();
                        if (tokenURI.startsWith('data:')) {
                            const [header, data] = tokenURI.split(',');
                            if (header.includes('base64')) {
                                const decoded = atob(data);
                                const metadata = JSON.parse(decoded);
                                console.log(`   Name: ${metadata.name}`);
                                console.log(`   Has Image: ${metadata.image ? 'Yes' : 'No'}`);
                                console.log(`   Has Description: ${metadata.description ? 'Yes (' + metadata.description.length + ' chars)' : 'No'}`);
                            }
                        }
                    } catch (e) {
                        console.log('   Could not parse metadata');
                    }
                    
                    console.log('');
                }
            } catch (e) {
                // Token doesn't exist
                break;
            }
        }
        
        // Summary
        console.log('='.repeat(50));
        console.log('SUMMARY:');
        console.log(`Found ${yourTokens.alerts.length} Alert NFTs:`, yourTokens.alerts);
        console.log(`Found ${yourTokens.documents.length} Document NFTs:`, yourTokens.documents);
        
        // Check specific case
        console.log('\n🔍 CHECKING CASE 34-2501-8285700:');
        
        // The alert/document pair for this case should be around 943220201-943220202
        // Let's check a range
        const checkRange = [943220200, 943220201, 943220202, 943220203, 943220204];
        
        for (const tokenId of checkRange) {
            try {
                const exists = await contract.tokenURI(tokenId).call();
                if (exists) {
                    const owner = await contract.ownerOf(tokenId).call();
                    const ownerAddr = tronWeb.address.fromHex(owner);
                    const isYours = ownerAddr.toLowerCase() === yourWallet.toLowerCase();
                    console.log(`Token #${tokenId}: EXISTS (Owner: ${isYours ? 'YOU' : ownerAddr.substring(0, 10) + '...'})`);
                }
            } catch (e) {
                console.log(`Token #${tokenId}: Does not exist`);
            }
        }
        
        // Provide diagnostic commands
        console.log('\n📋 RUN THESE COMMANDS FOR YOUR TOKENS:');
        if (yourTokens.alerts.length > 0) {
            console.log(`\nFor Alert NFTs:`);
            yourTokens.alerts.forEach(id => {
                console.log(`  checkToken(${id})`);
            });
        }
        if (yourTokens.documents.length > 0) {
            console.log(`\nFor Document NFTs:`);
            yourTokens.documents.forEach(id => {
                console.log(`  checkToken(${id})`);
            });
        }
        
    } catch (error) {
        console.error('Error finding tokens:', error);
    }
}

// Auto-run on load
window.findMyTokens = findYourTokens;

console.log('🔍 Token Finder Loaded!');
console.log('Run: findMyTokens() to find all your NFTs');