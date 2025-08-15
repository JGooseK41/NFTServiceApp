/**
 * Fix Image Endpoints
 * Updates all image loading to use the correct /api/images endpoint
 */

(function() {
    console.log('🔧 Fixing image endpoints to use /api/images...');
    
    // Override all notice image fetches to use the correct endpoint
    const originalFetch = window.fetch;
    window.fetch = async function(url, options = {}) {
        // Convert old endpoint to new endpoint
        if (typeof url === 'string' && url.includes('/api/notices/') && url.includes('/images')) {
            // Extract notice ID from URL
            const match = url.match(/\/api\/notices\/(\d+)\/images/);
            if (match) {
                const noticeId = match[1];
                const newUrl = url.replace(`/api/notices/${noticeId}/images`, `/api/images/${noticeId}`);
                console.log(`📸 Redirecting image request from ${url} to ${newUrl}`);
                url = newUrl;
            }
        }
        
        return originalFetch.call(this, url, options);
    };
    
    // Also fix any direct image loading functions
    if (window.loadNoticeImage) {
        const originalLoadNoticeImage = window.loadNoticeImage;
        window.loadNoticeImage = async function(noticeId) {
            console.log(`Loading image for notice ${noticeId} using /api/images endpoint`);
            
            try {
                const response = await fetch(`${window.location.origin}/api/images/${noticeId}`, {
                    headers: {
                        'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58 || '',
                        'X-Server-Address': localStorage.getItem('serverAddress') || ''
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to load image: ${response.status}`);
                }
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error loading image:', error);
                // Try original method as fallback
                return originalLoadNoticeImage.call(this, noticeId);
            }
        };
    }
    
    // Fix the image viewer modal
    if (window.openImprovedViewer) {
        const originalOpenImprovedViewer = window.openImprovedViewer;
        window.openImprovedViewer = async function(noticeId) {
            console.log(`Opening viewer for notice ${noticeId} with fixed endpoints`);
            
            try {
                // Get image data from correct endpoint
                const response = await fetch(`${window.location.origin}/api/images/${noticeId}`, {
                    headers: {
                        'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58 || '',
                        'X-Server-Address': localStorage.getItem('serverAddress') || ''
                    }
                });
                
                if (response.ok) {
                    const imageData = await response.json();
                    
                    // Display the image in the modal
                    const modal = document.getElementById('imageViewerModal') || 
                                document.querySelector('.image-viewer-modal') ||
                                document.querySelector('[id*="viewer"]');
                                
                    if (modal) {
                        const imageContainer = modal.querySelector('.modal-body, .image-container, #modalImage');
                        if (imageContainer) {
                            // Display the alert image
                            if (imageData.alert_image) {
                                imageContainer.innerHTML = `
                                    <div style="text-align: center;">
                                        <h3>Alert NFT</h3>
                                        <img src="${imageData.alert_image}" style="max-width: 100%; height: auto;" />
                                        <p>Notice ID: ${noticeId}</p>
                                        <p>Case: ${imageData.case_number || 'N/A'}</p>
                                    </div>
                                `;
                            }
                            
                            // Also show document if available
                            if (imageData.document_image) {
                                imageContainer.innerHTML += `
                                    <div style="text-align: center; margin-top: 20px;">
                                        <h3>Document NFT</h3>
                                        <img src="${imageData.document_image}" style="max-width: 100%; height: auto;" />
                                    </div>
                                `;
                            }
                            
                            modal.style.display = 'block';
                            return;
                        }
                    }
                }
            } catch (error) {
                console.error('Error in improved viewer:', error);
            }
            
            // Fallback to original
            return originalOpenImprovedViewer.call(this, noticeId);
        };
    }
    
    // Fix any inline onclick handlers
    document.addEventListener('DOMContentLoaded', () => {
        const fixOnclickHandlers = () => {
            document.querySelectorAll('[onclick*="/api/notices/"][onclick*="/images"]').forEach(el => {
                const onclick = el.getAttribute('onclick');
                const fixed = onclick.replace(/\/api\/notices\/(\d+)\/images/g, '/api/images/$1');
                el.setAttribute('onclick', fixed);
            });
        };
        
        fixOnclickHandlers();
        
        // Watch for dynamic content
        const observer = new MutationObserver(fixOnclickHandlers);
        observer.observe(document.body, { childList: true, subtree: true });
    });
    
    console.log('✅ Image endpoints fixed to use /api/images');
})();