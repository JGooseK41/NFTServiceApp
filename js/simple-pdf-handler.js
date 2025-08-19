/**
 * Simple PDF Handler - Direct and straightforward
 * No complex processing, just merge PDFs and show them
 */

class SimplePDFHandler {
    constructor() {
        this.mergedPDF = null;
        this.caseNumber = null;
    }

    /**
     * Merge PDFs into one - SIMPLE
     */
    async mergePDFs(documents) {
        if (!window.PDFLib) {
            throw new Error('PDF library not loaded');
        }

        const { PDFDocument } = window.PDFLib;
        const mergedPdf = await PDFDocument.create();
        
        // Just merge all PDFs - no complex processing
        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            console.log(`Merging document ${i + 1}: ${doc.name}`);
            
            // Get PDF bytes - handle both binary and base64
            let pdfBytes;
            if (doc.file) {
                // New binary mode - doc.file is a File object
                const arrayBuffer = await doc.file.arrayBuffer();
                pdfBytes = new Uint8Array(arrayBuffer);
            } else if (doc.data) {
                // Old base64 mode
                const base64Data = doc.data.split(',')[1];
                pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            } else {
                console.error('Document has no data:', doc);
                continue;
            }
            
            // Load and copy pages
            const pdf = await PDFDocument.load(pdfBytes);
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            
            // Add separator page between documents (not before first)
            if (i > 0) {
                const separatorPage = mergedPdf.addPage();
                const { width, height } = separatorPage.getSize();
                separatorPage.drawText(`Document ${i + 1}: ${doc.name}`, {
                    x: 50,
                    y: height / 2,
                    size: 20
                });
            }
            
            // Add all pages
            pages.forEach(page => mergedPdf.addPage(page));
        }
        
        // Save the merged PDF
        const mergedBytes = await mergedPdf.save();
        const blob = new Blob([mergedBytes], { type: 'application/pdf' });
        const dataUrl = await this.blobToDataURL(blob);
        
        const pageCount = mergedPdf.getPageCount();
        console.log(`✅ Merged PDF complete: ${pageCount} pages total`);
        
        this.mergedPDF = {
            data: dataUrl,
            pageCount: pageCount,
            size: mergedBytes.length
        };
        
        return this.mergedPDF;
    }

    /**
     * Save to backend - SIMPLE
     */
    async saveToBackend() {
        if (!this.mergedPDF) {
            throw new Error('No merged PDF to save');
        }

        // Get case number from form
        this.caseNumber = document.getElementById('mintCaseNumber')?.value || `CASE-${Date.now()}`;
        
        const formData = new FormData();
        
        // Convert data URL to blob
        const response = await fetch(this.mergedPDF.data);
        const blob = await response.blob();
        
        formData.append('pdf', blob, 'merged_document.pdf');
        formData.append('noticeId', this.caseNumber);
        
        // Save to backend
        const result = await fetch(`${window.BACKEND_API_URL}/api/v2/documents/upload-to-disk`, {
            method: 'POST',
            body: formData
        });
        
        if (!result.ok) {
            throw new Error('Failed to save to backend');
        }
        
        const data = await result.json();
        console.log('✅ Saved to backend:', data);
        
        return data;
    }

    /**
     * Show preview - SIMPLE
     */
    showPreview() {
        if (!this.mergedPDF) {
            console.error('No merged PDF to preview');
            return;
        }

        // Remove any existing modal
        const existingModal = document.querySelector('.simple-preview-modal');
        if (existingModal) existingModal.remove();

        // Create simple modal
        const modal = document.createElement('div');
        modal.className = 'modal simple-preview-modal';
        modal.style.display = 'block';
        modal.style.zIndex = '10000';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 90%; width: 1000px; height: 90vh;">
                <div class="modal-header">
                    <h2>📄 Merged Document Preview (${this.mergedPDF.pageCount} pages)</h2>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body" style="height: calc(100% - 120px); padding: 0;">
                    <embed src="${this.mergedPDF.data}" 
                           type="application/pdf" 
                           style="width: 100%; height: 100%;" />
                </div>
                <div class="modal-footer" style="padding: 10px; text-align: center;">
                    <span style="color: #666;">
                        Case: ${this.caseNumber} | 
                        Size: ${(this.mergedPDF.size / 1024 / 1024).toFixed(2)} MB | 
                        Pages: ${this.mergedPDF.pageCount}
                    </span>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
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
}

// Global instance
window.simplePDFHandler = new SimplePDFHandler();

// Override the preview function to use simple handler
window.previewMergedDocumentSimple = async function() {
    try {
        // Check if we have documents
        if (!window.uploadedDocumentsList || window.uploadedDocumentsList.length === 0) {
            if (window.multiDocHandler && window.multiDocHandler.documents.length > 0) {
                // Use documents from multi-doc handler
                const docs = window.multiDocHandler.documents;
                const merged = await window.simplePDFHandler.mergePDFs(docs);
                
                // Store for other functions
                window.uploadedImage = {
                    data: merged.data,
                    pageCount: merged.pageCount,
                    isCompiled: true
                };
                
                // Save to backend
                await window.simplePDFHandler.saveToBackend();
                
                // Show preview
                window.simplePDFHandler.showPreview();
            } else {
                alert('No documents to preview');
            }
        } else {
            // Use uploaded documents list
            const merged = await window.simplePDFHandler.mergePDFs(window.uploadedDocumentsList);
            
            // Store for other functions
            window.uploadedImage = {
                data: merged.data,
                pageCount: merged.pageCount,
                isCompiled: true
            };
            
            // Save to backend
            await window.simplePDFHandler.saveToBackend();
            
            // Show preview
            window.simplePDFHandler.showPreview();
        }
    } catch (error) {
        console.error('Preview error:', error);
        alert('Error creating preview: ' + error.message);
    }
};

console.log('✅ Simple PDF Handler loaded - use previewMergedDocumentSimple() for direct preview');