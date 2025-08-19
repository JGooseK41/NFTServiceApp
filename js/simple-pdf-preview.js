/**
 * Simple PDF Preview - Display actual PDF from backend
 */

(function() {
    console.log('🔧 Loading Simple PDF Preview...');
    
    // Override the preview function to show actual PDF
    window.previewMergedDocument = async function() {
        if (!window.uploadedDocumentsList || window.uploadedDocumentsList.length === 0) {
            if (window.uiManager) {
                window.uiManager.showNotification('warning', 'No documents to preview');
            }
            return;
        }
        
        try {
            // First, compile the documents if not already done
            if (!window.uploadedImage?.compiledDocumentId) {
                console.log('📦 Compiling documents first...');
                if (window.multiDocHandler?.compileDocuments) {
                    await window.multiDocHandler.compileDocuments();
                }
            }
            
            // Check if we have a backend URL for the compiled document
            const backendUrl = window.uploadedImage?.backendUrl;
            const documentId = window.uploadedImage?.compiledDocumentId;
            
            let pdfUrl;
            
            if (backendUrl) {
                // Use the backend URL directly
                pdfUrl = backendUrl;
            } else if (documentId) {
                // Construct URL from document ID
                const backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
                pdfUrl = `${backend}/api/compiled-documents/${documentId}`;
            } else {
                // Fallback: try to get from the first document's data
                const firstDoc = window.uploadedDocumentsList[0];
                if (firstDoc && firstDoc.data) {
                    // If we have base64 data, use it directly
                    pdfUrl = firstDoc.data;
                } else {
                    throw new Error('No compiled document available. Please compile documents first.');
                }
            }
            
            // Create modal with embedded PDF viewer
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.cssText = `
                display: block;
                position: fixed;
                z-index: 10000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
            `;
            
            modal.innerHTML = `
                <div class="modal-content" style="
                    position: relative;
                    background-color: white;
                    margin: 2% auto;
                    padding: 0;
                    width: 90%;
                    max-width: 1200px;
                    height: 90vh;
                    border-radius: 8px;
                    display: flex;
                    flex-direction: column;
                ">
                    <div class="modal-header" style="
                        padding: 15px 20px;
                        background: #f8f9fa;
                        border-bottom: 1px solid #dee2e6;
                        border-radius: 8px 8px 0 0;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <h3 style="margin: 0; color: #333;">
                            <i class="fas fa-file-pdf" style="color: #dc3545;"></i>
                            Full Document Preview - ${window.uploadedDocumentsList.length} Document(s) Merged
                        </h3>
                        <button onclick="this.closest('.modal').remove()" style="
                            background: none;
                            border: none;
                            font-size: 28px;
                            cursor: pointer;
                            color: #999;
                            padding: 0;
                            width: 30px;
                            height: 30px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">&times;</button>
                    </div>
                    
                    <div style="
                        padding: 10px 20px;
                        background: #fff3cd;
                        border-bottom: 1px solid #ffc107;
                        color: #856404;
                        font-size: 14px;
                    ">
                        <i class="fas fa-info-circle"></i>
                        This is the actual PDF that will be encrypted and sent. All pages are included.
                    </div>
                    
                    <div class="modal-body" style="
                        flex: 1;
                        padding: 0;
                        overflow: hidden;
                        position: relative;
                    ">
                        ${pdfUrl.startsWith('data:') ? 
                            // For base64 data URLs, use embed
                            `<embed src="${pdfUrl}" type="application/pdf" style="width: 100%; height: 100%;" />` :
                            // For regular URLs, use iframe
                            `<iframe src="${pdfUrl}" style="
                                width: 100%;
                                height: 100%;
                                border: none;
                            "></iframe>`
                        }
                    </div>
                    
                    <div style="
                        padding: 10px 20px;
                        background: #f8f9fa;
                        border-top: 1px solid #dee2e6;
                        text-align: center;
                        color: #6c757d;
                        font-size: 13px;
                    ">
                        <i class="fas fa-shield-alt" style="color: #28a745;"></i>
                        This document will be encrypted before being stored on the blockchain
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Close on clicking outside
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            // Close on escape key
            const escHandler = function(e) {
                if (e.key === 'Escape') {
                    modal.remove();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
            
        } catch (error) {
            console.error('Preview error:', error);
            if (window.uiManager) {
                window.uiManager.showNotification('error', error.message || 'Failed to preview document');
            }
        }
    };
    
    console.log('✅ Simple PDF Preview loaded - shows actual PDF from backend');
})();