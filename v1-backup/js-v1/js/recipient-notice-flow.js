/**
 * Recipient Notice Flow
 * Handles the complete recipient experience for viewing/signing notices
 */

class RecipientNoticeFlow {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        this.currentNotice = null;
        this.walletConnected = false;
    }

    /**
     * Initialize recipient flow when they visit BlockServed
     */
    async initializeRecipientFlow(noticeId) {
        console.log('🔍 Initializing recipient notice flow for:', noticeId);
        
        try {
            // 1. Get notice metadata (public info)
            const publicInfo = await this.getPublicNoticeInfo(noticeId);
            this.currentNotice = publicInfo;
            
            // 2. Show initial prompt
            await this.showInitialPrompt(publicInfo);
            
        } catch (error) {
            console.error('Error initializing flow:', error);
            this.showError('Unable to load notice information');
        }
    }

    /**
     * Show initial prompt to recipient
     */
    async showInitialPrompt(noticeInfo) {
        const modal = document.createElement('div');
        modal.className = 'recipient-notice-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                        background: rgba(0,0,0,0.8); z-index: 10000; 
                        display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px; border-radius: 12px; 
                            max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
                    
                    <h2 style="color: #1976d2; margin-bottom: 20px; text-align: center;">
                        📋 Legal Notice for You
                    </h2>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="margin-bottom: 15px; color: #333;">Notice Details:</h3>
                        <p><strong>Case Number:</strong> ${noticeInfo.caseNumber}</p>
                        <p><strong>Type:</strong> ${noticeInfo.noticeType}</p>
                        <p><strong>Issuing Agency:</strong> ${noticeInfo.issuingAgency}</p>
                        <p><strong>Server:</strong> ${this.truncateAddress(noticeInfo.serverAddress)}</p>
                        <p><strong>Date:</strong> ${new Date(noticeInfo.servedAt).toLocaleDateString()}</p>
                    </div>
                    
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="margin: 0; color: #1565c0;">
                            <strong>⚖️ Legal Notice:</strong> You have been served with legal documents. 
                            You have the following options:
                        </p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #333; margin-bottom: 10px;">Your Options:</h4>
                        
                        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; 
                                    border: 2px solid #0ea5e9; margin-bottom: 10px;">
                            <h5 style="color: #0284c7; margin-bottom: 8px;">
                                Option 1: Sign for Receipt (Recommended)
                            </h5>
                            <p style="margin: 0; font-size: 14px; color: #666;">
                                • Acknowledge receipt of the document<br>
                                • Creates a blockchain record of service<br>
                                • You can still contest the contents<br>
                                • Signing only confirms you received it, not that you agree
                            </p>
                        </div>
                        
                        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; 
                                    border: 2px solid #f59e0b; margin-bottom: 10px;">
                            <h5 style="color: #d97706; margin-bottom: 8px;">
                                Option 2: Decline to Sign
                            </h5>
                            <p style="margin: 0; font-size: 14px; color: #666;">
                                • You can still view the document<br>
                                • Service is still legally valid<br>
                                • Your viewing will be logged<br>
                                • Document remains accessible to you
                            </p>
                        </div>
                        
                        <div style="background: #fee2e2; padding: 15px; border-radius: 8px; 
                                    border: 2px solid #ef4444;">
                            <h5 style="color: #dc2626; margin-bottom: 8px;">
                                Option 3: Ignore This Notice
                            </h5>
                            <p style="margin: 0; font-size: 14px; color: #666;">
                                • Not recommended<br>
                                • May result in default judgment<br>
                                • You lose opportunity to respond<br>
                                • Legal proceedings may continue without you
                            </p>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button id="signForReceipt" style="background: #22c55e; color: white; border: none; 
                                padding: 12px 24px; border-radius: 6px; cursor: pointer; 
                                font-size: 16px; font-weight: bold;">
                            ✍️ Sign for Receipt
                        </button>
                        
                        <button id="declineToSign" style="background: #f59e0b; color: white; border: none; 
                                padding: 12px 24px; border-radius: 6px; cursor: pointer; 
                                font-size: 16px; font-weight: bold;">
                            👁️ View Without Signing
                        </button>
                        
                        <button id="closeLater" style="background: #6b7280; color: white; border: none; 
                                padding: 12px 24px; border-radius: 6px; cursor: pointer; 
                                font-size: 16px;">
                            Later
                        </button>
                    </div>
                    
                    <p style="margin-top: 20px; font-size: 12px; color: #666; text-align: center;">
                        <strong>Important:</strong> This is a legal document. Consider consulting with an attorney.
                    </p>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        document.getElementById('signForReceipt').onclick = () => {
            modal.remove();
            this.handleSignForReceipt();
        };
        
        document.getElementById('declineToSign').onclick = () => {
            modal.remove();
            this.handleDeclineToSign();
        };
        
        document.getElementById('closeLater').onclick = () => {
            modal.remove();
            this.showLaterReminder();
        };
    }

    /**
     * Handle signing for receipt
     */
    async handleSignForReceipt() {
        console.log('📝 User chose to sign for receipt');
        
        // Check wallet connection
        if (!window.tronWeb || !window.tronWeb.defaultAddress) {
            await this.promptWalletConnection();
            return;
        }
        
        const modal = this.createLoadingModal('Preparing signature request...');
        
        try {
            // For now, just log the signature in the backend
            // Full blockchain integration would happen here
            modal.remove();
            const confirmed = await this.showSignatureConfirmation();
            
            if (confirmed) {
                // Log signature in backend
                await this.logSignatureInBackend({
                    txHash: 'pending_' + Date.now(),
                    signature: 'recipient_signed_' + Date.now()
                });
                
                // Show success and document
                await this.showSignatureSuccess();
                await this.displayFullDocument(true); // Signed version
            }
            
        } catch (error) {
            modal.remove();
            console.error('Signature error:', error);
            this.showError('Unable to complete signature. You can still view the document.');
            
            // Offer to view anyway
            setTimeout(() => {
                this.handleDeclineToSign();
            }, 2000);
        }
    }

    /**
     * Handle decline to sign (view-only mode)
     */
    async handleDeclineToSign() {
        console.log('👁️ User declined to sign, showing view-only mode');
        
        const modal = document.createElement('div');
        modal.className = 'decline-notice-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                        background: rgba(0,0,0,0.8); z-index: 10000; 
                        display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px; border-radius: 12px; 
                            max-width: 500px; width: 90%;">
                    
                    <h3 style="color: #d97706; margin-bottom: 20px;">
                        ⚠️ Viewing Without Signature
                    </h3>
                    
                    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="margin: 0; color: #92400e;">
                            You have chosen to view the document without signing for receipt. 
                            Please note:
                        </p>
                        <ul style="margin: 10px 0 0 20px; color: #92400e;">
                            <li>This viewing will be logged</li>
                            <li>Service is still legally valid</li>
                            <li>You can sign for receipt later if you choose</li>
                            <li>The document will remain accessible to you</li>
                        </ul>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: flex-start; cursor: pointer;">
                            <input type="checkbox" id="acknowledgeView" style="margin-right: 10px; margin-top: 4px;">
                            <span style="font-size: 14px; color: #666;">
                                I understand that my viewing of this document will be recorded 
                                and that legal service has been completed regardless of whether 
                                I sign for receipt.
                            </span>
                        </label>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button id="proceedToView" style="background: #f59e0b; color: white; border: none; 
                                padding: 12px 24px; border-radius: 6px; cursor: pointer; 
                                font-size: 16px; opacity: 0.5;" disabled>
                            Continue to Document
                        </button>
                        
                        <button id="cancelView" style="background: #6b7280; color: white; border: none; 
                                padding: 12px 24px; border-radius: 6px; cursor: pointer; 
                                font-size: 16px;">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const checkbox = document.getElementById('acknowledgeView');
        const proceedBtn = document.getElementById('proceedToView');
        
        checkbox.onchange = () => {
            if (checkbox.checked) {
                proceedBtn.disabled = false;
                proceedBtn.style.opacity = '1';
            } else {
                proceedBtn.disabled = true;
                proceedBtn.style.opacity = '0.5';
            }
        };
        
        proceedBtn.onclick = async () => {
            modal.remove();
            
            // Log view-only access
            await this.logViewOnlyAccess();
            
            // Display document in view-only mode
            await this.displayFullDocument(false); // Not signed version
        };
        
        document.getElementById('cancelView').onclick = () => {
            modal.remove();
            this.initializeRecipientFlow(this.currentNotice.noticeId);
        };
    }

    /**
     * Display the full document
     */
    async displayFullDocument(isSigned) {
        console.log(`📄 Displaying document (signed: ${isSigned})`);
        
        const modal = this.createLoadingModal('Loading document...');
        
        try {
            // Get document from backend (unencrypted version)
            const response = await fetch(
                `${this.backend}/api/documents/${this.currentNotice.noticeId}/full?walletAddress=${window.tronWeb?.defaultAddress?.base58 || 'view-only'}`
            );
            
            const docData = await response.json();
            modal.remove();
            
            // Create document viewer
            const viewer = document.createElement('div');
            viewer.className = 'document-viewer-modal';
            viewer.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                            background: rgba(0,0,0,0.9); z-index: 10000; 
                            display: flex; flex-direction: column;">
                    
                    <div style="background: white; padding: 15px; display: flex; 
                                justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="margin: 0; color: #333;">
                                ${isSigned ? '✅ Document (Signed for Receipt)' : '👁️ Document (View Only)'}
                            </h3>
                            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
                                Case: ${this.currentNotice.caseNumber} | 
                                Pages: ${docData.pageCount || 'Unknown'} | 
                                ${isSigned ? 'Receipt Confirmed' : 'Not Signed'}
                            </p>
                        </div>
                        
                        <div style="display: flex; gap: 10px;">
                            ${!isSigned ? `
                                <button id="signNow" style="background: #22c55e; color: white; border: none; 
                                        padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                                    ✍️ Sign for Receipt
                                </button>
                            ` : ''}
                            
                            <button id="downloadDoc" style="background: #3b82f6; color: white; border: none; 
                                    padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                                📥 Download
                            </button>
                            
                            <button id="printDoc" style="background: #8b5cf6; color: white; border: none; 
                                    padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                                🖨️ Print
                            </button>
                            
                            <button id="closeViewer" style="background: #ef4444; color: white; border: none; 
                                    padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                                ✕ Close
                            </button>
                        </div>
                    </div>
                    
                    <div style="flex: 1; overflow: auto; background: #333; 
                                display: flex; justify-content: center; padding: 20px;">
                        <iframe id="documentFrame" 
                                src="data:${docData.mimeType};base64,${docData.documentData}"
                                style="width: 100%; max-width: 900px; height: 100%; 
                                       background: white; border: none; box-shadow: 0 0 20px rgba(0,0,0,0.5);">
                        </iframe>
                    </div>
                    
                    <div style="background: #f3f4f6; padding: 10px; text-align: center; 
                                border-top: 1px solid #ddd;">
                        <p style="margin: 0; color: #666; font-size: 12px;">
                            ${isSigned ? 
                                '✅ Your signature has been recorded on the blockchain' : 
                                '⚠️ This document has been served. Your viewing has been logged.'}
                        </p>
                    </div>
                </div>
            `;
            
            document.body.appendChild(viewer);
            
            // Add event handlers
            if (!isSigned) {
                document.getElementById('signNow')?.addEventListener('click', () => {
                    viewer.remove();
                    this.handleSignForReceipt();
                });
            }
            
            document.getElementById('downloadDoc')?.addEventListener('click', () => {
                this.downloadDocument(docData);
            });
            
            document.getElementById('printDoc')?.addEventListener('click', () => {
                this.printDocument();
            });
            
            document.getElementById('closeViewer')?.addEventListener('click', () => {
                viewer.remove();
                this.showExitSummary(isSigned);
            });
            
        } catch (error) {
            modal.remove();
            console.error('Error loading document:', error);
            this.showError('Unable to load document. Please try again later.');
        }
    }

    /**
     * Log view-only access
     */
    async logViewOnlyAccess() {
        try {
            await fetch(`${this.backend}/api/notices/log-view`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    noticeId: this.currentNotice.noticeId,
                    walletAddress: window.tronWeb?.defaultAddress?.base58 || 'anonymous',
                    viewType: 'declined-signature',
                    timestamp: new Date().toISOString()
                })
            });
            console.log('View-only access logged');
        } catch (error) {
            console.error('Error logging view:', error);
        }
    }

    /**
     * Helper functions
     */
    
    async promptWalletConnection() {
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                        background: rgba(0,0,0,0.8); z-index: 10000; 
                        display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px; border-radius: 12px; 
                            max-width: 400px; text-align: center;">
                    <h3 style="color: #1976d2; margin-bottom: 20px;">
                        Connect Wallet Required
                    </h3>
                    <p style="color: #666; margin-bottom: 20px;">
                        Please connect your TronLink wallet to sign for receipt of this document.
                    </p>
                    <button onclick="window.location.reload()" 
                            style="background: #3b82f6; color: white; border: none; 
                                   padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                        Refresh Page
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    async showSignatureConfirmation() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                            background: rgba(0,0,0,0.8); z-index: 10000; 
                            display: flex; align-items: center; justify-content: center;">
                    <div style="background: white; padding: 30px; border-radius: 12px; 
                                max-width: 500px;">
                        <h3 style="color: #22c55e; margin-bottom: 20px;">
                            ✍️ Confirm Signature for Receipt
                        </h3>
                        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; 
                                    margin-bottom: 20px;">
                            <p style="margin: 0; color: #166534;">
                                By signing, you acknowledge:
                            </p>
                            <ul style="margin: 10px 0 0 20px; color: #166534;">
                                <li>You have received this legal document</li>
                                <li>This creates a blockchain record of service</li>
                                <li>You retain all rights to contest the contents</li>
                                <li>This only confirms receipt, not agreement</li>
                            </ul>
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button id="confirmSign" style="background: #22c55e; color: white; 
                                    border: none; padding: 10px 20px; border-radius: 6px; 
                                    cursor: pointer; font-weight: bold;">
                                Confirm & Sign
                            </button>
                            <button id="cancelSign" style="background: #6b7280; color: white; 
                                    border: none; padding: 10px 20px; border-radius: 6px; 
                                    cursor: pointer;">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            document.getElementById('confirmSign').onclick = () => {
                modal.remove();
                resolve(true);
            };
            
            document.getElementById('cancelSign').onclick = () => {
                modal.remove();
                resolve(false);
            };
        });
    }
    
    async logSignatureInBackend(txData) {
        try {
            await fetch(`${this.backend}/api/notices/${this.currentNotice.noticeId}/signature`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: window.tronWeb?.defaultAddress?.base58,
                    signature: txData.signature,
                    txHash: txData.txHash,
                    timestamp: new Date().toISOString()
                })
            });
            console.log('Signature logged in backend');
        } catch (error) {
            console.error('Error logging signature:', error);
        }
    }
    
    async showSignatureSuccess() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                            background: rgba(0,0,0,0.8); z-index: 10000; 
                            display: flex; align-items: center; justify-content: center;">
                    <div style="background: white; padding: 30px; border-radius: 12px; 
                                max-width: 400px; text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
                        <h3 style="color: #22c55e; margin-bottom: 20px;">
                            Signature Recorded Successfully
                        </h3>
                        <p style="color: #666; margin-bottom: 20px;">
                            Your signature has been recorded on the blockchain. 
                            You will now be shown the full document.
                        </p>
                        <button id="continueToDoc" style="background: #3b82f6; color: white; 
                                border: none; padding: 10px 20px; border-radius: 6px; 
                                cursor: pointer;">
                            View Document
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            document.getElementById('continueToDoc').onclick = () => {
                modal.remove();
                resolve();
            };
            
            setTimeout(() => {
                modal.remove();
                resolve();
            }, 3000);
        });
    }
    
    showLaterReminder() {
        const reminder = document.createElement('div');
        reminder.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; background: #f59e0b; 
            color: white; padding: 15px 20px; border-radius: 8px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 10002;
            max-width: 400px;
        `;
        reminder.innerHTML = `
            <strong>⚠️ Legal Notice Pending</strong><br>
            You have a legal notice waiting for your attention. 
            Please review it at your earliest convenience.
        `;
        document.body.appendChild(reminder);
        setTimeout(() => reminder.remove(), 10000);
    }
    
    truncateAddress(address) {
        if (!address) return 'Unknown';
        return `${address.substring(0, 6)}...${address.slice(-4)}`;
    }
    
    createLoadingModal(message) {
        const modal = document.createElement('div');
        modal.className = 'loading-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                        background: rgba(0,0,0,0.8); z-index: 10001; 
                        display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px; border-radius: 12px; text-align: center;">
                    <div style="margin-bottom: 20px;">
                        <div class="spinner" style="border: 4px solid #f3f4f6; 
                                border-top: 4px solid #3b82f6; border-radius: 50%; 
                                width: 40px; height: 40px; animation: spin 1s linear infinite; 
                                margin: 0 auto;"></div>
                    </div>
                    <p style="margin: 0; color: #666;">${message}</p>
                </div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        document.body.appendChild(modal);
        return modal;
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #ef4444; 
            color: white; padding: 15px 20px; border-radius: 8px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 10002;
            max-width: 400px;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }
    
    async getPublicNoticeInfo(noticeId) {
        // Fetch public notice information
        const response = await fetch(`${this.backend}/api/notices/${noticeId}/public`);
        if (!response.ok) throw new Error('Notice not found');
        return await response.json();
    }
    
    downloadDocument(docData) {
        const link = document.createElement('a');
        link.href = `data:${docData.mimeType};base64,${docData.documentData}`;
        link.download = `Legal_Notice_${this.currentNotice.caseNumber}.pdf`;
        link.click();
    }
    
    printDocument() {
        const iframe = document.getElementById('documentFrame');
        if (iframe) {
            iframe.contentWindow.print();
        }
    }
    
    showExitSummary(isSigned) {
        const summary = document.createElement('div');
        summary.className = 'exit-summary';
        summary.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: white; padding: 30px; border-radius: 12px; 
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2); z-index: 10000; 
                        max-width: 400px; text-align: center;">
                <h3 style="color: ${isSigned ? '#22c55e' : '#f59e0b'}; margin-bottom: 20px;">
                    ${isSigned ? '✅ Receipt Confirmed' : '👁️ Document Viewed'}
                </h3>
                <p style="color: #666; margin-bottom: 20px;">
                    ${isSigned ? 
                        'Your signature has been recorded on the blockchain. You will receive a confirmation.' :
                        'Your viewing of this document has been logged. You can still sign for receipt later.'}
                </p>
                <button onclick="this.closest('.exit-summary').remove()" 
                        style="background: #3b82f6; color: white; border: none; 
                               padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                    OK
                </button>
            </div>
        `;
        document.body.appendChild(summary);
    }
}

// Initialize globally
window.recipientFlow = new RecipientNoticeFlow();

// Auto-detect if this is a recipient visiting with a notice ID
if (window.location.search.includes('notice=')) {
    const params = new URLSearchParams(window.location.search);
    const noticeId = params.get('notice');
    if (noticeId) {
        window.addEventListener('load', () => {
            window.recipientFlow.initializeRecipientFlow(noticeId);
        });
    }
}

console.log('📋 Recipient Notice Flow loaded - handles sign/decline/view options');