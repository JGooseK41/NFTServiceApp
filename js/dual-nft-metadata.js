/**
 * DUAL NFT METADATA SYSTEM
 * Creates separate metadata for Alert NFT and Document NFT
 * 
 * Alert NFT: Shows thumbnail with sealed overlay (immediately visible like Bored Apes)
 * Document NFT: Shows "requires signature" message
 */

console.log('🎭 Loading Dual NFT Metadata System...');

window.DualNFTMetadata = {
    
    // Generate metadata for ALERT NFT (with thumbnail)
    generateAlertMetadata: async function(noticeData, thumbnailHash) {
        console.log('🚨 Generating ALERT NFT metadata with thumbnail...');
        
        const metadata = {
            name: `⚠️ Legal Alert #${noticeData.caseNumber}`,
            description: `You have received this token as a notice of a pending investigation/legal matter concerning this wallet address and the assets contained within.

The full legal document with detailed facts of the case and directions on how to proceed and preserve your claim have been uploaded to the blockchain via IPFS.

HOW TO VIEW YOUR DOCUMENTS:
Open www.blockserved.com from inside your wallet app's browser (not Safari, Chrome, or other external browsers). In most wallet apps, look for a "Browser" or "DApp" tab, then navigate to www.blockserved.com to connect your wallet and view your documents.

FREE TO SIGN: The sender has included TRX to cover your transaction fees for signing.

Case Reference: ${noticeData.caseNumber}
Notice Type: ${noticeData.noticeType}
Status: DELIVERED`,
            
            // THIS IS THE KEY - thumbnail shows immediately in wallet
            image: thumbnailHash ? `https://gateway.pinata.cloud/ipfs/${thumbnailHash}` : 
                   "https://nft-legal-service.netlify.app/images/sealed-legal-notice.png",
            
            external_url: "https://www.blockserved.com",
            
            attributes: [
                {
                    trait_type: "NFT Type",
                    value: "Alert Notice"
                },
                {
                    trait_type: "Document Type",
                    value: noticeData.noticeType || "Legal Notice"
                },
                {
                    trait_type: "Case Reference",
                    value: noticeData.caseNumber
                },
                {
                    trait_type: "Issued By",
                    value: noticeData.issuingAgency || noticeData.lawFirm || "Process Server"
                },
                {
                    trait_type: "Status",
                    value: "Delivered"
                },
                {
                    trait_type: "Visibility",
                    value: "Public Thumbnail"
                }
            ]
        };
        
        console.log('✅ Alert metadata created with image:', metadata.image);
        return metadata;
    },
    
    // Generate metadata for DOCUMENT NFT (requires signature)
    generateDocumentMetadata: async function(noticeData) {
        console.log('📄 Generating DOCUMENT NFT metadata...');
        
        const metadata = {
            name: `📜 Legal Document #${noticeData.caseNumber}`,
            description: `This NFT contains the full encrypted legal documents for Case #${noticeData.caseNumber}.

⚠️ SIGNATURE REQUIRED TO VIEW

To access the complete documents:
1. Open your wallet app's built-in browser (look for "Browser" or "DApp" tab)
2. Navigate to www.blockserved.com from inside the wallet browser
3. Connect this wallet and sign to view documents
4. Your signature constitutes legal acknowledgment of service

IMPORTANT: Do not use Safari, Chrome, or other external browsers - you must access blockserved.com from inside your wallet app to connect.

The documents are encrypted and stored on IPFS. Only authorized parties can decrypt them after signing.`,
            
            // Document NFT shows a different image - "signature required" graphic
            image: "https://nft-legal-service.netlify.app/images/signature-required.png",
            
            external_url: "https://www.blockserved.com",
            
            attributes: [
                {
                    trait_type: "NFT Type",
                    value: "Legal Document"
                },
                {
                    trait_type: "Document Type",
                    value: noticeData.noticeType || "Legal Document"
                },
                {
                    trait_type: "Case Reference",
                    value: noticeData.caseNumber
                },
                {
                    trait_type: "Page Count",
                    value: noticeData.pageCount || "Multiple"
                },
                {
                    trait_type: "Status",
                    value: "Awaiting Signature"
                },
                {
                    trait_type: "Encryption",
                    value: "AES-256 Encrypted"
                },
                {
                    trait_type: "Storage",
                    value: "IPFS"
                }
            ]
        };
        
        console.log('✅ Document metadata created');
        return metadata;
    },
    
    // Upload both metadata sets and return URIs
    uploadDualMetadata: async function(noticeData, thumbnailHash) {
        console.log('📤 Uploading dual NFT metadata...');
        
        const results = {
            alertMetadataURI: null,
            documentMetadataURI: null
        };
        
        try {
            // Generate both metadata sets
            const alertMetadata = await this.generateAlertMetadata(noticeData, thumbnailHash);
            const documentMetadata = await this.generateDocumentMetadata(noticeData);
            
            // Upload Alert metadata
            if (window.pinataApiKey && window.pinataSecretKey) {
                // Upload Alert NFT metadata
                const alertResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'pinata_api_key': window.pinataApiKey,
                        'pinata_secret_api_key': window.pinataSecretKey
                    },
                    body: JSON.stringify({
                        pinataContent: alertMetadata,
                        pinataMetadata: {
                            name: `alert_metadata_${noticeData.caseNumber}_${Date.now()}.json`
                        }
                    })
                });
                
                if (alertResponse.ok) {
                    const alertResult = await alertResponse.json();
                    results.alertMetadataURI = `ipfs://${alertResult.IpfsHash}`;
                    console.log('✅ Alert metadata uploaded:', results.alertMetadataURI);
                }
                
                // Upload Document NFT metadata
                const docResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'pinata_api_key': window.pinataApiKey,
                        'pinata_secret_api_key': window.pinataSecretKey
                    },
                    body: JSON.stringify({
                        pinataContent: documentMetadata,
                        pinataMetadata: {
                            name: `document_metadata_${noticeData.caseNumber}_${Date.now()}.json`
                        }
                    })
                });
                
                if (docResponse.ok) {
                    const docResult = await docResponse.json();
                    results.documentMetadataURI = `ipfs://${docResult.IpfsHash}`;
                    console.log('✅ Document metadata uploaded:', results.documentMetadataURI);
                }
            }
            
            // Fallback to data URIs if IPFS fails
            if (!results.alertMetadataURI) {
                results.alertMetadataURI = 'data:application/json;base64,' + 
                    btoa(JSON.stringify(alertMetadata));
                console.log('⚠️ Using data URI for Alert metadata');
            }
            
            if (!results.documentMetadataURI) {
                results.documentMetadataURI = 'data:application/json;base64,' + 
                    btoa(JSON.stringify(documentMetadata));
                console.log('⚠️ Using data URI for Document metadata');
            }
            
        } catch (error) {
            console.error('Metadata upload error:', error);
        }
        
        return results;
    }
};

// Override the contract metadata generation to use dual system
(function() {
    if (window.ContractFixV001) {
        const originalGenerate = window.ContractFixV001.generateMetadata;
        
        window.ContractFixV001.generateMetadata = async function(noticeData) {
            console.log('🎭 Using DUAL metadata system...');
            
            // Check if we have a thumbnail
            const thumbnailHash = noticeData.thumbnailHash || 
                                 window.lastNFTAssets?.thumbnailHash ||
                                 null;
            
            if (thumbnailHash) {
                console.log('✅ Found thumbnail for Alert NFT:', thumbnailHash);
            } else {
                console.log('⚠️ No thumbnail found, using default sealed image');
            }
            
            // For now, return Alert metadata (since contract only sets one URI)
            // In future, we need contract upgrade to support dual URIs
            const alertMetadata = await DualNFTMetadata.generateAlertMetadata(
                noticeData, 
                thumbnailHash
            );
            
            // Upload to IPFS
            try {
                if (window.pinataApiKey && window.pinataSecretKey) {
                    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'pinata_api_key': window.pinataApiKey,
                            'pinata_secret_api_key': window.pinataSecretKey
                        },
                        body: JSON.stringify({
                            pinataContent: alertMetadata,
                            pinataMetadata: {
                                name: `alert_${noticeData.caseNumber}_${Date.now()}.json`
                            }
                        })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        const ipfsUrl = `ipfs://${result.IpfsHash}`;
                        console.log('✅ Alert NFT metadata uploaded:', ipfsUrl);
                        
                        // Store for document metadata later
                        window.pendingDocumentMetadata = await DualNFTMetadata.generateDocumentMetadata(noticeData);
                        
                        return ipfsUrl;
                    }
                }
            } catch (error) {
                console.warn('IPFS upload failed:', error);
            }
            
            // Fallback to data URI
            const dataUri = 'data:application/json;base64,' + btoa(JSON.stringify(alertMetadata));
            return dataUri;
        };
    }
})();

console.log('✅ Dual NFT Metadata System loaded');
console.log('');
console.log('Alert NFT: Shows thumbnail immediately (like Bored Apes)');
console.log('Document NFT: Shows "signature required" message');
console.log('');
console.log('Note: Current contract only supports one metadata URI.');
console.log('Future contract upgrade needed for true dual metadata.');