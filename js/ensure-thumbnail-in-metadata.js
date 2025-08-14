/**
 * ENSURE THUMBNAIL IN METADATA
 * Makes sure the Alert NFT includes the thumbnail image
 */

console.log('🖼️ Ensuring thumbnails in Alert NFT metadata...');

// Override the metadata generation to include thumbnail
(function() {
    // Store original function
    const originalGenerateMetadata = window.ContractFixV001?.generateMetadata;
    
    if (window.ContractFixV001 && originalGenerateMetadata) {
        window.ContractFixV001.generateMetadata = async function(noticeData) {
            console.log('📸 Generating metadata with thumbnail...');
            console.log('Notice data received:', noticeData);
            
            // Check if we have a thumbnail IPFS hash
            let imageUrl = noticeData.imageUrl;
            
            // If we have a thumbnailHash but no imageUrl, construct it
            if (!imageUrl && noticeData.thumbnailHash) {
                imageUrl = `https://gateway.pinata.cloud/ipfs/${noticeData.thumbnailHash}`;
                console.log('✅ Using thumbnail from IPFS:', imageUrl);
            }
            
            // If we have thumbnailIPFS, use that
            if (!imageUrl && noticeData.thumbnailIPFS) {
                if (noticeData.thumbnailIPFS.startsWith('ipfs://')) {
                    imageUrl = noticeData.thumbnailIPFS.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
                } else {
                    imageUrl = `https://gateway.pinata.cloud/ipfs/${noticeData.thumbnailIPFS}`;
                }
                console.log('✅ Using thumbnail from thumbnailIPFS:', imageUrl);
            }
            
            // If still no image, check for base64 thumbnail
            if (!imageUrl && noticeData.thumbnail) {
                if (noticeData.thumbnail.startsWith('data:image')) {
                    imageUrl = noticeData.thumbnail;
                    console.log('✅ Using base64 thumbnail');
                }
            }
            
            // Use fraud investigation metadata with thumbnail
            const metadata = {
                name: `Legal Matter #${noticeData.caseNumber}`,
                description: window.FraudInvestigationMetadata ? 
                    window.FraudInvestigationMetadata.generateDescription(noticeData) :
                    `${noticeData.noticeType || 'Legal Notice'} - Case: ${noticeData.caseNumber}`,
                image: imageUrl || "https://nft-legal-service.netlify.app/images/legal-notice-nft.png",
                external_url: "https://www.blockserved.com",
                attributes: [
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
                        trait_type: "Access Portal",
                        value: "www.blockserved.com"
                    },
                    {
                        trait_type: "Document Location",
                        value: "IPFS (Encrypted)"
                    },
                    {
                        trait_type: "Delivery Method",
                        value: "Blockchain Verified"
                    }
                ]
            };
            
            console.log('📋 Metadata generated with image:', metadata.image);
            
            // Try to upload to IPFS
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
                            pinataContent: metadata,
                            pinataMetadata: {
                                name: `metadata_${noticeData.caseNumber}_${Date.now()}.json`
                            }
                        })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        const ipfsUrl = `ipfs://${result.IpfsHash}`;
                        console.log('✅ Metadata with thumbnail uploaded to IPFS:', ipfsUrl);
                        return ipfsUrl;
                    }
                }
            } catch (error) {
                console.warn('IPFS upload failed, using data URI:', error);
            }
            
            // Fallback to data URI
            const dataUri = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
            console.log('📦 Using data URI for metadata (includes thumbnail)');
            return dataUri;
        };
    }
    
    // Also ensure thumbnail is passed in notice data
    const originalServeNotice = window.serveNotice;
    if (originalServeNotice) {
        window.serveNotice = async function(noticeData) {
            console.log('🚀 Serving notice with thumbnail check...');
            
            // Check if we have thumbnail data from the NFT generation
            if (window.lastNFTAssets?.thumbnailHash && !noticeData.thumbnailHash) {
                noticeData.thumbnailHash = window.lastNFTAssets.thumbnailHash;
                console.log('✅ Added thumbnail hash to notice data:', noticeData.thumbnailHash);
            }
            
            // Call original function
            return originalServeNotice.call(this, noticeData);
        };
    }
})();

// Store NFT assets globally so we can access thumbnail
window.addEventListener('load', function() {
    // Hook into NFT asset generation
    const originalProcessDocumentWithIPFS = window.IPFSIntegration?.processDocumentForNFT;
    
    if (originalProcessDocumentWithIPFS) {
        window.IPFSIntegration.processDocumentForNFT = async function(...args) {
            const result = await originalProcessDocumentWithIPFS.apply(this, args);
            
            // Store the result globally
            if (result && result.thumbnailHash) {
                window.lastNFTAssets = result;
                console.log('💾 Stored NFT assets with thumbnail:', result.thumbnailHash);
            }
            
            return result;
        };
    }
});

console.log('✅ Thumbnail insurance loaded');
console.log('Alert NFTs will now include thumbnail images');