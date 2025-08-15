/**
 * Diagnostic tool for registration data issues
 */

console.log('🔍 Running registration diagnostic...');

window.diagnoseRegistration = async function() {
    console.log('\n=== REGISTRATION DIAGNOSTIC REPORT ===\n');
    
    // 1. Check wallet connection
    const walletAddress = window.userAddress || (window.tronWeb && window.tronWeb.defaultAddress?.base58);
    console.log('1. Wallet Address:', walletAddress || 'NOT CONNECTED');
    
    if (!walletAddress) {
        console.error('❌ No wallet connected. Connect your wallet first.');
        return;
    }
    
    // 2. Check all localStorage keys
    console.log('\n2. LocalStorage Data:');
    const keys = [
        'processServerRegistrations',
        'serverRegistrations', 
        'registrations',
        'process_servers',
        `server_profile_${walletAddress}`
    ];
    
    keys.forEach(key => {
        const data = localStorage.getItem(key);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                console.log(`  ✅ ${key}:`, parsed[walletAddress] || parsed[walletAddress.toLowerCase()] || 'No data for this wallet');
            } catch (e) {
                console.log(`  ⚠️ ${key}: Invalid JSON`);
            }
        } else {
            console.log(`  ❌ ${key}: Not found`);
        }
    });
    
    // 3. Check backend data
    console.log('\n3. Backend Data:');
    try {
        const response = await fetch(`https://nftserviceapp.onrender.com/api/process-servers/${walletAddress}`);
        const data = await response.json();
        
        if (data.success && data.server) {
            console.log('  ✅ Server found in backend:', data.server);
            return data.server;
        } else {
            console.log('  ❌ No server data in backend:', data.error || 'Not found');
        }
    } catch (error) {
        console.error('  ❌ Backend fetch error:', error);
    }
    
    // 4. Check all process servers
    console.log('\n4. Fetching all process servers...');
    try {
        const response = await fetch('https://nftserviceapp.onrender.com/api/process-servers');
        const data = await response.json();
        
        if (data.success) {
            const yourServer = data.servers.find(s => 
                s.wallet_address === walletAddress || 
                s.wallet_address === walletAddress.toLowerCase()
            );
            
            if (yourServer) {
                console.log('  ✅ Found your server in list:', yourServer);
                return yourServer;
            } else {
                console.log('  ❌ Your wallet not in server list');
                console.log('  Available servers:', data.servers.map(s => s.wallet_address));
            }
        }
    } catch (error) {
        console.error('  ❌ Error fetching all servers:', error);
    }
    
    console.log('\n=== END DIAGNOSTIC ===\n');
};

// Auto-sync function to fix the issue
window.syncRegistrationData = async function() {
    console.log('🔄 Syncing registration data from backend...');
    
    const walletAddress = window.userAddress || (window.tronWeb && window.tronWeb.defaultAddress?.base58);
    if (!walletAddress) {
        console.error('No wallet connected');
        return;
    }
    
    try {
        // Try to get from specific endpoint first
        let serverData = null;
        let response = await fetch(`https://nftserviceapp.onrender.com/api/process-servers/${walletAddress}`);
        let data = await response.json();
        
        if (data.success && data.server) {
            serverData = data.server;
        } else {
            // Fall back to getting all servers
            response = await fetch('https://nftserviceapp.onrender.com/api/process-servers');
            data = await response.json();
            
            if (data.success) {
                serverData = data.servers.find(s => 
                    s.wallet_address === walletAddress || 
                    s.wallet_address === walletAddress.toLowerCase()
                );
            }
        }
        
        if (serverData) {
            console.log('✅ Found server data:', serverData);
            
            // Update processServerRegistrations
            const registrations = JSON.parse(localStorage.getItem('processServerRegistrations') || '{}');
            
            const registration = {
                wallet_address: walletAddress,
                walletAddress: walletAddress,
                agency: serverData.agency || '',
                agencyName: serverData.agency || '',
                agency_name: serverData.agency || '',
                name: serverData.name || '',
                serverName: serverData.name || '',
                server_name: serverData.name || '',
                email: serverData.email || '',
                agencyEmail: serverData.email || '',
                phone: serverData.phone || '',
                serverPhone: serverData.phone || '',
                jurisdiction: serverData.jurisdiction || '',
                license: serverData.license_number || '',
                licenseNumber: serverData.license_number || '',
                license_number: serverData.license_number || '',
                status: serverData.status || 'approved',
                server_id: serverData.server_id || '',
                serverId: serverData.server_id || ''
            };
            
            // Store under both cases
            registrations[walletAddress] = registration;
            registrations[walletAddress.toLowerCase()] = registration;
            
            // Save to localStorage
            localStorage.setItem('processServerRegistrations', JSON.stringify(registrations));
            
            // Also update serverRegistrations for backward compatibility
            localStorage.setItem('serverRegistrations', JSON.stringify(registrations));
            
            console.log('✅ Updated localStorage with registration data');
            
            // Update the agency field
            if (window.updateAgencyField) {
                await window.updateAgencyField();
            }
            
            // Update global variable
            window.currentServerData = serverData;
            
            // Show success
            if (window.showNotification) {
                showNotification('Registration data synced successfully!', 'success');
            }
            
            return registration;
        } else {
            console.error('❌ No server data found for wallet:', walletAddress);
            console.log('You may need to register as a process server first.');
        }
    } catch (error) {
        console.error('❌ Sync error:', error);
    }
};

// Add sync button to the page
window.addSyncButton = function() {
    // Check if button already exists
    if (document.getElementById('syncRegistrationBtn')) return;
    
    const createTab = document.getElementById('createTab');
    if (!createTab) return;
    
    const syncBtn = document.createElement('button');
    syncBtn.id = 'syncRegistrationBtn';
    syncBtn.className = 'btn btn-primary';
    syncBtn.innerHTML = '🔄 Sync Registration Data';
    syncBtn.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        z-index: 1000;
        padding: 10px 20px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    
    syncBtn.onclick = async () => {
        syncBtn.disabled = true;
        syncBtn.innerHTML = '⏳ Syncing...';
        
        await diagnoseRegistration();
        await syncRegistrationData();
        
        syncBtn.disabled = false;
        syncBtn.innerHTML = '🔄 Sync Registration Data';
    };
    
    document.body.appendChild(syncBtn);
};

// Auto-run diagnostic and sync
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(async () => {
        console.log('🚀 Auto-running registration sync...');
        await diagnoseRegistration();
        await syncRegistrationData();
        addSyncButton();
    }, 2000);
});

// Manual commands
console.log('📋 Registration diagnostic commands:');
console.log('   diagnoseRegistration() - Check all registration data');
console.log('   syncRegistrationData() - Sync from backend to localStorage');
console.log('   addSyncButton() - Add sync button to page');