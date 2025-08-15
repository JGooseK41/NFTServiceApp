/**
 * FIX DASHBOARD IMAGE VIEWER
 * Fix image display and styling in the main dashboard's Recent Served Notices
 */

console.log('🖼️ Fixing dashboard image viewer...');

(function() {
    // Override any notice image click handlers
    function setupImageViewers() {
        // Find all notice items in recent served section
        const noticeItems = document.querySelectorAll(`
            #recentActivitySection .notice-item,
            #recentActivitiesCard .notice-item,
            .case-card,
            .notice-card,
            .grouped-case-item,
            [data-notice-id]
        `);
        
        noticeItems.forEach(item => {
            // Find clickable elements that might show images
            const clickableElements = item.querySelectorAll('a, button, [onclick], .view-image, .view-notice');
            
            clickableElements.forEach(element => {
                // Check if it's for viewing images/notices
                const onclick = element.getAttribute('onclick') || '';
                const text = element.textContent || '';
                
                if (text.includes('View') || text.includes('Alert') || onclick.includes('view') || onclick.includes('show')) {
                    // Store original handler
                    const originalOnclick = element.onclick;
                    
                    // Replace with fixed handler
                    element.onclick = async function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Get notice ID - be more thorough in extraction
                        const noticeId = item.dataset?.noticeId || 
                                       item.textContent.match(/Notice #(\d+)/)?.[1] ||
                                       item.textContent.match(/Token (\d+)/)?.[1] ||
                                       item.textContent.match(/Alert (\d+)/)?.[1] ||
                                       item.textContent.match(/Document (\d+)/)?.[1] ||
                                       item.querySelector('[data-alert-id]')?.dataset?.alertId ||
                                       item.querySelector('[data-document-id]')?.dataset?.documentId;
                        
                        if (noticeId && noticeId !== 'null' && noticeId !== 'undefined') {
                            console.log('Opening viewer for notice:', noticeId);
                            showImprovedImageViewer(noticeId);
                        } else {
                            console.warn('No valid notice ID found for item:', item);
                            if (originalOnclick) {
                                originalOnclick.call(this, e);
                            }
                        }
                    };
                }
            });
        });
    }
    
    // Create improved image viewer modal
    function showImprovedImageViewer(noticeId) {
        // Validate notice ID
        if (!noticeId || noticeId === 'null' || noticeId === 'undefined') {
            console.error('Invalid notice ID passed to viewer:', noticeId);
            alert('Unable to load notice - invalid ID');
            return;
        }
        
        console.log('Opening improved viewer for notice:', noticeId);
        
        // Remove any existing modals
        const existingModal = document.querySelector('.improved-image-modal');
        if (existingModal) existingModal.remove();
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'improved-image-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Notice #${noticeId}</h3>
                    <button class="close-btn" onclick="this.closest('.improved-image-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="image-container" id="noticeImageContainer">
                        <div class="loading-spinner">
                            <i class="fas fa-spinner fa-spin"></i> Loading image...
                        </div>
                    </div>
                    <div class="notice-details" id="noticeDetails"></div>
                </div>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.innerHTML = `
            .improved-image-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .improved-image-modal .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                cursor: pointer;
            }
            
            .improved-image-modal .modal-content {
                position: relative;
                background: white;
                border-radius: 12px;
                max-width: 90%;
                max-height: 90%;
                overflow: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            
            .improved-image-modal .modal-header {
                padding: 20px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: linear-gradient(135deg, #0ea5e9 0%, #1e40af 100%);
                color: white;
                border-radius: 12px 12px 0 0;
            }
            
            .improved-image-modal .modal-header h3 {
                margin: 0;
                font-size: 1.5rem;
                color: white !important;
            }
            
            .improved-image-modal .close-btn {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }
            
            .improved-image-modal .close-btn:hover {
                background: rgba(255,255,255,0.3);
            }
            
            .improved-image-modal .modal-body {
                padding: 20px;
                background: white;
            }
            
            .improved-image-modal .image-container {
                min-height: 200px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f9fafb;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
            }
            
            .improved-image-modal .image-container img {
                max-width: 100%;
                height: auto;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            
            .improved-image-modal .loading-spinner {
                color: #6b7280;
                font-size: 1.2rem;
            }
            
            .improved-image-modal .notice-details {
                padding: 15px;
                background: #f9fafb;
                border-radius: 8px;
                color: #111827 !important;
            }
            
            .improved-image-modal .notice-details p {
                margin: 5px 0;
                color: #374151 !important;
            }
            
            .improved-image-modal .error-message {
                color: #ef4444;
                padding: 15px;
                background: #fee;
                border-radius: 8px;
                margin: 10px 0;
            }
        `;
        
        // Add modal and styles to page
        if (!document.querySelector('#improved-modal-styles')) {
            style.id = 'improved-modal-styles';
            document.head.appendChild(style);
        }
        document.body.appendChild(modal);
        
        // Load the image
        loadNoticeImage(noticeId);
    }
    
    async function loadNoticeImage(noticeId) {
        const container = document.getElementById('noticeImageContainer');
        if (!container) return;
        
        // Validate notice ID
        if (!noticeId || noticeId === 'null' || noticeId === 'undefined') {
            console.error('Invalid notice ID:', noticeId);
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i> 
                    Invalid notice ID. Please try again.
                </div>
            `;
            return;
        }
        
        try {
            // Try backend first
            const response = await fetch(`https://nftserviceapp.onrender.com/api/images/${noticeId}`, {
                headers: {
                    'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58 || '',
                    'X-Server-Address': localStorage.getItem('serverAddress') || ''
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.alertImage || data.documentImage) {
                    const imageUrl = data.alertImage || data.documentImage;
                    container.innerHTML = `<img src="${imageUrl}" alt="Notice #${noticeId}">`;
                    
                    // Add details
                    const detailsContainer = document.getElementById('noticeDetails');
                    if (detailsContainer && data.details) {
                        detailsContainer.innerHTML = `
                            <p><strong>Type:</strong> ${data.type || 'Alert'}</p>
                            <p><strong>Status:</strong> ${data.status || 'Delivered'}</p>
                            <p><strong>Date:</strong> ${data.timestamp || new Date().toLocaleDateString()}</p>
                        `;
                    }
                } else {
                    // Try blockchain
                    await loadFromBlockchain(noticeId, container);
                }
            } else {
                await loadFromBlockchain(noticeId, container);
            }
        } catch (error) {
            console.error('Error loading image:', error);
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i> 
                    Failed to load image. Please try again.
                </div>
            `;
        }
    }
    
    async function loadFromBlockchain(noticeId, container) {
        try {
            if (!window.legalContract) {
                throw new Error('Contract not connected');
            }
            
            const tokenURI = await window.legalContract.tokenURI(noticeId).call();
            
            if (tokenURI.startsWith('data:')) {
                const base64 = tokenURI.split(',')[1];
                const json = atob(base64);
                const metadata = JSON.parse(json);
                
                if (metadata.image) {
                    container.innerHTML = `<img src="${metadata.image}" alt="Notice #${noticeId}">`;
                } else {
                    throw new Error('No image in metadata');
                }
            } else {
                throw new Error('Invalid token URI format');
            }
        } catch (error) {
            console.error('Blockchain load error:', error);
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i> 
                    No image available for this notice.
                </div>
            `;
        }
    }
    
    // Set up viewers on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupImageViewers);
    } else {
        setupImageViewers();
    }
    
    // Re-setup on dynamic content
    const observer = new MutationObserver(() => {
        setupImageViewers();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('✅ Dashboard image viewer fixes applied');
})();