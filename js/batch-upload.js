/**
 * Batch Upload Handler
 * Uploads documents for multiple recipients in a single request
 */

async function uploadBatchDocuments(batchData, maxRetries = 3) {
    if (!window.BACKEND_API_URL) {
        console.warn('Backend not configured, skipping batch upload');
        return null;
    }

    // Validate batch data
    if (!batchData.recipients || batchData.recipients.length === 0) {
        throw new Error('No recipients provided for batch upload');
    }

    console.log('Starting batch upload for', batchData.recipients.length, 'recipients');

    // Retry logic
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Batch upload attempt ${attempt} of ${maxRetries}...`);
            
            const formData = new FormData();
            
            // Add batch metadata
            formData.append('batchId', batchData.batchId || generateBatchId());
            formData.append('recipients', JSON.stringify(batchData.recipients));
            formData.append('caseNumber', batchData.caseNumber || '');
            formData.append('serverAddress', batchData.serverAddress || tronWeb.defaultAddress.base58);
            formData.append('noticeType', batchData.noticeType || 'Legal Notice');
            formData.append('issuingAgency', batchData.issuingAgency || '');
            formData.append('ipfsHash', batchData.ipfsHash || '');
            formData.append('encryptionKey', batchData.encryptionKey || '');
            
            // Add IDs if available
            if (batchData.alertIds && batchData.alertIds.length > 0) {
                formData.append('alertIds', JSON.stringify(batchData.alertIds));
            }
            if (batchData.documentIds && batchData.documentIds.length > 0) {
                formData.append('documentIds', JSON.stringify(batchData.documentIds));
            }
            
            // Add document files
            if (window.uploadedImage) {
                // Add thumbnail
                if (window.uploadedImage.preview) {
                    const thumbnailBlob = await dataURLtoBlob(window.uploadedImage.preview);
                    formData.append('thumbnail', thumbnailBlob, 'thumbnail.png');
                }
                
                // Add full document
                if (window.uploadedImage.data) {
                    let documentData = window.uploadedImage.data;
                    if (typeof documentData === 'object' && documentData.data) {
                        documentData = documentData.data;
                    }
                    const documentBlob = await dataURLtoBlob(documentData);
                    formData.append('document', documentBlob, 'document.png');
                }
            }
            
            // Send batch upload request
            const response = await fetch(`${window.BACKEND_API_URL}/api/batch/documents`, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Batch upload successful:', result);
                
                // Check if all recipients succeeded
                if (result.failureCount > 0) {
                    console.warn(`Batch upload partially failed: ${result.failureCount} failures`);
                }
                
                return result;
            } else {
                // Get error details
                let errorDetails = `Status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorDetails = errorData.error;
                    }
                } catch (e) {
                    try {
                        const errorText = await response.text();
                        if (errorText) {
                            errorDetails += ` - ${errorText}`;
                        }
                    } catch (e2) {
                        // Ignore
                    }
                }
                
                console.error(`Batch upload attempt ${attempt} failed:`, errorDetails);
                lastError = new Error(`Batch upload failed: ${errorDetails}`);
                
                // Retry with exponential backoff
                if (attempt < maxRetries) {
                    const delay = attempt * 2000;
                    console.log(`Retrying in ${delay/1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                throw lastError;
            }
        } catch (error) {
            console.error(`Error on batch upload attempt ${attempt}:`, error);
            lastError = error;
            
            if (attempt < maxRetries) {
                const delay = attempt * 2000;
                console.log(`Retrying in ${delay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
        }
    }
    
    // All retries exhausted
    throw lastError || new Error('Batch upload failed after all retries');
}

/**
 * Check batch upload status
 */
async function checkBatchStatus(batchId) {
    if (!window.BACKEND_API_URL || !batchId) {
        return null;
    }
    
    try {
        const response = await fetch(`${window.BACKEND_API_URL}/api/batch/${batchId}/status`);
        
        if (response.ok) {
            const result = await response.json();
            return result;
        }
        
        console.error('Failed to fetch batch status:', response.status);
        return null;
        
    } catch (error) {
        console.error('Error checking batch status:', error);
        return null;
    }
}

/**
 * Generate batch ID
 */
function generateBatchId() {
    if (window.idManager) {
        return window.idManager.generateBatchId();
    }
    return `BATCH_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

/**
 * Convert data URL to Blob (reuse from upload-notice-documents.js)
 */
async function dataURLtoBlob(dataURL) {
    if (!dataURL) return null;
    
    try {
        if (dataURL instanceof Blob) {
            return dataURL;
        }
        
        const base64Data = dataURL.split(',')[1];
        if (!base64Data) {
            console.warn('Invalid data URL format');
            return null;
        }
        
        const mimeMatch = dataURL.match(/^data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        
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
window.uploadBatchDocuments = uploadBatchDocuments;
window.checkBatchStatus = checkBatchStatus;

// Export for Node.js/testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        uploadBatchDocuments,
        checkBatchStatus,
        generateBatchId
    };
}