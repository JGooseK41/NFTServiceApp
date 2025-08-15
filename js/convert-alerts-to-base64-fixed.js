/**
 * CONVERT ALERT NFTs TO BASE64 DATA URIs (FIXED)
 * Fixed Unicode encoding issues
 */

console.log('🔄 CONVERTING ALERT NFTs TO BASE64 DATA URIs (FIXED VERSION)');
console.log('=' .repeat(70));

window.ConvertAlertsToBase64 = {
    
    // Safe base64 encoding that handles Unicode
    safeBase64Encode(str) {
        // Convert string to UTF-8 bytes then to base64
        const utf8Bytes = new TextEncoder().encode(str);
        const binaryString = String.fromCharCode.apply(null, utf8Bytes);
        return btoa(binaryString);
    },
    
    // Generate proper base64 data URI for Alert NFT
    async generateBase64AlertMetadata(alertId, noticeData) {
        console.log(`\n📦 Generating base64 metadata for Alert #${alertId}`);
        
        // Get alert image from backend or generate it
        let alertImage = null;
        
        // Try to get from backend first
        if (noticeData && noticeData.id) {
            try {
                const response = await fetch(`/api/images/${noticeData.id}`);
                if (response.ok) {
                    const images = await response.json();
                    if (images.alertImage) {
                        alertImage = images.alertImage;
                        console.log('✅ Found existing alert image from backend');
                    }
                }
            } catch (e) {
                console.log('⚠️ Could not fetch from backend, will generate');
            }
        }
        
        // If no image, create a placeholder with legal seal
        if (!alertImage) {
            alertImage = await this.generateSealedAlertImage(alertId, noticeData);
        }
        
        // Ensure image is base64 data URI
        if (!alertImage.startsWith('data:image')) {
            // Convert to base64 if needed
            if (alertImage.startsWith('http') || alertImage.startsWith('ipfs://')) {
                console.log('Converting external image to base64...');
                alertImage = await this.convertImageToBase64(alertImage);
            }
        }
        
        // Create metadata with embedded image
        const metadata = {
            name: `Legal Notice Alert #${alertId}`,
            description: noticeData ? 
                `OFFICIAL LEGAL NOTICE\n\nCase: ${noticeData.caseNumber || 'Pending'}\nRecipient: ${noticeData.recipientName || 'To Be Served'}\nStatus: ${noticeData.status || 'Active'}\n\nThis NFT represents an official legal notice that requires acknowledgment.` :
                `OFFICIAL LEGAL NOTICE\n\nThis Alert NFT represents an official legal notice.`,
            image: alertImage,  // Base64 embedded image
            external_url: 'https://theblockservice.com',
            attributes: [
                {
                    trait_type: "Type",
                    value: "Alert NFT"
                },
                {
                    trait_type: "Status",
                    value: noticeData?.status || "Active"
                },
                {
                    trait_type: "Case Number",
                    value: noticeData?.caseNumber || "Pending"
                }
            ]
        };
        
        // Add timestamp
        if (noticeData?.timestamp) {
            metadata.attributes.push({
                trait_type: "Served Date",
                value: new Date(noticeData.timestamp).toISOString()
            });
        }
        
        // Convert entire metadata to base64 data URI using safe encoding
        const metadataString = JSON.stringify(metadata);
        const base64Metadata = this.safeBase64Encode(metadataString);
        const dataURI = `data:application/json;base64,${base64Metadata}`;
        
        console.log('✅ Generated base64 data URI for Alert NFT');
        console.log(`   Size: ${(dataURI.length / 1024).toFixed(2)} KB`);
        console.log('   No external dependencies - will always display!');
        
        return dataURI;
    },
    
    // Generate sealed alert image as base64
    async generateSealedAlertImage(alertId, noticeData) {
        console.log('🎨 Generating sealed alert image...');
        
        // Create SVG with legal seal (using only ASCII characters)
        const caseNumber = noticeData?.caseNumber || 'PENDING';
        const status = noticeData?.status || 'AWAITING SIGNATURE';
        
        const svg = `<svg width="850" height="1100" xmlns="http://www.w3.org/2000/svg">
            <rect width="850" height="1100" fill="white"/>
            <rect x="25" y="25" width="800" height="1050" fill="none" stroke="red" stroke-width="5" stroke-dasharray="10,5"/>
            <text x="425" y="150" font-family="Arial" font-size="48" fill="red" text-anchor="middle" font-weight="bold">SEALED LEGAL DOCUMENT</text>
            <text x="425" y="200" font-family="Arial" font-size="24" fill="black" text-anchor="middle">Official Legal Notice</text>
            <text x="425" y="300" font-family="Arial" font-size="36" fill="black" text-anchor="middle" font-weight="bold">Alert #${alertId}</text>
            <text x="425" y="400" font-family="Arial" font-size="20" fill="black" text-anchor="middle">Case: ${caseNumber}</text>
            <text x="425" y="450" font-family="Arial" font-size="20" fill="black" text-anchor="middle">Status: ${status}</text>
            <circle cx="425" cy="600" r="100" fill="none" stroke="gold" stroke-width="5"/>
            <text x="425" y="590" font-family="Arial" font-size="24" fill="gold" text-anchor="middle" font-weight="bold">LEGAL</text>
            <text x="425" y="620" font-family="Arial" font-size="24" fill="gold" text-anchor="middle" font-weight="bold">NOTICE</text>
            <text x="425" y="800" font-family="Arial" font-size="18" fill="black" text-anchor="middle">This NFT certifies delivery of legal documents</text>
            <text x="425" y="830" font-family="Arial" font-size="18" fill="black" text-anchor="middle">Full document available for authorized viewing</text>
            <text x="425" y="1000" font-family="Arial" font-size="16" fill="gray" text-anchor="middle">Blockchain Verified - Immutable Record</text>
        </svg>`;
        
        // Convert SVG to base64 data URI using safe encoding
        const base64Svg = this.safeBase64Encode(svg);
        const dataUri = `data:image/svg+xml;base64,${base64Svg}`;
        
        console.log('✅ Generated sealed alert image');
        return dataUri;
    },
    
    // Convert external image to base64
    async convertImageToBase64(imageUrl) {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Failed to convert image:', error);
            // Return placeholder if conversion fails
            return this.generateSealedAlertImage(0, {});
        }
    },
    
    // Update a single Alert NFT to use base64
    async updateAlertToBase64(alertId) {
        console.log(`\n🔄 Converting Alert #${alertId} to base64...`);
        
        try {
            // Get current owner
            const owner = await window.legalContract.ownerOf(alertId).call();
            console.log(`Owner: ${owner}`);
            
            // Get notice data if available
            const notices = JSON.parse(localStorage.getItem('legalNotices') || '[]');
            const noticeData = notices.find(n => n.alertId === alertId);
            
            // Generate new base64 metadata
            const newDataURI = await this.generateBase64AlertMetadata(alertId, noticeData);
            
            // Test decode to verify it works
            try {
                const testDecode = newDataURI.split(',')[1];
                const decodedString = atob(testDecode);
                const metadata = JSON.parse(decodedString);
                console.log('✅ Metadata validated successfully');
                console.log(`   Name: ${metadata.name}`);
                console.log(`   Image type: ${metadata.image.substring(0, 30)}...`);
            } catch (e) {
                console.error('Validation failed:', e);
            }
            
            // Store for manual update or automated process
            if (!window.pendingURIUpdates) {
                window.pendingURIUpdates = {};
            }
            window.pendingURIUpdates[alertId] = newDataURI;
            
            console.log(`\n✅ Alert #${alertId} metadata prepared for update`);
            console.log(`   Size: ${(newDataURI.length / 1024).toFixed(2)} KB`);
            console.log('   Type: data:application/json;base64');
            console.log('\nNext step: Load apply-base64-updates.js and run:');
            console.log(`   ApplyBase64Updates.applyUpdate(${alertId})`);
            
            return newDataURI;
            
        } catch (error) {
            console.error(`Failed to convert Alert #${alertId}:`, error);
            return null;
        }
    },
    
    // Convert all Alert NFTs
    async convertAllAlerts() {
        console.log('\n🚀 CONVERTING ALL ALERT NFTs TO BASE64');
        console.log('=' .repeat(70));
        
        const alertIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
        const results = [];
        
        for (const id of alertIds) {
            try {
                // Check if token exists
                await window.legalContract.ownerOf(id).call();
                
                // Convert to base64
                const newURI = await this.updateAlertToBase64(id);
                
                results.push({
                    alertId: id,
                    status: newURI ? 'READY' : 'FAILED',
                    size: newURI ? `${(newURI.length / 1024).toFixed(2)} KB` : 'N/A'
                });
                
            } catch (e) {
                results.push({
                    alertId: id,
                    status: 'NOT_MINTED',
                    size: 'N/A'
                });
            }
        }
        
        console.table(results);
        
        console.log('\n✅ Conversion preparation complete');
        console.log('Base64 URIs stored in window.pendingURIUpdates');
        console.log('\nNext steps:');
        console.log('1. Load apply-base64-updates.js');
        console.log('2. Run ApplyBase64Updates.applyAllPending()');
        console.log('3. Verify alerts display properly in wallets');
        
        return results;
    }
};

// Auto-run conversion check
console.log('\nChecking current Alert NFT state...\n');
(async () => {
    // Check current state of key alerts
    const alertIds = [1, 13, 17, 19];
    console.log('Current state of key alerts:');
    
    for (const id of alertIds) {
        try {
            const uri = await window.legalContract.tokenURI(id).call();
            const type = uri.startsWith('data:') ? 'BASE64' : 
                        uri.startsWith('ipfs://') ? 'IPFS' : 'OTHER';
            console.log(`Alert #${id}: ${type}`);
        } catch (e) {
            console.log(`Alert #${id}: NOT MINTED`);
        }
    }
    
    console.log('\n✅ Ready to convert alerts to base64');
    console.log('\nCommands:');
    console.log('  ConvertAlertsToBase64.updateAlertToBase64(19)  - Convert single alert');
    console.log('  ConvertAlertsToBase64.convertAllAlerts()        - Convert all alerts');
})();