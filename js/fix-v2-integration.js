/**
 * Fix V2 Integration - Ensure Document System V2 is properly loaded
 */

(function() {
    console.log('🔧 Fixing Document System V2 integration...');
    
    // Wait for V2 to be loaded
    function ensureV2System() {
        if (!window.documentSystemV2) {
            console.log('⏳ Waiting for Document System V2...');
            setTimeout(ensureV2System, 100);
            return;
        }
        
        console.log('✅ Document System V2 found, overriding handlers');
        
        // Override the upload handler to use V2
        window.handleDocumentUpload = async function(event) {
            console.log('📄 Using Document System V2 for upload');
            
            const files = event.target.files;
            if (!files || files.length === 0) return;
            
            const file = files[0];
            
            try {
                // Use V2 system
                const document = await window.documentSystemV2.handleFileUpload(file);
                
                // Show preview immediately
                const preview = window.document.getElementById('documentPreview');
                if (preview && document.thumbnail) {
                    preview.src = document.thumbnail;
                    preview.style.display = 'block';
                    console.log('✅ Preview displayed from V2 thumbnail');
                }
                
                // Also update stampDocumentPreview if it exists
                const stampPreview = window.document.getElementById('stampDocumentPreview');
                if (stampPreview && document.thumbnail) {
                    stampPreview.src = document.thumbnail;
                    stampPreview.style.display = 'block';
                }
                
                // Show next step button
                const nextButton = window.document.querySelector('[onclick*="showMintStep2"]');
                if (nextButton) {
                    nextButton.style.display = 'inline-block';
                }
                
                // Show success message
                if (window.uiManager) {
                    window.uiManager.showNotification('success', 'Document uploaded and stored on disk');
                }
                
            } catch (error) {
                console.error('V2 upload failed:', error);
                if (window.uiManager) {
                    window.uiManager.showNotification('error', 'Upload failed: ' + error.message);
                }
            }
        };
        
        // Also fix the document preview display
        const originalShowMintStep2 = window.showMintStep2;
        window.showMintStep2 = function() {
            console.log('📋 Showing Step 2 with V2 document');
            
            // Make sure preview is visible
            const document = window.documentSystemV2?.documents[0];
            if (document) {
                const preview = window.document.getElementById('documentPreview');
                if (preview) {
                    preview.src = document.thumbnail;
                    preview.style.display = 'block';
                }
                
                const stampPreview = window.document.getElementById('stampDocumentPreview');
                if (stampPreview) {
                    stampPreview.src = document.thumbnail;
                    stampPreview.style.display = 'block';
                }
            }
            
            // Call original function
            if (originalShowMintStep2) {
                return originalShowMintStep2.apply(this, arguments);
            }
        };
        
        // Fix the NFT creation to use V2 metadata
        const originalCreateLegalNotice = window.createLegalNotice;
        window.createLegalNotice = async function() {
            console.log('🚀 Creating NFT with V2 system');
            
            const document = window.documentSystemV2?.documents[0];
            if (!document) {
                if (window.uiManager) {
                    window.uiManager.showNotification('error', 'Please upload a document first');
                }
                return;
            }
            
            // Ensure we have the thumbnail for Alert NFT
            if (!document.thumbnail) {
                console.error('No thumbnail available for Alert NFT');
                if (window.uiManager) {
                    window.uiManager.showNotification('error', 'Document thumbnail not available');
                }
                return;
            }
            
            // Store thumbnail for NFT metadata
            window.uploadedImage = {
                preview: document.thumbnail,
                alertThumbnail: document.thumbnail,
                fileName: document.fileName,
                fileSize: document.fileSize,
                diskPath: document.diskPath,
                noticeId: document.noticeId
            };
            
            console.log('✅ Document ready for NFT with thumbnail');
            
            // Continue with original flow
            if (originalCreateLegalNotice) {
                return await originalCreateLegalNotice.apply(this, arguments);
            }
        };
        
        console.log('✅ Document System V2 integration complete');
        console.log('   - Upload handler overridden');
        console.log('   - Preview display fixed');
        console.log('   - NFT creation uses V2 metadata');
    }
    
    // Start the integration
    ensureV2System();
    
    // Also ensure V2 loads if page loads scripts dynamically
    window.addEventListener('load', ensureV2System);
    
})();