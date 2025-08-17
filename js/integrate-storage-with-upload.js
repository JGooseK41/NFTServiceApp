/**
 * Integrate Document Storage with Upload System
 * Ensures all uploaded documents are stored to backend after processing
 */

(function() {
    console.log('🔄 Integrating document storage with upload system...');
    
    // Hook into the document upload completion
    const originalHandleUpload = window.handleDocumentUpload;
    
    window.handleDocumentUpload = async function(event) {
        console.log('📤 Processing document upload with storage integration');
        
        // Call original handler
        let result;
        if (originalHandleUpload) {
            result = await originalHandleUpload.call(this, event);
        }
        
        // After documents are processed, store them to backend
        if (window.uploadedDocumentsList && window.uploadedDocumentsList.length > 0) {
            console.log(`📦 Storing ${window.uploadedDocumentsList.length} documents to backend...`);
            
            for (const doc of window.uploadedDocumentsList) {
                try {
                    await storeDocumentToBackend(doc);
                } catch (error) {
                    console.error('Failed to store document:', error);
                }
            }
        }
        
        return result;
    };
    
    /**
     * Store a document to the backend
     */
    async function storeDocumentToBackend(doc) {
        console.log(`💾 Storing document: ${doc.fileName}`);
        
        try {
            // Prepare the document data
            const documentData = {
                fileName: doc.fileName,
                fileType: doc.fileType || 'application/pdf',
                fileSize: doc.fileSize,
                preview: doc.preview,
                data: doc.data || doc.fullDocument,
                pageCount: doc.pageCount || 1,
                timestamp: doc.timestamp || Date.now(),
                isFallback: doc.isFallback || false
            };
            
            // If we have the simple image system, use it
            if (window.simpleImageSystem) {
                const imageId = Date.now().toString();
                const stored = await window.simpleImageSystem.storeImage(
                    imageId,
                    documentData.preview || documentData.data,
                    'document_upload'
                );
                
                if (stored) {
                    console.log('✅ Document stored via simple image system:', imageId);
                    doc.backendImageId = imageId;
                    doc.storedToBackend = true;
                }
            }
            
            // Also try the ensure document storage system
            if (window.DocumentStorageAssurance) {
                const docId = window.DocumentStorageAssurance.captureDocument('upload', doc);
                console.log('📸 Document captured for assurance:', docId);
            }
            
            // Store metadata locally for reference
            const storedDocs = JSON.parse(localStorage.getItem('storedDocuments') || '{}');
            const docKey = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            storedDocs[docKey] = {
                fileName: doc.fileName,
                uploadTime: new Date().toISOString(),
                backendImageId: doc.backendImageId,
                pageCount: doc.pageCount,
                fileType: doc.fileType
            };
            localStorage.setItem('storedDocuments', JSON.stringify(storedDocs));
            
        } catch (error) {
            console.error('Error storing document to backend:', error);
            throw error;
        }
    }
    
    /**
     * Hook into NFT creation to ensure documents are uploaded
     */
    const originalServeNotice = window.serveNotice;
    window.serveNotice = async function(...args) {
        console.log('🎯 Serving notice with document storage check');
        
        // Ensure any pending documents are uploaded first
        if (window.DocumentStorageAssurance?.pendingDocuments?.size > 0) {
            console.log('📤 Uploading pending documents before NFT creation...');
            
            const noticeData = {
                alertId: Date.now().toString(),
                caseNumber: args[5] || '', // caseNumber from serveNotice args
                recipientAddress: args[0] || '' // recipient from serveNotice args
            };
            
            await window.DocumentStorageAssurance.uploadPendingDocuments(noticeData);
        }
        
        // Call original function
        if (originalServeNotice) {
            return await originalServeNotice.apply(this, args);
        }
    };
    
    /**
     * Ensure documents are stored even after NFT creation
     */
    window.ensureDocumentBackup = async function(alertId, documentId) {
        console.log(`🔒 Ensuring backup for Alert: ${alertId}, Document: ${documentId}`);
        
        // Check if we have uploaded documents that need backing up
        if (window.uploadedDocumentsList && window.uploadedDocumentsList.length > 0) {
            for (const doc of window.uploadedDocumentsList) {
                if (!doc.storedToBackend) {
                    try {
                        await storeDocumentToBackend(doc);
                        console.log(`✅ Backed up document: ${doc.fileName}`);
                    } catch (error) {
                        console.error(`Failed to backup document: ${doc.fileName}`, error);
                    }
                }
            }
        }
    };
    
    /**
     * Monitor for orphaned documents and upload them
     */
    setInterval(async () => {
        // Check for any documents that haven't been stored
        if (window.uploadedDocumentsList && window.uploadedDocumentsList.length > 0) {
            const unstored = window.uploadedDocumentsList.filter(d => !d.storedToBackend);
            if (unstored.length > 0) {
                console.log(`🔍 Found ${unstored.length} unstored documents, uploading...`);
                for (const doc of unstored) {
                    try {
                        await storeDocumentToBackend(doc);
                    } catch (error) {
                        console.error('Failed to store orphaned document:', error);
                    }
                }
            }
        }
    }, 30000); // Check every 30 seconds
    
    console.log('✅ Document storage integration complete');
    console.log('   - Documents auto-stored to backend after upload');
    console.log('   - NFT creation ensures document backup');
    console.log('   - Orphaned documents monitored and uploaded');
    console.log('   - Multiple storage systems integrated');
    
})();