/**
 * Ensure Document Storage System
 * Guarantees that all document images are stored to the backend
 * Intercepts all NFT creation flows to capture and store documents
 */

console.log('📁 Loading Document Storage Assurance System...');

window.DocumentStorageAssurance = {
    
    // Track all documents that need to be stored
    pendingDocuments: new Map(),
    
    /**
     * Capture document data whenever it's set
     */
    captureDocument(source, data) {
        console.log(`📸 Capturing document from ${source}`);
        
        const documentId = Date.now().toString();
        const documentData = {
            id: documentId,
            source: source,
            timestamp: new Date().toISOString(),
            thumbnail: null,
            fullDocument: null,
            metadata: {}
        };
        
        // Extract data based on format
        if (data) {
            if (typeof data === 'object') {
                documentData.thumbnail = data.preview || data.thumbnail;
                documentData.fullDocument = data.data || data.fullDocument;
                documentData.metadata = {
                    fileName: data.fileName,
                    fileType: data.fileType,
                    fileSize: data.fileSize
                };
            } else if (typeof data === 'string') {
                // Assume it's a data URL
                documentData.fullDocument = data;
            }
        }
        
        // Store for later upload
        this.pendingDocuments.set(documentId, documentData);
        
        console.log('📦 Document captured:', {
            id: documentId,
            hasThumbnail: !!documentData.thumbnail,
            hasFullDocument: !!documentData.fullDocument
        });
        
        return documentId;
    },
    
    /**
     * Upload all pending documents to backend
     */
    async uploadPendingDocuments(noticeData) {
        console.log('📤 Uploading pending documents to backend...');
        
        if (this.pendingDocuments.size === 0) {
            console.log('No pending documents to upload');
            return null;
        }
        
        const uploads = [];
        
        for (const [docId, docData] of this.pendingDocuments) {
            try {
                const result = await this.uploadSingleDocument(docData, noticeData);
                uploads.push(result);
                
                // Remove from pending after successful upload
                this.pendingDocuments.delete(docId);
            } catch (error) {
                console.error(`Failed to upload document ${docId}:`, error);
            }
        }
        
        return uploads;
    },
    
    /**
     * Upload a single document to the backend
     */
    async uploadSingleDocument(docData, noticeData) {
        const formData = new FormData();
        
        // Add notice metadata
        formData.append('noticeId', noticeData.alertId || noticeData.documentId || Date.now().toString());
        formData.append('caseNumber', noticeData.caseNumber || '');
        formData.append('serverAddress', window.tronWeb?.defaultAddress?.base58 || '');
        formData.append('recipientAddress', noticeData.recipientAddress || '');
        formData.append('timestamp', docData.timestamp);
        formData.append('source', docData.source);
        
        // Convert and add thumbnail
        if (docData.thumbnail) {
            const thumbnailBlob = await this.dataURLtoBlob(docData.thumbnail);
            if (thumbnailBlob) {
                formData.append('thumbnail', thumbnailBlob, 'thumbnail.png');
            }
        }
        
        // Convert and add full document
        if (docData.fullDocument) {
            const documentBlob = await this.dataURLtoBlob(docData.fullDocument);
            if (documentBlob) {
                formData.append('document', documentBlob, 'document.png');
            }
        }
        
        // Add metadata
        if (docData.metadata) {
            formData.append('metadata', JSON.stringify(docData.metadata));
        }
        
        console.log('📮 Sending document to backend:', {
            noticeId: noticeData.alertId || noticeData.documentId,
            hasThumbnail: !!docData.thumbnail,
            hasDocument: !!docData.fullDocument
        });
        
        // Try multiple endpoints for redundancy
        const endpoints = [
            `${window.BACKEND_API_URL}/api/documents/upload`,
            `${window.BACKEND_API_URL}/api/notice/documents`,
            `${window.BACKEND_API_URL}/api/documents/notice/${noticeData.alertId || noticeData.documentId}/components`
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Document uploaded successfully to:', endpoint);
                    return result;
                }
            } catch (error) {
                console.warn(`Failed to upload to ${endpoint}:`, error);
            }
        }
        
        throw new Error('Failed to upload document to any endpoint');
    },
    
    /**
     * Convert data URL to Blob
     */
    async dataURLtoBlob(dataURL) {
        if (!dataURL) return null;
        
        try {
            // Handle case where dataURL might be an object
            if (typeof dataURL === 'object' && dataURL.data) {
                dataURL = dataURL.data;
            }
            
            // Check if it's already a Blob
            if (dataURL instanceof Blob) {
                return dataURL;
            }
            
            // Convert data URL to Blob
            const response = await fetch(dataURL);
            return await response.blob();
        } catch (error) {
            console.error('Error converting to Blob:', error);
            
            // Fallback: manual conversion
            try {
                const arr = dataURL.split(',');
                const mime = arr[0].match(/:(.*?);/)[1];
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }
                return new Blob([u8arr], { type: mime });
            } catch (e) {
                console.error('Fallback conversion also failed:', e);
                return null;
            }
        }
    }
};

// Monitor window.uploadedImage changes
// Since uploadedImage is already defined in index.html, we'll use a different approach
if (!window._uploadedImageMonitor) {
    window._uploadedImageMonitor = setInterval(() => {
        if (window.uploadedImage && !window._lastUploadedImage) {
            console.log('🎯 New document detected!');
            window.DocumentStorageAssurance.captureDocument('uploadedImage', window.uploadedImage);
            window._lastUploadedImage = window.uploadedImage;
        } else if (!window.uploadedImage && window._lastUploadedImage) {
            window._lastUploadedImage = null;
        }
    }, 500); // Check every 500ms
}

// Hook into the NFT creation process
const originalServeNotice = window.legalContract?.serveNotice;
if (originalServeNotice) {
    window.legalContract.serveNotice = function(...args) {
        const result = originalServeNotice.apply(this, args);
        
        // Intercept the send method
        const originalSend = result.send;
        result.send = async function(options) {
            console.log('🔄 NFT creation detected - ensuring document storage...');
            
            // Execute the transaction
            const txResult = await originalSend.call(this, options);
            
            // After successful transaction, upload documents
            if (txResult && txResult.txid) {
                console.log('📤 Transaction successful, uploading documents...');
                
                const noticeData = {
                    alertId: txResult.alertId || txResult[0],
                    documentId: txResult.documentId || txResult[1],
                    caseNumber: args[5], // case number from arguments
                    recipientAddress: args[0], // recipient address
                    txId: txResult.txid
                };
                
                // Upload any pending documents
                await window.DocumentStorageAssurance.uploadPendingDocuments(noticeData);
            }
            
            return txResult;
        };
        
        return result;
    };
}

// Also hook into batch operations
const originalServeNoticeBatch = window.legalContract?.serveNoticeBatch;
if (originalServeNoticeBatch) {
    window.legalContract.serveNoticeBatch = function(...args) {
        const result = originalServeNoticeBatch.apply(this, args);
        
        const originalSend = result.send;
        result.send = async function(options) {
            console.log('🔄 Batch NFT creation detected - ensuring document storage...');
            
            const txResult = await originalSend.call(this, options);
            
            if (txResult && txResult.txid) {
                console.log('📤 Batch transaction successful, uploading documents...');
                
                const batchNotices = args[0];
                for (let i = 0; i < batchNotices.length; i++) {
                    const noticeData = {
                        alertId: txResult[0]?.[i],
                        documentId: txResult[1]?.[i],
                        caseNumber: batchNotices[i][5],
                        recipientAddress: batchNotices[i][0],
                        txId: txResult.txid
                    };
                    
                    await window.DocumentStorageAssurance.uploadPendingDocuments(noticeData);
                }
            }
            
            return txResult;
        };
        
        return result;
    };
}

// Hook into file upload inputs
document.addEventListener('DOMContentLoaded', () => {
    // Monitor file inputs
    const fileInputs = ['uploadInput', 'documentUploadInput', 'fileInput'];
    
    fileInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', (e) => {
                console.log(`📎 File selected on ${inputId}`);
                
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        window.DocumentStorageAssurance.captureDocument(inputId, {
                            data: event.target.result,
                            fileName: file.name,
                            fileType: file.type,
                            fileSize: file.size
                        });
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    });
});

// Periodic check for orphaned documents
setInterval(() => {
    if (window.DocumentStorageAssurance.pendingDocuments.size > 0) {
        console.log(`⚠️ ${window.DocumentStorageAssurance.pendingDocuments.size} documents pending upload`);
        
        // Try to upload orphaned documents with generic metadata
        const genericNoticeData = {
            alertId: 'orphaned-' + Date.now(),
            caseNumber: 'ORPHANED',
            serverAddress: window.tronWeb?.defaultAddress?.base58 || 'unknown'
        };
        
        window.DocumentStorageAssurance.uploadPendingDocuments(genericNoticeData).catch(error => {
            console.error('Failed to upload orphaned documents:', error);
        });
    }
}, 60000); // Check every minute

console.log('✅ Document Storage Assurance System loaded!');
console.log('   📸 Captures all document data automatically');
console.log('   📤 Ensures upload to backend after NFT creation');
console.log('   🔄 Monitors for orphaned documents');
console.log('   ✅ Guarantees document persistence');