/**
 * Fix transaction fee calculation to prevent NaN callValue errors
 */

console.log('🔧 Fixing transaction fee calculation...');

// Store original executeTransaction if it exists
const originalExecuteTransaction = window.TransactionStaging?.executeTransaction;

// Define default fee values (in TRX)
const DEFAULT_CREATION_FEE = 25; // 25 TRX per notice
const DEFAULT_SPONSORSHIP_FEE = 10; // 10 TRX per recipient if sponsoring

// Override the fee calculation in TransactionStaging
if (window.TransactionStaging) {
    
    // Wrap the executeTransaction function
    const originalExec = window.TransactionStaging.executeTransaction;
    
    window.TransactionStaging.executeTransaction = async function(transactionId, skipSimulation = false) {
        console.log('🔧 Intercepting transaction execution to fix fees...');
        
        try {
            // Get the staged transaction
            const stagedTx = window.TransactionStaging.stagedTransactions.get(transactionId);
            if (!stagedTx) {
                console.error('Transaction not found:', transactionId);
                throw new Error('Transaction not found');
            }
            
            // Fix fee values if they're missing
            if (stagedTx.data) {
                if (stagedTx.data.creationFee === undefined || stagedTx.data.creationFee === null) {
                    console.log('⚠️ creationFee was undefined, setting to default:', DEFAULT_CREATION_FEE);
                    stagedTx.data.creationFee = DEFAULT_CREATION_FEE;
                }
                
                if (stagedTx.data.sponsorshipFee === undefined || stagedTx.data.sponsorshipFee === null) {
                    console.log('⚠️ sponsorshipFee was undefined, setting to default:', DEFAULT_SPONSORSHIP_FEE);
                    stagedTx.data.sponsorshipFee = DEFAULT_SPONSORSHIP_FEE;
                }
                
                // Ensure fees are numbers
                stagedTx.data.creationFee = Number(stagedTx.data.creationFee) || DEFAULT_CREATION_FEE;
                stagedTx.data.sponsorshipFee = Number(stagedTx.data.sponsorshipFee) || DEFAULT_SPONSORSHIP_FEE;
                
                console.log('✅ Fixed fee values:', {
                    creationFee: stagedTx.data.creationFee,
                    sponsorshipFee: stagedTx.data.sponsorshipFee
                });
            }
            
            // Call original function
            return await originalExec.call(this, transactionId, skipSimulation);
            
        } catch (error) {
            console.error('Error in fee-fixed executeTransaction:', error);
            throw error;
        }
    };
}

// Also fix the proceedWithExecution function if it exists
if (window.TransactionStaging?.proceedWithExecution) {
    const originalProceed = window.TransactionStaging.proceedWithExecution;
    
    window.TransactionStaging.proceedWithExecution = async function(transactionId, energyChoice) {
        console.log('🔧 Fixing fees in proceedWithExecution...');
        
        // Get the staged transaction
        const stagedTx = window.TransactionStaging.stagedTransactions.get(transactionId);
        if (stagedTx && stagedTx.data) {
            // Ensure fees are set
            if (!stagedTx.data.creationFee && stagedTx.data.creationFee !== 0) {
                stagedTx.data.creationFee = DEFAULT_CREATION_FEE;
                console.log('Set default creationFee:', DEFAULT_CREATION_FEE);
            }
            if (!stagedTx.data.sponsorshipFee && stagedTx.data.sponsorshipFee !== 0) {
                stagedTx.data.sponsorshipFee = DEFAULT_SPONSORSHIP_FEE;
                console.log('Set default sponsorshipFee:', DEFAULT_SPONSORSHIP_FEE);
            }
        }
        
        return await originalProceed.call(this, transactionId, energyChoice);
    };
}

// Function to calculate fees for a transaction
window.calculateTransactionFees = function(recipientCount, sponsorFees = false) {
    const creationFee = DEFAULT_CREATION_FEE;
    const sponsorshipTotal = sponsorFees ? (DEFAULT_SPONSORSHIP_FEE * recipientCount) : 0;
    const totalTRX = creationFee + sponsorshipTotal;
    const totalSUN = totalTRX * 1_000_000;
    
    console.log('📊 Fee calculation:', {
        recipientCount,
        sponsorFees,
        creationFee: creationFee + ' TRX',
        sponsorshipFee: sponsorFees ? DEFAULT_SPONSORSHIP_FEE + ' TRX per recipient' : '0 TRX',
        sponsorshipTotal: sponsorshipTotal + ' TRX',
        totalTRX: totalTRX + ' TRX',
        totalSUN: totalSUN + ' SUN'
    });
    
    return {
        creationFee,
        sponsorshipFee: DEFAULT_SPONSORSHIP_FEE,
        sponsorshipTotal,
        totalTRX,
        totalSUN
    };
};

// Also intercept contract calls directly to ensure callValue is valid
if (window.legalContract) {
    const originalServeNotice = window.legalContract.serveNotice;
    const originalServeNoticeBatch = window.legalContract.serveNoticeBatch;
    
    // Wrap serveNotice
    if (originalServeNotice) {
        window.legalContract.serveNotice = function(...args) {
            const result = originalServeNotice.apply(this, args);
            
            // Wrap the send function
            const originalSend = result.send;
            result.send = function(options) {
                // Fix callValue if it's NaN or undefined
                if (!options.callValue || isNaN(options.callValue)) {
                    console.log('⚠️ Fixing invalid callValue in serveNotice');
                    const fees = calculateTransactionFees(1, args[8]); // args[8] is sponsorFees
                    options.callValue = fees.totalSUN;
                    console.log('Set callValue to:', options.callValue, 'SUN');
                }
                
                return originalSend.call(this, options);
            };
            
            return result;
        };
    }
    
    // Wrap serveNoticeBatch
    if (originalServeNoticeBatch) {
        window.legalContract.serveNoticeBatch = function(batchNotices) {
            const result = originalServeNoticeBatch.call(this, batchNotices);
            
            // Wrap the send function
            const originalSend = result.send;
            result.send = function(options) {
                // Fix callValue if it's NaN or undefined
                if (!options.callValue || isNaN(options.callValue)) {
                    console.log('⚠️ Fixing invalid callValue in serveNoticeBatch');
                    const sponsorFees = batchNotices[0]?.[8] || false; // Check first notice for sponsorFees
                    const fees = calculateTransactionFees(batchNotices.length, sponsorFees);
                    options.callValue = fees.totalSUN;
                    console.log('Set callValue to:', options.callValue, 'SUN for', batchNotices.length, 'recipients');
                }
                
                return originalSend.call(this, options);
            };
            
            return result;
        };
    }
}

console.log('✅ Transaction fee fix loaded!');
console.log('   Default fees: 25 TRX creation + 10 TRX per recipient (if sponsoring)');
console.log('   Use calculateTransactionFees(recipientCount, sponsorFees) to calculate fees');