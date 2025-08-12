/**
 * Audit Tracker - Frontend module to track all recipient interactions
 */

class AuditTracker {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        this.sessionId = this.getOrCreateSessionId();
        this.currentTokens = null;
        this.walletAddress = null;
        this.trackingEnabled = true;
    }
    
    /**
     * Get or create a session ID for this user
     */
    getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('audit_session_id');
        if (!sessionId) {
            sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('audit_session_id', sessionId);
        }
        return sessionId;
    }
    
    /**
     * Track notice view event
     */
    async trackView(alertTokenId, documentTokenId, viewType = 'direct_link') {
        if (!this.trackingEnabled) return;
        
        try {
            this.currentTokens = { alertTokenId, documentTokenId };
            
            const response = await fetch(`${this.backend}/api/audit/view`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alertTokenId,
                    documentTokenId,
                    sessionId: this.sessionId,
                    viewType,
                    referrer: document.referrer
                })
            });
            
            const result = await response.json();
            console.log('📊 View tracked:', result);
            
            // Store view timestamp
            sessionStorage.setItem(`viewed_${alertTokenId}`, Date.now());
            
            return result;
        } catch (error) {
            console.error('Failed to track view:', error);
        }
    }
    
    /**
     * Track wallet connection
     */
    async trackWalletConnect(walletAddress, network = 'tron_mainnet') {
        if (!this.trackingEnabled || !this.currentTokens) return;
        
        try {
            this.walletAddress = walletAddress;
            
            const response = await fetch(`${this.backend}/api/audit/wallet-connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress,
                    alertTokenId: this.currentTokens.alertTokenId,
                    documentTokenId: this.currentTokens.documentTokenId,
                    sessionId: this.sessionId,
                    network,
                    walletType: this.detectWalletType(),
                    connectionMethod: this.detectConnectionMethod()
                })
            });
            
            const result = await response.json();
            console.log('👛 Wallet connection tracked:', result);
            
            // Store connection info
            sessionStorage.setItem('wallet_connected', walletAddress);
            sessionStorage.setItem('is_recipient', result.isRecipient);
            
            // Show UI feedback if not the recipient
            if (!result.isRecipient) {
                this.showRecipientWarning(walletAddress);
            }
            
            return result;
        } catch (error) {
            console.error('Failed to track wallet connection:', error);
        }
    }
    
    /**
     * Track signature attempt
     */
    async trackSignatureAttempt(documentTokenId, alertTokenId, walletAddress) {
        if (!this.trackingEnabled) return;
        
        try {
            const response = await fetch(`${this.backend}/api/audit/sign-attempt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentTokenId,
                    alertTokenId,
                    walletAddress,
                    sessionId: this.sessionId,
                    status: 'initiated'
                })
            });
            
            const result = await response.json();
            console.log('✍️ Signature attempt tracked:', result);
            
            // Store attempt ID for completion tracking
            sessionStorage.setItem('current_attempt_id', result.attemptId);
            
            return result;
        } catch (error) {
            console.error('Failed to track signature attempt:', error);
        }
    }
    
    /**
     * Track successful signature
     */
    async trackSignatureComplete(transactionHash, documentTokenId, alertTokenId) {
        if (!this.trackingEnabled) return;
        
        try {
            const attemptId = sessionStorage.getItem('current_attempt_id');
            
            const response = await fetch(`${this.backend}/api/audit/sign-complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attemptId,
                    documentTokenId,
                    alertTokenId,
                    walletAddress: this.walletAddress,
                    transactionHash,
                    sessionId: this.sessionId
                })
            });
            
            const result = await response.json();
            console.log('✅ Signature completion tracked:', result);
            
            // Clear attempt ID
            sessionStorage.removeItem('current_attempt_id');
            
            return result;
        } catch (error) {
            console.error('Failed to track signature completion:', error);
        }
    }
    
    /**
     * Get recipient journey for a notice
     */
    async getRecipientJourney(alertTokenId) {
        try {
            const response = await fetch(`${this.backend}/api/audit/journey/${alertTokenId}`);
            const result = await response.json();
            
            if (result.success) {
                console.log('📈 Recipient journey:', result);
                return result;
            }
        } catch (error) {
            console.error('Failed to get journey:', error);
        }
    }
    
    /**
     * Get engagement statistics for a case
     */
    async getCaseStats(caseNumber) {
        try {
            const response = await fetch(`${this.backend}/api/audit/stats/${caseNumber}`);
            const result = await response.json();
            
            if (result.success) {
                console.log('📊 Case statistics:', result.stats);
                return result.stats;
            }
        } catch (error) {
            console.error('Failed to get case stats:', error);
        }
    }
    
    /**
     * Detect wallet type
     */
    detectWalletType() {
        if (window.tronWeb && window.tronWeb.defaultAddress) {
            if (window.tronLink) return 'tronlink';
            if (window.tronWeb.isTronLink) return 'tronlink';
        }
        return 'unknown';
    }
    
    /**
     * Detect connection method
     */
    detectConnectionMethod() {
        if (window.innerWidth <= 768) {
            return 'mobile_app';
        }
        if (window.tronLink) {
            return 'browser_extension';
        }
        return 'unknown';
    }
    
    /**
     * Show warning if connected wallet is not the recipient
     */
    showRecipientWarning(walletAddress) {
        const warning = document.createElement('div');
        warning.className = 'audit-warning';
        warning.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; background: #ff9800; color: white; 
                        padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); 
                        z-index: 10000; max-width: 350px;">
                <strong>⚠️ Notice:</strong><br>
                The connected wallet (${walletAddress.substring(0, 6)}...${walletAddress.slice(-4)}) 
                is not the intended recipient of this notice. You can view the notice but cannot sign for it.
                <button onclick="this.parentElement.remove()" 
                        style="float: right; background: none; border: none; color: white; 
                               font-size: 20px; cursor: pointer; margin-top: -10px;">×</button>
            </div>
        `;
        document.body.appendChild(warning);
        
        // Auto-remove after 10 seconds
        setTimeout(() => warning.remove(), 10000);
    }
    
    /**
     * Track page visibility changes
     */
    setupVisibilityTracking() {
        let startTime = Date.now();
        let totalTime = 0;
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden, calculate time spent
                totalTime += Date.now() - startTime;
                
                if (this.currentTokens) {
                    sessionStorage.setItem(
                        `time_spent_${this.currentTokens.alertTokenId}`, 
                        totalTime
                    );
                }
            } else {
                // Page is visible again
                startTime = Date.now();
            }
        });
        
        // Track before page unload
        window.addEventListener('beforeunload', () => {
            totalTime += Date.now() - startTime;
            if (this.currentTokens) {
                sessionStorage.setItem(
                    `time_spent_${this.currentTokens.alertTokenId}`, 
                    totalTime
                );
            }
        });
    }
    
    /**
     * Initialize tracking for current page
     */
    init() {
        this.setupVisibilityTracking();
        
        // Auto-track if we're on a notice view page
        const urlParams = new URLSearchParams(window.location.search);
        const alertId = urlParams.get('alert');
        const docId = urlParams.get('doc');
        
        if (alertId || docId) {
            this.trackView(alertId, docId, 'direct_link');
        }
        
        console.log('📊 Audit Tracker initialized');
        console.log('Session ID:', this.sessionId);
    }
}

// Initialize global audit tracker
window.auditTracker = new AuditTracker();
window.auditTracker.init();

// Export for use in other modules
window.AuditTracker = AuditTracker;