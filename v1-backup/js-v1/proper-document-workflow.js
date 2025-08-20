/**
 * PROPER DOCUMENT WORKFLOW
 * 
 * 1. Process server uploads full document(s)
 * 2. Documents compressed into single file → stored to backend
 * 3. First page extracted → overlay added → stored to backend as alert image
 * 4. At transaction time:
 *    - Full document → encrypted → uploaded to IPFS
 *    - Alert image → base64 encoded → stored on blockchain
 */

console.log('📋 Initializing proper document workflow...');

window.ProperDocumentWorkflow = {
    
    // Step 1: Handle document upload and processing
    async processDocumentUpload(files) {
        console.log('📄 Processing uploaded documents...');
        
        try {
            // 1. Combine and compress documents into single file
            const formData = new FormData();
            files.forEach((file, index) => {
                formData.append(`document_${index}`, file);
            });
            
            // Send to backend for processing
            const response = await fetch(`${window.BACKEND_API_URL || 'https://nftservice-backend.onrender.com'}/api/documents/process`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Document processing failed');
            
            const result = await response.json();
            console.log('✅ Documents processed and stored on backend');
            
            return {
                documentId: result.documentId,
                compressedDocUrl: result.compressedUrl,  // Backend URL for full document
                alertImageUrl: result.alertImageUrl,      // Backend URL for first page with overlay
                pageCount: result.pageCount,
                fileSize: result.fileSize
            };
            
        } catch (error) {
            console.error('Document processing error:', error);
            throw error;
        }
    },
    
    // Step 2: Extract and create alert image with overlay
    async createAlertImage(documentId) {
        console.log('🖼️ Creating alert image with legal overlay...');
        
        try {
            // Backend handles:
            // 1. Extract first page
            // 2. Add "SEALED LEGAL DOCUMENT" overlay
            // 3. Add case information
            // 4. Store processed image
            
            const response = await fetch(`${window.BACKEND_API_URL || 'https://nftservice-backend.onrender.com'}/api/documents/${documentId}/alert-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    overlay: {
                        text: "SEALED LEGAL DOCUMENT",
                        caseNumber: window.currentCaseNumber,
                        timestamp: new Date().toISOString(),
                        watermark: true
                    }
                })
            });
            
            if (!response.ok) throw new Error('Alert image creation failed');
            
            const result = await response.json();
            console.log('✅ Alert image created and stored on backend');
            
            return {
                alertImageUrl: result.url,        // Backend URL
                alertImageId: result.imageId,
                mimeType: result.mimeType
            };
            
        } catch (error) {
            console.error('Alert image creation error:', error);
            throw error;
        }
    },
    
    // Step 3: At transaction time - prepare everything for blockchain
    async prepareForBlockchain(documentId, recipientAddress, caseData) {
        console.log('⛓️ Preparing documents for blockchain transaction...');
        
        try {
            // 1. Get the compressed document from backend
            const docResponse = await fetch(`${window.BACKEND_API_URL || 'https://nftservice-backend.onrender.com'}/api/documents/${documentId}/compressed`);
            if (!docResponse.ok) throw new Error('Failed to fetch compressed document');
            
            const compressedDoc = await docResponse.blob();
            console.log('📦 Retrieved compressed document from backend');
            
            // 2. Encrypt the document for recipient
            const encryptionKey = this.generateEncryptionKey();
            const encryptedData = await this.encryptDocument(compressedDoc, encryptionKey);
            console.log('🔐 Document encrypted for recipient');
            
            // 3. Upload encrypted document to IPFS
            const ipfsHash = await this.uploadToIPFS(encryptedData);
            console.log('📤 Encrypted document uploaded to IPFS:', ipfsHash);
            
            // 4. Get alert image from backend and convert to base64
            const alertResponse = await fetch(`${window.BACKEND_API_URL || 'https://nftservice-backend.onrender.com'}/api/documents/${documentId}/alert-image`);
            if (!alertResponse.ok) throw new Error('Failed to fetch alert image');
            
            const alertImageBlob = await alertResponse.blob();
            const alertImageBase64 = await this.blobToBase64(alertImageBlob);
            console.log('🖼️ Alert image converted to base64 for blockchain');
            
            // 5. Create metadata for Alert NFT (using base64 image)
            const alertMetadata = {
                name: `⚠️ Legal Alert - Case ${caseData.caseNumber}`,
                description: "You have received this token as notice of a pending legal matter. The full document is encrypted and stored on IPFS.",
                image: alertImageBase64,  // Direct base64 data URI of alert image
                external_url: "https://www.blockserved.com",
                attributes: [
                    { trait_type: "Type", value: "Legal Alert" },
                    { trait_type: "Case Number", value: caseData.caseNumber },
                    { trait_type: "Document IPFS", value: ipfsHash },
                    { trait_type: "Status", value: "Sealed" },
                    { trait_type: "Recipient", value: recipientAddress }
                ]
            };
            
            // Convert metadata to data URI for blockchain
            const metadataURI = 'data:application/json;base64,' + btoa(JSON.stringify(alertMetadata));
            console.log('✅ Alert NFT metadata prepared with base64 image');
            
            return {
                // For Alert NFT
                alertMetadataURI: metadataURI,        // Contains base64 image
                
                // For Document NFT
                documentIPFS: ipfsHash,                // Encrypted full document
                encryptionKey: encryptionKey,          // For recipient to decrypt
                
                // Transaction data
                documentId: documentId,
                recipientAddress: recipientAddress,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Blockchain preparation error:', error);
            throw error;
        }
    },
    
    // Helper: Generate encryption key
    generateEncryptionKey() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },
    
    // Helper: Encrypt document
    async encryptDocument(blob, key) {
        // Use your existing encryption method
        const arrayBuffer = await blob.arrayBuffer();
        const encrypted = CryptoJS.AES.encrypt(
            CryptoJS.lib.WordArray.create(arrayBuffer),
            key
        ).toString();
        return encrypted;
    },
    
    // Helper: Upload to IPFS
    async uploadToIPFS(encryptedData) {
        if (!window.pinataApiKey || !window.pinataSecretKey) {
            throw new Error('IPFS credentials not configured');
        }
        
        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'pinata_api_key': window.pinataApiKey,
                'pinata_secret_api_key': window.pinataSecretKey
            },
            body: JSON.stringify({
                pinataContent: {
                    encrypted: encryptedData,
                    timestamp: Date.now()
                },
                pinataMetadata: {
                    name: `encrypted_document_${Date.now()}.json`
                }
            })
        });
        
        if (!response.ok) throw new Error('IPFS upload failed');
        
        const result = await response.json();
        return result.IpfsHash;
    },
    
    // Helper: Convert blob to base64 data URI
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    },
    
    // Complete workflow for serving a notice
    async serveNoticeComplete(files, recipientAddress, caseData) {
        console.log('🚀 Starting complete notice serving workflow...');
        
        try {
            // Step 1: Process and store documents on backend
            const processResult = await this.processDocumentUpload(files);
            console.log('Step 1 complete: Documents processed');
            
            // Step 2: Create alert image with overlay (stored on backend)
            const alertResult = await this.createAlertImage(processResult.documentId);
            console.log('Step 2 complete: Alert image created');
            
            // Step 3: At transaction time - prepare for blockchain
            const blockchainData = await this.prepareForBlockchain(
                processResult.documentId,
                recipientAddress,
                caseData
            );
            console.log('Step 3 complete: Ready for blockchain');
            
            // Step 4: Execute blockchain transaction
            console.log('📝 Executing blockchain transaction...');
            
            const txData = {
                recipient: recipientAddress,
                encryptedIPFS: blockchainData.documentIPFS,
                decryptionKey: blockchainData.encryptionKey,
                metadataURI: blockchainData.alertMetadataURI,  // Contains base64 alert image
                ...caseData
            };
            
            // Call smart contract (using your existing method)
            const result = await window.legalContract.serveNoticeWithMetadata(
                txData.recipient,
                txData.encryptedIPFS,
                txData.decryptionKey,
                txData.metadataURI,
                txData.caseNumber,
                txData.issuingAgency,
                txData.noticeType
            ).send({
                feeLimit: 100_000_000,
                callValue: this.calculateFees(),
                shouldPollResponse: true
            });
            
            console.log('✅ Notice served successfully!');
            console.log('Alert NFT ID:', result.alertId);
            console.log('Document NFT ID:', result.documentId);
            
            return {
                success: true,
                alertId: result.alertId,
                documentId: result.documentId,
                transactionHash: result.txid,
                ipfsHash: blockchainData.documentIPFS,
                encryptionKey: blockchainData.encryptionKey
            };
            
        } catch (error) {
            console.error('Complete workflow error:', error);
            throw error;
        }
    },
    
    // Calculate required fees
    calculateFees() {
        const creationFee = 5_000_000;   // 5 TRX
        const serviceFee = 20_000_000;   // 20 TRX
        return creationFee + serviceFee;
    }
};

// Hook into existing file upload
(function() {
    const originalHandleFiles = window.handleFileSelect;
    if (originalHandleFiles) {
        window.handleFileSelect = async function(files) {
            console.log('📎 Files selected, using proper workflow...');
            
            // Store files for later processing
            window.uploadedDocumentFiles = files;
            
            // Show first page preview with overlay simulation
            if (files && files.length > 0) {
                const firstFile = files[0];
                if (firstFile.type === 'application/pdf') {
                    // Preview with overlay indicator
                    console.log('📄 First page will get legal overlay during processing');
                }
            }
            
            // Continue with original handler
            return originalHandleFiles.call(this, files);
        };
    }
})();

console.log('✅ Proper document workflow initialized');
console.log('');
console.log('Workflow Summary:');
console.log('1️⃣ Upload documents → Compress → Store on backend');
console.log('2️⃣ Extract first page → Add overlay → Store on backend');
console.log('3️⃣ At transaction: Encrypt document → IPFS');
console.log('4️⃣ At transaction: Alert image → Base64 → Blockchain');
console.log('');
console.log('Alert NFT: Base64 image embedded (instant display)');
console.log('Document NFT: IPFS encrypted document (full content)');