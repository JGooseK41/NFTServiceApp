/**
 * Process Server Deactivation System
 */

console.log('🔧 Initializing deactivation system...');

// Add deactivation button to modal
window.addDeactivationToModal = function(walletAddress, currentStatus) {
    console.log('Adding deactivation controls for:', walletAddress, 'Status:', currentStatus);
    
    // Wait for modal content to be ready
    setTimeout(() => {
        const modalContent = document.getElementById('modalContent');
        if (!modalContent) return;
        
        // Find the buttons container
        const buttonsDiv = modalContent.querySelector('div[style*="display: flex"]');
        if (!buttonsDiv) return;
        
        // Add status toggle button
        const isActive = currentStatus === 'approved';
        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.innerHTML = isActive ? '🚫 Suspend' : '✅ Activate';
        toggleButton.style.cssText = `
            flex: 1;
            padding: 12px;
            background: ${isActive ? '#dc2626' : '#10b981'};
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 16px;
            transition: background 0.2s;
            margin-right: 10px;
        `;
        
        toggleButton.onclick = () => toggleServerStatus(walletAddress, isActive);
        
        // Insert before the save button
        buttonsDiv.insertBefore(toggleButton, buttonsDiv.firstChild);
        
        // Also add current status display
        const statusDiv = document.createElement('div');
        statusDiv.innerHTML = `
            <div style="margin-bottom: 15px; padding: 10px; background: ${isActive ? '#065f46' : '#7f1d1d'}; border-radius: 6px;">
                <label style="display: block; margin-bottom: 5px; color: #9ca3af; font-weight: bold;">Current Status</label>
                <span style="color: ${isActive ? '#10b981' : '#dc2626'}; font-weight: bold; font-size: 16px;">
                    ${isActive ? '✅ ACTIVE' : '🚫 SUSPENDED'}
                </span>
            </div>
        `;
        
        // Add status display at the top of the form
        const form = modalContent.querySelector('form');
        if (form && form.firstChild) {
            form.insertBefore(statusDiv, form.children[1]); // After wallet address
        }
    }, 100);
};

// Toggle server status function
window.toggleServerStatus = async function(walletAddress, currentlyActive) {
    const action = currentlyActive ? 'suspend' : 'activate';
    const confirmMsg = currentlyActive 
        ? '⚠️ Are you sure you want to SUSPEND this process server?\n\nThey will no longer be able to serve notices.'
        : '✅ Are you sure you want to ACTIVATE this process server?\n\nThey will be able to serve notices again.';
    
    if (!confirm(confirmMsg)) return;
    
    console.log(`${action}ing server:`, walletAddress);
    
    try {
        const newStatus = currentlyActive ? 'suspended' : 'approved';
        
        const response = await fetch(`https://nftserviceapp.onrender.com/api/process-servers/${walletAddress}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ Process server ${currentlyActive ? 'SUSPENDED' : 'ACTIVATED'} successfully!`);
            
            // Close modal and reload
            if (window.closeModal) window.closeModal();
            
            // Reload the process servers list
            if (typeof loadProcessServers === 'function') {
                loadProcessServers();
            } else {
                location.reload();
            }
        } else {
            alert('❌ Error: ' + (result.error || 'Failed to update status'));
        }
    } catch (error) {
        console.error('Status toggle error:', error);
        alert('❌ Error: ' + error.message);
    }
};

// Override showInlineEdit to include deactivation controls
const originalShowInlineEdit = window.showInlineEdit;
window.showInlineEdit = function(walletAddress) {
    // Call original function
    if (originalShowInlineEdit) {
        originalShowInlineEdit(walletAddress);
    }
    
    // Add deactivation controls
    const server = window.allProcessServers?.find(s => 
        s.wallet_address === walletAddress || 
        s.wallet_address === walletAddress.toLowerCase()
    );
    
    if (server) {
        addDeactivationToModal(walletAddress, server.status);
    }
};

// Add quick deactivate buttons to the process server list
window.addQuickDeactivateButtons = function() {
    console.log('Adding quick deactivate buttons...');
    
    // Find all server cards
    document.querySelectorAll('.server-info').forEach(card => {
        // Get wallet address from the card
        const editBtn = card.querySelector('button[onclick*="showInlineEdit"]');
        if (!editBtn) return;
        
        const onclickStr = editBtn.getAttribute('onclick');
        const match = onclickStr?.match(/showInlineEdit\(['"]([^'"]+)['"]\)/);
        if (!match) return;
        
        const walletAddress = match[1];
        const server = window.allProcessServers?.find(s => 
            s.wallet_address === walletAddress || 
            s.wallet_address === walletAddress.toLowerCase()
        );
        
        if (!server) return;
        
        // Check if button already exists
        if (card.querySelector('.quick-deactivate-btn')) return;
        
        // Create quick toggle button
        const isActive = server.status === 'approved';
        const quickBtn = document.createElement('button');
        quickBtn.className = 'quick-deactivate-btn btn btn-small';
        quickBtn.innerHTML = isActive ? '🚫 Suspend' : '✅ Activate';
        quickBtn.style.cssText = `
            background: ${isActive ? '#dc2626' : '#10b981'};
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            margin-left: 10px;
        `;
        
        quickBtn.onclick = () => toggleServerStatus(walletAddress, isActive);
        
        // Add button next to Edit button
        editBtn.parentNode.insertBefore(quickBtn, editBtn.nextSibling);
        
        // Also add status indicator
        const statusBadge = document.createElement('span');
        statusBadge.style.cssText = `
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 10px;
            background: ${isActive ? '#065f46' : '#7f1d1d'};
            color: ${isActive ? '#10b981' : '#dc2626'};
        `;
        statusBadge.textContent = isActive ? 'ACTIVE' : 'SUSPENDED';
        
        // Add to server name area
        const nameElement = card.querySelector('h3, .server-name');
        if (nameElement) {
            nameElement.appendChild(statusBadge);
        }
    });
};

// Auto-add buttons when process servers are loaded
const originalDisplayProcessServers = window.displayProcessServers;
if (originalDisplayProcessServers) {
    window.displayProcessServers = function(servers) {
        const result = originalDisplayProcessServers.apply(this, arguments);
        setTimeout(addQuickDeactivateButtons, 500);
        return result;
    };
}

// Also hook into loadProcessServers
const originalLoadProcessServers = window.loadProcessServers;
if (originalLoadProcessServers) {
    window.loadProcessServers = async function() {
        const result = await originalLoadProcessServers.apply(this, arguments);
        setTimeout(addQuickDeactivateButtons, 500);
        return result;
    };
}

console.log('✅ Deactivation system ready!');
console.log('   - Edit modal will show Activate/Deactivate button');
console.log('   - Quick toggle buttons added to process server list');
console.log('   - Status badges show current state');