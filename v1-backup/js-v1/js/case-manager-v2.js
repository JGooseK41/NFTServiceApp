/**
 * Case Manager V2 - Proper document viewing for process servers
 */

class CaseManagerV2 {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
    }

    /**
     * View document in case manager
     */
    async viewDocument(noticeId) {
        console.log(`📄 Opening document: ${noticeId}`);
        
        // Create modal
        const modal = this.createModal();
        document.body.appendChild(modal);
        
        try {
            // Get document URL
            const documentUrl = `${this.backend}/api/v2/documents/get-from-disk/${noticeId}`;
            
            // Display in iframe
            const viewer = modal.querySelector('.document-viewer');
            viewer.innerHTML = `
                <iframe 
                    src="${documentUrl}"
                    style="width: 100%; height: 100%; border: none;"
                    title="Document ${noticeId}">
                </iframe>
            `;
            
        } catch (error) {
            console.error('Failed to load document:', error);
            const viewer = modal.querySelector('.document-viewer');
            viewer.innerHTML = `
                <div style="text-align: center; padding: 50px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #dc3545;"></i>
                    <h3>Document Not Found</h3>
                    <p>The document could not be loaded from storage.</p>
                    <p style="color: #6c757d;">Notice ID: ${noticeId}</p>
                </div>
            `;
        }
    }

    /**
     * Create viewer modal
     */
    createModal() {
        const modal = document.createElement('div');
        modal.className = 'case-document-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                width: 90%;
                max-width: 1200px;
                height: 90vh;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            ">
                <!-- Header -->
                <div style="
                    padding: 15px 20px;
                    background: #f8f9fa;
                    border-bottom: 1px solid #dee2e6;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h3 style="margin: 0;">
                        <i class="fas fa-file-pdf" style="color: #dc3545;"></i>
                        Case Document Viewer
                    </h3>
                    <button onclick="this.closest('.case-document-modal').remove()" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #6c757d;
                    ">&times;</button>
                </div>
                
                <!-- Document viewer -->
                <div class="document-viewer" style="
                    flex: 1;
                    background: #f8f9fa;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <div style="text-align: center;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #6c757d;"></i>
                        <p>Loading document...</p>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="
                    padding: 15px 20px;
                    background: #f8f9fa;
                    border-top: 1px solid #dee2e6;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div style="color: #6c757d;">
                        Unencrypted document from disk storage
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="window.print()" style="
                            padding: 8px 16px;
                            background: #6c757d;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                        ">
                            <i class="fas fa-print"></i> Print
                        </button>
                        <button onclick="this.closest('.case-document-modal').remove()" style="
                            padding: 8px 16px;
                            background: #dc3545;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                        ">
                            <i class="fas fa-times"></i> Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        return modal;
    }

    /**
     * Add view button to case display
     */
    addViewButton(caseElement, noticeId) {
        const button = document.createElement('button');
        button.className = 'btn btn-primary btn-sm';
        button.innerHTML = '<i class="fas fa-eye"></i> View PDF';
        button.onclick = () => this.viewDocument(noticeId);
        
        caseElement.appendChild(button);
    }
}

// Initialize and attach to window
window.caseManagerV2 = new CaseManagerV2();

// Override case document viewing
window.viewCaseDocument = function(caseId, noticeId) {
    window.caseManagerV2.viewDocument(noticeId || caseId);
};

console.log('✅ Case Manager V2 loaded - process servers can view unencrypted PDFs');