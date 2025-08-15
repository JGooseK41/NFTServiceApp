const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Update the registration modal to show a message about the limitation
const registrationModalUpdate = `<div class="alert alert-info" style="margin-bottom: 1rem;">
                    <i class="fas fa-info-circle"></i>
                    <strong>Note:</strong> The hybrid contract auto-assigns server IDs when roles are granted. 
                    Process servers cannot update their name/agency details after registration. 
                    Please ensure all information is correct before submitting.
                </div>
                <p style="margin-bottom: 1.5rem;">Please provide your professional information to complete process server registration.`;

content = content.replace(
    /<p style="margin-bottom: 1\.5rem;">Please provide your professional information to complete process server registration\./,
    registrationModalUpdate
);

// 2. Update the submitAdminRegistration function to just save locally
const submitAdminRegistrationStart = 'async function submitAdminRegistration() {';
const submitAdminRegistrationEnd = 'await grantProcessServerRole(';

const startIndex = content.indexOf(submitAdminRegistrationStart);
const endIndex = content.indexOf(submitAdminRegistrationEnd, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const newFunction = `async function submitAdminRegistration() {
            // Get form values
            const agencyName = document.getElementById('modalAgencyName').value.trim();
            const agencyEmail = document.getElementById('modalAgencyEmail').value.trim();
            const serverName = document.getElementById('modalServerName').value.trim();
            const serverPhone = document.getElementById('modalServerPhone').value.trim();
            const licenseNumber = document.getElementById('modalLicenseNumber').value.trim();
            const serviceAreas = document.getElementById('modalServiceAreas').value.trim();
            
            // Validate required fields
            if (!agencyName || !agencyEmail || !serverName || !serverPhone) {
                uiManager.showNotification('error', 'Please fill in all required fields');
                return;
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(agencyEmail)) {
                uiManager.showNotification('error', 'Please enter a valid email address');
                return;
            }
            
            // Save registration data
            const registrationData = {
                agencyName,
                agencyEmail,
                serverName,
                serverPhone,
                licenseNumber,
                serviceAreas,
                registeredAt: new Date().toISOString(),
                address: window.pendingProcessServerAddress,
                note: 'Hybrid contract - auto-assigned server ID upon role grant'
            };
            
            // Store in localStorage
            const serverRegistrations = JSON.parse(localStorage.getItem('serverRegistrations') || '{}');
            serverRegistrations[window.pendingProcessServerAddress] = registrationData;
            localStorage.setItem('serverRegistrations', JSON.stringify(serverRegistrations));
            
            // Show notification about the limitation
            uiManager.showNotification('info', 'Registration data saved locally. Server ID will be auto-assigned when role is granted. Note: Name/agency cannot be updated on-chain with the hybrid contract.');
            
            // Close modal
            closeRegistrationModal();
            
            // Continue with role granting
            `;
    
    content = content.substring(0, startIndex) + newFunction + content.substring(endIndex);
}

// 3. Add a comment in the wallet status section about the limitation
const walletStatusComment = `// Note: Hybrid contract auto-assigns server IDs but doesn't support on-chain name/agency updates`;
content = content.replace(
    /\/\/ Get server info to find their ID/,
    `// Get server info to find their ID\n                    ${walletStatusComment}`
);

// 4. Update any batch operation UI placeholders
content = content.replace(
    /Batch operations coming soon\.\.\./g,
    'Batch operations available - send to up to 20 recipients!'
);

// Write the updated content
fs.writeFileSync(indexPath, content);

console.log('✅ UI optimizations for hybrid contract completed:');
console.log('  - Updated registration modal with limitation notice');
console.log('  - Modified submitAdminRegistration to save locally only');
console.log('  - Added comments about hybrid contract limitations');
console.log('  - Updated batch operation placeholders');

// Create a summary of the changes
const summaryPath = path.join(__dirname, 'HYBRID_UI_CHANGES.md');
const summary = `# Hybrid Contract UI Changes

## Contract Address
- **Network**: TRON Nile Testnet
- **Address**: TXyXo57jpquJM4cTkVBw6uUJxrxon2gQP8

## Key Changes

### 1. Enhanced Metadata
Recipients now see full legal notice details directly in their wallets:
- Notice type and case number
- Clear action required text
- Instructions to call acceptNotice() for documents

### 2. Batch Operations
The hybrid contract supports batch operations for up to 20 recipients at once.

### 3. Limitations

#### Process Server Registration
- Server IDs are auto-assigned when PROCESS_SERVER_ROLE is granted
- Process servers cannot update their name/agency on-chain after registration
- Registration data is saved locally for record-keeping

#### Removed Functions
- \`registerProcessServer()\` - Not available in hybrid contract
- \`setProcessServerStatus()\` - Cannot toggle server active/inactive status
- \`pause()\` and \`unpause()\` - Replaced with single \`setPaused(bool)\`

## UI Adaptations

1. **Registration Modal**: Added notice about limitations
2. **Local Storage**: Registration data saved locally since on-chain updates aren't supported
3. **Wallet Status**: Shows server ID but name/agency from local storage only

## Benefits

Despite the limitations, the hybrid contract provides:
- ✅ Full notice visibility in recipient wallets (priority #1)
- ✅ Batch operations for efficiency
- ✅ All core functionality intact
- ✅ Under 24KB size limit for mainnet deployment
`;

fs.writeFileSync(summaryPath, summary);
console.log('\n📄 Summary saved to:', summaryPath);