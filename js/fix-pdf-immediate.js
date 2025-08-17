/**
 * IMMEDIATE PDF Processing Fix
 * This MUST run before any PDF processing attempts
 */

(function() {
    console.log('🚨 IMMEDIATE PDF FIX LOADING...');
    
    // Store original functions IMMEDIATELY
    const originalConvertDocument = window.DocumentConverter?.prototype?.convertDocument;
    const originalConvertPDF = window.DocumentConverter?.prototype?.convertPDF;
    
    // Override PDF.js loading IMMEDIATELY if it exists
    if (typeof pdfjsLib !== 'undefined') {
        const originalGetDocument = pdfjsLib.getDocument;
        
        pdfjsLib.getDocument = function(src) {
            console.log('🔍 Intercepting PDF.js getDocument call');
            
            // Wrap the original call with timeout protection
            const loadingTask = originalGetDocument.call(this, src);
            
            // Add timeout to the promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    console.error('⏱️ PDF.js timeout - aborting load');
                    if (loadingTask && loadingTask.destroy) {
                        loadingTask.destroy();
                    }
                    reject(new Error('PDF loading timeout after 5 seconds'));
                }, 5000);
            });
            
            // Race between actual loading and timeout
            const originalPromise = loadingTask.promise;
            loadingTask.promise = Promise.race([originalPromise, timeoutPromise])
                .catch(error => {
                    console.error('PDF.js loading failed:', error);
                    throw error;
                });
            
            return loadingTask;
        };
        
        console.log('✅ PDF.js getDocument wrapped with timeout protection');
    }
    
    // FORCE override the DocumentConverter class
    if (window.DocumentConverter) {
        const OriginalDocumentConverter = window.DocumentConverter;
        
        // Create new class that extends original
        class FixedDocumentConverter extends OriginalDocumentConverter {
            async convertPDF(file) {
                console.log('🔧 Using FIXED convertPDF method');
                console.log('Processing:', file.name, 'Size:', file.size);
                
                try {
                    // First try with timeout protection
                    const arrayBuffer = await file.arrayBuffer();
                    console.log('ArrayBuffer ready:', arrayBuffer.byteLength, 'bytes');
                    
                    if (!this.pdfjs) {
                        console.warn('PDF.js not available, using immediate fallback');
                        return this.immediateFallback(file);
                    }
                    
                    // Try to load with strict timeout
                    const loadPromise = new Promise(async (resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('PDF processing timeout'));
                        }, 5000);
                        
                        try {
                            const loadingTask = this.pdfjs.getDocument({
                                data: arrayBuffer,
                                disableAutoFetch: true,
                                disableStream: true,
                                disableFontFace: false
                            });
                            
                            const pdf = await loadingTask.promise;
                            clearTimeout(timeout);
                            resolve(pdf);
                        } catch (error) {
                            clearTimeout(timeout);
                            reject(error);
                        }
                    });
                    
                    const pdf = await loadPromise;
                    console.log('✅ PDF loaded:', pdf.numPages, 'pages');
                    
                    // Quick preview generation
                    const preview = await this.quickPreview(pdf, file.name);
                    
                    // Clean up
                    pdf.destroy();
                    
                    // Return with original PDF data
                    const base64 = await this.fileToBase64(file);
                    
                    return {
                        preview: preview,
                        fullDocument: base64,
                        data: base64,
                        pageCount: pdf.numPages,
                        fileType: 'pdf',
                        originalPDF: base64
                    };
                    
                } catch (error) {
                    console.error('PDF processing failed:', error.message);
                    console.log('📄 Using immediate fallback');
                    return this.immediateFallback(file);
                }
            }
            
            async immediateFallback(file) {
                console.log('🚀 Immediate fallback for:', file.name);
                
                const base64 = await this.fileToBase64(file);
                const preview = await this.createQuickPreview(file.name);
                
                return {
                    preview: preview,
                    fullDocument: base64,
                    data: base64,
                    allPagePreviews: [preview],
                    pageCount: 1,
                    fileType: 'pdf',
                    originalPDF: base64,
                    isFallback: true
                };
            }
            
            async fileToBase64(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }
            
            async quickPreview(pdf, fileName) {
                try {
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({ scale: 0.5 });
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    
                    const context = canvas.getContext('2d');
                    context.fillStyle = 'white';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    
                    // Quick render with timeout
                    const renderTask = page.render({
                        canvasContext: context,
                        viewport: viewport
                    });
                    
                    await Promise.race([
                        renderTask.promise,
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Render timeout')), 2000)
                        )
                    ]);
                    
                    return canvas.toDataURL('image/jpeg', 0.7);
                    
                } catch (error) {
                    console.error('Quick preview failed:', error);
                    return this.createQuickPreview(fileName);
                }
            }
            
            async createQuickPreview(fileName) {
                const canvas = document.createElement('canvas');
                canvas.width = 400;
                canvas.height = 600;
                const ctx = canvas.getContext('2d');
                
                // White background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, 400, 600);
                
                // Border
                ctx.strokeStyle = '#e5e7eb';
                ctx.lineWidth = 2;
                ctx.strokeRect(1, 1, 398, 598);
                
                // PDF icon
                ctx.fillStyle = '#dc2626';
                ctx.font = '64px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('📄', 200, 200);
                
                // File name
                ctx.fillStyle = '#111827';
                ctx.font = '20px Arial';
                const shortName = fileName.length > 30 ? 
                    fileName.substring(0, 27) + '...' : fileName;
                ctx.fillText(shortName, 200, 280);
                
                // Status
                ctx.fillStyle = '#059669';
                ctx.font = '16px Arial';
                ctx.fillText('✓ Document Ready', 200, 320);
                
                return canvas.toDataURL('image/jpeg', 0.8);
            }
        }
        
        // REPLACE the global DocumentConverter
        window.DocumentConverter = FixedDocumentConverter;
        
        // Also fix any existing instances
        if (window.documentConverter) {
            console.log('🔄 Replacing existing documentConverter instance');
            window.documentConverter = new FixedDocumentConverter();
            if (window.documentConverter.init) {
                window.documentConverter.init();
            }
        }
        
        console.log('✅ DocumentConverter class completely replaced');
    }
    
    // ALSO override handleDocumentUpload to ensure it works
    const originalHandleUpload = window.handleDocumentUpload;
    
    window.handleDocumentUpload = async function(event) {
        console.log('🎯 FIXED document upload handler');
        
        const files = Array.from(event.target.files);
        if (!files || files.length === 0) return;
        
        // Initialize list if needed
        if (!window.uploadedDocumentsList) {
            window.uploadedDocumentsList = [];
        }
        
        // Show status
        const statusDiv = document.getElementById('compressionStatus');
        if (statusDiv) statusDiv.style.display = 'block';
        
        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            console.log(`Processing ${i + 1}/${files.length}: ${file.name}`);
            
            try {
                let documentData;
                
                // Check if PDF
                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                    console.log('PDF detected, using fixed converter');
                    
                    // Ensure converter exists
                    if (!window.documentConverter) {
                        window.documentConverter = new window.DocumentConverter();
                        await window.documentConverter.init();
                    }
                    
                    // Convert with timeout protection
                    try {
                        const converted = await Promise.race([
                            window.documentConverter.convertPDF(file),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Conversion timeout')), 10000)
                            )
                        ]);
                        
                        documentData = {
                            id: Date.now() + '_' + i,
                            data: converted.data || converted.fullDocument,
                            fileName: file.name,
                            fileType: file.type,
                            fileSize: file.size,
                            preview: converted.preview,
                            pageCount: converted.pageCount || 1,
                            order: window.uploadedDocumentsList.length
                        };
                        
                    } catch (conversionError) {
                        console.error('Conversion failed, using direct upload:', conversionError);
                        
                        // Fallback to direct base64
                        const reader = new FileReader();
                        const base64 = await new Promise((resolve, reject) => {
                            reader.onload = e => resolve(e.target.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        });
                        
                        documentData = {
                            id: Date.now() + '_' + i,
                            data: base64,
                            fileName: file.name,
                            fileType: file.type,
                            fileSize: file.size,
                            preview: base64,
                            pageCount: 1,
                            order: window.uploadedDocumentsList.length,
                            isFallback: true
                        };
                    }
                    
                } else {
                    // For images, just read directly
                    const reader = new FileReader();
                    const base64 = await new Promise((resolve, reject) => {
                        reader.onload = e => resolve(e.target.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    
                    documentData = {
                        id: Date.now() + '_' + i,
                        data: base64,
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        preview: base64,
                        pageCount: 1,
                        order: window.uploadedDocumentsList.length
                    };
                }
                
                // Add to list
                window.uploadedDocumentsList.push(documentData);
                console.log(`✅ Added ${file.name} to documents list`);
                
            } catch (error) {
                console.error(`Failed to process ${file.name}:`, error);
                
                // Emergency fallback - just store the file
                const reader = new FileReader();
                const base64 = await new Promise((resolve) => {
                    reader.onload = e => resolve(e.target.result);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(file);
                });
                
                if (base64) {
                    window.uploadedDocumentsList.push({
                        id: Date.now() + '_' + i,
                        data: base64,
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        preview: base64,
                        pageCount: 1,
                        order: window.uploadedDocumentsList.length,
                        isEmergencyFallback: true
                    });
                    console.log(`⚠️ Emergency fallback for ${file.name}`);
                }
            }
        }
        
        // Update display
        if (window.displayUploadedDocuments) {
            window.displayUploadedDocuments();
        }
        
        // Hide status
        if (statusDiv) {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 1000);
        }
        
        // Show success
        if (window.uiManager?.showNotification) {
            window.uiManager.showNotification('success', 
                `${window.uploadedDocumentsList.length} document(s) ready`);
        }
        
        // Clear input
        event.target.value = '';
    };
    
    console.log('🚨 IMMEDIATE PDF FIX COMPLETE');
    console.log('   - PDF.js wrapped with 5 second timeout');
    console.log('   - DocumentConverter replaced with fixed version');  
    console.log('   - Multiple fallback layers implemented');
    console.log('   - Emergency fallback ensures documents always upload');
    
})();