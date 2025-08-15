/**
 * CHECK METADATA STRUCTURE
 * Understand how description is stored and ensure it's in base64
 */

console.log('🔍 CHECKING NFT METADATA STRUCTURE');
console.log('=' .repeat(70));

window.CheckMetadataStructure = {
    
    async analyzeMetadataStorage(alertId) {
        console.log(`\n📊 Analyzing Alert #${alertId} Metadata Storage`);
        console.log('-'.repeat(50));
        
        try {
            // Get the tokenURI
            const uri = await window.legalContract.tokenURI(alertId).call();
            
            if (!uri) {
                console.log('❌ No URI set');
                return;
            }
            
            console.log('\n1️⃣ TOKEN URI STRUCTURE:');
            console.log('=' .repeat(40));
            
            if (uri.startsWith('data:application/json;base64,')) {
                console.log('✅ Type: BASE64 DATA URI');
                console.log('✅ Self-contained - No external dependencies!');
                
                // Decode the base64 to see the metadata
                const base64Part = uri.replace('data:application/json;base64,', '');
                const decodedJson = atob(base64Part);
                const metadata = JSON.parse(decodedJson);
                
                console.log('\n2️⃣ METADATA CONTENTS:');
                console.log('=' .repeat(40));
                
                // Check each field
                console.log('\n📝 DESCRIPTION FIELD:');
                if (metadata.description) {
                    console.log('✅ Description is EMBEDDED in the base64 metadata');
                    console.log(`   Length: ${metadata.description.length} characters`);
                    console.log(`   Content: "${metadata.description.substring(0, 100)}..."`);
                } else {
                    console.log('❌ No description in metadata');
                }
                
                console.log('\n🖼️ IMAGE FIELD:');
                if (metadata.image) {
                    if (metadata.image.startsWith('data:image')) {
                        console.log('✅ Image is EMBEDDED as base64 data URI');
                        console.log(`   Size: ${(metadata.image.length / 1024).toFixed(2)} KB`);
                    } else if (metadata.image.startsWith('ipfs://')) {
                        console.log('⚠️ Image points to IPFS (external dependency)');
                    } else {
                        console.log('⚠️ Image points to: ' + metadata.image.substring(0, 30));
                    }
                } else {
                    console.log('❌ No image in metadata');
                }
                
                console.log('\n📦 COMPLETE STRUCTURE:');
                console.log('The entire metadata JSON (including description) is:');
                console.log('1. Converted to JSON string');
                console.log('2. Base64 encoded');
                console.log('3. Prefixed with data:application/json;base64,');
                console.log('4. Stored as tokenURI on blockchain');
                console.log('\n✅ EVERYTHING is self-contained in the base64 URI!');
                
                // Show the complete structure
                console.log('\n📋 METADATA OBJECT:');
                console.log(JSON.stringify(metadata, null, 2));
                
            } else if (uri.startsWith('ipfs://')) {
                console.log('⚠️ Type: IPFS URI');
                console.log('❌ Has external dependency on IPFS gateway');
                
                const ipfsHash = uri.replace('ipfs://', '');
                console.log(`   IPFS Hash: ${ipfsHash}`);
                
                // Try to fetch to see what's stored
                try {
                    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
                    if (response.ok) {
                        const metadata = await response.json();
                        console.log('\n📦 IPFS METADATA STRUCTURE:');
                        console.log('Description stored in IPFS: ' + (metadata.description ? 'YES' : 'NO'));
                        console.log('Image type: ' + (metadata.image?.startsWith('data:') ? 'Embedded' : 'External'));
                    }
                } catch (e) {
                    console.log('Could not fetch IPFS metadata');
                }
            }
            
            console.log('\n' + '=' .repeat(50));
            
        } catch (error) {
            console.log('Error:', error.message);
        }
    },
    
    showIdealStructure() {
        console.log('\n💡 IDEAL METADATA STRUCTURE FOR RELIABILITY:');
        console.log('=' .repeat(70));
        
        const idealMetadata = {
            name: "Legal Notice Alert #23",
            description: "OFFICIAL LEGAL NOTICE - View and accept at BlockServed.com\n\nCase: 34-2501-TEST\nRecipient: John Doe\nAgency: District Court\n\nThis NFT represents an official legal notice requiring acknowledgment at www.BlockServed.com",
            image: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODUwIi...(base64 SVG image)",
            external_url: "https://www.blockserved.com",
            attributes: [
                { trait_type: "Type", value: "Alert NFT" },
                { trait_type: "Case Number", value: "34-2501-TEST" },
                { trait_type: "View At", value: "BlockServed.com" }
            ]
        };
        
        console.log('STEP 1: Create metadata object with ALL fields:');
        console.log(JSON.stringify(idealMetadata, null, 2));
        
        console.log('\nSTEP 2: Convert to JSON string:');
        const jsonString = JSON.stringify(idealMetadata);
        console.log('Length:', jsonString.length, 'characters');
        
        console.log('\nSTEP 3: Base64 encode the entire JSON:');
        const base64 = btoa(jsonString);
        console.log('Base64 length:', base64.length, 'characters');
        
        console.log('\nSTEP 4: Create data URI:');
        const dataUri = `data:application/json;base64,${base64}`;
        console.log('Final URI:', dataUri.substring(0, 100) + '...');
        console.log('Total size:', (dataUri.length / 1024).toFixed(2), 'KB');
        
        console.log('\n✅ RESULT: Everything (name, description, image) is in ONE base64 string!');
        console.log('No external dependencies = 100% wallet compatibility');
    },
    
    async compareStorageMethods() {
        console.log('\n📊 COMPARING STORAGE METHODS');
        console.log('=' .repeat(70));
        
        console.log('\n❌ OLD METHOD (Alerts #1-#21):');
        console.log('  tokenURI → IPFS Hash → Gateway Fetch → JSON with:');
        console.log('    • name: "Alert #1"');
        console.log('    • description: "Legal notice text..."');
        console.log('    • image: "ipfs://..." or "https://..."');
        console.log('  Problems:');
        console.log('    - Requires IPFS gateway to be online');
        console.log('    - Subject to rate limiting');
        console.log('    - CORS issues');
        console.log('    - Gateway timeouts');
        
        console.log('\n✅ NEW METHOD (Alerts #23+):');
        console.log('  tokenURI → Base64 Data URI containing:');
        console.log('    • name: "Alert #23" (embedded)');
        console.log('    • description: "Legal notice text..." (embedded)');
        console.log('    • image: "data:image/svg+xml;base64,..." (embedded)');
        console.log('  Benefits:');
        console.log('    ✓ Everything in one self-contained string');
        console.log('    ✓ No external dependencies');
        console.log('    ✓ Always displays in wallets');
        console.log('    ✓ Description always visible');
        
        console.log('\n🎯 KEY INSIGHT:');
        console.log('The description is NOT separate from the image!');
        console.log('Both are fields in the same metadata JSON object.');
        console.log('The entire object is base64 encoded together.');
    }
};

// Auto-run analysis
console.log('Starting metadata structure analysis...\n');

// Check a working alert
CheckMetadataStructure.analyzeMetadataStorage(19).then(() => {
    console.log('\n' + '=' .repeat(70));
    CheckMetadataStructure.showIdealStructure();
    console.log('\n' + '=' .repeat(70));
    CheckMetadataStructure.compareStorageMethods();
});

console.log('\nCommands:');
console.log('  CheckMetadataStructure.analyzeMetadataStorage(19)  - Check specific alert');
console.log('  CheckMetadataStructure.showIdealStructure()        - Show ideal format');
console.log('  CheckMetadataStructure.compareStorageMethods()     - Compare old vs new');