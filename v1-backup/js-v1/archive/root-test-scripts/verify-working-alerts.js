/**
 * VERIFY WHY WORKING ALERT NFTs ARE SUCCESSFUL
 * Analyze Alert #1, #13, #17 to understand their implementation
 */

console.log('🔍 VERIFYING WORKING ALERT NFTs IMPLEMENTATION');
console.log('=' .repeat(70));

window.VerifyWorkingAlerts = {
    
    async checkAlert(tokenId) {
        console.log(`\n📍 Checking Alert #${tokenId}`);
        console.log('-'.repeat(50));
        
        try {
            // 1. Check tokenURI
            const uri = await window.legalContract.tokenURI(tokenId).call();
            
            if (!uri) {
                console.log('❌ No URI set');
                return { tokenId, status: 'NO_URI' };
            }
            
            // 2. Analyze URI type
            if (uri.startsWith('data:application/json;base64,')) {
                console.log('✅ Using base64 data URI (BEST METHOD)');
                
                // Decode and check metadata
                try {
                    const base64Data = uri.replace('data:application/json;base64,', '');
                    const metadata = JSON.parse(atob(base64Data));
                    
                    console.log(`   Name: ${metadata.name}`);
                    console.log(`   Type: ${metadata.type || 'Alert NFT'}`);
                    
                    // Check image format
                    if (metadata.image) {
                        if (metadata.image.startsWith('data:image')) {
                            const imageSize = metadata.image.length;
                            console.log(`   ✅ Image: Base64 embedded (${(imageSize/1024).toFixed(1)} KB)`);
                            console.log('   ✅ NO EXTERNAL DEPENDENCIES - Will always display!');
                            return { 
                                tokenId, 
                                status: 'WORKING',
                                method: 'BASE64_DATA_URI',
                                imageSize: imageSize
                            };
                        } else if (metadata.image.startsWith('ipfs://')) {
                            console.log('   ⚠️ Image: IPFS reference (may fail if gateway down)');
                            return { 
                                tokenId, 
                                status: 'PARTIAL',
                                method: 'DATA_URI_WITH_IPFS_IMAGE'
                            };
                        } else {
                            console.log(`   ⚠️ Image: ${metadata.image.substring(0, 50)}`);
                            return { 
                                tokenId, 
                                status: 'PARTIAL',
                                method: 'DATA_URI_WITH_EXTERNAL_IMAGE'
                            };
                        }
                    } else {
                        console.log('   ❌ No image in metadata');
                        return { 
                            tokenId, 
                            status: 'NO_IMAGE',
                            method: 'DATA_URI_WITHOUT_IMAGE'
                        };
                    }
                } catch (e) {
                    console.log('   ❌ Invalid metadata:', e.message);
                    return { 
                        tokenId, 
                        status: 'INVALID_METADATA'
                    };
                }
                
            } else if (uri.startsWith('ipfs://')) {
                console.log('⚠️ Using IPFS (depends on gateway availability)');
                
                // Try to fetch from IPFS
                const ipfsHash = uri.replace('ipfs://', '');
                try {
                    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`, {
                        signal: AbortSignal.timeout(5000)
                    });
                    
                    if (response.ok) {
                        const metadata = await response.json();
                        console.log('   ✅ IPFS metadata accessible (for now)');
                        
                        if (metadata.image && metadata.image.startsWith('data:image')) {
                            console.log('   ✅ Has embedded base64 image');
                            return { 
                                tokenId, 
                                status: 'WORKING',
                                method: 'IPFS_WITH_BASE64_IMAGE'
                            };
                        } else {
                            console.log('   ⚠️ Image requires additional fetch');
                            return { 
                                tokenId, 
                                status: 'PARTIAL',
                                method: 'IPFS_WITH_EXTERNAL_IMAGE'
                            };
                        }
                    } else {
                        console.log('   ❌ IPFS not accessible');
                        return { 
                            tokenId, 
                            status: 'IPFS_DOWN'
                        };
                    }
                } catch (e) {
                    console.log('   ❌ IPFS timeout/error:', e.message);
                    return { 
                        tokenId, 
                        status: 'IPFS_ERROR'
                    };
                }
                
            } else if (uri.startsWith('http')) {
                console.log('⚠️ Using HTTP backend (depends on server)');
                return { 
                    tokenId, 
                    status: 'HTTP_BACKEND'
                };
            } else {
                console.log(`❓ Unknown URI format: ${uri.substring(0, 50)}`);
                return { 
                    tokenId, 
                    status: 'UNKNOWN_FORMAT'
                };
            }
            
        } catch (error) {
            console.log(`❌ Error checking token: ${error.message}`);
            return { 
                tokenId, 
                status: 'ERROR',
                error: error.message
            };
        }
    },
    
    async verifyAllWorkingAlerts() {
        console.log('\n🎯 VERIFYING ALL KNOWN WORKING ALERTS');
        console.log('=' .repeat(70));
        
        const workingAlerts = [1, 13, 17];  // The ones you confirmed are showing
        const results = [];
        
        for (const id of workingAlerts) {
            const result = await this.checkAlert(id);
            results.push(result);
        }
        
        // Also check the non-working one for comparison
        console.log('\n📊 CHECKING NON-WORKING ALERT FOR COMPARISON');
        const nonWorkingResult = await this.checkAlert(19);
        
        // Summary
        console.log('\n' + '=' .repeat(70));
        console.log('📋 SUMMARY OF FINDINGS');
        console.log('=' .repeat(70));
        
        const workingMethods = results.filter(r => r.status === 'WORKING');
        const partialMethods = results.filter(r => r.status === 'PARTIAL');
        
        console.log('\n✅ WORKING ALERTS:');
        workingMethods.forEach(r => {
            console.log(`   Alert #${r.tokenId}: ${r.method}`);
        });
        
        if (partialMethods.length > 0) {
            console.log('\n⚠️ PARTIALLY WORKING:');
            partialMethods.forEach(r => {
                console.log(`   Alert #${r.tokenId}: ${r.method}`);
            });
        }
        
        console.log('\n❌ NON-WORKING ALERT:');
        console.log(`   Alert #${nonWorkingResult.tokenId}: ${nonWorkingResult.status}`);
        
        // Recommendation
        console.log('\n' + '=' .repeat(70));
        console.log('💡 RECOMMENDATION');
        console.log('=' .repeat(70));
        
        if (workingMethods.every(r => r.method === 'BASE64_DATA_URI')) {
            console.log('✅ All working alerts use BASE64 DATA URIs');
            console.log('This is the BEST method - no external dependencies!');
            console.log('\nTo fix non-working alerts:');
            console.log('1. Generate base64 image from alert document');
            console.log('2. Embed image directly in metadata JSON');
            console.log('3. Encode entire metadata as base64 data URI');
            console.log('4. Set this data URI as tokenURI on blockchain');
        } else {
            console.log('⚠️ Working alerts use mixed methods');
            console.log('Recommend standardizing on BASE64_DATA_URI method');
        }
        
        return {
            working: results,
            nonWorking: nonWorkingResult
        };
    },
    
    // Quick check function
    async quickCheck() {
        console.log('\n🚀 QUICK CHECK OF ALERT STATUS');
        const alertIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
        const results = {};
        
        for (const id of alertIds) {
            try {
                const uri = await window.legalContract.tokenURI(id).call();
                if (uri && uri.startsWith('data:application/json;base64,')) {
                    results[id] = '✅ BASE64';
                } else if (uri && uri.startsWith('ipfs://')) {
                    results[id] = '⚠️ IPFS';
                } else if (uri && uri.startsWith('http')) {
                    results[id] = '⚠️ HTTP';
                } else if (uri) {
                    results[id] = '❓ OTHER';
                } else {
                    results[id] = '❌ NO URI';
                }
            } catch (e) {
                results[id] = '❌ ERROR';
            }
        }
        
        console.table(results);
        return results;
    }
};

// Auto-run verification
console.log('Starting automatic verification...\n');
VerifyWorkingAlerts.verifyAllWorkingAlerts().then(results => {
    console.log('\n✅ Verification complete');
    console.log('Results stored in window.alertVerificationResults');
    window.alertVerificationResults = results;
    
    console.log('\nAvailable commands:');
    console.log('  VerifyWorkingAlerts.checkAlert(13)        - Check specific alert');
    console.log('  VerifyWorkingAlerts.quickCheck()           - Quick status of all alerts');
    console.log('  VerifyWorkingAlerts.verifyAllWorkingAlerts() - Full verification');
});