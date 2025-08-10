/**
 * Multi-Document Upload Handler
 * Allows uploading multiple documents and combining them into one notice
 */

class MultiDocumentHandler {
    constructor() {
        this.documents = [];
        this.isProcessing = false;
        this.maxDocuments = 10;
        this.maxSizePerFile = 10 * 1024 * 1024; // 10MB per file
        this.maxTotalSize = 50 * 1024 * 1024; // 50MB total
    }

    /**
     * Initialize the multi-document upload UI
     */
    init() {
        this.updateUI();
        console.log('Multi-document handler initialized');
    }

    /**
     * Add a document to the queue
     */
    async addDocument(file) {
        // Validation
        if (this.documents.length >= this.maxDocuments) {
            this.showNotification('error', `Maximum ${this.maxDocuments} documents allowed`);
            return false;
        }

        if (file.size > this.maxSizePerFile) {
            this.showNotification('error', `File "${file.name}" exceeds 10MB limit`);
            return false;
        }

        const totalSize = this.documents.reduce((sum, doc) => sum + doc.size, 0) + file.size;
        if (totalSize > this.maxTotalSize) {
            this.showNotification('error', 'Total size would exceed 50MB limit');
            return false;
        }

        // Read file
        const reader = new FileReader();
        const fileData = await new Promise((resolve, reject) => {
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        // Add to queue
        const document = {
            id: Date.now() + Math.random(),
            name: file.name,
            type: file.type,
            size: file.size,
            data: fileData,
            addedAt: new Date()
        };

        this.documents.push(document);
        this.updateUI();
        
        this.showNotification('success', `Added: ${file.name}`);
        return true;
    }

    /**
     * Remove a document from the queue
     */
    removeDocument(documentId) {
        this.documents = this.documents.filter(doc => doc.id !== documentId);
        this.updateUI();
    }

    /**
     * Clear all documents
     */
    clearAll() {
        if (confirm('Remove all documents from queue?')) {
            this.documents = [];
            this.updateUI();
        }
    }

    /**
     * Compile and prepare all documents
     */
    async compileDocuments() {
        if (this.documents.length === 0) {
            this.showNotification('error', 'No documents to compile');
            return null;
        }

        if (this.isProcessing) {
            this.showNotification('warning', 'Already processing...');
            return null;
        }

        this.isProcessing = true;
        this.updateProcessingStatus('Compiling documents...', 10);

        try {
            let combinedDocument;

            if (this.documents.length === 1) {
                // Single document - use as is
                combinedDocument = this.documents[0];
                this.updateProcessingStatus('Processing single document...', 30);
            } else {
                // Multiple documents - need to combine
                this.updateProcessingStatus('Merging multiple documents...', 20);
                
                // Check if all are PDFs
                const allPDFs = this.documents.every(doc => 
                    doc.type === 'application/pdf' || doc.name.endsWith('.pdf')
                );

                if (allPDFs && window.PDFLib) {
                    // Merge PDFs using pdf-lib
                    combinedDocument = await this.mergePDFs();
                } else {
                    // Convert to images and combine
                    combinedDocument = await this.combineAsImages();
                }
            }

            this.updateProcessingStatus('Saving unencrypted document to backend...', 50);

            // Store compiled document
            window.uploadedImage = {
                data: combinedDocument.data,
                fileName: combinedDocument.name || 'combined_document.pdf',
                fileType: combinedDocument.type || 'application/pdf',
                fileSize: combinedDocument.size || 0,
                preview: combinedDocument.preview || null,
                isMultiDocument: this.documents.length > 1,
                documentCount: this.documents.length,
                isCompiled: true
            };

            // Generate thumbnail from first page with stamp
            this.updateProcessingStatus('Generating stamped thumbnail...', 55);
            const thumbnail = await this.generateStampedThumbnail(combinedDocument);
            if (thumbnail) {
                window.uploadedImage.preview = thumbnail.data;
                window.uploadedImage.thumbnailStamped = true;
            }

            // Save unencrypted document and thumbnail to backend
            const backendSaved = await this.saveToBackend(combinedDocument, thumbnail);
            if (!backendSaved) {
                throw new Error('Failed to save document to backend');
            }

            this.updateProcessingStatus('Document saved. Preparing for encryption...', 80);

            // Now encrypt the document
            const encrypted = await this.encryptDocument(combinedDocument);
            if (!encrypted) {
                throw new Error('Failed to encrypt document');
            }

            // Update window.uploadedImage with encrypted data and backend info
            window.uploadedImage.encryptedData = encrypted.encryptedData;
            window.uploadedImage.encryptionKey = encrypted.key;
            window.uploadedImage.backendUrl = backendSaved.url;
            window.uploadedImage.thumbnailUrl = backendSaved.thumbnailUrl;
            window.uploadedImage.compiledDocumentId = backendSaved.uploadId;
            window.uploadedImage.pageCount = backendSaved.pageCount;

            this.updateProcessingStatus('Ready for IPFS upload!', 100);
            
            // Show success
            this.showNotification('success', `Compiled and encrypted ${this.documents.length} document(s)`);
            
            // Clear queue after successful compilation
            this.documents = [];
            this.updateUI();
            
            // Show next step
            this.showEncryptionStep();
            
            return window.uploadedImage;

        } catch (error) {
            console.error('Error compiling documents:', error);
            
            // Show detailed error message for backend failures
            if (error.message.includes('upload failed') || error.message.includes('Backend')) {
                // Show modal with detailed error
                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.style.display = 'block';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width: 500px;">
                        <div class="modal-header">
                            <h2 style="color: #dc2626;">⚠️ Document Upload Failed</h2>
                            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                        </div>
                        <div class="modal-body">
                            <div style="color: #dc2626; font-weight: bold; margin-bottom: 1rem;">
                                Documents could not be uploaded to the server
                            </div>
                            <div style="margin-bottom: 1rem;">
                                The compilation process has been stopped to prevent you from losing funds 
                                on a transaction that would fail.
                            </div>
                            <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 0.375rem; margin-bottom: 1rem;">
                                <strong>Error:</strong> ${error.message}
                            </div>
                            <div>
                                <strong>Please try:</strong>
                                <ol style="margin-left: 1.5rem; margin-top: 0.5rem;">
                                    <li>Check your internet connection</li>
                                    <li>Wait a moment and try again</li>
                                    <li>Refresh the page if the problem persists</li>
                                </ol>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
                            <button class="btn btn-primary" onclick="this.closest('.modal').remove()">
                                OK
                            </button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
                
                this.showNotification('error', 'Upload failed - see details above');
            } else {
                this.showNotification('error', error.message || 'Failed to compile documents');
            }
            
            return null;
        } finally {
            this.isProcessing = false;
            setTimeout(() => {
                const status = document.getElementById('compressionStatus');
                if (status) status.style.display = 'none';
            }, 2000);
        }
    }

    /**
     * Merge multiple PDFs into one
     */
    async mergePDFs() {
        // Check for pdf-lib availability
        if (typeof PDFLib === 'undefined') {
            console.error('PDF-lib not loaded');
            throw new Error('PDF merging library not available');
        }
        
        const { PDFDocument } = PDFLib;
        
        // Create new PDF
        const mergedPdf = await PDFDocument.create();
        
        for (let i = 0; i < this.documents.length; i++) {
            const doc = this.documents[i];
            this.updateProcessingStatus(`Merging PDF ${i + 1} of ${this.documents.length}...`, 
                20 + (60 * i / this.documents.length));
            
            // Convert base64 to bytes
            const base64Data = doc.data.split(',')[1];
            const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            // Load PDF
            const pdf = await PDFDocument.load(pdfBytes);
            
            // Copy all pages
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));
        }
        
        // Save merged PDF
        const mergedPdfBytes = await mergedPdf.save();
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const dataUrl = await this.blobToDataURL(blob);
        
        return {
            name: `merged_${this.documents.length}_documents.pdf`,
            type: 'application/pdf',
            size: mergedPdfBytes.length,
            data: dataUrl,
            preview: null
        };
    }

    /**
     * Combine documents as images
     */
    async combineAsImages() {
        // For now, just use the first document
        // TODO: Implement image combination
        this.updateProcessingStatus('Converting to images...', 50);
        return this.documents[0];
    }

    /**
     * Convert blob to data URL
     */
    blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Update the UI to show document queue
     */
    updateUI() {
        let container = document.getElementById('documentQueueContainer');
        
        if (!container) {
            // Create container if it doesn't exist
            const uploadArea = document.getElementById('uploadArea');
            if (!uploadArea) return;
            
            container = document.createElement('div');
            container.id = 'documentQueueContainer';
            uploadArea.parentNode.insertBefore(container, uploadArea.nextSibling);
        }

        if (this.documents.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            
            // Update upload area text
            const uploadArea = document.getElementById('uploadArea');
            if (uploadArea) {
                const p = uploadArea.querySelector('p');
                if (p) p.textContent = 'Add your first document (PDF, JPEG, PNG)';
            }
            return;
        }

        container.style.display = 'block';
        container.innerHTML = `
            <div style="margin-top: 20px; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h5 style="margin: 0; color: var(--primary);">
                        <i class="fas fa-layer-group"></i> Document Queue (${this.documents.length}/${this.maxDocuments})
                    </h5>
                    <div>
                        ${this.documents.length > 1 ? `
                            <button class="btn btn-secondary btn-small" onclick="multiDocHandler.clearAll()">
                                <i class="fas fa-trash"></i> Clear All
                            </button>
                        ` : ''}
                        <button class="btn btn-primary btn-small" onclick="multiDocHandler.compileDocuments()" 
                                ${this.isProcessing ? 'disabled' : ''}>
                            <i class="fas fa-lock"></i> Compile & Encrypt
                        </button>
                    </div>
                </div>
                
                <div style="max-height: 200px; overflow-y: auto;">
                    ${this.documents.map(doc => `
                        <div style="display: flex; justify-content: space-between; align-items: center; 
                                    padding: 8px; margin-bottom: 5px; background: var(--bg-primary); 
                                    border-radius: 4px;">
                            <div style="display: flex; align-items: center;">
                                <i class="fas ${this.getFileIcon(doc.type)}" 
                                   style="margin-right: 10px; color: var(--accent-blue);"></i>
                                <div>
                                    <div style="font-weight: 500;">${this.truncateName(doc.name, 30)}</div>
                                    <div style="font-size: 0.85em; color: var(--text-muted);">
                                        ${this.formatSize(doc.size)}
                                    </div>
                                </div>
                            </div>
                            <button class="btn btn-danger btn-small" 
                                    onclick="multiDocHandler.removeDocument(${doc.id})"
                                    title="Remove document">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                    <button class="btn btn-secondary" style="width: 100%;" 
                            onclick="document.getElementById('documentUpload').click()">
                        <i class="fas fa-plus"></i> Add Another Document
                    </button>
                    <div style="margin-top: 10px; text-align: center;">
                        <small style="color: var(--text-muted);">
                            You can select multiple files at once or add them one by one
                        </small>
                    </div>
                </div>
            </div>
        `;

        // Update upload area text
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            const p = uploadArea.querySelector('p');
            if (p) p.textContent = `Add document ${this.documents.length + 1} of ${this.maxDocuments}`;
        }
    }

    /**
     * Show encryption step after compilation
     */
    showEncryptionStep() {
        const uploadResult = document.getElementById('uploadResult');
        const uploadedFileName = document.getElementById('uploadedFileName');
        
        if (uploadResult && uploadedFileName) {
            const docCount = window.uploadedImage.documentCount;
            uploadedFileName.textContent = docCount > 1 
                ? `${docCount} documents compiled into one PDF` 
                : window.uploadedImage.fileName;
            uploadResult.style.display = 'block';
        }

        // Hide upload area and toggle, show encryption options
        const uploadArea = document.getElementById('uploadArea');
        const toggleContainer = document.getElementById('multiDocToggleContainer');
        if (uploadArea) {
            uploadArea.style.display = 'none';
        }
        if (toggleContainer) {
            toggleContainer.style.display = 'none';
        }
        
        // Hide document queue container
        const queueContainer = document.getElementById('documentQueueContainer');
        if (queueContainer) {
            queueContainer.style.display = 'none';
        }
        
        // Show encryption button if it exists
        const encryptBtn = document.getElementById('encryptDocumentBtn');
        if (encryptBtn) {
            encryptBtn.style.display = 'inline-block';
        }
    }

    /**
     * Update processing status
     */
    updateProcessingStatus(message, progress) {
        const statusDiv = document.getElementById('compressionStatus');
        const statusText = document.getElementById('compressionStatusText');
        const progressBar = document.getElementById('compressionProgress');
        
        if (statusDiv) statusDiv.style.display = 'block';
        if (statusText) statusText.textContent = message;
        if (progressBar) {
            progressBar.style.width = progress + '%';
            progressBar.setAttribute('aria-valuenow', progress);
        }
    }

    /**
     * Helper functions
     */
    getFileIcon(type) {
        if (type.includes('pdf')) return 'fa-file-pdf';
        if (type.includes('image')) return 'fa-file-image';
        if (type.includes('word')) return 'fa-file-word';
        return 'fa-file';
    }

    truncateName(name, maxLength) {
        if (name.length <= maxLength) return name;
        return name.substring(0, maxLength - 3) + '...';
    }

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * Generate stamped thumbnail from first page
     */
    async generateStampedThumbnail(document) {
        try {
            let firstPageImage;
            let totalPages = 1;
            
            // Check if it's a PDF
            if (document.type === 'application/pdf' || document.name.endsWith('.pdf')) {
                // Get page count and extract first page
                const pdfInfo = await this.extractPDFFirstPage(document.data);
                firstPageImage = pdfInfo.firstPage;
                totalPages = pdfInfo.pageCount;
            } else {
                // For images, use as is
                firstPageImage = document.data;
            }
            
            // Create canvas for stamping
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Load the image
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = firstPageImage;
            });
            
            // Set canvas size (thumbnail size)
            const maxWidth = 800;
            const maxHeight = 1000;
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = (maxHeight / height) * width;
                height = maxHeight;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw the image
            ctx.drawImage(img, 0, 0, width, height);
            
            // Add semi-transparent overlay for stamp area
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(0, 0, width, 80);
            
            // Add red stamp text
            ctx.fillStyle = '#DC143C'; // Crimson red
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            
            // Add "LEGAL NOTICE" text
            ctx.fillText('LEGAL NOTICE', width / 2, 30);
            
            // Add page count
            ctx.font = 'bold 20px Arial';
            ctx.fillText(`Document: Page 1 of ${totalPages}`, width / 2, 55);
            
            // Add timestamp
            ctx.font = '16px Arial';
            ctx.fillStyle = '#8B0000'; // Dark red
            const timestamp = new Date().toLocaleString();
            ctx.fillText(`Generated: ${timestamp}`, width / 2, 75);
            
            // Add border
            ctx.strokeStyle = '#DC143C';
            ctx.lineWidth = 3;
            ctx.strokeRect(0, 0, width, height);
            
            // Convert canvas to data URL
            const thumbnailData = canvas.toDataURL('image/png');
            
            return {
                data: thumbnailData,
                width: width,
                height: height,
                pageCount: totalPages,
                timestamp: timestamp
            };
            
        } catch (error) {
            console.error('Error generating thumbnail:', error);
            return null;
        }
    }
    
    /**
     * Extract first page from PDF
     */
    async extractPDFFirstPage(pdfDataUrl) {
        try {
            // Check if pdf.js is available
            if (typeof pdfjsLib === 'undefined') {
                console.warn('PDF.js not loaded, using fallback');
                return { firstPage: pdfDataUrl, pageCount: 1 };
            }
            
            // Convert data URL to array buffer
            const base64Data = pdfDataUrl.split(',')[1];
            const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            // Load PDF
            const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
            const pageCount = pdf.numPages;
            
            // Get first page
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 });
            
            // Create canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            // Render page
            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;
            
            // Convert to data URL
            const imageData = canvas.toDataURL('image/png');
            
            return {
                firstPage: imageData,
                pageCount: pageCount
            };
            
        } catch (error) {
            console.error('Error extracting PDF first page:', error);
            // Fallback - return original
            return { firstPage: pdfDataUrl, pageCount: 1 };
        }
    }

    /**
     * Save compiled document to backend with retry logic
     * CRITICAL: Must succeed or compilation fails to prevent fund loss
     */
    async saveToBackend(document, thumbnail, maxRetries = 3) {
        if (!window.BACKEND_API_URL) {
            throw new Error('Backend not configured - cannot proceed without document storage');
        }

        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Backend upload attempt ${attempt} of ${maxRetries}...`);
            const formData = new FormData();
            
            // Convert data URL to blob
            const documentBlob = await this.dataURLtoBlob(document.data);
            formData.append('document', documentBlob, document.name);
            
            // Add thumbnail if available
            if (thumbnail && thumbnail.data) {
                const thumbnailBlob = await this.dataURLtoBlob(thumbnail.data);
                formData.append('thumbnail', thumbnailBlob, 'thumbnail.png');
                formData.append('pageCount', thumbnail.pageCount.toString());
            }
            
            // Generate unique ID for this upload session
            const uploadId = `compiled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Add metadata for notice_components table
            formData.append('caseNumber', window.currentCaseNumber || 'PENDING');
            formData.append('serverAddress', window.tronWeb?.defaultAddress?.base58 || '');
            formData.append('recipientAddress', document.getElementById('recipientAddress')?.value || 'PENDING');
            formData.append('alertId', uploadId); // Use uploadId as temporary alertId
            formData.append('documentId', uploadId + '_doc');
            formData.append('nftDescription', `Compiled Legal Notice - ${document.name}`);
            formData.append('noticeType', 'Legal Notice');
            formData.append('issuingAgency', window.unifiedSystem?.serverInfo?.agency || '');
            
            // Database migration completed - these fields are now supported
            formData.append('pageCount', thumbnail?.pageCount?.toString() || '1');
            formData.append('isCompiled', 'true');
            formData.append('documentCount', this.documents.length.toString());
            
            // Generate a notice ID for this upload session
            const noticeId = uploadId;
            
            // Save to the existing notice_components endpoint
            const response = await fetch(`${window.BACKEND_API_URL}/api/documents/notice/${noticeId}/components`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                // Try to get error details
                let errorDetails = `Status: ${response.status}`;
                try {
                    const errorText = await response.text();
                    if (errorText) {
                        errorDetails += ` - ${errorText}`;
                    }
                } catch (e) {
                    // Ignore error reading response
                }
                throw new Error(`Backend save failed: ${errorDetails}`);
            }

            const result = await response.json();
            console.log('Document saved to backend:', result);
            
            // Store the backend URLs for later reference
            window.compiledDocumentUrl = result.documentUrl || result.url;
            window.compiledThumbnailUrl = result.thumbnailUrl || result.alertThumbnailUrl;
            window.compiledNoticeId = result.noticeId || uploadId;
            
            // Success - return immediately
            return result;
            
        } catch (error) {
            console.error(`Backend upload attempt ${attempt} failed:`, error);
            lastError = error;
            
            // If not the last attempt, wait before retrying
            if (attempt < maxRetries) {
                this.showNotification('warning', `Upload failed, retrying in ${attempt * 2} seconds...`);
                await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                continue; // Try again
            }
        }
        }
        
        // All retries exhausted - throw error to stop compilation
        const errorMsg = `CRITICAL: Document upload failed after ${maxRetries} attempts! ${lastError?.message || 'Unknown error'}`;
        console.error(errorMsg);
        this.showNotification('error', 'Document upload failed - cannot proceed');
        throw new Error(errorMsg);
    }

    /**
     * Encrypt the compiled document
     */
    async encryptDocument(document) {
        try {
            // Use existing encryption function if available
            if (window.encryptDocument) {
                const result = await window.encryptDocument(document.data);
                return result;
            }
            
            // Fallback to simple encryption
            if (window.simpleEncryption && window.simpleEncryption.encrypt) {
                const encrypted = await window.simpleEncryption.encrypt(document.data);
                return {
                    encryptedData: encrypted.encryptedData,
                    key: encrypted.key
                };
            }
            
            console.warn('No encryption method available');
            return null;
        } catch (error) {
            console.error('Error encrypting document:', error);
            return null;
        }
    }

    /**
     * Convert data URL to Blob
     */
    async dataURLtoBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    showNotification(type, message) {
        if (window.uiManager && window.uiManager.showNotification) {
            window.uiManager.showNotification(type, message);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }
}

// Create global instance
window.multiDocHandler = new MultiDocumentHandler();

// Store original handler if it exists
if (window.handleDocumentUpload && !window.originalHandleDocumentUpload) {
    window.originalHandleDocumentUpload = window.handleDocumentUpload;
}

// Override the existing handleDocumentUpload to use queue
window.handleDocumentUpload = async function(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Check if we're in multi-document mode
    const multiDocMode = localStorage.getItem('multiDocumentMode') === 'true';
    
    if (multiDocMode || files.length > 1) {
        // Use multi-document handler
        for (let file of files) {
            await window.multiDocHandler.addDocument(file);
        }
        // Clear the input so same file can be selected again
        event.target.value = '';
    } else if (window.originalHandleDocumentUpload) {
        // Use original handler for single file
        window.originalHandleDocumentUpload(event);
    } else {
        // Fallback: handle single file directly
        const file = files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            window.uploadedImage = {
                data: e.target.result,
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size
            };
            // Show upload result
            const uploadResult = document.getElementById('uploadResult');
            const uploadedFileName = document.getElementById('uploadedFileName');
            if (uploadResult && uploadedFileName) {
                uploadedFileName.textContent = file.name;
                uploadResult.style.display = 'block';
            }
            // Hide upload area
            const uploadArea = document.getElementById('uploadArea');
            if (uploadArea) {
                uploadArea.style.display = 'none';
            }
        };
        reader.readAsDataURL(file);
    }
};

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.multiDocHandler.init();
    });
} else {
    window.multiDocHandler.init();
}

console.log('✅ Multi-document handler loaded');