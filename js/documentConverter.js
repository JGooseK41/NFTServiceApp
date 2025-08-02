/**
 * Document Converter Module
 * Handles PDF and Word document conversion to images with preview generation
 */

class DocumentConverter {
    constructor() {
        this.pdfjs = null;
        this.mammoth = null;
        this.initialized = false;
    }
    
    /**
     * Initialize required libraries
     */
    async init() {
        if (this.initialized) return;
        
        // Load PDF.js
        if (typeof pdfjsLib !== 'undefined') {
            this.pdfjs = pdfjsLib;
            this.pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            console.log('PDF.js initialized');
        } else {
            console.error('PDF.js library not loaded');
        }
        
        // Load Mammoth for Word docs
        if (typeof mammoth !== 'undefined') {
            this.mammoth = mammoth;
            console.log('Mammoth.js initialized');
        }
        
        this.initialized = true;
    }
    
    /**
     * Convert uploaded file to service format
     * @param {File} file - The uploaded file (PDF or Word)
     * @returns {Object} Preview image and full document data
     */
    async convertDocument(file) {
        await this.init();
        
        const fileType = file.type;
        const fileName = file.name.toLowerCase();
        
        if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
            return await this.convertPDF(file);
        } else if (
            fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            fileType === 'application/msword' ||
            fileName.endsWith('.docx') ||
            fileName.endsWith('.doc')
        ) {
            return await this.convertWord(file);
        } else {
            throw new Error('Unsupported file type. Please upload PDF or Word documents.');
        }
    }
    
    /**
     * Convert PDF to images
     */
    async convertPDF(file) {
        if (!this.pdfjs) {
            throw new Error('PDF.js not loaded. Please refresh the page and try again.');
        }
        
        console.log('Converting PDF:', file.name, 'Size:', file.size);
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            console.log('ArrayBuffer created, size:', arrayBuffer.byteLength);
            
            const loadingTask = this.pdfjs.getDocument(arrayBuffer);
            const pdf = await loadingTask.promise;
            console.log('PDF loaded, pages:', pdf.numPages);
        
            // Generate preview from first page
            const previewImage = await this.generatePDFPreview(pdf, 1);
            
            // Convert all pages to images for full document
            const fullPages = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const pageImage = await this.renderPDFPage(pdf, i, 800); // Reduced res for manageable size
                fullPages.push(pageImage);
            }
            
            // Create a combined image or PDF for IPFS
            const fullDocument = await this.combinePagesToDocument(fullPages, 'pdf');
            
            return {
                preview: previewImage,
                fullDocument: fullDocument,
                documentHash: await this.hashDocument(arrayBuffer),
                pageCount: pdf.numPages,
                fileType: 'pdf'
            };
        } catch (error) {
            console.error('PDF conversion error:', error);
            throw error;
        }
    }
    
    /**
     * Convert Word document to images
     */
    async convertWord(file) {
        if (!this.mammoth) {
            throw new Error('Mammoth.js not loaded');
        }
        
        const arrayBuffer = await file.arrayBuffer();
        
        // Convert to HTML first
        const result = await this.mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
        const html = result.value;
        
        // Convert HTML to image using canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Create a temporary container
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.width = '816px'; // Letter width at 96 DPI
        container.style.padding = '40px';
        container.style.background = 'white';
        container.style.fontFamily = 'Arial, sans-serif';
        container.innerHTML = html;
        document.body.appendChild(container);
        
        // Use html2canvas to convert to image
        const previewImage = await this.htmlToImage(container, 600); // Preview resolution
        const fullDocument = await this.htmlToImage(container, 1200); // Full resolution
        
        // Clean up
        document.body.removeChild(container);
        
        return {
            preview: previewImage,
            fullDocument: fullDocument,
            documentHash: await this.hashDocument(arrayBuffer),
            pageCount: 1, // Simplified for Word docs
            fileType: 'word'
        };
    }
    
    /**
     * Generate preview image from first page of PDF
     */
    async generatePDFPreview(pdf, pageNum) {
        // Balanced resolution for readable preview
        // 800px width provides decent readability while keeping file size manageable
        return await this.renderPDFPage(pdf, pageNum, 800, true); // Balanced res for preview
    }
    
    /**
     * Render a single PDF page to base64 image
     */
    async renderPDFPage(pdf, pageNum, maxWidth, isPreview = false) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        
        // Calculate scale to fit maxWidth
        const scale = maxWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale: scale });
        
        // Create canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;
        
        // Set high quality rendering
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        // White background
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Render PDF page to canvas
        await page.render({
            canvasContext: context,
            viewport: scaledViewport,
            intent: 'display' // Better quality for display
        }).promise;
        
        // Add watermark for service
        this.addServiceWatermark(context, canvas.width, canvas.height, isPreview);
        
        // Convert to base64 with quality settings
        if (isPreview) {
            // For preview, balance quality and size
            return canvas.toDataURL('image/jpeg', 0.85);
        } else {
            // For full document, use JPEG to reduce size
            return canvas.toDataURL('image/jpeg', 0.90);
        }
    }
    
    /**
     * Convert HTML element to image using html2canvas
     */
    async htmlToImage(element, maxWidth) {
        // This requires html2canvas library
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas not loaded');
        }
        
        const canvas = await html2canvas(element, {
            scale: maxWidth / element.offsetWidth,
            backgroundColor: '#ffffff'
        });
        
        // Add watermark
        const ctx = canvas.getContext('2d');
        this.addServiceWatermark(ctx, canvas.width, canvas.height);
        
        return canvas.toDataURL('image/png');
    }
    
    /**
     * Add service watermark to document
     */
    addServiceWatermark(ctx, width, height, isPreview = false) {
        // For preview, add a border and header instead of intrusive watermark
        if (isPreview) {
            // Add border
            ctx.save();
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, width - 4, height - 4);
            
            // Add header bar
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(0, 0, width, 60);
            
            // Add text in header
            ctx.fillStyle = 'white';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('LEGAL SERVICE DOCUMENT', width / 2, 40);
            
            // Add timestamp at bottom
            ctx.fillStyle = '#666666';
            ctx.font = '14px Arial';
            ctx.textAlign = 'right';
            const timestamp = new Date().toLocaleString();
            ctx.fillText(`Preview generated: ${timestamp}`, width - 10, height - 10);
            ctx.restore();
        } else {
            // For full document, use subtle watermark
            ctx.save();
            ctx.globalAlpha = 0.05; // Very subtle
            ctx.font = 'bold 72px Arial';
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.translate(width / 2, height / 2);
            ctx.rotate(-45 * Math.PI / 180);
            ctx.fillText('LEGAL SERVICE', 0, 0);
            ctx.restore();
            
            // Add timestamp
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.font = '12px Arial';
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'right';
            const timestamp = new Date().toISOString();
            ctx.fillText(`Generated: ${timestamp}`, width - 10, height - 10);
            ctx.restore();
        }
    }
    
    /**
     * Combine multiple page images into a single document
     */
    async combinePagesToDocument(pages, format) {
        if (format === 'pdf') {
            // For PDF, we'll create a new PDF with images
            // This requires jsPDF library
            if (typeof jsPDF === 'undefined') {
                // If jsPDF not available, return as image array
                return {
                    type: 'image-array',
                    data: pages
                };
            }
            
            const pdf = new jsPDF();
            for (let i = 0; i < pages.length; i++) {
                if (i > 0) pdf.addPage();
                
                // Add image to PDF
                const imgData = pages[i];
                pdf.addImage(imgData, 'PNG', 10, 10, 190, 0);
            }
            
            return {
                type: 'pdf',
                data: pdf.output('datauristring')
            };
        } else {
            // Return as combined image
            return {
                type: 'combined-image',
                data: await this.combineImages(pages)
            };
        }
    }
    
    /**
     * Combine multiple images into one long image
     */
    async combineImages(images) {
        // Create temporary images to get dimensions
        const imgElements = await Promise.all(images.map(src => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.src = src;
            });
        }));
        
        // Calculate total height
        const maxWidth = Math.max(...imgElements.map(img => img.width));
        const totalHeight = imgElements.reduce((sum, img) => sum + img.height, 0);
        
        // Create combined canvas
        const canvas = document.createElement('canvas');
        canvas.width = maxWidth;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d');
        
        // Draw all images
        let currentY = 0;
        for (const img of imgElements) {
            ctx.drawImage(img, 0, currentY);
            currentY += img.height;
        }
        
        return canvas.toDataURL('image/png');
    }
    
    /**
     * Generate SHA256 hash of document
     */
    async hashDocument(arrayBuffer) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return '0x' + hashHex;
    }
    
    /**
     * Compress image for blockchain storage while maintaining readability
     */
    async compressImage(base64Image, maxSize = 200000) { // 200KB default for better readability
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                let quality = 0.9;
                
                // For legal documents, balance readability and size
                // Adjust based on target size
                const minWidth = maxSize > 300000 ? 800 : 600;
                const maxWidth = maxSize > 300000 ? 1000 : 800;
                
                // Scale to optimal size
                if (width < minWidth) {
                    // Upscale if too small
                    const scale = minWidth / width;
                    width *= scale;
                    height *= scale;
                } else if (width > maxWidth) {
                    // Downscale if too large
                    const scale = maxWidth / width;
                    width *= scale;
                    height *= scale;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                // High quality settings
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // White background for documents
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                
                // Draw image
                ctx.drawImage(img, 0, 0, width, height);
                
                // Add border for preview
                ctx.strokeStyle = '#e74c3c';
                ctx.lineWidth = 3;
                ctx.strokeRect(1.5, 1.5, width - 3, height - 3);
                
                // Try different quality levels
                let result = canvas.toDataURL('image/jpeg', quality);
                
                // If still too large, reduce quality gradually
                while (result.length > maxSize && quality > 0.5) {
                    quality -= 0.05;
                    result = canvas.toDataURL('image/jpeg', quality);
                }
                
                // If still too large, reduce dimensions
                if (result.length > maxSize) {
                    const scaleFactor = 0.8;
                    width *= scaleFactor;
                    height *= scaleFactor;
                    canvas.width = width;
                    canvas.height = height;
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    result = canvas.toDataURL('image/jpeg', 0.7);
                }
                
                console.log(`Preview compressed: ${(result.length / 1024).toFixed(1)}KB at ${width}x${height}`);
                
                resolve(result);
            };
            img.src = base64Image;
        });
    }
}

// Export for use in main app
window.DocumentConverter = DocumentConverter;