/**
 * Document Access Control - Frontend
 * Ensures only recipients can view documents
 */

class DocumentAccessControl {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        this.accessToken = null;
        this.walletAddress = null;
        this.isRecipient = false;
        this.publicInfo = null;
    }
    
    /**
     * Verify if connected wallet is the recipient
     */
    async verifyRecipient(walletAddress, alertTokenId, documentTokenId) {
        try {
            console.log('🔐 Verifying recipient access...');
            
            const response = await fetch(`${this.backend}/api/access/verify-recipient`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress,
                    alertTokenId,
                    documentTokenId
                })
            });
            
            const result = await response.json();
            
            this.walletAddress = walletAddress;
            this.isRecipient = result.isRecipient;
            this.isServer = result.isServer;
            this.publicInfo = result.publicInfo;
            
            if (result.accessGranted) {
                this.accessToken = result.accessToken;
                // Store token securely
                sessionStorage.setItem('doc_access_token', this.accessToken);
                sessionStorage.setItem('doc_access_expires', Date.now() + 3600000); // 1 hour
                
                if (result.isRecipient) {
                    console.log('✅ Access granted - recipient verified');
                    this.showAccessGranted('recipient');
                } else if (result.isServer) {
                    console.log('✅ Access granted - process server verified');
                    this.showAccessGranted('server');
                }
            } else {
                console.log('⚠️ Access restricted - not the recipient or server');
                this.showAccessRestricted();
            }
            
            return result;
            
        } catch (error) {
            console.error('Error verifying recipient:', error);
            return { isRecipient: false, error: error.message };
        }
    }
    
    /**
     * Get public information about a notice
     */
    async getPublicInfo(tokenId) {
        try {
            const response = await fetch(`${this.backend}/api/access/public/${tokenId}`);
            const result = await response.json();
            
            if (result.success) {
                this.publicInfo = result.publicData;
                return result.publicData;
            }
            
        } catch (error) {
            console.error('Error fetching public info:', error);
        }
    }
    
    /**
     * Get document content (requires access token)
     */
    async getDocument(documentTokenId) {
        // Check if we have a valid token
        const token = sessionStorage.getItem('doc_access_token');
        const expires = sessionStorage.getItem('doc_access_expires');
        
        if (!token || Date.now() > parseInt(expires)) {
            console.error('❌ No valid access token. Please verify your wallet first.');
            this.showVerificationRequired();
            return null;
        }
        
        try {
            const response = await fetch(
                `${this.backend}/api/access/document/${documentTokenId}`,
                {
                    headers: {
                        'X-Access-Token': token
                    }
                }
            );
            
            if (response.status === 403) {
                console.error('❌ Access denied. Token may have expired.');
                this.showVerificationRequired();
                return null;
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log('📄 Document retrieved successfully');
                return result.document;
            }
            
        } catch (error) {
            console.error('Error fetching document:', error);
        }
        
        return null;
    }
    
    /**
     * Show access granted UI
     */
    showAccessGranted(accessType = 'recipient') {
        let message;
        if (accessType === 'server') {
            message = 'You are the process server. You have full access to view the document.';
        } else {
            message = 'You are the recipient. You have full access to view and sign the document.';
        }
        
        const notification = this.createNotification(
            '✅ Access Granted',
            message,
            'success'
        );
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }
    
    /**
     * Show access restricted UI
     */
    showAccessRestricted() {
        const modal = document.createElement('div');
        modal.className = 'access-restricted-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                        background: rgba(0,0,0,0.8); z-index: 10000; 
                        display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px; border-radius: 12px; 
                            max-width: 500px; text-align: center;">
                    <h2 style="color: #ff9800; margin-bottom: 20px;">
                        ⚠️ Restricted Access
                    </h2>
                    
                    <p style="margin-bottom: 20px; color: #333;">
                        You are not the intended recipient of this legal document.
                    </p>
                    
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; 
                                text-align: left; margin-bottom: 20px;">
                        <h3 style="margin-bottom: 10px; color: #333;">
                            You CAN view:
                        </h3>
                        <ul style="color: #666; margin: 0; padding-left: 20px;">
                            <li>Alert notice (proof of service)</li>
                            <li>Case number: ${this.publicInfo?.caseNumber}</li>
                            <li>Notice type: ${this.publicInfo?.noticeType}</li>
                            <li>Issuing agency: ${this.publicInfo?.issuingAgency}</li>
                            <li>Service status</li>
                        </ul>
                    </div>
                    
                    <div style="background: #fee; padding: 15px; border-radius: 8px; 
                                text-align: left; margin-bottom: 20px;">
                        <h3 style="margin-bottom: 10px; color: #c00;">
                            You CANNOT view:
                        </h3>
                        <ul style="color: #666; margin: 0; padding-left: 20px;">
                            <li>Full document content</li>
                            <li>Confidential information</li>
                            <li>Sign or accept the document</li>
                        </ul>
                    </div>
                    
                    <div style="background: #e3f2fd; padding: 10px; border-radius: 8px; 
                                margin-bottom: 20px; font-size: 0.9em; color: #1976d2;">
                        Connected wallet: ${this.walletAddress?.substring(0, 8)}...${this.walletAddress?.slice(-6)}
                    </div>
                    
                    <button onclick="this.closest('.access-restricted-modal').remove()" 
                            style="background: #007bff; color: white; border: none; 
                                   padding: 12px 30px; border-radius: 6px; cursor: pointer; 
                                   font-size: 16px;">
                        I Understand
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    /**
     * Show verification required message
     */
    showVerificationRequired() {
        const modal = document.createElement('div');
        modal.className = 'verification-required-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                        background: rgba(0,0,0,0.8); z-index: 10000; 
                        display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px; border-radius: 12px; 
                            max-width: 400px; text-align: center;">
                    <h2 style="color: #dc3545; margin-bottom: 20px;">
                        🔒 Verification Required
                    </h2>
                    <p style="margin-bottom: 20px; color: #333;">
                        To view this document, you must verify that you are the intended recipient.
                    </p>
                    <p style="margin-bottom: 20px; color: #666; font-size: 0.9em;">
                        Please connect your wallet and verify your identity.
                    </p>
                    <button onclick="window.connectWallet()" 
                            style="background: #28a745; color: white; border: none; 
                                   padding: 12px 30px; border-radius: 6px; cursor: pointer; 
                                   font-size: 16px; margin-right: 10px;">
                        Connect Wallet
                    </button>
                    <button onclick="this.closest('.verification-required-modal').remove()" 
                            style="background: #6c757d; color: white; border: none; 
                                   padding: 12px 30px; border-radius: 6px; cursor: pointer; 
                                   font-size: 16px;">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    /**
     * Create notification element
     */
    createNotification(title, message, type = 'info') {
        const colors = {
            success: '#28a745',
            warning: '#ff9800',
            error: '#dc3545',
            info: '#007bff'
        };
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10001;
            max-width: 350px;
            animation: slideIn 0.3s ease;
        `;
        
        notification.innerHTML = `
            <strong style="display: block; margin-bottom: 5px;">${title}</strong>
            <span style="font-size: 0.9em;">${message}</span>
        `;
        
        return notification;
    }
    
    /**
     * Update notice view to respect access control
     */
    updateNoticeView(isRecipient, alertData, documentData = null) {
        const container = document.getElementById('noticeContainer');
        if (!container) return;
        
        if (isRecipient) {
            // Full access - show everything
            container.innerHTML = `
                <div class="full-access">
                    <h3>✅ Full Access Granted</h3>
                    <div class="alert-section">
                        <h4>Alert Notice</h4>
                        ${alertData ? `<img src="${alertData}" alt="Alert" />` : 'Loading...'}
                    </div>
                    <div class="document-section">
                        <h4>Legal Document</h4>
                        ${documentData ? `<img src="${documentData}" alt="Document" />` : 'Loading...'}
                    </div>
                </div>
            `;
        } else {
            // Restricted access - alert only
            container.innerHTML = `
                <div class="restricted-access">
                    <div class="alert-section">
                        <h4>Public Notice Information</h4>
                        ${alertData ? `<img src="${alertData}" alt="Alert" />` : 'Loading...'}
                    </div>
                    <div class="restricted-notice" style="background: #fff3cd; padding: 20px; 
                                border-radius: 8px; margin-top: 20px; border: 2px solid #ffc107;">
                        <h4 style="color: #856404; margin-bottom: 10px;">
                            🔒 Document Access Restricted
                        </h4>
                        <p style="color: #856404; margin: 0;">
                            The full document is only available to the intended recipient.
                            If you are the recipient, please connect your wallet to verify your identity.
                        </p>
                    </div>
                </div>
            `;
        }
    }
}

// Initialize global access control
window.documentAccessControl = new DocumentAccessControl();

// Export for use in other modules
window.DocumentAccessControl = DocumentAccessControl;