/**
 * PDF Disk Handler - Handles PDF storage on disk, not in database
 * Only extracts thumbnail for display, keeps PDF file for disk storage
 */

class PDFDiskHandler {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        this.pdfJsLoaded = false;
    }

    /**
     * Process PDF for disk storage
     * Only extracts thumbnail, doesn't read entire file as base64
     */
    async processPDF(file) {
        console.log(`📁 Processing PDF for disk storage: ${file.name}`);
        
        const result = {
            file: file,  // Keep original File object
            fileName: file.name,
            fileSize: file.size,
            fileType: 'application/pdf',
            
            // Thumbnail will be extracted (small, OK for database)
            thumbnail: null,
            
            // NO base64 data - file will be uploaded to disk
            data: null,
            
            // Flag for disk storage
            requiresDiskStorage: true
        };
        
        // Extract just first page as thumbnail
        try {
            result.thumbnail = await this.extractThumbnail(file);
            console.log('✅ Extracted thumbnail for preview');
        } catch (error) {
            console.warn('Could not extract thumbnail:', error);
            result.thumbnail = this.createPlaceholderThumbnail(file.name, file.size);
        }
        
        return result;
    }

    /**
     * Extract only first page as thumbnail (small image OK for database)
     */
    async extractThumbnail(file) {
        // Load PDF.js if needed
        await this.ensurePdfJs();
        
        // Read file to extract first page only
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        // Render ONLY first page at low resolution for thumbnail
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 }); // Low res for thumbnail
        
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
        
        // Return as compressed JPEG (small size)
        return canvas.toDataURL('image/jpeg', 0.6);
    }

    /**
     * Upload PDF directly to disk storage
     */
    async uploadToDisk(file, noticeId, metadata) {
        console.log(`📤 Uploading PDF to disk: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        
        const formData = new FormData();
        formData.append('document', file);
        formData.append('caseNumber', metadata.caseNumber || '');
        formData.append('serverAddress', metadata.serverAddress || '');
        formData.append('documentType', 'unencrypted');
        
        try {
            const response = await fetch(`${this.backend}/api/documents/disk/${noticeId}`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('✅ PDF uploaded to disk:', result);
            
            return {
                success: true,
                filePath: result.filePath,
                fileId: result.fileId,
                viewUrl: `${this.backend}${result.filePath}`
            };
            
        } catch (error) {
            console.error('Error uploading to disk:', error);
            throw error;
        }
    }

    /**
     * Upload thumbnail separately (small, OK for database)
     */
    async uploadThumbnail(thumbnail, noticeId) {
        if (!thumbnail) return null;
        
        try {
            // Convert data URL to blob
            const response = await fetch(thumbnail);
            const blob = await response.blob();
            
            const formData = new FormData();
            formData.append('thumbnail', blob, 'thumbnail.jpg');
            
            const res = await fetch(`${this.backend}/api/documents/thumbnail/${noticeId}`, {
                method: 'POST',
                body: formData
            });
            
            if (res.ok) {
                console.log('✅ Thumbnail stored in database');
                return true;
            }
        } catch (error) {
            console.error('Error uploading thumbnail:', error);
        }
        return false;
    }

    /**
     * Get URL to view document from disk
     */
    getDocumentViewUrl(noticeId) {
        return `${this.backend}/api/documents/case/${noticeId}`;
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
        ctx.font = `bold ${Math.floor(width * 0.08)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('LEGAL NOTICE', width / 2, height * 0.08);
        
        // Timestamp
        ctx.font = `${Math.floor(width * 0.04)}px Arial`;
        ctx.fillText(new Date().toLocaleDateString(), width / 2, height * 0.12);
    }

    /**
     * Create placeholder thumbnail
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
        ctx.fillText(`${(fileSize / 1024 / 1024).toFixed(2)} MB`, 200, 280);
        
        return canvas.toDataURL('image/jpeg', 0.6);
    }

    /**
     * Ensure PDF.js is loaded
     */
    async ensurePdfJs() {
        if (this.pdfJsLoaded && typeof pdfjsLib !== 'undefined') {
            return;
        }
        
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
window.pdfDiskHandler = new PDFDiskHandler();

console.log('✅ PDF Disk Handler loaded - PDFs will be stored on disk, not in database');