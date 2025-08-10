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
            
            // For multi-page PDFs, create a combined image AND individual page previews
            let fullDocument;
            const allPagePreviews = []; // Store individual page previews
            
            if (pdf.numPages === 1) {
                // Single page - just use higher res version
                fullDocument = await this.renderPDFPage(pdf, 1, 1000, false);
                allPagePreviews.push(previewImage);
            } else {
                // Multiple pages - combine them into one tall image
                const fullPages = [];
                for (let i = 1; i <= pdf.numPages; i++) {
                    console.log(`Rendering page ${i} of ${pdf.numPages}`);
                    const pageImage = await this.renderPDFPage(pdf, i, 800); // Reduced res for manageable size
                    fullPages.push(pageImage);
                    
                    // Also create a preview version for display
                    const pagePreview = await this.renderPDFPage(pdf, i, 600, true);
                    allPagePreviews.push(pagePreview);
                }
                
                // Combine all pages into a single tall image
                console.log('Combining', fullPages.length, 'pages into single image');
                fullDocument = await this.combineImages(fullPages);
            }
            
            return {
                preview: previewImage,
                fullDocument: fullDocument,
                data: fullDocument, // Add data property for compatibility
                allPagePreviews: allPagePreviews, // All individual page previews
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
        try {
            console.log('Combining', images.length, 'images');
            
            // Create temporary images to get dimensions
            const imgElements = await Promise.all(images.map((src, index) => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        console.log(`Image ${index + 1} loaded: ${img.width}x${img.height}`);
                        resolve(img);
                    };
                    img.onerror = (error) => {
                        console.error(`Failed to load image ${index + 1}:`, error);
                        // Create a placeholder for failed images
                        const placeholder = new Image();
                        placeholder.width = 800;
                        placeholder.height = 1000;
                        resolve(placeholder);
                    };
                    img.src = src;
                });
            }));
            
            // Calculate total height
            const maxWidth = Math.max(...imgElements.map(img => img.width || 800));
            const totalHeight = imgElements.reduce((sum, img) => sum + (img.height || 1000), 0);
            
            console.log(`Creating combined canvas: ${maxWidth}x${totalHeight}`);
            
            // Limit canvas size to prevent memory issues
            const MAX_HEIGHT = 10000;
            let finalHeight = totalHeight;
            let scale = 1;
            
            if (totalHeight > MAX_HEIGHT) {
                scale = MAX_HEIGHT / totalHeight;
                finalHeight = MAX_HEIGHT;
                console.log(`Canvas too tall (${totalHeight}px), scaling down by ${scale}`);
            }
            
            // Create combined canvas
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(maxWidth * scale);
            canvas.height = Math.round(finalHeight);
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw all images
            let currentY = 0;
            for (let i = 0; i < imgElements.length; i++) {
                const img = imgElements[i];
                if (img.src) { // Only draw if image loaded successfully
                    const drawWidth = Math.round(img.width * scale);
                    const drawHeight = Math.round(img.height * scale);
                    ctx.drawImage(img, 0, currentY, drawWidth, drawHeight);
                    currentY += drawHeight;
                } else {
                    console.warn(`Skipping image ${i + 1} - no source`);
                }
            }
            
            // Use JPEG for better compression of multi-page documents
            const result = canvas.toDataURL('image/jpeg', 0.85);
            console.log(`Combined image created: ${(result.length / 1024).toFixed(1)}KB`);
            
            return result;
        } catch (error) {
            console.error('Error combining images:', error);
            // Return first page on error
            return images[0] || this.createPlaceholderImage();
        }
    }
    
    /**
     * Generate SHA256 hash of document
     */
    async hashDocument(data) {
        let arrayBuffer;
        
        // Handle different input types
        if (data instanceof ArrayBuffer) {
            arrayBuffer = data;
        } else if (typeof data === 'string') {
            // Handle base64 data URL or raw base64
            let base64String = data;
            
            // Remove data URL prefix if present
            if (data.startsWith('data:')) {
                const parts = data.split(',');
                base64String = parts[1] || parts[0];
            }
            
            // Convert base64 to ArrayBuffer
            try {
                const binaryString = atob(base64String);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                arrayBuffer = bytes.buffer;
            } catch (e) {
                console.error('Failed to decode base64 for hashing:', e);
                // Return a hash of the string itself as fallback
                const encoder = new TextEncoder();
                arrayBuffer = encoder.encode(data).buffer;
            }
        } else if (data && typeof data === 'object' && data.data) {
            // Handle object with data property
            return this.hashDocument(data.data);
        } else {
            console.error('Unsupported data type for hashing:', typeof data);
            // Return a default hash
            return '0x' + '0'.repeat(64);
        }
        
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return '0x' + hashHex;
    }
    
    /**
     * Create a placeholder image when compression fails
     */
    createPlaceholderImage() {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add border
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        
        // Add text
        ctx.fillStyle = '#333';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LEGAL DOCUMENT', canvas.width / 2, 100);
        
        ctx.font = '16px Arial';
        ctx.fillText('Document Preview', canvas.width / 2, 140);
        ctx.fillText('(Full document stored on blockchain)', canvas.width / 2, 170);
        
        // Add timestamp
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666';
        const timestamp = new Date().toLocaleString();
        ctx.fillText(`Generated: ${timestamp}`, canvas.width / 2, canvas.height - 30);
        
        return canvas.toDataURL('image/jpeg', 0.8);
    }
    
    /**
     * Compress image for blockchain storage while maintaining readability
     */
    async compressImage(base64Image, maxSize = 200000) { // 200KB default for better readability
        return new Promise(async (resolve, reject) => {
            try {
                console.log('Starting compression, input type:', typeof base64Image);
                
                // Handle object input (e.g., {type: 'pdf', data: '...'} or {type: 'image-array', data: [...]})
                let inputData = base64Image;
                if (base64Image && typeof base64Image === 'object') {
                    if (base64Image.data) {
                        // If it's an array of images, use the first one or combine them
                        if (Array.isArray(base64Image.data)) {
                            console.log('Handling image array, using first image');
                            inputData = base64Image.data[0];
                        } else {
                            inputData = base64Image.data;
                        }
                    } else {
                        console.warn('Invalid object format - no data property, returning original');
                        resolve(base64Image);
                        return;
                    }
                }
                
                // Validate input
                if (!inputData || typeof inputData !== 'string') {
                    console.warn('Invalid input type, returning original:', typeof inputData);
                    resolve(base64Image);
                    return;
                }
                
                // Handle data URI strings (sometimes returned by PDF conversion)
                if (inputData.startsWith('data:application/pdf')) {
                    console.log('PDF data URI detected, cannot compress directly');
                    resolve(inputData);
                    return;
                }
                
                // Log the size of the input
                console.log('Input data length:', inputData.length, 'characters');
                
                // For EXTREMELY large base64 (>10MB), try a different approach
                if (inputData.length > 10000000) {
                    console.log('Extremely large image detected, using aggressive compression');
                    try {
                        // Extract just the base64 part if it's a data URL
                        let base64Data = inputData;
                        if (inputData.startsWith('data:')) {
                            const parts = inputData.split(',');
                            if (parts.length > 1) {
                                base64Data = parts[1];
                            }
                        }
                        
                        // Create a blob from the base64 data
                        const byteCharacters = atob(base64Data);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], {type: 'image/jpeg'});
                        
                        // Create object URL and load into image
                        const objectURL = URL.createObjectURL(blob);
                        const img = new Image();
                        
                        img.onload = () => {
                            try {
                                // Aggressively resize for huge images
                                const maxDimension = 600;
                                let width = img.width;
                                let height = img.height;
                                
                                if (width > maxDimension || height > maxDimension) {
                                    const scale = Math.min(maxDimension / width, maxDimension / height);
                                    width = Math.round(width * scale);
                                    height = Math.round(height * scale);
                                }
                                
                                const canvas = document.createElement('canvas');
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                
                                ctx.fillStyle = 'white';
                                ctx.fillRect(0, 0, width, height);
                                ctx.drawImage(img, 0, 0, width, height);
                                
                                // Use lower quality for huge files
                                const result = canvas.toDataURL('image/jpeg', 0.6);
                                
                                URL.revokeObjectURL(objectURL);
                                console.log(`Huge image compressed: ${(result.length / 1024).toFixed(1)}KB at ${width}x${height}`);
                                resolve(result);
                            } catch (e) {
                                URL.revokeObjectURL(objectURL);
                                console.error('Canvas error for huge image:', e);
                                // Return a minimal placeholder
                                resolve(this.createPlaceholderImage());
                            }
                        };
                        
                        img.onerror = () => {
                            URL.revokeObjectURL(objectURL);
                            console.warn('Failed to load huge image, creating placeholder');
                            resolve(this.createPlaceholderImage());
                        };
                        
                        img.src = objectURL;
                        return; // Exit early for huge images
                        
                    } catch (blobError) {
                        console.error('Blob creation failed:', blobError);
                        // Create a placeholder image
                        resolve(this.createPlaceholderImage());
                        return;
                    }
                }
                
                // Ensure proper data URL format for normal sized images
                let imageData = inputData;
                if (!imageData.startsWith('data:')) {
                    // Check if it's just base64 without the data URL prefix
                    if (imageData.match(/^[A-Za-z0-9+/=]+$/)) {
                        imageData = `data:image/jpeg;base64,${imageData}`;
                    } else {
                        console.warn('Invalid format, returning original');
                        resolve(base64Image);
                        return;
                    }
                }
                
                // Check if data URL is valid format
                const dataUrlRegex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
                if (!dataUrlRegex.test(imageData)) {
                    console.warn('Not an image data URL, returning original:', imageData.substring(0, 50));
                    resolve(base64Image);
                    return;
                }
                
                // Check if the base64 part is valid
                const base64Part = imageData.split(',')[1];
                if (!base64Part || base64Part.length === 0) {
                    console.warn('Empty base64 data, returning original');
                    resolve(base64Image);
                    return;
                }
                
                // Check for truncated data
                if (base64Part.includes('…') || base64Part.length < 100) {
                    console.warn('Data appears truncated, returning original');
                    resolve(base64Image);
                    return;
                }
                
                // For very large images, we might need to handle them differently
                if (imageData.length > 5000000) { // > 5MB as data URL
                    console.warn('Very large image detected, compression will be aggressive');
                }
                
                const img = new Image();
                
                // Set up error handler
                img.onerror = (error) => {
                    console.warn('Image load failed, returning original data');
                    console.log('Data URL length:', imageData.length);
                    // Return the original input on error
                    resolve(base64Image);
                };
                
                // Set up load handler
                img.onload = () => {
                    try {
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
                            width = Math.round(width * scale);
                            height = Math.round(height * scale);
                        } else if (width > maxWidth) {
                            // Downscale if too large
                            const scale = maxWidth / width;
                            width = Math.round(width * scale);
                            height = Math.round(height * scale);
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
                            width = Math.round(width * scaleFactor);
                            height = Math.round(height * scaleFactor);
                            canvas.width = width;
                            canvas.height = height;
                            ctx.imageSmoothingEnabled = true;
                            ctx.imageSmoothingQuality = 'high';
                            ctx.fillStyle = 'white';
                            ctx.fillRect(0, 0, width, height);
                            ctx.drawImage(img, 0, 0, width, height);
                            result = canvas.toDataURL('image/jpeg', 0.7);
                        }
                        
                        console.log(`Image compressed: ${(result.length / 1024).toFixed(1)}KB at ${width}x${height}`);
                        resolve(result);
                    } catch (canvasError) {
                        console.error('Canvas processing error:', canvasError);
                        resolve(base64Image);
                    }
                };
                
                // Attempt to load the image
                img.src = imageData;
                
            } catch (error) {
                console.error('Compression error:', error);
                // Always resolve with original on any error
                resolve(base64Image);
            }
        });
    }
}

// Export for use in main app
window.DocumentConverter = DocumentConverter;