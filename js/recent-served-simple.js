/**
 * Recent Served Notices - Using Simple Image System
 * Clean integration with the new simple image storage
 */

class RecentServedSimple {
    constructor() {
        this.imageSystem = window.simpleImageSystem;
        this.initialized = false;
    }

    /**
     * Initialize and setup event handlers
     */
    init() {
        if (!this.imageSystem) {
            console.error('Simple Image System not loaded');
            return;
        }

        // Wait for wallet connection
        if (!window.tronWeb?.defaultAddress?.base58) {
            console.log('Waiting for wallet connection...');
            window.addEventListener('walletConnected', () => this.init());
            return;
        }

        this.imageSystem.init();
        this.setupEventHandlers();
        this.loadRecentServed();
        this.initialized = true;
        console.log('✅ Recent Served Simple initialized');
    }

    /**
     * Setup click handlers for notice cards
     */
    setupEventHandlers() {
        // Use event delegation for dynamic content
        document.addEventListener('click', async (e) => {
            // Check if clicked element is a view button or notice card
            const viewBtn = e.target.closest('.view-notice-btn, .view-image-btn, [data-action="view-notice"]');
            const noticeCard = e.target.closest('.notice-card, .case-card, .notice-item');
            
            if (viewBtn || (noticeCard && !e.target.closest('button'))) {
                e.preventDefault();
                e.stopPropagation();
                
                // Extract notice ID
                const element = viewBtn || noticeCard;
                const noticeId = this.extractNoticeId(element);
                
                if (noticeId) {
                    await this.viewNoticeImage(noticeId);
                }
            }
        });

        // Refresh button
        const refreshBtn = document.querySelector('#refreshRecentServed, .refresh-notices-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadRecentServed());
        }
    }

    /**
     * Extract notice ID from various element types
     */
    extractNoticeId(element) {
        // Try multiple methods to get the ID
        const noticeId = 
            element.dataset?.noticeId ||
            element.dataset?.alertId ||
            element.dataset?.documentId ||
            element.closest('[data-notice-id]')?.dataset?.noticeId ||
            element.textContent.match(/Notice #(\d+)/)?.[1] ||
            element.textContent.match(/Token (\d+)/)?.[1] ||
            element.textContent.match(/Alert (\d+)/)?.[1] ||
            element.textContent.match(/Document (\d+)/)?.[1];

        if (!noticeId || noticeId === 'null' || noticeId === 'undefined') {
            console.warn('No valid notice ID found');
            return null;
        }

        return noticeId;
    }

    /**
     * Load recent served notices
     */
    async loadRecentServed() {
        const container = document.querySelector('#recentServedContainer, #recentActivitySection, #recentActivitiesCard .card-body');
        if (!container) {
            console.warn('Recent served container not found');
            return;
        }

        // Show loading
        container.innerHTML = '<div class="loading">Loading recent notices...</div>';

        try {
            // Get all served images
            const images = await this.imageSystem.getMyServedImages();
            
            if (!images || images.length === 0) {
                container.innerHTML = '<div class="no-data">No recent served notices</div>';
                return;
            }

            // Group by case if needed (optional)
            const grouped = this.groupByCase(images);
            
            // Render the notices
            container.innerHTML = this.renderNotices(images);
            
            console.log(`Loaded ${images.length} recent served notices`);
        } catch (error) {
            console.error('Error loading recent served:', error);
            container.innerHTML = '<div class="error">Failed to load notices</div>';
        }
    }

    /**
     * Group notices by case number (optional)
     */
    groupByCase(images) {
        const cases = new Map();
        
        images.forEach(img => {
            // Extract case number if available
            const caseNum = img.case_number || 'Unknown';
            
            if (!cases.has(caseNum)) {
                cases.set(caseNum, []);
            }
            cases.get(caseNum).push(img);
        });

        return cases;
    }

    /**
     * Render notice cards
     */
    renderNotices(images) {
        return images.map(img => `
            <div class="notice-card" data-notice-id="${img.notice_id}">
                <div class="notice-header">
                    <span class="notice-id">Notice #${img.notice_id}</span>
                    <span class="notice-date">${new Date(img.created_at).toLocaleDateString()}</span>
                </div>
                <div class="notice-body">
                    <div class="notice-recipient">
                        <i class="fas fa-user"></i>
                        To: ${this.truncateAddress(img.recipient_address)}
                    </div>
                    ${img.transaction_hash ? `
                        <div class="notice-tx">
                            <i class="fas fa-link"></i>
                            TX: ${this.truncateAddress(img.transaction_hash)}
                        </div>
                    ` : ''}
                </div>
                <div class="notice-actions">
                    <button class="btn btn-sm btn-primary view-notice-btn" data-notice-id="${img.notice_id}">
                        <i class="fas fa-eye"></i> View
                    </button>
                    ${img.document_image ? `
                        <button class="btn btn-sm btn-secondary download-btn" onclick="recentServedSimple.downloadImage('${img.notice_id}')">
                            <i class="fas fa-download"></i> Download
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    /**
     * View notice image in modal
     */
    async viewNoticeImage(noticeId) {
        // Create or get modal
        let modal = document.getElementById('noticeImageModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'noticeImageModal';
            modal.className = 'image-modal';
            modal.innerHTML = `
                <div class="modal-overlay" onclick="this.parentElement.style.display='none'"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Notice #<span id="modalNoticeId"></span></h3>
                        <button class="close-btn" onclick="this.closest('.image-modal').style.display='none'">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body" id="modalImageContainer">
                        <div class="loading">Loading...</div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="this.closest('.image-modal').style.display='none'">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Add styles if needed
            if (!document.getElementById('imageModalStyles')) {
                const style = document.createElement('style');
                style.id = 'imageModalStyles';
                style.innerHTML = `
                    .image-modal {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: 10000;
                    }
                    .image-modal.show {
                        display: flex !important;
                        align-items: center;
                        justify-content: center;
                    }
                    .image-modal .modal-overlay {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.7);
                    }
                    .image-modal .modal-content {
                        position: relative;
                        background: white;
                        border-radius: 10px;
                        width: 90%;
                        max-width: 800px;
                        max-height: 90vh;
                        overflow: auto;
                    }
                    .image-modal .modal-header {
                        padding: 20px;
                        border-bottom: 1px solid #eee;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .image-modal .modal-body {
                        padding: 20px;
                        text-align: center;
                    }
                    .image-modal .modal-body img {
                        max-width: 100%;
                        height: auto;
                    }
                    .image-modal .modal-footer {
                        padding: 20px;
                        border-top: 1px solid #eee;
                        text-align: center;
                    }
                    .image-modal .close-btn {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #666;
                    }
                `;
                document.head.appendChild(style);
            }
        }

        // Show modal
        modal.style.display = 'flex';
        modal.classList.add('show');
        document.getElementById('modalNoticeId').textContent = noticeId;
        const container = document.getElementById('modalImageContainer');
        container.innerHTML = '<div class="loading">Loading image...</div>';

        try {
            // Fetch image using simple system
            const imageData = await this.imageSystem.getNoticeImages(noticeId);
            
            if (!imageData) {
                container.innerHTML = '<div class="error">No image found for this notice</div>';
                return;
            }

            // Display the image
            const imageUrl = imageData.document_image || imageData.alert_image || 
                           imageData.document_thumbnail || imageData.alert_thumbnail;
            
            if (imageUrl) {
                container.innerHTML = `
                    <img src="${imageUrl}" alt="Notice #${noticeId}">
                    <div style="margin-top: 10px; color: #666; font-size: 14px;">
                        Served: ${new Date(imageData.created_at).toLocaleString()}<br>
                        To: ${this.truncateAddress(imageData.recipient_address)}
                        ${imageData.transaction_hash ? `<br>TX: ${this.truncateAddress(imageData.transaction_hash)}` : ''}
                    </div>
                `;
            } else {
                container.innerHTML = '<div class="error">No image data available</div>';
            }
        } catch (error) {
            console.error('Error loading image:', error);
            container.innerHTML = '<div class="error">Failed to load image</div>';
        }
    }

    /**
     * Download notice image
     */
    async downloadImage(noticeId) {
        try {
            const imageData = await this.imageSystem.getNoticeImages(noticeId);
            if (!imageData) {
                alert('No image found for this notice');
                return;
            }

            const imageUrl = imageData.document_image || imageData.alert_image;
            if (!imageUrl) {
                alert('No image data available');
                return;
            }

            // Create download link
            const a = document.createElement('a');
            a.href = imageUrl;
            a.download = `notice-${noticeId}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading image:', error);
            alert('Failed to download image');
        }
    }

    /**
     * Helper to truncate addresses
     */
    truncateAddress(address) {
        if (!address) return 'Unknown';
        return address.substring(0, 6) + '...' + address.substring(address.length - 4);
    }
}

// Create and initialize
window.recentServedSimple = new RecentServedSimple();

// Auto-init when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.recentServedSimple.init();
    });
} else {
    window.recentServedSimple.init();
}

console.log('✅ Recent Served Simple loaded - using clean image system');