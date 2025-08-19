/**
 * Unified Preview System - Clean, consistent document preview workflow
 */

class UnifiedPreviewSystem {
    constructor() {
        this.isCompiling = false;
        this.compiledDocument = null;
    }
    
    /**
     * Main preview function - handles all preview buttons
     */
    async showPreview(source = 'unknown') {
        console.log(`📄 Preview requested from: ${source}`);
        
        // Check if we have documents
        if (!window.uploadedDocumentsList || window.uploadedDocumentsList.length === 0) {
            this.showNoDocumentsMessage();
            return;
        }
        
        // Show loading state
        const loadingModal = this.showLoadingModal();
        
        try {
            // Step 1: Ensure documents are compiled
            if (!this.compiledDocument && !this.isCompiling) {
                await this.compileDocuments();
            }
            
            // Step 2: Generate Alert thumbnail if needed
            if (!window.uploadedImage?.alertThumbnail && window.alertThumbnailGenerator) {
                console.log('🖼️ Generating Alert thumbnail...');
                await window.alertThumbnailGenerator.generateAlertThumbnail();
            }
            
            // Step 3: Close loading and show preview
            loadingModal.remove();
            this.showPreviewModal();
            
        } catch (error) {
            console.error('Preview error:', error);
            loadingModal.remove();
            this.showErrorMessage(error.message);
        }
    }
    
    /**
     * Compile documents if needed
     */
    async compileDocuments() {
        if (this.isCompiling) {
            console.log('Already compiling...');
            return;
        }
        
        this.isCompiling = true;
        console.log('📦 Compiling documents...');
        
        try {
            // Use multi-doc handler if available
            if (window.multiDocHandler?.compileDocuments) {
                this.compiledDocument = await window.multiDocHandler.compileDocuments();
            } 
            // Otherwise just use the first document
            else if (window.uploadedDocumentsList?.[0]) {
                this.compiledDocument = window.uploadedDocumentsList[0];
            }
            
            console.log('✅ Documents compiled');
        } finally {
            this.isCompiling = false;
        }
    }
    
    /**
     * Show loading modal
     */
    showLoadingModal() {
        const modal = document.createElement('div');
        modal.className = 'preview-loading-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                padding: 40px;
                border-radius: 12px;
                text-align: center;
                min-width: 300px;
            ">
                <div style="margin-bottom: 20px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #2196f3;"></i>
                </div>
                <h3 style="margin: 0 0 10px 0; color: #333;">Preparing Preview</h3>
                <p style="color: #666; margin: 0;">
                    ${window.uploadedDocumentsList?.length || 0} document(s) being processed...
                </p>
            </div>
        `;
        
        document.body.appendChild(modal);
        return modal;
    }
    
    /**
     * Show the main preview modal
     */
    showPreviewModal() {
        // Get PDF data
        let pdfData = null;
        
        // Try different sources for PDF data
        if (window.uploadedImage?.backendUrl) {
            pdfData = window.uploadedImage.backendUrl;
        } else if (window.uploadedImage?.data) {
            pdfData = window.uploadedImage.data;
        } else if (this.compiledDocument?.data) {
            pdfData = this.compiledDocument.data;
        } else if (window.uploadedDocumentsList?.[0]?.data) {
            pdfData = window.uploadedDocumentsList[0].data;
        }
        
        const modal = document.createElement('div');
        modal.className = 'unified-preview-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                width: 95%;
                max-width: 1400px;
                height: 95vh;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            ">
                <!-- Header -->
                <div style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <h2 style="margin: 0; font-size: 24px; font-weight: 300;">
                            Document Preview
                        </h2>
                        <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">
                            ${window.uploadedDocumentsList?.length || 0} document(s) • 
                            ${this.getTotalSize()} • 
                            Ready for service
                        </p>
                    </div>
                    <button onclick="this.closest('.unified-preview-modal').remove()" style="
                        background: rgba(255,255,255,0.2);
                        border: none;
                        color: white;
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        font-size: 24px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background 0.3s;
                    " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                       onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                        ×
                    </button>
                </div>
                
                <!-- Alert Thumbnail Section -->
                ${window.uploadedImage?.alertThumbnail ? `
                <div style="
                    background: #e3f2fd;
                    border-bottom: 2px solid #2196f3;
                    padding: 15px 30px;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                ">
                    <img src="${window.uploadedImage.alertThumbnail}" style="
                        width: 60px;
                        height: 60px;
                        border: 2px solid white;
                        border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    ">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #1565c0; margin-bottom: 3px;">
                            <i class="fas fa-wallet"></i> Alert NFT Thumbnail
                        </div>
                        <div style="font-size: 13px; color: #555;">
                            This is what recipients will see in their wallet
                        </div>
                    </div>
                    <button onclick="window.alertThumbnailGenerator?.showAlertPreview()" style="
                        background: white;
                        border: 1px solid #2196f3;
                        color: #2196f3;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">
                        View Full Size
                    </button>
                </div>
                ` : ''}
                
                <!-- Document Info Bar -->
                <div style="
                    background: #f8f9fa;
                    padding: 10px 30px;
                    border-bottom: 1px solid #dee2e6;
                    font-size: 14px;
                    color: #666;
                ">
                    <i class="fas fa-info-circle" style="color: #6c757d;"></i>
                    This preview shows your complete document as it will be encrypted and sent to recipients
                </div>
                
                <!-- Main Document Preview -->
                <div style="
                    flex: 1;
                    overflow: hidden;
                    background: #e9ecef;
                    position: relative;
                ">
                    ${pdfData ? `
                        ${pdfData.startsWith('data:') ? 
                            `<embed src="${pdfData}" type="application/pdf" style="width: 100%; height: 100%;" />` :
                            `<iframe src="${pdfData}" style="width: 100%; height: 100%; border: none;"></iframe>`
                        }
                    ` : `
                        <div style="
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            height: 100%;
                            padding: 40px;
                            text-align: center;
                        ">
                            <i class="fas fa-file-pdf" style="font-size: 64px; color: #dc3545; margin-bottom: 20px;"></i>
                            <h3 style="color: #495057; margin-bottom: 10px;">Document Preview</h3>
                            <p style="color: #6c757d;">
                                ${window.uploadedDocumentsList?.length || 0} document(s) ready for service
                            </p>
                            <div style="
                                margin-top: 30px;
                                padding: 20px;
                                background: white;
                                border-radius: 8px;
                                text-align: left;
                                min-width: 400px;
                            ">
                                <h4 style="margin: 0 0 15px 0; color: #333;">Document List:</h4>
                                ${window.uploadedDocumentsList?.map((doc, i) => `
                                    <div style="
                                        padding: 10px;
                                        background: #f8f9fa;
                                        margin-bottom: 8px;
                                        border-radius: 4px;
                                        display: flex;
                                        align-items: center;
                                        gap: 10px;
                                    ">
                                        <i class="fas fa-file-pdf" style="color: #dc3545;"></i>
                                        <span style="flex: 1;">
                                            <strong>${i + 1}.</strong> ${doc.fileName}
                                        </span>
                                        <span style="color: #6c757d; font-size: 13px;">
                                            ${((doc.fileSize || 0) / 1024).toFixed(1)} KB
                                        </span>
                                    </div>
                                `).join('') || '<p style="color: #999;">No documents</p>'}
                            </div>
                        </div>
                    `}
                </div>
                
                <!-- Footer Actions -->
                <div style="
                    background: white;
                    border-top: 1px solid #dee2e6;
                    padding: 15px 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div style="color: #6c757d; font-size: 14px;">
                        <i class="fas fa-lock" style="color: #28a745;"></i>
                        Documents will be encrypted before blockchain storage
                    </div>
                    <button onclick="this.closest('.unified-preview-modal').remove()" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 10px 30px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 15px;
                    ">
                        Close Preview
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close on escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }
    
    /**
     * Calculate total size of documents
     */
    getTotalSize() {
        if (!window.uploadedDocumentsList) return '0 KB';
        const totalBytes = window.uploadedDocumentsList.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
        if (totalBytes > 1024 * 1024) {
            return (totalBytes / (1024 * 1024)).toFixed(1) + ' MB';
        }
        return (totalBytes / 1024).toFixed(1) + ' KB';
    }
    
    /**
     * Show no documents message
     */
    showNoDocumentsMessage() {
        if (window.uiManager) {
            window.uiManager.showNotification('warning', 'Please upload documents first');
        }
    }
    
    /**
     * Show error message
     */
    showErrorMessage(message) {
        if (window.uiManager) {
            window.uiManager.showNotification('error', message);
        }
    }
}

// Initialize
window.unifiedPreview = new UnifiedPreviewSystem();

// Override ALL preview functions to use unified system
window.previewMergedDocument = () => window.unifiedPreview.showPreview('step2-merge');
window.previewDocument = () => window.unifiedPreview.showPreview('step3');
window.showFullDocumentPreview = () => window.unifiedPreview.showPreview('full-preview');

// Also override any other preview functions that might exist
const previewFunctions = ['showDocumentPreview', 'viewDocument', 'previewPDF'];
previewFunctions.forEach(funcName => {
    if (typeof window[funcName] === 'function') {
        window[funcName] = () => window.unifiedPreview.showPreview(funcName);
    }
});

console.log('✅ Unified Preview System loaded');
console.log('   All preview buttons now use the same clean interface');