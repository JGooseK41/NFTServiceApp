/**
 * BATCH UPDATE TOKEN URIs
 * Update multiple Alert NFT URIs in a single transaction
 */

console.log('📦 BATCH TOKEN URI UPDATE SYSTEM');
console.log('=' .repeat(70));

window.BatchUpdateTokenURIs = {
    
    // Check if contract supports batch updates
    async checkBatchSupport() {
        console.log('Checking contract for batch update support...');
        
        try {
            // Check for batch update function
            if (window.legalContract.batchSetTokenURI) {
                console.log('✅ Contract has batchSetTokenURI function');
                return 'NATIVE_BATCH';
            }
            
            if (window.legalContract.updateMultipleTokenURIs) {
                console.log('✅ Contract has updateMultipleTokenURIs function');
                return 'MULTI_UPDATE';
            }
            
            if (window.legalContract.setTokenURIBatch) {
                console.log('✅ Contract has setTokenURIBatch function');
                return 'BATCH_SET';
            }
            
            console.log('⚠️ No batch update function found');
            console.log('Will need to deploy batch updater or use multiple transactions');
            return 'NO_BATCH';
            
        } catch (error) {
            console.error('Error checking batch support:', error);
            return 'ERROR';
        }
    },
    
    // Generate batch update data for all pending alerts
    async prepareBatchUpdate() {
        console.log('\n📋 Preparing batch update data...');
        
        if (!window.pendingURIUpdates) {
            console.log('No pending updates found');
            console.log('Run ConvertAlertsToBase64.convertAllAlerts() first');
            return null;
        }
        
        const tokenIds = [];
        const newURIs = [];
        
        Object.entries(window.pendingURIUpdates).forEach(([tokenId, uri]) => {
            tokenIds.push(parseInt(tokenId));
            newURIs.push(uri);
        });
        
        console.log(`Found ${tokenIds.length} alerts to update:`);
        console.log('Token IDs:', tokenIds);
        
        // Calculate total data size
        const totalSize = newURIs.reduce((sum, uri) => sum + uri.length, 0);
        console.log(`Total data size: ${(totalSize / 1024).toFixed(2)} KB`);
        
        // Check if size is reasonable for single transaction
        if (totalSize > 200000) { // ~200KB limit for safety
            console.log('⚠️ Data too large for single transaction');
            console.log('Will need to split into batches');
            return this.splitIntoBatches(tokenIds, newURIs);
        }
        
        return {
            tokenIds,
            newURIs,
            totalSize,
            estimatedGas: tokenIds.length * 100000 // Rough estimate
        };
    },
    
    // Split large updates into manageable batches
    splitIntoBatches(tokenIds, newURIs, maxBatchSize = 5) {
        const batches = [];
        
        for (let i = 0; i < tokenIds.length; i += maxBatchSize) {
            batches.push({
                tokenIds: tokenIds.slice(i, i + maxBatchSize),
                newURIs: newURIs.slice(i, i + maxBatchSize)
            });
        }
        
        console.log(`Split into ${batches.length} batches of up to ${maxBatchSize} tokens each`);
        return batches;
    },
    
    // Execute batch update using native contract function
    async executeBatchUpdate(tokenIds, newURIs) {
        console.log('\n🚀 Executing batch update...');
        console.log(`Updating ${tokenIds.length} token URIs in one transaction`);
        
        try {
            // Check authorization
            const currentAddress = window.tronWeb.defaultAddress.base58;
            console.log(`Current address: ${currentAddress}`);
            
            // Estimate transaction cost
            const estimatedFee = tokenIds.length * 50; // TRX estimate
            console.log(`Estimated fee: ~${estimatedFee} TRX`);
            
            // Try different batch functions based on what's available
            let tx;
            
            if (window.legalContract.batchSetTokenURI) {
                console.log('Using batchSetTokenURI...');
                tx = await window.legalContract.batchSetTokenURI(tokenIds, newURIs).send({
                    feeLimit: 1000000000, // 1000 TRX max
                    callValue: 0,
                    shouldPollResponse: true
                });
                
            } else if (window.legalContract.updateMultipleTokenURIs) {
                console.log('Using updateMultipleTokenURIs...');
                tx = await window.legalContract.updateMultipleTokenURIs(tokenIds, newURIs).send({
                    feeLimit: 1000000000,
                    callValue: 0,
                    shouldPollResponse: true
                });
                
            } else {
                console.log('⚠️ No batch function available');
                console.log('Falling back to sequential updates');
                return this.executeSequentialUpdates(tokenIds, newURIs);
            }
            
            console.log('✅ Batch update transaction sent!');
            console.log('Transaction ID:', tx);
            
            // Clear pending updates
            tokenIds.forEach(id => {
                delete window.pendingURIUpdates[id];
            });
            
            return tx;
            
        } catch (error) {
            console.error('❌ Batch update failed:', error);
            
            if (error.message && error.message.includes('revert')) {
                console.log('Contract rejected batch update');
                console.log('May need owner permissions or contract upgrade');
            }
            
            return null;
        }
    },
    
    // Fallback: Update tokens one by one efficiently
    async executeSequentialUpdates(tokenIds, newURIs) {
        console.log('\n📝 Executing sequential updates...');
        console.log('This will require multiple transactions but can be batched in the wallet');
        
        const results = [];
        
        for (let i = 0; i < tokenIds.length; i++) {
            console.log(`\nUpdating Alert #${tokenIds[i]} (${i + 1}/${tokenIds.length})...`);
            
            try {
                const tx = await window.legalContract.setTokenURI(tokenIds[i], newURIs[i]).send({
                    feeLimit: 100000000,
                    callValue: 0,
                    shouldPollResponse: false // Don't wait for confirmation
                });
                
                results.push({
                    tokenId: tokenIds[i],
                    status: 'SENT',
                    tx: tx
                });
                
                console.log(`✅ Transaction sent for Alert #${tokenIds[i]}`);
                
                // Small delay to avoid overwhelming the network
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`❌ Failed to update Alert #${tokenIds[i]}:`, error.message);
                results.push({
                    tokenId: tokenIds[i],
                    status: 'FAILED',
                    error: error.message
                });
            }
        }
        
        // Summary
        const successful = results.filter(r => r.status === 'SENT').length;
        const failed = results.filter(r => r.status === 'FAILED').length;
        
        console.log('\n📊 Sequential update complete:');
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        
        return results;
    },
    
    // Main function to update all alerts efficiently
    async updateAllAlerts() {
        console.log('\n🎯 UPDATING ALL ALERT NFTs TO BASE64');
        console.log('=' .repeat(70));
        
        // First check batch support
        const batchSupport = await this.checkBatchSupport();
        
        // Prepare update data
        const updateData = await this.prepareBatchUpdate();
        
        if (!updateData) {
            console.log('No updates to process');
            return;
        }
        
        // Handle based on batch support
        if (batchSupport === 'NATIVE_BATCH' || batchSupport === 'MULTI_UPDATE' || batchSupport === 'BATCH_SET') {
            console.log('\n✅ Contract supports batch updates!');
            console.log('This will save significant gas fees');
            
            if (Array.isArray(updateData)) {
                // Multiple batches needed
                console.log(`Processing ${updateData.length} batches...`);
                
                for (let i = 0; i < updateData.length; i++) {
                    console.log(`\nBatch ${i + 1}/${updateData.length}:`);
                    await this.executeBatchUpdate(updateData[i].tokenIds, updateData[i].newURIs);
                    
                    if (i < updateData.length - 1) {
                        console.log('Waiting before next batch...');
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                }
            } else {
                // Single batch
                await this.executeBatchUpdate(updateData.tokenIds, updateData.newURIs);
            }
            
        } else {
            console.log('\n⚠️ No batch support - using sequential updates');
            console.log('This will require multiple transactions');
            
            const proceed = confirm(`This will create ${updateData.tokenIds.length} separate transactions. Continue?`);
            
            if (proceed) {
                await this.executeSequentialUpdates(updateData.tokenIds, updateData.newURIs);
            }
        }
        
        console.log('\n✅ Update process complete');
        console.log('Check your wallet for transaction confirmations');
    },
    
    // Generate all base64 URIs first
    async prepareAllUpdates() {
        console.log('📦 Preparing all Alert NFT updates...\n');
        
        // Get all alert IDs
        const alertIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
        let prepared = 0;
        let failed = 0;
        
        for (const id of alertIds) {
            try {
                // Check if token exists
                await window.legalContract.ownerOf(id).call();
                
                // Generate base64 URI
                await ConvertAlertsToBase64.updateAlertToBase64(id);
                prepared++;
                
            } catch (e) {
                console.log(`Alert #${id} not minted or failed`);
                failed++;
            }
        }
        
        console.log(`\n✅ Prepared ${prepared} updates`);
        if (failed > 0) {
            console.log(`⚠️ Skipped ${failed} unminted tokens`);
        }
        
        console.log('\nReady for batch update. Run:');
        console.log('  BatchUpdateTokenURIs.updateAllAlerts()');
        
        return prepared;
    }
};

// Auto-check batch support
(async () => {
    console.log('\nChecking your contract capabilities...\n');
    
    const support = await BatchUpdateTokenURIs.checkBatchSupport();
    
    if (support === 'NO_BATCH') {
        console.log('\n📝 Your contract needs batch update function');
        console.log('Options:');
        console.log('1. Deploy contract upgrade with batch function');
        console.log('2. Use sequential updates (multiple transactions)');
        console.log('3. Deploy separate batch updater contract');
    } else if (support !== 'ERROR') {
        console.log('\n✅ Ready for batch updates!');
    }
    
    console.log('\nCommands:');
    console.log('  BatchUpdateTokenURIs.prepareAllUpdates()  - Generate all base64 URIs');
    console.log('  BatchUpdateTokenURIs.updateAllAlerts()    - Execute batch update');
})();