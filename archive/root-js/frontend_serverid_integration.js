// Frontend Integration for Process Server IDs

// 1. Check and Display Server Info When Connected
async function checkProcessServerStatus() {
    try {
        const accounts = await tronWeb.defaultAddress.base58;
        
        // Check if user has process server role
        const hasRole = await contract.hasRole(PROCESS_SERVER_ROLE, accounts).call();
        
        if (hasRole) {
            // Get server info
            const serverInfo = await contract.getProcessServerInfo(accounts).call();
            const serverId = serverInfo.serverId.toString();
            const serverName = serverInfo.name || "Not Registered";
            const agency = serverInfo.agency || "Not Registered";
            const noticesServed = serverInfo.noticesServed.toString();
            
            // Display server ID prominently
            document.getElementById('walletInfo').innerHTML += `
                <div class="server-info-badge" style="background: #3b82f6; color: white; padding: 0.5rem 1rem; border-radius: 0.5rem; margin-top: 0.5rem;">
                    <i class="fas fa-id-badge"></i> Process Server #${serverId}
                    ${serverName !== "Not Registered" ? `<br><small>${agency}</small>` : ''}
                    <br><small>Notices Served: ${noticesServed}</small>
                </div>
            `;
            
            // Store server ID for later use
            window.currentServerId = serverId;
            
            // Show registration prompt if details not added
            if (serverName === "Not Registered") {
                showServerRegistrationPrompt(serverId);
            }
        }
    } catch (error) {
        console.error('Error checking server status:', error);
    }
}

// 2. Server Registration/Update Form
function showServerRegistrationPrompt(serverId) {
    const modal = `
        <div class="modal" id="serverRegistrationModal">
            <div class="modal-content">
                <h2>Complete Your Process Server Registration</h2>
                <p>You've been assigned Process Server ID: <strong>#${serverId}</strong></p>
                <p>Please provide your details to complete registration:</p>
                
                <form id="serverRegistrationForm">
                    <div class="form-group">
                        <label>Your Name / Business Name:</label>
                        <input type="text" id="serverName" required placeholder="John Doe Process Services">
                    </div>
                    
                    <div class="form-group">
                        <label>Agency / Court:</label>
                        <input type="text" id="serverAgency" required placeholder="County Superior Court">
                    </div>
                    
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> Save Registration
                    </button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
    
    document.getElementById('serverRegistrationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await registerProcessServerDetails();
    });
}

// 3. Register Server Details
async function registerProcessServerDetails() {
    try {
        const name = document.getElementById('serverName').value;
        const agency = document.getElementById('serverAgency').value;
        
        showProcessing('Registering your details on blockchain...');
        
        const transaction = await contract.registerProcessServer(name, agency).send({
            feeLimit: 100_000_000,
            callValue: 0
        });
        
        showNotification('success', `Registration complete! You are now Process Server #${window.currentServerId}`);
        
        // Refresh the page to show updated info
        setTimeout(() => location.reload(), 2000);
        
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('error', 'Registration failed: ' + error.message);
    }
}

// 4. Update Token Creation to Show Server ID
async function createLegalNotice() {
    try {
        // Get form values
        const recipient = document.getElementById('recipientAddress').value;
        const noticeType = document.getElementById('noticeType').value;
        const tokenName = document.getElementById('tokenName').value;
        
        // Show preview of final token name
        const preview = window.currentServerId 
            ? `PS#${window.currentServerId}-${tokenName}`
            : `USR-${tokenName}`;
            
        if (!confirm(`Token will be created as: "${preview}"\\nContinue?`)) {
            return;
        }
        
        // Create notice (contract will prepend server ID automatically)
        const transaction = await contract.createLegalNotice(
            recipient,
            metadataUrl,
            noticeType,
            referenceNumber,
            responseDeadline,
            issuingAgency,
            tokenName // Pass original name, contract adds prefix
        ).send({
            feeLimit: 300_000_000,
            callValue: requiredFee
        });
        
        showNotification('success', `Notice created as: ${preview}`);
        
    } catch (error) {
        console.error('Error creating notice:', error);
    }
}

// 5. Display Server Info in Notice Lists
async function displayNotices() {
    const notices = await getNotices();
    
    for (const notice of notices) {
        const serverId = notice.serverId.toString();
        const serverName = notice.serverName || "Unknown";
        
        const noticeHtml = `
            <div class="notice-card">
                <div class="notice-header">
                    <h3>${notice.tokenName}</h3>
                    <span class="server-badge">
                        <i class="fas fa-id-badge"></i> PS#${serverId}
                    </span>
                </div>
                <p>Served by: ${serverName} (Server #${serverId})</p>
                <p>Type: ${notice.noticeType}</p>
                <p>Reference: ${notice.referenceNumber}</p>
            </div>
        `;
        
        document.getElementById('noticesList').insertAdjacentHTML('beforeend', noticeHtml);
    }
}

// 6. Add Server Lookup Feature
async function lookupServerById() {
    const serverId = prompt('Enter Process Server ID:');
    if (!serverId) return;
    
    try {
        const serverInfo = await contract.getServerById(serverId).call();
        const address = serverInfo.serverAddress;
        const name = serverInfo.name || "Not Registered";
        const agency = serverInfo.agency || "Not Registered";
        const noticesServed = serverInfo.noticesServed.toString();
        
        alert(`
Process Server #${serverId}
Name: ${name}
Agency: ${agency}
Notices Served: ${noticesServed}
Wallet: ${address}
        `);
        
    } catch (error) {
        alert('Server ID not found');
    }
}

// 7. Add to wallet connection flow
async function connectWallet() {
    // ... existing connection code ...
    
    // After successful connection, check server status
    await checkProcessServerStatus();
}

// 8. Style for server badges
const serverStyles = `
<style>
.server-info-badge {
    display: inline-block;
    background: #3b82f6;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 500;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.server-badge {
    display: inline-block;
    background: #e0f2fe;
    color: #3b82f6;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
}

.notice-card {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
}

.notice-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}
</style>
`;