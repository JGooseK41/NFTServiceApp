/**
 * Fast PDF Handler - Instant PDF processing without rendering all pages
 * Replaces the slow documentConverter that was rendering every page
 */

window.FastPDFHandler = {
    
    /**
     * Process PDF quickly - just store it and generate first page preview
     */
    async processPDF(file) {
        console.log('⚡ Fast PDF processing:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
        
        try {
            // Convert to base64 for storage (instant)
            const base64 = await this.fileToBase64(file);
            
            // Get page count and first page preview (fast)
            const pdfInfo = await this.getPDFInfo(file);
            
            return {
                // Store the full PDF as-is
                data: base64,
                fullDocument: base64,
                
                // Preview from first page only
                preview: pdfInfo.preview,
                thumbnail: pdfInfo.preview,
                
                // Metadata
                pageCount: pdfInfo.pageCount,
                fileName: file.name,
                fileSize: file.size,
                fileType: 'application/pdf',
                
                // For compatibility
                allPagePreviews: [pdfInfo.preview],
                documentHash: await this.hashFile(file)
            };
            
        } catch (error) {
            console.error('Fast PDF processing error:', error);
            
            // Simple fallback - just store the PDF
            const base64 = await this.fileToBase64(file);
            return {
                data: base64,
                fullDocument: base64,
                preview: this.createPlaceholderPreview(file.name),
                thumbnail: this.createPlaceholderPreview(file.name),
                pageCount: 1,
                fileName: file.name,
                fileSize: file.size,
                fileType: 'application/pdf',
                allPagePreviews: [],
                documentHash: await this.hashFile(file)
            };
        }
    },
    
    /**
     * Get PDF info quickly - just page count and first page
     */
    async getPDFInfo(file) {
        return new Promise(async (resolve) => {
            try {
                // Ensure PDF.js is loaded
                if (typeof pdfjsLib === 'undefined') {
                    await this.loadPDFJS();
                }
                
                const arrayBuffer = await file.arrayBuffer();
                
                // Load PDF with minimal options for speed
                const loadingTask = pdfjsLib.getDocument({
                    data: arrayBuffer,
                    disableAutoFetch: true,
                    disableStream: true,
                    disableFontFace: true, // Don't load fonts
                    disableRange: true,    // Don't use range requests
                    isEvalSupported: false  // Faster without eval
                });
                
                // Quick timeout - we just need page count
                const timeout = setTimeout(() => {
                    loadingTask.destroy();
                    resolve({
                        pageCount: 1,
                        preview: this.createPlaceholderPreview(file.name)
                    });
                }, 3000);
                
                const pdf = await loadingTask.promise;
                clearTimeout(timeout);
                
                const pageCount = pdf.getPageCount();
                console.log(`✅ PDF has ${pageCount} pages`);
                
                // Only render first page for preview
                let preview;
                try {
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({ scale: 1.0 });
                    const scale = 600 / viewport.width;
                    const scaledViewport = page.getViewport({ scale });
                    
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = scaledViewport.width;
                    canvas.height = scaledViewport.height;
                    
                    await page.render({
                        canvasContext: context,
                        viewport: scaledViewport
                    }).promise;
                    
                    preview = canvas.toDataURL('image/jpeg', 0.8);
                } catch (e) {
                    console.warn('Could not render preview:', e);
                    preview = this.createPlaceholderPreview(file.name);
                }
                
                // Clean up
                pdf.destroy();
                
                resolve({
                    pageCount: pageCount,
                    preview: preview
                });
                
            } catch (error) {
                console.warn('Could not get PDF info:', error);
                resolve({
                    pageCount: 1,
                    preview: this.createPlaceholderPreview(file.name)
                });
            }
        });
    },
    
    /**
     * Convert file to base64
     */
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },
    
    /**
     * Create simple hash of file
     */
    async hashFile(file) {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    /**
     * Create placeholder preview
     */
    createPlaceholderPreview(fileName) {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 600, 800);
        
        // Border
        ctx.strokeStyle = '#ddd';
        ctx.strokeRect(10, 10, 580, 780);
        
        // PDF icon
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(250, 300, 100, 120);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.fillText('PDF', 265, 375);
        
        // File name
        ctx.fillStyle = '#333';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        const shortName = fileName.length > 40 ? fileName.substr(0, 37) + '...' : fileName;
        ctx.fillText(shortName, 300, 450);
        
        return canvas.toDataURL('image/jpeg', 0.8);
    },
    
    /**
     * Load PDF.js if needed
     */
    async loadPDFJS() {
        return new Promise((resolve) => {
            if (typeof pdfjsLib !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                console.log('✅ PDF.js loaded');
                resolve();
            };
            document.head.appendChild(script);
        });
    }
};

// Override the slow document converter
if (window.DocumentConverter) {
    const originalConvertPDF = window.DocumentConverter.convertPDF;
    
    window.DocumentConverter.convertPDF = async function(file) {
        console.log('🔄 Redirecting to FastPDFHandler...');
        return await window.FastPDFHandler.processPDF(file);
    };
    
    console.log('✅ Fast PDF Handler installed - PDFs will now load instantly');
} else {
    console.log('⚠️ DocumentConverter not found, FastPDFHandler available as standalone');
}

console.log('⚡ Fast PDF Handler ready - use FastPDFHandler.processPDF(file)');