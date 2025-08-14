/**
 * ANALYZE IPFS ALERTS
 * Check which IPFS-based alerts are working and why
 */

console.log('🔍 ANALYZING IPFS-BASED ALERT NFTs');
console.log('=' .repeat(70));

window.AnalyzeIPFSAlerts = {
    
    async checkIPFSAlert(tokenId) {
        console.log(`\n📍 Checking Alert #${tokenId}`);
        console.log('-'.repeat(50));
        
        try {
            const uri = await window.legalContract.tokenURI(tokenId).call();
            
            if (!uri || !uri.startsWith('ipfs://')) {
                console.log('Not an IPFS URI');
                return { tokenId, status: 'NOT_IPFS' };
            }
            
            const ipfsHash = uri.replace('ipfs://', '');
            console.log(`IPFS Hash: ${ipfsHash}`);
            
            // Try to fetch from IPFS
            try {
                const response = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`, {
                    signal: AbortSignal.timeout(10000)
                });
                
                if (!response.ok) {
                    console.log('❌ IPFS not accessible');
                    return { 
                        tokenId, 
                        status: 'IPFS_DOWN',
                        ipfsHash 
                    };
                }
                
                const metadata = await response.json();
                console.log('✅ IPFS metadata fetched successfully');
                console.log(`Name: ${metadata.name}`);
                console.log(`Description: ${metadata.description?.substring(0, 50)}...`);
                
                // Check the image field
                let imageStatus = 'NO_IMAGE';
                let imageAccessible = false;
                
                if (metadata.image) {
                    if (metadata.image.startsWith('data:image')) {
                        imageStatus = 'BASE64_EMBEDDED';
                        imageAccessible = true;
                        const imageSize = metadata.image.length;
                        console.log(`✅ Image: Base64 embedded (${(imageSize/1024).toFixed(1)} KB)`);
                        console.log('✅ This should display in wallets!');
                        
                    } else if (metadata.image.startsWith('ipfs://')) {
                        imageStatus = 'IPFS_IMAGE';
                        const imageHash = metadata.image.replace('ipfs://', '');
                        console.log(`⚠️ Image: Separate IPFS hash: ${imageHash}`);
                        
                        // Check if image is accessible
                        try {
                            const imgResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${imageHash}`, {
                                method: 'HEAD',
                                signal: AbortSignal.timeout(5000)
                            });
                            if (imgResponse.ok) {
                                imageAccessible = true;
                                console.log('✅ IPFS image is accessible');
                            } else {
                                console.log('❌ IPFS image not accessible');
                            }
                        } catch (e) {
                            console.log('❌ IPFS image timeout');
                        }
                        
                    } else if (metadata.image.startsWith('http')) {
                        imageStatus = 'HTTP_IMAGE';
                        console.log(`⚠️ Image: HTTP URL: ${metadata.image}`);
                        
                        // Check if accessible
                        try {
                            const imgResponse = await fetch(metadata.image, {
                                method: 'HEAD',
                                signal: AbortSignal.timeout(5000)
                            });
                            if (imgResponse.ok) {
                                imageAccessible = true;
                                console.log('✅ HTTP image is accessible');
                            } else {
                                console.log('❌ HTTP image not accessible');
                            }
                        } catch (e) {
                            console.log('❌ HTTP image error');
                        }
                    }
                } else {
                    console.log('❌ No image in metadata');
                }
                
                return {
                    tokenId,
                    status: 'IPFS_WORKING',
                    ipfsHash,
                    imageStatus,
                    imageAccessible,
                    metadata: {
                        name: metadata.name,
                        hasImage: !!metadata.image,
                        imageType: imageStatus
                    }
                };
                
            } catch (error) {
                console.log('❌ IPFS fetch error:', error.message);
                return {
                    tokenId,
                    status: 'IPFS_ERROR',
                    ipfsHash,
                    error: error.message
                };
            }
            
        } catch (error) {
            console.log('❌ Contract error:', error.message);
            return {
                tokenId,
                status: 'ERROR',
                error: error.message
            };
        }
    },
    
    async analyzeAllAlerts() {
        console.log('\n' + '=' .repeat(70));
        console.log('CHECKING ALL ALERT NFTs');
        console.log('=' .repeat(70));
        
        const knownWorking = [1, 13, 17];  // You said these show in wallet
        const knownNotWorking = [19];      // You said this doesn't show
        const allAlerts = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
        
        const results = [];
        
        // Check all alerts
        for (const id of allAlerts) {
            const result = await this.checkIPFSAlert(id);
            result.showsInWallet = knownWorking.includes(id) ? 'YES' : 
                                   knownNotWorking.includes(id) ? 'NO' : 'UNKNOWN';
            results.push(result);
        }
        
        // Analysis
        console.log('\n' + '=' .repeat(70));
        console.log('📊 ANALYSIS RESULTS');
        console.log('=' .repeat(70));
        
        const working = results.filter(r => r.showsInWallet === 'YES');
        const notWorking = results.filter(r => r.showsInWallet === 'NO');
        
        console.log('\n✅ ALERTS THAT SHOW IN WALLET:');
        working.forEach(r => {
            console.log(`Alert #${r.tokenId}:`);
            console.log(`  - IPFS Status: ${r.status}`);
            console.log(`  - Image Type: ${r.imageStatus}`);
            console.log(`  - Image Accessible: ${r.imageAccessible}`);
        });
        
        console.log('\n❌ ALERTS THAT DON\'T SHOW:');
        notWorking.forEach(r => {
            console.log(`Alert #${r.tokenId}:`);
            console.log(`  - IPFS Status: ${r.status}`);
            console.log(`  - Image Type: ${r.imageStatus}`);
            console.log(`  - Image Accessible: ${r.imageAccessible}`);
        });
        
        // Find the pattern
        console.log('\n🔍 PATTERN DETECTION:');
        
        const workingWithBase64 = working.filter(r => r.imageStatus === 'BASE64_EMBEDDED');
        const workingWithIPFSImage = working.filter(r => r.imageStatus === 'IPFS_IMAGE');
        const notWorkingReasons = notWorking.map(r => ({
            id: r.tokenId,
            reason: r.status === 'IPFS_DOWN' ? 'IPFS not accessible' :
                    !r.imageAccessible ? 'Image not accessible' :
                    r.imageStatus === 'NO_IMAGE' ? 'No image in metadata' :
                    'Unknown'
        }));
        
        if (workingWithBase64.length === working.length) {
            console.log('✅ All working alerts have BASE64 EMBEDDED images in IPFS metadata');
            console.log('This is why they display - the image is embedded!');
        } else if (workingWithIPFSImage.length > 0) {
            console.log('⚠️ Some working alerts use separate IPFS images');
            console.log('These may stop working if IPFS gateway changes');
        }
        
        console.log('\n❌ Non-working alerts fail because:');
        notWorkingReasons.forEach(r => {
            console.log(`  Alert #${r.id}: ${r.reason}`);
        });
        
        console.log('\n💡 RECOMMENDATION:');
        console.log('Convert all Alert NFTs to use base64 data URIs instead of IPFS');
        console.log('This removes all external dependencies and ensures display');
        
        return results;
    },
    
    // Quick function to check specific alerts you mentioned
    async checkKnownAlerts() {
        console.log('\n🎯 CHECKING SPECIFIC ALERTS YOU MENTIONED');
        console.log('=' .repeat(70));
        
        console.log('\nAlerts that show in wallet: #1, #13, #17');
        await this.checkIPFSAlert(1);
        await this.checkIPFSAlert(13);
        await this.checkIPFSAlert(17);
        
        console.log('\nAlert that doesn\'t show: #19');
        await this.checkIPFSAlert(19);
    }
};

// Auto-run check on known alerts
console.log('Starting analysis of IPFS-based alerts...\n');
AnalyzeIPFSAlerts.checkKnownAlerts().then(() => {
    console.log('\n✅ Analysis complete');
    console.log('\nRun AnalyzeIPFSAlerts.analyzeAllAlerts() for full analysis');
});