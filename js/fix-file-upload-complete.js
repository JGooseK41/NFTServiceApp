/**
 * Complete File Upload Fix
 * Ensures file upload works properly from modal
 */

(function() {
    console.log('🔧 Fixing complete file upload system...');
    
    // Fix the modal file input setup
    function fixModalFileInput() {
        // Wait for modal to be ready
        const checkModal = setInterval(() => {
            const modal = document.getElementById('createModal');
            if (!modal) return;
            
            clearInterval(checkModal);
            
            // Find or create file input
            let fileInput = modal.querySelector('input[type="file"]');
            if (!fileInput) {
                fileInput = document.getElementById('stampDocumentUpload');
            }
            
            if (!fileInput) {
                console.log('📎 Creating file input for modal...');
                
                // Find upload area
                const uploadArea = modal.querySelector('.upload-area') || 
                                 modal.querySelector('[onclick*="document.getElementById(\'stampDocumentUpload\')"]');
                
                if (uploadArea) {
                    // Create file input if it doesn't exist
                    fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.id = 'stampDocumentUpload';
                    fileInput.accept = 'image/jpeg,image/jpg,image/png,application/pdf,.pdf';
                    fileInput.style.display = 'none';
                    fileInput.multiple = true;
                    
                    // Add to document
                    uploadArea.appendChild(fileInput);
                    
                    // Set up click handler for upload area
                    uploadArea.style.cursor = 'pointer';
                    uploadArea.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fileInput.click();
                    };
                    
                    console.log('✅ File input created and attached');
                }
            }
            
            // Ensure file input has handler
            if (fileInput && !fileInput.hasUploadHandler) {
                fileInput.hasUploadHandler = true;
                fileInput.addEventListener('change', handleFileSelection);
                console.log('✅ File handler attached to input');
            }
        }, 500);
    }
    
    // Handle file selection
    async function handleFileSelection(event) {
        const files = Array.from(event.target.files);
        if (!files || files.length === 0) return;
        
        console.log(`📤 Processing ${files.length} file(s)`);
        
        // Show loading
        showUploadProgress('Processing files...');
        
        // Initialize documents list
        if (!window.uploadedDocumentsList) {
            window.uploadedDocumentsList = [];
        }
        
        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
                console.log(`📎 Processing: ${file.name}`);
                updateUploadProgress(`Processing ${file.name}... (${i+1}/${files.length})`);
                
                // Process based on file type
                let processedData;
                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                    processedData = await processPDFSimple(file);
                } else if (file.type.startsWith('image/')) {
                    processedData = await processImage(file);
                } else {
                    console.warn(`Unsupported file type: ${file.type}`);
                    continue;
                }
                
                // Add to documents list
                window.uploadedDocumentsList.push(processedData);
                console.log(`✅ Added ${file.name} to documents list`);
                
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
            }
        }
        
        // Update display
        displayUploadedDocuments();
        hideUploadProgress();
        
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
        
        // Clear input
        event.target.value = '';
    }
    
    // Simple PDF processing (no complex rendering)
    async function processPDFSimple(file) {
        const base64 = await fileToBase64(file);
        
        // Create thumbnail
        const thumbnail = createPDFThumbnail(file.name);
        
        return {
            fileName: file.name,
            fileType: 'pdf',
            originalFile: base64,
            thumbnail: thumbnail,
            alertImage: thumbnail,
            documentImage: base64,
            pageCount: 1,
            size: file.size,
            timestamp: Date.now()
        };
    }
    
    // Process image
    async function processImage(file) {
        const base64 = await fileToBase64(file);
        const thumbnail = await createImageThumbnail(file);
        
        return {
            fileName: file.name,
            fileType: 'image',
            originalFile: base64,
            thumbnail: thumbnail,
            alertImage: thumbnail,
            documentImage: base64,
            pageCount: 1,
            size: file.size,
            timestamp: Date.now()
        };
    }
    
    // File to base64
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    // Create PDF thumbnail placeholder
    function createPDFThumbnail(fileName) {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 260;
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, 200, 260);
        
        // Border
        ctx.strokeStyle = '#dee2e6';
        ctx.strokeRect(0, 0, 200, 260);
        
        // PDF icon
        ctx.fillStyle = '#dc3545';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('📄', 100, 100);
        
        // Text
        ctx.fillStyle = '#495057';
        ctx.font = '14px Arial';
        ctx.fillText('PDF Document', 100, 140);
        
        // Filename
        ctx.font = '12px Arial';
        ctx.fillStyle = '#6c757d';
        const shortName = fileName.length > 20 ? fileName.substring(0, 17) + '...' : fileName;
        ctx.fillText(shortName, 100, 160);
        
        return canvas.toDataURL('image/jpeg', 0.9);
    }
    
    // Create image thumbnail
    function createImageThumbnail(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const reader = new FileReader();
            
            reader.onload = (e) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    const maxWidth = 200;
                    const scale = maxWidth / img.width;
                    canvas.width = maxWidth;
                    canvas.height = img.height * scale;
                    
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = e.target.result;
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    // Display uploaded documents
    function displayUploadedDocuments() {
        const container = document.getElementById('uploadedDocuments');
        if (!container) {
            console.log('Creating uploadedDocuments container...');
            const modal = document.getElementById('createModal');
            if (modal) {
                const uploadArea = modal.querySelector('.upload-area');
                if (uploadArea && uploadArea.parentElement) {
                    const div = document.createElement('div');
                    div.id = 'uploadedDocuments';
                    div.style.marginTop = '20px';
                    uploadArea.parentElement.appendChild(div);
                }
            }
        }
        
        const uploadedDiv = document.getElementById('uploadedDocuments');
        if (!uploadedDiv) return;
        
        if (window.uploadedDocumentsList && window.uploadedDocumentsList.length > 0) {
            let html = '<h4 style="margin-top: 20px;">Uploaded Documents:</h4>';
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;">';
            
            window.uploadedDocumentsList.forEach((doc, index) => {
                html += `
                    <div style="border: 1px solid #ddd; padding: 10px; text-align: center; border-radius: 5px;">
                        <img src="${doc.thumbnail}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 3px;">
                        <div style="font-size: 12px; margin-top: 5px; word-break: break-word;">${doc.fileName}</div>
                        <button onclick="removeUploadedDocument(${index})" style="margin-top: 5px; padding: 2px 8px; font-size: 11px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">Remove</button>
                    </div>
                `;
            });
            
            html += '</div>';
            uploadedDiv.innerHTML = html;
            uploadedDiv.style.display = 'block';
        } else {
            uploadedDiv.innerHTML = '';
            uploadedDiv.style.display = 'none';
        }
    }
    
    // Remove document
    window.removeUploadedDocument = function(index) {
        if (window.uploadedDocumentsList && window.uploadedDocumentsList[index]) {
            window.uploadedDocumentsList.splice(index, 1);
            displayUploadedDocuments();
            
            if (window.uploadedDocumentsList.length === 0) {
                const proceedBtn = document.getElementById('proceedToStep2');
                if (proceedBtn) {
                    proceedBtn.style.display = 'none';
                }
            }
        }
    };
    
    // Progress UI
    function showUploadProgress(message) {
        let progressDiv = document.getElementById('uploadProgressStatus');
        if (!progressDiv) {
            progressDiv = document.createElement('div');
            progressDiv.id = 'uploadProgressStatus';
            progressDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 10000;';
            document.body.appendChild(progressDiv);
        }
        progressDiv.innerHTML = `<div style="text-align: center;"><div class="spinner-border text-primary" role="status"></div><div style="margin-top: 10px;">${message}</div></div>`;
        progressDiv.style.display = 'block';
    }
    
    function updateUploadProgress(message) {
        const progressDiv = document.getElementById('uploadProgressStatus');
        if (progressDiv) {
            const messageDiv = progressDiv.querySelector('div:last-child');
            if (messageDiv) {
                messageDiv.textContent = message;
            }
        }
    }
    
    function hideUploadProgress() {
        const progressDiv = document.getElementById('uploadProgressStatus');
        if (progressDiv) {
            setTimeout(() => {
                progressDiv.style.display = 'none';
            }, 500);
        }
    }
    
    // Override global handleDocumentUpload
    window.handleDocumentUpload = handleFileSelection;
    
    // Initialize on page load
    document.addEventListener('DOMContentLoaded', fixModalFileInput);
    
    // Also check when modal opens
    const originalShowModal = window.showCreateModal;
    window.showCreateModal = function() {
        if (originalShowModal) {
            originalShowModal.apply(this, arguments);
        }
        setTimeout(fixModalFileInput, 100);
    };
    
    // Also hook into tab changes
    const originalShowTab = window.showTab;
    window.showTab = function(tabName) {
        if (originalShowTab) {
            originalShowTab.apply(this, arguments);
        }
        if (tabName === 'create') {
            setTimeout(fixModalFileInput, 100);
        }
    };
    
    console.log('✅ Complete file upload fix loaded');
    console.log('   - File input detection fixed');
    console.log('   - Simple PDF processing (no hanging)');
    console.log('   - Documents display properly');
    
})();