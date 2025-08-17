/**
 * Fix Document Upload
 * Ensures PDF documents are processed and displayed after upload
 */

(function() {
    console.log('🔧 Fixing document upload handler...');
    
    // Store original handler
    const originalHandler = window.handleDocumentUpload;
    
    window.handleDocumentUpload = async function(event) {
        const files = Array.from(event.target.files);
        if (!files || files.length === 0) return;
        
        console.log(`📤 Processing ${files.length} file(s) for upload`);
        
        try {
            // Show processing status
            const compressionStatus = document.getElementById('compressionStatus');
            if (compressionStatus) {
                compressionStatus.style.display = 'block';
                compressionStatus.innerHTML = '<div class="spinner"></div> Processing documents...';
            }
            
            // Initialize documents list if needed
            if (!window.uploadedDocumentsList) {
                window.uploadedDocumentsList = [];
            }
            
            // Process each file
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`📎 Processing file ${i+1}/${files.length}: ${file.name}`);
                
                try {
                    // Update progress
                    if (compressionStatus) {
                        const progress = Math.round((i / files.length) * 100);
                        compressionStatus.innerHTML = `<div class="spinner"></div> Processing ${file.name}... (${progress}%)`;
                    }
                    
                    // For PDFs, store directly without complex processing
                    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                        console.log('📄 Processing PDF directly...');
                        
                        // Convert to base64 for storage
                        const base64 = await fileToBase64(file);
                        
                        // Create simple thumbnail placeholder
                        const thumbnailCanvas = document.createElement('canvas');
                        thumbnailCanvas.width = 200;
                        thumbnailCanvas.height = 260;
                        const ctx = thumbnailCanvas.getContext('2d');
                        
                        // Draw PDF icon placeholder
                        ctx.fillStyle = '#f0f0f0';
                        ctx.fillRect(0, 0, 200, 260);
                        ctx.fillStyle = '#333';
                        ctx.font = '16px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText('📄 PDF Document', 100, 130);
                        ctx.font = '12px Arial';
                        ctx.fillText(file.name.substring(0, 20), 100, 150);
                        
                        const thumbnail = thumbnailCanvas.toDataURL('image/jpeg');
                        
                        // Store document data
                        const documentData = {
                            fileName: file.name,
                            fileType: 'pdf',
                            originalFile: base64,
                            thumbnail: thumbnail,
                            pageCount: 1,
                            size: file.size,
                            timestamp: Date.now()
                        };
                        
                        window.uploadedDocumentsList.push(documentData);
                        console.log('✅ PDF stored:', file.name);
                        
                    } else if (file.type.startsWith('image/')) {
                        console.log('🖼️ Processing image...');
                        
                        // For images, create compressed version
                        const base64 = await fileToBase64(file);
                        const thumbnail = await createImageThumbnail(file);
                        
                        const documentData = {
                            fileName: file.name,
                            fileType: 'image',
                            originalFile: base64,
                            thumbnail: thumbnail,
                            pageCount: 1,
                            size: file.size,
                            timestamp: Date.now()
                        };
                        
                        window.uploadedDocumentsList.push(documentData);
                        console.log('✅ Image stored:', file.name);
                    }
                    
                } catch (fileError) {
                    console.error(`Error processing ${file.name}:`, fileError);
                    // Continue with next file
                }
            }
            
            // Update UI
            updateDocumentDisplay();
            
            // Show success
            if (window.uiManager && window.uiManager.showNotification) {
                window.uiManager.showNotification('success', 
                    `${window.uploadedDocumentsList.length} document(s) ready for processing`);
            }
            
            // Show proceed button
            const proceedBtn = document.getElementById('proceedToStep2');
            if (proceedBtn) {
                proceedBtn.style.display = 'block';
            }
            
            // Hide loading
            setTimeout(() => {
                if (compressionStatus) {
                    compressionStatus.style.display = 'none';
                }
            }, 2000);
            
            // Clear file input
            event.target.value = '';
            
        } catch (error) {
            console.error('Document upload error:', error);
            
            // Try original handler as fallback
            if (originalHandler) {
                console.log('Falling back to original handler');
                return originalHandler.call(this, event);
            }
        }
    };
    
    // Helper function to convert file to base64
    async function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    // Helper function to create image thumbnail
    async function createImageThumbnail(file, maxWidth = 200) {
        return new Promise((resolve) => {
            const img = new Image();
            const reader = new FileReader();
            
            reader.onload = (e) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calculate dimensions
                    const scale = maxWidth / img.width;
                    canvas.width = maxWidth;
                    canvas.height = img.height * scale;
                    
                    // Draw scaled image
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = e.target.result;
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    // Update document display
    function updateDocumentDisplay() {
        const uploadedDocumentsDiv = document.getElementById('uploadedDocuments');
        if (!uploadedDocumentsDiv) {
            console.log('uploadedDocuments div not found');
            return;
        }
        
        if (window.uploadedDocumentsList && window.uploadedDocumentsList.length > 0) {
            let html = '<h4>Uploaded Documents:</h4><div class="document-grid">';
            
            window.uploadedDocumentsList.forEach((doc, index) => {
                html += `
                    <div class="document-item" data-index="${index}">
                        <img src="${doc.thumbnail}" alt="${doc.fileName}" style="width: 100px; height: 130px; object-fit: cover;">
                        <div class="document-name">${doc.fileName}</div>
                        <div class="document-info">${doc.fileType.toUpperCase()} • ${(doc.size / 1024).toFixed(1)}KB</div>
                        <button onclick="removeDocument(${index})" class="btn-remove">Remove</button>
                    </div>
                `;
            });
            
            html += '</div>';
            uploadedDocumentsDiv.innerHTML = html;
            uploadedDocumentsDiv.style.display = 'block';
        } else {
            uploadedDocumentsDiv.innerHTML = '';
            uploadedDocumentsDiv.style.display = 'none';
        }
    }
    
    // Remove document function
    window.removeDocument = function(index) {
        if (window.uploadedDocumentsList && window.uploadedDocumentsList[index]) {
            window.uploadedDocumentsList.splice(index, 1);
            updateDocumentDisplay();
            
            // Hide proceed button if no documents
            if (window.uploadedDocumentsList.length === 0) {
                const proceedBtn = document.getElementById('proceedToStep2');
                if (proceedBtn) {
                    proceedBtn.style.display = 'none';
                }
            }
        }
    };
    
    // Also update the documents list function if it exists
    window.updateDocumentsList = updateDocumentDisplay;
    
    console.log('✅ Document upload fix loaded');
    console.log('   - PDFs stored directly without complex processing');
    console.log('   - Images compressed and thumbnailed');
    console.log('   - UI updates properly after upload');
    
})();