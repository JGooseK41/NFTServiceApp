/**
 * Intercept PDF Processing - Force use of FastPDFHandler
 * This ensures ALL PDF processing goes through the fast handler
 */

// Wait for DOM and other scripts to load
function interceptPDFProcessing() {
    console.log('🚀 Installing PDF processing interceptor...');
    
    // Override DocumentConverter constructor
    const OriginalDocumentConverter = window.DocumentConverter;
    
    window.DocumentConverter = function() {
        console.log('⚡ Creating intercepted DocumentConverter');
        
        // Create original instance
        const instance = new OriginalDocumentConverter();
        
        // Store original methods
        const originalInit = instance.init.bind(instance);
        const originalConvertDocument = instance.convertDocument.bind(instance);
        const originalConvertPDF = instance.convertPDF.bind(instance);
        
        // Override init to ensure our overrides stay
        instance.init = async function() {
            console.log('⚡ DocumentConverter init intercepted');
            await originalInit();
            return true;
        };
        
        // Override convertDocument to use FastPDFHandler for PDFs
        instance.convertDocument = async function(file) {
            console.log('⚡ convertDocument intercepted:', file.name, file.type);
            
            // Check if it's a PDF
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                console.log('⚡ PDF detected - using Ultra Fast handler');
                
                // Try UltraFastPDFHandler first
                if (window.UltraFastPDFHandler) {
                    try {
                        const result = await window.UltraFastPDFHandler.processPDF(file);
                        console.log('⚡⚡ UltraFastPDFHandler completed:', file.name);
                        return result;
                    } catch (error) {
                        console.error('UltraFastPDFHandler failed:', error);
                    }
                }
                
                // Fallback to FastPDFHandler
                if (window.FastPDFHandler) {
                    try {
                        const result = await window.FastPDFHandler.processPDF(file);
                        console.log('✅ FastPDFHandler completed:', file.name);
                        return result;
                    } catch (error) {
                        console.error('FastPDFHandler failed:', error);
                    }
                }
                
                // Final fallback to original
                console.warn('Both fast handlers failed, using original');
                return await originalConvertDocument(file);
            }
            
            // Non-PDF files use original method
            return await originalConvertDocument(file);
        };
        
        // Override convertPDF to use Ultra/FastPDFHandler
        instance.convertPDF = async function(file) {
            console.log('⚡ convertPDF intercepted:', file.name);
            
            // Try UltraFastPDFHandler first
            if (window.UltraFastPDFHandler) {
                try {
                    const result = await window.UltraFastPDFHandler.processPDF(file);
                    console.log('⚡⚡ UltraFastPDFHandler completed (via convertPDF):', file.name);
                    return result;
                } catch (error) {
                    console.error('UltraFastPDFHandler failed:', error);
                }
            }
            
            // Fallback to FastPDFHandler
            if (window.FastPDFHandler) {
                try {
                    const result = await window.FastPDFHandler.processPDF(file);
                    console.log('✅ FastPDFHandler completed (via convertPDF):', file.name);
                    return result;
                } catch (error) {
                    console.error('FastPDFHandler failed:', error);
                }
            }
            
            // Final fallback to original
            console.warn('Both fast handlers failed in convertPDF, using original');
            return await originalConvertPDF(file);
        };
        
        return instance;
    };
    
    // If documentConverter already exists, replace its methods
    if (window.documentConverter) {
        console.log('⚡ Patching existing documentConverter instance');
        
        const originalConvertDocument = window.documentConverter.convertDocument.bind(window.documentConverter);
        const originalConvertPDF = window.documentConverter.convertPDF.bind(window.documentConverter);
        
        window.documentConverter.convertDocument = async function(file) {
            console.log('⚡ Existing convertDocument intercepted:', file.name, file.type);
            
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                console.log('⚡ PDF detected - redirecting to Ultra/Fast handler');
                
                // Try UltraFastPDFHandler first
                if (window.UltraFastPDFHandler) {
                    try {
                        const result = await window.UltraFastPDFHandler.processPDF(file);
                        console.log('⚡⚡ UltraFastPDFHandler completed for existing instance');
                        return result;
                    } catch (error) {
                        console.error('UltraFastPDFHandler error:', error);
                    }
                }
                
                // Fallback to FastPDFHandler
                if (window.FastPDFHandler) {
                    try {
                        const result = await window.FastPDFHandler.processPDF(file);
                        console.log('✅ FastPDFHandler completed for existing instance');
                        return result;
                    } catch (error) {
                        console.error('FastPDFHandler error:', error);
                    }
                }
                
                // Final fallback
                console.warn('Both handlers failed for existing instance');
                return await originalConvertDocument(file);
            }
            
            return await originalConvertDocument(file);
        };
        
        window.documentConverter.convertPDF = async function(file) {
            console.log('⚡ Existing convertPDF intercepted:', file.name);
            
            // Try UltraFastPDFHandler first
            if (window.UltraFastPDFHandler) {
                try {
                    const result = await window.UltraFastPDFHandler.processPDF(file);
                    console.log('⚡⚡ UltraFastPDFHandler completed (existing convertPDF)');
                    return result;
                } catch (error) {
                    console.error('UltraFastPDFHandler error:', error);
                }
            }
            
            // Fallback to FastPDFHandler
            if (window.FastPDFHandler) {
                try {
                    const result = await window.FastPDFHandler.processPDF(file);
                    console.log('✅ FastPDFHandler completed (existing convertPDF)');
                    return result;
                } catch (error) {
                    console.error('FastPDFHandler error:', error);
                }
            }
            
            // Final fallback
            console.warn('Both handlers failed (existing convertPDF)');
            return await originalConvertPDF(file);
        };
    }
    
    console.log('✅ PDF processing interceptor installed');
}

// Install interceptor as soon as possible
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', interceptPDFProcessing);
} else {
    // DOM already loaded
    interceptPDFProcessing();
}

// Also try to intercept early
setTimeout(interceptPDFProcessing, 100);
setTimeout(interceptPDFProcessing, 500);
setTimeout(interceptPDFProcessing, 1000);

console.log('📦 PDF Processing Interceptor loaded - will force FastPDFHandler usage');