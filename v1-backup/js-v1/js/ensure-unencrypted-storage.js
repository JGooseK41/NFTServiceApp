/**
 * Ensure Unencrypted Document Storage
 * Stores unencrypted copies of documents for process server access via case manager
 */

class UnencryptedDocumentStorage {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
    }

    /**
     * Store unencrypted document for case manager access
     * This runs alongside the encrypted IPFS storage
     */
    async storeUnencryptedDocument(noticeId, documentData, metadata) {
        console.log('📁 Storing unencrypted document for case manager access...');
        
        try {
            const formData = new FormData();
            
            // Add the unencrypted document
            if (documentData) {
                let blob;
                
                // Handle different data formats
                if (documentData instanceof File) {
                    blob = documentData;
                } else if (documentData instanceof Blob) {
                    blob = documentData;
                } else if (typeof documentData === 'string' && documentData.startsWith('data:')) {
                    // Convert base64 to blob
                    const response = await fetch(documentData);
                    blob = await response.blob();
                } else {
                    console.warn('Unknown document data format');
                    return null;
                }
                
                formData.append('unencryptedDocument', blob, metadata.fileName || 'document.pdf');
            }
            
            // Add metadata
            formData.append('noticeId', noticeId);
            formData.append('caseNumber', metadata.caseNumber || '');
            formData.append('serverAddress', metadata.serverAddress || window.tronWeb?.defaultAddress?.base58 || '');
            formData.append('documentType', 'unencrypted_full');
            formData.append('accessType', 'case_manager');
            
            // Store in backend
            const response = await fetch(`${this.backend}/api/documents/notice/${noticeId}/unencrypted`, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Unencrypted document stored for case manager:', result);
                return result;
            } else {
                console.error('Failed to store unencrypted document:', response.status);
                return null;
            }
            
        } catch (error) {
            console.error('Error storing unencrypted document:', error);
            return null;
        }
    }

    /**
     * Retrieve unencrypted document for viewing in case manager
     */
    async getUnencryptedDocument(noticeId, serverAddress) {
        try {
            const response = await fetch(
                `${this.backend}/api/documents/notice/${noticeId}/unencrypted?serverAddress=${serverAddress}`
            );
            
            if (response.ok) {
                const data = await response.json();
                return data;
            } else {
                console.error('Failed to retrieve unencrypted document');
                return null;
            }
        } catch (error) {
            console.error('Error retrieving unencrypted document:', error);
            return null;
        }
    }

    /**
     * Create a viewable URL for the document in case manager
     */
    getDocumentViewUrl(noticeId) {
        return `${this.backend}/api/documents/notice/${noticeId}/view`;
    }
}

// Initialize global instance
window.unencryptedStorage = new UnencryptedDocumentStorage();

// Hook into the upload process to store unencrypted copies
const originalUploadNoticeDocuments = window.uploadNoticeDocuments;
window.uploadNoticeDocuments = async function(noticeData, maxRetries) {
    // Call original upload function
    const result = await originalUploadNoticeDocuments.call(this, noticeData, maxRetries);
    
    // Also store unencrypted copy if we have document data
    if (window.uploadedImage && window.uploadedImage.data) {
        const metadata = {
            caseNumber: noticeData.caseNumber,
            serverAddress: noticeData.serverAddress || window.tronWeb?.defaultAddress?.base58,
            fileName: window.uploadedImage.fileName || 'document.pdf'
        };
        
        await window.unencryptedStorage.storeUnencryptedDocument(
            noticeData.noticeId || noticeData.alertId,
            window.uploadedImage.data,
            metadata
        );
    }
    
    return result;
};

console.log('✅ Unencrypted Document Storage initialized - documents will be accessible in case manager');