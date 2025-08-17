/**
 * Unified Upload Handler
 * Combines CompleteImageHandler with current workflow
 */

(function() {
    console.log('🔄 Unifying upload handlers...');
    
    // Store original handler
    const originalHandleUpload = window.handleDocumentUpload;
    
    // Create unified handler that uses CompleteImageHandler when available
    window.handleDocumentUpload = async function(event) {
        const files = Array.from(event.target.files);
        if (!files || files.length === 0) return;
        
        console.log(`Unified handler processing ${files.length} file(s)`);
        
        // Try CompleteImageHandler first if available
        if (window.CompleteImageHandler) {
            try {
                // Show processing status
                const compressionStatus = document.getElementById('compressionStatus');
                if (compressionStatus) {
                    compressionStatus.style.display = 'block';
                }
                
                // Initialize documents list if needed
                if (!window.uploadedDocumentsList) {
                    window.uploadedDocumentsList = [];
                }
                
                // Process each file with CompleteImageHandler
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    
                    try {
                        console.log(`Processing with CompleteImageHandler: ${file.name}`);
                        
                        // Update progress
                        if (window.updateCompressionProgress) {
                            const progress = Math.round((i / files.length) * 100);
                            window.updateCompressionProgress(progress, `Processing ${file.name}...`);
                        }
                        
                        // Process with CompleteImageHandler
                        const images = await window.CompleteImageHandler.processDocument(file);
                        
                        // Add to documents list in expected format
                        const documentData = {
                            id: Date.now() + '_' + i,
                            data: images.documentImage || images.alertImage,
                            fileName: file.name,
                            fileType: file.type,
                            fileSize: file.size,
                            preview: images.alertThumbnail || images.alertImage,
                            order: window.uploadedDocumentsList.length,
                            // Store all images
                            alertImage: images.alertImage,
                            alertThumbnail: images.alertThumbnail,
                            documentImage: images.documentImage,
                            documentThumbnail: images.documentThumbnail,
                            pageCount: images.pageCount || 1
                        };
                        
                        window.uploadedDocumentsList.push(documentData);
                        
                        // Also store in localStorage for compatibility
                        localStorage.setItem('pendingAlertImage', images.alertImage);
                        localStorage.setItem('pendingAlertThumbnail', images.alertThumbnail);
                        localStorage.setItem('pendingDocumentImage', images.documentImage);
                        localStorage.setItem('pendingDocumentThumbnail', images.documentThumbnail);
                        
                        console.log(`✅ Processed ${file.name} successfully`);
                        
                    } catch (error) {
                        console.error(`CompleteImageHandler failed for ${file.name}:`, error);
                        
                        // Fall back to original handler for this file
                        console.log('Falling back to original handler...');
                        
                        // Create a fake event with just this file
                        const singleFileEvent = {
                            target: {
                                files: [file]
                            }
                        };
                        
                        // Process with original handler if available
                        if (originalHandleUpload) {
                            await originalHandleUpload.call(this, singleFileEvent);
                        }
                    }
                }
                
                // Update UI
                if (window.updateCompressionProgress) {
                    window.updateCompressionProgress(100, 'Documents ready');
                }
                
                // Update documents list UI
                if (window.updateDocumentsList) {
                    window.updateDocumentsList();
                }
                
                // Show success
                if (window.uiManager && window.uiManager.showNotification) {
                    window.uiManager.showNotification('success', 
                        `${window.uploadedDocumentsList.length} document(s) uploaded successfully`);
                }
                
                // Show proceed button
                const proceedBtn = document.getElementById('proceedToStep2');
                if (proceedBtn) {
                    proceedBtn.style.display = 'block';
                }
                
                // Hide loading after delay
                setTimeout(() => {
                    if (compressionStatus) {
                        compressionStatus.style.display = 'none';
                    }
                }, 2000);
                
                // Clear file input
                event.target.value = '';
                
            } catch (error) {
                console.error('Unified handler error:', error);
                
                // Fall back to original handler
                if (originalHandleUpload) {
                    console.log('Falling back to original handler for all files');
                    return originalHandleUpload.call(this, event);
                }
            }
        } else {
            // No CompleteImageHandler, use original
            if (originalHandleUpload) {
                return originalHandleUpload.call(this, event);
            }
        }
    };
    
    console.log('✅ Unified upload handler ready');
    console.log('Will try CompleteImageHandler first, then fall back to original');
    
})();