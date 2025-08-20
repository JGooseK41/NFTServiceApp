/**
 * Fix Sponsorship Flag Issue
 * Ensures sponsorFees is always set to true when we want to sponsor recipients
 */

window.FixSponsorshipFlag = {
    
    /**
     * Fix the sponsorFees flag logic
     */
    patchSponsorFeesLogic() {
        console.log('🔧 Patching sponsorFees flag logic...');
        
        // Find and replace the incorrect logic in the transaction flow
        const originalLog = console.log;
        
        // Intercept console logs to detect when batch notices are being created
        console.log = function(...args) {
            // Call original console.log
            originalLog.apply(console, args);
            
            // Check if this is the batch notices log
            if (args[0] === 'Batch notices to send (as arrays):' && args[1]) {
                const batchNotices = args[1];
                
                // Check if sponsorFees is false and fix it
                let needsFix = false;
                batchNotices.forEach((notice, index) => {
                    // Array format: notice[8] is sponsorFees
                    if (notice[8] === false) {
                        originalLog(`⚠️ Fixing sponsorFees for recipient ${index + 1}: was false, setting to true`);
                        notice[8] = true; // Set sponsorFees to true
                        needsFix = true;
                    }
                });
                
                if (needsFix) {
                    originalLog('✅ Fixed sponsorFees flags for all recipients');
                }
            }
        };
    },
    
    /**
     * Override the sponsorFees calculation to always return true
     */
    ensureSponsorshipAlwaysEnabled() {
        // Store original calculateFeeFromConstants if not stored
        if (!window.originalCalculateFeeFromConstants) {
            window.originalCalculateFeeFromConstants = window.calculateFeeFromConstants;
        }
        
        // Wrap the function to ensure sponsorship is included
        const originalFunc = window.calculateFeeFromConstants;
        window.calculateFeeFromConstants = async function(userAddress) {
            const fee = await originalFunc(userAddress);
            
            // Always ensure sponsorship is included
            const sponsorshipFee = 2000000; // 2 TRX in sun (or 6 TRX if consolidated)
            
            // If fee doesn't include sponsorship, add it
            if (fee < sponsorshipFee) {
                console.log('⚠️ Fee too low, adding sponsorship:', (fee + sponsorshipFee) / 1000000, 'TRX');
                return fee + sponsorshipFee;
            }
            
            return fee;
        };
    },
    
    /**
     * Create a helper to always set sponsorFees to true
     */
    alwaysSponsor() {
        // Override the sponsorFees calculation
        Object.defineProperty(window, 'sponsorFees', {
            get: function() {
                console.log('📌 sponsorFees requested - returning true (always sponsor)');
                return true;
            },
            set: function(value) {
                if (!value) {
                    console.warn('⚠️ Attempted to set sponsorFees to false - overriding to true');
                }
                return true;
            }
        });
    },
    
    /**
     * Fix the specific line that calculates sponsorFees incorrectly
     */
    fixInlineCalculation() {
        // This is a more direct fix - we'll patch the actual transaction sending
        if (window.sendTransactionToBlockchain) {
            const original = window.sendTransactionToBlockchain;
            window.sendTransactionToBlockchain = async function(transactionData) {
                console.log('🔧 Intercepting transaction to fix sponsorFees...');
                
                // Always set sponsorFees to true in the transaction data
                if (transactionData) {
                    transactionData.sponsorFees = true;
                    console.log('✅ Set sponsorFees = true for transaction');
                }
                
                return original.call(this, transactionData);
            };
        }
    },
    
    /**
     * Initialize all fixes
     */
    initialize() {
        console.log('🚀 Initializing Sponsorship Flag Fix...');
        
        // Apply all patches
        this.patchSponsorFeesLogic();
        this.ensureSponsorshipAlwaysEnabled();
        this.alwaysSponsor();
        this.fixInlineCalculation();
        
        // Also patch the calculation that determines sponsorFees
        // Find where it says: const sponsorFees = fee > serviceFee;
        // And replace with: const sponsorFees = true;
        
        // Monitor for any attempts to set sponsorFees to false
        const observer = new MutationObserver(() => {
            // Check if sponsorFees is being used
            if (window.sponsorFees === false) {
                console.warn('⚠️ Detected sponsorFees = false, fixing...');
                window.sponsorFees = true;
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('✅ Sponsorship Flag Fix initialized');
        console.log('📌 All transactions will now include sponsorship for recipients');
    }
};

// Initialize immediately
FixSponsorshipFlag.initialize();

console.log('✅ Sponsorship Flag Fix loaded');
console.log('This ensures sponsorFees is always true so recipients get their TRX');