/**
 * PDF Preserve Handler
 * Keeps PDFs as PDFs - only extracts first page for preview
 * Does NOT convert the entire document to images
 */

window.PDFPreserveHandler = {
    
    /**
     * Process PDF while preserving original format
     * Only creates a preview thumbnail, doesn't convert the document
     */
    async processPDF(file) {
        console.log('📄 Processing PDF (preserving original):', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
        
        try {
            // Read the PDF as base64 - this is the FULL PDF that will be stored
            const base64 = await this.fileToBase64(file);
            
            // Create a simple preview thumbnail for UI display only
            // This is NOT the alert image - that gets created at transaction time
            let previewThumbnail = null;
            let pageCount = 1;
            
            try {
                // Try to render first page for preview if PDF.js is available
                if (typeof pdfjsLib !== 'undefined') {
                    const arrayBuffer = await file.arrayBuffer();
                    const loadingTask = pdfjsLib.getDocument({
                        data: arrayBuffer,
                        disableAutoFetch: true,
                        disableStream: true
                    });
                    
                    const pdf = await loadingTask.promise;
                    pageCount = pdf.numPages;
                    console.log(`PDF has ${pageCount} pages`);
                    
                    // Just create a small thumbnail for UI preview
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({ scale: 0.5 }); // Small scale for thumbnail
                    
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    
                    context.fillStyle = 'white';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    
                    await page.render({
                        canvasContext: context,
                        viewport: viewport
                    }).promise;
                    
                    previewThumbnail = canvas.toDataURL('image/jpeg', 0.7);
                    pdf.destroy();
                }
            } catch (e) {
                console.log('Could not create preview thumbnail:', e);
            }
            
            // If we couldn't create a preview, use a simple placeholder
            if (!previewThumbnail) {
                previewThumbnail = this.createSimplePlaceholder(file.name, file.size);
            }
            
            // Return the ORIGINAL PDF data, not converted to images
            return {
                // Main data - the FULL PDF file
                data: base64,
                fullDocument: base64,
                
                // Preview is just for UI display
                preview: previewThumbnail,
                thumbnail: previewThumbnail,
                
                // These will be generated at transaction time
                alertImage: null,  // Will be created when minting
                alertThumbnail: null,  // Will be created when minting
                documentImage: base64,  // The actual PDF
                documentThumbnail: previewThumbnail,
                
                // Metadata
                pageCount: pageCount,
                fileName: file.name,
                fileSize: file.size,
                fileType: 'application/pdf',  // Keep as PDF!
                originalType: 'application/pdf',
                convertedType: null,  // NOT converted
                allPagePreviews: [],  // Not needed - we're keeping as PDF
                documentHash: 'hash_' + Date.now()
            };
            
        } catch (error) {
            console.error('PDF processing failed:', error);
            throw error;
        }
    },
    
    /**
     * Convert file to base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },
    
    /**
     * Create simple placeholder for preview
     */
    createSimplePlaceholder(fileName, fileSize) {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 260;
        const ctx = canvas.getContext('2d');
        
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 260);
        
        // Border
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.strokeRect(10, 10, 180, 240);
        
        // PDF icon
        ctx.fillStyle = '#dc2626';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('📄', 100, 100);
        
        // Text
        ctx.fillStyle = '#374151';
        ctx.font = '12px Arial';
        ctx.fillText('PDF Document', 100, 140);
        
        // File size
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px Arial';
        ctx.fillText(`${(fileSize / 1024).toFixed(1)} KB`, 100, 160);
        
        return canvas.toDataURL('image/jpeg', 0.7);
    }
};

/**
 * Create alert image with overlay ONLY at transaction time
 * This should be called when actually minting, not during upload
 */
window.createAlertImageAtTransaction = async function(pdfBase64) {
    console.log('🎨 Creating alert image for transaction...');
    
    try {
        // Load PDF.js if needed
        if (typeof pdfjsLib === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            await new Promise((resolve, reject) => {
                script.onload = () => {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    resolve();
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        // Convert base64 to array buffer
        const base64Data = pdfBase64.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Load the PDF
        const loadingTask = pdfjsLib.getDocument({
            data: bytes,
            disableAutoFetch: false,
            disableStream: false
        });
        
        const pdf = await loadingTask.promise;
        
        // Render first page at high quality
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // White background
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Render the PDF page
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        // Add legal notice overlay
        context.save();
        
        // Red border
        context.strokeStyle = '#dc2626';
        context.lineWidth = 8;
        context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
        
        // Header bar
        context.fillStyle = '#dc2626';
        context.fillRect(0, 0, canvas.width, 120);
        
        // Header text
        context.fillStyle = 'white';
        context.font = 'bold 60px Arial';
        context.textAlign = 'center';
        context.fillText('LEGAL NOTICE', canvas.width / 2, 75);
        
        // Footer bar
        context.fillStyle = 'rgba(220, 38, 38, 0.9)';
        context.fillRect(0, canvas.height - 80, canvas.width, 80);
        
        // Footer text
        context.fillStyle = 'white';
        context.font = '32px Arial';
        context.textAlign = 'center';
        context.fillText('Blockchain Service Document', canvas.width / 2, canvas.height - 35);
        
        context.restore();
        
        // Clean up
        pdf.destroy();
        
        // Return the alert image
        return canvas.toDataURL('image/jpeg', 0.85);
        
    } catch (error) {
        console.error('Failed to create alert image:', error);
        // Return a fallback alert image
        return createFallbackAlertImage();
    }
};

function createFallbackAlertImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 800, 1000);
    
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 792, 992);
    
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 800, 100);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('LEGAL NOTICE', 400, 65);
    
    ctx.fillStyle = '#374151';
    ctx.font = '24px Arial';
    ctx.fillText('Document Attached', 400, 500);
    
    return canvas.toDataURL('image/jpeg', 0.85);
}

// Replace the ProperPDFHandler with PDFPreserveHandler
window.UltraFastPDFHandler = window.PDFPreserveHandler;
window.ProperPDFHandler = window.PDFPreserveHandler;

console.log('✅ PDF Preserve Handler loaded');
console.log('   - PDFs stored as PDFs, not converted to images');
console.log('   - First page extracted for alert only at transaction time');
console.log('   - Full document preserved in original format');