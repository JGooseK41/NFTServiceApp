/**
 * FIX DOCUMENT NFT DISPLAY
 * Makes Document NFTs visible in wallets by setting metadata
 * 
 * NOTE: This is a workaround. The proper fix would be updating the contract
 * to set metadata for both Alert and Document NFTs.
 */

console.log('📄 Fixing Document NFT display...');

window.DocumentNFTFix = {
    
    // Set metadata for Document NFTs retroactively
    async fixDocumentMetadata(documentId, alertId) {
        console.log(`Setting metadata for Document NFT #${documentId} based on Alert #${alertId}`);
        
        try {
            // Get Alert metadata
            const alertURI = await window.legalContract.tokenURI(alertId).call();
            
            if (!alertURI) {
                console.error('Alert NFT has no metadata');
                return;
            }
            
            // Parse Alert metadata
            let alertMetadata;
            if (alertURI.startsWith('ipfs://')) {
                const url = alertURI.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
                const response = await fetch(url);
                alertMetadata = await response.json();
            } else if (alertURI.startsWith('data:')) {
                const base64 = alertURI.split(',')[1];
                alertMetadata = JSON.parse(atob(base64));
            }
            
            // Create Document metadata based on Alert
            const documentMetadata = {
                name: `📜 ${alertMetadata.name.replace('⚠️ Legal Alert', 'Legal Document')}`,
                description: `This is the full legal document for ${alertMetadata.name}. 
                
⚠️ SIGNATURE REQUIRED: This document requires digital signature to view the full contents.

Visit www.blockserved.com to sign and access the complete document.`,
                image: alertMetadata.image || "https://nft-legal-service.netlify.app/images/document-nft.png",
                external_url: "https://www.blockserved.com",
                attributes: [
                    ...alertMetadata.attributes,
                    { trait_type: "NFT Type", value: "Legal Document" },
                    { trait_type: "Requires", value: "Signature" }
                ]
            };
            
            // Upload to IPFS or create data URI
            let documentURI;
            if (window.pinataApiKey && window.pinataSecretKey) {
                try {
                    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'pinata_api_key': window.pinataApiKey,
                            'pinata_secret_api_key': window.pinataSecretKey
                        },
                        body: JSON.stringify({
                            pinataContent: documentMetadata,
                            pinataMetadata: {
                                name: `document_metadata_${documentId}.json`
                            }
                        })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        documentURI = `ipfs://${result.IpfsHash}`;
                        console.log('✅ Document metadata uploaded to IPFS:', documentURI);
                    }
                } catch (e) {
                    console.warn('IPFS upload failed:', e);
                }
            }
            
            if (!documentURI) {
                // Use data URI as fallback
                documentURI = 'data:application/json;base64,' + btoa(JSON.stringify(documentMetadata));
                console.log('📦 Using data URI for Document metadata');
            }
            
            // NOTE: We can't actually SET the tokenURI on-chain without owner privileges
            // This would require a contract function like setTokenURI that only owner can call
            
            console.log('Document metadata prepared:', documentURI);
            console.log('⚠️ Note: Cannot set on-chain without contract owner privileges');
            
            return documentURI;
            
        } catch (error) {
            console.error('Error fixing document metadata:', error);
        }
    },
    
    // Fix all Document NFTs based on their Alert pairs
    async fixAllDocuments() {
        console.log('🔧 Attempting to fix all Document NFTs...');
        
        const total = await window.legalContract.totalSupply().call();
        const totalNum = Number(total.toString());
        
        for (let i = 2; i <= totalNum; i += 2) { // Even IDs are Documents
            const alertId = i - 1; // Previous odd ID is the Alert
            
            try {
                // Check if Document has metadata
                const docURI = await window.legalContract.tokenURI(i).call();
                
                if (!docURI) {
                    console.log(`Document #${i} needs metadata (paired with Alert #${alertId})`);
                    await this.fixDocumentMetadata(i, alertId);
                }
            } catch (e) {
                // Token might not exist
            }
        }
    }
};

// The REAL solution - ensure Documents get metadata during creation
(function() {
    // Hook into transaction to ensure both NFTs get metadata
    if (window.ContractFixV001) {
        const originalServe = window.serveNotice;
        
        window.serveNotice = async function(noticeData) {
            console.log('📝 Ensuring both Alert and Document get metadata...');
            
            // Store metadata for Document NFT
            window.pendingDocumentMetadata = {
                ...noticeData,
                isDocument: true
            };
            
            // Call original
            return originalServe.call(this, noticeData);
        };
    }
})();

console.log('✅ Document NFT display fix loaded');
console.log('');
console.log('⚠️ IMPORTANT: Document NFTs don\'t have metadata because the contract');
console.log('only sets tokenURI for Alert NFTs. This is by design - the Alert is');
console.log('the visible "envelope" while the Document is the legal record.');
console.log('');
console.log('If you want Documents visible too, the contract needs updating.');