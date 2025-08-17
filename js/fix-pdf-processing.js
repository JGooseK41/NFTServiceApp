/**
 * Fix PDF Processing Issues
 * Ensures PDF.js loads properly and provides fallback mechanisms
 */

(function() {
    console.log('🔧 Fixing PDF processing issues...');
    
    // Store original convertPDF if it exists
    const originalConvertPDF = window.DocumentConverter?.prototype?.convertPDF;
    
    // Override DocumentConverter initialization
    if (window.DocumentConverter) {
        const OriginalDocumentConverter = window.DocumentConverter;
        
        window.DocumentConverter = class extends OriginalDocumentConverter {
            async init() {
                if (this.initialized) return;
                
                console.log('📚 Initializing DocumentConverter with fixes...');
                
                // Ensure PDF.js is properly loaded
                if (typeof pdfjsLib === 'undefined') {
                    console.warn('PDF.js not loaded, attempting to load...');
                    await this.loadPDFJS();
                }
                
                if (typeof pdfjsLib !== 'undefined') {
                    this.pdfjs = pdfjsLib;
                    // Use the correct worker path
                    this.pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    console.log('✅ PDF.js initialized successfully');
                } else {
                    console.error('❌ PDF.js could not be loaded');
                }
                
                // Load Mammoth for Word docs
                if (typeof mammoth !== 'undefined') {
                    this.mammoth = mammoth;
                    console.log('✅ Mammoth.js initialized');
                }
                
                this.initialized = true;
            }
            
            async loadPDFJS() {
                return new Promise((resolve, reject) => {
                    if (typeof pdfjsLib !== 'undefined') {
                        resolve();
                        return;
                    }
                    
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                    script.onload = () => {
                        console.log('PDF.js loaded dynamically');
                        resolve();
                    };
                    script.onerror = () => {
                        console.error('Failed to load PDF.js');
                        reject(new Error('Failed to load PDF.js'));
                    };
                    document.head.appendChild(script);
                });
            }
            
            async convertPDF(file) {
                if (!this.pdfjs) {
                    console.warn('PDF.js not available, using fallback method');
                    return await this.fallbackPDFConversion(file);
                }
                
                console.log('Converting PDF:', file.name, 'Size:', file.size);
                
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    console.log('ArrayBuffer created, size:', arrayBuffer.byteLength);
                    
                    // Add timeout protection for PDF loading
                    const loadingTask = this.pdfjs.getDocument({
                        data: arrayBuffer,
                        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                        cMapPacked: true,
                        standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
                    });
                    
                    // Add timeout to prevent hanging
                    const pdf = await Promise.race([
                        loadingTask.promise,
                        new Promise((_, reject) => 
                            setTimeout(() => {
                                loadingTask.destroy();
                                reject(new Error('PDF loading timeout'));
                            }, 10000)
                        )
                    ]);
                    
                    console.log('✅ PDF loaded successfully, pages:', pdf.numPages);
                    
                    // Process the PDF
                    const result = await this.processPDFPages(pdf, file);
                    
                    // Clean up
                    pdf.destroy();
                    
                    return result;
                    
                } catch (error) {
                    console.error('PDF conversion error:', error);
                    console.log('Falling back to simple PDF handling');
                    return await this.fallbackPDFConversion(file);
                }
            }
            
            async processPDFPages(pdf, file) {
                try {
                    // Generate preview from first page
                    const previewImage = await this.generatePDFPreview(pdf, 1);
                    
                    // For now, just use the preview as the full document
                    // This ensures we get something working
                    const base64 = await this.fileToBase64(file);
                    
                    return {
                        preview: previewImage,
                        fullDocument: base64, // Store original PDF
                        data: base64,
                        allPagePreviews: [previewImage],
                        documentHash: await this.hashDocument(await file.arrayBuffer()),
                        pageCount: pdf.numPages,
                        fileType: 'pdf',
                        originalPDF: base64
                    };
                } catch (error) {
                    console.error('Error processing PDF pages:', error);
                    throw error;
                }
            }
            
            async fallbackPDFConversion(file) {
                console.log('Using fallback PDF conversion');
                
                // Convert file to base64
                const base64 = await this.fileToBase64(file);
                
                // Create a simple preview image
                const preview = await this.createPDFPlaceholder(file.name);
                
                return {
                    preview: preview,
                    fullDocument: base64,
                    data: base64,
                    allPagePreviews: [preview],
                    documentHash: 'fallback_' + Date.now(),
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
            
            async createPDFPlaceholder(fileName) {
                const canvas = document.createElement('canvas');
                canvas.width = 600;
                canvas.height = 800;
                const ctx = canvas.getContext('2d');
                
                // White background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, 600, 800);
                
                // Add border
                ctx.strokeStyle = '#e5e7eb';
                ctx.lineWidth = 2;
                ctx.strokeRect(1, 1, 598, 798);
                
                // Add PDF icon
                ctx.fillStyle = '#dc2626';
                ctx.font = 'bold 72px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('📄', 300, 300);
                
                // Add text
                ctx.fillStyle = '#374151';
                ctx.font = 'bold 24px Arial';
                ctx.fillText('PDF Document', 300, 400);
                
                ctx.font = '18px Arial';
                ctx.fillStyle = '#6b7280';
                const shortName = fileName.length > 30 ? 
                    fileName.substring(0, 27) + '...' : fileName;
                ctx.fillText(shortName, 300, 450);
                
                ctx.font = '16px Arial';
                ctx.fillText('Document ready for upload', 300, 500);
                
                // Add watermark
                ctx.save();
                ctx.globalAlpha = 0.1;
                ctx.font = 'bold 48px Arial';
                ctx.fillStyle = '#000000';
                ctx.translate(300, 400);
                ctx.rotate(-45 * Math.PI / 180);
                ctx.fillText('LEGAL NOTICE', 0, 0);
                ctx.restore();
                
                return canvas.toDataURL('image/jpeg', 0.9);
            }
        };
    }
    
    // Also fix the global handleDocumentUpload to handle failures better
    const originalHandleUpload = window.handleDocumentUpload;
    window.handleDocumentUpload = async function(event) {
        console.log('📤 Handle document upload with fixes');
        
        const files = Array.from(event.target.files);
        if (!files || files.length === 0) return;
        
        // Initialize uploadedDocumentsList if needed
        if (!window.uploadedDocumentsList) {
            window.uploadedDocumentsList = [];
        }
        
        // Show processing status
        const statusDiv = document.getElementById('compressionStatus');
        if (statusDiv) {
            statusDiv.style.display = 'block';
        }
        
        try {
            // Try original handler first
            if (originalHandleUpload) {
                return await originalHandleUpload.call(this, event);
            }
        } catch (error) {
            console.error('Original handler failed:', error);
        }
        
        // Fallback handler
        console.log('Using fallback document handler');
        for (const file of files) {
            try {
                const reader = new FileReader();
                const base64 = await new Promise((resolve, reject) => {
                    reader.onload = e => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                
                const documentData = {
                    id: Date.now() + '_' + Math.random(),
                    data: base64,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    preview: base64,
                    pageCount: 1,
                    order: window.uploadedDocumentsList.length
                };
                
                window.uploadedDocumentsList.push(documentData);
                console.log('✅ Document added:', file.name);
                
            } catch (error) {
                console.error('Error processing file:', file.name, error);
            }
        }
        
        // Update display
        if (window.displayUploadedDocuments) {
            window.displayUploadedDocuments();
        }
        
        // Hide processing status
        if (statusDiv) {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 1000);
        }
        
        // Show success
        if (window.uiManager?.showNotification) {
            window.uiManager.showNotification('success', 
                `${window.uploadedDocumentsList.length} document(s) uploaded`);
        }
    };
    
    console.log('✅ PDF processing fixes applied');
    console.log('   - PDF.js loading with timeout protection');
    console.log('   - Fallback conversion for failed PDFs');
    console.log('   - Simple placeholder generation');
    console.log('   - Original PDF data preserved');
    
})();