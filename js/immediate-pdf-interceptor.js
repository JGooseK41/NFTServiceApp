/**
 * Immediate PDF Interceptor - Patches DocumentConverter BEFORE it's used
 * This MUST load right after documentConverter.js
 */

console.log('🚀 IMMEDIATE PDF Interceptor loading...');

// Store the original DocumentConverter class immediately
const OriginalDocumentConverter = window.DocumentConverter;

// Replace it with our patched version immediately
window.DocumentConverter = function() {
    console.log('⚡⚡ Creating INTERCEPTED DocumentConverter - will use UltraFast handler');
    
    // Create original instance
    const instance = new OriginalDocumentConverter();
    
    // Store original methods
    const originalInit = instance.init.bind(instance);
    const originalConvertDocument = instance.convertDocument.bind(instance);
    const originalConvertPDF = instance.convertPDF.bind(instance);
    
    // Override init
    instance.init = async function() {
        console.log('⚡ DocumentConverter init (intercepted)');
        await originalInit();
        return true;
    };
    
    // Override convertDocument to use Ultra/Fast handler for PDFs
    instance.convertDocument = async function(file) {
        console.log('⚡⚡ convertDocument INTERCEPTED:', file.name, file.type);
        
        // Check if it's a PDF
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            console.log('⚡⚡ PDF detected - using ULTRA FAST handler');
            
            // Try UltraFastPDFHandler first (if available)
            if (window.UltraFastPDFHandler) {
                try {
                    const startTime = Date.now();
                    const result = await window.UltraFastPDFHandler.processPDF(file);
                    const elapsed = Date.now() - startTime;
                    console.log(`⚡⚡ UltraFastPDFHandler completed in ${elapsed}ms`);
                    return result;
                } catch (error) {
                    console.error('UltraFastPDFHandler failed:', error);
                }
            }
            
            // Try FastPDFHandler as fallback
            if (window.FastPDFHandler) {
                try {
                    const startTime = Date.now();
                    const result = await window.FastPDFHandler.processPDF(file);
                    const elapsed = Date.now() - startTime;
                    console.log(`⚡ FastPDFHandler completed in ${elapsed}ms`);
                    return result;
                } catch (error) {
                    console.error('FastPDFHandler failed:', error);
                }
            }
            
            // If both fast handlers aren't available, create a simple fallback
            console.log('⚠️ Fast handlers not available, using simple fallback');
            
            // Simple instant fallback - just store the PDF
            const reader = new FileReader();
            const base64 = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            
            // Create simple preview
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 800;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 600, 800);
            ctx.fillStyle = '#dc2626';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('PDF DOCUMENT', 300, 400);
            ctx.fillText(file.name, 300, 450);
            const preview = canvas.toDataURL('image/jpeg', 0.8);
            
            return {
                data: base64,
                fullDocument: base64,
                preview: preview,
                thumbnail: preview,
                pageCount: 1,
                fileName: file.name,
                fileSize: file.size,
                fileType: 'application/pdf',
                allPagePreviews: [preview]
            };
        }
        
        // Non-PDF files use original method
        console.log('Non-PDF file, using original converter');
        return await originalConvertDocument(file);
    };
    
    // Override convertPDF to use Ultra/Fast handler
    instance.convertPDF = async function(file) {
        console.log('⚡⚡ convertPDF INTERCEPTED:', file.name);
        
        // NEVER use the original slow convertPDF for PDFs
        // Always use fast handlers or simple fallback
        
        // Try UltraFastPDFHandler first
        if (window.UltraFastPDFHandler) {
            try {
                const startTime = Date.now();
                const result = await window.UltraFastPDFHandler.processPDF(file);
                const elapsed = Date.now() - startTime;
                console.log(`⚡⚡ UltraFastPDFHandler completed convertPDF in ${elapsed}ms`);
                return result;
            } catch (error) {
                console.error('UltraFastPDFHandler failed in convertPDF:', error);
            }
        }
        
        // Try FastPDFHandler
        if (window.FastPDFHandler) {
            try {
                const startTime = Date.now();
                const result = await window.FastPDFHandler.processPDF(file);
                const elapsed = Date.now() - startTime;
                console.log(`⚡ FastPDFHandler completed convertPDF in ${elapsed}ms`);
                return result;
            } catch (error) {
                console.error('FastPDFHandler failed in convertPDF:', error);
            }
        }
        
        // Simple instant fallback
        console.log('⚠️ Using instant fallback for PDF');
        const reader = new FileReader();
        const base64 = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        
        return {
            data: base64,
            fullDocument: base64,
            preview: base64,
            thumbnail: base64,
            pageCount: 1,
            fileName: file.name,
            fileSize: file.size,
            fileType: 'application/pdf',
            allPagePreviews: []
        };
    };
    
    console.log('✅ DocumentConverter instance patched');
    return instance;
};

console.log('✅ IMMEDIATE PDF Interceptor installed - DocumentConverter is now patched');
console.log('All new DocumentConverter instances will use Ultra Fast PDF processing');