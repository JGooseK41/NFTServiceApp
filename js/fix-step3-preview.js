/**
 * Fix Step 3 Preview - Shows actual document instead of "Processing documents..."
 */

(function() {
    console.log('🔧 Fixing Step 3 preview button...');
    
    // Override the preview function in Step 3
    window.previewDocument = async function() {
        console.log('📄 Step 3 Preview triggered');
        
        // Check if documents are uploaded
        if (!window.uploadedDocumentsList || window.uploadedDocumentsList.length === 0) {
            if (window.uiManager) {
                window.uiManager.showNotification('warning', 'No documents to preview');
            }
            return;
        }
        
        // Use the simple PDF preview we already created
        if (window.previewMergedDocument) {
            console.log('Using merged document preview');
            return window.previewMergedDocument();
        }
        
        // Fallback: Show document details in modal
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
        
        // Check if we have compiled document or raw documents
        let content = '';
        
        // Try to get the first document's data
        const firstDoc = window.uploadedDocumentsList[0];
        if (firstDoc && firstDoc.data) {
            // If it's a PDF, show it in an embed
            if (firstDoc.fileType === 'application/pdf' || firstDoc.data.startsWith('data:application/pdf')) {
                content = `<embed src="${firstDoc.data}" type="application/pdf" style="width: 100%; height: 100%;" />`;
            } 
            // If it's an image, show it
            else if (firstDoc.data.startsWith('data:image')) {
                content = `<img src="${firstDoc.data}" style="max-width: 100%; height: auto;" />`;
            }
            // Otherwise show info
            else {
                content = `
                    <div style="padding: 40px; text-align: center;">
                        <i class="fas fa-file" style="font-size: 64px; color: #6c757d; margin-bottom: 20px;"></i>
                        <h3>Document Ready for Service</h3>
                        <p>${window.uploadedDocumentsList.length} document(s) uploaded and ready</p>
                    </div>
                `;
            }
        } else {
            // Show document list
            content = `
                <div style="padding: 40px;">
                    <h3 style="margin-bottom: 20px;">Documents Ready for Service</h3>
                    <ul style="list-style: none; padding: 0;">
                        ${window.uploadedDocumentsList.map((doc, i) => `
                            <li style="padding: 10px; background: #f8f9fa; margin-bottom: 10px; border-radius: 6px;">
                                <i class="fas fa-file-pdf" style="color: #dc3545;"></i>
                                <strong>Document ${i + 1}:</strong> ${doc.fileName} 
                                <span style="color: #6c757d;">(${(doc.fileSize / 1024).toFixed(2)} KB)</span>
                            </li>
                        `).join('')}
                    </ul>
                    <div style="margin-top: 20px; padding: 15px; background: #d4edda; border-radius: 6px; color: #155724;">
                        <i class="fas fa-check-circle"></i>
                        All documents will be merged and encrypted before sending
                    </div>
                </div>
            `;
        }
        
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
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h3 style="margin: 0;">
                        <i class="fas fa-file-alt"></i> Document Preview
                    </h3>
                    <button onclick="this.closest('.modal').remove()" style="
                        background: none;
                        border: none;
                        font-size: 28px;
                        cursor: pointer;
                        color: #999;
                    ">&times;</button>
                </div>
                <div class="modal-body" style="
                    flex: 1;
                    overflow: auto;
                    padding: 0;
                ">
                    ${content}
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
    };
    
    // Also fix any inline preview buttons in Step 3
    document.addEventListener('DOMContentLoaded', function() {
        // Find preview buttons in Step 3 and update them
        const step3 = document.getElementById('mintStep3');
        if (step3) {
            const previewButtons = step3.querySelectorAll('button');
            previewButtons.forEach(button => {
                if (button.textContent.includes('Preview') || button.onclick?.toString().includes('previewDocument')) {
                    console.log('Found Step 3 preview button, updating...');
                    button.onclick = window.previewDocument;
                }
            });
        }
    });
    
    console.log('✅ Step 3 preview fixed - will show actual documents');
})();