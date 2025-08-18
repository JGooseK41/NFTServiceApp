/**
 * PDF Disk Storage System
 * Ensures PDFs are stored on Render disk, not as Base64
 * Only thumbnails should be Base64
 */

console.log('📁 Loading PDF Disk Storage System...');

class PDFDiskStorage {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        this.initialized = false;
    }

    /**
     * Upload PDF to server disk storage
     * Returns URL to the stored file
     */
    async uploadPDFToDisk(file, noticeId, metadata = {}) {
        console.log(`📤 Uploading PDF to disk: ${file.name}`);
        
        const formData = new FormData();
        
        // Add the actual PDF file (not Base64!)
        formData.append('document', file);
        
        // Add metadata
        formData.append('noticeId', noticeId || Date.now().toString());
        formData.append('caseNumber', metadata.caseNumber || '');
        formData.append('serverAddress', window.tronWeb?.defaultAddress?.base58 || '');
        formData.append('recipientAddress', metadata.recipientAddress || '');
        formData.append('fileName', file.name);
        formData.append('fileType', file.type);
        formData.append('fileSize', file.size.toString());
        
        try {
            const response = await fetch(`${this.backend}/api/documents/upload-pdf`, {
                method: 'POST',
                body: formData // No Content-Type header - let browser set it for multipart
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('✅ PDF uploaded to disk:', result);
            
            return {
                success: true,
                diskUrl: result.documentUrl, // e.g., /uploads/documents/file-123.pdf
                fullUrl: `${this.backend}${result.documentUrl}`,
                fileId: result.fileId,
                fileSize: file.size,
                fileName: file.name
            };
            
        } catch (error) {
            console.error('Error uploading PDF to disk:', error);
            throw error;
        }
    }

    /**
     * Create thumbnail from PDF (Base64)
     * This is the ONLY thing that should be Base64
     */
    async createPDFThumbnail(file) {
        console.log('🖼️ Creating PDF thumbnail...');
        
        // For now, create a placeholder thumbnail
        // In production, this would extract first page of PDF
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 400, 600);
        
        // PDF icon
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('📄', 200, 200);
        
        // File name
        ctx.fillStyle = '#374151';
        ctx.font = '20px Arial';
        ctx.fillText(file.name.substring(0, 30), 200, 300);
        
        ctx.font = '16px Arial';
        ctx.fillText(`${(file.size / 1024 / 1024).toFixed(2)} MB`, 200, 350);
        
        // Return as Base64
        return canvas.toDataURL('image/png');
    }

    /**
     * Store complete notice with disk PDF and Base64 thumbnail
     */
    async storeNoticeWithDiskPDF(noticeData, pdfFile, thumbnail) {
        console.log('💾 Storing notice with disk PDF...');
        
        // First upload PDF to disk
        const diskResult = await this.uploadPDFToDisk(pdfFile, noticeData.noticeId, noticeData);
        
        // Then store the reference in database
        const payload = {
            noticeId: noticeData.noticeId,
            caseNumber: noticeData.caseNumber,
            serverAddress: window.tronWeb?.defaultAddress?.base58,
            recipientAddress: noticeData.recipientAddress,
            
            // Thumbnail is Base64
            alertThumbnail: thumbnail,
            
            // Document is URL to disk file
            documentUrl: diskResult.diskUrl,
            documentFullUrl: diskResult.fullUrl,
            
            // Metadata
            documentFileName: pdfFile.name,
            documentFileSize: pdfFile.size,
            documentFileType: pdfFile.type,
            
            transactionHash: noticeData.transactionHash
        };
        
        try {
            const response = await fetch(`${this.backend}/api/documents/notice/${noticeData.noticeId}/components`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to store notice: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('✅ Notice stored with disk PDF:', result);
            
            return result;
            
        } catch (error) {
            console.error('Error storing notice:', error);
            throw error;
        }
    }

    /**
     * Retrieve PDF from disk for IPFS encryption
     */
    async getPDFFromDisk(documentUrl) {
        console.log(`📥 Retrieving PDF from disk: ${documentUrl}`);
        
        try {
            const fullUrl = documentUrl.startsWith('http') 
                ? documentUrl 
                : `${this.backend}${documentUrl}`;
                
            const response = await fetch(fullUrl);
            
            if (!response.ok) {
                throw new Error(`Failed to retrieve PDF: ${response.status}`);
            }
            
            const blob = await response.blob();
            console.log(`✅ Retrieved PDF: ${blob.size} bytes`);
            
            return blob;
            
        } catch (error) {
            console.error('Error retrieving PDF from disk:', error);
            throw error;
        }
    }

    /**
     * Get PDF for IPFS encryption
     * This retrieves the actual file from disk for encryption
     */
    async getPDFForIPFS(noticeId) {
        console.log(`🔐 Getting PDF for IPFS encryption: ${noticeId}`);
        
        try {
            // Get notice data including document URL
            const response = await fetch(`${this.backend}/api/documents/notice/${noticeId}/components`);
            
            if (!response.ok) {
                throw new Error(`Failed to get notice data: ${response.status}`);
            }
            
            const noticeData = await response.json();
            
            if (!noticeData.documentUrl) {
                throw new Error('No document URL found for notice');
            }
            
            // Retrieve the actual PDF from disk
            const pdfBlob = await this.getPDFFromDisk(noticeData.documentUrl);
            
            return {
                pdfBlob: pdfBlob,
                documentUrl: noticeData.documentUrl,
                metadata: noticeData
            };
            
        } catch (error) {
            console.error('Error getting PDF for IPFS:', error);
            throw error;
        }
    }
}

// Initialize globally
window.pdfDiskStorage = new PDFDiskStorage();

// Override document upload to use disk storage
(function() {
    const originalHandleUpload = window.handleDocumentUpload;
    
    window.handleDocumentUpload = async function(event) {
        console.log('🔄 Intercepting document upload for disk storage...');
        
        const files = Array.from(event.target.files);
        if (!files || files.length === 0) return;
        
        for (const file of files) {
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                console.log(`📄 Processing PDF for disk storage: ${file.name}`);
                
                try {
                    // Create thumbnail (Base64)
                    const thumbnail = await window.pdfDiskStorage.createPDFThumbnail(file);
                    
                    // Add to upload list with reference to actual file
                    const documentData = {
                        id: Date.now() + Math.random(),
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        originalFile: file, // Keep reference to actual file
                        preview: thumbnail, // Base64 thumbnail
                        isDiskStorage: true, // Flag for disk storage
                        order: window.uploadedDocumentsList.length
                    };
                    
                    window.uploadedDocumentsList.push(documentData);
                    
                    // Update UI
                    if (window.updateDocumentsList) {
                        window.updateDocumentsList();
                    }
                    
                    console.log('✅ PDF queued for disk storage');
                    
                } catch (error) {
                    console.error('Error processing PDF:', error);
                    uiManager.showNotification('error', `Failed to process ${file.name}`);
                }
            } else {
                // Non-PDF files can use original handler
                if (originalHandleUpload) {
                    return originalHandleUpload.call(this, event);
                }
            }
        }
    };
})();

console.log('✅ PDF Disk Storage System loaded');
console.log('📝 PDFs will be stored on disk, only thumbnails as Base64');