/**
 * BlockServed Simple Integration
 * Clean integration with simple image system for recipient viewing
 */

class BlockServedSimple {
    constructor() {
        this.imageSystem = window.simpleImageSystem;
        this.initialized = false;
    }

    /**
     * Initialize BlockServed viewer
     */
    init() {
        if (!this.imageSystem) {
            console.error('Simple Image System not loaded');
            return;
        }

        // Check if on BlockServed page
        const isBlockServed = window.location.pathname.includes('blockserved') || 
                            document.querySelector('#blockserved-app, .blockserved-container');
        
        if (!isBlockServed) {
            return; // Not on BlockServed page
        }

        // Wait for wallet
        if (!window.tronWeb?.defaultAddress?.base58) {
            console.log('Waiting for wallet connection...');
            window.addEventListener('walletConnected', () => this.init());
            return;
        }

        this.imageSystem.init();
        this.setupBlockServed();
        this.initialized = true;
        console.log('✅ BlockServed Simple initialized');
    }

    /**
     * Setup BlockServed UI
     */
    setupBlockServed() {
        // Override existing notice loading if present
        if (window.BlockServedMobile) {
            this.overrideBlockServedMobile();
        }

        // Setup our own handlers
        this.setupEventHandlers();
        
        // Load recipient notices
        this.loadRecipientNotices();
    }

    /**
     * Override existing BlockServedMobile methods
     */
    overrideBlockServedMobile() {
        const original = window.BlockServedMobile;
        
        // Override getRecipientNotices
        original.getRecipientNotices = async (recipientAddress) => {
            console.log('Using Simple Image System for recipient notices');
            
            // Get all images where user is recipient
            const images = await this.imageSystem.getMyReceivedImages();
            
            // Transform to expected format
            return images.map(img => ({
                id: img.notice_id,
                alertId: img.notice_id,
                type: img.document_image ? 'Document' : 'Alert',
                status: 'delivered',
                recipientAddress: img.recipient_address,
                serverAddress: img.server_address,
                timestamp: img.created_at,
                transactionHash: img.transaction_hash,
                alertImage: img.alert_image || img.alert_thumbnail,
                documentImage: img.document_image || img.document_thumbnail
            }));
        };

        // Override decryptDocument if needed
        original.decryptDocument = async (encryptedData, key) => {
            // For simple system, images are already decrypted
            return encryptedData;
        };
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // View notice buttons
        document.addEventListener('click', async (e) => {
            const viewBtn = e.target.closest('.view-notice, .notice-btn, [onclick*="viewNotice"]');
            if (viewBtn) {
                e.preventDefault();
                const noticeId = this.extractNoticeId(viewBtn);
                if (noticeId) {
                    await this.viewNotice(noticeId);
                }
            }

            // Sign document buttons
            const signBtn = e.target.closest('.sign-document, .btn-sign, [onclick*="signDocument"]');
            if (signBtn) {
                e.preventDefault();
                const noticeId = this.extractNoticeId(signBtn);
                if (noticeId) {
                    await this.signDocument(noticeId);
                }
            }
        });

        // Connect wallet button
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', async () => {
                await this.connectWallet();
                this.loadRecipientNotices();
            });
        }
    }

    /**
     * Extract notice ID from element
     */
    extractNoticeId(element) {
        return element.dataset?.noticeId ||
               element.dataset?.id ||
               element.closest('[data-notice-id]')?.dataset?.noticeId ||
               element.closest('.notice-card')?.dataset?.noticeId ||
               element.textContent.match(/\d+/)?.[0];
    }

    /**
     * Load notices for recipient
     */
    async loadRecipientNotices() {
        const container = document.querySelector('#noticesList, #noticesSection, .notices-container');
        if (!container) {
            console.warn('Notices container not found');
            return;
        }

        // Show loading
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading your notices...</p></div>';

        try {
            // Get received notices
            const images = await this.imageSystem.getMyReceivedImages();
            
            if (!images || images.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 3rem 1rem;">
                        <i class="fas fa-inbox" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                        <h3 style="color: #64748b;">No Legal Notices</h3>
                        <p style="color: #94a3b8;">You don't have any legal notices at this time</p>
                    </div>
                `;
                return;
            }

            // Update count
            const countElement = document.querySelector('#noticeCount, .notice-count');
            if (countElement) {
                countElement.textContent = images.length;
            }

            // Render notices
            container.innerHTML = this.renderRecipientNotices(images);
            
            console.log(`Loaded ${images.length} recipient notices`);
        } catch (error) {
            console.error('Error loading recipient notices:', error);
            container.innerHTML = '<div class="error">Failed to load notices. Please try again.</div>';
        }
    }

    /**
     * Render recipient notice cards
     */
    renderRecipientNotices(images) {
        return images.map(img => {
            const isDocument = !!img.document_image;
            const isSigned = img.signature_status === 'signed';
            const isUrgent = this.checkIfUrgent(img.created_at);
            
            return `
                <div class="notice-card" data-notice-id="${img.notice_id}">
                    <div class="notice-header">
                        <div class="notice-type">${isDocument ? 'Legal Document' : 'Legal Notice'}</div>
                        <div class="notice-status ${isUrgent ? 'status-urgent' : 'status-pending'}">
                            ${isUrgent ? 'URGENT' : isSigned ? 'SIGNED' : 'PENDING'}
                        </div>
                    </div>
                    <div class="notice-details">
                        <div class="notice-detail">
                            <i class="fas fa-building"></i>
                            <span>From: ${this.truncateAddress(img.server_address)}</span>
                        </div>
                        <div class="notice-detail">
                            <i class="fas fa-hashtag"></i>
                            <span>Notice #${img.notice_id}</span>
                        </div>
                        <div class="notice-detail">
                            <i class="fas fa-calendar"></i>
                            <span>${new Date(img.created_at).toLocaleDateString()}</span>
                        </div>
                        ${isUrgent ? `
                            <div class="notice-detail" style="color: #dc2626;">
                                <i class="fas fa-exclamation-triangle"></i>
                                <span>${this.getDaysRemaining(img.created_at)} days remaining</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="notice-actions">
                        <button class="notice-btn btn-view" onclick="blockServedSimple.viewNotice('${img.notice_id}')">
                            <i class="fas fa-eye"></i>
                            View
                        </button>
                        ${isDocument && !isSigned ? `
                            <button class="notice-btn btn-sign" onclick="blockServedSimple.signDocument('${img.notice_id}')">
                                <i class="fas fa-signature"></i>
                                Sign
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * View notice in modal
     */
    async viewNotice(noticeId) {
        // Get or create modal
        let modal = document.getElementById('documentModal');
        if (!modal) {
            modal = this.createDocumentModal();
        }

        // Show modal
        modal.classList.add('active');
        const viewer = document.getElementById('documentViewer');
        viewer.innerHTML = '<div class="loading">Loading document...</div>';

        try {
            // Get image from simple system
            const imageData = await this.imageSystem.getNoticeImages(noticeId);
            
            if (!imageData) {
                viewer.innerHTML = '<div class="error">Document not found</div>';
                return;
            }

            // Display image
            const imageUrl = imageData.document_image || imageData.alert_image;
            viewer.innerHTML = `
                <img src="${imageUrl}" style="width: 100%; height: auto;" id="documentImage">
                <div style="padding: 1rem; background: #f8f9fa; margin-top: 1rem;">
                    <h4>Notice Details</h4>
                    <p><strong>Notice ID:</strong> ${noticeId}</p>
                    <p><strong>From:</strong> ${this.truncateAddress(imageData.server_address)}</p>
                    <p><strong>Date:</strong> ${new Date(imageData.created_at).toLocaleString()}</p>
                    ${imageData.transaction_hash ? `<p><strong>Transaction:</strong> ${this.truncateAddress(imageData.transaction_hash)}</p>` : ''}
                </div>
            `;

            // Store current notice for signing
            this.currentNotice = imageData;
        } catch (error) {
            console.error('Error viewing notice:', error);
            viewer.innerHTML = '<div class="error">Failed to load document</div>';
        }
    }

    /**
     * Sign document
     */
    async signDocument(noticeId) {
        if (!confirm('Sign this document? This will create a permanent blockchain record of receipt.')) {
            return;
        }

        try {
            // Here you would call the blockchain signing method
            // For now, just show success
            alert('Document signing functionality will be implemented with blockchain integration');
            
            // Reload notices to show updated status
            this.loadRecipientNotices();
        } catch (error) {
            console.error('Error signing document:', error);
            alert('Failed to sign document. Please try again.');
        }
    }

    /**
     * Create document modal
     */
    createDocumentModal() {
        const modal = document.createElement('div');
        modal.id = 'documentModal';
        modal.className = 'document-modal';
        modal.innerHTML = `
            <div class="modal-header">
                <div class="modal-title">Legal Document</div>
                <button class="modal-close" onclick="this.closest('.document-modal').classList.remove('active')">×</button>
            </div>
            <div class="document-viewer" id="documentViewer">
                <!-- Document content will be loaded here -->
            </div>
            <div class="modal-footer">
                <div class="modal-warning">
                    <strong>⚠️ Important:</strong> By signing, you acknowledge receipt of this legal notice.
                </div>
                <div class="modal-actions">
                    <button class="notice-btn btn-view" onclick="this.closest('.document-modal').classList.remove('active')">
                        <i class="fas fa-times"></i>
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    /**
     * Connect wallet
     */
    async connectWallet() {
        if (!window.tronWeb) {
            alert('Please install TronLink wallet');
            return;
        }

        try {
            if (!window.tronWeb.defaultAddress.base58) {
                await window.tronWeb.request({ method: 'tron_requestAccounts' });
            }

            if (window.tronWeb.defaultAddress.base58) {
                // Update UI
                const statusElement = document.getElementById('walletStatus');
                if (statusElement) {
                    statusElement.style.display = 'flex';
                    document.getElementById('walletAddress').textContent = 
                        this.truncateAddress(window.tronWeb.defaultAddress.base58);
                }

                // Hide connect button
                const connectBtn = document.getElementById('connectBtn');
                if (connectBtn) {
                    connectBtn.style.display = 'none';
                }

                // Initialize image system
                this.imageSystem.init();
                
                return true;
            }
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            alert('Failed to connect wallet');
            return false;
        }
    }

    /**
     * Helper functions
     */
    truncateAddress(address) {
        if (!address) return 'Unknown';
        return address.substring(0, 6) + '...' + address.substring(address.length - 4);
    }

    checkIfUrgent(createdAt) {
        const days = this.getDaysRemaining(createdAt);
        return days <= 7;
    }

    getDaysRemaining(createdAt) {
        const created = new Date(createdAt);
        const now = new Date();
        const diffTime = Math.abs(now - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, 30 - diffDays); // Assume 30 day deadline
    }
}

// Create and initialize
window.blockServedSimple = new BlockServedSimple();

// Auto-init when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.blockServedSimple.init();
    });
} else {
    window.blockServedSimple.init();
}

console.log('✅ BlockServed Simple loaded - using clean image system');