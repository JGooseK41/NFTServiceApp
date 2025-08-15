/**
 * DIAGNOSE ALERT NFT DISPLAY DIFFERENCES
 * Why does #13 show but #19 doesn't?
 */

console.log('🔍 Diagnosing Alert NFT display differences...');

window.DiagnoseAlertDisplay = {
    
    // Compare Alert #13 and #19
    async compareAlerts() {
        console.log('\n' + '='.repeat(70));
        console.log('COMPARING ALERT #13 (shows) vs #19 (doesn\'t show)');
        console.log('='.repeat(70));
        
        const results = {};
        
        // Check Alert #13
        console.log('\n📍 Alert #13 (SHOWS IN WALLET):');
        results[13] = await this.checkAlert(13);
        
        // Check Alert #19
        console.log('\n📍 Alert #19 (DOESN\'T SHOW):');
        results[19] = await this.checkAlert(19);
        
        // Compare results
        console.log('\n' + '='.repeat(70));
        console.log('COMPARISON RESULTS:');
        console.log('='.repeat(70));
        
        // URI comparison
        console.log('\n1. TOKEN URI:');
        console.log(`   #13: ${results[13].uri ? '✅ Has URI' : '❌ No URI'}`);
        console.log(`   #19: ${results[19].uri ? '✅ Has URI' : '❌ No URI'}`);
        
        if (results[13].uri && results[19].uri) {
            console.log(`   #13 Type: ${results[13].uriType}`);
            console.log(`   #19 Type: ${results[19].uriType}`);
        }
        
        // Metadata comparison
        console.log('\n2. METADATA:');
        console.log(`   #13: ${results[13].metadataAccessible ? '✅ Accessible' : '❌ Not accessible'}`);
        console.log(`   #19: ${results[19].metadataAccessible ? '✅ Accessible' : '❌ Not accessible'}`);
        
        // Image comparison
        console.log('\n3. IMAGE:');
        console.log(`   #13: ${results[13].hasImage ? '✅ Has image' : '❌ No image'}`);
        console.log(`   #19: ${results[19].hasImage ? '✅ Has image' : '❌ No image'}`);
        
        if (results[13].hasImage && results[19].hasImage) {
            console.log(`   #13 Image accessible: ${results[13].imageAccessible ? '✅' : '❌'}`);
            console.log(`   #19 Image accessible: ${results[19].imageAccessible ? '✅' : '❌'}`);
        }
        
        // Owner comparison
        console.log('\n4. OWNERSHIP:');
        console.log(`   #13 Owner: ${results[13].owner || 'Unknown'}`);
        console.log(`   #19 Owner: ${results[19].owner || 'Unknown'}`);
        
        // Transaction comparison
        console.log('\n5. MINTING DETAILS:');
        if (results[13].mintData && results[19].mintData) {
            console.log(`   #13 Case: ${results[13].mintData.caseNumber || 'N/A'}`);
            console.log(`   #19 Case: ${results[19].mintData.caseNumber || 'N/A'}`);
        }
        
        // Diagnosis
        console.log('\n' + '='.repeat(70));
        console.log('🔍 DIAGNOSIS:');
        console.log('='.repeat(70));
        
        if (results[13].uri && !results[19].uri) {
            console.log('❌ #19 has NO URI set - this is why it doesn\'t show!');
            console.log('Solution: Set tokenURI for #19');
        } else if (results[13].metadataAccessible && !results[19].metadataAccessible) {
            console.log('❌ #19\'s metadata is not accessible (IPFS expired?)');
            console.log('Solution: Re-upload metadata or use data URI');
        } else if (results[13].imageAccessible && !results[19].imageAccessible) {
            console.log('❌ #19\'s image is not accessible');
            console.log('Solution: Fix image hosting');
        } else if (results[13].uri === results[19].uri) {
            console.log('⚠️ Both have same URI - might be wallet caching issue');
            console.log('Solution: Clear wallet cache and refresh');
        } else {
            console.log('⚠️ Unknown difference - check wallet-specific display rules');
        }
        
        return results;
    },
    
    // Check individual Alert
    async checkAlert(alertId) {
        const result = {
            id: alertId,
            uri: null,
            uriType: null,
            metadataAccessible: false,
            hasImage: false,
            imageAccessible: false,
            owner: null,
            mintData: null
        };
        
        try {
            // Get owner
            const owner = await window.legalContract.ownerOf(alertId).call();
            result.owner = owner;
            console.log(`   Owner: ${owner}`);
            
            // Get URI
            const uri = await window.legalContract.tokenURI(alertId).call();
            
            if (!uri) {
                console.log('   ❌ No URI set');
                return result;
            }
            
            result.uri = uri;
            console.log(`   URI: ${uri.substring(0, 60)}...`);
            
            // Determine URI type
            if (uri.startsWith('ipfs://')) {
                result.uriType = 'IPFS';
                
                // Check if accessible
                const hash = uri.replace('ipfs://', '');
                try {
                    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`);
                    
                    if (response.ok) {
                        const text = await response.text();
                        
                        if (!text.startsWith('<')) {
                            result.metadataAccessible = true;
                            const metadata = JSON.parse(text);
                            
                            console.log(`   ✅ Metadata accessible: "${metadata.name}"`);
                            
                            if (metadata.image) {
                                result.hasImage = true;
                                
                                // Check image
                                if (metadata.image.startsWith('ipfs://')) {
                                    const imgHash = metadata.image.replace('ipfs://', '');
                                    try {
                                        const imgResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${imgHash}`, {
                                            method: 'HEAD'
                                        });
                                        result.imageAccessible = imgResponse.ok;
                                    } catch (e) {
                                        // Image not accessible
                                    }
                                }
                                
                                console.log(`   Image: ${result.imageAccessible ? '✅ Accessible' : '❌ Not accessible'}`);
                            } else {
                                console.log('   ❌ No image in metadata');
                            }
                        } else {
                            console.log('   ❌ IPFS returns HTML (404)');
                        }
                    } else {
                        console.log(`   ❌ IPFS fetch failed: ${response.status}`);
                    }
                } catch (e) {
                    console.log('   ❌ IPFS error:', e.message);
                }
                
            } else if (uri.startsWith('data:')) {
                result.uriType = 'DataURI';
                
                try {
                    const base64 = uri.split(',')[1];
                    const metadata = JSON.parse(atob(base64));
                    
                    result.metadataAccessible = true;
                    console.log(`   ✅ Data URI metadata: "${metadata.name}"`);
                    
                    if (metadata.image) {
                        result.hasImage = true;
                        result.imageAccessible = true; // Data URIs are always accessible
                        console.log('   ✅ Has image (data URI)');
                    }
                } catch (e) {
                    console.log('   ❌ Invalid data URI');
                }
            }
            
            // Get mint data
            try {
                const notice = await window.legalContract.alertNotices(alertId).call();
                result.mintData = {
                    caseNumber: notice.caseNumber,
                    recipient: notice.recipient,
                    timestamp: notice.timestamp
                };
                console.log(`   Case: ${notice.caseNumber || 'N/A'}`);
            } catch (e) {
                // No mint data
            }
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        return result;
    },
    
    // Quick fix for #19
    async quickFix19() {
        console.log('\n🔧 QUICK FIX FOR ALERT #19');
        console.log('=' .repeat(70));
        
        // Check current state
        const uri = await window.legalContract.tokenURI(19).call();
        
        if (!uri) {
            console.log('❌ Alert #19 has no URI');
            console.log('Creating metadata...');
            
            // Create metadata
            const metadata = {
                name: "Legal Alert #19",
                description: "You have received this token as notice of a pending investigation/legal matter concerning this wallet address.",
                image: "https://nft-legal-service.netlify.app/images/alert-nft-thumbnail.png",
                external_url: "https://www.blockserved.com",
                attributes: [
                    { trait_type: "Token ID", value: "19" },
                    { trait_type: "Type", value: "Legal Alert" },
                    { trait_type: "Status", value: "Active" }
                ]
            };
            
            // Create data URI
            const dataURI = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
            
            console.log('\n✅ Metadata created:');
            console.log(dataURI);
            
            console.log('\n📝 TO FIX ON-CHAIN:');
            console.log('Contract owner must execute:');
            console.log(`contract.setTokenURI(19, "${dataURI}")`);
            
        } else {
            console.log('Alert #19 has URI:', uri.substring(0, 60) + '...');
            
            // Check if it's accessible
            const result = await this.checkAlert(19);
            
            if (!result.metadataAccessible) {
                console.log('⚠️ Metadata not accessible, creating fallback...');
                
                // Create fallback
                const metadata = {
                    name: "Legal Alert #19",
                    description: "You have received this token as notice of a pending investigation/legal matter concerning this wallet address.",
                    image: "https://nft-legal-service.netlify.app/images/alert-nft-thumbnail.png",
                    external_url: "https://www.blockserved.com",
                    attributes: [
                        { trait_type: "Token ID", value: "19" },
                        { trait_type: "Type", value: "Legal Alert" }
                    ]
                };
                
                const dataURI = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
                
                console.log('\n✅ Fallback metadata created');
                console.log('Replace existing URI with:');
                console.log(dataURI);
            }
        }
    }
};

// Auto-run comparison
console.log('Running automatic comparison of Alert #13 vs #19...');
DiagnoseAlertDisplay.compareAlerts();

console.log('\n✅ Diagnostic loaded');
console.log('Commands:');
console.log('  DiagnoseAlertDisplay.compareAlerts()  - Compare #13 and #19');
console.log('  DiagnoseAlertDisplay.checkAlert(19)   - Check specific Alert');
console.log('  DiagnoseAlertDisplay.quickFix19()     - Generate fix for #19');