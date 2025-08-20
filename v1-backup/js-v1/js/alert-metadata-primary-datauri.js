/**
 * ALERT METADATA - DATA URI PRIMARY
 * Ensures Alert NFTs always use base64 data URIs for maximum visibility
 * Document NFTs can use IPFS for the full encrypted content
 */

console.log('🔧 Configuring Alert NFTs to use data URIs primarily...');

// Override the metadata generation to prioritize data URIs for Alerts
(function() {
    
    // Store original function
    const originalGenerateMetadata = window.ContractFixV001?.generateMetadata;
    
    if (window.ContractFixV001) {
        window.ContractFixV001.generateMetadata = async function(noticeData) {
            console.log('📝 Generating metadata for Alert NFT...');
            
            // Create the metadata object
            const metadata = {
                name: `⚠️ Legal Alert - ${noticeData.caseNumber || 'Notice'}`,
                description: "You have received this token as notice of a pending investigation/legal matter concerning this wallet address. Visit www.blockserved.com for details.",
                image: noticeData.thumbnailUrl || noticeData.imageUrl || "https://nft-legal-service.netlify.app/images/alert-nft-thumbnail.png",
                external_url: "https://www.blockserved.com",
                attributes: [
                    {
                        trait_type: "Notice Type",
                        value: noticeData.noticeType || "Legal Alert"
                    },
                    {
                        trait_type: "Case Number",
                        value: noticeData.caseNumber
                    },
                    {
                        trait_type: "Issuing Agency",
                        value: noticeData.issuingAgency || noticeData.lawFirm || "Process Server"
                    },
                    {
                        trait_type: "Recipient",
                        value: noticeData.recipient
                    },
                    {
                        trait_type: "Service Date",
                        value: new Date().toISOString()
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
            
            // ALWAYS use data URI for Alert NFTs - most reliable!
            const dataUri = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
            console.log('✅ Alert NFT metadata created as data URI (maximum compatibility)');
            
            // Store for reference
            window.lastAlertMetadata = {
                metadata: metadata,
                uri: dataUri,
                timestamp: Date.now()
            };
            
            return dataUri;
        };
        
        console.log('✅ Alert NFT metadata will now use data URIs primarily');
    }
    
    // Also create a separate function for Document NFT metadata (can use IPFS)
    window.generateDocumentMetadata = async function(noticeData) {
        console.log('📄 Generating metadata for Document NFT (full document)...');
        
        const metadata = {
            name: `📜 Legal Document - ${noticeData.caseNumber || 'Document'}`,
            description: `Full legal document requiring signature. Case: ${noticeData.caseNumber}. Visit www.blockserved.com to view and sign.`,
            image: noticeData.documentThumbnail || "https://nft-legal-service.netlify.app/images/document-nft.png",
            external_url: "https://www.blockserved.com",
            document_ipfs: noticeData.encryptedIPFS, // Link to full encrypted document
            attributes: [
                {
                    trait_type: "Document Type",
                    value: noticeData.noticeType || "Legal Document"
                },
                {
                    trait_type: "Case Number",
                    value: noticeData.caseNumber
                },
                {
                    trait_type: "Requires",
                    value: "Digital Signature"
                },
                {
                    trait_type: "Status",
                    value: "Awaiting Signature"
                }
            ]
        };
        
        // For documents, we can try IPFS first since they're not as critical for display
        if (window.pinataApiKey && window.pinataSecretKey && noticeData.encryptedIPFS) {
            try {
                const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'pinata_api_key': window.pinataApiKey,
                        'pinata_secret_api_key': window.pinataSecretKey
                    },
                    body: JSON.stringify({
                        pinataContent: metadata,
                        pinataMetadata: {
                            name: `document_metadata_${noticeData.caseNumber}_${Date.now()}.json`
                        }
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    const ipfsUrl = `ipfs://${result.IpfsHash}`;
                    console.log('✅ Document metadata uploaded to IPFS:', ipfsUrl);
                    return ipfsUrl;
                }
            } catch (error) {
                console.warn('IPFS upload failed for document metadata:', error);
            }
        }
        
        // Fallback to data URI for documents too
        const dataUri = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
        console.log('⚠️ Using data URI for document metadata (IPFS unavailable)');
        return dataUri;
    };
    
    // Hook into the serve notice flow
    const originalServeNotice = window.serveNotice;
    if (originalServeNotice) {
        window.serveNotice = async function(noticeData) {
            console.log('🚀 Serving notice with optimized metadata strategy...');
            console.log('   Alert NFT: Will use data URI (instant display)');
            console.log('   Document NFT: Will try IPFS, fallback to data URI');
            
            // Ensure Alert gets data URI
            if (window.ContractFixV001) {
                const alertMetadataURI = await window.ContractFixV001.generateMetadata(noticeData);
                noticeData.metadataURI = alertMetadataURI; // Force data URI for Alert
            }
            
            return originalServeNotice.call(this, noticeData);
        };
    }
    
})();

// Utility to check current metadata type
window.checkMetadataType = async function(tokenId) {
    try {
        const uri = await window.legalContract.tokenURI(tokenId).call();
        
        if (!uri) {
            return { id: tokenId, type: 'NONE', status: '❌ No URI' };
        } else if (uri.startsWith('data:')) {
            return { id: tokenId, type: 'DATA_URI', status: '✅ Data URI (most reliable)' };
        } else if (uri.startsWith('ipfs://')) {
            return { id: tokenId, type: 'IPFS', status: '⚠️ IPFS (may fail)' };
        } else if (uri.startsWith('http')) {
            return { id: tokenId, type: 'HTTP', status: '⚠️ HTTP (depends on server)' };
        } else {
            return { id: tokenId, type: 'UNKNOWN', status: '❓ Unknown type' };
        }
    } catch (e) {
        return { id: tokenId, type: 'ERROR', status: '❌ Error checking' };
    }
};

// Function to fix existing Alert NFTs to use data URIs
window.fixAlertToDataURI = async function(alertId) {
    console.log(`🔧 Converting Alert #${alertId} to data URI...`);
    
    // Get any existing data
    let caseNumber = `Alert-${alertId}`;
    let noticeType = "Legal Alert";
    
    try {
        const notice = await window.legalContract.alertNotices(alertId).call();
        if (notice && notice.caseNumber) {
            caseNumber = notice.caseNumber;
        }
        if (notice && notice.noticeType) {
            noticeType = notice.noticeType;
        }
    } catch (e) {
        // Use defaults
    }
    
    // Create optimized metadata
    const metadata = {
        name: `⚠️ Legal Alert #${alertId}`,
        description: "You have received this token as notice of a pending investigation/legal matter concerning this wallet address.",
        image: "https://nft-legal-service.netlify.app/images/alert-nft-thumbnail.png",
        external_url: "https://www.blockserved.com",
        attributes: [
            { trait_type: "Type", value: "Legal Alert" },
            { trait_type: "Token ID", value: alertId.toString() },
            { trait_type: "Case", value: caseNumber },
            { trait_type: "Status", value: "Active" }
        ]
    };
    
    // Create data URI
    const dataURI = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
    
    console.log('✅ Data URI created for Alert #' + alertId);
    console.log('To apply on-chain, owner must call:');
    console.log(`legalContract.setTokenURI(${alertId}, "${dataURI}").send({ feeLimit: 100000000 })`);
    
    return dataURI;
};

console.log('✅ Alert metadata system configured:');
console.log('   • Alert NFTs will use data URIs (base64) for instant visibility');
console.log('   • Document NFTs can use IPFS for full encrypted content');
console.log('   • Maximum wallet compatibility ensured');
console.log('');
console.log('Commands:');
console.log('  checkMetadataType(tokenId)    - Check what type of metadata a token uses');
console.log('  fixAlertToDataURI(alertId)    - Convert Alert to data URI');