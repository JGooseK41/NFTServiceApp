/**
 * Force immediate update of issuing agency field
 */

console.log('🔧 Forcing agency field update...');

// Function to directly set agency field
window.forceSetAgency = function(agencyName) {
    console.log(`📝 Force setting agency to: ${agencyName}`);
    
    const agencyField = document.getElementById('issuingAgency');
    const agencyNameField = document.getElementById('agencyName');
    
    if (agencyField) {
        // Remove readonly attribute temporarily
        agencyField.removeAttribute('readonly');
        
        // Set the value
        agencyField.value = agencyName;
        
        // Update styles
        agencyField.style.color = '#10b981'; // Green color
        agencyField.style.background = 'var(--gray-800)';
        agencyField.style.fontWeight = 'bold';
        
        // Make it readonly again
        agencyField.setAttribute('readonly', true);
        
        console.log('✅ issuingAgency field updated to:', agencyName);
    }
    
    if (agencyNameField) {
        agencyNameField.value = agencyName;
        agencyNameField.style.color = '#10b981';
        console.log('✅ agencyName field updated to:', agencyName);
    }
    
    // Also update localStorage to persist
    const walletAddress = window.userAddress || (window.tronWeb && window.tronWeb.defaultAddress?.base58);
    if (walletAddress) {
        const registrations = JSON.parse(localStorage.getItem('processServerRegistrations') || '{}');
        
        if (!registrations[walletAddress]) {
            registrations[walletAddress] = {};
        }
        
        registrations[walletAddress].agency = agencyName;
        registrations[walletAddress].agencyName = agencyName;
        registrations[walletAddress].agency_name = agencyName;
        
        // Also store lowercase
        registrations[walletAddress.toLowerCase()] = registrations[walletAddress];
        
        localStorage.setItem('processServerRegistrations', JSON.stringify(registrations));
        localStorage.setItem('serverRegistrations', JSON.stringify(registrations));
        
        console.log('✅ Updated localStorage with agency:', agencyName);
    }
    
    return agencyName;
};

// Function to fetch from backend and update
window.fetchAndUpdateAgency = async function() {
    console.log('🔄 Fetching agency from backend...');
    
    const walletAddress = window.userAddress || (window.tronWeb && window.tronWeb.defaultAddress?.base58);
    if (!walletAddress) {
        console.error('No wallet connected');
        forceSetAgency('The Block Service'); // Set default
        return;
    }
    
    try {
        // Try multiple endpoints
        const urls = [
            `https://nftserviceapp.onrender.com/api/process-servers/${walletAddress}`,
            `https://nftserviceapp.onrender.com/api/servers/${walletAddress}/profile`,
            `https://nftserviceapp.onrender.com/api/admin/process-servers/${walletAddress}`
        ];
        
        for (const url of urls) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    
                    const agency = data.server?.agency || 
                                  data.agency || 
                                  data.processServer?.agency ||
                                  data.profile?.agency;
                    
                    if (agency && agency !== 'Unknown Agency') {
                        console.log(`✅ Found agency from ${url}:`, agency);
                        forceSetAgency(agency);
                        return agency;
                    }
                }
            } catch (e) {
                console.log(`Failed to fetch from ${url}`);
            }
        }
        
        // If nothing found, set default
        console.log('No agency found in backend, using default');
        forceSetAgency('The Block Service');
        
    } catch (error) {
        console.error('Error fetching agency:', error);
        forceSetAgency('The Block Service');
    }
};

// Override the setIssuingAgency function completely
window.setIssuingAgency = function() {
    console.log('setIssuingAgency called - using force update');
    
    // First check localStorage
    const walletAddress = window.userAddress || (window.tronWeb && window.tronWeb.defaultAddress?.base58);
    if (walletAddress) {
        const registrations = JSON.parse(localStorage.getItem('processServerRegistrations') || '{}');
        const serverData = registrations[walletAddress] || registrations[walletAddress.toLowerCase()];
        
        if (serverData?.agency && serverData.agency !== 'Unknown Agency') {
            forceSetAgency(serverData.agency);
            return;
        }
    }
    
    // If no local data, fetch from backend
    fetchAndUpdateAgency();
};

// Watch for tab changes
let lastTab = null;
setInterval(() => {
    const createTab = document.getElementById('createTab');
    if (createTab && createTab.style.display !== 'none' && lastTab !== 'create') {
        lastTab = 'create';
        console.log('📋 Create tab detected, updating agency...');
        
        // Check if field needs update
        const agencyField = document.getElementById('issuingAgency');
        if (agencyField && (!agencyField.value || agencyField.value === '' || 
            agencyField.value === 'Process Server' || 
            agencyField.value.includes('No registration') ||
            agencyField.value.includes('loading'))) {
            
            // Try localStorage first
            const walletAddress = window.userAddress || (window.tronWeb && window.tronWeb.defaultAddress?.base58);
            if (walletAddress) {
                const registrations = JSON.parse(localStorage.getItem('processServerRegistrations') || '{}');
                const serverData = registrations[walletAddress] || registrations[walletAddress.toLowerCase()];
                
                if (serverData?.agency && serverData.agency !== 'Unknown Agency') {
                    forceSetAgency(serverData.agency);
                } else {
                    fetchAndUpdateAgency();
                }
            } else {
                forceSetAgency('The Block Service');
            }
        }
    } else if (createTab && createTab.style.display === 'none') {
        lastTab = null;
    }
}, 1000);

// Run immediately
setTimeout(() => {
    const agencyField = document.getElementById('issuingAgency');
    if (agencyField && (!agencyField.value || agencyField.value === '' || 
        agencyField.value === 'Process Server' || 
        agencyField.value.includes('No registration'))) {
        
        console.log('🚀 Initial agency update...');
        
        // Check localStorage first for speed
        const walletAddress = window.userAddress || (window.tronWeb && window.tronWeb.defaultAddress?.base58);
        if (walletAddress) {
            const registrations = JSON.parse(localStorage.getItem('processServerRegistrations') || '{}');
            const serverData = registrations[walletAddress] || registrations[walletAddress.toLowerCase()];
            
            if (serverData?.agency && serverData.agency !== 'Unknown Agency') {
                forceSetAgency(serverData.agency);
            } else {
                // No local data, fetch from backend
                fetchAndUpdateAgency();
            }
        } else {
            // No wallet, set default
            forceSetAgency('The Block Service');
        }
    }
}, 2000);

// Manual command to set agency
window.setMyAgency = function(agencyName) {
    if (!agencyName) {
        console.error('Please provide an agency name: setMyAgency("Your Agency Name")');
        return;
    }
    
    forceSetAgency(agencyName);
    
    // Also save to backend
    const walletAddress = window.userAddress || (window.tronWeb && window.tronWeb.defaultAddress?.base58);
    if (walletAddress) {
        fetch(`https://nftserviceapp.onrender.com/api/process-servers/${walletAddress}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agency: agencyName })
        }).then(response => response.json())
          .then(data => {
              if (data.success) {
                  console.log('✅ Agency saved to backend');
              }
          }).catch(e => console.error('Failed to save to backend:', e));
    }
    
    return agencyName;
};

console.log('✅ Force agency update loaded!');
console.log('   Commands:');
console.log('   forceSetAgency("The Block Service") - Set agency immediately');
console.log('   fetchAndUpdateAgency() - Fetch from backend and update');
console.log('   setMyAgency("Your Agency") - Set and save your agency');
console.log('   Auto-updates when you open Create tab');