/**
 * NFT Metadata V2 - Proper metadata for Alert and Document NFTs
 */

class NFTMetadataV2 {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
    }

    /**
     * Create metadata for Alert NFT (shows thumbnail)
     */
    createAlertMetadata(noticeId, thumbnail, recipientAddress) {
        const metadata = {
            name: `Legal Notice Alert #${noticeId}`,
            description: 'LEGAL NOTICE: You have been served with an official legal document. This NFT serves as proof of delivery. Click to view and accept the document.',
            image: thumbnail, // Base64 thumbnail shows immediately
            external_url: `https://theblockservice.com/notice/${noticeId}`,
            attributes: [
                {
                    trait_type: 'Type',
                    value: 'Alert Notice'
                },
                {
                    trait_type: 'Status',
                    value: 'Delivered'
                },
                {
                    trait_type: 'Recipient',
                    value: recipientAddress
                },
                {
                    trait_type: 'Delivery Time',
                    value: new Date().toISOString()
                }
            ]
        };
        
        // Convert to data URI for immediate display
        const json = JSON.stringify(metadata);
        const base64 = btoa(unescape(encodeURIComponent(json)));
        return `data:application/json;base64,${base64}`;
    }

    /**
     * Create metadata for Document NFT (encrypted IPFS)
     */
    createDocumentMetadata(noticeId, ipfsHash, encryptionKey, recipientAddress) {
        const metadata = {
            name: `Legal Document #${noticeId}`,
            description: 'This NFT contains the encrypted legal document. Only the authorized recipient can decrypt and view it.',
            image: 'data:image/svg+xml;base64,' + this.createDocumentIcon(),
            external_url: `https://theblockservice.com/document/${noticeId}`,
            encrypted_document: ipfsHash,
            encryption_info: {
                method: 'AES',
                key_derivation: 'server-recipient-notice',
                ipfs_gateway: 'https://gateway.pinata.cloud/ipfs/'
            },
            attributes: [
                {
                    trait_type: 'Type',
                    value: 'Legal Document'
                },
                {
                    trait_type: 'Status',
                    value: 'Awaiting Signature'
                },
                {
                    trait_type: 'Recipient',
                    value: recipientAddress
                },
                {
                    trait_type: 'IPFS Hash',
                    value: ipfsHash
                }
            ]
        };
        
        // Convert to data URI
        const json = JSON.stringify(metadata);
        const base64 = btoa(unescape(encodeURIComponent(json)));
        return `data:application/json;base64,${base64}`;
    }

    /**
     * Create document icon SVG
     */
    createDocumentIcon() {
        const svg = `
            <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
                <rect width="400" height="400" fill="#f8f9fa"/>
                <rect x="50" y="50" width="300" height="380" fill="white" stroke="#dee2e6" stroke-width="2"/>
                <rect x="70" y="70" width="260" height="40" fill="#dc3545"/>
                <text x="200" y="95" text-anchor="middle" fill="white" font-size="20" font-weight="bold">
                    LEGAL DOCUMENT
                </text>
                <text x="200" y="200" text-anchor="middle" fill="#6c757d" font-size="72">
                    🔒
                </text>
                <text x="200" y="250" text-anchor="middle" fill="#495057" font-size="18">
                    Encrypted Document
                </text>
                <text x="200" y="280" text-anchor="middle" fill="#6c757d" font-size="14">
                    Signature Required
                </text>
            </svg>
        `;
        return btoa(svg);
    }

    /**
     * Prepare complete NFT data for transaction
     */
    async prepareNFTData(noticeId, recipientAddress) {
        // Get document data
        const document = window.documentSystemV2?.documents[0];
        
        if (!document) {
            throw new Error('No document uploaded');
        }
        
        // Prepare document for NFT (encrypt and upload to IPFS)
        const nftData = await window.documentSystemV2.prepareForNFT(recipientAddress);
        
        // Create metadata
        const alertMetadata = this.createAlertMetadata(
            noticeId,
            nftData.alertThumbnail,
            recipientAddress
        );
        
        const documentMetadata = this.createDocumentMetadata(
            noticeId,
            nftData.documentIPFS,
            nftData.encryptionKey,
            recipientAddress
        );
        
        return {
            alertMetadata,
            documentMetadata,
            ipfsHash: nftData.documentIPFS,
            thumbnail: nftData.alertThumbnail
        };
    }
}

// Initialize and attach to window
window.nftMetadataV2 = new NFTMetadataV2();

// Override transaction preparation
const originalCreateLegalNotice = window.createLegalNotice;
window.createLegalNotice = async function() {
    console.log('🚀 Using V2 document system for NFT creation');
    
    try {
        // Prepare NFT data
        const recipientAddress = document.getElementById('mintRecipient')?.value;
        const noticeId = window.documentSystemV2?.currentNoticeId || Date.now().toString();
        
        const nftData = await window.nftMetadataV2.prepareNFTData(noticeId, recipientAddress);
        
        // Store for transaction
        window.nftMetadata = nftData;
        
        // Continue with original flow
        if (originalCreateLegalNotice) {
            return await originalCreateLegalNotice.apply(this, arguments);
        }
    } catch (error) {
        console.error('NFT preparation failed:', error);
        if (window.uiManager) {
            window.uiManager.showNotification('error', 'Failed to prepare NFT: ' + error.message);
        }
    }
};

console.log('✅ NFT Metadata V2 loaded - proper metadata for Alert and Document NFTs');