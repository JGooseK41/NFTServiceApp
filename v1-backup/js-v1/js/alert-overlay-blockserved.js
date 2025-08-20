/**
 * ALERT OVERLAY WITH BLOCKSERVED.COM MESSAGE
 * Updates alert image generation to include prominent BlockServed.com message
 */

console.log('🎨 UPDATING ALERT OVERLAY WITH BLOCKSERVED MESSAGE');
console.log('=' .repeat(70));

window.AlertOverlayBlockServed = {
    
    // Generate enhanced alert image with BlockServed message
    generateAlertImage(alertId, data = {}) {
        const caseNumber = data.caseNumber || 'PENDING';
        const recipientName = data.recipientName || 'To Be Served';
        const agency = data.issuingAgency || 'Legal Authority';
        
        // SVG with prominent BlockServed.com message
        const svg = `<svg width="850" height="1100" xmlns="http://www.w3.org/2000/svg">
            <!-- White background -->
            <rect width="850" height="1100" fill="white"/>
            
            <!-- Red dashed border -->
            <rect x="25" y="25" width="800" height="1050" fill="none" stroke="red" stroke-width="5" stroke-dasharray="10,5"/>
            
            <!-- Header -->
            <text x="425" y="120" font-family="Arial Black" font-size="52" fill="red" text-anchor="middle" font-weight="900">
                LEGAL NOTICE
            </text>
            
            <!-- Alert ID Badge -->
            <rect x="325" y="150" width="200" height="60" fill="red" rx="10"/>
            <text x="425" y="190" font-family="Arial" font-size="32" fill="white" text-anchor="middle" font-weight="bold">
                Alert #${alertId}
            </text>
            
            <!-- Legal seal circle -->
            <circle cx="425" cy="350" r="90" fill="none" stroke="gold" stroke-width="8"/>
            <text x="425" y="340" font-family="Arial Black" font-size="28" fill="gold" text-anchor="middle" font-weight="bold">
                OFFICIAL
            </text>
            <text x="425" y="370" font-family="Arial Black" font-size="28" fill="gold" text-anchor="middle" font-weight="bold">
                DOCUMENT
            </text>
            
            <!-- Case Information Box -->
            <rect x="100" y="470" width="650" height="120" fill="#f0f0f0" stroke="#333" stroke-width="2" rx="5"/>
            <text x="425" y="510" font-family="Arial" font-size="20" fill="black" text-anchor="middle" font-weight="bold">
                Case: ${caseNumber}
            </text>
            <text x="425" y="540" font-family="Arial" font-size="18" fill="black" text-anchor="middle">
                To: ${recipientName}
            </text>
            <text x="425" y="570" font-family="Arial" font-size="16" fill="#666" text-anchor="middle">
                From: ${agency}
            </text>
            
            <!-- PROMINENT BLOCKSERVED MESSAGE -->
            <!-- Blue background box for visibility -->
            <rect x="50" y="620" width="750" height="180" fill="#0066CC" rx="15"/>
            
            <!-- White text on blue for maximum contrast -->
            <text x="425" y="680" font-family="Arial Black" font-size="42" fill="white" text-anchor="middle" font-weight="900">
                VIEW &amp; ACCEPT AT
            </text>
            <text x="425" y="740" font-family="Arial Black" font-size="56" fill="white" text-anchor="middle" font-weight="900">
                BlockServed.com
            </text>
            <text x="425" y="780" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
                Secure Digital Legal Service
            </text>
            
            <!-- Action Required Notice -->
            <rect x="200" y="830" width="450" height="50" fill="#FFD700" rx="5"/>
            <text x="425" y="862" font-family="Arial Black" font-size="24" fill="black" text-anchor="middle" font-weight="bold">
                ⚠️ ACTION REQUIRED ⚠️
            </text>
            
            <!-- Bottom Instructions -->
            <text x="425" y="920" font-family="Arial" font-size="20" fill="black" text-anchor="middle">
                This NFT certifies legal document delivery
            </text>
            <text x="425" y="950" font-family="Arial" font-size="20" fill="black" text-anchor="middle">
                Full document requires digital signature
            </text>
            
            <!-- Footer with blockchain verification -->
            <rect x="0" y="1000" width="850" height="100" fill="#f8f8f8"/>
            <text x="425" y="1040" font-family="Arial" font-size="16" fill="#666" text-anchor="middle">
                Blockchain Verified • Immutable Record
            </text>
            <text x="425" y="1065" font-family="Arial" font-size="14" fill="#999" text-anchor="middle">
                TRON Network • TRC-721 NFT
            </text>
        </svg>`;
        
        // Convert to base64
        const base64Svg = btoa(svg);
        return `data:image/svg+xml;base64,${base64Svg}`;
    },
    
    // Update all alert generation functions
    installOverlay() {
        console.log('Installing BlockServed overlay...');
        
        // Override the existing generation functions
        if (window.FixFutureAlertMinting) {
            window.FixFutureAlertMinting.generateBase64URI = function(alertId, data) {
                console.log('Generating alert with BlockServed message...');
                
                const imageDataURI = AlertOverlayBlockServed.generateAlertImage(alertId, data);
                
                const metadata = {
                    name: `Legal Notice Alert #${alertId}`,
                    description: `OFFICIAL LEGAL NOTICE - View and accept at BlockServed.com\n\nCase: ${data.caseNumber || 'Pending'}\nRecipient: ${data.recipientName || 'To Be Served'}\nAgency: ${data.issuingAgency || 'N/A'}\n\nThis NFT represents an official legal notice requiring acknowledgment at www.BlockServed.com`,
                    image: imageDataURI,
                    external_url: 'https://www.blockserved.com',
                    attributes: [
                        { trait_type: "Type", value: "Alert NFT" },
                        { trait_type: "Case Number", value: data.caseNumber || "Pending" },
                        { trait_type: "Agency", value: data.issuingAgency || "N/A" },
                        { trait_type: "Status", value: "Action Required" },
                        { trait_type: "View At", value: "BlockServed.com" }
                    ]
                };
                
                const metadataString = JSON.stringify(metadata);
                const base64Metadata = btoa(metadataString);
                return `data:application/json;base64,${base64Metadata}`;
            };
        }
        
        // Also update ConvertAlertsToBase64 if loaded
        if (window.ConvertAlertsToBase64) {
            window.ConvertAlertsToBase64.generateSealedAlertImage = function(alertId, noticeData) {
                console.log('🎨 Generating alert with BlockServed.com message...');
                return AlertOverlayBlockServed.generateAlertImage(alertId, noticeData);
            };
        }
        
        console.log('✅ BlockServed overlay installed');
    },
    
    // Preview function to test the image
    previewImage(alertId = 23) {
        console.log('Generating preview...');
        
        const testData = {
            caseNumber: '34-2501-TEST',
            recipientName: 'John Doe',
            issuingAgency: 'District Court'
        };
        
        const imageUri = this.generateAlertImage(alertId, testData);
        
        // Create preview window
        const previewWindow = window.open('', '_blank', 'width=900,height=1200');
        previewWindow.document.write(`
            <html>
            <head>
                <title>Alert NFT Preview</title>
                <style>
                    body { 
                        margin: 0; 
                        padding: 20px; 
                        background: #333;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    img { 
                        max-width: 100%; 
                        border: 2px solid #fff;
                        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                    }
                    h2 { 
                        color: white; 
                        font-family: Arial;
                        margin-bottom: 20px;
                    }
                    .thumbnail {
                        width: 200px;
                        margin-top: 20px;
                        border: 2px solid #fff;
                    }
                </style>
            </head>
            <body>
                <h2>Alert NFT Image Preview</h2>
                <img src="${imageUri}" alt="Alert NFT" />
                <h2>Thumbnail View (200px)</h2>
                <img src="${imageUri}" alt="Alert NFT Thumbnail" class="thumbnail" />
            </body>
            </html>
        `);
        
        console.log('✅ Preview window opened');
    }
};

// Auto-install the overlay
AlertOverlayBlockServed.installOverlay();

console.log('\n✅ Alert overlay updated with BlockServed.com message');
console.log('\nThe overlay now includes:');
console.log('  • Large "VIEW & ACCEPT AT" text');
console.log('  • Prominent "BlockServed.com" in 56px font');
console.log('  • Blue background box for visibility');
console.log('  • Action Required notice');
console.log('  • Clear even in thumbnail view');

console.log('\nCommands:');
console.log('  AlertOverlayBlockServed.previewImage()  - Preview the new overlay');
console.log('  AlertOverlayBlockServed.generateAlertImage(23, {caseNumber: "TEST"})  - Generate custom');