/**
 * QUICK RETRY FOR FAILED TRANSACTIONS
 * Run this to immediately retry your last failed transaction
 */

console.log('🔄 Quick Retry System loaded');

window.quickRetry = async function() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 QUICK RETRY STARTING...');
    console.log('='.repeat(60));
    
    // Get the last failed transaction
    const current = TransactionRecovery.getCurrentAttempt();
    
    if (!current) {
        console.log('❌ No failed transaction found to retry');
        console.log('Check: TransactionRecovery.getFailedTransactions()');
        return;
    }
    
    console.log('📋 Found transaction to retry:');
    console.log('  Case:', current.caseNumber);
    console.log('  Recipients:', current.recipients?.length || 1);
    console.log('  IPFS Hash:', current.documentIPFS);
    console.log('  Metadata:', current.metadataURI?.substring(0, 50) + '...');
    console.log('  Last error:', current.errorMessage);
    
    // Check energy
    const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
    const currentEnergy = account.energy || 0;
    console.log(`\n⚡ Current energy: ${currentEnergy.toLocaleString()}`);
    
    if (currentEnergy < 3000000) {
        console.log('⚠️ Warning: Low energy! Consider renting more');
        console.log('Run: rentExactEnergy(3500000)');
    }
    
    console.log('\n🔄 Attempting retry...\n');
    
    try {
        // Use the saved parameters
        const result = await window.legalContract.serveNotice(
            current.v5Params.recipient,
            current.v5Params.encryptedIPFS,
            current.v5Params.encryptionKey,
            current.v5Params.issuingAgency,
            current.v5Params.noticeType,
            current.v5Params.caseNumber,
            current.v5Params.caseDetails,
            current.v5Params.legalRights,
            current.v5Params.sponsorFees,
            current.v5Params.metadataURI
        ).send({
            callValue: Number(current.fees?.total || 27000000), // Ensure it's a number
            feeLimit: 1000000000
        });
        
        console.log('✅ SUCCESS! Transaction completed');
        console.log('TX ID:', result);
        console.log('View on TronScan: https://tronscan.org/#/transaction/' + result);
        
        // Mark as successful
        current.status = 'success';
        current.txId = result;
        localStorage.setItem(TransactionRecovery.CURRENT_KEY, JSON.stringify(current));
        
        // Show success notification
        if (window.uiManager?.showNotification) {
            window.uiManager.showNotification('success', 
                `✅ Retry successful! TX: ${result.substring(0, 8)}...`);
        }
        
        return { success: true, txId: result };
        
    } catch (error) {
        console.error('❌ Retry failed:', error.message);
        console.log('\nPossible solutions:');
        console.log('1. Check energy: rentExactEnergy(3500000)');
        console.log('2. Check balance');
        console.log('3. Try again: quickRetry()');
        
        return { success: false, error: error.message };
    }
};

// Also add a batch retry function
window.quickBatchRetry = async function() {
    console.log('\n' + '='.repeat(60));
    console.log('📦 BATCH RETRY STARTING...');
    console.log('='.repeat(60));
    
    const current = TransactionRecovery.getCurrentAttempt();
    
    if (!current || !current.recipients || current.recipients.length <= 1) {
        console.log('❌ No batch transaction found to retry');
        return;
    }
    
    console.log('📋 Found batch transaction:');
    console.log('  Case:', current.caseNumber);
    console.log('  Recipients:', current.recipients.length);
    console.log('  Total fee:', (current.fees?.total || 0) / 1000000, 'TRX');
    
    // For batch, we need to reconstruct the batch array
    const batchNotices = current.recipients.map(recipient => [
        recipient,
        current.v5Params.encryptedIPFS,
        current.v5Params.encryptionKey,
        current.v5Params.issuingAgency,
        current.v5Params.noticeType,
        current.v5Params.caseNumber,
        current.v5Params.caseDetails,
        current.v5Params.legalRights,
        current.v5Params.sponsorFees,
        current.v5Params.metadataURI
    ]);
    
    try {
        const result = await window.legalContract.serveNoticeBatch(batchNotices).send({
            callValue: Number(current.fees?.total || 8000000), // Ensure it's a number
            feeLimit: 2000000000
        });
        
        console.log('✅ BATCH SUCCESS!');
        console.log('TX ID:', result);
        
        return { success: true, txId: result };
        
    } catch (error) {
        console.error('❌ Batch retry failed:', error.message);
        return { success: false, error: error.message };
    }
};

console.log('✅ Quick retry functions ready!');
console.log('');
console.log('Commands:');
console.log('  quickRetry()      - Retry last failed transaction');
console.log('  quickBatchRetry() - Retry failed batch transaction');
console.log('');