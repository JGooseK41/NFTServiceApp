/**
 * Clear Test Data and Force Blockchain Sync
 * This script removes all test data and forces a fresh sync from the blockchain
 */

async function clearAllTestData() {
    console.log('🧹 Clearing all test data and forcing blockchain sync...');
    
    try {
        // Clear all localStorage items related to notices
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
                key.includes('blockchain_notices') ||
                key.includes('served_notices') ||
                key.includes('delivery_') ||
                key.includes('cache_') ||
                key.includes('test') ||
                key.includes('TEST')
            )) {
                keysToRemove.push(key);
            }
        }
        
        // Remove all identified keys
        keysToRemove.forEach(key => {
            console.log(`Removing localStorage key: ${key}`);
            localStorage.removeItem(key);
        });
        
        // Clear sessionStorage as well
        sessionStorage.clear();
        
        console.log(`✅ Cleared ${keysToRemove.length} cached items`);
        
        // Force refresh from blockchain using the new workflow
        if (window.noticeWorkflow) {
            console.log('🔄 Fetching fresh data from blockchain...');
            
            // Get current server address
            const serverAddress = tronWeb?.defaultAddress?.base58;
            
            if (serverAddress) {
                // Force refresh from blockchain
                const notices = await window.noticeWorkflow.fetchNoticesFromBlockchain(serverAddress, true);
                console.log(`✅ Fetched ${notices.length} real notices from blockchain`);
                
                // Filter out any test data
                const realNotices = notices.filter(n => {
                    // Remove any notices with TEST in case number
                    if (n.caseNumber && n.caseNumber.includes('TEST')) return false;
                    // Remove any notices with test addresses
                    if (n.recipientAddress && n.recipientAddress.includes('test')) return false;
                    return true;
                });
                
                console.log(`✅ ${realNotices.length} real notices after filtering`);
                
                // Update the dashboard if it's loaded
                if (window.serverDashboard) {
                    await window.serverDashboard.loadServerCases();
                    window.serverDashboard.updateDisplay();
                }
                
                return realNotices;
            } else {
                console.error('❌ No wallet connected');
                return [];
            }
        } else {
            console.error('❌ Workflow system not loaded');
            
            // Fallback: try the old refresh method
            if (window.refreshDeliveryStatus) {
                await window.refreshDeliveryStatus(true);
            }
        }
        
    } catch (error) {
        console.error('❌ Error clearing test data:', error);
        throw error;
    }
}

/**
 * Get only real blockchain data
 */
async function getRealBlockchainData() {
    console.log('📡 Fetching real blockchain data...');
    
    if (!window.legalContract || !tronWeb.defaultAddress) {
        console.error('Contract or wallet not connected');
        return [];
    }
    
    try {
        const serverAddress = tronWeb.defaultAddress.base58;
        const notices = [];
        
        // Get total supply directly from contract
        const totalSupply = await window.legalContract.totalSupply().call();
        console.log(`Total NFTs on blockchain: ${totalSupply}`);
        
        // Fetch each notice
        for (let i = 0; i < Math.min(totalSupply, 100); i++) {
            try {
                // Check if token exists
                const exists = await window.legalContract.exists(i).call();
                if (!exists) continue;
                
                // Get token owner
                const owner = await window.legalContract.ownerOf(i).call();
                const ownerAddress = tronWeb.address.fromHex(owner);
                
                // Only get notices for current server
                if (ownerAddress.toLowerCase() === serverAddress.toLowerCase()) {
                    // Get token URI and metadata
                    const uri = await window.legalContract.tokenURI(i).call();
                    
                    // Parse the notice data
                    const notice = {
                        id: i.toString(),
                        owner: ownerAddress,
                        serverAddress: serverAddress,
                        tokenUri: uri,
                        isReal: true // Mark as real blockchain data
                    };
                    
                    // Try to get additional data from events
                    try {
                        const events = await tronWeb.event.getEventsByContractAddress(
                            window.CONTRACT_ADDRESS,
                            {
                                onlyConfirmed: true,
                                eventName: 'LegalNoticeCreated',
                                limit: 200
                            }
                        );
                        
                        // Find event for this token
                        const tokenEvent = events.find(e => 
                            e.result && (
                                e.result.noticeId == i ||
                                e.result.alertId == i ||
                                e.result.documentId == i
                            )
                        );
                        
                        if (tokenEvent) {
                            notice.caseNumber = tokenEvent.result.caseNumber || '';
                            notice.recipientAddress = tronWeb.address.fromHex(tokenEvent.result.recipient);
                            notice.noticeType = tokenEvent.result.noticeType || '';
                            notice.issuingAgency = tokenEvent.result.issuingAgency || '';
                            notice.transactionHash = tokenEvent.transaction;
                        }
                    } catch (eventError) {
                        console.warn('Could not fetch events for token', i, eventError);
                    }
                    
                    // Only add if it's not test data
                    if (!notice.caseNumber?.includes('TEST')) {
                        notices.push(notice);
                    }
                }
                
            } catch (error) {
                console.warn(`Error fetching token ${i}:`, error);
            }
        }
        
        console.log(`✅ Found ${notices.length} real notices for server ${serverAddress}`);
        return notices;
        
    } catch (error) {
        console.error('❌ Error fetching blockchain data:', error);
        return [];
    }
}

/**
 * Initialize clean data on page load
 */
async function initializeCleanData() {
    console.log('🚀 Initializing with clean blockchain data...');
    
    // Wait for TronWeb to be ready
    const waitForTronWeb = async () => {
        if (window.tronWeb && window.tronWeb.ready) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        return waitForTronWeb();
    };
    
    await waitForTronWeb();
    
    // Clear test data and fetch real data
    const realNotices = await clearAllTestData();
    
    // Display the real data
    if (realNotices && realNotices.length > 0) {
        console.log('✅ Successfully loaded real blockchain data');
        
        // Show notification
        if (window.uiManager) {
            window.uiManager.showNotification('success', 
                `Loaded ${realNotices.length} real notices from blockchain`
            );
        }
    } else {
        console.log('ℹ️ No notices found for your address');
    }
    
    return realNotices;
}

// Export functions
window.clearAllTestData = clearAllTestData;
window.getRealBlockchainData = getRealBlockchainData;
window.initializeCleanData = initializeCleanData;

// Auto-run on page load if delivery tab is active
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the delivery tab
    const deliveryTab = document.getElementById('deliveryTab');
    if (deliveryTab && deliveryTab.style.display !== 'none') {
        setTimeout(() => {
            console.log('Auto-clearing test data on delivery tab load...');
            initializeCleanData();
        }, 2000);
    }
});

console.log('✅ Test data cleaner loaded. Use clearAllTestData() to remove test data.');