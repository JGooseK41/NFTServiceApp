// Pending Transactions Management System
// Saves incomplete NFT deliveries for later completion

const PendingTransactions = {
    // Storage key for localStorage
    STORAGE_KEY: 'pendingNFTDeliveries',
    
    // Initialize the system
    init() {
        // Check for pending transactions on load
        this.checkPendingTransactions();
        
        // Set up periodic check
        setInterval(() => this.checkPendingTransactions(), 60000); // Check every minute
        
        console.log('Pending transactions system initialized');
    },
    
    // Save a pending transaction
    savePending(transactionData) {
        try {
            const pending = this.getAllPending();
            
            // Create unique ID for this pending transaction
            const pendingId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const pendingTransaction = {
                id: pendingId,
                timestamp: Date.now(),
                status: 'pending',
                type: transactionData.type || 'single', // single or batch
                data: {
                    // Basic info
                    recipient: transactionData.recipient,
                    noticeType: transactionData.noticeType,
                    publicText: transactionData.publicText,
                    caseNumber: transactionData.caseNumber,
                    issuingAgency: transactionData.issuingAgency,
                    tokenName: transactionData.tokenName,
                    deliveryMethod: transactionData.deliveryMethod,
                    
                    // Document data if applicable
                    hasDocument: transactionData.hasDocument,
                    documentData: transactionData.documentData,
                    documentPreview: transactionData.documentPreview,
                    
                    // Batch data if applicable
                    isBatch: transactionData.isBatch,
                    batchRecipients: transactionData.batchRecipients,
                    
                    // Fee and energy info
                    fee: transactionData.fee,
                    estimatedEnergy: transactionData.estimatedEnergy,
                    
                    // Contract info
                    contractAddress: transactionData.contractAddress,
                    
                    // Metadata
                    createdAt: transactionData.createdAt || Date.now(),
                    expiresAt: Date.now() + (24 * 60 * 60 * 1000), // Expires in 24 hours
                    
                    // User info
                    senderAddress: transactionData.senderAddress
                }
            };
            
            // Add to pending list
            pending.push(pendingTransaction);
            
            // Save to localStorage
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pending));
            
            console.log('Saved pending transaction:', pendingId);
            
            // Show notification
            if (window.uiManager) {
                window.uiManager.showNotification('info', 'Transaction saved as draft. You can complete it later.');
            }
            
            return pendingId;
            
        } catch (error) {
            console.error('Error saving pending transaction:', error);
            return null;
        }
    },
    
    // Get all pending transactions
    getAllPending() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) return [];
            
            const pending = JSON.parse(stored);
            
            // Filter out expired transactions
            const now = Date.now();
            const valid = pending.filter(tx => {
                if (tx.data && tx.data.expiresAt) {
                    return tx.data.expiresAt > now;
                }
                return true; // Keep if no expiry set
            });
            
            // Update storage if we filtered out expired ones
            if (valid.length !== pending.length) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(valid));
            }
            
            return valid;
            
        } catch (error) {
            console.error('Error getting pending transactions:', error);
            return [];
        }
    },
    
    // Get a specific pending transaction
    getPending(pendingId) {
        const pending = this.getAllPending();
        return pending.find(tx => tx.id === pendingId);
    },
    
    // Delete a pending transaction
    deletePending(pendingId) {
        try {
            const pending = this.getAllPending();
            const filtered = pending.filter(tx => tx.id !== pendingId);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
            
            console.log('Deleted pending transaction:', pendingId);
            
            // Update UI if panel is open
            if (this.isPanelOpen()) {
                this.updatePendingPanel();
            }
            
            return true;
        } catch (error) {
            console.error('Error deleting pending transaction:', error);
            return false;
        }
    },
    
    // Mark transaction as completed
    markCompleted(pendingId, txHash) {
        const pending = this.getPending(pendingId);
        if (pending) {
            pending.status = 'completed';
            pending.completedAt = Date.now();
            pending.txHash = txHash;
            
            // Remove from pending after marking complete
            this.deletePending(pendingId);
        }
    },
    
    // Resume a pending transaction
    async resumePending(pendingId) {
        const pending = this.getPending(pendingId);
        if (!pending) {
            console.error('Pending transaction not found:', pendingId);
            return false;
        }
        
        console.log('Resuming pending transaction:', pending);
        
        try {
            // Check if wallet is still connected
            if (!window.tronWeb || !window.tronWeb.defaultAddress) {
                if (window.uiManager) {
                    window.uiManager.showNotification('error', 'Please connect your wallet first');
                }
                return false;
            }
            
            // Check if sender address matches
            if (pending.data.senderAddress && pending.data.senderAddress !== window.tronWeb.defaultAddress.base58) {
                const proceed = confirm('This transaction was created with a different wallet address. Do you want to proceed with the current wallet?');
                if (!proceed) return false;
            }
            
            // Restore form data
            this.restoreFormData(pending.data);
            
            // Close pending panel
            this.closePendingPanel();
            
            // Trigger the transaction
            if (pending.type === 'batch' && window.batchManager) {
                // Resume batch transaction
                window.batchManager.resumeFromPending(pending.data);
            } else {
                // Resume single transaction
                this.resumeSingleTransaction(pending.data);
            }
            
            // Delete the pending transaction after resuming
            this.deletePending(pendingId);
            
            return true;
            
        } catch (error) {
            console.error('Error resuming pending transaction:', error);
            if (window.uiManager) {
                window.uiManager.showNotification('error', 'Failed to resume transaction: ' + error.message);
            }
            return false;
        }
    },
    
    // Restore form data from pending transaction
    restoreFormData(data) {
        // Restore mint form fields
        if (data.recipient) {
            const recipientField = document.getElementById('mintRecipient');
            if (recipientField) recipientField.value = data.recipient;
        }
        
        if (data.publicText) {
            const textField = document.getElementById('noticeText');
            if (textField) textField.value = data.publicText;
        }
        
        if (data.noticeType) {
            const typeField = document.getElementById('noticeType');
            if (typeField) typeField.value = data.noticeType;
        }
        
        if (data.caseNumber) {
            const caseField = document.getElementById('mintCaseNumber');
            if (caseField) caseField.value = data.caseNumber;
        }
        
        if (data.issuingAgency) {
            const agencyField = document.getElementById('issuingAgency');
            if (agencyField) agencyField.value = data.issuingAgency;
        }
        
        if (data.tokenName) {
            const nameField = document.getElementById('mintTokenName');
            if (nameField) nameField.value = data.tokenName;
        }
        
        if (data.deliveryMethod) {
            const methodRadio = document.querySelector(`input[name="deliveryMethod"][value="${data.deliveryMethod}"]`);
            if (methodRadio) methodRadio.checked = true;
        }
        
        // Restore document if present
        if (data.hasDocument && data.documentData) {
            window.uploadedImage = {
                data: data.documentData,
                preview: data.documentPreview
            };
            
            // Update preview if available
            const preview = document.getElementById('documentPreview');
            if (preview && data.documentPreview) {
                preview.src = data.documentPreview;
            }
        }
    },
    
    // Resume a single transaction
    async resumeSingleTransaction(data) {
        // Show processing dialog
        if (window.showProcessing) {
            window.showProcessing('Resuming transaction...');
        }
        
        // Set up the transaction data
        window.pendingTransactionData = data;
        
        // Call createLegalNotice if available
        if (window.createLegalNotice) {
            // Set a flag to skip form validation since we're resuming
            window.isResumingTransaction = true;
            await window.createLegalNotice();
            window.isResumingTransaction = false;
        }
    },
    
    // Check for pending transactions and show notification
    checkPendingTransactions() {
        const pending = this.getAllPending();
        
        if (pending.length > 0) {
            // Update badge if UI element exists
            const badge = document.getElementById('pendingBadge');
            if (badge) {
                badge.textContent = pending.length;
                badge.style.display = pending.length > 0 ? 'inline-block' : 'none';
            }
            
            // Show notification on first load
            if (!this.notificationShown) {
                this.notificationShown = true;
                
                if (pending.length === 1) {
                    this.showResumeNotification(pending[0]);
                } else {
                    this.showMultiplePendingNotification(pending.length);
                }
            }
        }
    },
    
    // Show resume notification for single pending transaction
    showResumeNotification(pending) {
        const age = Date.now() - pending.timestamp;
        const ageText = this.formatAge(age);
        
        const notification = document.createElement('div');
        notification.className = 'pending-notification';
        notification.innerHTML = `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; border-radius: 8px; margin: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <h4 style="margin: 0 0 0.5rem 0;">Pending Transaction Found</h4>
                        <p style="margin: 0; opacity: 0.9; font-size: 0.875rem;">
                            You have an incomplete NFT delivery from ${ageText}
                        </p>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="PendingTransactions.resumePending('${pending.id}')" 
                                class="btn btn-small" 
                                style="background: white; color: #667eea;">
                            Resume
                        </button>
                        <button onclick="PendingTransactions.dismissNotification(this)" 
                                class="btn btn-small btn-secondary">
                            Later
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add to page
        const container = document.getElementById('notificationContainer') || document.body;
        container.insertBefore(notification, container.firstChild);
        
        // Auto dismiss after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
    },
    
    // Show notification for multiple pending transactions
    showMultiplePendingNotification(count) {
        const notification = document.createElement('div');
        notification.className = 'pending-notification';
        notification.innerHTML = `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; border-radius: 8px; margin: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <h4 style="margin: 0 0 0.5rem 0;">${count} Pending Transactions</h4>
                        <p style="margin: 0; opacity: 0.9; font-size: 0.875rem;">
                            You have ${count} incomplete NFT deliveries
                        </p>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="PendingTransactions.showPendingPanel()" 
                                class="btn btn-small" 
                                style="background: white; color: #667eea;">
                            View All
                        </button>
                        <button onclick="PendingTransactions.dismissNotification(this)" 
                                class="btn btn-small btn-secondary">
                            Later
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add to page
        const container = document.getElementById('notificationContainer') || document.body;
        container.insertBefore(notification, container.firstChild);
        
        // Auto dismiss after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
    },
    
    // Dismiss notification
    dismissNotification(button) {
        const notification = button.closest('.pending-notification');
        if (notification) {
            notification.remove();
        }
    },
    
    // Format age of pending transaction
    formatAge(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'just now';
    },
    
    // Show pending transactions panel
    showPendingPanel() {
        // Remove existing panel if any
        this.closePendingPanel();
        
        const pending = this.getAllPending();
        
        const panel = document.createElement('div');
        panel.id = 'pendingTransactionsPanel';
        panel.className = 'modal';
        panel.style.display = 'block';
        panel.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>Pending Transactions</h3>
                    <button onclick="PendingTransactions.closePendingPanel()" class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${pending.length === 0 ? `
                        <p style="text-align: center; color: #6b7280; padding: 2rem;">
                            No pending transactions
                        </p>
                    ` : `
                        <div class="pending-list">
                            ${pending.map(tx => this.renderPendingItem(tx)).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
    },
    
    // Render a pending transaction item
    renderPendingItem(tx) {
        const age = Date.now() - tx.timestamp;
        const ageText = this.formatAge(age);
        const type = tx.type === 'batch' ? 'Batch' : 'Single';
        const recipient = tx.data.recipient || (tx.data.batchRecipients ? `${tx.data.batchRecipients.length} recipients` : 'Unknown');
        
        return `
            <div class="pending-item" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 0.5rem 0;">
                            ${type} NFT Delivery
                            <span style="font-size: 0.75rem; color: #6b7280; margin-left: 0.5rem;">
                                ${ageText}
                            </span>
                        </h4>
                        <p style="margin: 0.25rem 0; font-size: 0.875rem; color: #6b7280;">
                            <strong>To:</strong> ${recipient}
                        </p>
                        ${tx.data.noticeType ? `
                            <p style="margin: 0.25rem 0; font-size: 0.875rem; color: #6b7280;">
                                <strong>Type:</strong> ${tx.data.noticeType}
                            </p>
                        ` : ''}
                        ${tx.data.hasDocument ? `
                            <p style="margin: 0.25rem 0; font-size: 0.875rem; color: #6b7280;">
                                <i class="fas fa-paperclip"></i> Has attached document
                            </p>
                        ` : ''}
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="PendingTransactions.resumePending('${tx.id}')" 
                                class="btn btn-small btn-primary">
                            <i class="fas fa-play"></i> Resume
                        </button>
                        <button onclick="PendingTransactions.confirmDelete('${tx.id}')" 
                                class="btn btn-small btn-secondary">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Confirm deletion of pending transaction
    confirmDelete(pendingId) {
        if (confirm('Are you sure you want to delete this pending transaction? This cannot be undone.')) {
            this.deletePending(pendingId);
            
            // Refresh panel
            if (this.isPanelOpen()) {
                this.showPendingPanel();
            }
        }
    },
    
    // Update pending panel content
    updatePendingPanel() {
        const panel = document.getElementById('pendingTransactionsPanel');
        if (panel) {
            this.showPendingPanel();
        }
    },
    
    // Close pending panel
    closePendingPanel() {
        const panel = document.getElementById('pendingTransactionsPanel');
        if (panel) {
            panel.remove();
        }
    },
    
    // Check if panel is open
    isPanelOpen() {
        return document.getElementById('pendingTransactionsPanel') !== null;
    },
    
    // Show cancel confirmation dialog
    showCancelConfirmation() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>Cancel Transaction?</h3>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to cancel this transaction?</p>
                        <p style="margin-top: 1rem;">Your progress will be saved and you can resume later from the pending transactions panel.</p>
                        
                        <div style="margin-top: 1.5rem; display: flex; gap: 1rem; justify-content: flex-end;">
                            <button class="btn btn-secondary" onclick="window.pendingCancelResolve(false)">
                                Continue Transaction
                            </button>
                            <button class="btn btn-primary" onclick="window.pendingCancelResolve(true)">
                                <i class="fas fa-save"></i>
                                Save & Cancel
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Set up resolution function
            window.pendingCancelResolve = (result) => {
                modal.remove();
                delete window.pendingCancelResolve;
                resolve(result);
            };
        });
    }
};

// Initialize on load
window.PendingTransactions = PendingTransactions;

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PendingTransactions.init());
} else {
    PendingTransactions.init();
}