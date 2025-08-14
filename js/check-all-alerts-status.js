/**
 * CHECK STATUS OF ALL ALERT NFTs
 * See which ones are showing up and why
 */

console.log('🔍 Checking status of all Alert NFTs...');

window.CheckAllAlerts = {
    
    // Check all Alert NFTs and their display status
    async checkAll() {
        console.log('\n' + '='.repeat(70));
        console.log('CHECKING ALL ALERT NFTs');
        console.log('='.repeat(70));
        
        if (!window.legalContract) {
            console.error('❌ Contract not loaded');
            return;
        }
        
        try {
            // Get total supply
            const totalSupply = await window.legalContract.totalSupply().call();
            const total = Number(totalSupply.toString());
            console.log(`Total NFTs minted: ${total}`);
            
            // Collect all Alert NFTs (odd IDs)
            const alerts = [];
            for (let i = 1; i <= total; i += 2) {
                alerts.push(i);
            }
            
            console.log(`Found ${alerts.length} Alert NFTs: ${alerts.join(', ')}`);
            console.log('-'.repeat(70));
            
            const results = {
                working: [],      // Has URI and metadata accessible
                noUri: [],        // No URI set
                ipfsError: [],    // Has IPFS URI but not accessible
                dataUri: [],      // Has data URI (should always work)
                unknown: []       // Other issues
            };
            
            // Check each Alert NFT
            for (const id of alerts) {
                process.stdout?.write?.(`Checking #${id}...`);
                
                try {
                    // Get owner first to confirm it exists
                    const owner = await window.legalContract.ownerOf(id).call();
                    
                    // Get tokenURI
                    const uri = await window.legalContract.tokenURI(id).call();
                    
                    if (!uri || uri === '' || uri === 'undefined') {
                        results.noUri.push(id);
                        console.log(` ❌ No URI`);
                    } else if (uri.startsWith('ipfs://')) {
                        // Check if IPFS is accessible
                        const hash = uri.replace('ipfs://', '');
                        try {
                            const response = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`, {
                                method: 'HEAD',
                                signal: AbortSignal.timeout(3000)
                            });
                            
                            if (response.ok) {
                                results.working.push(id);
                                console.log(` ✅ IPFS working`);
                            } else {
                                results.ipfsError.push(id);
                                console.log(` ❌ IPFS not accessible`);
                            }
                        } catch (e) {
                            results.ipfsError.push(id);
                            console.log(` ❌ IPFS timeout/error`);
                        }
                    } else if (uri.startsWith('data:')) {
                        results.dataUri.push(id);
                        results.working.push(id);
                        console.log(` ✅ Data URI`);
                    } else {
                        results.unknown.push(id);
                        console.log(` ⚠️ Unknown URI type`);
                    }
                    
                } catch (error) {
                    console.log(` ❌ Error: ${error.message}`);
                }
            }
            
            // Summary
            console.log('\n' + '='.repeat(70));
            console.log('📊 SUMMARY');
            console.log('='.repeat(70));
            
            console.log('\n✅ SHOULD BE VISIBLE IN WALLET:');
            if (results.working.length > 0) {
                console.log(`   ${results.working.sort((a,b) => a-b).join(', ')}`);
                
                // Highlight the ones user mentioned
                const userMentioned = [1, 13, 17, 19];
                const visible = userMentioned.filter(id => results.working.includes(id));
                const notVisible = userMentioned.filter(id => !results.working.includes(id));
                
                if (visible.length > 0) {
                    console.log(`   ✅ Including: ${visible.join(', ')} (user confirmed some show)`);
                }
                if (notVisible.length > 0) {
                    console.log(`   ❌ NOT including: ${notVisible.join(', ')} (may not show)`);
                }
            } else {
                console.log('   None');
            }
            
            console.log('\n❌ WON\'T DISPLAY (No URI):');
            console.log(`   ${results.noUri.length > 0 ? results.noUri.join(', ') : 'None'}`);
            
            console.log('\n⚠️ MAY NOT DISPLAY (IPFS issues):');
            console.log(`   ${results.ipfsError.length > 0 ? results.ipfsError.join(', ') : 'None'}`);
            
            console.log('\n📦 USING DATA URIs (Most reliable):');
            console.log(`   ${results.dataUri.length > 0 ? results.dataUri.join(', ') : 'None'}`);
            
            // Analysis
            console.log('\n' + '='.repeat(70));
            console.log('🔍 ANALYSIS');
            console.log('='.repeat(70));
            
            if (results.working.includes(13) && results.working.includes(17)) {
                console.log('✅ #13 and #17 should both display (matches user observation)');
            }
            
            if (!results.working.includes(19)) {
                console.log('❌ #19 won\'t display because:');
                if (results.noUri.includes(19)) {
                    console.log('   - It has no tokenURI set');
                } else if (results.ipfsError.includes(19)) {
                    console.log('   - Its IPFS metadata is not accessible');
                }
            } else {
                console.log('✅ #19 should now display (metadata is accessible)');
            }
            
            // Recommendations
            console.log('\n💡 RECOMMENDATIONS:');
            if (results.noUri.length > 0) {
                console.log(`1. Set tokenURI for NFTs without metadata: ${results.noUri.join(', ')}`);
            }
            if (results.ipfsError.length > 0) {
                console.log(`2. Fix IPFS pins or use data URIs for: ${results.ipfsError.join(', ')}`);
            }
            console.log('3. For best reliability, use data URIs instead of IPFS');
            console.log('4. Clear wallet cache and refresh to see updates');
            
            // Store results
            window.alertStatusResults = results;
            return results;
            
        } catch (error) {
            console.error('Fatal error:', error);
        }
    },
    
    // Quick status of specific alerts
    async quickStatus() {
        const ids = [1, 13, 17, 19];
        console.log('\n🚀 QUICK STATUS CHECK:');
        console.log('User says showing: #13, #17');
        console.log('User says not showing: #19');
        console.log('-'.repeat(40));
        
        for (const id of ids) {
            try {
                const uri = await window.legalContract.tokenURI(id).call();
                
                let status = '';
                if (!uri) {
                    status = '❌ No URI';
                } else if (uri.startsWith('ipfs://')) {
                    // Quick IPFS check
                    const hash = uri.replace('ipfs://', '');
                    try {
                        const response = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`, {
                            method: 'HEAD',
                            signal: AbortSignal.timeout(2000)
                        });
                        status = response.ok ? '✅ IPFS OK' : '❌ IPFS down';
                    } catch (e) {
                        status = '❌ IPFS timeout';
                    }
                } else if (uri.startsWith('data:')) {
                    status = '✅ Data URI';
                } else {
                    status = '⚠️ Unknown';
                }
                
                console.log(`Alert #${id}: ${status}`);
                
            } catch (e) {
                console.log(`Alert #${id}: ❌ Error`);
            }
        }
    },
    
    // Fix all broken Alerts
    async fixAllBroken() {
        console.log('\n🔧 FIXING ALL BROKEN ALERT NFTs...');
        
        const results = await this.checkAll();
        const toFix = [...results.noUri, ...results.ipfsError];
        
        if (toFix.length === 0) {
            console.log('✅ No broken Alert NFTs found!');
            return;
        }
        
        console.log(`Found ${toFix.length} Alert NFTs to fix: ${toFix.join(', ')}`);
        console.log('\nGenerating metadata for each...');
        
        const fixes = {};
        
        for (const id of toFix) {
            const metadata = {
                name: `⚠️ Legal Alert #${id}`,
                description: "You have received this token as notice of a pending investigation/legal matter concerning this wallet address. Visit www.blockserved.com for details.",
                image: "https://nft-legal-service.netlify.app/images/alert-nft-thumbnail.png",
                external_url: "https://www.blockserved.com",
                attributes: [
                    { trait_type: "Type", value: "Legal Alert" },
                    { trait_type: "Token ID", value: id.toString() },
                    { trait_type: "Status", value: "Active" },
                    { trait_type: "Blockchain", value: "TRON" }
                ]
            };
            
            // Try to get case number
            try {
                const notice = await window.legalContract.alertNotices(id).call();
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
            
            const dataURI = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
            fixes[id] = dataURI;
            
            console.log(`✅ Alert #${id} metadata created`);
        }
        
        console.log('\n📝 TO APPLY FIXES:');
        console.log('Contract owner must execute these commands:');
        console.log('-'.repeat(50));
        
        for (const [id, uri] of Object.entries(fixes)) {
            console.log(`\n// Fix Alert #${id}`);
            console.log(`await legalContract.setTokenURI(${id}, "${uri}").send({`);
            console.log('    feeLimit: 100000000,');
            console.log('    shouldPollResponse: true');
            console.log('});');
        }
        
        window.alertFixes = fixes;
        console.log('\n✅ Fixes stored in window.alertFixes');
    }
};

// Auto-run quick status
console.log('Running automatic status check...');
CheckAllAlerts.quickStatus();

console.log('\n✅ Alert status checker loaded');
console.log('Commands:');
console.log('  CheckAllAlerts.checkAll()     - Full status check of all Alerts');
console.log('  CheckAllAlerts.quickStatus()  - Quick check of #1, #13, #17, #19');
console.log('  CheckAllAlerts.fixAllBroken() - Generate fixes for broken Alerts');