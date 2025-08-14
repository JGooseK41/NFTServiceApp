/**
 * FIX FUTURE ALERT MINTING
 * Ensure all new Alert NFTs use base64 data URIs instead of IPFS
 */

console.log('🔧 FIXING FUTURE ALERT NFT MINTING');
console.log('=' .repeat(70));

window.FixFutureAlertMinting = {
    
    // Override the serveNotice function to use base64 URIs
    installFix() {
        console.log('Installing base64 URI fix for future mints...');
        
        // Store original serveNotice if not already stored
        if (!window.originalServeNotice) {
            window.originalServeNotice = window.legalContract.serveNotice;
        }
        
        // Create wrapper for serveNotice
        window.legalContract.serveNotice = function(
            recipient, 
            caseNumber, 
            issuingAgency, 
            description, 
            deliveryMethod, 
            alertTokenURI,  // This is what we need to replace!
            documentTokenURI, 
            encryptedDocumentIPFS,
            isRestricted,
            documentsIPFS
        ) {
            console.log('🔄 Intercepting serveNotice call...');
            
            // Check if alertTokenURI is IPFS
            if (alertTokenURI && alertTokenURI.startsWith('ipfs://')) {
                console.log('⚠️ Replacing IPFS URI with base64 for Alert NFT');
                
                // Generate base64 URI instead
                const alertId = window.nextAlertId || 23; // Estimate next ID
                const base64URI = FixFutureAlertMinting.generateBase64URI(alertId, {
                    caseNumber,
                    recipient,
                    issuingAgency,
                    description
                });
                
                alertTokenURI = base64URI;
                console.log('✅ Using base64 URI for Alert NFT');
            }
            
            // Call original function with modified URI
            return window.originalServeNotice.call(
                this,
                recipient,
                caseNumber,
                issuingAgency,
                description,
                deliveryMethod,
                alertTokenURI,  // Now base64!
                documentTokenURI,
                encryptedDocumentIPFS,
                isRestricted,
                documentsIPFS
            );
        };
        
        console.log('✅ Fix installed - future Alert NFTs will use base64');
    },
    
    // Generate base64 URI for Alert NFT
    generateBase64URI(alertId, data) {
        // Create SVG image
        const svg = `<svg width="850" height="1100" xmlns="http://www.w3.org/2000/svg">
            <rect width="850" height="1100" fill="white"/>
            <rect x="25" y="25" width="800" height="1050" fill="none" stroke="red" stroke-width="5" stroke-dasharray="10,5"/>
            <text x="425" y="150" font-family="Arial" font-size="48" fill="red" text-anchor="middle" font-weight="bold">SEALED LEGAL DOCUMENT</text>
            <text x="425" y="200" font-family="Arial" font-size="24" fill="black" text-anchor="middle">Official Legal Notice</text>
            <text x="425" y="300" font-family="Arial" font-size="36" fill="black" text-anchor="middle" font-weight="bold">Alert #${alertId}</text>
            <text x="425" y="400" font-family="Arial" font-size="20" fill="black" text-anchor="middle">Case: ${data.caseNumber || 'PENDING'}</text>
            <text x="425" y="450" font-family="Arial" font-size="20" fill="black" text-anchor="middle">Recipient: ${data.recipient ? data.recipient.substring(0, 10) + '...' : 'TBD'}</text>
            <circle cx="425" cy="600" r="100" fill="none" stroke="gold" stroke-width="5"/>
            <text x="425" y="590" font-family="Arial" font-size="24" fill="gold" text-anchor="middle" font-weight="bold">LEGAL</text>
            <text x="425" y="620" font-family="Arial" font-size="24" fill="gold" text-anchor="middle" font-weight="bold">NOTICE</text>
            <text x="425" y="800" font-family="Arial" font-size="18" fill="black" text-anchor="middle">This NFT certifies delivery of legal documents</text>
            <text x="425" y="830" font-family="Arial" font-size="18" fill="black" text-anchor="middle">Full document available for authorized viewing</text>
            <text x="425" y="1000" font-family="Arial" font-size="16" fill="gray" text-anchor="middle">Blockchain Verified - Immutable Record</text>
        </svg>`;
        
        // Encode SVG to base64
        const base64Svg = btoa(svg);
        const imageDataURI = `data:image/svg+xml;base64,${base64Svg}`;
        
        // Create metadata
        const metadata = {
            name: `Legal Notice Alert #${alertId}`,
            description: `Official Legal Notice\n\nCase: ${data.caseNumber || 'Pending'}\nAgency: ${data.issuingAgency || 'N/A'}\n\nThis NFT represents an official legal notice requiring acknowledgment.`,
            image: imageDataURI,
            external_url: 'https://theblockservice.com',
            attributes: [
                { trait_type: "Type", value: "Alert NFT" },
                { trait_type: "Case Number", value: data.caseNumber || "Pending" },
                { trait_type: "Agency", value: data.issuingAgency || "N/A" },
                { trait_type: "Status", value: "Active" }
            ]
        };
        
        // Convert metadata to base64 data URI
        const metadataString = JSON.stringify(metadata);
        const base64Metadata = btoa(metadataString);
        return `data:application/json;base64,${base64Metadata}`;
    },
    
    // Also fix the UI function that prepares URIs
    fixUIGeneration() {
        console.log('Fixing UI metadata generation...');
        
        // Override any function that generates alert URIs
        if (window.generateAlertMetadata) {
            const original = window.generateAlertMetadata;
            window.generateAlertMetadata = async function(noticeData) {
                console.log('Generating base64 metadata for alert...');
                
                const alertId = noticeData.alertId || window.nextAlertId || 23;
                return FixFutureAlertMinting.generateBase64URI(alertId, noticeData);
            };
        }
        
        // Fix ContractFixV001 if it exists
        if (window.ContractFixV001 && window.ContractFixV001.generateMetadata) {
            window.ContractFixV001.generateMetadata = async function(noticeData) {
                console.log('✅ Using base64 for Alert NFT (ContractFixV001)');
                
                const alertId = noticeData.alertId || window.nextAlertId || 23;
                return FixFutureAlertMinting.generateBase64URI(alertId, noticeData);
            };
        }
        
        console.log('✅ UI generation fixed');
    },
    
    // Check next alert ID
    async getNextAlertId() {
        try {
            const totalNotices = await window.legalContract.totalNotices().call();
            const nextAlertId = (parseInt(totalNotices) + 1) * 2 - 1;
            window.nextAlertId = nextAlertId;
            console.log('Next Alert ID will be:', nextAlertId);
            return nextAlertId;
        } catch (e) {
            console.log('Could not determine next alert ID');
            return 23; // Best guess
        }
    },
    
    // Apply all fixes
    async applyAllFixes() {
        console.log('\n🚀 APPLYING ALL FIXES FOR FUTURE MINTS');
        console.log('=' .repeat(70));
        
        // Get next alert ID
        await this.getNextAlertId();
        
        // Install contract wrapper
        this.installFix();
        
        // Fix UI generation
        this.fixUIGeneration();
        
        console.log('\n✅ ALL FIXES APPLIED');
        console.log('Future Alert NFTs will use base64 data URIs');
        console.log('This ensures 100% wallet compatibility');
        
        return true;
    }
};

// Auto-apply fixes
console.log('\nApplying fixes for future Alert NFT mints...\n');
FixFutureAlertMinting.applyAllFixes().then(() => {
    console.log('\n✅ Ready to mint new alerts with base64 URIs');
    console.log('Existing alerts (#1-#21) will remain on IPFS');
    console.log('New alerts (#23+) will use base64 for reliability');
});