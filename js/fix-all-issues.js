/**
 * Comprehensive fixes for all console errors
 * This file patches all known issues in the application
 */

console.log('🔧 Applying comprehensive fixes...');

// Fix 1: BigInt conversion error in notice-workflow.js
if (window.NoticeWorkflow) {
    const originalFetch = NoticeWorkflow.prototype.fetchNoticesFromBlockchain;
    NoticeWorkflow.prototype.fetchNoticesFromBlockchain = async function(serverAddress, startIdx = 0, limit = 100) {
        try {
            console.log('🔍 Fetching notices from blockchain...');
            
            if (!window.legalContract || !window.tronWeb) {
                console.warn('Contract or TronWeb not available');
                return [];
            }

            // Get total notices for the server
            const totalNotices = await legalContract.getServerNoticeCount(serverAddress).call();
            const total = Number(totalNotices.toString()); // Convert BigInt to Number safely
            console.log(`Total notices on blockchain: ${total}`);

            if (total === 0) return [];

            // Fix: Convert BigInt before using Math.min
            const endIdx = Math.min(startIdx + limit, total);
            const notices = [];

            // Fetch notices in batches
            for (let i = startIdx; i < endIdx; i++) {
                try {
                    const noticeId = await legalContract.serverNotices(serverAddress, i).call();
                    const notice = await legalContract.notices(noticeId).call();
                    
                    // Convert BigInt fields to strings
                    const processedNotice = {
                        ...notice,
                        alertId: notice.alertId?.toString(),
                        documentId: notice.documentId?.toString(),
                        timestamp: notice.timestamp?.toString(),
                        noticeId: noticeId?.toString()
                    };
                    
                    notices.push(processedNotice);
                } catch (err) {
                    console.warn(`Error fetching notice ${i}:`, err);
                }
            }

            return notices;
        } catch (error) {
            console.error('❌ Error fetching from blockchain:', error);
            return [];
        }
    };
}

// Fix 2: Data reconciliation error in hybrid-data-service.js
if (window.HybridDataService) {
    const originalReconcile = HybridDataService.prototype.reconcileData;
    HybridDataService.prototype.reconcileData = function(backendData, blockchainData) {
        try {
            console.log(`Reconciling data - Backend: ${backendData.length} Blockchain: ${blockchainData.length}`);
            
            // Ensure both arrays exist and have proper structure
            const safeBackendData = Array.isArray(backendData) ? backendData : [];
            const safeBlockchainData = Array.isArray(blockchainData) ? blockchainData : [];
            
            // Create a map for quick lookup
            const backendMap = new Map();
            safeBackendData.forEach(item => {
                // Handle different data structures
                const id = item.noticeId || item.alertId || item.id;
                if (id) {
                    backendMap.set(id.toString(), item);
                }
            });
            
            // Merge blockchain data
            safeBlockchainData.forEach(bcItem => {
                const id = bcItem.noticeId || bcItem.alertId || bcItem.id;
                if (id) {
                    const existing = backendMap.get(id.toString());
                    if (existing) {
                        // Merge blockchain data into backend data
                        Object.assign(existing, {
                            ...existing,
                            ...bcItem,
                            verifiedOnChain: true
                        });
                    } else {
                        // Add blockchain-only data
                        backendMap.set(id.toString(), {
                            ...bcItem,
                            verifiedOnChain: true,
                            fromBlockchain: true
                        });
                    }
                }
            });
            
            return Array.from(backendMap.values());
        } catch (error) {
            console.error('Reconciliation error:', error);
            return backendData || [];
        }
    };
}

// Fix 3: Ensure admin panel loads process servers automatically
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the admin panel
    setTimeout(() => {
        if (window.isAdmin || window.forceAdminAccess) {
            const adminTabButton = document.getElementById('adminTabButton');
            if (adminTabButton && adminTabButton.style.display !== 'none') {
                // Load process servers if admin panel is visible
                if (typeof loadProcessServers === 'function') {
                    console.log('🔄 Auto-loading process servers for admin...');
                    loadProcessServers();
                }
            }
        }
    }, 2000); // Wait for wallet connection
});

// Fix 4: Fix server ID display to show blockchain ID
if (window.loadProcessServers) {
    const original = window.loadProcessServers;
    window.loadProcessServers = async function() {
        try {
            const result = await original.apply(this, arguments);
            
            // After loading, check blockchain for actual server IDs
            if (window.legalContract && window.allProcessServers) {
                console.log('🔢 Checking blockchain server IDs...');
                
                for (const server of window.allProcessServers) {
                    try {
                        if (server.wallet_address) {
                            const blockchainId = await legalContract.serverIds(server.wallet_address).call();
                            const numericId = Number(blockchainId.toString());
                            
                            if (numericId > 0) {
                                // Format as PS-XXXX
                                server.server_id = `PS-${numericId.toString().padStart(4, '0')}`;
                                console.log(`✓ Server ${server.wallet_address} has blockchain ID: ${server.server_id}`);
                            }
                        }
                    } catch (err) {
                        console.warn(`Could not get blockchain ID for ${server.wallet_address}:`, err);
                    }
                }
                
                // Re-display with updated IDs
                if (typeof displayProcessServers === 'function') {
                    displayProcessServers(window.allProcessServers);
                }
            }
            
            return result;
        } catch (error) {
            console.error('Error in loadProcessServers:', error);
            throw error;
        }
    };
}

// Fix 5: Ensure edit form inputs are properly initialized
window.showInlineEdit = function(walletAddress) {
    console.log(`📝 Opening edit form for: ${walletAddress}`);
    
    // Hide all other edit forms
    document.querySelectorAll('[id^="edit-"]').forEach(el => {
        if (el.id !== `edit-${walletAddress}`) {
            el.style.display = 'none';
        }
    });
    
    // Toggle this edit form
    const editForm = document.getElementById(`edit-${walletAddress}`);
    if (editForm) {
        const isVisible = editForm.style.display === 'block';
        editForm.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            // Ensure inputs are editable
            const inputs = editForm.querySelectorAll('input');
            inputs.forEach(input => {
                input.removeAttribute('readonly');
                input.removeAttribute('disabled');
                input.style.pointerEvents = 'auto';
                input.style.userSelect = 'text';
                console.log(`✓ Enabled input: ${input.id}`);
            });
        }
    } else {
        console.error(`Edit form not found for wallet: ${walletAddress}`);
    }
};

// Fix 6: Patch BigInt serialization for JSON
if (!BigInt.prototype.toJSON) {
    BigInt.prototype.toJSON = function() {
        return this.toString();
    };
}

// Fix 7: Ensure process server data is loaded when switching to admin tab
const originalSwitchTab = window.switchTab;
if (originalSwitchTab) {
    window.switchTab = function(tabName) {
        const result = originalSwitchTab.apply(this, arguments);
        
        if (tabName === 'admin') {
            setTimeout(() => {
                if (typeof loadProcessServers === 'function') {
                    console.log('📋 Loading process servers for admin tab...');
                    loadProcessServers();
                }
            }, 100);
        }
        
        return result;
    };
}

// Fix 8: Handle missing properties in data
window.escapeHtml = function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
};

console.log('✅ All fixes applied successfully!');

// Auto-reload process servers if admin
setTimeout(() => {
    if (window.isAdmin && typeof loadProcessServers === 'function') {
        console.log('🔄 Initial load of process servers...');
        loadProcessServers();
    }
}, 3000);