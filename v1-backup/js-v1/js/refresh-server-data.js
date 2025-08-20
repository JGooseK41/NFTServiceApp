/**
 * Refresh server data after updates
 */

console.log('🔧 Initializing server data refresh system...');

// Function to refresh server data from backend
window.refreshServerData = async function() {
    console.log('🔄 Refreshing server data from backend...');
    
    try {
        const address = window.userAddress || (window.tronWeb && window.tronWeb.defaultAddress.base58);
        if (!address) {
            console.log('No wallet connected');
            return;
        }
        
        // Fetch updated data from backend
        const response = await fetch(`https://nftserviceapp.onrender.com/api/process-servers/${address}`);
        const data = await response.json();
        
        if (data.success && data.server) {
            console.log('✅ Got updated server data:', data.server);
            
            // Update localStorage with new data
            const registrations = JSON.parse(localStorage.getItem('processServerRegistrations') || '{}');
            
            // Update the registration with backend data
            registrations[address] = {
                ...registrations[address],
                agency: data.server.agency,
                agencyName: data.server.agency,
                agency_name: data.server.agency,
                name: data.server.name,
                serverName: data.server.name,
                server_name: data.server.name,
                email: data.server.email,
                agencyEmail: data.server.email,
                phone: data.server.phone,
                serverPhone: data.server.phone,
                jurisdiction: data.server.jurisdiction,
                license: data.server.license_number,
                licenseNumber: data.server.license_number,
                license_number: data.server.license_number,
                status: data.server.status || 'approved',
                wallet_address: address,
                walletAddress: address
            };
            
            // Also update lowercase version
            registrations[address.toLowerCase()] = registrations[address];
            
            // Save to localStorage
            localStorage.setItem('processServerRegistrations', JSON.stringify(registrations));
            console.log('✅ Updated localStorage with server data');
            
            // Update global variable if it exists
            if (window.allProcessServers) {
                const serverIndex = window.allProcessServers.findIndex(s => 
                    s.wallet_address === address || s.wallet_address === address.toLowerCase()
                );
                if (serverIndex >= 0) {
                    window.allProcessServers[serverIndex] = data.server;
                }
            }
            
            // Update the agency field if it's visible
            const agencyField = document.getElementById('agencyName');
            if (agencyField && data.server.agency) {
                agencyField.value = data.server.agency;
                agencyField.style.color = 'var(--text-primary)';
                console.log('✅ Updated agency field with:', data.server.agency);
            }
            
            // Show success notification
            if (window.showNotification) {
                showNotification('Server data refreshed successfully!', 'success');
            }
            
            return data.server;
        }
    } catch (error) {
        console.error('Error refreshing server data:', error);
    }
};

// Override the save functions to refresh data after save
const originalSaveModalData = window.saveModalData;
if (originalSaveModalData) {
    window.saveModalData = async function(walletAddress) {
        const result = await originalSaveModalData.apply(this, arguments);
        
        // Refresh data after successful save
        setTimeout(() => {
            refreshServerData();
        }, 1000);
        
        return result;
    };
}

// Also refresh when switching to the create tab
const originalSwitchTab = window.switchTab;
if (originalSwitchTab) {
    window.switchTab = function(tabName) {
        const result = originalSwitchTab.apply(this, arguments);
        
        if (tabName === 'create') {
            // Refresh server data when switching to create tab
            setTimeout(() => {
                refreshServerData();
            }, 500);
        }
        
        return result;
    };
}

// Add refresh button to admin panel
window.addRefreshButton = function() {
    const adminContent = document.getElementById('adminContent');
    if (!adminContent) return;
    
    // Check if button already exists
    if (document.getElementById('refreshServerDataBtn')) return;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'refreshServerDataBtn';
    refreshBtn.className = 'btn btn-primary';
    refreshBtn.innerHTML = '🔄 Refresh My Server Data';
    refreshBtn.style.cssText = `
        margin: 10px;
        padding: 12px 20px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
    `;
    
    refreshBtn.onclick = async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '⏳ Refreshing...';
        
        await refreshServerData();
        
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '🔄 Refresh My Server Data';
    };
    
    // Add button at the top of admin content
    adminContent.insertBefore(refreshBtn, adminContent.firstChild);
};

// Auto-add refresh button when admin tab loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (document.getElementById('adminTab')) {
            addRefreshButton();
        }
    }, 2000);
});

// Manual refresh function for console
window.forceRefreshServerData = async function() {
    console.log('⚡ Force refreshing server data...');
    const data = await refreshServerData();
    console.log('Server data:', data);
    return data;
};

console.log('✅ Server data refresh system ready!');
console.log('   - Data auto-refreshes after saves');
console.log('   - Data refreshes when switching to Create tab');
console.log('   - Use refreshServerData() to manually refresh');
console.log('   - Click "Refresh My Server Data" button in admin panel');