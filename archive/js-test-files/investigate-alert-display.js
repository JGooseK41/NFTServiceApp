/**
 * INVESTIGATE ALERT NFT DISPLAY ISSUE
 * Alert #13 shows, Alert #19 doesn't
 * This script will diagnose the exact problem
 */

console.log('🔍 Starting Alert NFT display investigation...');

// Wait for contract to be available
(async function() {
    // Wait for TronWeb and contract
    let attempts = 0;
    while ((!window.tronWeb || !window.legalContract) && attempts < 20) {
        console.log('Waiting for TronWeb and contract...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    }
    
    if (!window.legalContract) {
        console.error('❌ Contract not loaded. Please connect wallet first.');
        return;
    }
    
    console.log('✅ Contract loaded, starting investigation...');
    
    // Investigation functions
    window.InvestigateAlerts = {
        
        // Check what's actually on-chain for these tokens
        async checkOnChain() {
            console.log('\n' + '='.repeat(70));
            console.log('CHECKING ON-CHAIN DATA');
            console.log('='.repeat(70));
            
            const alertsToCheck = [1, 13, 19];
            const results = {};
            
            for (const id of alertsToCheck) {
                console.log(`\n📍 Alert NFT #${id}:`);
                results[id] = {};
                
                try {
                    // Check if token exists
                    const owner = await window.legalContract.ownerOf(id).call();
                    results[id].exists = true;
                    results[id].owner = owner;
                    console.log(`   Owner: ${owner}`);
                    
                    // Check tokenURI
                    const uri = await window.legalContract.tokenURI(id).call();
                    results[id].uri = uri || null;
                    
                    if (!uri || uri === '' || uri === 'undefined') {
                        console.log('   ❌ NO URI SET - This NFT won\'t display!');
                    } else {
                        console.log(`   ✅ Has URI: ${uri.substring(0, 60)}...`);
                        
                        // Check URI type and accessibility
                        if (uri.startsWith('ipfs://')) {
                            results[id].uriType = 'IPFS';
                            const hash = uri.replace('ipfs://', '');
                            console.log(`   IPFS Hash: ${hash}`);
                            
                            // Try to fetch
                            try {
                                const response = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`);
                                if (response.ok) {
                                    const text = await response.text();
                                    if (text.startsWith('<')) {
                                        console.log('   ❌ IPFS returns HTML (404) - metadata lost!');
                                        results[id].metadataAccessible = false;
                                    } else {
                                        const metadata = JSON.parse(text);
                                        console.log(`   ✅ Metadata accessible: "${metadata.name}"`);
                                        results[id].metadataAccessible = true;
                                        results[id].metadata = metadata;
                                        
                                        // Check image
                                        if (metadata.image) {
                                            console.log(`   Image: ${metadata.image.substring(0, 50)}...`);
                                            results[id].hasImage = true;
                                        } else {
                                            console.log('   ❌ No image in metadata');
                                            results[id].hasImage = false;
                                        }
                                    }
                                } else {
                                    console.log(`   ❌ IPFS fetch failed: HTTP ${response.status}`);
                                    results[id].metadataAccessible = false;
                                }
                            } catch (e) {
                                console.log('   ❌ Error fetching IPFS:', e.message);
                                results[id].metadataAccessible = false;
                            }
                        } else if (uri.startsWith('data:')) {
                            results[id].uriType = 'DataURI';
                            try {
                                const base64 = uri.split(',')[1];
                                const metadata = JSON.parse(atob(base64));
                                console.log(`   ✅ Data URI metadata: "${metadata.name}"`);
                                results[id].metadataAccessible = true;
                                results[id].metadata = metadata;
                                results[id].hasImage = !!metadata.image;
                            } catch (e) {
                                console.log('   ❌ Invalid data URI');
                                results[id].metadataAccessible = false;
                            }
                        } else {
                            results[id].uriType = 'Unknown';
                            console.log('   ⚠️ Unknown URI type');
                        }
                    }
                    
                    // Check alert notice data
                    try {
                        const notice = await window.legalContract.alertNotices(id).call();
                        if (notice && notice.caseNumber) {
                            console.log(`   Case: ${notice.caseNumber}`);
                            results[id].caseNumber = notice.caseNumber;
                        }
                    } catch (e) {
                        // No notice data
                    }
                    
                } catch (error) {
                    console.log(`   ❌ Token doesn't exist or error: ${error.message}`);
                    results[id].exists = false;
                }
            }
            
            // Analysis
            console.log('\n' + '='.repeat(70));
            console.log('📊 ANALYSIS');
            console.log('='.repeat(70));
            
            console.log('\nSUMMARY:');
            console.log(`Alert #1:  ${results[1].exists ? (results[1].uri ? '✅ Has URI' : '❌ No URI') : '❌ Doesn\'t exist'}`);
            console.log(`Alert #13: ${results[13].exists ? (results[13].uri ? '✅ Has URI' : '❌ No URI') : '❌ Doesn\'t exist'} (user says SHOWS)`);
            console.log(`Alert #19: ${results[19].exists ? (results[19].uri ? '✅ Has URI' : '❌ No URI') : '❌ Doesn\'t exist'} (user says DOESN\'T SHOW)`);
            
            // Diagnosis
            console.log('\n🔍 DIAGNOSIS:');
            
            if (results[13].uri && !results[19].uri) {
                console.log('❌ Alert #19 has NO URI set on-chain!');
                console.log('This is why it doesn\'t display in wallets.');
                console.log('Solution: Contract owner must call setTokenURI(19, "...")');
            } else if (results[13].metadataAccessible && !results[19].metadataAccessible) {
                console.log('❌ Alert #19\'s metadata is not accessible!');
                console.log('The IPFS pin may have expired or the metadata was never uploaded.');
                console.log('Solution: Re-upload metadata or use data URI');
            } else if (results[13].uri && results[19].uri) {
                console.log('⚠️ Both have URIs set.');
                if (results[13].uriType === 'DataURI' && results[19].uriType === 'IPFS') {
                    console.log('Alert #13 uses data URI (reliable), #19 uses IPFS (may fail)');
                }
            }
            
            window.alertInvestigationResults = results;
            return results;
        },
        
        // Generate fix for Alert #19
        async generateFix() {
            console.log('\n' + '='.repeat(70));
            console.log('🔧 GENERATING FIX FOR ALERT #19');
            console.log('='.repeat(70));
            
            // Get current state
            const uri = await window.legalContract.tokenURI(19).call();
            
            // Create proper metadata
            const metadata = {
                name: "⚠️ Legal Alert #19",
                description: "You have received this token as notice of a pending investigation/legal matter concerning this wallet address. Visit www.blockserved.com for details.",
                image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", // 1x1 red pixel as fallback
                external_url: "https://www.blockserved.com",
                attributes: [
                    {
                        trait_type: "Type",
                        value: "Legal Alert"
                    },
                    {
                        trait_type: "Token ID", 
                        value: "19"
                    },
                    {
                        trait_type: "Status",
                        value: "Active"
                    },
                    {
                        trait_type: "Blockchain",
                        value: "TRON"
                    }
                ]
            };
            
            // Try to get case data
            try {
                const notice = await window.legalContract.alertNotices(19).call();
                if (notice && notice.caseNumber) {
                    metadata.name = `⚠️ Legal Alert - Case ${notice.caseNumber}`;
                    metadata.attributes.push({
                        trait_type: "Case Number",
                        value: notice.caseNumber
                    });
                }
            } catch (e) {
                // Use defaults
            }
            
            // Create data URI (most reliable)
            const dataURI = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
            
            console.log('\n✅ METADATA CREATED');
            console.log('Type: Data URI (no external dependencies)');
            console.log('\nMetadata:');
            console.log(JSON.stringify(metadata, null, 2));
            
            console.log('\n📝 TO FIX ALERT #19:');
            console.log('1. Copy this URI:');
            console.log(dataURI);
            
            console.log('\n2. Contract owner must execute:');
            console.log('```javascript');
            console.log(`await window.legalContract.setTokenURI(19, "${dataURI}").send({`);
            console.log('    feeLimit: 100000000,');
            console.log('    callValue: 0,');
            console.log('    shouldPollResponse: true');
            console.log('});');
            console.log('```');
            
            if (!uri) {
                console.log('\n⚠️ CRITICAL: Alert #19 currently has NO URI!');
                console.log('This MUST be fixed for the NFT to display.');
            } else {
                console.log('\n⚠️ Current URI will be replaced:');
                console.log(uri.substring(0, 100) + '...');
            }
            
            // Store for easy access
            window.alert19Fix = {
                metadata: metadata,
                dataURI: dataURI,
                currentURI: uri || null
            };
            
            return dataURI;
        },
        
        // Quick check function
        async quickCheck() {
            console.log('\n🚀 QUICK CHECK:');
            
            const checks = [1, 13, 19];
            for (const id of checks) {
                const uri = await window.legalContract.tokenURI(id).call();
                console.log(`Alert #${id}: ${uri ? '✅ Has URI' : '❌ NO URI'}`);
            }
        }
    };
    
    // Run automatic check
    console.log('\n🔍 Running automatic investigation...\n');
    await window.InvestigateAlerts.checkOnChain();
    
    console.log('\n✅ Investigation complete!');
    console.log('\nAvailable commands:');
    console.log('  InvestigateAlerts.checkOnChain()  - Full investigation');
    console.log('  InvestigateAlerts.generateFix()   - Generate fix for #19');
    console.log('  InvestigateAlerts.quickCheck()    - Quick URI check');
    console.log('\nResults stored in: window.alertInvestigationResults');
    
})();