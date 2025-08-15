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
     * View notice in modal - with optional sign-before-view
     */
    async viewNotice(noticeId) {
        // First, check if this notice requires signing
        const imageData = await this.imageSystem.getNoticeImages(noticeId);
        
        if (!imageData) {
            alert('Document not found');
            return;
        }

        // Check if document type and not yet signed
        const isDocument = !!imageData.document_image;
        const isSigned = imageData.signature_status === 'signed' || 
                        localStorage.getItem(`signed_${noticeId}`) === 'true';
        const wasRefused = localStorage.getItem(`refused_${noticeId}`) === 'true';

        // If it's a document and not signed/refused, show signing prompt
        if (isDocument && !isSigned && !wasRefused) {
            this.showSigningPrompt(noticeId, imageData);
        } else {
            // Otherwise, show the document directly
            this.displayDocument(noticeId, imageData);
        }
    }

    /**
     * Show signing prompt before viewing
     */
    showSigningPrompt(noticeId, imageData) {
        // Create signing prompt modal
        let promptModal = document.getElementById('signingPromptModal');
        if (!promptModal) {
            promptModal = this.createSigningPromptModal();
        }

        // Update content
        document.getElementById('promptNoticeId').textContent = noticeId;
        document.getElementById('promptServer').textContent = this.truncateAddress(imageData.server_address);
        document.getElementById('promptDate').textContent = new Date(imageData.created_at).toLocaleDateString();

        // Show modal
        promptModal.classList.add('active');

        // Setup button handlers
        document.getElementById('signAndViewBtn').onclick = async () => {
            promptModal.classList.remove('active');
            await this.signAndView(noticeId, imageData);
        };

        document.getElementById('refuseToSignBtn').onclick = () => {
            promptModal.classList.remove('active');
            this.refuseToSign(noticeId, imageData);
        };

        document.getElementById('cancelViewBtn').onclick = () => {
            promptModal.classList.remove('active');
        };
    }

    /**
     * Sign document and then view it
     */
    async signAndView(noticeId, imageData) {
        // Show signing in progress
        const loadingModal = this.showLoadingModal('Signing document on blockchain...');

        try {
            // Call blockchain signing
            // TODO: Implement actual blockchain signing
            const txHash = await this.performBlockchainSigning(noticeId);
            
            // Log successful signing in audit trail
            if (window.auditLogger) {
                await window.auditLogger.logEvent({
                    status: 'signed',
                    action: 'RECIPIENT_SIGNED_DOCUMENT',
                    sender_address: imageData.server_address,
                    recipient_address: window.tronWeb?.defaultAddress?.base58 || '',
                    notice_id: noticeId,
                    notice_type: 'Document',
                    case_number: imageData.case_number || 'Unknown',
                    transaction_hash: txHash || imageData.transaction_hash,
                    metadata: {
                        signature_method: 'blockchain',
                        signed_at: new Date().toISOString(),
                        notice_created: imageData.created_at,
                        days_until_signature: Math.floor((new Date() - new Date(imageData.created_at)) / (1000 * 60 * 60 * 24))
                    }
                });
            }
            
            // Mark as signed locally
            localStorage.setItem(`signed_${noticeId}`, 'true');
            localStorage.setItem(`signed_${noticeId}_date`, new Date().toISOString());
            
            // Update backend
            await this.updateSignatureStatus(noticeId, 'signed');
            
            // Close loading
            loadingModal.remove();
            
            // Show success message
            this.showSuccessMessage('Document signed successfully!');
            
            // Now display the document
            this.displayDocument(noticeId, imageData);
            
        } catch (error) {
            console.error('Error signing document:', error);
            loadingModal.remove();
            alert('Failed to sign document. You can still view it by refusing to sign.');
        }
    }

    /**
     * Refuse to sign but still view
     */
    refuseToSign(noticeId, imageData) {
        // Confirm refusal
        const confirmModal = this.createConfirmRefusalModal();
        confirmModal.classList.add('active');

        document.getElementById('confirmRefusalBtn').onclick = async () => {
            confirmModal.classList.remove('active');
            
            // Mark as refused locally
            localStorage.setItem(`refused_${noticeId}`, 'true');
            
            // Log refusal in audit trail with IP and timestamp
            await this.logRefusalInAudit(noticeId, imageData);
            
            // Update backend with refusal
            await this.updateSignatureStatus(noticeId, 'refused');
            
            // Show warning
            this.showWarningMessage('You have refused to sign. This refusal has been recorded in the audit log.');
            
            // Display document in view-only mode
            this.displayDocument(noticeId, imageData, true);
        };

        document.getElementById('cancelRefusalBtn').onclick = () => {
            confirmModal.classList.remove('active');
            // Go back to signing prompt
            this.showSigningPrompt(noticeId, imageData);
        };
    }

    /**
     * Log refusal in audit trail using existing audit logger
     */
    async logRefusalInAudit(noticeId, imageData) {
        // Use existing audit logger if available
        if (window.auditLogger) {
            return await window.auditLogger.logEvent({
                status: 'refused',
                action: 'RECIPIENT_REFUSED_TO_SIGN',
                sender_address: imageData.server_address,
                recipient_address: window.tronWeb?.defaultAddress?.base58 || '',
                notice_id: noticeId,
                notice_type: imageData.document_image ? 'Document' : 'Alert',
                case_number: imageData.case_number || 'Unknown',
                transaction_hash: imageData.transaction_hash,
                metadata: {
                    refusal_reason: 'User declined to sign',
                    view_only_mode: true,
                    timestamp: new Date().toISOString(),
                    notice_created: imageData.created_at,
                    days_until_refusal: Math.floor((new Date() - new Date(imageData.created_at)) / (1000 * 60 * 60 * 24))
                }
            });
        } else {
            // Fallback to direct API call if audit logger not loaded
            try {
                const response = await fetch(`${this.imageSystem.backend}/api/audit/log`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58 || ''
                    },
                    body: JSON.stringify({
                        status: 'refused',
                        action: 'RECIPIENT_REFUSED_TO_SIGN',
                        sender_address: imageData.server_address,
                        recipient_address: window.tronWeb?.defaultAddress?.base58 || '',
                        notice_id: noticeId,
                        notice_type: imageData.document_image ? 'Document' : 'Alert',
                        case_number: imageData.case_number || 'Unknown',
                        transaction_hash: imageData.transaction_hash,
                        timestamp: new Date().toISOString(),
                        metadata: {
                            refusal_reason: 'User declined to sign',
                            view_only_mode: true,
                            notice_created: imageData.created_at
                        }
                    })
                });

                if (response.ok) {
                    console.log(`Refusal logged in audit trail for notice ${noticeId}`);
                } else {
                    console.error('Failed to log refusal in audit trail');
                }
            } catch (error) {
                console.error('Error logging refusal:', error);
            }
        }
    }

    /**
     * Display the document
     */
    async displayDocument(noticeId, imageData, viewOnly = false) {
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
            // Display image
            const imageUrl = imageData.document_image || imageData.alert_image;
            const isSigned = localStorage.getItem(`signed_${noticeId}`) === 'true';
            const isRefused = localStorage.getItem(`refused_${noticeId}`) === 'true';
            
            viewer.innerHTML = `
                ${viewOnly || isRefused ? `
                    <div style="background: #fef2f2; border: 2px solid #fca5a5; padding: 1rem; margin-bottom: 1rem; border-radius: 8px;">
                        <strong>⚠️ View-Only Mode</strong><br>
                        You refused to sign this document. This refusal has been recorded on the blockchain.
                    </div>
                ` : ''}
                ${isSigned ? `
                    <div style="background: #dcfce7; border: 2px solid #86efac; padding: 1rem; margin-bottom: 1rem; border-radius: 8px;">
                        <strong>✓ Signed Document</strong><br>
                        You signed this document on ${new Date().toLocaleDateString()}.
                    </div>
                ` : ''}
                <img src="${imageUrl}" style="width: 100%; height: auto;" id="documentImage">
                <div style="padding: 1rem; background: #f8f9fa; margin-top: 1rem;">
                    <h4>Notice Details</h4>
                    <p><strong>Notice ID:</strong> ${noticeId}</p>
                    <p><strong>From:</strong> ${this.truncateAddress(imageData.server_address)}</p>
                    <p><strong>Date:</strong> ${new Date(imageData.created_at).toLocaleString()}</p>
                    <p><strong>Status:</strong> ${isSigned ? 'Signed' : isRefused ? 'Refused' : 'Viewed'}</p>
                    ${imageData.transaction_hash ? `<p><strong>Transaction:</strong> ${this.truncateAddress(imageData.transaction_hash)}</p>` : ''}
                </div>
            `;

            // Store current notice
            this.currentNotice = imageData;
        } catch (error) {
            console.error('Error viewing notice:', error);
            viewer.innerHTML = '<div class="error">Failed to load document</div>';
        }
    }

    /**
     * Sign document (direct signing from list)
     */
    async signDocument(noticeId) {
        const imageData = await this.imageSystem.getNoticeImages(noticeId);
        if (!imageData) {
            alert('Document not found');
            return;
        }
        
        // Show signing prompt
        this.showSigningPrompt(noticeId, imageData);
    }

    /**
     * Perform actual blockchain signing
     */
    async performBlockchainSigning(noticeId) {
        // TODO: Implement actual blockchain call
        // For now, simulate with delay
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`Blockchain signing for notice ${noticeId}`);
                resolve();
            }, 2000);
        });
    }

    /**
     * Update signature status in backend
     */
    async updateSignatureStatus(noticeId, status) {
        try {
            const response = await fetch(`${this.imageSystem.backend}/api/images/${noticeId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58 || ''
                },
                body: JSON.stringify({ signature_status: status })
            });
            
            if (!response.ok) {
                console.error('Failed to update signature status');
            }
        } catch (error) {
            console.error('Error updating signature status:', error);
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
     * Create signing prompt modal
     */
    createSigningPromptModal() {
        const modal = document.createElement('div');
        modal.id = 'signingPromptModal';
        modal.className = 'signing-prompt-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);">
                    <h3 style="color: white;">
                        <i class="fas fa-exclamation-triangle"></i> Legal Document Requires Signature
                    </h3>
                </div>
                <div class="modal-body" style="padding: 2rem;">
                    <div style="background: #fef2f2; border: 2px solid #fca5a5; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                        <strong>IMPORTANT LEGAL NOTICE</strong><br>
                        This document requires your signature to acknowledge receipt. 
                        Refusing to sign does not invalidate the legal notice.
                    </div>
                    
                    <div style="margin-bottom: 1.5rem;">
                        <p><strong>Notice ID:</strong> #<span id="promptNoticeId"></span></p>
                        <p><strong>From:</strong> <span id="promptServer"></span></p>
                        <p><strong>Date:</strong> <span id="promptDate"></span></p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px;">
                        <h4>Your Options:</h4>
                        <ol>
                            <li><strong>Sign & View:</strong> Creates blockchain proof of receipt</li>
                            <li><strong>Refuse to Sign:</strong> View document without signing (refusal is logged)</li>
                            <li><strong>Cancel:</strong> Return without viewing</li>
                        </ol>
                    </div>
                </div>
                <div class="modal-footer" style="display: flex; gap: 10px; padding: 1.5rem;">
                    <button id="signAndViewBtn" class="btn btn-primary" style="flex: 1; background: #16a34a;">
                        <i class="fas fa-signature"></i> Sign & View
                    </button>
                    <button id="refuseToSignBtn" class="btn btn-secondary" style="flex: 1; background: #d97706;">
                        <i class="fas fa-times-circle"></i> Refuse to Sign
                    </button>
                    <button id="cancelViewBtn" class="btn btn-secondary" style="flex: 1;">
                        <i class="fas fa-arrow-left"></i> Cancel
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.addModalStyles();
        return modal;
    }

    /**
     * Create confirm refusal modal
     */
    createConfirmRefusalModal() {
        let modal = document.getElementById('confirmRefusalModal');
        if (modal) return modal;
        
        modal = document.createElement('div');
        modal.id = 'confirmRefusalModal';
        modal.className = 'confirm-refusal-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header" style="background: #dc2626; color: white;">
                    <h3><i class="fas fa-exclamation-triangle"></i> Confirm Refusal to Sign</h3>
                </div>
                <div class="modal-body" style="padding: 2rem;">
                    <div style="background: #fef2f2; border: 2px solid #fca5a5; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <strong>⚠️ WARNING: Legal Implications</strong>
                    </div>
                    
                    <p><strong>By refusing to sign, you acknowledge that:</strong></p>
                    <ul style="text-align: left; margin: 1rem 0;">
                        <li>You have been served with this legal notice</li>
                        <li>Your refusal will be permanently recorded</li>
                        <li>Your IP address and timestamp will be logged</li>
                        <li>This may be used as evidence of service</li>
                        <li>You may face legal consequences for non-compliance</li>
                    </ul>
                    
                    <p style="color: #dc2626; font-weight: bold;">
                        Are you sure you want to refuse to sign?
                    </p>
                </div>
                <div class="modal-footer" style="display: flex; gap: 10px; padding: 1.5rem;">
                    <button id="confirmRefusalBtn" class="btn btn-danger" style="flex: 1; background: #dc2626;">
                        <i class="fas fa-times-circle"></i> Yes, Refuse to Sign
                    </button>
                    <button id="cancelRefusalBtn" class="btn btn-primary" style="flex: 1;">
                        <i class="fas fa-arrow-left"></i> Go Back
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    /**
     * Show loading modal
     */
    showLoadingModal(message) {
        const modal = document.createElement('div');
        modal.className = 'loading-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content" style="text-align: center; padding: 2rem;">
                <div class="spinner"></div>
                <p style="margin-top: 1rem;">${message}</p>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    /**
     * Show success message
     */
    showSuccessMessage(message) {
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i> ${message}
        `;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #16a34a;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10001;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    /**
     * Show warning message
     */
    showWarningMessage(message) {
        const notification = document.createElement('div');
        notification.className = 'notification warning';
        notification.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i> ${message}
        `;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #d97706;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10001;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    /**
     * Add modal styles
     */
    addModalStyles() {
        if (document.getElementById('blockservedModalStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'blockservedModalStyles';
        style.innerHTML = `
            .signing-prompt-modal,
            .confirm-refusal-modal,
            .loading-modal {
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
            
            .signing-prompt-modal:not(.active),
            .confirm-refusal-modal:not(.active) {
                display: none;
            }
            
            .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
            }
            
            .modal-content {
                position: relative;
                background: white;
                border-radius: 12px;
                max-width: 600px;
                width: 90%;
                max-height: 90vh;
                overflow: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            
            .btn {
                padding: 0.75rem 1rem;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                transition: transform 0.2s;
            }
            
            .btn:hover {
                transform: scale(1.05);
            }
            
            .btn-primary {
                background: #3b82f6;
                color: white;
            }
            
            .btn-secondary {
                background: #6b7280;
                color: white;
            }
            
            .btn-danger {
                background: #dc2626;
                color: white;
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
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