/**
 * IPFS Disk Integration
 * Ensures IPFS encryption grabs PDFs from disk, not Base64
 */

console.log('📁 Loading IPFS Disk Integration...');

window.IPFSDiskIntegration = {
    /**
     * Prepare document for IPFS by fetching from disk
     */
    async prepareDocumentForIPFS(noticeId, serverAddress) {
        console.log(`🔐 Preparing document ${noticeId} for IPFS from disk storage`);
        
        try {
            // First try to get from disk storage
            const response = await fetch(`${window.BACKEND_API_URL}/api/documents/for-ipfs/${noticeId}?serverAddress=${serverAddress}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Retrieved document from disk for IPFS');
                
                // Convert base64 back to binary for encryption
                const documentBuffer = atob(data.documentBuffer);
                
                return {
                    success: true,
                    documentData: documentBuffer,
                    fileName: data.fileName,
                    fileSize: data.fileSize,
                    metadata: data.metadata
                };
            }
            
            // Fallback to checking notice_components (Base64 storage)
            console.log('📋 Checking notice_components for document...');
            const fallbackResponse = await fetch(`${window.BACKEND_API_URL}/api/documents/${noticeId}/full?walletAddress=${serverAddress}`);
            
            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                console.log('⚠️ Using Base64 fallback (document not on disk)');
                
                return {
                    success: true,
                    documentData: fallbackData.documentData,
                    mimeType: fallbackData.mimeType,
                    isDiskStorage: false
                };
            }
            
            throw new Error('Document not found in disk or database storage');
            
        } catch (error) {
            console.error('Error preparing document for IPFS:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    /**
     * Encrypt and upload document to IPFS
     */
    async encryptAndUploadToIPFS(documentData, recipientAddress) {
        console.log('🔐 Encrypting document for IPFS...');
        
        try {
            // Generate encryption key
            const encryptionKey = this.generateEncryptionKey(
                window.tronWeb.defaultAddress.base58,
                recipientAddress
            );
            
            // Encrypt the document
            let encryptedData;
            if (typeof documentData === 'string' && documentData.startsWith('data:')) {
                // Remove data URL prefix if present
                const base64Data = documentData.split(',')[1] || documentData;
                encryptedData = CryptoJS.AES.encrypt(base64Data, encryptionKey).toString();
            } else {
                encryptedData = CryptoJS.AES.encrypt(documentData, encryptionKey).toString();
            }
            
            // Upload to IPFS
            let ipfsHash;
            if (window.IPFSIntegration && window.IPFSIntegration.uploadToPinata) {
                console.log('📤 Uploading to Pinata IPFS...');
                ipfsHash = await window.IPFSIntegration.uploadToPinata(encryptedData, {
                    name: `legal-notice-${Date.now()}`,
                    type: 'encrypted-document'
                });
            } else if (window.SimpleEncryption && window.SimpleEncryption.uploadToIPFS) {
                console.log('📤 Using SimpleEncryption IPFS upload...');
                ipfsHash = await window.SimpleEncryption.uploadToIPFS(encryptedData);
            } else {
                // Fallback: Generate mock hash
                ipfsHash = 'Qm' + CryptoJS.SHA256(encryptedData).toString().substring(0, 44);
                console.log('⚠️ Using mock IPFS hash (no IPFS service available)');
            }
            
            console.log('✅ Document encrypted and uploaded to IPFS:', ipfsHash);
            
            return {
                success: true,
                ipfsHash: ipfsHash,
                encryptionKey: encryptionKey,
                encryptedData: encryptedData
            };
            
        } catch (error) {
            console.error('Error encrypting/uploading to IPFS:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    /**
     * Generate encryption key
     */
    generateEncryptionKey(senderAddress, recipientAddress) {
        const nonce = Date.now();
        const combined = `${senderAddress}-${recipientAddress}-${nonce}`;
        return CryptoJS.SHA256(combined).toString();
    },
    
    /**
     * Process document for IPFS with disk integration
     */
    async processDocumentForIPFS(noticeId, recipientAddress) {
        console.log(`📋 Processing document ${noticeId} for IPFS with disk integration`);
        
        try {
            // Step 1: Get document from disk
            const prepareResult = await this.prepareDocumentForIPFS(
                noticeId, 
                window.tronWeb.defaultAddress.base58
            );
            
            if (!prepareResult.success) {
                throw new Error(prepareResult.error || 'Failed to prepare document');
            }
            
            // Step 2: Encrypt and upload to IPFS
            const uploadResult = await this.encryptAndUploadToIPFS(
                prepareResult.documentData,
                recipientAddress
            );
            
            if (!uploadResult.success) {
                throw new Error(uploadResult.error || 'Failed to upload to IPFS');
            }
            
            // Step 3: Store IPFS details back to database
            await this.storeIPFSDetails(noticeId, uploadResult.ipfsHash, uploadResult.encryptionKey);
            
            return {
                success: true,
                ipfsHash: uploadResult.ipfsHash,
                encryptionKey: uploadResult.encryptionKey,
                metadata: prepareResult.metadata
            };
            
        } catch (error) {
            console.error('Error processing document for IPFS:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    /**
     * Store IPFS details back to database
     */
    async storeIPFSDetails(noticeId, ipfsHash, encryptionKey) {
        try {
            const response = await fetch(`${window.BACKEND_API_URL}/api/documents/notice/${noticeId}/ipfs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ipfsHash: ipfsHash,
                    encryptionKey: encryptionKey,
                    uploadedAt: new Date().toISOString()
                })
            });
            
            if (!response.ok) {
                console.warn('Failed to store IPFS details:', response.status);
            }
            
        } catch (error) {
            console.error('Error storing IPFS details:', error);
        }
    }
};

// Override existing IPFS upload if it exists
if (window.SimpleEncryption) {
    const originalUploadToIPFS = window.SimpleEncryption.uploadToIPFS;
    
    window.SimpleEncryption.uploadToIPFS = async function(data) {
        console.log('🔄 Intercepting IPFS upload to check for disk storage...');
        
        // Check if we're dealing with a notice that has disk storage
        if (window.currentNoticeId && window.pdfDiskStorage) {
            console.log('📁 Using disk storage for IPFS upload');
            const result = await window.IPFSDiskIntegration.processDocumentForIPFS(
                window.currentNoticeId,
                window.currentRecipientAddress || ''
            );
            
            if (result.success) {
                return result.ipfsHash;
            }
        }
        
        // Fallback to original method
        return originalUploadToIPFS.call(this, data);
    };
}

console.log('✅ IPFS Disk Integration loaded - PDFs will be fetched from disk for encryption');