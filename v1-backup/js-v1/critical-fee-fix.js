/**
 * CRITICAL FEE FIX - Stops the $600 overcharge bug
 * Forces all fees to be numbers, not strings
 */

console.log('🚨 CRITICAL FEE FIX LOADING - Stopping $600 overcharges...');

// Fix the string concatenation bug globally
(function() {
    // Store original functions
    const originalServeNotice = window.legalContract?.serveNotice;
    const originalServeNoticeBatch = window.legalContract?.serveNoticeBatch;
    
    // Wait for contract to load if not ready
    const fixContract = () => {
        if (!window.legalContract) {
            setTimeout(fixContract, 100);
            return;
        }
        
        // Override serveNotice
        if (window.legalContract.serveNotice) {
            const original = window.legalContract.serveNotice;
            window.legalContract.serveNotice = function(...args) {
                console.log('🔧 Intercepting serveNotice to fix fees...');
                const result = original.apply(this, args);
                
                const originalSend = result.send;
                result.send = async function(options) {
                    // FORCE NUMERIC CONVERSION
                    if (options.callValue) {
                        const oldValue = options.callValue;
                        
                        // If it's a string that looks like "2530000000", fix it
                        if (typeof oldValue === 'string' || oldValue > 1000000000000) {
                            console.warn(`⚠️ Detected bad callValue: ${oldValue}`);
                            
                            // Standard fees
                            const creationFee = 25;
                            const sponsorFee = args[8] ? 10 : 0; // args[8] is sponsorFees
                            const correctFee = (creationFee + sponsorFee) * 1_000_000;
                            
                            options.callValue = correctFee;
                            console.log(`✅ Fixed to: ${correctFee} SUN (${correctFee/1_000_000} TRX)`);
                        }
                    }
                    
                    return await originalSend.call(this, options);
                };
                
                return result;
            };
        }
        
        // Override serveNoticeBatch
        if (window.legalContract.serveNoticeBatch) {
            const original = window.legalContract.serveNoticeBatch;
            window.legalContract.serveNoticeBatch = function(...args) {
                console.log('🔧 Intercepting serveNoticeBatch to fix fees...');
                const result = original.apply(this, args);
                
                const originalSend = result.send;
                result.send = async function(options) {
                    // FORCE NUMERIC CONVERSION
                    if (options.callValue) {
                        const oldValue = options.callValue;
                        
                        // If it's a string or absurdly high
                        if (typeof oldValue === 'string' || oldValue > 1000000000000) {
                            console.warn(`⚠️ Detected bad callValue: ${oldValue}`);
                            
                            // Calculate correct fee
                            const batchSize = args[0]?.length || 1;
                            const sponsorFees = args[0]?.[0]?.[8] || false;
                            const creationFee = 25;
                            const sponsorFee = sponsorFees ? 10 * batchSize : 0;
                            const correctFee = (creationFee + sponsorFee) * 1_000_000;
                            
                            options.callValue = correctFee;
                            console.log(`✅ Fixed to: ${correctFee} SUN (${correctFee/1_000_000} TRX)`);
                        }
                    }
                    
                    return await originalSend.call(this, options);
                };
                
                return result;
            };
        }
        
        console.log('✅ Contract methods patched to prevent overcharges');
    };
    
    fixContract();
})();

// Also fix at the transaction staging level
if (window.TransactionStaging) {
    const originalExecute = window.TransactionStaging.executeTransaction;
    
    window.TransactionStaging.executeTransaction = async function(transactionId, skipSimulation = false) {
        console.log('🔧 Fixing fees in transaction staging...');
        
        // Get transaction data
        const stagedData = await this.getTransaction(transactionId);
        if (stagedData.success) {
            const txData = stagedData.completeData;
            
            // FORCE ALL FEES TO BE NUMBERS
            if (txData.data) {
                const oldCreationFee = txData.data.creationFee;
                const oldSponsorshipFee = txData.data.sponsorshipFee;
                
                txData.data.creationFee = Number(txData.data.creationFee) || 25;
                txData.data.sponsorshipFee = Number(txData.data.sponsorshipFee) || 10;
                
                if (oldCreationFee !== txData.data.creationFee) {
                    console.warn(`Fixed creationFee: "${oldCreationFee}" → ${txData.data.creationFee}`);
                }
                if (oldSponsorshipFee !== txData.data.sponsorshipFee) {
                    console.warn(`Fixed sponsorshipFee: "${oldSponsorshipFee}" → ${txData.data.sponsorshipFee}`);
                }
            }
        }
        
        return await originalExecute.call(this, transactionId, skipSimulation);
    };
}

// Global fee validation
window.validateFee = function(fee) {
    // Convert to number if string
    const numFee = typeof fee === 'string' ? Number(fee) : fee;
    
    // Check if it's the bug value
    if (numFee > 1000) {
        console.error(`❌ INVALID FEE DETECTED: ${numFee} TRX`);
        console.error('This appears to be the string concatenation bug!');
        return 25; // Return default safe value
    }
    
    return numFee;
};

// Add visual warning
const warning = document.createElement('div');
warning.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #ff0000;
    color: white;
    padding: 20px;
    border-radius: 10px;
    font-weight: bold;
    z-index: 999999;
    display: none;
`;
warning.id = 'fee-warning';
warning.innerHTML = `
    ⚠️ FEE BUG DETECTED! ⚠️<br>
    System tried to charge <span id="bad-fee"></span> TRX<br>
    Fixed to <span id="good-fee"></span> TRX
`;
document.body.appendChild(warning);

window.showFeeWarning = function(badFee, goodFee) {
    const warningEl = document.getElementById('fee-warning');
    document.getElementById('bad-fee').textContent = badFee;
    document.getElementById('good-fee').textContent = goodFee;
    warningEl.style.display = 'block';
    
    setTimeout(() => {
        warningEl.style.display = 'none';
    }, 5000);
};

console.log('✅ CRITICAL FEE FIX ACTIVE');
console.log('   - Prevents $600 overcharges');
console.log('   - Forces all fees to be numbers');
console.log('   - Blocks string concatenation bug');