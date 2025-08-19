/**
 * Binary PDF Handler - Keeps PDFs as binary, no unnecessary base64 conversion
 * Only the Alert NFT thumbnail needs base64 for blockchain storage
 */

class BinaryPDFHandler {
    constructor() {
        this.documents = [];  // Store File objects, not base64
        this.mergedPDF = null;
        this.alertThumbnail = null;  // Only this needs to be base64
    }

    /**
     * Add a document to the queue - keep as File object
     */
    async addDocument(file) {
        if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
            throw new Error('Only PDF files are supported');
        }

        // Store the actual File object - NO CONVERSION
        this.documents.push({
            id: Date.now() + Math.random(),
            file: file,  // Keep as File object
            name: file.name,
            size: file.size,
            type: file.type
        });

        console.log(`Added ${file.name} (${(file.size/1024/1024).toFixed(2)} MB) - kept as binary`);
        return true;
    }

    /**
     * Merge PDFs - work with binary data directly
     */
    async mergePDFs() {
        if (!window.PDFLib) {
            throw new Error('PDF library not loaded');
        }

        const { PDFDocument } = window.PDFLib;
        const mergedPdf = await PDFDocument.create();
        
        let totalPages = 0;
        
        for (let i = 0; i < this.documents.length; i++) {
            const doc = this.documents[i];
            console.log(`Merging ${doc.name}...`);
            
            // Read file as ArrayBuffer (binary) - NOT base64
            const arrayBuffer = await doc.file.arrayBuffer();
            const pdfBytes = new Uint8Array(arrayBuffer);
            
            // Load and merge
            const pdf = await PDFDocument.load(pdfBytes);
            const pageCount = pdf.getPageCount();
            
            // Add separator if not first document
            if (i > 0) {
                const separatorPage = mergedPdf.addPage();
                const { width, height } = separatorPage.getSize();
                separatorPage.drawText(`--- Document ${i + 1}: ${doc.name} ---`, {
                    x: 50,
                    y: height / 2,
                    size: 20
                });
            }
            
            // Copy all pages
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));
            totalPages += pageCount;
        }
        
        // Save as binary Uint8Array
        const mergedBytes = await mergedPdf.save();
        
        // Create Blob for the merged PDF - keep as binary
        this.mergedPDF = new Blob([mergedBytes], { type: 'application/pdf' });
        
        console.log(`✅ Merged ${this.documents.length} PDFs: ${totalPages} total pages, ${(this.mergedPDF.size/1024/1024).toFixed(2)} MB`);
        
        // Generate Alert thumbnail from first page - ONLY this needs base64
        await this.generateAlertThumbnail(mergedBytes);
        
        return this.mergedPDF;
    }

    /**
     * Generate Alert NFT thumbnail - ONLY this needs base64
     */
    async generateAlertThumbnail(pdfBytes) {
        try {
            if (!window.pdfjsLib) {
                console.warn('PDF.js not loaded for thumbnail generation');
                return;
            }

            // Load PDF
            const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
            
            // Get first page
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.5 });
            
            // Render to canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;
            
            // Add "LEGAL NOTICE" stamp overlay
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(0, 0, canvas.width, 80);
            
            ctx.fillStyle = '#DC143C';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('LEGAL NOTICE', canvas.width / 2, 40);
            
            ctx.font = '20px Arial';
            ctx.fillStyle = '#8B0000';
            const caseNumber = document.getElementById('mintCaseNumber')?.value || 'PENDING';
            ctx.fillText(`Case: ${caseNumber}`, canvas.width / 2, 65);
            
            // Convert to base64 - ONLY for the Alert NFT
            this.alertThumbnail = canvas.toDataURL('image/png');
            
            console.log('✅ Alert thumbnail generated (base64) for blockchain storage');
            
            return this.alertThumbnail;
            
        } catch (error) {
            console.error('Error generating thumbnail:', error);
            // Fallback - create simple text thumbnail
            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 500;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#DC143C';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('LEGAL NOTICE', canvas.width / 2, 100);
            
            ctx.fillStyle = '#333';
            ctx.font = '16px Arial';
            ctx.fillText('Document Ready', canvas.width / 2, 150);
            
            this.alertThumbnail = canvas.toDataURL('image/png');
            return this.alertThumbnail;
        }
    }

    /**
     * Save to backend - send as binary FormData
     */
    async saveToBackend() {
        if (!this.mergedPDF) {
            throw new Error('No merged PDF to save');
        }

        const formData = new FormData();
        
        // Add the merged PDF as a binary file - NO base64 conversion
        formData.append('pdf', this.mergedPDF, 'merged_document.pdf');
        
        // Add metadata
        const caseNumber = document.getElementById('mintCaseNumber')?.value || `CASE-${Date.now()}`;
        formData.append('noticeId', caseNumber);
        formData.append('caseNumber', caseNumber);
        
        // Add Alert thumbnail if available (this is base64 and that's OK)
        if (this.alertThumbnail) {
            formData.append('alertThumbnail', this.alertThumbnail);
        }
        
        // Send to backend
        const response = await fetch(`${window.BACKEND_API_URL}/api/v2/documents/upload-to-disk`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to save to backend');
        }
        
        const result = await response.json();
        console.log('✅ Saved to backend (as binary):', result);
        
        return result;
    }

    /**
     * Show preview - display the binary PDF directly
     */
    showPreview() {
        if (!this.mergedPDF) {
            console.error('No merged PDF to preview');
            return;
        }

        // Create object URL from the Blob - no base64!
        const pdfUrl = URL.createObjectURL(this.mergedPDF);
        
        // Remove existing modal
        const existingModal = document.querySelector('.binary-preview-modal');
        if (existingModal) existingModal.remove();

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal binary-preview-modal';
        modal.style.display = 'block';
        modal.style.zIndex = '10000';
        
        const caseNumber = document.getElementById('mintCaseNumber')?.value || 'PENDING';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 90%; width: 1000px; height: 90vh;">
                <div class="modal-header">
                    <h2>📄 Merged PDF Preview - Binary Mode</h2>
                    <span class="close" onclick="this.closest('.modal').remove(); URL.revokeObjectURL('${pdfUrl}')">&times;</span>
                </div>
                <div class="modal-body" style="height: calc(100% - 120px); padding: 0;">
                    <embed src="${pdfUrl}" type="application/pdf" style="width: 100%; height: 100%;" />
                </div>
                <div class="modal-footer" style="padding: 10px; display: flex; justify-content: space-between;">
                    <span style="color: #666;">
                        Case: ${caseNumber} | 
                        Size: ${(this.mergedPDF.size / 1024 / 1024).toFixed(2)} MB | 
                        Documents: ${this.documents.length}
                    </span>
                    <span style="color: #28a745;">
                        ✅ Using binary mode - no base64 conversion
                    </span>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Clean up object URL when modal is closed
        modal.querySelector('.close').addEventListener('click', () => {
            URL.revokeObjectURL(pdfUrl);
        });
    }

    /**
     * Clear all documents
     */
    clear() {
        this.documents = [];
        this.mergedPDF = null;
        this.alertThumbnail = null;
        console.log('Cleared all documents');
    }
}

// Create global instance
window.binaryPDFHandler = new BinaryPDFHandler();

// Override the preview function to use binary handler
window.previewMergedDocumentBinary = async function() {
    try {
        const handler = window.binaryPDFHandler;
        
        if (handler.documents.length === 0) {
            alert('No documents to preview. Please upload PDFs first.');
            return;
        }
        
        // Merge PDFs (binary mode)
        await handler.mergePDFs();
        
        // Save to backend
        await handler.saveToBackend();
        
        // Show preview
        handler.showPreview();
        
        // Store the alert thumbnail for blockchain
        if (handler.alertThumbnail) {
            window.alertNFTImage = handler.alertThumbnail;  // Only this is base64
            console.log('Alert NFT thumbnail ready for blockchain (base64)');
        }
        
    } catch (error) {
        console.error('Error in binary preview:', error);
        alert('Error: ' + error.message);
    }
};

// Hook into file upload to use binary mode
window.handleBinaryUpload = function(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const handler = window.binaryPDFHandler;
    
    // Add files to handler (kept as binary)
    for (let file of files) {
        handler.addDocument(file);
    }
    
    console.log(`Added ${files.length} PDF(s) in binary mode - no base64 conversion`);
    
    // Clear input
    event.target.value = '';
};

console.log('✅ Binary PDF Handler loaded - PDFs stay as binary, only Alert thumbnail is base64');