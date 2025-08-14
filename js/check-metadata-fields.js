/**
 * CHECK METADATA FIELDS
 * Analyze why descriptions might not display in wallets
 */

console.log('🔍 CHECKING METADATA FIELD ISSUES');
console.log('=' .repeat(70));

window.CheckMetadataFields = {
    
    async checkAlert(alertId) {
        console.log(`\n📍 Checking Alert #${alertId} metadata fields...`);
        
        try {
            // Get tokenURI
            const uri = await window.legalContract.tokenURI(alertId).call();
            
            if (!uri) {
                console.log('❌ No URI set');
                return;
            }
            
            console.log('URI type:', uri.startsWith('data:') ? 'DATA_URI' : 
                                    uri.startsWith('ipfs://') ? 'IPFS' : 'OTHER');
            
            // Try to fetch and decode metadata
            let metadata = null;
            
            if (uri.startsWith('data:')) {
                // Decode data URI
                const base64Data = uri.replace('data:application/json;base64,', '');
                try {
                    metadata = JSON.parse(atob(base64Data));
                } catch (e) {
                    console.log('❌ Failed to decode data URI');
                    return;
                }
                
            } else if (uri.startsWith('ipfs://')) {
                // Fetch from IPFS
                const ipfsHash = uri.replace('ipfs://', '');
                console.log(`Fetching from IPFS: ${ipfsHash}`);
                
                try {
                    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`, {
                        signal: AbortSignal.timeout(10000)
                    });
                    
                    if (response.ok) {
                        metadata = await response.json();
                    } else {
                        console.log('❌ IPFS not accessible');
                        return;
                    }
                } catch (e) {
                    console.log('❌ IPFS fetch failed:', e.message);
                    return;
                }
            }
            
            if (!metadata) {
                console.log('❌ No metadata found');
                return;
            }
            
            // Analyze metadata structure
            console.log('\n📊 METADATA ANALYSIS:');
            console.log('=' .repeat(50));
            
            // Check name field
            console.log('\n1. NAME FIELD:');
            if (metadata.name) {
                console.log(`   ✅ Present: "${metadata.name}"`);
                console.log(`   Length: ${metadata.name.length} characters`);
            } else {
                console.log('   ❌ MISSING - This will prevent display!');
            }
            
            // Check description field
            console.log('\n2. DESCRIPTION FIELD:');
            if (metadata.description) {
                console.log(`   ✅ Present`);
                console.log(`   Length: ${metadata.description.length} characters`);
                console.log(`   Preview: "${metadata.description.substring(0, 100)}..."`);
                
                // Check for issues
                if (metadata.description.length > 1000) {
                    console.log('   ⚠️ Very long - some wallets truncate or hide long descriptions');
                }
                
                // Check for special characters
                if (metadata.description.includes('\n')) {
                    console.log('   ℹ️ Contains newlines - some wallets may not render these');
                }
                
                if (metadata.description.includes('📄') || metadata.description.includes('⚖️')) {
                    console.log('   ⚠️ Contains emojis - some wallets may not display these');
                }
                
            } else {
                console.log('   ❌ MISSING - This is why it doesn\'t show!');
            }
            
            // Check image field
            console.log('\n3. IMAGE FIELD:');
            if (metadata.image) {
                if (metadata.image.startsWith('data:')) {
                    console.log('   ✅ Base64 embedded image');
                } else if (metadata.image.startsWith('ipfs://')) {
                    console.log('   ⚠️ IPFS image - may not load');
                } else if (metadata.image.startsWith('http')) {
                    console.log('   ⚠️ HTTP image - may be blocked');
                } else {
                    console.log('   ❓ Unknown format');
                }
            } else {
                console.log('   ❌ MISSING - No image to display');
            }
            
            // Check attributes
            console.log('\n4. ATTRIBUTES:');
            if (metadata.attributes && Array.isArray(metadata.attributes)) {
                console.log(`   ✅ ${metadata.attributes.length} attributes`);
                metadata.attributes.forEach(attr => {
                    console.log(`   - ${attr.trait_type}: ${attr.value}`);
                });
            } else {
                console.log('   ⚠️ No attributes');
            }
            
            // Check other fields
            console.log('\n5. OTHER FIELDS:');
            const otherFields = Object.keys(metadata).filter(k => 
                !['name', 'description', 'image', 'attributes'].includes(k)
            );
            
            otherFields.forEach(field => {
                console.log(`   - ${field}: ${typeof metadata[field]}`);
            });
            
            // Common issues
            console.log('\n⚠️ COMMON ISSUES THAT PREVENT DISPLAY:');
            
            if (!metadata.name) {
                console.log('❌ Missing "name" field - CRITICAL');
            }
            
            if (!metadata.description) {
                console.log('❌ Missing "description" field - CRITICAL');
            }
            
            if (!metadata.image) {
                console.log('❌ Missing "image" field - No visual');
            }
            
            if (uri.startsWith('ipfs://')) {
                console.log('⚠️ IPFS dependency - May fail if gateway is down');
            }
            
            // Check if metadata follows OpenSea standard
            const hasOpenSeaFields = metadata.name && 
                                     metadata.description && 
                                     metadata.image;
            
            console.log('\n📋 WALLET COMPATIBILITY:');
            console.log(`OpenSea Standard: ${hasOpenSeaFields ? '✅ Compatible' : '❌ Missing required fields'}`);
            
            // Return analysis
            return {
                alertId,
                hasName: !!metadata.name,
                hasDescription: !!metadata.description,
                hasImage: !!metadata.image,
                descriptionLength: metadata.description?.length || 0,
                uriType: uri.startsWith('data:') ? 'DATA_URI' : 'IPFS',
                willDisplay: hasOpenSeaFields
            };
            
        } catch (error) {
            console.log('❌ Error:', error.message);
        }
    },
    
    async checkAllAlerts() {
        console.log('\n🔍 CHECKING ALL ALERT METADATA');
        console.log('=' .repeat(70));
        
        const alertIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
        const results = [];
        
        for (const id of alertIds) {
            const result = await this.checkAlert(id);
            if (result) {
                results.push(result);
            }
        }
        
        // Summary
        console.log('\n📊 SUMMARY:');
        console.table(results);
        
        const missingDesc = results.filter(r => !r.hasDescription);
        if (missingDesc.length > 0) {
            console.log(`\n❌ ${missingDesc.length} alerts missing descriptions:`, 
                       missingDesc.map(r => r.alertId));
        }
        
        return results;
    },
    
    // Check what wallets expect
    checkWalletRequirements() {
        console.log('\n📱 WALLET METADATA REQUIREMENTS:');
        console.log('=' .repeat(70));
        
        console.log('\n1. TRONLINK WALLET:');
        console.log('   Required fields:');
        console.log('   - name (string)');
        console.log('   - description (string, max 200 chars shown)');
        console.log('   - image (URL or data URI)');
        
        console.log('\n2. OPENSEA STANDARD:');
        console.log('   Required fields:');
        console.log('   - name (string)');
        console.log('   - description (string)');
        console.log('   - image (URL or data URI)');
        console.log('   Optional:');
        console.log('   - external_url');
        console.log('   - attributes (array)');
        
        console.log('\n3. COMMON ISSUES:');
        console.log('   ❌ Missing required fields');
        console.log('   ❌ IPFS gateway timeouts');
        console.log('   ❌ CORS blocking HTTP images');
        console.log('   ❌ Incorrect JSON structure');
        console.log('   ❌ Empty strings instead of missing fields');
        
        console.log('\n✅ BEST PRACTICE:');
        console.log('   Use base64 data URIs with all required fields');
        console.log('   Keep descriptions under 200 characters');
        console.log('   Embed images as base64 to avoid external dependencies');
    }
};

// Auto-check
console.log('Starting metadata field analysis...\n');
CheckMetadataFields.checkWalletRequirements();

console.log('\nCommands:');
console.log('  CheckMetadataFields.checkAlert(19)     - Check specific alert');
console.log('  CheckMetadataFields.checkAllAlerts()   - Check all alerts');
console.log('  CheckMetadataFields.checkWalletRequirements() - Show requirements');