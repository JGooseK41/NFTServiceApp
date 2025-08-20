/**
 * PDF Renderer - Properly extracts and renders PDF content
 * Creates actual page images from PDFs instead of placeholders
 */

class PDFRenderer {
    constructor() {
        this.pdfJsLoaded = false;
    }

    /**
     * Load PDF.js library if not already loaded
     */
    async loadPdfJs() {
        if (this.pdfJsLoaded && typeof pdfjsLib !== 'undefined') {
            return;
        }

        if (typeof pdfjsLib === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            
            await new Promise((resolve, reject) => {
                script.onload = () => {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 
                        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    this.pdfJsLoaded = true;
                    resolve();
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
    }

    /**
     * Read PDF file and extract its content
     * Returns both the full PDF data and rendered page images
     */
    async processPDF(file) {
        console.log(`📄 Processing PDF: ${file.name}`);
        
        // First, read the file as base64 for storage
        const base64Data = await this.readFileAsBase64(file);
        
        // Load PDF.js
        await this.loadPdfJs();
        
        // Extract pages as images
        const pageImages = await this.extractPDFPages(base64Data);
        
        return {
            // Full PDF data for document storage
            fullPdfData: base64Data,
            
            // First page as image for alert thumbnail
            alertThumbnail: pageImages.length > 0 ? pageImages[0] : null,
            
            // All pages as images for preview
            pageImages: pageImages,
            
            // Page count
            pageCount: pageImages.length,
            
            // File metadata
            fileName: file.name,
            fileSize: file.size,
            fileType: 'application/pdf'
        };
    }

    /**
     * Read file as base64 data URL
     */
    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Extract all pages from PDF as images
     */
    async extractPDFPages(pdfBase64) {
        try {
            // Convert base64 to Uint8Array
            const base64Data = pdfBase64.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Load PDF document
            const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
            const pageImages = [];
            
            console.log(`📄 PDF has ${pdf.numPages} pages`);
            
            // Render each page (limit to first 10 pages for performance)
            const maxPages = Math.min(pdf.numPages, 10);
            
            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 2 }); // High quality
                
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
                
                // Add legal notice overlay for alert (first page only)
                if (pageNum === 1) {
                    this.addLegalNoticeOverlay(ctx, canvas.width, canvas.height);
                }
                
                // Convert to image
                const imageData = canvas.toDataURL('image/png', 0.9);
                pageImages.push(imageData);
                
                console.log(`✅ Rendered page ${pageNum}/${pdf.numPages}`);
            }
            
            return pageImages;
            
        } catch (error) {
            console.error('Error extracting PDF pages:', error);
            // Return placeholder if extraction fails
            return [this.createPlaceholderImage()];
        }
    }

    /**
     * Add legal notice overlay to image (for alert thumbnail)
     */
    addLegalNoticeOverlay(ctx, width, height) {
        // Semi-transparent overlay at top
        const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.3);
        gradient.addColorStop(0, 'rgba(220, 38, 38, 0.95)'); // Red
        gradient.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height * 0.3);
        
        // Add "LEGAL NOTICE" text
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.floor(width * 0.08)}px Arial`;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText('LEGAL NOTICE', width / 2, height * 0.1);
        
        // Add "OFFICIAL DOCUMENT" subtitle
        ctx.font = `${Math.floor(width * 0.04)}px Arial`;
        ctx.fillText('OFFICIAL DOCUMENT', width / 2, height * 0.15);
        
        // Add timestamp
        const timestamp = new Date().toLocaleString();
        ctx.font = `${Math.floor(width * 0.03)}px Arial`;
        ctx.fillText(`Generated: ${timestamp}`, width / 2, height * 0.2);
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }

    /**
     * Create a placeholder image if PDF rendering fails
     */
    createPlaceholderImage() {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 600, 800);
        
        // Error message
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PDF Rendering Failed', 300, 400);
        
        ctx.fillStyle = '#6b7280';
        ctx.font = '16px Arial';
        ctx.fillText('Document will be stored but preview unavailable', 300, 440);
        
        return canvas.toDataURL('image/png');
    }
}

// Initialize global instance
window.pdfRenderer = new PDFRenderer();

console.log('✅ PDF Renderer loaded - will extract actual PDF content instead of placeholders');