/**
 * ANALYZE WORKING NFTs
 * Examine NFTs that ARE displaying properly to understand their implementation
 */

console.log('🔬 Analyzing working NFTs to understand their implementation...');

window.AnalyzeWorkingNFTs = {
    
    // Comprehensive analysis of a working NFT
    async analyzeNFT(tokenId) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📍 ANALYZING NFT #${tokenId}`);
        console.log('='.repeat(70));
        
        const analysis = {
            tokenId: tokenId,
            exists: false,
            hasURI: false,
            uriType: null,
            uriContent: null,
            metadata: null,
            imageType: null,
            imageSize: null,
            storageMethod: null,
            timestamp: null
        };
        
        try {
            // 1. Check ownership
            const owner = await window.legalContract.ownerOf(tokenId).call();
            analysis.exists = true;
            analysis.owner = owner;
            console.log(`✅ Token exists, owner: ${owner}`);
            
            // 2. Get tokenURI
            const uri = await window.legalContract.tokenURI(tokenId).call();
            
            if (!uri || uri === '') {
                console.log('❌ No URI set');
                return analysis;
            }
            
            analysis.hasURI = true;
            analysis.uriContent = uri;
            console.log(`✅ Has URI: ${uri.substring(0, 100)}...`);
            
            // 3. Analyze URI type and structure
            if (uri.startsWith('data:')) {
                analysis.uriType = 'DATA_URI';
                console.log('📦 Type: Data URI (base64 encoded)');
                
                // Parse data URI
                const [header, data] = uri.split(',');
                const mimeMatch = header.match(/data:([^;]+)/);
                
                if (mimeMatch) {
                    const mimeType = mimeMatch[1];
                    console.log(`   MIME type: ${mimeType}`);
                    
                    if (mimeType === 'application/json') {
                        // It's JSON metadata
                        try {
                            const metadata = JSON.parse(atob(data));
                            analysis.metadata = metadata;
                            console.log('   ✅ Valid JSON metadata');
                            console.log(`   Name: ${metadata.name}`);
                            console.log(`   Description: ${metadata.description?.substring(0, 50)}...`);
                            
                            // Analyze the image field
                            if (metadata.image) {
                                console.log('\n   📸 Image Analysis:');
                                if (metadata.image.startsWith('data:image')) {
                                    analysis.imageType = 'BASE64_IMAGE';
                                    const imageSize = metadata.image.length;
                                    analysis.imageSize = imageSize;
                                    console.log(`   - Type: Base64 embedded image`);
                                    console.log(`   - Size: ${(imageSize / 1024).toFixed(2)} KB`);
                                    console.log(`   - Format: ${metadata.image.substring(5, 20)}`);
                                    
                                    // Check if it's a real image or placeholder
                                    if (imageSize < 500) {
                                        console.log('   ⚠️ Very small image - might be placeholder');
                                    } else if (imageSize < 5000) {
                                        console.log('   📐 Small image - likely thumbnail');
                                    } else {
                                        console.log('   📷 Full-size image embedded');
                                    }
                                    
                                } else if (metadata.image.startsWith('ipfs://')) {
                                    analysis.imageType = 'IPFS_IMAGE';
                                    console.log(`   - Type: IPFS reference`);
                                    console.log(`   - Hash: ${metadata.image.replace('ipfs://', '')}`);
                                    
                                    // Try to check if accessible
                                    const ipfsHash = metadata.image.replace('ipfs://', '');
                                    try {
                                        const response = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`, {
                                            method: 'HEAD',
                                            signal: AbortSignal.timeout(3000)
                                        });
                                        if (response.ok) {
                                            console.log('   ✅ IPFS image is accessible');
                                        } else {
                                            console.log('   ❌ IPFS image not accessible');
                                        }
                                    } catch (e) {
                                        console.log('   ❌ IPFS timeout/error');
                                    }
                                    
                                } else if (metadata.image.startsWith('http')) {
                                    analysis.imageType = 'HTTP_IMAGE';
                                    console.log(`   - Type: HTTP URL`);
                                    console.log(`   - URL: ${metadata.image}`);
                                } else {
                                    analysis.imageType = 'UNKNOWN_IMAGE';
                                    console.log(`   - Type: Unknown format`);
                                }
                            } else {
                                console.log('   ❌ No image in metadata');
                            }
                            
                            // Check for document references
                            if (metadata.document_ipfs || metadata.encryptedIPFS) {
                                console.log('\n   📄 Document Storage:');
                                console.log(`   - Has encrypted document: ${metadata.document_ipfs || metadata.encryptedIPFS}`);
                            }
                            
                            // Analyze attributes
                            if (metadata.attributes && metadata.attributes.length > 0) {
                                console.log('\n   🏷️ Attributes:');
                                metadata.attributes.forEach(attr => {
                                    console.log(`   - ${attr.trait_type}: ${attr.value}`);
                                });
                            }
                            
                        } catch (e) {
                            console.log('   ❌ Failed to parse metadata:', e.message);
                        }
                    }
                }
                
                // Calculate data URI efficiency
                console.log('\n   📊 Storage Analysis:');
                console.log(`   - Total URI size: ${(uri.length / 1024).toFixed(2)} KB`);
                console.log(`   - Storage method: On-chain (data URI)`);
                console.log(`   - External dependencies: None`);
                analysis.storageMethod = 'ON_CHAIN_DATA_URI';
                
            } else if (uri.startsWith('ipfs://')) {
                analysis.uriType = 'IPFS';
                const ipfsHash = uri.replace('ipfs://', '');
                console.log('🌐 Type: IPFS');
                console.log(`   Hash: ${ipfsHash}`);
                
                // Try to fetch and analyze
                try {
                    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
                    if (response.ok) {
                        const text = await response.text();
                        if (text.startsWith('{')) {
                            const metadata = JSON.parse(text);
                            analysis.metadata = metadata;
                            console.log('   ✅ IPFS metadata accessible');
                            console.log(`   Name: ${metadata.name}`);
                            
                            // Analyze image storage
                            if (metadata.image) {
                                if (metadata.image.startsWith('data:')) {
                                    analysis.imageType = 'BASE64_IN_IPFS';
                                    console.log('   Image: Base64 embedded in IPFS metadata');
                                } else if (metadata.image.startsWith('ipfs://')) {
                                    analysis.imageType = 'IPFS_NESTED';
                                    console.log('   Image: Separate IPFS reference');
                                } else {
                                    analysis.imageType = 'HTTP_IN_IPFS';
                                    console.log('   Image: HTTP URL in IPFS');
                                }
                            }
                        } else {
                            console.log('   ❌ IPFS returns non-JSON');
                        }
                    } else {
                        console.log('   ❌ IPFS not accessible');
                    }
                } catch (e) {
                    console.log('   ❌ IPFS fetch error:', e.message);
                }
                
                analysis.storageMethod = 'IPFS_EXTERNAL';
                
            } else if (uri.startsWith('http')) {
                analysis.uriType = 'HTTP';
                console.log('🌐 Type: HTTP URL');
                console.log(`   URL: ${uri}`);
                analysis.storageMethod = 'HTTP_BACKEND';
            }
            
            // 4. Check on-chain notice data
            console.log('\n📜 On-chain Data:');
            
            // Check if it's an Alert (odd) or Document (even)
            const isAlert = tokenId % 2 === 1;
            console.log(`   Type: ${isAlert ? 'Alert NFT' : 'Document NFT'}`);
            
            if (isAlert) {
                try {
                    const alertData = await window.legalContract.alertNotices(tokenId).call();
                    if (alertData && alertData.caseNumber) {
                        console.log(`   Case: ${alertData.caseNumber}`);
                        console.log(`   Agency: ${alertData.issuingAgency || 'N/A'}`);
                        analysis.caseNumber = alertData.caseNumber;
                    }
                } catch (e) {
                    // No alert data
                }
            }
            
            // 5. Summary
            console.log('\n📋 SUMMARY:');
            console.log(`   Storage: ${analysis.storageMethod}`);
            console.log(`   Image: ${analysis.imageType}`);
            console.log(`   Dependencies: ${analysis.uriType === 'DATA_URI' ? 'None (self-contained)' : 'External'}`);
            
        } catch (error) {
            console.log(`❌ Error analyzing: ${error.message}`);
            analysis.error = error.message;
        }
        
        return analysis;
    },
    
    // Compare multiple NFTs to find patterns
    async compareWorkingNFTs(tokenIds) {
        console.log('\n' + '='.repeat(70));
        console.log('COMPARING WORKING NFTs');
        console.log('='.repeat(70));
        
        const results = [];
        
        for (const id of tokenIds) {
            const analysis = await this.analyzeNFT(id);
            results.push(analysis);
        }
        
        // Find patterns
        console.log('\n' + '='.repeat(70));
        console.log('📊 PATTERN ANALYSIS');
        console.log('='.repeat(70));
        
        const storageTypes = {};
        const imageTypes = {};
        
        results.forEach(r => {
            if (r.storageMethod) {
                storageTypes[r.storageMethod] = (storageTypes[r.storageMethod] || 0) + 1;
            }
            if (r.imageType) {
                imageTypes[r.imageType] = (imageTypes[r.imageType] || 0) + 1;
            }
        });
        
        console.log('\nStorage Methods Used:');
        Object.entries(storageTypes).forEach(([type, count]) => {
            console.log(`   ${type}: ${count} NFTs`);
        });
        
        console.log('\nImage Storage Types:');
        Object.entries(imageTypes).forEach(([type, count]) => {
            console.log(`   ${type}: ${count} NFTs`);
        });
        
        // Check consistency
        const allDataURI = results.every(r => r.uriType === 'DATA_URI');
        const allIPFS = results.every(r => r.uriType === 'IPFS');
        
        console.log('\n🔍 Findings:');
        if (allDataURI) {
            console.log('✅ All working NFTs use data URIs (most reliable)');
        } else if (allIPFS) {
            console.log('⚠️ All working NFTs use IPFS (depends on gateway)');
        } else {
            console.log('🔄 Mixed storage methods detected');
            
            // Find which work best
            const workingDataURIs = results.filter(r => r.uriType === 'DATA_URI' && r.metadata);
            const workingIPFS = results.filter(r => r.uriType === 'IPFS' && r.metadata);
            
            console.log(`   Data URIs working: ${workingDataURIs.length}/${results.filter(r => r.uriType === 'DATA_URI').length}`);
            console.log(`   IPFS working: ${workingIPFS.length}/${results.filter(r => r.uriType === 'IPFS').length}`);
        }
        
        return results;
    },
    
    // Analyze specifically Alert #1, #13, #17 (the ones that work)
    async analyzeWorkingAlerts() {
        console.log('🎯 Analyzing Alert NFTs that are displaying properly...\n');
        
        const workingAlerts = [1, 13, 17];
        const results = await this.compareWorkingNFTs(workingAlerts);
        
        // Generate recommendations
        console.log('\n' + '='.repeat(70));
        console.log('💡 RECOMMENDATIONS BASED ON WORKING NFTs');
        console.log('='.repeat(70));
        
        const hasBase64Images = results.some(r => r.imageType === 'BASE64_IMAGE');
        const hasDataURIs = results.some(r => r.uriType === 'DATA_URI');
        
        if (hasBase64Images && hasDataURIs) {
            console.log('✅ Working NFTs use base64 images in data URIs');
            console.log('   This is the most reliable method!');
            console.log('   Recommendation: Continue using this approach');
        } else if (hasBase64Images) {
            console.log('⚠️ Working NFTs have base64 images but not all use data URIs');
            console.log('   Recommendation: Switch fully to data URIs');
        } else {
            console.log('❌ Working NFTs don\'t use base64 embedded images');
            console.log('   This explains display inconsistencies');
            console.log('   Recommendation: Migrate to base64 images in data URIs');
        }
        
        return results;
    }
};

// Auto-run analysis on working NFTs
console.log('Starting automatic analysis of working Alert NFTs...\n');
AnalyzeWorkingNFTs.analyzeWorkingAlerts().then(results => {
    console.log('\n✅ Analysis complete');
    console.log('Results stored in window.workingNFTAnalysis');
    window.workingNFTAnalysis = results;
});

console.log('\nAvailable commands:');
console.log('  AnalyzeWorkingNFTs.analyzeNFT(13)           - Deep analysis of single NFT');
console.log('  AnalyzeWorkingNFTs.compareWorkingNFTs([1,13,17]) - Compare multiple NFTs');
console.log('  AnalyzeWorkingNFTs.analyzeWorkingAlerts()   - Analyze all working alerts');