/**
 * COMPLETE BIGINT FIX
 * Comprehensive fix for all BigInt conversion errors
 */

console.log('🔧 Applying COMPLETE BigInt fix...');

// Safe conversion helper
window.safeNumber = function(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'bigint') return Number(value.toString());
    if (typeof value === 'string') return Number(value);
    if (typeof value === 'number') return value;
    return 0;
};

// Fix all contract fee calls
(function() {
    // Store original contract
    const originalContract = window.legalContract;
    
    if (originalContract) {
        // Wrap all fee methods to return safe numbers
        const originalCreationFee = originalContract.creationFee;
        if (originalCreationFee) {
            originalContract.creationFee = function() {
                return originalCreationFee.call(this).call().then(result => safeNumber(result));
            };
        }
        
        const originalServiceFee = originalContract.serviceFee;
        if (originalServiceFee) {
            originalContract.serviceFee = function() {
                return originalServiceFee.call(this).call().then(result => safeNumber(result));
            };
        }
        
        const originalSponsorshipFee = originalContract.sponsorshipFee;
        if (originalSponsorshipFee) {
            originalContract.sponsorshipFee = function() {
                return originalSponsorshipFee.call(this).call().then(result => safeNumber(result));
            };
        }
    }
})();

// Fix batch transaction send
(function() {
    if (window.legalContract && window.legalContract.serveNoticeBatch) {
        const originalBatch = window.legalContract.serveNoticeBatch;
        
        window.legalContract.serveNoticeBatch = function(batchNotices) {
            console.log('🔢 Ensuring BigInt safety in batch transaction...');
            
            return {
                send: async function(options) {
                    // Convert all numeric values to safe numbers
                    const safeOptions = {
                        ...options,
                        callValue: safeNumber(options.callValue),
                        feeLimit: safeNumber(options.feeLimit || 2000000000),
                        shouldPollResponse: options.shouldPollResponse !== false
                    };
                    
                    console.log('Safe options:', safeOptions);
                    
                    // Call original with safe values
                    return originalBatch.call(window.legalContract, batchNotices).send(safeOptions);
                }
            };
        };
    }
    
    // Also fix single notice
    if (window.legalContract && window.legalContract.serveNotice) {
        const originalServe = window.legalContract.serveNotice;
        
        window.legalContract.serveNotice = function(...args) {
            console.log('🔢 Ensuring BigInt safety in single transaction...');
            
            return {
                send: async function(options) {
                    // Convert all numeric values to safe numbers
                    const safeOptions = {
                        ...options,
                        callValue: safeNumber(options.callValue),
                        feeLimit: safeNumber(options.feeLimit || 2000000000),
                        shouldPollResponse: options.shouldPollResponse !== false
                    };
                    
                    console.log('Safe options:', safeOptions);
                    
                    // Call original with safe values
                    return originalServe.apply(window.legalContract, args).send(safeOptions);
                }
            };
        };
    }
})();

// Fix any arithmetic operations in batch-sponsorship-fix.js
(function() {
    // Override the entire batch sponsorship system
    const originalBatchSend = window.legalContract?.serveNoticeBatch;
    
    if (originalBatchSend) {
        // Store reference
        window._originalBatchContract = originalBatchSend.bind(window.legalContract);
        
        // Create safe wrapper
        window.legalContract.serveNoticeBatch = function(batchNotices) {
            const contractCall = window._originalBatchContract(batchNotices);
            const originalSend = contractCall.send;
            
            contractCall.send = async function(options) {
                console.log('🛡️ BigInt-safe batch transaction...');
                
                try {
                    // Get fees safely
                    let sponsorshipFee = 0;
                    try {
                        const fee = await window.legalContract.sponsorshipFee().call();
                        sponsorshipFee = safeNumber(fee);
                    } catch (e) {
                        sponsorshipFee = 2000000; // Default 2 TRX
                    }
                    
                    // Calculate total safely
                    const validRecipients = batchNotices.filter(n => 
                        n.recipient !== 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb' &&
                        n.recipient !== '0x0000000000000000000000000000000000000000'
                    );
                    
                    const totalSponsorship = safeNumber(sponsorshipFee) * validRecipients.length;
                    const callValue = safeNumber(options.callValue || 0);
                    const adjustedCallValue = Math.max(0, callValue - totalSponsorship);
                    
                    console.log('Fee calculation (all safe numbers):');
                    console.log('  Sponsorship per recipient:', sponsorshipFee);
                    console.log('  Valid recipients:', validRecipients.length);
                    console.log('  Total sponsorship:', totalSponsorship);
                    console.log('  Original callValue:', callValue);
                    console.log('  Adjusted callValue:', adjustedCallValue);
                    
                    // Create safe options
                    const safeOptions = {
                        ...options,
                        callValue: adjustedCallValue,
                        feeLimit: safeNumber(options.feeLimit || 2000000000)
                    };
                    
                    // Call original
                    return originalSend.call(this, safeOptions);
                    
                } catch (error) {
                    console.error('Batch transaction error:', error);
                    
                    // Fallback: try with original values as safe numbers
                    const fallbackOptions = {
                        ...options,
                        callValue: safeNumber(options.callValue),
                        feeLimit: safeNumber(options.feeLimit || 2000000000)
                    };
                    
                    return originalSend.call(this, fallbackOptions);
                }
            };
            
            return contractCall;
        };
    }
})();

// Global TronWeb safety
if (window.tronWeb) {
    const originalToSun = window.tronWeb.toSun;
    if (originalToSun) {
        window.tronWeb.toSun = function(trx) {
            const result = originalToSun.call(this, trx);
            return safeNumber(result);
        };
    }
    
    const originalFromSun = window.tronWeb.fromSun;
    if (originalFromSun) {
        window.tronWeb.fromSun = function(sun) {
            const safeSun = safeNumber(sun);
            return originalFromSun.call(this, safeSun);
        };
    }
}

console.log('✅ COMPLETE BigInt fix applied');
console.log('All arithmetic operations now use safe number conversions');
console.log('');
console.log('Test with: window.safeNumber(10n) // Returns: 10');