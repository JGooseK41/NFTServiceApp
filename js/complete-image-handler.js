/**
 * Complete Image Handler
 * Manages all image creation, storage, and retrieval for NFT notices
 */

window.CompleteImageHandler = {
    
    // Configuration
    config: {
        backend: 'https://nftserviceapp.onrender.com',
        maxImageSize: 5 * 1024 * 1024, // 5MB
        thumbnailWidth: 600,
        fullImageWidth: 1200,
        jpegQuality: 0.85
    },
    
    /**
     * Process uploaded document and create images
     */
    async processDocument(file) {
        console.log('📄 Processing document:', file.name, 'Size:', file.size);
        
        // Validate file
        if (!file) {
            throw new Error('No file provided');
        }
        
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
            throw new Error('File too large. Maximum size is 50MB');
        }
        
        // Check file type
        const fileType = file.type.toLowerCase();
        const fileName = file.name.toLowerCase();
        
        let images = null;
        
        if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
            images = await this.processPDF(file);
        } else if (fileType.startsWith('image/')) {
            images = await this.processImage(file);
        } else {
            throw new Error('Unsupported file type. Please upload PDF or image files.');
        }
        
        // Store processed images temporarily
        this.storeTemporaryImages(images);
        
        return images;
    },
    
    /**
     * Process PDF file into images
     */
    async processPDF(file) {
        console.log('📑 Processing PDF...');
        
        // Ensure PDF.js is loaded
        if (typeof pdfjsLib === 'undefined') {
            await this.loadPDFJS();
        }
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        console.log(`PDF has ${pdf.numPages} pages`);
        
        // Create alert thumbnail (first page with watermark)
        const alertThumbnail = await this.renderPDFPage(pdf, 1, this.config.thumbnailWidth, true);
        
        // Create full document image (all pages combined)
        let documentImage;
        if (pdf.numPages === 1) {
            documentImage = await this.renderPDFPage(pdf, 1, this.config.fullImageWidth, false);
        } else {
            documentImage = await this.combineAllPages(pdf);
        }
        
        return {
            alertImage: alertThumbnail,
            alertThumbnail: alertThumbnail,
            documentImage: documentImage,
            documentThumbnail: this.createThumbnail(documentImage),
            pageCount: pdf.numPages,
            fileType: 'pdf',
            fileName: file.name
        };
    },
    
    /**
     * Process image file
     */
    async processImage(file) {
        console.log('🖼️ Processing image...');
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                
                // Create alert version with watermark
                const alertImage = this.addWatermarkToImage(dataUrl);
                
                resolve({
                    alertImage: alertImage,
                    alertThumbnail: this.createThumbnail(alertImage),
                    documentImage: dataUrl,
                    documentThumbnail: this.createThumbnail(dataUrl),
                    pageCount: 1,
                    fileType: 'image',
                    fileName: file.name
                });
            };
            
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },
    
    /**
     * Render a PDF page to canvas
     */
    async renderPDFPage(pdf, pageNum, maxWidth, addWatermark) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        
        // Calculate scale to fit width
        const scale = maxWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });
        
        // Create canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        
        // White background
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Render PDF
        await page.render({
            canvasContext: context,
            viewport: scaledViewport
        }).promise;
        
        // Add watermark if requested
        if (addWatermark) {
            this.addCanvasWatermark(context, canvas.width, canvas.height);
        }
        
        return canvas.toDataURL('image/jpeg', this.config.jpegQuality);
    },
    
    /**
     * Combine all PDF pages into one tall image
     */
    async combineAllPages(pdf) {
        const pages = [];
        const pageHeight = [];
        let totalHeight = 0;
        const maxWidth = this.config.fullImageWidth;
        
        // Render all pages
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.0 });
            const scale = maxWidth / viewport.width;
            const scaledViewport = page.getViewport({ scale });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;
            
            context.fillStyle = 'white';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            await page.render({
                canvasContext: context,
                viewport: scaledViewport
            }).promise;
            
            pages.push(canvas);
            pageHeight.push(canvas.height);
            totalHeight += canvas.height;
        }
        
        // Combine into single canvas
        const combinedCanvas = document.createElement('canvas');
        const combinedContext = combinedCanvas.getContext('2d');
        combinedCanvas.width = maxWidth;
        combinedCanvas.height = totalHeight + (pages.length - 1) * 20; // Add spacing
        
        // White background
        combinedContext.fillStyle = 'white';
        combinedContext.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);
        
        // Draw all pages
        let currentY = 0;
        for (let i = 0; i < pages.length; i++) {
            if (i > 0) {
                // Add separator line
                currentY += 10;
                combinedContext.strokeStyle = '#e0e0e0';
                combinedContext.lineWidth = 1;
                combinedContext.beginPath();
                combinedContext.moveTo(50, currentY);
                combinedContext.lineTo(maxWidth - 50, currentY);
                combinedContext.stroke();
                currentY += 10;
            }
            
            combinedContext.drawImage(pages[i], 0, currentY);
            currentY += pageHeight[i];
        }
        
        return combinedCanvas.toDataURL('image/jpeg', this.config.jpegQuality);
    },
    
    /**
     * Add watermark to canvas
     */
    addCanvasWatermark(ctx, width, height) {
        ctx.save();
        
        // Red border
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, width - 4, height - 4);
        
        // Header bar
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, 0, width, 60);
        
        // Header text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LEGAL NOTICE', width / 2, 40);
        
        // Timestamp
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(new Date().toLocaleString(), width - 10, height - 10);
        
        ctx.restore();
    },
    
    /**
     * Add watermark to image data URL
     */
    addWatermarkToImage(dataUrl) {
        // This would require creating a canvas, drawing the image, 
        // then adding watermark. For now, return as-is.
        return dataUrl;
    },
    
    /**
     * Create thumbnail from full image
     */
    createThumbnail(dataUrl) {
        // For now, return the same image
        // In production, this would resize the image
        return dataUrl;
    },
    
    /**
     * Store images temporarily in localStorage
     */
    storeTemporaryImages(images) {
        localStorage.setItem('pendingAlertImage', images.alertImage);
        localStorage.setItem('pendingAlertThumbnail', images.alertThumbnail);
        localStorage.setItem('pendingDocumentImage', images.documentImage);
        localStorage.setItem('pendingDocumentThumbnail', images.documentThumbnail);
        localStorage.setItem('pendingImageMetadata', JSON.stringify({
            pageCount: images.pageCount,
            fileType: images.fileType,
            fileName: images.fileName,
            timestamp: Date.now()
        }));
        
        console.log('✅ Images stored temporarily');
    },
    
    /**
     * Store images permanently after NFT creation
     */
    async storePermanentImages(noticeId, txHash) {
        console.log('💾 Storing images permanently for notice:', noticeId);
        
        const alertImage = localStorage.getItem('pendingAlertImage');
        const documentImage = localStorage.getItem('pendingDocumentImage');
        const metadata = JSON.parse(localStorage.getItem('pendingImageMetadata') || '{}');
        
        if (!alertImage && !documentImage) {
            console.warn('No pending images to store');
            return null;
        }
        
        const imageData = {
            notice_id: noticeId,
            server_address: window.tronWeb?.defaultAddress?.base58,
            recipient_address: metadata.recipientAddress,
            alert_image: alertImage,
            document_image: documentImage,
            alert_thumbnail: localStorage.getItem('pendingAlertThumbnail'),
            document_thumbnail: localStorage.getItem('pendingDocumentThumbnail'),
            transaction_hash: txHash,
            metadata: metadata
        };
        
        try {
            const response = await fetch(`${this.config.backend}/api/images`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58
                },
                body: JSON.stringify(imageData)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to store images: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('✅ Images stored permanently:', result);
            
            // Clear temporary storage
            this.clearTemporaryImages();
            
            return result;
        } catch (error) {
            console.error('❌ Failed to store images:', error);
            // Keep temporary images for retry
            return null;
        }
    },
    
    /**
     * Retrieve images for a notice
     */
    async retrieveImages(noticeId) {
        console.log('🔍 Retrieving images for notice:', noticeId);
        
        try {
            const response = await fetch(`${this.config.backend}/api/images/${noticeId}`, {
                headers: {
                    'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58
                }
            });
            
            if (response.status === 404) {
                console.log('No images found for notice:', noticeId);
                return null;
            }
            
            if (!response.ok) {
                throw new Error(`Failed to retrieve images: ${response.status}`);
            }
            
            const images = await response.json();
            console.log('✅ Images retrieved:', images);
            return images;
        } catch (error) {
            console.error('❌ Failed to retrieve images:', error);
            return null;
        }
    },
    
    /**
     * Clear temporary images
     */
    clearTemporaryImages() {
        localStorage.removeItem('pendingAlertImage');
        localStorage.removeItem('pendingAlertThumbnail');
        localStorage.removeItem('pendingDocumentImage');
        localStorage.removeItem('pendingDocumentThumbnail');
        localStorage.removeItem('pendingImageMetadata');
        console.log('🧹 Cleared temporary images');
    },
    
    /**
     * Load PDF.js library
     */
    async loadPDFJS() {
        return new Promise((resolve) => {
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

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('✅ Complete Image Handler ready');
    });
} else {
    console.log('✅ Complete Image Handler ready');
}