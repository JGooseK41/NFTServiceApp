const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Simplify the grantRole function for admin use
const simplifiedGrantRole = `        async function grantRole() {
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
            
            try {
                showProcessing('Granting role...');
                
                // Convert role string to bytes32
                const roleBytes = tronWeb.sha3(roleSelect.value);
                
                // Grant the role
                await legalContract.grantRole(roleBytes, address).send({
                    feeLimit: 20_000_000,
                    callValue: 0,
                    shouldPollResponse: true
                });
                
                // Apply law enforcement exemption if selected
                if (lawEnforcementExempt) {
                    showProcessing('Setting law enforcement exemption...');
                    await legalContract.setLawEnforcementExemption(address, agencyName).send({
                        feeLimit: 20_000_000,
                        shouldPollResponse: true
                    });
                }
                
                hideProcessing();
                
                // Build success message
                let message = roleSelect.options[roleSelect.selectedIndex].text + ' role granted to ' + formatAddress(address);
                if (lawEnforcementExempt) {
                    message += ' with law enforcement exemption (' + agencyName + ')';
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
                    feeExempt: lawEnforcementExempt
                });
                
            } catch (error) {
                hideProcessing();
                console.error('Error granting role:', error);
                showAlert('roleResult', 'error', 'Failed: ' + getErrorMessage(error));
            }
        }`;

// Replace the existing grantRole function
const grantRoleStart = 'async function grantRole() {';
const checkRoleStart = 'async function checkRole() {';

const startIdx = content.indexOf(grantRoleStart);
const endIdx = content.indexOf(checkRoleStart);

if (startIdx !== -1 && endIdx !== -1) {
    content = content.substring(0, startIdx) + simplifiedGrantRole + '\n\n        ' + content.substring(endIdx);
    fs.writeFileSync(indexPath, content);
    console.log('✅ Simplified grantRole function for admin use');
} else {
    console.error('❌ Could not find grantRole function');
}

// Simplify the law enforcement section UI
const simplifiedLawEnforcementSection = `                            <div id="lawEnforcementSection" class="subsection" style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <i class="fas fa-shield-alt" style="color: #3b82f6;"></i>
                                    <span style="font-weight: 600;">Law Enforcement Exemption</span>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Agency Name</label>
                                    <input type="text" class="form-input" id="lawEnforcementAgencyName" 
                                           placeholder="e.g., FBI, DEA, Local Police Department">
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="lawEnforcementExempt">
                                    <label for="lawEnforcementExempt">Grant law enforcement fee exemption</label>
                                </div>
                            </div>`;

// Find and replace the law enforcement section
const lawEnforcementPattern = /<div id="lawEnforcementSection"[^>]*>[\s\S]*?<\/div>\s*<\/div>/;
const match = content.match(lawEnforcementPattern);

if (match) {
    content = content.replace(match[0], simplifiedLawEnforcementSection);
    fs.writeFileSync(indexPath, content);
    console.log('✅ Simplified law enforcement section for admin use');
} else {
    console.log('⚠️  Could not find law enforcement section');
}

// Also simplify the grantProcessServerRole function
const simplifiedGrantProcessServerRole = `        async function grantProcessServerRole(address, lawEnforcementExempt, agencyName) {
            try {
                showProcessing('Granting Process Server role...');
                
                const roleBytes = tronWeb.sha3('PROCESS_SERVER_ROLE');
                
                // Grant the role
                await legalContract.grantRole(roleBytes, address).send({
                    feeLimit: 20_000_000,
                    shouldPollResponse: true
                });
                
                // Set law enforcement exemption if requested
                if (lawEnforcementExempt && agencyName) {
                    showProcessing('Setting law enforcement exemption...');
                    await legalContract.setLawEnforcementExemption(address, agencyName).send({
                        feeLimit: 20_000_000,
                        shouldPollResponse: true
                    });
                }
                
                hideProcessing();
                
                let message = 'Process Server role granted';
                if (lawEnforcementExempt) {
                    message += ' with law enforcement exemption (' + agencyName + ')';
                }
                
                showAlert('roleResult', 'success', message);
                
                // Clear form
                document.getElementById('roleAddress').value = '';
                document.getElementById('lawEnforcementExempt').checked = false;
                document.getElementById('lawEnforcementAgencyName').value = '';
                
            } catch (error) {
                hideProcessing();
                console.error('Error:', error);
                showAlert('roleResult', 'error', 'Failed: ' + getErrorMessage(error));
            }
        }`;

// Find and replace grantProcessServerRole
const grantProcessServerStart = 'async function grantProcessServerRole(address, lawEnforcementExempt, agencyName) {';
const openRegistrationStart = '// Function for regular users to open registration';

const gpsStartIdx = content.indexOf(grantProcessServerStart);
const gpsEndIdx = content.indexOf(openRegistrationStart);

if (gpsStartIdx !== -1 && gpsEndIdx !== -1) {
    content = content.substring(0, gpsStartIdx) + simplifiedGrantProcessServerRole + '\n\n        ' + content.substring(gpsEndIdx);
    fs.writeFileSync(indexPath, content);
    console.log('✅ Simplified grantProcessServerRole function');
} else {
    console.log('⚠️  Could not update grantProcessServerRole');
}

console.log('\n✅ Admin role management simplified - removed unnecessary confirmations and user-friendly messaging');