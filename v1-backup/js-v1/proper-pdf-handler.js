/**
 * Proper PDF Handler - Actually renders PDF content for previews
 * Replaces UltraFastPDFHandler which was creating placeholder images
 */

window.ProperPDFHandler = {
    
    /**
     * Process PDF and create actual preview from first page
     */
    async processPDF(file) {
        console.log('📄 Processing PDF properly:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
        const startTime = Date.now();
        
        try {
            // Convert to base64 for storage
            const base64 = await this.fileToBase64(file);
            
            // Actually render the first page for preview
            let preview = null;
            let pageCount = 1;
            let alertImage = null;
            
            try {
                // Load PDF.js if not already loaded
                if (typeof pdfjsLib === 'undefined') {
                    await this.loadPDFJS();
                }
                
                // Load the PDF
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({
                    data: arrayBuffer,
                    disableAutoFetch: false,
                    disableStream: false
                });
                
                const pdf = await loadingTask.promise;
                pageCount = pdf.numPages;
                console.log(`PDF has ${pageCount} pages`);
                
                // Render first page for preview
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 1.5 });
                
                // Create canvas for rendering
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                // White background
                context.fillStyle = 'white';
                context.fillRect(0, 0, canvas.width, canvas.height);
                
                // Render the actual PDF page
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
                
                // Create document preview (just the rendered page)
                preview = canvas.toDataURL('image/jpeg', 0.9);
                
                // Create alert image with overlay
                const alertCanvas = document.createElement('canvas');
                const alertCtx = alertCanvas.getContext('2d');
                alertCanvas.width = canvas.width;
                alertCanvas.height = canvas.height;
                
                // Draw the PDF page first
                alertCtx.drawImage(canvas, 0, 0);
                
                // Add legal notice overlay
                this.addLegalNoticeOverlay(alertCtx, alertCanvas.width, alertCanvas.height);
                
                alertImage = alertCanvas.toDataURL('image/jpeg', 0.9);
                
                // Clean up
                pdf.destroy();
                
                console.log(`✅ PDF rendered in ${Date.now() - startTime}ms`);
                
            } catch (renderError) {
                console.error('Failed to render PDF:', renderError);
                // Create a simple fallback that still shows it's a PDF
                preview = this.createFallbackPreview(file.name, file.size);
                alertImage = preview;
            }
            
            return {
                data: base64,
                fullDocument: base64,
                preview: preview,
                alertImage: alertImage || preview,
                alertThumbnail: alertImage || preview,
                documentImage: preview,
                documentThumbnail: preview,
                thumbnail: preview,
                pageCount: pageCount,
                fileName: file.name,
                fileSize: file.size,
                fileType: 'application/pdf',
                allPagePreviews: [],
                documentHash: 'hash_' + Date.now()
            };
            
        } catch (error) {
            console.error('PDF processing failed:', error);
            // Return with fallback preview
            const fallback = this.createFallbackPreview(file.name, file.size);
            return {
                data: await this.fileToBase64(file),
                fullDocument: await this.fileToBase64(file),
                preview: fallback,
                alertImage: fallback,
                alertThumbnail: fallback,
                documentImage: fallback,
                documentThumbnail: fallback,
                thumbnail: fallback,
                pageCount: 1,
                fileName: file.name,
                fileSize: file.size,
                fileType: 'application/pdf',
                allPagePreviews: [],
                documentHash: 'hash_' + Date.now()
            };
        }
    },
    
    /**
     * Add legal notice overlay to canvas
     */
    addLegalNoticeOverlay(ctx, width, height) {
        ctx.save();
        
        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(220, 38, 38, 0.05)';
        ctx.fillRect(0, 0, width, height);
        
        // Red border
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, width - 8, height - 8);
        
        // Header bar
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, 0, width, 100);
        
        // Header text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LEGAL NOTICE', width / 2, 50);
        
        // Footer bar
        ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
        ctx.fillRect(0, height - 60, width, 60);
        
        // Footer text
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Blockchain Service Document', width / 2, height - 30);
        
        // Timestamp
        ctx.font = '16px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(new Date().toLocaleString(), width - 20, height - 15);
        
        ctx.restore();
    },
    
    /**
     * Load PDF.js library
     */
    async loadPDFJS() {
        if (typeof pdfjsLib !== 'undefined') return;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
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
     * Create fallback preview when rendering fails
     */
    createFallbackPreview(fileName, fileSize) {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 600, 800);
        
        // Border
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, 560, 760);
        
        // Content area
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(40, 120, 520, 640);
        
        // Title
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PDF Document', 300, 80);
        
        // File info
        ctx.fillStyle = '#374151';
        ctx.font = '18px Arial';
        ctx.fillText(fileName, 300, 200);
        
        ctx.font = '14px Arial';
        ctx.fillText(`Size: ${(fileSize / 1024).toFixed(1)} KB`, 300, 230);
        
        // Message
        ctx.fillStyle = '#6b7280';
        ctx.font = '16px Arial';
        ctx.fillText('Full document will be uploaded', 300, 400);
        ctx.fillText('to blockchain storage', 300, 430);
        
        return canvas.toDataURL('image/jpeg', 0.8);
    }
};

// Replace UltraFastPDFHandler with ProperPDFHandler
window.UltraFastPDFHandler = window.ProperPDFHandler;

console.log('✅ Proper PDF Handler loaded - PDFs will now show actual content');