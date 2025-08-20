/**
 * APPLY BASE64 UPDATES TO BLOCKCHAIN
 * Helper script to update Alert NFT URIs on blockchain
 */

console.log('📝 BASE64 URI UPDATE HELPER');
console.log('=' .repeat(70));

window.ApplyBase64Updates = {
    
    // Check if user is the contract owner or authorized
    async checkAuthorization() {
        try {
            const accounts = await window.tronWeb.trx.getAccount();
            const currentAddress = window.tronWeb.defaultAddress.base58;
            
            // Check if contract has setTokenURI function
            const contract = await window.tronWeb.contract().at(window.CONTRACT_ADDRESS);
            
            console.log(`Current address: ${currentAddress}`);
            
            // Try to get contract owner
            if (contract.owner) {
                const owner = await contract.owner().call();
                console.log(`Contract owner: ${owner}`);
                
                if (owner === currentAddress) {
                    console.log('✅ You are the contract owner');
                    return true;
                }
            }
            
            // Check if user is a process server
            const serverAddress = localStorage.getItem('currentServerAddress');
            if (serverAddress === currentAddress) {
                console.log('✅ You are logged in as a process server');
                return true;
            }
            
            console.log('⚠️ You may not have permission to update URIs');
            return false;
            
        } catch (error) {
            console.error('Authorization check failed:', error);
            return false;
        }
    },
    
    // Apply the base64 update to a specific Alert NFT
    async applyUpdate(alertId) {
        console.log(`\n🔄 Applying base64 update to Alert #${alertId}...`);
        
        // Check if update exists
        if (!window.pendingURIUpdates || !window.pendingURIUpdates[alertId]) {
            console.error(`No pending update for Alert #${alertId}`);
            console.log('Run ConvertAlertsToBase64.updateAlertToBase64(' + alertId + ') first');
            return;
        }
        
        const newURI = window.pendingURIUpdates[alertId];
        
        try {
            // Get current URI for comparison
            const currentURI = await window.legalContract.tokenURI(alertId).call();
            
            console.log('Current URI type:', currentURI.startsWith('ipfs://') ? 'IPFS' : 
                                           currentURI.startsWith('data:') ? 'BASE64' : 'OTHER');
            console.log('New URI type: BASE64 DATA URI');
            console.log('New URI size:', (newURI.length / 1024).toFixed(2), 'KB');
            
            // Check authorization
            const authorized = await this.checkAuthorization();
            
            if (!authorized) {
                console.log('\n⚠️ You may need contract owner permissions to update');
                console.log('The new URI has been generated and stored');
                console.log('Contact the contract owner to apply the update');
                
                // Store for later
                this.storeUpdateRequest(alertId, newURI);
                return;
            }
            
            // Attempt to update on blockchain
            console.log('\n📡 Sending transaction to update tokenURI...');
            
            try {
                // This is the actual update call
                const tx = await window.legalContract.setTokenURI(alertId, newURI).send({
                    feeLimit: 100000000,
                    callValue: 0,
                    shouldPollResponse: true
                });
                
                console.log('✅ Transaction sent:', tx);
                console.log(`✅ Alert #${alertId} updated to base64!`);
                console.log('The NFT should now display reliably in all wallets');
                
                // Remove from pending
                delete window.pendingURIUpdates[alertId];
                
                // Store success
                this.recordSuccess(alertId);
                
                return tx;
                
            } catch (txError) {
                console.error('❌ Transaction failed:', txError);
                
                // If setTokenURI doesn't exist or fails, try alternative
                console.log('\n🔧 Attempting alternative update method...');
                
                // Store the update request for manual processing
                this.storeUpdateRequest(alertId, newURI);
                
                console.log('Update request stored. Options:');
                console.log('1. Contact contract owner to apply update');
                console.log('2. Use contract admin interface if available');
                console.log('3. Deploy new version with update function');
            }
            
        } catch (error) {
            console.error('Update failed:', error);
            this.storeUpdateRequest(alertId, newURI);
        }
    },
    
    // Store update request for later processing
    storeUpdateRequest(alertId, newURI) {
        const updates = JSON.parse(localStorage.getItem('pendingTokenURIUpdates') || '{}');
        updates[alertId] = {
            newURI: newURI,
            timestamp: Date.now(),
            type: 'base64',
            status: 'pending'
        };
        localStorage.setItem('pendingTokenURIUpdates', JSON.stringify(updates));
        
        console.log(`\n💾 Update request stored for Alert #${alertId}`);
        console.log('View all pending: ApplyBase64Updates.viewPendingUpdates()');
    },
    
    // Record successful update
    recordSuccess(alertId) {
        const updates = JSON.parse(localStorage.getItem('completedTokenURIUpdates') || '[]');
        updates.push({
            alertId: alertId,
            timestamp: Date.now(),
            type: 'base64'
        });
        localStorage.setItem('completedTokenURIUpdates', JSON.stringify(updates));
    },
    
    // View all pending updates
    viewPendingUpdates() {
        const updates = JSON.parse(localStorage.getItem('pendingTokenURIUpdates') || '{}');
        
        if (Object.keys(updates).length === 0) {
            console.log('No pending updates');
            return;
        }
        
        console.log('\n📋 PENDING TOKEN URI UPDATES:');
        console.log('=' .repeat(50));
        
        Object.entries(updates).forEach(([alertId, data]) => {
            console.log(`\nAlert #${alertId}:`);
            console.log(`  Type: ${data.type}`);
            console.log(`  Size: ${(data.newURI.length / 1024).toFixed(2)} KB`);
            console.log(`  Requested: ${new Date(data.timestamp).toLocaleString()}`);
            console.log(`  Status: ${data.status}`);
        });
        
        console.log('\nTo apply: ApplyBase64Updates.applyUpdate(alertId)');
    },
    
    // Batch apply all pending updates
    async applyAllPending() {
        console.log('\n🚀 APPLYING ALL PENDING UPDATES');
        console.log('=' .repeat(70));
        
        if (!window.pendingURIUpdates) {
            console.log('No pending updates in memory');
            console.log('Run ConvertAlertsToBase64.convertAllAlerts() first');
            return;
        }
        
        const alertIds = Object.keys(window.pendingURIUpdates);
        console.log(`Found ${alertIds.length} pending updates`);
        
        for (const alertId of alertIds) {
            await this.applyUpdate(parseInt(alertId));
            
            // Wait between transactions to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.log('\n✅ Batch update complete');
    },
    
    // Generate update script for contract owner
    generateUpdateScript() {
        if (!window.pendingURIUpdates) {
            console.log('No pending updates');
            return;
        }
        
        console.log('\n📜 UPDATE SCRIPT FOR CONTRACT OWNER:');
        console.log('=' .repeat(70));
        console.log('// Copy and run this script as contract owner:\n');
        
        Object.entries(window.pendingURIUpdates).forEach(([alertId, uri]) => {
            console.log(`// Update Alert #${alertId} to base64`);
            console.log(`await contract.setTokenURI(${alertId}, "${uri.substring(0, 50)}...");`);
            console.log('');
        });
        
        console.log('// End of script');
    }
};

// Auto-check current status
(async () => {
    console.log('\nChecking your authorization level...');
    const authorized = await ApplyBase64Updates.checkAuthorization();
    
    if (authorized) {
        console.log('\n✅ You can apply updates directly');
        console.log('Commands:');
        console.log('  ApplyBase64Updates.applyUpdate(19)     - Update single alert');
        console.log('  ApplyBase64Updates.applyAllPending()   - Update all pending');
    } else {
        console.log('\n⚠️ Limited permissions detected');
        console.log('Updates will be stored for contract owner to apply');
        console.log('Commands:');
        console.log('  ApplyBase64Updates.generateUpdateScript() - Generate script for owner');
        console.log('  ApplyBase64Updates.viewPendingUpdates()   - View pending updates');
    }
})();