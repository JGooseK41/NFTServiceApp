/**
 * Recipient View Handler
 * Allows recipients to view documents without signing if they own the wallet
 * This provides transparency while maintaining legal requirements
 */

class RecipientViewHandler {
    constructor() {
        this.currentNotice = null;
        this.recipientAddress = null;
        this.isRecipient = false;
    }

    /**
     * Initialize the handler and check if user is the recipient
     */
    async initialize(noticeId, documentId) {
        try {
            // Get the connected wallet address
            if (typeof window.tronWeb !== 'undefined' && window.tronWeb.defaultAddress.base58) {
                this.recipientAddress = window.tronWeb.defaultAddress.base58;
            } else {
                console.log('No wallet connected');
                return false;
            }

            // Fetch notice details from backend
            const response = await fetch(`${window.BACKEND_API_URL}/api/documents/notice/${noticeId}/receipt-data`);
            if (!response.ok) {
                throw new Error('Failed to fetch notice details');
            }

            const data = await response.json();
            this.currentNotice = data.notice;

            // Check if connected wallet is the recipient
            this.isRecipient = this.currentNotice.recipient_address?.toLowerCase() === 
                              this.recipientAddress.toLowerCase();

            return this.isRecipient;
        } catch (error) {
            console.error('Error initializing recipient view handler:', error);
            return false;
        }
    }

    /**
     * Show the signature/view-only modal for recipients
     */
    async showRecipientModal(noticeData) {
        // Check if user is the recipient
        const isRecipient = await this.initialize(noticeData.noticeId, noticeData.documentId);
        
        if (!isRecipient) {
            this.showNotRecipientMessage();
            return;
        }

        // Create modal with both options
        const modal = document.createElement('div');
        modal.id = 'recipientModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                border-radius: 12px;
                max-width: 500px;
                width: 90%;
                padding: 30px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            ">
                <h2 style="color: #333; margin-bottom: 20px;">
                    📋 Legal Document Service
                </h2>
                
                <div style="
                    background: #f0f8ff;
                    border: 2px solid #4a90e2;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 20px;
                ">
                    <p style="margin: 0; color: #333;">
                        <strong>Case Number:</strong> ${noticeData.caseNumber || 'N/A'}<br>
                        <strong>Document ID:</strong> ${noticeData.documentId}<br>
                        <strong>Served To:</strong> ${this.formatAddress(this.recipientAddress)}
                    </p>
                </div>

                <div style="
                    background: #fff3cd;
                    border: 1px solid #ffc107;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 25px;
                ">
                    <p style="margin: 0; color: #856404; font-size: 14px;">
                        <strong>⚠️ Legal Notice:</strong><br>
                        By signing, you acknowledge legal service of this document. 
                        You may also choose to view the document without signing, 
                        but this does not constitute acceptance of service.
                    </p>
                </div>

                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <button id="signAndAcceptBtn" style="
                        padding: 15px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: bold;
                        cursor: pointer;
                        transition: transform 0.2s;
                    " onmouseover="this.style.transform='scale(1.02)'" 
                       onmouseout="this.style.transform='scale(1)'">
                        ✍️ Sign and Accept Service
                    </button>

                    <button id="viewOnlyBtn" style="
                        padding: 15px;
                        background: #f8f9fa;
                        color: #333;
                        border: 2px solid #dee2e6;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: bold;
                        cursor: pointer;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#e9ecef'" 
                       onmouseout="this.style.background='#f8f9fa'">
                        👁️ View Document Only (No Signature)
                    </button>

                    <button id="declineBtn" style="
                        padding: 12px;
                        background: transparent;
                        color: #6c757d;
                        border: none;
                        font-size: 14px;
                        cursor: pointer;
                        text-decoration: underline;
                    ">
                        Cancel
                    </button>
                </div>

                <div id="modalStatus" style="
                    margin-top: 20px;
                    padding: 10px;
                    border-radius: 5px;
                    display: none;
                "></div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        document.getElementById('signAndAcceptBtn').onclick = () => {
            this.signAndAccept(noticeData);
        };

        document.getElementById('viewOnlyBtn').onclick = () => {
            this.viewOnly(noticeData);
        };

        document.getElementById('declineBtn').onclick = () => {
            this.closeModal();
        };

        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        };
    }

    /**
     * Handle sign and accept action
     */
    async signAndAccept(noticeData) {
        const statusDiv = document.getElementById('modalStatus');
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#cfe2ff';
        statusDiv.style.color = '#004085';
        statusDiv.innerHTML = '⏳ Processing signature...';

        try {
            // Call the existing signature function
            if (window.DocumentSignatureSystem) {
                await window.DocumentSignatureSystem.signDocument(
                    noticeData.documentId,
                    noticeData.ipfsHash,
                    noticeData.encryptionKey
                );
                
                statusDiv.style.background = '#d4edda';
                statusDiv.style.color = '#155724';
                statusDiv.innerHTML = '✅ Document signed successfully!';
                
                // Redirect to view after 2 seconds
                setTimeout(() => {
                    this.viewDocument(noticeData, true);
                }, 2000);
            } else {
                throw new Error('Signature system not available');
            }
        } catch (error) {
            console.error('Error signing document:', error);
            statusDiv.style.background = '#f8d7da';
            statusDiv.style.color = '#721c24';
            statusDiv.innerHTML = '❌ Error signing document: ' + error.message;
        }
    }

    /**
     * Handle view only action
     */
    async viewOnly(noticeData) {
        const statusDiv = document.getElementById('modalStatus');
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#fff3cd';
        statusDiv.style.color = '#856404';
        statusDiv.innerHTML = '📋 Opening document in view-only mode...';

        // Log the view-only access
        try {
            await this.logViewOnlyAccess(noticeData);
        } catch (error) {
            console.error('Error logging view-only access:', error);
        }

        // Open document viewer
        setTimeout(() => {
            this.viewDocument(noticeData, false);
        }, 1000);
    }

    /**
     * View the document
     */
    async viewDocument(noticeData, isSigned) {
        this.closeModal();

        // Create document viewer
        const viewer = document.createElement('div');
        viewer.id = 'documentViewer';
        viewer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: white;
            z-index: 9999;
            overflow: auto;
        `;

        viewer.innerHTML = `
            <div style="
                background: ${isSigned ? '#d4edda' : '#fff3cd'};
                border-bottom: 2px solid ${isSigned ? '#28a745' : '#ffc107'};
                padding: 15px;
                position: sticky;
                top: 0;
                z-index: 100;
            ">
                <div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; color: ${isSigned ? '#155724' : '#856404'};">
                            ${isSigned ? '✅ Document Signed and Accepted' : '👁️ View-Only Mode (Not Signed)'}
                        </h3>
                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
                            Case: ${noticeData.caseNumber} | Document ID: ${noticeData.documentId}
                        </p>
                    </div>
                    <button onclick="document.getElementById('documentViewer').remove()" style="
                        padding: 10px 20px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    ">
                        Close
                    </button>
                </div>
            </div>

            <div id="documentContent" style="
                max-width: 1200px;
                margin: 20px auto;
                padding: 20px;
            ">
                <div style="text-align: center; padding: 40px;">
                    <div class="spinner" style="
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #667eea;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto;
                    "></div>
                    <p style="margin-top: 20px; color: #666;">Loading document...</p>
                </div>
            </div>

            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        document.body.appendChild(viewer);

        // Load the document
        try {
            const response = await fetch(`${window.BACKEND_API_URL}/api/documents/${noticeData.noticeId}/images`);
            const data = await response.json();

            const contentDiv = document.getElementById('documentContent');
            contentDiv.innerHTML = '';

            if (data.documentUnencryptedUrl) {
                contentDiv.innerHTML = `
                    <img src="${data.documentUnencryptedUrl}" style="
                        max-width: 100%;
                        height: auto;
                        box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                        border-radius: 8px;
                    ">
                    
                    ${!isSigned ? `
                        <div style="
                            margin-top: 30px;
                            padding: 20px;
                            background: #f8f9fa;
                            border-radius: 8px;
                            text-align: center;
                        ">
                            <p style="color: #666; margin-bottom: 20px;">
                                You are viewing this document without signing. 
                                Would you like to sign and accept service now?
                            </p>
                            <button onclick="window.recipientViewHandler.signFromViewer('${noticeData.documentId}')" style="
                                padding: 12px 30px;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-size: 16px;
                                font-weight: bold;
                                cursor: pointer;
                            ">
                                Sign and Accept Service
                            </button>
                        </div>
                    ` : ''}
                `;
            } else {
                contentDiv.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #dc3545;">
                        <h3>Document Not Available</h3>
                        <p>The document could not be loaded. Please try again later.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading document:', error);
            document.getElementById('documentContent').innerHTML = `
                <div style="text-align: center; padding: 40px; color: #dc3545;">
                    <h3>Error Loading Document</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    /**
     * Sign from viewer
     */
    async signFromViewer(documentId) {
        // Close viewer and show signature modal again
        const viewer = document.getElementById('documentViewer');
        if (viewer) viewer.remove();
        
        // Re-show modal with signing option
        this.showRecipientModal({ documentId, noticeId: this.currentNotice.notice_id });
    }

    /**
     * Log view-only access for audit trail
     */
    async logViewOnlyAccess(noticeData) {
        try {
            await fetch(`${window.BACKEND_API_URL}/api/notices/log-view`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    noticeId: noticeData.noticeId,
                    documentId: noticeData.documentId,
                    viewerAddress: this.recipientAddress,
                    viewType: 'view_only_no_signature',
                    timestamp: new Date().toISOString()
                })
            });
        } catch (error) {
            console.error('Error logging view:', error);
        }
    }

    /**
     * Show message for non-recipients
     */
    showNotRecipientMessage() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 12px;
                max-width: 400px;
                padding: 30px;
                text-align: center;
            ">
                <h3 style="color: #dc3545; margin-bottom: 20px;">
                    🚫 Access Restricted
                </h3>
                <p style="color: #666; margin-bottom: 25px;">
                    This document can only be viewed by the intended recipient. 
                    Please connect with the wallet address that received this notice.
                </p>
                <p style="
                    background: #f8f9fa;
                    padding: 10px;
                    border-radius: 5px;
                    font-size: 12px;
                    word-break: break-all;
                    color: #666;
                ">
                    Connected: ${this.formatAddress(this.recipientAddress)}
                </p>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    margin-top: 20px;
                    padding: 10px 30px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                ">
                    Close
                </button>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Format wallet address
     */
    formatAddress(address) {
        if (!address) return 'Not Connected';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }

    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('recipientModal');
        if (modal) modal.remove();
    }
}

// Initialize global instance
window.recipientViewHandler = new RecipientViewHandler();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecipientViewHandler;
}