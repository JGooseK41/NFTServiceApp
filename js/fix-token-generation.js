/**
 * FIX TOKEN GENERATION FOR FAILED TRANSACTIONS
 * Prevents UI from incrementing notice numbers when transactions fail
 */

console.log('🔧 Fixing token generation for failed transactions...');

(function() {
    // Track pending transactions
    const pendingTransactions = new Map();
    
    // Store original functions
    const originalSendTransaction = window.sendTransaction || function() {};
    const originalProcessTransaction = window.processTransaction || function() {};
    
    // Function to get next notice ID from blockchain
    async function getActualNextNoticeId() {
        try {
            if (window.legalContract && window.legalContract.totalSupply) {
                const totalSupply = await window.legalContract.totalSupply().call();
                const nextId = Number(totalSupply.toString()) + 1;
                console.log('Next notice ID from blockchain:', nextId);
                return nextId;
            }
        } catch (error) {
            console.error('Failed to get total supply from blockchain:', error);
        }
        return null;
    }
    
    // Function to verify transaction success
    async function verifyTransactionSuccess(txHash) {
        if (!txHash) return false;
        
        try {
            // Wait a bit for transaction to be processed
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check transaction receipt
            const receipt = await window.tronWeb.trx.getTransactionInfo(txHash);
            
            if (receipt && receipt.receipt) {
                const success = receipt.receipt.result === 'SUCCESS';
                console.log(`Transaction ${txHash} result:`, success ? 'SUCCESS' : 'FAILED');
                return success;
            }
        } catch (error) {
            console.error('Failed to verify transaction:', error);
        }
        
        return false;
    }
    
    // Override notice ID generation
    if (window.generateNoticeId) {
        const originalGenerateNoticeId = window.generateNoticeId;
        
        window.generateNoticeId = async function() {
            console.log('⚠️ Notice ID generation intercepted - waiting for blockchain confirmation');
            
            // Don't generate new ID yet - return placeholder
            return 'PENDING';
        };
    }
    
    // Intercept transaction sending
    const interceptTransaction = (originalFunc) => {
        return async function(...args) {
            console.log('📡 Transaction intercepted for validation');
            
            let transactionHash = null;
            let noticeId = null;
            
            try {
                // Call original function
                const result = await originalFunc.apply(this, args);
                
                // Extract transaction hash
                if (typeof result === 'string') {
                    transactionHash = result;
                } else if (result && result.txid) {
                    transactionHash = result.txid;
                } else if (result && result.transaction) {
                    transactionHash = result.transaction;
                }
                
                if (transactionHash) {
                    console.log('Transaction sent:', transactionHash);
                    
                    // Verify transaction success
                    const success = await verifyTransactionSuccess(transactionHash);
                    
                    if (success) {
                        // Only now get the actual notice ID from blockchain
                        noticeId = await getActualNextNoticeId();
                        
                        // Update UI with correct notice ID
                        updateUIWithNoticeId(noticeId, transactionHash);
                        
                        console.log('✅ Transaction confirmed - Notice ID:', noticeId);
                    } else {
                        console.error('❌ Transaction failed - not generating notice ID');
                        
                        // Show error to user
                        showTransactionError('Transaction failed on blockchain. No notice was created.');
                        
                        // Clear any pending UI elements
                        clearPendingNotice();
                    }
                }
                
                return result;
                
            } catch (error) {
                console.error('Transaction error:', error);
                
                // Clear any pending UI elements
                clearPendingNotice();
                
                // Show error to user
                showTransactionError('Transaction failed: ' + error.message);
                
                throw error;
            }
        };
    };
    
    // Function to update UI with confirmed notice ID
    function updateUIWithNoticeId(noticeId, txHash) {
        // Update any elements showing "PENDING"
        const pendingElements = document.querySelectorAll(':contains("PENDING")');
        pendingElements.forEach(el => {
            if (el.textContent.includes('PENDING')) {
                el.textContent = el.textContent.replace('PENDING', `#${noticeId}`);
            }
        });
        
        // Update notice display
        const noticeDisplay = document.querySelector('#currentNoticeId, .notice-id-display');
        if (noticeDisplay) {
            noticeDisplay.textContent = noticeId;
        }
        
        // Update transaction hash display
        const txDisplay = document.querySelector('.transaction-hash, #transactionHash');
        if (txDisplay) {
            txDisplay.textContent = txHash;
        }
    }
    
    // Function to clear pending notice UI
    function clearPendingNotice() {
        // Remove any pending notice displays
        const pendingElements = document.querySelectorAll(':contains("PENDING")');
        pendingElements.forEach(el => {
            if (el.textContent.includes('PENDING')) {
                el.style.display = 'none';
            }
        });
        
        // Reset form if needed
        const form = document.querySelector('#noticeForm, #serveNoticeForm');
        if (form) {
            // Don't reset - user might want to retry
            console.log('Form preserved for retry');
        }
    }
    
    // Function to show transaction error
    function showTransactionError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'transaction-error-alert';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 400px;
        `;
        errorDiv.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">
                <i class="fas fa-exclamation-triangle"></i> Transaction Failed
            </div>
            <div>${message}</div>
            <div style="margin-top: 10px; font-size: 12px;">
                No notice ID was generated. You can retry the transaction.
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto remove after 10 seconds
        setTimeout(() => {
            errorDiv.style.transition = 'opacity 0.3s';
            errorDiv.style.opacity = '0';
            setTimeout(() => errorDiv.remove(), 300);
        }, 10000);
    }
    
    // Apply intercepts
    if (window.sendTransaction) {
        window.sendTransaction = interceptTransaction(window.sendTransaction);
    }
    
    if (window.processTransaction) {
        window.processTransaction = interceptTransaction(window.processTransaction);
    }
    
    // Monitor for transaction functions being defined later
    Object.defineProperty(window, 'sendTransaction', {
        set: function(func) {
            originalSendTransaction = func;
            return interceptTransaction(func);
        },
        get: function() {
            return interceptTransaction(originalSendTransaction);
        },
        configurable: true
    });
    
    // Fix for jQuery contains selector
    if (!jQuery.expr[':'].contains) {
        jQuery.expr[':'].contains = function(elem, i, match) {
            return (elem.textContent || elem.innerText || '').indexOf(match[3]) > -1;
        };
    }
    
    console.log('✅ Token generation fixes applied');
    console.log('📝 Notice IDs will only be generated after blockchain confirmation');
})();