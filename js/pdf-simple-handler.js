/**
 * Simple PDF Handler - Minimal processing for efficient storage
 * - Store PDF file on Render disk
 * - Upload to IPFS as-is (encrypted)
 * - Only extract first page for thumbnail
 */

class SimplePDFHandler {
    constructor() {
        this.pdfJsLoaded = false;
    }

    /**
     * Process PDF minimally - just get thumbnail and prepare for storage
     */
    async processPDF(file) {
        console.log(`📄 Processing PDF: ${file.name}`);
        
        const result = {
            file: file,
            fileName: file.name,
            fileSize: file.size,
            fileType: 'application/pdf',
            
            // For IPFS - read file once as base64
            pdfData: await this.readFileAsBase64(file),
            
            // Extract just first page as thumbnail
            thumbnail: null
        };
        
        // Try to extract first page for thumbnail
        try {
            result.thumbnail = await this.extractFirstPageAsImage(result.pdfData);
            console.log('✅ Extracted first page thumbnail');
        } catch (error) {
            console.warn('Could not extract thumbnail, using placeholder:', error);
            result.thumbnail = this.createPlaceholderThumbnail(file.name, file.size);
        }
        
        return result;
    }

    /**
     * Read file as base64 - needed for IPFS upload
     */
    async readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Extract ONLY first page as image for thumbnail
     */
    async extractFirstPageAsImage(pdfBase64) {
        // Load PDF.js if needed
        if (!this.pdfJsLoaded && typeof pdfjsLib === 'undefined') {
            await this.loadPdfJs();
        }
        
        // Convert base64 to Uint8Array
        const base64Data = pdfBase64.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Load PDF and render ONLY first page
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const page = await pdf.getPage(1);
        
        // Render at reasonable resolution for thumbnail
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;
        
        // Add legal notice overlay
        this.addLegalNoticeOverlay(ctx, canvas.width, canvas.height);
        
        // Return as compressed JPEG for efficiency
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    /**
     * Add legal notice overlay to thumbnail
     */
    addLegalNoticeOverlay(ctx, width, height) {
        // Red banner at top
        ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
        ctx.fillRect(0, 0, width, height * 0.15);
        
        // Text
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.floor(width * 0.06)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('LEGAL NOTICE', width / 2, height * 0.08);
        
        // Timestamp
        ctx.font = `${Math.floor(width * 0.03)}px Arial`;
        ctx.fillText(new Date().toLocaleDateString(), width / 2, height * 0.12);
    }

    /**
     * Create placeholder if PDF rendering fails
     */
    createPlaceholderThumbnail(fileName, fileSize) {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 400, 500);
        
        // Red header
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, 0, 400, 60);
        
        // Header text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LEGAL NOTICE', 200, 40);
        
        // PDF icon
        ctx.fillStyle = '#6b7280';
        ctx.font = '48px Arial';
        ctx.fillText('📄', 200, 200);
        
        // File info
        ctx.font = '16px Arial';
        ctx.fillStyle = '#374151';
        ctx.fillText(fileName.substring(0, 30), 200, 250);
        ctx.font = '14px Arial';
        ctx.fillText(`${(fileSize / 1024).toFixed(1)} KB`, 200, 280);
        
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    /**
     * Load PDF.js library
     */
    async loadPdfJs() {
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

// Initialize global instance
window.simplePDFHandler = new SimplePDFHandler();

console.log('✅ Simple PDF Handler loaded - efficient PDF processing');