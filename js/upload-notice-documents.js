/**
 * Upload Notice Documents to Backend
 * Stores document images in the backend for later retrieval
 */

async function uploadNoticeDocuments(noticeData) {
    if (!window.BACKEND_API_URL) {
        console.warn('Backend not configured, skipping document upload');
        return null;
    }

    try {
        const formData = new FormData();
        
        // Add notice metadata
        formData.append('caseNumber', noticeData.caseNumber || '');
        formData.append('serverAddress', noticeData.serverAddress || tronWeb.defaultAddress.base58);
        formData.append('recipientAddress', noticeData.recipient || noticeData.recipientAddress || '');
        formData.append('alertId', noticeData.alertId || '');
        formData.append('documentId', noticeData.documentId || '');
        formData.append('nftDescription', noticeData.tokenName || 'Legal Notice');
        formData.append('noticeType', noticeData.noticeType || 'Legal Notice');
        formData.append('issuingAgency', noticeData.issuingAgency || '');
        formData.append('ipfsHash', noticeData.ipfsHash || '');
        formData.append('encryptionKey', noticeData.encryptionKey || '');
        
        // Convert data URLs to Blobs and add to form
        if (window.uploadedImage) {
            // Handle thumbnail (alert image)
            if (window.uploadedImage.preview) {
                const thumbnailBlob = await dataURLtoBlob(window.uploadedImage.preview);
                formData.append('thumbnail', thumbnailBlob, 'thumbnail.png');
            }
            
            // Handle full document
            if (window.uploadedImage.data) {
                let documentData = window.uploadedImage.data;
                // Handle case where data might be an object
                if (typeof documentData === 'object' && documentData.data) {
                    documentData = documentData.data;
                }
                const documentBlob = await dataURLtoBlob(documentData);
                formData.append('unencryptedDocument', documentBlob, 'document.png');
            }
        }
        
        // Upload to backend - use a more robust noticeId
        // Try to use the actual NFT ID if available, otherwise use a formatted timestamp
        let noticeId = noticeData.noticeId || noticeData.alertId || noticeData.documentId;
        
        // If no valid ID, create a formatted ID that backend might accept
        if (!noticeId || noticeId === 'null' || noticeId === 'undefined') {
            // Create a notice ID that looks like an NFT token ID
            noticeId = Math.floor(Date.now() / 1000).toString();
            console.log('Generated fallback notice ID:', noticeId);
        }
        
        console.log('Uploading documents for notice ID:', noticeId);
        console.log('FormData contents:', {
            caseNumber: noticeData.caseNumber,
            serverAddress: noticeData.serverAddress || tronWeb.defaultAddress.base58,
            recipientAddress: noticeData.recipient || noticeData.recipientAddress,
            alertId: noticeData.alertId,
            documentId: noticeData.documentId,
            hasThumnail: !!window.uploadedImage?.preview,
            hasDocument: !!window.uploadedImage?.data
        });
        
        const response = await fetch(`${window.BACKEND_API_URL}/api/documents/notice/${noticeId}/components`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Documents uploaded successfully:', result);
            return result;
        } else {
            // Try to get error details from response
            let errorDetails = `Status: ${response.status}`;
            try {
                const errorText = await response.text();
                if (errorText) {
                    errorDetails += ` - ${errorText}`;
                }
            } catch (e) {
                // Ignore error reading response
            }
            
            console.error('Failed to upload documents:', errorDetails);
            console.warn('Backend document upload failed but continuing with transaction');
            
            // Return null but don't throw - allow the transaction to continue
            return null;
        }
    } catch (error) {
        console.error('Error uploading notice documents:', error);
        return null;
    }
}

/**
 * Convert data URL to Blob
 */
async function dataURLtoBlob(dataURL) {
    if (!dataURL) return null;
    
    try {
        // Handle case where dataURL might be a blob URL or file object
        if (dataURL instanceof Blob) {
            return dataURL;
        }
        
        // Extract base64 data
        const base64Data = dataURL.split(',')[1];
        if (!base64Data) {
            console.warn('Invalid data URL format');
            return null;
        }
        
        // Get MIME type
        const mimeMatch = dataURL.match(/^data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        
        // Convert base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        return new Blob([bytes], { type: mimeType });
    } catch (error) {
        console.error('Error converting data URL to Blob:', error);
        return null;
    }
}

// Make functions globally available
window.uploadNoticeDocuments = uploadNoticeDocuments;
window.dataURLtoBlob = dataURLtoBlob;