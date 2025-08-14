/**
 * DEBUG ALERT NFTs SPECIFICALLY
 * Figure out why Alert #1 shows image but others don't
 */

console.log('🔍 Debugging Alert NFT display issues...');

window.DebugAlertNFTs = {
    
    // Compare Alert #1 with other Alerts
    async compareAlerts() {
        console.log('\n' + '='.repeat(70));
        console.log('🔍 COMPARING ALERT NFTs');
        console.log('='.repeat(70));
        
        const alertIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
        const results = [];
        
        for (const id of alertIds) {
            try {
                console.log(`\n📍 Alert NFT #${id}:`);
                
                // Get URI
                const uri = await window.legalContract.tokenURI(id).call();
                
                if (!uri) {
                    console.log('   ❌ NO URI');
                    results.push({ id, hasURI: false });
                    continue;
                }
                
                console.log(`   ✅ Has URI: ${uri.substring(0, 60)}...`);
                
                // Parse metadata
                let metadata;
                let fetchSuccess = false;
                
                if (uri.startsWith('ipfs://')) {
                    const ipfsHash = uri.replace('ipfs://', '');
                    console.log(`   IPFS Hash: ${ipfsHash}`);
                    
                    // Try to fetch
                    try {
                        const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
                        const response = await fetch(url);
                        
                        if (response.ok) {
                            const text = await response.text();
                            
                            // Check if HTML or JSON
                            if (text.trim().startsWith('<')) {
                                console.log('   ❌ IPFS returns HTML (404 or error)');
                                fetchSuccess = false;
                            } else {
                                metadata = JSON.parse(text);
                                fetchSuccess = true;
                                console.log('   ✅ IPFS metadata fetched successfully');
                            }
                        } else {
                            console.log(`   ❌ IPFS fetch failed: ${response.status}`);
                        }
                    } catch (e) {
                        console.log('   ❌ IPFS fetch error:', e.message);
                    }
                    
                } else if (uri.startsWith('data:')) {
                    try {
                        const base64 = uri.split(',')[1];
                        metadata = JSON.parse(atob(base64));
                        fetchSuccess = true;
                        console.log('   ✅ Data URI parsed successfully');
                    } catch (e) {
                        console.log('   ❌ Data URI parse error:', e.message);
                    }
                }
                
                // Check metadata contents
                if (metadata) {
                    console.log(`   Name: ${metadata.name}`);
                    console.log(`   Image: ${metadata.image ? metadata.image.substring(0, 60) + '...' : '❌ NO IMAGE'}`);
                    
                    // Check if image is accessible
                    if (metadata.image) {
                        if (metadata.image.startsWith('ipfs://')) {
                            const imageHash = metadata.image.replace('ipfs://', '');
                            const imageUrl = `https://gateway.pinata.cloud/ipfs/${imageHash}`;
                            
                            try {
                                const imgResponse = await fetch(imageUrl, { method: 'HEAD' });
                                if (imgResponse.ok) {
                                    console.log('   ✅ Image accessible');
                                } else {
                                    console.log(`   ❌ Image not accessible: ${imgResponse.status}`);
                                }
                            } catch (e) {
                                console.log('   ❌ Image fetch failed');
                            }
                            
                        } else if (metadata.image.startsWith('data:image')) {
                            console.log('   ✅ Image is base64 data URI');
                        } else if (metadata.image.startsWith('http')) {
                            try {
                                const imgResponse = await fetch(metadata.image, { method: 'HEAD' });
                                if (imgResponse.ok) {
                                    console.log('   ✅ Image URL accessible');
                                } else {
                                    console.log(`   ❌ Image URL not accessible: ${imgResponse.status}`);
                                }
                            } catch (e) {
                                console.log('   ❌ Image URL fetch failed');
                            }
                        }
                    }
                }
                
                results.push({
                    id,
                    hasURI: true,
                    fetchSuccess,
                    hasImage: metadata?.image ? true : false,
                    uriType: uri.startsWith('ipfs://') ? 'IPFS' : 'DataURI'
                });
                
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                results.push({ id, error: error.message });
            }
        }
        
        // Summary
        console.log('\n' + '='.repeat(70));
        console.log('SUMMARY:');
        console.log('='.repeat(70));
        
        const working = results.filter(r => r.fetchSuccess && r.hasImage);
        const hasURIButNoFetch = results.filter(r => r.hasURI && !r.fetchSuccess);
        const noImage = results.filter(r => r.fetchSuccess && !r.hasImage);
        
        console.log(`✅ Working (metadata + image): ${working.map(r => '#' + r.id).join(', ') || 'none'}`);
        console.log(`⚠️ Has URI but can't fetch: ${hasURIButNoFetch.map(r => '#' + r.id).join(', ') || 'none'}`);
        console.log(`⚠️ Metadata OK but no image: ${noImage.map(r => '#' + r.id).join(', ') || 'none'}`);
        
        // Check for patterns
        console.log('\n📊 URI Type Analysis:');
        const ipfsTokens = results.filter(r => r.uriType === 'IPFS');
        const dataTokens = results.filter(r => r.uriType === 'DataURI');
        
        console.log(`IPFS URIs: ${ipfsTokens.map(r => '#' + r.id).join(', ')}`);
        console.log(`Data URIs: ${dataTokens.map(r => '#' + r.id).join(', ')}`);
        
        if (working.length === 1 && working[0].id === 1) {
            console.log('\n🔍 FINDING: Only Alert #1 works!');
            console.log('Possible reasons:');
            console.log('1. Alert #1 metadata/image is stored differently');
            console.log('2. Other Alerts have expired IPFS pins');
            console.log('3. Other Alerts have incorrect metadata structure');
        }
    },
    
    // Check specific Alert in detail
    async checkAlert(alertId) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`Detailed check of Alert #${alertId}`);
        console.log('='.repeat(70));
        
        try {
            // Get owner
            const owner = await window.legalContract.ownerOf(alertId).call();
            console.log('Owner:', owner);
            
            // Get URI
            const uri = await window.legalContract.tokenURI(alertId).call();
            console.log('URI:', uri);
            
            // Get the actual notice data
            const notice = await window.legalContract.alertNotices(alertId).call();
            console.log('Notice data:', notice);
            
            // Fetch and display metadata
            if (uri) {
                if (uri.startsWith('ipfs://')) {
                    const hash = uri.replace('ipfs://', '');
                    console.log('\nTrying IPFS gateways:');
                    
                    const gateways = [
                        'https://gateway.pinata.cloud/ipfs/',
                        'https://ipfs.io/ipfs/',
                        'https://cloudflare-ipfs.com/ipfs/'
                    ];
                    
                    for (const gateway of gateways) {
                        try {
                            console.log(`  ${gateway}${hash}`);
                            const response = await fetch(gateway + hash);
                            if (response.ok) {
                                const metadata = await response.json();
                                console.log('  ✅ Success! Metadata:', metadata);
                                break;
                            } else {
                                console.log(`  ❌ Failed: ${response.status}`);
                            }
                        } catch (e) {
                            console.log(`  ❌ Error: ${e.message}`);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('Error checking alert:', error);
        }
    },
    
    // Fix metadata for broken Alerts
    async proposefix(alertId) {
        console.log(`\n🔧 Proposing fix for Alert #${alertId}...`);
        
        const uri = await window.legalContract.tokenURI(alertId).call();
        
        if (!uri) {
            console.log('❌ No URI set - needs contract transaction to fix');
            return;
        }
        
        if (uri.startsWith('ipfs://')) {
            const hash = uri.replace('ipfs://', '');
            console.log('Current IPFS hash:', hash);
            console.log('\nPossible fixes:');
            console.log('1. Re-pin to IPFS (current pin may have expired)');
            console.log('2. Use data URI instead of IPFS');
            console.log('3. Host metadata on your backend');
            
            // Try to get the metadata and re-upload
            console.log('\nAttempting to recover and re-upload...');
            
            // Create new metadata with working image
            const newMetadata = {
                name: `Legal Alert #${alertId}`,
                description: `Legal notice delivered via blockchain`,
                image: "https://nft-legal-service.netlify.app/images/legal-notice-nft.png", // Use hosted image
                external_url: "https://www.blockserved.com",
                attributes: [
                    { trait_type: "Token ID", value: alertId.toString() },
                    { trait_type: "Type", value: "Alert NFT" }
                ]
            };
            
            // Create data URI
            const dataURI = 'data:application/json;base64,' + btoa(JSON.stringify(newMetadata));
            console.log('\nNew metadata as data URI:');
            console.log(dataURI);
            console.log('\n⚠️ Note: To fix on-chain, contract owner needs to call setTokenURI');
        }
    }
};

// Auto-run comparison
console.log('Running automatic Alert NFT comparison...');
DebugAlertNFTs.compareAlerts();

console.log('\n✅ Alert NFT debugger loaded');
console.log('Commands:');
console.log('  DebugAlertNFTs.compareAlerts()    - Compare all Alert NFTs');
console.log('  DebugAlertNFTs.checkAlert(3)      - Detailed check of specific Alert');
console.log('  DebugAlertNFTs.proposefix(3)      - Propose fix for broken Alert');