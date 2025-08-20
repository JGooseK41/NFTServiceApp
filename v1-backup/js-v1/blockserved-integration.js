/**
 * BlockServed Integration
 * Handles the recipient flow when coming from BlockServed site
 */

class BlockServedIntegration {
    constructor() {
        this.recipientHandler = window.recipientViewHandler || new RecipientViewHandler();
    }

    /**
     * Initialize when recipient arrives from BlockServed
     */
    async initialize() {
        // Check URL parameters for notice/document info
        const params = new URLSearchParams(window.location.search);
        const noticeId = params.get('noticeId');
        const documentId = params.get('documentId');
        const action = params.get('action');
        
        if (!noticeId || !documentId) {
            return; // Not a BlockServed recipient flow
        }

        // Check if wallet is connected
        if (!await this.ensureWalletConnected()) {
            this.showConnectWalletPrompt(noticeId, documentId);
            return;
        }

        // Check access rights
        const hasAccess = await this.checkAccess(noticeId, documentId);
        
        if (!hasAccess) {
            this.showAccessDenied();
            return;
        }

        // Show the recipient modal with sign/view options
        if (action === 'sign') {
            this.showRecipientOptions(noticeId, documentId);
        } else if (action === 'view') {
            this.viewDocumentOnly(noticeId, documentId);
        }
    }

    /**
     * Ensure wallet is connected
     */
    async ensureWalletConnected() {
        if (typeof window.tronWeb !== 'undefined' && window.tronWeb.defaultAddress.base58) {
            return true;
        }

        // Try to connect
        if (window.tronLink) {
            try {
                const res = await window.tronLink.request({ method: 'tron_requestAccounts' });
                if (res.code === 200) {
                    // Wait for tronWeb to be ready
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return window.tronWeb && window.tronWeb.defaultAddress.base58;
                }
            } catch (error) {
                console.error('Error connecting wallet:', error);
            }
        }

        return false;
    }

    /**
     * Check if connected wallet has access to the document
     */
    async checkAccess(noticeId, documentId) {
        try {
            const walletAddress = window.tronWeb.defaultAddress.base58;
            
            const response = await fetch(`${window.BACKEND_API_URL}/api/notices/check-access`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    noticeId,
                    documentId,
                    walletAddress
                })
            });

            const data = await response.json();
            this.accessData = data;
            
            return data.hasAccess && data.isRecipient;
        } catch (error) {
            console.error('Error checking access:', error);
            return false;
        }
    }

    /**
     * Show recipient options modal
     */
    showRecipientOptions(noticeId, documentId) {
        const modal = document.createElement('div');
        modal.id = 'blockservedModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;

        const modalContent = `
            <div class="modal-content" style="
                background: white;
                border-radius: 16px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: slideUp 0.3s ease;
                overflow: hidden;
            ">
                <div style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 25px;
                    color: white;
                ">
                    <h2 style="margin: 0; font-size: 24px;">
                        📜 Legal Document Service
                    </h2>
                    <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">
                        You have been served a legal document
                    </p>
                </div>

                <div style="padding: 25px;">
                    <div style="
                        background: #f8f9fa;
                        border-radius: 8px;
                        padding: 15px;
                        margin-bottom: 20px;
                    ">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span style="color: #6c757d;">Case Number:</span>
                            <strong>${this.accessData?.notice?.caseNumber || 'Loading...'}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #6c757d;">Document ID:</span>
                            <strong style="font-size: 12px;">${documentId}</strong>
                        </div>
                    </div>

                    ${this.accessData?.isSigned ? `
                        <div style="
                            background: #d4edda;
                            border: 1px solid #c3e6cb;
                            border-radius: 8px;
                            padding: 15px;
                            margin-bottom: 20px;
                        ">
                            <p style="margin: 0; color: #155724;">
                                ✅ <strong>Already Signed</strong><br>
                                <span style="font-size: 14px;">
                                    You signed this document on ${new Date(this.accessData.signedAt).toLocaleDateString()}
                                </span>
                            </p>
                        </div>
                    ` : `
                        <div style="
                            background: #fff3cd;
                            border: 1px solid #ffeeba;
                            border-radius: 8px;
                            padding: 15px;
                            margin-bottom: 25px;
                        ">
                            <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                                <strong>⚖️ Legal Notice:</strong><br>
                                By signing, you legally acknowledge receipt and acceptance of service for this document. 
                                You may also view the document without signing, which does not constitute legal acceptance.
                            </p>
                        </div>
                    `}

                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${!this.accessData?.isSigned ? `
                            <button onclick="blockServedIntegration.signDocument('${noticeId}', '${documentId}')" style="
                                padding: 16px;
                                background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                                color: white;
                                border: none;
                                border-radius: 10px;
                                font-size: 16px;
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.3s;
                                box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
                            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(40, 167, 69, 0.4)'" 
                               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(40, 167, 69, 0.3)'">
                                ✍️ Sign and Accept Service
                            </button>
                        ` : ''}

                        <button onclick="blockServedIntegration.viewDocument('${noticeId}', '${documentId}')" style="
                            padding: 16px;
                            background: white;
                            color: #495057;
                            border: 2px solid #dee2e6;
                            border-radius: 10px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s;
                        " onmouseover="this.style.background='#f8f9fa'; this.style.borderColor='#adb5bd'" 
                           onmouseout="this.style.background='white'; this.style.borderColor='#dee2e6'">
                            👁️ View Document ${this.accessData?.isSigned ? '' : 'Only (No Signature)'}
                        </button>

                        <button onclick="blockServedIntegration.closeModal()" style="
                            padding: 12px;
                            background: transparent;
                            color: #6c757d;
                            border: none;
                            font-size: 14px;
                            cursor: pointer;
                            text-decoration: underline;
                            margin-top: 8px;
                        ">
                            Cancel
                        </button>
                    </div>
                </div>

                <div id="modalStatus" style="
                    margin: 0 25px 25px 25px;
                    padding: 15px;
                    border-radius: 8px;
                    display: none;
                    animation: fadeIn 0.3s ease;
                "></div>
            </div>

            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            </style>
        `;

        modal.innerHTML = modalContent;
        document.body.appendChild(modal);

        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        };
    }

    /**
     * Sign the document
     */
    async signDocument(noticeId, documentId) {
        const statusDiv = document.getElementById('modalStatus');
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#cfe2ff';
            statusDiv.style.color = '#004085';
            statusDiv.innerHTML = '⏳ Processing signature...';
        }

        try {
            // Call the document signature system
            if (window.DocumentSignatureSystem) {
                await window.DocumentSignatureSystem.signDocument(
                    documentId,
                    this.accessData?.notice?.ipfsHash,
                    this.accessData?.notice?.encryptionKey
                );
                
                if (statusDiv) {
                    statusDiv.style.background = '#d4edda';
                    statusDiv.style.color = '#155724';
                    statusDiv.innerHTML = '✅ Document signed successfully! Redirecting...';
                }
                
                // Redirect to view after success
                setTimeout(() => {
                    this.viewDocument(noticeId, documentId, true);
                }, 2000);
            }
        } catch (error) {
            console.error('Error signing:', error);
            if (statusDiv) {
                statusDiv.style.background = '#f8d7da';
                statusDiv.style.color = '#721c24';
                statusDiv.innerHTML = '❌ Error: ' + error.message;
            }
        }
    }

    /**
     * View the document
     */
    async viewDocument(noticeId, documentId, justSigned = false) {
        // Log view-only access if not signed
        if (!this.accessData?.isSigned && !justSigned) {
            await this.logViewAccess(noticeId, documentId);
        }

        // Close modal
        this.closeModal();

        // Use the recipient view handler to display the document
        this.recipientHandler.viewDocument({
            noticeId,
            documentId,
            caseNumber: this.accessData?.notice?.caseNumber
        }, justSigned || this.accessData?.isSigned);
    }

    /**
     * Log view-only access
     */
    async logViewAccess(noticeId, documentId) {
        try {
            await fetch(`${window.BACKEND_API_URL}/api/notices/log-view`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    noticeId,
                    documentId,
                    viewerAddress: window.tronWeb.defaultAddress.base58,
                    viewType: 'view_only_no_signature',
                    timestamp: new Date().toISOString()
                })
            });
        } catch (error) {
            console.error('Error logging view:', error);
        }
    }

    /**
     * Show wallet connection prompt
     */
    showConnectWalletPrompt(noticeId, documentId) {
        const prompt = document.createElement('div');
        prompt.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            z-index: 10000;
            text-align: center;
            max-width: 400px;
        `;

        prompt.innerHTML = `
            <h3 style="color: #333; margin-bottom: 20px;">
                🔌 Connect Your Wallet
            </h3>
            <p style="color: #666; margin-bottom: 25px;">
                To view this legal document, please connect the wallet 
                that received the notice.
            </p>
            <button onclick="location.reload()" style="
                padding: 12px 30px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
            ">
                Connect Wallet
            </button>
        `;

        document.body.appendChild(prompt);
    }

    /**
     * Show access denied message
     */
    showAccessDenied() {
        const denied = document.createElement('div');
        denied.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            z-index: 10000;
            text-align: center;
            max-width: 400px;
        `;

        denied.innerHTML = `
            <h3 style="color: #dc3545; margin-bottom: 20px;">
                🚫 Access Denied
            </h3>
            <p style="color: #666; margin-bottom: 25px;">
                This document can only be viewed by the recipient wallet address.
                Please ensure you're connected with the correct wallet.
            </p>
            <button onclick="this.parentElement.remove()" style="
                padding: 12px 30px;
                background: #6c757d;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
            ">
                Close
            </button>
        `;

        document.body.appendChild(denied);
    }

    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('blockservedModal');
        if (modal) modal.remove();
    }
}

// Initialize on page load
window.blockServedIntegration = new BlockServedIntegration();

// Auto-initialize if coming from BlockServed
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('noticeId') && params.has('documentId')) {
        window.blockServedIntegration.initialize();
    }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlockServedIntegration;
}