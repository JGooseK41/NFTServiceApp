/**
 * Upload Notice Documents to Backend
 * Stores document images in the backend for later retrieval
 */

async function uploadNoticeDocuments(noticeData, maxRetries = 3) {
    if (!window.BACKEND_API_URL) {
        console.warn('Backend not configured, skipping document upload');
        return null;
    }

    // Retry logic for resilience
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Upload attempt ${attempt} of ${maxRetries}...`);
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
        
        // Generate noticeId early for disk storage
        let noticeId = noticeData.noticeId || noticeData.alertId || noticeData.documentId;
        
        // Use ID manager for safe ID generation
        if (!noticeId || noticeId === 'null' || noticeId === 'undefined') {
            // Use ID manager if available, otherwise fallback to safe generation
            if (window.idManager) {
                noticeId = window.idManager.generateSafeIntegerId().toString();
                console.log('Generated managed notice ID:', noticeId);
            } else {
                // Fallback: Generate ID that fits in INTEGER range (max 2147483647)
                const timestamp = Date.now();
                const truncated = parseInt(timestamp.toString().slice(-6)); // Last 6 digits
                const random = Math.floor(Math.random() * 999); // Random 3 digits
                noticeId = `${truncated}${random}`.slice(0, 9); // Ensure max 9 digits
                console.log('Generated fallback notice ID:', noticeId);
            }
        } else {
            // Validate existing ID and convert if needed
            if (window.idManager && !window.idManager.isValidIntegerId(noticeId)) {
                const originalId = noticeId;
                noticeId = window.idManager.toSafeIntegerId(noticeId).toString();
                console.log(`Converted ID from ${originalId} to safe ID: ${noticeId}`);
            }
        }
        
        // Check if we have documents to upload
        if (window.uploadedImage || window.uploadedDocumentsList) {
            // Check if this is a PDF that needs disk storage
            const docs = window.uploadedDocumentsList || [window.uploadedImage];
            const hasPDF = docs.some(doc => doc && (doc.fileType === 'application/pdf' || 
                                                    doc.fileName?.toLowerCase().endsWith('.pdf')));
            
            if (hasPDF && window.pdfDiskStorage) {
                console.log('📁 Using PDF Disk Storage for document upload');
                
                // Find the PDF document
                const pdfDoc = docs.find(doc => doc && (doc.fileType === 'application/pdf' || 
                                                         doc.fileName?.toLowerCase().endsWith('.pdf')));
                
                if (pdfDoc && pdfDoc.originalFile) {
                    // Upload PDF to disk storage
                    try {
                        const diskResult = await window.pdfDiskStorage.uploadPDFToDisk(
                            pdfDoc.originalFile, 
                            noticeId,
                            {
                                caseNumber: noticeData.caseNumber,
                                serverAddress: noticeData.serverAddress || tronWeb.defaultAddress.base58,
                                recipientAddress: noticeData.recipient || noticeData.recipientAddress
                            }
                        );
                        
                        console.log('✅ PDF uploaded to disk:', diskResult);
                        
                        // Add disk URL to form data instead of file
                        formData.append('documentUrl', diskResult.diskUrl);
                        formData.append('documentFullUrl', diskResult.fullUrl);
                        formData.append('documentFileName', pdfDoc.fileName);
                        formData.append('documentFileSize', pdfDoc.fileSize.toString());
                        formData.append('documentFileType', pdfDoc.fileType);
                        
                        // Still add thumbnail as Base64 (alert image only)
                        if (pdfDoc.preview) {
                            const thumbnailBlob = await dataURLtoBlob(pdfDoc.preview);
                            formData.append('thumbnail', thumbnailBlob, 'thumbnail.png');
                        }
                    } catch (error) {
                        console.error('Failed to upload PDF to disk:', error);
                        throw error;
                    }
                } else {
                    console.warn('PDF document missing originalFile reference');
                }
            } else {
                // Non-PDF or fallback: Convert data URLs to Blobs (for images, etc.)
                if (window.uploadedImage) {
                    // Handle thumbnail (alert image) - always Base64
                    if (window.uploadedImage.preview) {
                        const thumbnailBlob = await dataURLtoBlob(window.uploadedImage.preview);
                        formData.append('thumbnail', thumbnailBlob, 'thumbnail.png');
                    }
                    
                    // Handle full document - only as Base64 if not PDF
                    if (window.uploadedImage.data && !hasPDF) {
                        let documentData = window.uploadedImage.data;
                        // Handle case where data might be an object
                        if (typeof documentData === 'object' && documentData.data) {
                            documentData = documentData.data;
                        }
                        const documentBlob = await dataURLtoBlob(documentData);
                        formData.append('unencryptedDocument', documentBlob, 'document.png');
                    }
                }
            }
        }
        
        // noticeId already generated above
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
            
            console.error(`Upload attempt ${attempt} failed:`, errorDetails);
            lastError = new Error(`Document upload failed! ${errorDetails}`);
            
            // If not the last attempt, wait before retrying
            if (attempt < maxRetries) {
                console.log(`Retrying in ${attempt * 2} seconds...`);
                await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                continue; // Try again
            }
            
            // All attempts failed - throw error to stop transaction
            throw new Error(`CRITICAL: All ${maxRetries} upload attempts failed! ${errorDetails}. Transaction aborted to prevent fund loss.`);
        }
        } catch (error) {
            console.error(`Error on attempt ${attempt}:`, error);
            lastError = error;
            
            // If not the last attempt, wait before retrying
            if (attempt < maxRetries) {
                console.log(`Retrying in ${attempt * 2} seconds...`);
                await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                continue; // Try again
            }
        }
    }
    
    // All retries exhausted
    console.error('All upload attempts failed:', lastError);
    throw lastError || new Error('Document upload failed after all retries');
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