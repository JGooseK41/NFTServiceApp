const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Remove the law enforcement section from the role management card
const lawEnforcementSectionPattern = /<!-- Law Enforcement Section -->[\s\S]*?<\/div>\s*<!-- Action Buttons -->/;

if (lawEnforcementSectionPattern.test(content)) {
    content = content.replace(lawEnforcementSectionPattern, '<!-- Action Buttons -->');
    console.log('✅ Removed law enforcement section from role management card');
} else {
    console.log('⚠️  Could not find law enforcement section to remove');
}

// Also update the grantRole function to remove references to law enforcement
const oldGrantRole = `            const lawEnforcementExempt = document.getElementById('lawEnforcementExempt').checked;
            const agencyName = lawEnforcementExempt ? document.getElementById('lawEnforcementAgencyName').value.trim() : '';`;

const newGrantRole = `            const lawEnforcementExempt = false;
            const agencyName = '';`;

content = content.replace(oldGrantRole, newGrantRole);

// Remove the law enforcement validation
const oldValidation = `            // Validate law enforcement input
            if (lawEnforcementExempt && !agencyName) {
                showAlert('roleResult', 'error', 'Agency name is required for law enforcement exemptions');
                return;
            }`;

content = content.replace(oldValidation, '');

// Remove law enforcement code from the success message
const oldSuccessCode = `                // Apply law enforcement exemption if selected
                if (lawEnforcementExempt) {
                    showProcessing('Setting law enforcement exemption...');
                    await legalContract.setLawEnforcementExemption(address, agencyName).send({
                        feeLimit: 20_000_000,
                        shouldPollResponse: true
                    });
                }`;

content = content.replace(oldSuccessCode, '');

// Update the success message
const oldMessage = `                let message = roleSelect.options[roleSelect.selectedIndex].text + ' role granted to ' + formatAddress(address);
                if (lawEnforcementExempt) {
                    message += ' with law enforcement exemption (' + agencyName + ')';
                }`;

const newMessage = `                let message = roleSelect.options[roleSelect.selectedIndex].text + ' role granted to ' + formatAddress(address);`;

content = content.replace(oldMessage, newMessage);

// Remove the checkbox clear code
content = content.replace(
    `document.getElementById('lawEnforcementExempt').checked = false;
                document.getElementById('lawEnforcementAgencyName').value = '';`,
    ''
);

// Write the updated content
fs.writeFileSync(indexPath, content);

console.log('✅ Removed confusing law enforcement exemption from role management');
console.log('✅ Users should use the dedicated Fee Exemption Management card instead');
console.log('✅ This eliminates confusion and ensures exemptions work properly');