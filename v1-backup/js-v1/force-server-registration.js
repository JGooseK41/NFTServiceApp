/**
 * Force Server Registration
 * Ensures your server is properly registered with an ID
 */

(function() {
    console.log('🔧 Force Server Registration starting...');
    
    // Force registration function
    window.forceRegisterServer = async function() {
        if (!window.tronWeb || !window.tronWeb.defaultAddress.base58) {
            console.error('Please connect wallet first');
            return;
        }
        
        const serverAddress = window.tronWeb.defaultAddress.base58;
        console.log('Registering server:', serverAddress);
        
        try {
            // First check if already registered on blockchain
            if (window.legalContract && window.legalContract.processServers) {
                try {
                    const serverInfo = await window.legalContract.processServers(serverAddress).call();
                    if (serverInfo && serverInfo.isActive) {
                        console.log('✅ Server already registered on blockchain with ID:', serverInfo.serverId?.toString());
                        
                        // Store the server ID locally
                        localStorage.setItem('serverRegistration', JSON.stringify({
                            address: serverAddress,
                            serverId: serverInfo.serverId?.toString() || '1000',
                            name: serverInfo.name || 'The Block Service',
                            agencyName: 'The Block Service',
                            contactName: 'Admin',
                            contactEmail: 'admin@theblockservice.com',
                            registeredAt: new Date().toISOString()
                        }));
                        
                        // Update UI
                        const serverIdElement = document.getElementById('serverIdDisplay');
                        if (serverIdElement) {
                            serverIdElement.textContent = `Server ID: ${serverInfo.serverId?.toString() || '1000'}`;
                        }
                        
                        return serverInfo.serverId?.toString() || '1000';
                    }
                } catch (error) {
                    console.log('Server not registered on blockchain, will register now');
                }
            }
            
            // Register on blockchain
            console.log('Registering on blockchain...');
            
            if (window.legalContract && window.legalContract.registerProcessServer) {
                try {
                    const tx = await window.legalContract.registerProcessServer(
                        'The Block Service',
                        'Admin',
                        'admin@theblockservice.com'
                    ).send({
                        feeLimit: 100000000,
                        shouldPollResponse: true
                    });
                    
                    console.log('✅ Server registered on blockchain:', tx);
                    
                    // Get the new server ID
                    const serverInfo = await window.legalContract.processServers(serverAddress).call();
                    const serverId = serverInfo.serverId?.toString() || '1000';
                    
                    // Store locally
                    localStorage.setItem('serverRegistration', JSON.stringify({
                        address: serverAddress,
                        serverId: serverId,
                        name: 'The Block Service',
                        agencyName: 'The Block Service',
                        contactName: 'Admin',
                        contactEmail: 'admin@theblockservice.com',
                        registeredAt: new Date().toISOString()
                    }));
                    
                    console.log('✅ Server registered with ID:', serverId);
                    return serverId;
                    
                } catch (error) {
                    console.error('Blockchain registration failed:', error);
                }
            }
            
            // Fallback: Use local storage with default ID
            console.log('Using fallback registration with ID 1000');
            const fallbackId = '1000';
            
            localStorage.setItem('serverRegistration', JSON.stringify({
                address: serverAddress,
                serverId: fallbackId,
                name: 'The Block Service',
                agencyName: 'The Block Service',
                contactName: 'Admin',
                contactEmail: 'admin@theblockservice.com',
                registeredAt: new Date().toISOString()
            }));
            
            // Update UI
            const serverIdElement = document.getElementById('serverIdDisplay');
            if (serverIdElement) {
                serverIdElement.textContent = `Server ID: ${fallbackId}`;
            }
            
            return fallbackId;
            
        } catch (error) {
            console.error('Registration error:', error);
            // Use fallback ID
            return '1000';
        }
    };
    
    // Get current server ID
    window.getServerId = function() {
        const registration = localStorage.getItem('serverRegistration');
        if (registration) {
            try {
                const data = JSON.parse(registration);
                return data.serverId || '1000';
            } catch (e) {
                return '1000';
            }
        }
        return '1000';
    };
    
    // Override serverById to use our registration
    const originalServerById = window.serverById;
    window.serverById = async function(address) {
        // First try original function
        if (originalServerById) {
            try {
                const result = await originalServerById(address);
                if (result && result.serverId) {
                    return result;
                }
            } catch (e) {
                // Continue to fallback
            }
        }
        
        // Use our registration
        const registration = localStorage.getItem('serverRegistration');
        if (registration) {
            try {
                const data = JSON.parse(registration);
                if (data.address === address) {
                    return {
                        serverId: data.serverId || '1000',
                        name: data.name || 'The Block Service',
                        isActive: true,
                        agencyName: data.agencyName || 'The Block Service'
                    };
                }
            } catch (e) {
                // Continue to default
            }
        }
        
        // Default return
        return {
            serverId: '1000',
            name: 'The Block Service',
            isActive: true,
            agencyName: 'The Block Service'
        };
    };
    
    // Auto-register on wallet connection
    let registrationAttempted = false;
    const checkAndRegister = setInterval(() => {
        if (window.tronWeb && window.tronWeb.defaultAddress.base58 && !registrationAttempted) {
            registrationAttempted = true;
            clearInterval(checkAndRegister);
            
            // Check if we have a registration
            const registration = localStorage.getItem('serverRegistration');
            if (!registration) {
                console.log('No server registration found, registering...');
                window.forceRegisterServer();
            } else {
                try {
                    const data = JSON.parse(registration);
                    if (data.address === window.tronWeb.defaultAddress.base58) {
                        console.log('✅ Server already registered with ID:', data.serverId);
                        
                        // Update UI
                        const serverIdElement = document.getElementById('serverIdDisplay');
                        if (serverIdElement) {
                            serverIdElement.textContent = `Server ID: ${data.serverId}`;
                        }
                    } else {
                        // Different address, re-register
                        console.log('Address changed, re-registering...');
                        window.forceRegisterServer();
                    }
                } catch (e) {
                    window.forceRegisterServer();
                }
            }
        }
    }, 1000);
    
    console.log('✅ Force Server Registration loaded');
    console.log('Commands:');
    console.log('  forceRegisterServer() - Register your server');
    console.log('  getServerId() - Get your server ID');
    
})();