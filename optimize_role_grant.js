const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Find and update the grantRole function to provide better feedback
const grantRoleFunction = `        async function grantRole() {
            if (!legalContract) {
                uiManager.showNotification('error', 'Contract not connected');
                return;
            }
            
            const roleSelect = document.getElementById('roleSelect');
            const address = document.getElementById('roleAddress').value.trim();
            const lawEnforcementExempt = document.getElementById('lawEnforcementExempt').checked;
            const agencyName = lawEnforcementExempt ? document.getElementById('lawEnforcementAgencyName').value.trim() : '';
            
            if (!address) {
                showAlert('roleResult', 'error', 'Please enter an address');
                return;
            }
            
            if (!tronWeb.isAddress(address)) {
                showAlert('roleResult', 'error', 'Invalid TRON address');
                return;
            }
            
            // Validate law enforcement input
            if (lawEnforcementExempt && !agencyName) {
                showAlert('roleResult', 'error', 'Agency name is required for law enforcement exemptions');
                return;
            }
            
            // Calculate total operations and estimated cost
            const operations = [];
            operations.push('Grant ' + roleSelect.options[roleSelect.selectedIndex].text + ' role');
            if (lawEnforcementExempt) {
                operations.push('Set law enforcement exemption');
            }
            
            const estimatedCost = operations.length * 20; // ~20 TRX per operation
            
            // Show confirmation with all operations
            const confirmMessage = \`This will execute \${operations.length} transaction(s):\\n\\n\` +
                operations.map((op, i) => \`\${i + 1}. \${op}\`).join('\\n') +
                \`\\n\\nEstimated total cost: ~\${estimatedCost} TRX\\n\\nProceed?\`;
            
            if (!confirm(confirmMessage)) {
                return;
            }
            
            // If granting PROCESS_SERVER_ROLE, show registration modal
            if (roleSelect.value === 'PROCESS_SERVER_ROLE') {
                // Store the address temporarily for after registration
                window.pendingProcessServerAddress = address;
                window.pendingLawEnforcementExempt = lawEnforcementExempt;
                window.pendingAgencyName = agencyName;
                
                // Show the registration modal
                document.getElementById('registrationModal').style.display = 'flex';
                return;
            }
            
            // Execute all operations
            const results = {
                roleGrant: false,
                exemption: false,
                errors: []
            };
            
            try {
                showProcessing('Step 1 of ' + operations.length + ': Granting role...');
                
                // Convert role string to bytes32
                const roleBytes = tronWeb.sha3(roleSelect.value);
                
                // Call the contract to grant the role
                await legalContract.grantRole(roleBytes, address).send({
                    feeLimit: 20_000_000,  // 20 TRX - role granting
                    callValue: 0,
                    shouldPollResponse: true
                });
                
                results.roleGrant = true;
                
                // Apply law enforcement exemption if selected
                if (lawEnforcementExempt) {
                    showProcessing('Step 2 of ' + operations.length + ': Setting law enforcement exemption...');
                    
                    await legalContract.setLawEnforcementExemption(address, agencyName).send({
                        feeLimit: 20_000_000,
                        shouldPollResponse: true
                    });
                    
                    results.exemption = true;
                }
                
                hideProcessing();
                
                // Save process server registration data
                if (roleSelect.value === 'PROCESS_SERVER_ROLE') {
                    const serverId = generateServerId();
                    const registrationData = {
                        serverId,
                        address,
                        agencyName: document.getElementById('agencyName').value.trim(),
                        agencyEmail: document.getElementById('agencyEmail').value.trim(),
                        serverName: document.getElementById('serverName').value.trim(),
                        serverPhone: document.getElementById('serverPhone').value.trim(),
                        registeredAt: new Date().toISOString(),
                        registeredBy: tronWeb.defaultAddress.base58,
                        feeExempt: lawEnforcementExempt
                    };
                    
                    // Save to localStorage
                    saveServerRegistration(address, registrationData);
                    
                    // Update the displayed server ID
                    if (address === tronWeb.defaultAddress.base58) {
                        const userServerId = document.getElementById('userServerId');
                        if (userServerId) userServerId.textContent = serverId.split('-').pop();
                    }
                }
                
                // Build success message
                let message = 'Successfully completed:\\n';
                if (results.roleGrant) {
                    message += '✅ ' + roleSelect.options[roleSelect.selectedIndex].text + ' role granted\\n';
                }
                if (results.exemption) {
                    message += '✅ Law enforcement exemption set (' + agencyName + ')\\n';
                }
                
                showAlert('roleResult', 'success', message);
                
                // Clear inputs
                document.getElementById('roleAddress').value = '';
                document.getElementById('lawEnforcementExempt').checked = false;
                document.getElementById('lawEnforcementAgencyName').value = '';
                
                // Add to recent activity
                addRecentActivity('role', 'Role granted', {
                    role: roleSelect.options[roleSelect.selectedIndex].text,
                    address: formatAddress(address),
                    feeExempt: lawEnforcementExempt,
                    operations: operations.length
                });
                
            } catch (error) {
                hideProcessing();
                console.error('Error during role management:', error);
                
                // Build error message showing what succeeded and what failed
                let errorMessage = 'Operation partially completed:\\n\\n';
                if (results.roleGrant) {
                    errorMessage += '✅ Role granted successfully\\n';
                } else {
                    errorMessage += '❌ Role grant failed\\n';
                }
                if (lawEnforcementExempt) {
                    if (results.exemption) {
                        errorMessage += '✅ Law enforcement exemption set\\n';
                    } else {
                        errorMessage += '❌ Law enforcement exemption failed\\n';
                    }
                }
                errorMessage += '\\nError: ' + getErrorMessage(error);
                
                showAlert('roleResult', 'error', errorMessage);
            }
        }`;

// Replace the existing grantRole function
const grantRoleStart = 'async function grantRole() {';
const grantRoleEnd = 'async function checkRole() {';

const startIdx = content.indexOf(grantRoleStart);
const endIdx = content.indexOf(grantRoleEnd);

if (startIdx !== -1 && endIdx !== -1) {
    content = content.substring(0, startIdx) + grantRoleFunction + '\n\n        ' + content.substring(endIdx);
    
    fs.writeFileSync(indexPath, content);
    console.log('✅ Updated grantRole function with improved multi-transaction handling');
} else {
    console.error('❌ Could not find grantRole function');
}

// Also update the UI to make it clearer
const lawEnforcementSectionUpdate = `                            <div id="lawEnforcementSection" class="subsection" style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <i class="fas fa-shield-alt" style="color: #3b82f6;"></i>
                                    <span style="font-weight: 600;">Law Enforcement Agency</span>
                                    <span class="badge badge-info" style="margin-left: auto;">Saves ~75% on fees</span>
                                </div>
                                <p class="form-help" style="margin-bottom: 1rem;">Law enforcement agencies pay only actual gas costs (no profit margins)</p>
                                <div class="alert alert-info" style="margin-bottom: 1rem;">
                                    <i class="fas fa-info-circle"></i>
                                    Granting a role with law enforcement exemption requires 2 transactions but saves fees on all future operations.
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Agency Name <span style="color: #ef4444;">*</span></label>
                                    <input type="text" class="form-input" id="lawEnforcementAgencyName" 
                                           placeholder="e.g., FBI, DEA, Local Police Department">
                                    <p class="form-help">Required for law enforcement exemptions</p>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="lawEnforcementExempt">
                                    <label for="lawEnforcementExempt">Grant law enforcement exemption (cost-only pricing)</label>
                                </div>
                            </div>`;

const lawEnforcementRegex = /<div id="lawEnforcementSection"[^>]*>[\s\S]*?<\/div>\s*<\/div>/;

if (lawEnforcementRegex.test(content)) {
    content = content.replace(lawEnforcementRegex, lawEnforcementSectionUpdate);
    fs.writeFileSync(indexPath, content);
    console.log('✅ Updated law enforcement section with clearer information');
} else {
    console.log('⚠️  Could not find law enforcement section to update');
}