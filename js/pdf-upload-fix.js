/**
 * PDF Upload Fix
 * Ensures PDFs can be uploaded even if conversion fails
 */

(function() {
    console.log('🔧 PDF Upload Fix loading...');
    
    // Override the document converter to add better timeout and fallback
    if (window.DocumentConverter) {
        const OriginalConverter = window.DocumentConverter;
        
        window.DocumentConverter = class extends OriginalConverter {
            async convertPDF(file) {
                console.log(`PDF conversion starting for ${file.name}`);
                
                // Set a hard timeout of 10 seconds
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new Error('PDF conversion timeout after 10 seconds'));
                    }, 10000);
                });
                
                try {
                    // Race between conversion and timeout
                    const result = await Promise.race([
                        super.convertPDF(file),
                        timeoutPromise
                    ]);
                    
                    console.log('PDF converted successfully');
                    return result;
                    
                } catch (error) {
                    console.error('PDF conversion failed:', error);
                    
                    // Create a fallback response
                    console.log('Using fallback for PDF - will upload original');
                    
                    // Read file as data URL
                    const dataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = e => resolve(e.target.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    
                    // Create a simple preview
                    const canvas = document.createElement('canvas');
                    canvas.width = 600;
                    canvas.height = 800;
                    const ctx = canvas.getContext('2d');
                    
                    // White background
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, 600, 800);
                    
                    // PDF icon
                    ctx.fillStyle = '#dc2626';
                    ctx.font = 'bold 72px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('📄', 300, 200);
                    
                    // File name
                    ctx.fillStyle = '#374151';
                    ctx.font = 'bold 24px Arial';
                    ctx.fillText('PDF Document', 300, 300);
                    
                    ctx.font = '18px Arial';
                    const fileName = file.name.length > 30 ? 
                        file.name.substring(0, 27) + '...' : 
                        file.name;
                    ctx.fillText(fileName, 300, 350);
                    
                    // File size
                    const fileSize = (file.size / 1024 / 1024).toFixed(2) + ' MB';
                    ctx.fillText(fileSize, 300, 400);
                    
                    // Status
                    ctx.fillStyle = '#059669';
                    ctx.font = 'bold 20px Arial';
                    ctx.fillText('Ready to Upload', 300, 500);
                    
                    const preview = canvas.toDataURL('image/png');
                    
                    return {
                        preview: preview,
                        fullDocument: dataUrl,
                        data: dataUrl,
                        pageCount: 1,
                        fileType: 'pdf',
                        fallback: true
                    };
                }
            }
        };
    }
    
    // Also patch the upload handler to be more resilient
    const originalHandleUpload = window.handleDocumentUpload;
    if (originalHandleUpload) {
        window.handleDocumentUpload = async function(event) {
            console.log('Patched upload handler called');
            
            try {
                // Call original with timeout protection
                const uploadPromise = originalHandleUpload.call(this, event);
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new Error('Upload timeout after 30 seconds'));
                    }, 30000);
                });
                
                await Promise.race([uploadPromise, timeoutPromise]);
                
            } catch (error) {
                console.error('Upload failed:', error);
                
                // If upload failed, try a simpler approach
                const files = Array.from(event.target.files);
                if (files && files.length > 0) {
                    console.log('Attempting simple upload fallback');
                    
                    for (const file of files) {
                        try {
                            const reader = new FileReader();
                            const dataUrl = await new Promise((resolve, reject) => {
                                reader.onload = e => resolve(e.target.result);
                                reader.onerror = reject;
                                reader.readAsDataURL(file);
                            });
                            
                            // Add to documents list
                            if (!window.uploadedDocumentsList) {
                                window.uploadedDocumentsList = [];
                            }
                            
                            window.uploadedDocumentsList.push({
                                id: Date.now() + '_' + Math.random(),
                                data: dataUrl,
                                fileName: file.name,
                                fileType: file.type,
                                fileSize: file.size,
                                preview: dataUrl,
                                order: window.uploadedDocumentsList.length
                            });
                            
                            console.log(`Added ${file.name} to upload list`);
                            
                        } catch (fileError) {
                            console.error(`Failed to process ${file.name}:`, fileError);
                        }
                    }
                    
                    // Update UI
                    if (window.updateDocumentsList) {
                        window.updateDocumentsList();
                    }
                    
                    // Show success
                    if (window.uiManager && window.uiManager.showNotification) {
                        window.uiManager.showNotification('success', 
                            `${window.uploadedDocumentsList.length} document(s) ready`);
                    }
                    
                    // Show proceed button
                    const proceedBtn = document.getElementById('proceedToStep2');
                    if (proceedBtn) {
                        proceedBtn.style.display = 'block';
                    }
                    
                    // Hide loading
                    const compressionStatus = document.getElementById('compressionStatus');
                    if (compressionStatus) {
                        compressionStatus.style.display = 'none';
                    }
                }
            }
            
            // Always reset file input
            event.target.value = '';
        };
    }
    
    console.log('✅ PDF Upload Fix loaded');
    console.log('PDFs will now upload even if conversion fails');
    
})();