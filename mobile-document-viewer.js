/**
 * Mobile-Friendly Document Viewer for BlockServed
 * Provides touch-friendly scrollable document viewing with options to view without signing
 */

window.MobileDocumentViewer = {
    currentNoticeId: null,
    currentDocumentData: null,
    isAuthenticated: false,
    
    /**
     * Initialize the mobile document viewer
     */
    init() {
        this.createMobileModal();
        this.addMobileStyles();
        console.log('📱 Mobile Document Viewer initialized');
    },
    
    /**
     * Create the mobile-optimized modal HTML
     */
    createMobileModal() {
        const modalHTML = `
            <!-- Mobile Document Viewer Modal -->
            <div id="mobileDocumentModal" class="mobile-modal">
                <div class="mobile-modal-content">
                    <!-- Header -->
                    <div class="mobile-modal-header">
                        <h3 id="mobileDocumentTitle">Legal Document</h3>
                        <button class="mobile-close-btn" onclick="MobileDocumentViewer.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <!-- Document Container -->
                    <div class="mobile-document-container">
                        <div id="mobileDocumentContent" class="mobile-document-content">
                            <!-- Document image/content will be loaded here -->
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="mobile-modal-footer">
                        <!-- View Without Signing (only for authenticated users) -->
                        <button id="viewWithoutSigningBtn" class="mobile-btn mobile-btn-secondary" 
                                onclick="MobileDocumentViewer.viewWithoutSigning()" style="display: none;">
                            <i class="fas fa-eye"></i>
                            View Document Only
                        </button>
                        
                        <!-- Official Signature -->
                        <button id="officialSignBtn" class="mobile-btn mobile-btn-primary" 
                                onclick="MobileDocumentViewer.proceedToSign()">
                            <i class="fas fa-signature"></i>
                            Sign for Official Receipt
                        </button>
                        
                        <!-- Cancel -->
                        <button class="mobile-btn mobile-btn-cancel" onclick="MobileDocumentViewer.close()">
                            <i class="fas fa-times"></i>
                            Cancel
                        </button>
                    </div>
                    
                    <!-- Loading indicator -->
                    <div id="mobileDocumentLoading" class="mobile-loading">
                        <div class="mobile-spinner"></div>
                        <p>Loading document...</p>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    /**
     * Add mobile-optimized styles
     */
    addMobileStyles() {
        const styles = `
            <style>
            /* Mobile Document Modal Styles */
            .mobile-modal {
                display: none;
                position: fixed;
                z-index: 10000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.9);
                overflow: hidden;
            }
            
            .mobile-modal-content {
                display: flex;
                flex-direction: column;
                height: 100vh;
                background: white;
                margin: 0;
                padding: 0;
                position: relative;
            }
            
            .mobile-modal-header {
                background: linear-gradient(135deg, #1e40af, #3b82f6);
                color: white;
                padding: 1rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                flex-shrink: 0;
            }
            
            .mobile-modal-header h3 {
                margin: 0;
                font-size: 1.1rem;
                font-weight: 600;
            }
            
            .mobile-close-btn {
                background: none;
                border: none;
                color: white;
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0.25rem;
                border-radius: 4px;
                transition: background 0.2s;
            }
            
            .mobile-close-btn:hover {
                background: rgba(255,255,255,0.2);
            }
            
            .mobile-document-container {
                flex: 1;
                overflow: auto;
                background: #f8f9fa;
                -webkit-overflow-scrolling: touch;
                position: relative;
            }
            
            .mobile-document-content {
                padding: 1rem;
                min-height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            
            .mobile-document-content img {
                max-width: 100%;
                height: auto;
                border-radius: 8px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                margin-bottom: 1rem;
                cursor: zoom-in;
                transition: transform 0.2s;
            }
            
            .mobile-document-content img:hover {
                transform: scale(1.02);
            }
            
            .mobile-document-content img.zoomed {
                cursor: zoom-out;
                transform: scale(1.5);
                transition: transform 0.3s;
            }
            
            .mobile-modal-footer {
                background: white;
                padding: 1rem;
                border-top: 1px solid #e5e7eb;
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
                flex-shrink: 0;
            }
            
            .mobile-btn {
                width: 100%;
                padding: 0.875rem 1rem;
                border: none;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                transition: all 0.2s;
                text-decoration: none;
            }
            
            .mobile-btn-primary {
                background: linear-gradient(135deg, #3b82f6, #1e40af);
                color: white;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            
            .mobile-btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
            }
            
            .mobile-btn-secondary {
                background: #f3f4f6;
                color: #374151;
                border: 1px solid #d1d5db;
            }
            
            .mobile-btn-secondary:hover {
                background: #e5e7eb;
            }
            
            .mobile-btn-cancel {
                background: #f9fafb;
                color: #6b7280;
                border: 1px solid #e5e7eb;
            }
            
            .mobile-btn-cancel:hover {
                background: #f3f4f6;
                color: #374151;
            }
            
            .mobile-loading {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: #6b7280;
            }
            
            .mobile-spinner {
                border: 3px solid #e5e7eb;
                border-top: 3px solid #3b82f6;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Mobile-specific adjustments */
            @media (max-width: 768px) {
                .mobile-modal-footer {
                    padding: 1rem;
                    gap: 0.5rem;
                }
                
                .mobile-btn {
                    padding: 1rem;
                    font-size: 1.1rem;
                }
                
                .mobile-document-content {
                    padding: 0.5rem;
                }
            }
            
            /* Certificate Modal Styles */
            .certificate-modal {
                display: none;
                position: fixed;
                z-index: 10001;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.9);
                overflow: auto;
            }
            
            .certificate-content {
                background: white;
                margin: 2% auto;
                padding: 2rem;
                width: 95%;
                max-width: 800px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                position: relative;
            }
            
            .certificate-header {
                text-align: center;
                margin-bottom: 2rem;
                padding-bottom: 1rem;
                border-bottom: 2px solid #e5e7eb;
            }
            
            .certificate-title {
                color: #1e40af;
                margin: 0;
                font-size: 2rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .certificate-section {
                margin: 1.5rem 0;
                padding: 1rem;
                background: #f8f9fa;
                border-radius: 8px;
                border-left: 4px solid #3b82f6;
            }
            
            .certificate-section h3 {
                color: #1e40af;
                margin-top: 0;
                font-size: 1.2rem;
            }
            
            .qr-code-container {
                text-align: center;
                margin: 1rem 0;
                padding: 1rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            #decryptionQRCode {
                margin: 1rem auto;
                display: block;
            }
            
            .key-display {
                background: #f1f5f9;
                padding: 1rem;
                border-radius: 8px;
                font-family: 'Courier New', monospace;
                font-size: 0.9rem;
                word-break: break-all;
                border: 1px solid #cbd5e1;
                margin: 0.5rem 0;
            }
            
            .copy-button {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.9rem;
                margin-left: 0.5rem;
            }
            
            .copy-button:hover {
                background: #2563eb;
            }
            
            @media (max-width: 768px) {
                .certificate-content {
                    margin: 1rem;
                    width: auto;
                    padding: 1rem;
                }
                
                .certificate-title {
                    font-size: 1.5rem;
                }
            }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    },
    
    /**
     * Show the mobile document viewer
     * @param {string} noticeId - The notice ID to view
     * @param {Object} documentData - Document data if available
     */
    async show(noticeId, documentData = null) {
        this.currentNoticeId = noticeId;
        this.currentDocumentData = documentData;
        
        // Check if user is authenticated (connected wallet matches recipient)
        await this.checkAuthentication(noticeId);
        
        // Show modal
        const modal = document.getElementById('mobileDocumentModal');
        modal.style.display = 'block';
        
        // Show loading
        this.showLoading(true);
        
        // Load document
        await this.loadDocument(noticeId);
        
        console.log('📱 Mobile document viewer opened for notice:', noticeId);
    },
    
    /**
     * Check if the current user is authenticated to view this notice
     */
    async checkAuthentication(noticeId) {
        try {
            if (!window.tronWeb || !window.tronWeb.defaultAddress) {
                this.isAuthenticated = false;
                return;
            }
            
            const userAddress = window.tronWeb.defaultAddress.base58;
            
            // Get notice details to check if this user is the recipient
            if (window.legalContract) {
                try {
                    const noticeDetails = await window.legalContract.getNoticeDetails(noticeId).call();
                    this.isAuthenticated = (userAddress === noticeDetails.recipient);
                } catch (error) {
                    console.warn('Could not verify authentication:', error);
                    this.isAuthenticated = false;
                }
            }
            
            // Show/hide view-without-signing button
            const viewBtn = document.getElementById('viewWithoutSigningBtn');
            if (viewBtn) {
                viewBtn.style.display = this.isAuthenticated ? 'block' : 'none';
            }
            
        } catch (error) {
            console.error('Authentication check failed:', error);
            this.isAuthenticated = false;
        }
    },
    
    /**
     * Load and display the document
     */
    async loadDocument(noticeId) {
        try {
            // Try to get document from various sources
            let documentContent = null;
            
            // Method 1: Try to get from backend with authentication
            if (this.isAuthenticated) {
                documentContent = await this.fetchDocumentFromBackend(noticeId);
            }
            
            // Method 2: Try to get from IPFS/blockchain if available
            if (!documentContent) {
                documentContent = await this.fetchDocumentFromBlockchain(noticeId);
            }
            
            // Method 3: Use provided document data
            if (!documentContent && this.currentDocumentData) {
                documentContent = this.currentDocumentData;
            }
            
            if (documentContent) {
                this.displayDocument(documentContent);
            } else {
                this.showError('Document not available or encrypted');
            }
            
        } catch (error) {
            console.error('Error loading document:', error);
            this.showError('Failed to load document');
        } finally {
            this.showLoading(false);
        }
    },
    
    /**
     * Fetch document from backend for authenticated users
     */
    async fetchDocumentFromBackend(noticeId) {
        try {
            if (!this.isAuthenticated) return null;
            
            const userAddress = window.tronWeb.defaultAddress.base58;
            const API_BASE = window.location.hostname === 'localhost' 
                ? 'http://localhost:3001' 
                : 'https://nftserviceapp.onrender.com';
            
            const response = await fetch(`${API_BASE}/api/documents/view/${noticeId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    recipientAddress: userAddress,
                    signed: false // Request unencrypted view
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Log the view for audit trail
                await this.logDocumentView(noticeId, false);
                
                return {
                    type: 'image',
                    content: data.documentUrl || data.imageUrl,
                    isOfficial: false
                };
            }
            
        } catch (error) {
            console.error('Backend document fetch failed:', error);
        }
        
        return null;
    },
    
    /**
     * Fetch document from blockchain/IPFS
     */
    async fetchDocumentFromBlockchain(noticeId) {
        try {
            if (!window.legalContract) return null;
            
            // This would need to be implemented based on your blockchain structure
            // For now, return placeholder
            return {
                type: 'placeholder',
                content: 'Document preview not available. Please connect your wallet and sign to view the full document.',
                isOfficial: false
            };
            
        } catch (error) {
            console.error('Blockchain document fetch failed:', error);
            return null;
        }
    },
    
    /**
     * Display the document in the modal
     */
    displayDocument(documentData) {
        const contentDiv = document.getElementById('mobileDocumentContent');
        
        if (documentData.type === 'image') {
            contentDiv.innerHTML = `
                <img src="${documentData.content}" 
                     alt="Legal Document" 
                     onclick="MobileDocumentViewer.toggleZoom(this)"
                     style="max-width: 100%; cursor: zoom-in;">
                ${!documentData.isOfficial ? `
                    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 1rem; margin-top: 1rem; text-align: center;">
                        <p style="margin: 0; color: #92400e; font-weight: 600;">
                            <i class="fas fa-info-circle"></i> Unofficial View
                        </p>
                        <p style="margin: 0.5rem 0 0; color: #92400e; font-size: 0.9rem;">
                            This is an unofficial preview. Sign the document for legal confirmation.
                        </p>
                    </div>
                ` : ''}
            `;
        } else if (documentData.type === 'placeholder') {
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #6b7280;">
                    <i class="fas fa-file-alt" style="font-size: 4rem; margin-bottom: 1rem; color: #d1d5db;"></i>
                    <p style="font-size: 1.1rem; margin-bottom: 1rem;">${documentData.content}</p>
                </div>
            `;
        }
    },
    
    /**
     * Toggle image zoom
     */
    toggleZoom(imgElement) {
        imgElement.classList.toggle('zoomed');
    },
    
    /**
     * Show/hide loading indicator
     */
    showLoading(show) {
        const loading = document.getElementById('mobileDocumentLoading');
        const content = document.getElementById('mobileDocumentContent');
        
        if (loading && content) {
            loading.style.display = show ? 'block' : 'none';
            content.style.display = show ? 'none' : 'block';
        }
    },
    
    /**
     * Show error message
     */
    showError(message) {
        const contentDiv = document.getElementById('mobileDocumentContent');
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #ef4444;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p style="font-size: 1.1rem; margin: 0;">${message}</p>
            </div>
        `;
    },
    
    /**
     * View document without signing (for authenticated users only)
     */
    async viewWithoutSigning() {
        if (!this.isAuthenticated) {
            alert('You must connect your wallet to use this feature.');
            return;
        }
        
        // Log this as an unofficial view
        await this.logDocumentView(this.currentNoticeId, false);
        
        // Show confirmation
        const confirmDiv = document.createElement('div');
        confirmDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #10b981;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            z-index: 10002;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        confirmDiv.innerHTML = `
            <i class="fas fa-eye"></i> 
            Document viewed (unofficial) - IP and access logged for audit trail
        `;
        
        document.body.appendChild(confirmDiv);
        
        setTimeout(() => {
            document.body.removeChild(confirmDiv);
        }, 3000);
        
        console.log('📄 Document viewed without signing:', this.currentNoticeId);
    },
    
    /**
     * Proceed to official signature
     */
    proceedToSign() {
        // Close mobile modal and open traditional accept modal
        this.close();
        
        // Trigger the existing acceptance flow
        if (window.showAcceptModal) {
            window.showAcceptModal(this.currentNoticeId);
        }
    },
    
    /**
     * Close the mobile modal
     */
    close() {
        const modal = document.getElementById('mobileDocumentModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        this.currentNoticeId = null;
        this.currentDocumentData = null;
    },
    
    /**
     * Log document view for audit trail
     */
    async logDocumentView(noticeId, isSigned) {
        try {
            const API_BASE = window.location.hostname === 'localhost' 
                ? 'http://localhost:3001' 
                : 'https://nftserviceapp.onrender.com';
            
            await fetch(`${API_BASE}/api/audit/log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: isSigned ? 'DOCUMENT_SIGNED_VIEW' : 'DOCUMENT_UNOFFICIAL_VIEW',
                    notice_id: noticeId,
                    user_address: window.tronWeb?.defaultAddress?.base58,
                    details: {
                        timestamp: new Date().toISOString(),
                        user_agent: navigator.userAgent,
                        ip_logged: true
                    }
                })
            });
            
        } catch (error) {
            console.error('Failed to log document view:', error);
        }
    },
    
    /**
     * Generate certificate of service after successful signing
     */
    async generateCertificate(noticeId, transactionHash, decryptionKey) {
        try {
            // Get notice details
            const noticeDetails = await window.legalContract.getNoticeDetails(noticeId).call();
            
            // Generate QR code for decryption key
            const qrCodeDataUrl = await this.generateQRCode(decryptionKey);
            
            const certificateHTML = `
                <div class="certificate-content">
                    <button class="mobile-close-btn" style="position: absolute; top: 1rem; right: 1rem; background: #ef4444; color: white; border-radius: 50%; width: 40px; height: 40px;" onclick="MobileDocumentViewer.closeCertificate()">
                        <i class="fas fa-times"></i>
                    </button>
                    
                    <div class="certificate-header">
                        <h1 class="certificate-title">Certificate of Service</h1>
                        <p style="margin: 0.5rem 0 0; color: #6b7280;">Legal Document Delivery Confirmation</p>
                    </div>
                    
                    <div class="certificate-section">
                        <h3><i class="fas fa-check-circle" style="color: #10b981;"></i> Delivery Confirmed</h3>
                        <p><strong>Notice ID:</strong> ${noticeId}</p>
                        <p><strong>Transaction Hash:</strong> ${transactionHash}</p>
                        <p><strong>Confirmed:</strong> ${new Date().toLocaleString()}</p>
                        <p><strong>Blockchain:</strong> TRON Network</p>
                    </div>
                    
                    <div class="certificate-section">
                        <h3><i class="fas fa-key"></i> Document Access Information</h3>
                        <p>You can access your document at any time using either method:</p>
                        
                        <h4>Method 1: BlockServed (Easiest)</h4>
                        <p>Visit <strong>www.blockserved.com</strong> and connect your wallet</p>
                        
                        <h4>Method 2: Decentralized IPFS (Most Secure)</h4>
                        <p>Use your decryption key with any IPFS client:</p>
                        <div class="key-display">
                            ${decryptionKey}
                            <button class="copy-button" onclick="navigator.clipboard.writeText('${decryptionKey}')">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                        
                        <div class="qr-code-container">
                            <p><strong>QR Code for Mobile Access:</strong></p>
                            <img id="decryptionQRCode" src="${qrCodeDataUrl}" alt="Decryption Key QR Code">
                            <p style="font-size: 0.8rem; color: #6b7280;">Scan with any QR reader to get your decryption key</p>
                        </div>
                    </div>
                    
                    <div class="certificate-section" style="background: #f0f9ff; border-left-color: #0ea5e9;">
                        <h3><i class="fas fa-info-circle" style="color: #0ea5e9;"></i> Important Legal Notice</h3>
                        <p>This certificate confirms that you have:</p>
                        <ul>
                            <li>✅ Received the legal document</li>
                            <li>✅ Digitally signed for delivery</li>
                            <li>✅ Created an immutable blockchain record</li>
                            <li>✅ Been provided permanent access to the document</li>
                        </ul>
                        <p><strong>Keep this certificate for your records.</strong></p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 2rem;">
                        <button class="mobile-btn mobile-btn-primary" onclick="MobileDocumentViewer.downloadCertificate()" style="width: auto; padding: 1rem 2rem;">
                            <i class="fas fa-download"></i> Download Certificate
                        </button>
                        <button class="mobile-btn mobile-btn-secondary" onclick="window.print()" style="width: auto; padding: 1rem 2rem; margin-left: 1rem;">
                            <i class="fas fa-print"></i> Print Certificate
                        </button>
                    </div>
                </div>
            `;
            
            // Create and show certificate modal
            const certificateModal = document.createElement('div');
            certificateModal.id = 'certificateModal';
            certificateModal.className = 'certificate-modal';
            certificateModal.innerHTML = certificateHTML;
            certificateModal.style.display = 'block';
            
            document.body.appendChild(certificateModal);
            
            // Store certificate data
            window.currentCertificateData = {
                noticeId,
                transactionHash,
                decryptionKey,
                generatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error generating certificate:', error);
        }
    },
    
    /**
     * Generate QR code for decryption key
     */
    async generateQRCode(text) {
        try {
            // Check if QRCode library is available (loaded from CDN in index.html)
            if (typeof QRCode !== 'undefined') {
                // Create a canvas element for QR code generation
                const canvas = document.createElement('canvas');
                const qrCode = new QRCode(canvas, {
                    text: text,
                    width: 200,
                    height: 200,
                    colorDark: '#000000',
                    colorLight: '#ffffff'
                });
                
                // Wait a moment for QR code to be generated
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Convert canvas to data URL
                return canvas.toDataURL('image/png');
            } else {
                // Fallback: Use online QR code API
                const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
                console.log('Using QR API fallback:', qrApiUrl);
                return qrApiUrl;
            }
        } catch (error) {
            console.error('QR code generation failed:', error);
            // Final fallback: Simple text display
            return 'data:image/svg+xml;base64,' + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
                    <rect width="200" height="200" fill="white"/>
                    <text x="100" y="100" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="black">
                        QR Code Generation Failed
                    </text>
                </svg>
            `);
        }
    },
    
    /**
     * Close certificate modal
     */
    closeCertificate() {
        const modal = document.getElementById('certificateModal');
        if (modal) {
            document.body.removeChild(modal);
        }
    },
    
    /**
     * Download certificate as PDF/HTML
     */
    downloadCertificate() {
        const certificateData = window.currentCertificateData;
        if (!certificateData) return;
        
        // Create downloadable HTML
        const htmlContent = document.getElementById('certificateModal').innerHTML;
        const blob = new Blob([`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Certificate of Service - Notice ${certificateData.noticeId}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 2rem; }
                    .certificate-content { max-width: 800px; margin: 0 auto; }
                    .certificate-header { text-align: center; margin-bottom: 2rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem; }
                    .certificate-title { color: #1e40af; font-size: 2rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
                    .certificate-section { margin: 1.5rem 0; padding: 1rem; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #3b82f6; }
                    .certificate-section h3 { color: #1e40af; margin-top: 0; }
                    .key-display { background: #f1f5f9; padding: 1rem; border-radius: 8px; font-family: monospace; font-size: 0.9rem; word-break: break-all; border: 1px solid #cbd5e1; margin: 0.5rem 0; }
                    .qr-code-container { text-align: center; margin: 1rem 0; padding: 1rem; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                </style>
            </head>
            <body>
                ${htmlContent}
            </body>
            </html>
        `], { type: 'text/html' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Certificate-of-Service-${certificateData.noticeId}.html`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    MobileDocumentViewer.init();
});

// Export for global access
window.MobileDocumentViewer = MobileDocumentViewer;