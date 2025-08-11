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

// Fix 5: Override displayProcessServers to properly create edit forms
const originalDisplayProcessServers = window.displayProcessServers;
window.displayProcessServers = function(servers) {
    const container = document.getElementById('processServersList');
    
    if (!servers || servers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>No process servers registered</h3>
                <p>Add servers using the "Add Server" button</p>
            </div>
        `;
        return;
    }
    
    // Clear container
    container.innerHTML = '';
    
    servers.forEach(server => {
        const serverCard = document.createElement('div');
        serverCard.className = 'server-card';
        
        // Create main server info
        const mainInfo = document.createElement('div');
        mainInfo.innerHTML = `
            <div class="server-header">
                <h3>${server.name || 'Unnamed Server'}</h3>
                <span class="status-badge ${server.status || 'pending'}">${server.status || 'pending'}</span>
            </div>
            <div class="server-details">
                <div><strong>Server ID:</strong> ${server.server_id || server.display_server_id || 'Pending'}</div>
                <div><strong>Wallet:</strong> ${server.wallet_address}</div>
                <div><strong>Agency:</strong> ${server.agency || 'N/A'}</div>
                <div><strong>Email:</strong> ${server.email || 'N/A'}</div>
                <div><strong>Phone:</strong> ${server.phone || 'N/A'}</div>
                <div><strong>License:</strong> ${server.license_number || 'N/A'}</div>
                <div><strong>Jurisdiction:</strong> ${server.jurisdiction || 'N/A'}</div>
                <div><strong>Total Notices:</strong> ${server.total_notices_served || 0}</div>
            </div>
            <div class="server-actions">
                <button onclick="showInlineEdit('${server.wallet_address}')" class="btn btn-primary">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="deleteProcessServer('${server.wallet_address}')" class="btn btn-danger">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        serverCard.appendChild(mainInfo);
        
        // Create edit form using DOM manipulation
        const editForm = document.createElement('div');
        editForm.id = `edit-${server.wallet_address}`;
        editForm.style.display = 'none';
        editForm.style.marginTop = '1rem';
        editForm.style.padding = '1rem';
        editForm.style.background = 'var(--gray-800)';
        editForm.style.borderRadius = '8px';
        
        // Create form content using DOM
        const formTitle = document.createElement('h4');
        formTitle.textContent = 'Edit Process Server';
        editForm.appendChild(formTitle);
        
        const formGrid = document.createElement('div');
        formGrid.style.display = 'grid';
        formGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        formGrid.style.gap = '1rem';
        
        // Create input fields
        const fields = [
            { name: 'name', label: 'Name', value: server.name || '' },
            { name: 'agency', label: 'Agency', value: server.agency || '' },
            { name: 'email', label: 'Email', value: server.email || '' },
            { name: 'phone', label: 'Phone', value: server.phone || '' },
            { name: 'license', label: 'License Number', value: server.license_number || '' },
            { name: 'jurisdiction', label: 'Jurisdiction', value: server.jurisdiction || '' }
        ];
        
        fields.forEach(field => {
            const fieldDiv = document.createElement('div');
            
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.marginBottom = '0.25rem';
            label.style.color = 'var(--text-secondary)';
            label.textContent = field.label;
            fieldDiv.appendChild(label);
            
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-input edit-input';
            input.id = `edit-${field.name}-${server.wallet_address}`;
            input.value = field.value;
            input.style.width = '100%';
            input.style.padding = '0.5rem';
            input.style.background = 'var(--gray-700)';
            input.style.border = '1px solid var(--gray-600)';
            input.style.borderRadius = '4px';
            input.style.color = 'var(--text-primary)';
            fieldDiv.appendChild(input);
            
            formGrid.appendChild(fieldDiv);
        });
        
        editForm.appendChild(formGrid);
        
        // Create buttons
        const buttonDiv = document.createElement('div');
        buttonDiv.style.marginTop = '1rem';
        buttonDiv.style.display = 'flex';
        buttonDiv.style.gap = '0.5rem';
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-success';
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
        saveBtn.onclick = () => saveProcessServer(server.wallet_address);
        buttonDiv.appendChild(saveBtn);
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
        cancelBtn.onclick = () => cancelInlineEdit(server.wallet_address);
        buttonDiv.appendChild(cancelBtn);
        
        editForm.appendChild(buttonDiv);
        serverCard.appendChild(editForm);
        
        container.appendChild(serverCard);
    });
};

// Fix showInlineEdit to work with properly created forms
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