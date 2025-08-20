/**
 * Sync Process Server Registration with Backend
 * Called after successful blockchain registration
 */

async function syncServerRegistration(serverId, serverData) {
    if (!window.BACKEND_API_URL) {
        console.warn('Backend not configured, skipping server registration sync');
        return;
    }
    
    try {
        console.log('Syncing server registration to backend...', { serverId, serverData });
        
        // Prepare registration data
        const registrationData = {
            server_id: serverId,
            wallet_address: serverData.address || window.tronWeb?.defaultAddress?.base58,
            server_name: serverData.name || `Process Server #${serverId}`,
            agency_name: serverData.agency || document.getElementById('agencyName')?.value || 'Independent Process Server',
            physical_address: serverData.physicalAddress || document.getElementById('physicalAddress')?.value || '',
            phone_number: serverData.phone || document.getElementById('phoneNumber')?.value || '',
            contact_email: serverData.email || document.getElementById('contactEmail')?.value || '',
            website: serverData.website || document.getElementById('website')?.value || '',
            license_number: serverData.licenseNumber || document.getElementById('licenseNumber')?.value || ''
        };
        
        const response = await fetch(`${window.BACKEND_API_URL}/api/servers/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registrationData)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Server registration synced to backend:', result);
            
            // Store server info in session
            if (window.sessionStorage) {
                window.sessionStorage.setItem('processServerInfo', JSON.stringify(result.server));
            }
            
            return result.server;
        } else {
            console.error('Failed to sync server registration:', response.status);
            return null;
        }
    } catch (error) {
        console.error('Error syncing server registration:', error);
        return null;
    }
}

/**
 * Fetch server info from backend
 */
async function fetchServerInfo(identifier) {
    if (!window.BACKEND_API_URL) {
        return null;
    }
    
    try {
        const response = await fetch(`${window.BACKEND_API_URL}/api/servers/${identifier}`);
        
        if (response.ok) {
            const result = await response.json();
            return result.server;
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching server info:', error);
        return null;
    }
}

/**
 * Hook into blockchain registration process
 * This should be called after successful blockchain registration
 */
function setupServerRegistrationHook() {
    // Store original registerProcessServer function if it exists
    const originalRegister = window.registerProcessServer;
    
    // Override with our enhanced version
    window.registerProcessServer = async function(...args) {
        let result;
        
        // Call original if it exists
        if (originalRegister) {
            result = await originalRegister.apply(this, args);
        }
        
        // If registration successful, sync to backend
        if (result && result.serverId) {
            await syncServerRegistration(result.serverId, {
                address: window.tronWeb?.defaultAddress?.base58,
                name: args[0], // Assuming first arg is name
                agency: args[1], // Assuming second arg is agency
                ...result.additionalData
            });
        }
        
        return result;
    };
}

// Auto-setup on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupServerRegistrationHook);
} else {
    setupServerRegistrationHook();
}

// Export functions
window.syncServerRegistration = syncServerRegistration;
window.fetchServerInfo = fetchServerInfo;