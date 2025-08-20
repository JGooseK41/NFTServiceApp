/**
 * Ultra Fast PDF Handler - Instant PDF handling with zero rendering
 * Just store the PDF and create a simple preview - no slow operations
 */

window.UltraFastPDFHandler = {
    
    /**
     * Process PDF instantly - no rendering, just storage
     */
    async processPDF(file) {
        console.log('⚡⚡ Ultra Fast PDF processing:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
        const startTime = Date.now();
        
        try {
            // Convert to base64 instantly
            const base64 = await this.fileToBase64(file);
            
            // Create a simple preview without rendering
            const preview = this.createInstantPreview(file.name, file.size);
            
            // Try to get page count quickly (with very short timeout)
            let pageCount = 1;
            try {
                pageCount = await this.getQuickPageCount(file);
            } catch (e) {
                console.log('⚡ Could not get page count, using default');
            }
            
            const result = {
                // Store the full PDF as-is
                data: base64,
                fullDocument: base64,
                
                // Simple preview
                preview: preview,
                thumbnail: preview,
                
                // Metadata
                pageCount: pageCount,
                fileName: file.name,
                fileSize: file.size,
                fileType: 'application/pdf',
                
                // For compatibility
                allPagePreviews: [preview],
                documentHash: await this.quickHash(file)
            };
            
            const elapsed = Date.now() - startTime;
            console.log(`⚡⚡ Ultra Fast processing completed in ${elapsed}ms`);
            
            return result;
            
        } catch (error) {
            console.error('Ultra Fast PDF error:', error);
            
            // Even simpler fallback
            const base64 = await this.fileToBase64(file);
            return {
                data: base64,
                fullDocument: base64,
                preview: this.createInstantPreview(file.name, file.size),
                thumbnail: this.createInstantPreview(file.name, file.size),
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
     * Get page count with ultra-short timeout
     */
    async getQuickPageCount(file) {
        return new Promise(async (resolve, reject) => {
            // Ultra quick timeout - 500ms max
            const timeout = setTimeout(() => {
                reject(new Error('Timeout'));
            }, 500);
            
            try {
                // Only load if PDF.js is already available
                if (typeof pdfjsLib === 'undefined') {
                    clearTimeout(timeout);
                    reject(new Error('PDF.js not loaded'));
                    return;
                }
                
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({
                    data: arrayBuffer,
                    disableAutoFetch: true,
                    disableStream: true,
                    disableFontFace: true,
                    disableRange: true,
                    isEvalSupported: false
                });
                
                // Quick destroy on timeout
                setTimeout(() => {
                    if (loadingTask && loadingTask.destroy) {
                        loadingTask.destroy();
                    }
                }, 450);
                
                const pdf = await loadingTask.promise;
                const count = pdf.numPages;
                pdf.destroy(); // Clean up immediately
                
                clearTimeout(timeout);
                resolve(count);
                
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    },
    
    /**
     * Create instant preview without rendering
     */
    createInstantPreview(fileName, fileSize) {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 600, 800);
        
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, 800);
        gradient.addColorStop(0, '#f8f9fa');
        gradient.addColorStop(1, '#e9ecef');
        ctx.fillStyle = gradient;
        ctx.fillRect(20, 20, 560, 760);
        
        // Border
        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, 560, 760);
        
        // Header bar
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(20, 20, 560, 80);
        
        // PDF icon in header
        ctx.fillStyle = 'white';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('📄 PDF DOCUMENT', 300, 70);
        
        // File info box
        ctx.fillStyle = 'white';
        ctx.fillRect(50, 150, 500, 120);
        ctx.strokeStyle = '#ced4da';
        ctx.strokeRect(50, 150, 500, 120);
        
        // File name
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        const shortName = fileName.length > 35 ? fileName.substr(0, 32) + '...' : fileName;
        ctx.fillText(shortName, 300, 190);
        
        // File size
        ctx.fillStyle = '#6c757d';
        ctx.font = '16px Arial';
        const sizeMB = (fileSize / 1024 / 1024).toFixed(2);
        ctx.fillText(`Size: ${sizeMB} MB`, 300, 220);
        
        // Status
        ctx.fillStyle = '#28a745';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('✅ Ready for Upload', 300, 250);
        
        // Legal Notice stamp
        ctx.save();
        ctx.translate(300, 400);
        ctx.rotate(-0.1);
        ctx.fillStyle = 'rgba(220, 38, 38, 0.1)';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LEGAL NOTICE', 0, 0);
        ctx.restore();
        
        // Footer
        ctx.fillStyle = '#6c757d';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        const timestamp = new Date().toLocaleString();
        ctx.fillText(`Generated: ${timestamp}`, 300, 750);
        
        return canvas.toDataURL('image/jpeg', 0.85);
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
     * Quick hash - just use timestamp and size
     */
    async quickHash(file) {
        // For speed, just use file properties
        return `hash_${file.size}_${file.lastModified}_${Date.now()}`;
    }
};

// Aggressively override DocumentConverter
console.log('⚡⚡ Installing Ultra Fast PDF Handler...');

// Override immediately
if (window.DocumentConverter) {
    const OriginalConverter = window.DocumentConverter;
    window.DocumentConverter = function() {
        const instance = new OriginalConverter();
        
        // Override both methods
        instance.convertPDF = async function(file) {
            console.log('⚡⚡ Using UltraFastPDFHandler for:', file.name);
            return await window.UltraFastPDFHandler.processPDF(file);
        };
        
        const originalConvertDocument = instance.convertDocument.bind(instance);
        instance.convertDocument = async function(file) {
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                console.log('⚡⚡ Using UltraFastPDFHandler for document:', file.name);
                return await window.UltraFastPDFHandler.processPDF(file);
            }
            return await originalConvertDocument(file);
        };
        
        return instance;
    };
}

// Also patch any existing instance
if (window.documentConverter) {
    window.documentConverter.convertPDF = async function(file) {
        console.log('⚡⚡ Patched convertPDF using UltraFast');
        return await window.UltraFastPDFHandler.processPDF(file);
    };
    
    const original = window.documentConverter.convertDocument;
    if (original) {
        window.documentConverter.convertDocument = async function(file) {
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                console.log('⚡⚡ Patched convertDocument using UltraFast');
                return await window.UltraFastPDFHandler.processPDF(file);
            }
            return await original.call(this, file);
        };
    }
}

console.log('⚡⚡ Ultra Fast PDF Handler ready - PDFs will process instantly!');