/**
 * Disable Separate Notification Payment
 * When consolidated sponsorship is active (6 TRX), we don't need the separate 3.5 TRX payment
 */

window.DisableSeparateNotification = {
    
    /**
     * Check if consolidated sponsorship is active
     */
    async isConsolidatedActive() {
        try {
            if (!window.legalContract) return false;
            const sponsorshipFee = await legalContract.sponsorshipFee().call();
            return sponsorshipFee >= 6000000; // 6 TRX or more
        } catch (error) {
            console.error('Error checking sponsorship fee:', error);
            return false;
        }
    },
    
    /**
     * Patch the notification sending to skip if consolidated
     */
    async patchNotificationSystem() {
        console.log('🔧 Patching notification system for consolidated sponsorship...');
        
        // Store original sendTransaction if not already stored
        if (!window.originalSendTransaction) {
            window.originalSendTransaction = tronWeb.trx.sendTransaction;
        }
        
        // Check if consolidation is active
        const isConsolidated = await this.isConsolidatedActive();
        
        if (isConsolidated) {
            console.log('✅ Consolidated sponsorship active - disabling separate 3.5 TRX payments');
            
            // Override sendTransaction to skip 3.5 TRX notifications
            tronWeb.trx.sendTransaction = async function(to, amount, options = {}) {
                // Check if this is the 3.5 TRX notification payment
                if (amount === 3500000 && options.memo && options.memo.includes('LEGAL NOTICE')) {
                    console.log('📌 Skipping separate 3.5 TRX notification (already included in 6 TRX sponsorship)');
                    // Return a mock successful transaction
                    return {
                        txid: 'CONSOLIDATED_' + Date.now(),
                        result: true,
                        consolidated: true,
                        message: 'Payment consolidated in contract sponsorship'
                    };
                }
                
                // For all other transactions, use the original function
                return window.originalSendTransaction.call(this, to, amount, options);
            };
            
            console.log('✅ Notification system patched for consolidation');
        } else {
            console.log('⚠️ Consolidated sponsorship not active (fee is still 2 TRX)');
            console.log('The separate 3.5 TRX notification will still be sent');
            
            // Restore original function if it was overridden
            if (window.originalSendTransaction) {
                tronWeb.trx.sendTransaction = window.originalSendTransaction;
            }
        }
    },
    
    /**
     * Update UI messages to reflect consolidation
     */
    updateNotificationMessages() {
        // Find and update any notification status messages
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check for notification messages
                        const text = node.textContent || '';
                        if (text.includes('3.5 TRX sent for transaction visibility')) {
                            node.textContent = text.replace(
                                '3.5 TRX sent for transaction visibility',
                                '6 TRX sponsorship sent via contract (includes notification)'
                            );
                        }
                        if (text.includes('5.5 TRX total sent')) {
                            node.textContent = text.replace(
                                '5.5 TRX total sent to recipient (2 TRX via contract + 3.5 TRX direct)',
                                '6 TRX total sent to recipient via contract (consolidated sponsorship)'
                            );
                        }
                    }
                });
            });
        });
        
        // Start observing the document for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('✅ UI message observer installed');
    },
    
    /**
     * Initialize the system
     */
    async initialize() {
        console.log('🚀 Initializing Separate Notification Disabler...');
        
        try {
            // Wait for contract to be ready
            let retries = 0;
            while (!window.legalContract && retries < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));
                retries++;
            }
            
            if (!window.legalContract) {
                console.error('Contract not available after 5 seconds');
                return;
            }
            
            // Apply the patch
            await this.patchNotificationSystem();
            
            // Update UI messages
            this.updateNotificationMessages();
            
            // Log current status
            const isConsolidated = await this.isConsolidatedActive();
            if (isConsolidated) {
                const fee = await legalContract.sponsorshipFee().call();
                console.log(`✅ System configured for consolidated ${fee/1000000} TRX sponsorship`);
                console.log('📌 Separate 3.5 TRX notifications are DISABLED');
            } else {
                console.log('⚠️ System still using separate payments (2 TRX + 3.5 TRX)');
                console.log('Run ConsolidatedSponsorship.updateContractSponsorshipFee() to consolidate');
            }
            
        } catch (error) {
            console.error('Error initializing notification disabler:', error);
        }
    },
    
    /**
     * Restore original behavior (for testing)
     */
    restore() {
        if (window.originalSendTransaction) {
            tronWeb.trx.sendTransaction = window.originalSendTransaction;
            console.log('✅ Original notification behavior restored');
        }
    }
};

// Auto-initialize after a delay to ensure contract is loaded
setTimeout(() => {
    DisableSeparateNotification.initialize();
}, 2000);

console.log('✅ Separate Notification Disabler loaded');