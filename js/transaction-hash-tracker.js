/**
 * Transaction Hash Tracker
 * Ensures all transaction hashes are properly captured and stored
 */

window.TransactionHashTracker = {
    
    /**
     * Extract transaction hash from various result formats
     */
    extractTxHash(result) {
        // Handle different formats returned by TronWeb
        if (typeof result === 'string') {
            return result;
        }
        
        // Most common: result.txid
        if (result.txid) {
            return result.txid;
        }
        
        // Alternative: result.transactionHash
        if (result.transactionHash) {
            return result.transactionHash;
        }
        
        // Legacy: result.tx
        if (result.tx) {
            return result.tx;
        }
        
        // Sometimes it's nested
        if (result.transaction?.txID) {
            return result.transaction.txID;
        }
        
        console.error('Could not extract transaction hash from result:', result);
        return null;
    },
    
    /**
     * Store transaction hash for all recipients in a batch
     */
    async storeBatchTransactionHash(txHash, recipients, caseNumber) {
        console.log(`📝 Storing transaction hash ${txHash} for ${recipients.length} recipients`);
        
        try {
            // Store locally first
            const txData = {
                txHash: txHash,
                caseNumber: caseNumber,
                recipients: recipients,
                timestamp: new Date().toISOString(),
                network: window.currentNetwork || 'mainnet'
            };
            
            // Store in localStorage for redundancy
            const key = `tx_${caseNumber}_${Date.now()}`;
            localStorage.setItem(key, JSON.stringify(txData));
            
            // Send to backend
            if (window.BACKEND_API_URL) {
                const response = await fetch(`${window.BACKEND_API_URL}/api/transactions/batch`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        txHash: txHash,
                        caseNumber: caseNumber,
                        recipients: recipients.map(r => ({
                            address: r.recipient_address || r.address || r,
                            alertId: r.alertId,
                            documentId: r.documentId
                        }))
                    })
                });
                
                if (response.ok) {
                    console.log('✅ Transaction hash stored in backend');
                } else {
                    console.warn('Failed to store in backend, but saved locally');
                }
            }
            
            return txData;
            
        } catch (error) {
            console.error('Error storing transaction hash:', error);
            return null;
        }
    },
    
    /**
     * Get transaction hash for a specific notice
     */
    async getTransactionHash(noticeId) {
        try {
            // Try backend first
            if (window.BACKEND_API_URL) {
                const response = await fetch(`${window.BACKEND_API_URL}/api/notices/${noticeId}/transaction`);
                if (response.ok) {
                    const data = await response.json();
                    return data.txHash;
                }
            }
            
            // Fall back to localStorage
            const keys = Object.keys(localStorage).filter(k => k.startsWith('tx_'));
            for (const key of keys) {
                const data = JSON.parse(localStorage.getItem(key));
                if (data.recipients?.some(r => r.alertId === noticeId || r.documentId === noticeId)) {
                    return data.txHash;
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('Error retrieving transaction hash:', error);
            return null;
        }
    },
    
    /**
     * Override transaction functions to capture hashes
     */
    initialize() {
        console.log('🔧 Initializing Transaction Hash Tracker');
        
        // Store original functions
        const originalServeNotice = window.legalContract?.serveNotice;
        const originalServeNoticeBatch = window.legalContract?.serveNoticeBatch;
        
        // Override serveNotice
        if (window.legalContract && originalServeNotice) {
            window.legalContract.serveNotice = function(...args) {
                const originalSend = originalServeNotice.apply(this, args).send;
                
                return {
                    send: async function(options) {
                        const result = await originalSend.call(this, options);
                        const txHash = TransactionHashTracker.extractTxHash(result);
                        
                        if (txHash) {
                            console.log('📋 Captured single transaction hash:', txHash);
                            // Store it
                            TransactionHashTracker.storeBatchTransactionHash(
                                txHash, 
                                [{ address: args[0] }], // First arg is recipient
                                window.currentCaseNumber || 'unknown'
                            );
                        }
                        
                        return result;
                    }
                };
            };
        }
        
        // Override serveNoticeBatch
        if (window.legalContract && originalServeNoticeBatch) {
            window.legalContract.serveNoticeBatch = function(...args) {
                const originalSend = originalServeNoticeBatch.apply(this, args).send;
                
                return {
                    send: async function(options) {
                        const result = await originalSend.call(this, options);
                        const txHash = TransactionHashTracker.extractTxHash(result);
                        
                        if (txHash) {
                            console.log('📋 Captured batch transaction hash:', txHash);
                            // Extract recipients from batch args
                            const batch = args[0];
                            const recipients = batch.map(item => ({
                                address: item[0] || item.recipient
                            }));
                            
                            TransactionHashTracker.storeBatchTransactionHash(
                                txHash,
                                recipients,
                                window.currentCaseNumber || 'unknown'
                            );
                        }
                        
                        return result;
                    }
                };
            };
        }
        
        console.log('✅ Transaction Hash Tracker initialized');
    },
    
    /**
     * Display transaction hash with Tronscan link
     */
    displayTransactionHash(txHash, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const network = window.currentNetwork || 'mainnet';
        const explorerUrl = network === 'mainnet' 
            ? 'https://tronscan.org/#/transaction/'
            : 'https://nile.tronscan.org/#/transaction/';
        
        container.innerHTML = `
            <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 12px; margin: 10px 0;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <strong style="color: #0c4a6e;">Transaction Hash:</strong>
                        <div style="font-family: monospace; font-size: 0.9em; margin-top: 4px; word-break: break-all;">
                            ${txHash}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="navigator.clipboard.writeText('${txHash}')" 
                                style="background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 8px; cursor: pointer;">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                        <a href="${explorerUrl}${txHash}" target="_blank" 
                           style="background: #0ea5e9; color: white; border-radius: 4px; padding: 4px 8px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fas fa-external-link-alt"></i> View on Tronscan
                        </a>
                    </div>
                </div>
            </div>
        `;
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        TransactionHashTracker.initialize();
    });
} else {
    TransactionHashTracker.initialize();
}

console.log('✅ Transaction Hash Tracker loaded');