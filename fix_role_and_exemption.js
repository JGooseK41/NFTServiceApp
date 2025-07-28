const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Fix the grantProcessServerRole function to add better logging
const oldGrantProcessServerRole = `                async function grantProcessServerRole(address, lawEnforcementExempt, agencyName) {
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
                }`;

const newGrantProcessServerRole = `                async function grantProcessServerRole(address, lawEnforcementExempt, agencyName) {
            try {
                console.log('grantProcessServerRole called with:', { address, lawEnforcementExempt, agencyName });
                
                showProcessing('Granting Process Server role...');
                
                const roleBytes = tronWeb.sha3('PROCESS_SERVER_ROLE');
                
                // Grant the role
                await legalContract.grantRole(roleBytes, address).send({
                    feeLimit: 20_000_000,
                    shouldPollResponse: true
                });
                
                console.log('Role granted successfully');
                
                // Set law enforcement exemption if requested
                if (lawEnforcementExempt && agencyName) {
                    console.log('Setting law enforcement exemption...');
                    showProcessing('Setting law enforcement exemption...');
                    await legalContract.setLawEnforcementExemption(address, agencyName).send({
                        feeLimit: 20_000_000,
                        shouldPollResponse: true
                    });
                    console.log('Law enforcement exemption set successfully');
                } else {
                    console.log('No law enforcement exemption requested or missing agency name', { lawEnforcementExempt, agencyName });
                }`;

content = content.replace(oldGrantProcessServerRole, newGrantProcessServerRole);

// 2. Fix the wallet status update to refresh after role grant
const oldSuccessMessage = `                showAlert('roleResult', 'success', message);
                
                // Clear form
                document.getElementById('roleAddress').value = '';
                document.getElementById('lawEnforcementExempt').checked = false;
                document.getElementById('lawEnforcementAgencyName').value = '';`;

const newSuccessMessage = `                showAlert('roleResult', 'success', message);
                
                // Clear form
                document.getElementById('roleAddress').value = '';
                document.getElementById('lawEnforcementExempt').checked = false;
                document.getElementById('lawEnforcementAgencyName').value = '';
                
                // Update wallet status if it's the current user
                if (address === tronWeb.defaultAddress.base58) {
                    console.log('Updating wallet status for current user...');
                    await updateWalletStatus();
                }`;

content = content.replace(oldSuccessMessage, newSuccessMessage);

// 3. Also add debugging to the window.pending variables
const oldPendingVars = `                window.pendingProcessServerAddress = address;
                window.pendingLawEnforcementExempt = lawEnforcementExempt;
                window.pendingAgencyName = agencyName;`;

const newPendingVars = `                window.pendingProcessServerAddress = address;
                window.pendingLawEnforcementExempt = lawEnforcementExempt;
                window.pendingAgencyName = agencyName;
                console.log('Stored pending values:', {
                    address: window.pendingProcessServerAddress,
                    lawEnforcementExempt: window.pendingLawEnforcementExempt,
                    agencyName: window.pendingAgencyName
                });`;

content = content.replace(oldPendingVars, newPendingVars);

// Write the updated content
fs.writeFileSync(indexPath, content);

console.log('✅ Added debugging and fixes:');
console.log('  - Added console logging to track exemption flow');
console.log('  - Added wallet status update after role grant');
console.log('  - Added logging for pending variables');