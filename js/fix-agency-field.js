/**
 * Fix agency field to properly pull from process server data
 */

console.log('🔧 Fixing agency field population...');

// Function to get agency from all available sources
window.getAgencyFromAllSources = async function() {
    console.log('🔍 Searching for agency data from all sources...');
    
    const walletAddress = window.userAddress || (window.tronWeb && window.tronWeb.defaultAddress.base58);
    if (!walletAddress) {
        console.log('No wallet connected');
        return null;
    }
    
    // 1. Try processServerRegistrations (correct key)
    const processServerRegs = JSON.parse(localStorage.getItem('processServerRegistrations') || '{}');
    let serverData = processServerRegs[walletAddress] || processServerRegs[walletAddress.toLowerCase()];
    
    if (serverData?.agency) {
        console.log('✅ Found agency in processServerRegistrations:', serverData.agency);
        return serverData.agency;
    }
    
    // 2. Try serverRegistrations (old key) 
    const serverRegs = JSON.parse(localStorage.getItem('serverRegistrations') || '{}');
    serverData = serverRegs[walletAddress] || serverRegs[walletAddress.toLowerCase()];
    
    if (serverData?.agency) {
        console.log('✅ Found agency in serverRegistrations:', serverData.agency);
        return serverData.agency;
    }
    
    // 3. Try fetching from backend
    try {
        const response = await fetch(`https://nftserviceapp.onrender.com/api/process-servers/${walletAddress}`);
        const data = await response.json();
        
        if (data.success && data.server?.agency) {
            console.log('✅ Found agency from backend:', data.server.agency);
            
            // Update localStorage with backend data
            processServerRegs[walletAddress] = {
                ...processServerRegs[walletAddress],
                agency: data.server.agency,
                name: data.server.name,
                email: data.server.email,
                phone: data.server.phone,
                status: data.server.status
            };
            processServerRegs[walletAddress.toLowerCase()] = processServerRegs[walletAddress];
            localStorage.setItem('processServerRegistrations', JSON.stringify(processServerRegs));
            
            return data.server.agency;
        }
    } catch (error) {
        console.error('Error fetching from backend:', error);
    }
    
    // 4. Try unified notice system data
    if (window.unifiedNoticeSystem?.serverInfo?.agency) {
        console.log('✅ Found agency in unified system:', window.unifiedNoticeSystem.serverInfo.agency);
        return window.unifiedNoticeSystem.serverInfo.agency;
    }
    
    // 5. Check if there's a name but no agency
    const personName = serverData?.name || serverData?.server_name || serverData?.serverName;
    if (personName) {
        console.log('Found person name but no agency:', personName);
        return `${personName} (Individual)`;
    }
    
    console.log('❌ No agency data found in any source');
    return null;
};

// Function to update the agency field
window.updateAgencyField = async function() {
    console.log('📝 Updating agency field...');
    
    const agencyField = document.getElementById('issuingAgency');
    const agencyNameField = document.getElementById('agencyName');
    
    const agency = await getAgencyFromAllSources();
    
    if (agency) {
        if (agencyField) {
            agencyField.value = agency;
            agencyField.style.color = 'var(--text-primary)';
            agencyField.style.background = 'var(--gray-800)';
            console.log('✅ Updated issuingAgency field:', agency);
        }
        
        if (agencyNameField) {
            agencyNameField.value = agency;
            agencyNameField.style.color = 'var(--text-primary)';
            console.log('✅ Updated agencyName field:', agency);
        }
    } else {
        if (agencyField) {
            agencyField.value = 'No agency found - Please update your profile';
            agencyField.style.color = 'var(--danger)';
        }
        
        if (agencyNameField) {
            agencyNameField.value = '';
            agencyNameField.placeholder = 'Please register or update your profile first';
        }
    }
};

// Remove the hardcoded default value
const removeDefaultValue = function() {
    const agencyField = document.getElementById('issuingAgency');
    if (agencyField && agencyField.value === 'Process Server') {
        agencyField.value = '';
        console.log('Removed hardcoded default value');
    }
};

// Auto-update when page loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(async () => {
        removeDefaultValue();
        await updateAgencyField();
    }, 1000);
});

// Update when switching to create tab
const originalSwitchTab = window.switchTab;
if (originalSwitchTab) {
    window.switchTab = function(tabName) {
        const result = originalSwitchTab.apply(this, arguments);
        
        if (tabName === 'create') {
            setTimeout(async () => {
                removeDefaultValue();
                await updateAgencyField();
            }, 500);
        }
        
        return result;
    };
}

// Override the setIssuingAgency function
window.setIssuingAgency = async function() {
    console.log('setIssuingAgency called - using new implementation');
    await updateAgencyField();
};

// Manual refresh function
window.refreshAgencyField = async function() {
    console.log('⚡ Manual agency field refresh...');
    removeDefaultValue();
    const agency = await updateAgencyField();
    console.log('Agency field updated to:', agency);
    return agency;
};

console.log('✅ Agency field fix loaded!');
console.log('   - Auto-updates from process server data');
console.log('   - Checks multiple data sources');
console.log('   - Use refreshAgencyField() to manually update');