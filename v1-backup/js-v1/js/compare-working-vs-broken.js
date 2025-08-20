/**
 * COMPARE WORKING vs BROKEN ALERTS
 * Compare Alert #13, #17 (showing descriptions) vs #19 (not showing)
 */

console.log('🔬 COMPARING WORKING vs BROKEN ALERT METADATA');
console.log('=' .repeat(70));

window.CompareAlerts = {
    
    async fetchAndAnalyze(alertId) {
        console.log(`\n📍 Fetching Alert #${alertId}...`);
        
        const analysis = {
            alertId: alertId,
            uriExists: false,
            uriType: null,
            ipfsHash: null,
            metadataAccessible: false,
            hasName: false,
            hasDescription: false,
            hasImage: false,
            descriptionContent: null,
            descriptionLength: 0,
            imageType: null,
            errors: []
        };
        
        try {
            // Get tokenURI
            const uri = await window.legalContract.tokenURI(alertId).call();
            
            if (!uri || uri === '') {
                analysis.errors.push('No URI set');
                return analysis;
            }
            
            analysis.uriExists = true;
            
            // Determine URI type
            if (uri.startsWith('data:')) {
                analysis.uriType = 'DATA_URI';
            } else if (uri.startsWith('ipfs://')) {
                analysis.uriType = 'IPFS';
                analysis.ipfsHash = uri.replace('ipfs://', '');
            } else if (uri.startsWith('http')) {
                analysis.uriType = 'HTTP';
            } else {
                analysis.uriType = 'UNKNOWN';
            }
            
            console.log(`   URI Type: ${analysis.uriType}`);
            if (analysis.ipfsHash) {
                console.log(`   IPFS Hash: ${analysis.ipfsHash}`);
            }
            
            // Try to fetch metadata
            let metadata = null;
            
            if (uri.startsWith('data:')) {
                // Decode data URI
                try {
                    const base64Data = uri.replace('data:application/json;base64,', '');
                    metadata = JSON.parse(atob(base64Data));
                    analysis.metadataAccessible = true;
                } catch (e) {
                    analysis.errors.push('Failed to decode data URI: ' + e.message);
                }
                
            } else if (uri.startsWith('ipfs://')) {
                // Fetch from IPFS
                console.log('   Fetching from IPFS gateway...');
                try {
                    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${analysis.ipfsHash}`, {
                        signal: AbortSignal.timeout(15000)
                    });
                    
                    if (response.ok) {
                        metadata = await response.json();
                        analysis.metadataAccessible = true;
                        console.log('   ✅ IPFS metadata fetched');
                    } else {
                        analysis.errors.push(`IPFS fetch failed: ${response.status}`);
                        console.log(`   ❌ IPFS failed: ${response.status}`);
                    }
                } catch (e) {
                    analysis.errors.push('IPFS timeout/error: ' + e.message);
                    console.log('   ❌ IPFS error:', e.message);
                }
            }
            
            // Analyze metadata if we got it
            if (metadata) {
                // Check name
                if (metadata.name) {
                    analysis.hasName = true;
                    console.log(`   ✅ Name: "${metadata.name}"`);
                } else {
                    console.log('   ❌ No name field');
                }
                
                // Check description
                if (metadata.description) {
                    analysis.hasDescription = true;
                    analysis.descriptionContent = metadata.description;
                    analysis.descriptionLength = metadata.description.length;
                    console.log(`   ✅ Description: ${metadata.description.length} chars`);
                    console.log(`      Preview: "${metadata.description.substring(0, 50)}..."`);
                } else {
                    console.log('   ❌ No description field');
                }
                
                // Check image
                if (metadata.image) {
                    analysis.hasImage = true;
                    if (metadata.image.startsWith('data:')) {
                        analysis.imageType = 'BASE64';
                        console.log('   ✅ Image: Base64 embedded');
                    } else if (metadata.image.startsWith('ipfs://')) {
                        analysis.imageType = 'IPFS';
                        console.log('   ⚠️ Image: IPFS reference');
                    } else if (metadata.image.startsWith('http')) {
                        analysis.imageType = 'HTTP';
                        console.log('   ⚠️ Image: HTTP URL');
                    }
                } else {
                    console.log('   ❌ No image field');
                }
                
                // Store full metadata for comparison
                analysis.fullMetadata = metadata;
            }
            
        } catch (error) {
            analysis.errors.push('Contract error: ' + error.message);
            console.log('   ❌ Error:', error.message);
        }
        
        return analysis;
    },
    
    async compareSpecificAlerts() {
        console.log('\n' + '=' .repeat(70));
        console.log('COMPARING ALERT #13, #17 (WORKING) vs #19 (NOT WORKING)');
        console.log('=' .repeat(70));
        
        // Fetch all three
        const alert13 = await this.fetchAndAnalyze(13);
        const alert17 = await this.fetchAndAnalyze(17);
        const alert19 = await this.fetchAndAnalyze(19);
        
        // Create comparison table
        console.log('\n📊 COMPARISON TABLE:');
        console.log('=' .repeat(70));
        
        const comparison = [
            {
                'Property': 'Shows in Wallet',
                'Alert #13': '✅ YES',
                'Alert #17': '✅ YES', 
                'Alert #19': '❌ NO'
            },
            {
                'Property': 'URI Type',
                'Alert #13': alert13.uriType,
                'Alert #17': alert17.uriType,
                'Alert #19': alert19.uriType
            },
            {
                'Property': 'IPFS Hash',
                'Alert #13': alert13.ipfsHash ? alert13.ipfsHash.substring(0, 20) + '...' : 'N/A',
                'Alert #17': alert17.ipfsHash ? alert17.ipfsHash.substring(0, 20) + '...' : 'N/A',
                'Alert #19': alert19.ipfsHash ? alert19.ipfsHash.substring(0, 20) + '...' : 'N/A'
            },
            {
                'Property': 'Metadata Accessible',
                'Alert #13': alert13.metadataAccessible ? '✅' : '❌',
                'Alert #17': alert17.metadataAccessible ? '✅' : '❌',
                'Alert #19': alert19.metadataAccessible ? '✅' : '❌'
            },
            {
                'Property': 'Has Name',
                'Alert #13': alert13.hasName ? '✅' : '❌',
                'Alert #17': alert17.hasName ? '✅' : '❌',
                'Alert #19': alert19.hasName ? '✅' : '❌'
            },
            {
                'Property': 'Has Description',
                'Alert #13': alert13.hasDescription ? '✅' : '❌',
                'Alert #17': alert17.hasDescription ? '✅' : '❌',
                'Alert #19': alert19.hasDescription ? '✅' : '❌'
            },
            {
                'Property': 'Description Length',
                'Alert #13': alert13.descriptionLength + ' chars',
                'Alert #17': alert17.descriptionLength + ' chars',
                'Alert #19': alert19.descriptionLength + ' chars'
            },
            {
                'Property': 'Has Image',
                'Alert #13': alert13.hasImage ? '✅' : '❌',
                'Alert #17': alert17.hasImage ? '✅' : '❌',
                'Alert #19': alert19.hasImage ? '✅' : '❌'
            },
            {
                'Property': 'Image Type',
                'Alert #13': alert13.imageType || 'None',
                'Alert #17': alert17.imageType || 'None',
                'Alert #19': alert19.imageType || 'None'
            },
            {
                'Property': 'Errors',
                'Alert #13': alert13.errors.length || 'None',
                'Alert #17': alert17.errors.length || 'None',
                'Alert #19': alert19.errors.length || 'None'
            }
        ];
        
        console.table(comparison);
        
        // Check if they share the same IPFS hash
        if (alert17.ipfsHash && alert19.ipfsHash && alert17.ipfsHash === alert19.ipfsHash) {
            console.log('\n⚠️ CRITICAL FINDING:');
            console.log('Alert #17 and #19 use the SAME IPFS hash!');
            console.log(`Shared hash: ${alert17.ipfsHash}`);
            console.log('This means they have IDENTICAL metadata');
            console.log('The display difference is due to wallet caching or IPFS gateway issues');
        }
        
        // Compare descriptions if available
        if (alert13.descriptionContent && alert17.descriptionContent && alert19.descriptionContent) {
            console.log('\n📝 DESCRIPTION COMPARISON:');
            console.log('-'.repeat(50));
            
            console.log('\nAlert #13 description:');
            console.log(alert13.descriptionContent);
            
            console.log('\nAlert #17 description:');
            console.log(alert17.descriptionContent);
            
            console.log('\nAlert #19 description:');
            console.log(alert19.descriptionContent);
            
            // Check if descriptions are identical
            if (alert13.descriptionContent === alert17.descriptionContent && 
                alert17.descriptionContent === alert19.descriptionContent) {
                console.log('\n⚠️ All three have IDENTICAL descriptions!');
            }
        }
        
        // Diagnosis
        console.log('\n🔍 DIAGNOSIS:');
        console.log('=' .repeat(70));
        
        if (!alert19.metadataAccessible && (alert13.metadataAccessible || alert17.metadataAccessible)) {
            console.log('❌ Alert #19 metadata is not accessible while others are');
            console.log('   This explains why description doesn\'t show');
        } else if (!alert19.hasDescription && (alert13.hasDescription || alert17.hasDescription)) {
            console.log('❌ Alert #19 is missing description field while others have it');
        } else if (alert19.uriType === 'IPFS') {
            console.log('⚠️ All use IPFS - display depends on:');
            console.log('   1. IPFS gateway availability');
            console.log('   2. Wallet caching');
            console.log('   3. Rate limiting');
            console.log('   4. CORS policies');
            console.log('\n💡 Solution: Switch to base64 data URIs');
        }
        
        return {
            alert13,
            alert17,
            alert19
        };
    },
    
    // Quick test to see current state
    async quickCheck() {
        console.log('\n🚀 QUICK CHECK OF #13, #17, #19');
        console.log('-'.repeat(50));
        
        for (const id of [13, 17, 19]) {
            const uri = await window.legalContract.tokenURI(id).call();
            const type = uri.startsWith('data:') ? 'BASE64' : 
                        uri.startsWith('ipfs://') ? 'IPFS' : 'OTHER';
            
            console.log(`Alert #${id}: ${type}`);
            
            if (uri.startsWith('ipfs://')) {
                const hash = uri.replace('ipfs://', '');
                console.log(`   Hash: ${hash.substring(0, 30)}...`);
            }
        }
    }
};

// Auto-run comparison
console.log('Starting comparison of working vs non-working alerts...\n');
CompareAlerts.compareSpecificAlerts().then(results => {
    console.log('\n✅ Comparison complete');
    console.log('Results stored in window.alertComparisonResults');
    window.alertComparisonResults = results;
    
    console.log('\nCommands:');
    console.log('  CompareAlerts.quickCheck()              - Quick status check');
    console.log('  CompareAlerts.fetchAndAnalyze(19)       - Deep analysis of single alert');
    console.log('  CompareAlerts.compareSpecificAlerts()   - Full comparison');
});