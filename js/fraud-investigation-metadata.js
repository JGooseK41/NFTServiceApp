/**
 * FRAUD INVESTIGATION METADATA
 * Strategic descriptions designed to encourage document access while capturing evidence
 */

window.FraudInvestigationMetadata = {
    
    // Generate strategic description for fraud suspects
    generateDescription(noticeData) {
        const caseNumber = noticeData.caseNumber;
        const noticeType = noticeData.noticeType || 'Legal Notice';
        
        // Strategic description that encourages access without raising alarm
        const description = `You have received this token as a notice of a pending investigation/legal matter concerning this wallet address and the assets contained within. 

The full legal document with detailed facts of the case and directions on how to proceed and preserve your claim have been uploaded to the blockchain via IPFS. 

The documents are encrypted but may be viewed and downloaded by visiting www.blockserved.com.

Case Reference: ${caseNumber}
Notice Type: ${noticeType}`;

        return description;
    },
    
    // Generate metadata for wallet display
    generateMetadata(noticeData) {
        const metadata = {
            name: `Legal Matter #${noticeData.caseNumber}`,
            description: this.generateDescription(noticeData),
            image: noticeData.imageUrl || "https://nft-legal-service.netlify.app/images/legal-notice-nft.png",
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
        
        return metadata;
    },
    
    // Alternative descriptions for different scenarios
    getAlternativeDescriptions() {
        return {
            settlement: `SETTLEMENT OPPORTUNITY - Case Reference Available

This NFT represents official documentation regarding a matter where you may be entitled to compensation or other remedies. 

IMPORTANT: The documents contain settlement terms that may expire. Early review is recommended.

Access your complete documentation at www.blockserved.com by connecting this wallet. The portal provides secure, confidential access to review all options.

This blockchain delivery ensures transparent, tamper-proof service of these time-sensitive documents.`,
            
            notice: `LEGAL NOTICE - Response Options Available

You have received official documents requiring your attention. This matter includes multiple resolution pathways that should be reviewed promptly.

The complete documentation package includes:
• Full details of the matter
• Available response options
• Your rights and remedies
• Timeline for response

Visit www.blockserved.com and connect this wallet to access your secure document portal. Early review typically provides the most options.

Blockchain verification ensures delivery confirmation and provides you with proof of receipt.`,
            
            seizure: `ASSET NOTICE - Important Information Enclosed

This NFT contains official documentation regarding assets and available remedies. Time-sensitive information requires prompt review.

IMMEDIATE REVIEW RECOMMENDED:
Documents contain critical information about:
• Asset status and claims
• Available remedies and options
• Response procedures
• Your legal rights

ACCESS YOUR DOCUMENTS:
1. Go to www.blockserved.com
2. Connect this wallet
3. Review complete documentation
4. Understand all available options

This blockchain-verified notice ensures transparent delivery. Your document access is confidential and allows full review of the matter.`
        };
    }
};

// Override the existing metadata generation
(function() {
    if (window.ContractFixV001) {
        const original = window.ContractFixV001.generateMetadata;
        
        window.ContractFixV001.generateMetadata = async function(noticeData) {
            console.log('🎯 Using fraud investigation metadata...');
            
            // Use strategic metadata
            const metadata = FraudInvestigationMetadata.generateMetadata(noticeData);
            
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
                        console.log('✅ Strategic metadata uploaded to IPFS:', ipfsUrl);
                        return ipfsUrl;
                    }
                }
            } catch (error) {
                console.warn('IPFS upload failed, using data URI:', error);
            }
            
            // Fallback to data URI
            const dataUri = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
            return dataUri;
        };
    }
})();

// Test function to preview description
window.previewFraudDescription = function(caseNumber = "TEST-2025-001") {
    const description = FraudInvestigationMetadata.generateDescription({ 
        caseNumber: caseNumber,
        noticeType: "Legal Notice"
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('WALLET DESCRIPTION PREVIEW');
    console.log('='.repeat(70));
    console.log(description);
    console.log('='.repeat(70));
    console.log('\nCharacter count:', description.length);
    console.log('This will appear when recipient views NFT in TronLink');
    
    return description;
};

console.log('✅ Fraud Investigation Metadata loaded');
console.log('Strategic descriptions designed to encourage access');
console.log('Run: previewFraudDescription() to see what recipients will see');