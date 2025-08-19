/**
 * Case Document Viewer
 * Allows process servers to view unencrypted documents from case manager
 */

window.viewCaseDocument = async function(caseId, documentId) {
    console.log(`📄 Opening document ${documentId} from case ${caseId}`);
    
    try {
        // Show loading modal
        const modal = document.createElement('div');
        modal.className = 'document-viewer-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            z-index: 9999999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            width: 90%;
            max-width: 1200px;
            height: 90vh;
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;
        
        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 15px 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <h3 style="margin: 0;">📄 Document Viewer - ${documentId}</h3>
            <button onclick="this.closest('.document-viewer-modal').remove()" style="
                background: none;
                border: none;
                font-size: 28px;
                cursor: pointer;
                color: #6c757d;
            ">&times;</button>
        `;
        
        // Document container
        const docContainer = document.createElement('div');
        docContainer.style.cssText = `
            flex: 1;
            padding: 20px;
            overflow: auto;
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        docContainer.innerHTML = '<p>Loading document...</p>';
        
        content.appendChild(header);
        content.appendChild(docContainer);
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Try to get document from backend
        const backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        const serverAddress = window.tronWeb?.defaultAddress?.base58 || '';
        
        // Try multiple endpoints to find the document
        const endpoints = [
            `/api/documents/notice/${documentId}/unencrypted`,
            `/api/documents/notice/${documentId}/full`,
            `/api/documents/${documentId}/document`,
            `/api/cases/${caseId}/documents/${documentId}`
        ];
        
        let documentData = null;
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${backend}${endpoint}?serverAddress=${serverAddress}`);
                if (response.ok) {
                    documentData = await response.json();
                    console.log(`✅ Document found at ${endpoint}`);
                    break;
                }
            } catch (error) {
                console.log(`Failed to fetch from ${endpoint}:`, error);
            }
        }
        
        // Also check if document is in local storage
        if (!documentData && window.uploadedImage) {
            if (window.uploadedImage.data) {
                documentData = {
                    documentData: window.uploadedImage.data,
                    mimeType: window.uploadedImage.fileType || 'application/pdf',
                    fileName: window.uploadedImage.fileName
                };
                console.log('Using local document data');
            }
        }
        
        if (documentData) {
            // Display the document
            if (documentData.documentData || documentData.document_data) {
                const data = documentData.documentData || documentData.document_data;
                const mimeType = documentData.mimeType || documentData.mime_type || 'application/pdf';
                
                if (mimeType === 'application/pdf' || data.startsWith('data:application/pdf')) {
                    // Display PDF in iframe
                    docContainer.innerHTML = `
                        <iframe src="${data}" style="
                            width: 100%;
                            height: 100%;
                            border: none;
                            background: white;
                        "></iframe>
                    `;
                } else if (mimeType.startsWith('image/') || data.startsWith('data:image')) {
                    // Display image
                    docContainer.innerHTML = `
                        <img src="${data}" style="
                            max-width: 100%;
                            max-height: 100%;
                            object-fit: contain;
                        ">
                    `;
                } else {
                    // Unknown format
                    docContainer.innerHTML = `
                        <div style="text-align: center;">
                            <p>Document format: ${mimeType}</p>
                            <a href="${data}" download="${documentData.fileName || 'document'}" style="
                                display: inline-block;
                                padding: 10px 20px;
                                background: #007bff;
                                color: white;
                                text-decoration: none;
                                border-radius: 5px;
                            ">Download Document</a>
                        </div>
                    `;
                }
            } else if (documentData.url || documentData.documentUrl) {
                // Document is stored as URL
                const url = documentData.url || documentData.documentUrl;
                docContainer.innerHTML = `
                    <iframe src="${backend}${url}" style="
                        width: 100%;
                        height: 100%;
                        border: none;
                        background: white;
                    "></iframe>
                `;
            } else {
                throw new Error('No document data found');
            }
            
            // Add footer with actions
            const footer = document.createElement('div');
            footer.style.cssText = `
                padding: 15px 20px;
                background: #f8f9fa;
                border-top: 1px solid #dee2e6;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
            footer.innerHTML = `
                <div style="color: #6c757d; font-size: 14px;">
                    Case: ${caseId} | Document: ${documentId}
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="printDocument('${documentId}')" style="
                        padding: 8px 16px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    ">
                        <i class="fas fa-print"></i> Print
                    </button>
                    <button onclick="downloadDocument('${documentId}')" style="
                        padding: 8px 16px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    ">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            `;
            content.appendChild(footer);
            
        } else {
            docContainer.innerHTML = `
                <div style="text-align: center; color: #dc3545;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                    <h4>Document Not Found</h4>
                    <p>The document could not be retrieved from the server.</p>
                    <p style="font-size: 14px; color: #6c757d;">Document ID: ${documentId}</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error viewing document:', error);
        alert('Failed to load document: ' + error.message);
    }
};

// Helper function to print document
window.printDocument = function(documentId) {
    window.print();
};

// Helper function to download document
window.downloadDocument = function(documentId) {
    const iframe = document.querySelector('.document-viewer-modal iframe');
    if (iframe && iframe.src) {
        const link = document.createElement('a');
        link.href = iframe.src;
        link.download = `document_${documentId}.pdf`;
        link.click();
    }
};

console.log('✅ Case Document Viewer loaded - process servers can view unencrypted documents');