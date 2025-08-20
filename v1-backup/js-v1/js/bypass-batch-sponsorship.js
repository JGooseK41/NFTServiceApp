/**
 * BYPASS BATCH SPONSORSHIP ISSUES
 * Completely replace the problematic batch sponsorship fix
 */

console.log('🔨 BYPASSING batch sponsorship issues entirely...');

// Disable the problematic batch-sponsorship-fix.js
(function() {
    // Wait for it to load then override it
    setTimeout(() => {
        if (window.legalContract && window._originalBatchFunction) {
            console.log('♻️ Restoring original batch function...');
            
            // Restore the original unpatched function
            window.legalContract.serveNoticeBatch = window._originalBatchFunction;
            
            // Now apply a SIMPLE fix without complex arithmetic
            const simpleBatch = window.legalContract.serveNoticeBatch;
            
            window.legalContract.serveNoticeBatch = function(batchNotices) {
                const contractCall = simpleBatch.call(this, batchNotices);
                const originalSend = contractCall.send;
                
                contractCall.send = async function(options) {
                    console.log('✅ Using SIMPLE batch (no sponsorship calculations)');
                    
                    // Just ensure callValue is a safe number, no arithmetic
                    const safeOptions = {
                        ...options,
                        callValue: parseInt(String(options.callValue || 0)),
                        feeLimit: parseInt(String(options.feeLimit || 2000000000))
                    };
                    
                    console.log('Safe options:', safeOptions);
                    
                    // Call original
                    return originalSend.call(this, safeOptions);
                };
                
                return contractCall;
            };
            
            console.log('✅ Batch function simplified - no more BigInt arithmetic');
        }
    }, 100);
})();

// Also provide a direct batch function that works
window.directBatchTransaction = async function(recipients, caseData, fee) {
    console.log('🎯 Using DIRECT batch transaction (bypasses all wrappers)...');
    
    try {
        // Build batch array
        const batchNotices = recipients.map(recipient => [
            recipient,
            caseData.encryptedIPFS || '',
            caseData.encryptionKey || '',
            caseData.issuingAgency || 'Process Server',
            caseData.noticeType || 'Legal Notice',
            caseData.caseNumber || '',
            caseData.caseDetails || '',
            caseData.legalRights || 'You have been served',
            caseData.sponsorFees || false,
            caseData.metadataURI || ''
        ]);
        
        // Get the raw contract
        const contract = window.tronWeb.contract(
            window.legalContract.abi,
            window.legalContract.address
        );
        
        // Call directly, converting fee to safe integer
        const safeFee = parseInt(String(fee || 8000000));
        
        console.log('Sending batch with fee:', safeFee);
        
        const result = await contract.serveNoticeBatch(batchNotices).send({
            callValue: safeFee,
            feeLimit: 2000000000,
            shouldPollResponse: true
        });
        
        console.log('✅ Direct batch successful:', result);
        return result;
        
    } catch (error) {
        console.error('Direct batch failed:', error);
        throw error;
    }
};

console.log('✅ Batch sponsorship bypass loaded');
console.log('If regular batch fails, use: directBatchTransaction(recipients, caseData, fee)');