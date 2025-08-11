/**
 * Auto-register process server if not found
 */

console.log('🔧 Auto-registration system initializing...');

window.autoRegisterServer = async function() {
    console.log('🚀 Starting auto-registration process...');
    
    const walletAddress = window.userAddress || (window.tronWeb && window.tronWeb.defaultAddress?.base58);
    if (!walletAddress) {
        console.error('No wallet connected');
        return false;
    }
    
    console.log('Wallet address:', walletAddress);
    
    // First check if already registered
    try {
        const checkResponse = await fetch(`https://nftserviceapp.onrender.com/api/process-servers/${walletAddress}`);
        if (checkResponse.ok) {
            const data = await checkResponse.json();
            if (data.success && data.server) {
                console.log('✅ Already registered:', data.server);
                return data.server;
            }
        }
    } catch (error) {
        console.log('Not registered yet, proceeding with registration...');
    }
    
    // Get any existing data from localStorage or use defaults
    const existingData = JSON.parse(localStorage.getItem('serverRegistrations') || '{}')[walletAddress] || {};
    
    // Prepare registration data
    const registrationData = {
        wallet_address: walletAddress,
        name: existingData.name || 'Process Server',
        agency: existingData.agency || 'The Block Service', // Use your actual agency name
        email: existingData.email || 'service@theblockservice.com',
        phone: existingData.phone || '',
        status: 'approved', // Auto-approve since you're the admin
        license_number: existingData.license_number || '',
        jurisdiction: existingData.jurisdiction || 'United States',
        notes: 'Auto-registered via frontend'
    };
    
    console.log('Registration data:', registrationData);
    
    try {
        // Register the server
        const response = await fetch('https://nftserviceapp.onrender.com/api/process-servers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registrationData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Successfully registered:', result.server);
            
            // Update localStorage
            const registrations = JSON.parse(localStorage.getItem('processServerRegistrations') || '{}');
            registrations[walletAddress] = result.server;
            registrations[walletAddress.toLowerCase()] = result.server;
            localStorage.setItem('processServerRegistrations', JSON.stringify(registrations));
            
            // Also update serverRegistrations for backward compatibility
            localStorage.setItem('serverRegistrations', JSON.stringify(registrations));
            
            // Update agency field
            if (window.updateAgencyField) {
                await window.updateAgencyField();
            }
            
            // Show success
            if (window.showNotification) {
                showNotification('Process server registered successfully!', 'success');
            }
            
            return result.server;
        } else {
            console.error('Registration failed:', result.error);
            return false;
        }
    } catch (error) {
        console.error('Registration error:', error);
        return false;
    }
};

// Function to ensure registration and update agency
window.ensureServerRegistration = async function() {
    console.log('📋 Ensuring server registration...');
    
    const walletAddress = window.userAddress || (window.tronWeb && window.tronWeb.defaultAddress?.base58);
    if (!walletAddress) {
        console.log('Waiting for wallet connection...');
        return;
    }
    
    // Check localStorage first
    const registrations = JSON.parse(localStorage.getItem('processServerRegistrations') || '{}');
    let serverData = registrations[walletAddress] || registrations[walletAddress.toLowerCase()];
    
    if (!serverData || !serverData.agency) {
        console.log('No local data, checking backend...');
        
        // Try to fetch from backend
        try {
            const response = await fetch(`https://nftserviceapp.onrender.com/api/process-servers/${walletAddress}`);
            const data = await response.json();
            
            if (data.success && data.server) {
                serverData = data.server;
                
                // Update localStorage
                registrations[walletAddress] = serverData;
                registrations[walletAddress.toLowerCase()] = serverData;
                localStorage.setItem('processServerRegistrations', JSON.stringify(registrations));
                localStorage.setItem('serverRegistrations', JSON.stringify(registrations));
                
                console.log('✅ Found in backend:', serverData);
            } else {
                // Not found - auto-register
                console.log('Not found in backend, auto-registering...');
                serverData = await autoRegisterServer();
            }
        } catch (error) {
            console.error('Backend check failed, auto-registering...', error);
            serverData = await autoRegisterServer();
        }
    }
    
    // Update the agency field
    if (serverData && serverData.agency) {
        const agencyField = document.getElementById('issuingAgency');
        const agencyNameField = document.getElementById('agencyName');
        
        if (agencyField) {
            agencyField.value = serverData.agency;
            agencyField.style.color = 'var(--text-primary)';
            console.log('✅ Updated issuingAgency field:', serverData.agency);
        }
        
        if (agencyNameField) {
            agencyNameField.value = serverData.agency;
            agencyNameField.style.color = 'var(--text-primary)';
            console.log('✅ Updated agencyName field:', serverData.agency);
        }
    }
    
    return serverData;
};

// Override the existing setIssuingAgency function
window.setIssuingAgency = async function() {
    console.log('setIssuingAgency called - ensuring registration...');
    await ensureServerRegistration();
};

// Auto-run on wallet connection
const originalConnectWallet = window.connectTronWalletOriginal || window.connectTronWallet;
if (originalConnectWallet) {
    window.connectTronWallet = async function() {
        const result = await originalConnectWallet.apply(this, arguments);
        
        // After wallet connects, ensure registration
        setTimeout(async () => {
            await ensureServerRegistration();
        }, 1000);
        
        return result;
    };
}

// Run when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(async () => {
        if (window.tronWeb && window.tronWeb.defaultAddress?.base58) {
            await ensureServerRegistration();
        }
    }, 3000);
});

// Manual registration function
window.manualRegisterServer = async function(agency, name, email) {
    console.log('📝 Manual registration...');
    
    const walletAddress = window.userAddress || (window.tronWeb && window.tronWeb.defaultAddress?.base58);
    if (!walletAddress) {
        console.error('No wallet connected');
        return;
    }
    
    const registrationData = {
        wallet_address: walletAddress,
        name: name || 'Process Server',
        agency: agency || 'The Block Service',
        email: email || 'service@theblockservice.com',
        phone: '',
        status: 'approved',
        license_number: '',
        jurisdiction: 'United States',
        notes: 'Manually registered'
    };
    
    try {
        const response = await fetch('https://nftserviceapp.onrender.com/api/process-servers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registrationData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Registered successfully:', result.server);
            
            // Update localStorage
            const registrations = JSON.parse(localStorage.getItem('processServerRegistrations') || '{}');
            registrations[walletAddress] = result.server;
            registrations[walletAddress.toLowerCase()] = result.server;
            localStorage.setItem('processServerRegistrations', JSON.stringify(registrations));
            localStorage.setItem('serverRegistrations', JSON.stringify(registrations));
            
            // Update agency field
            await ensureServerRegistration();
            
            return result.server;
        }
    } catch (error) {
        console.error('Registration error:', error);
    }
};

console.log('✅ Auto-registration system ready!');
console.log('   Commands:');
console.log('   ensureServerRegistration() - Check and auto-register if needed');
console.log('   autoRegisterServer() - Force registration');
console.log('   manualRegisterServer("Agency Name", "Your Name", "email@example.com") - Manual registration');