const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Fix the timestamp to include timezone
const oldServiceDateTime = `                                • Service date and time: \${new Date().toLocaleString()}<br>`;
const newServiceDateTime = `                                • Service date and time: \${new Date().toLocaleString('en-US', { timeZoneName: 'short' })}<br>`;

content = content.replace(oldServiceDateTime, newServiceDateTime);

// Also fix it in the receipt window
const oldReceiptTimestamp = `                            <span class="value">\${new Date().toLocaleString()}</span>`;
const newReceiptTimestamp = `                            <span class="value">\${new Date().toLocaleString('en-US', { timeZoneName: 'short' })}</span>`;

content = content.replace(oldReceiptTimestamp, newReceiptTimestamp);

// 2. Remove the hardcoded response deadline since we don't have that input
// Replace with a note that deadline should be verified
const oldResponseDeadline = `                                • Response deadline: \${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()} (30 days from service)<br>`;
const newResponseDeadline = `                                • Response deadline: To be determined by applicable law and court rules<br>`;

content = content.replace(oldResponseDeadline, newResponseDeadline);

// Also update in the receipt format
const oldReceiptDeadline = `                            <div class="info-row">
                                <span class="label">Response Deadline:</span>
                                <span class="value">\${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()} (30 days from service)</span>
                            </div>`;

const newReceiptDeadline = `                            <div class="info-row">
                                <span class="label">Response Deadline:</span>
                                <span class="value">See notice for applicable deadline</span>
                            </div>`;

content = content.replace(oldReceiptDeadline, newReceiptDeadline);

// 3. Update the attestation to include property rights language
const oldAttestation = `<strong>Process Server Attestation:</strong> By creating this electronic service record, I attest that I have made diligent effort to notify the affected party at the blockchain address provided. The recipient has been served with notice that includes information about their legal rights and the requirement to respond within the statutory deadline to avoid default judgment.`;

const newAttestation = `<strong>Process Server Attestation:</strong> By creating this electronic service record, I attest that I have made diligent effort to notify the affected party at the blockchain address provided. The recipient has been served with notice that includes information about their legal rights and the requirement to respond within the statutory deadline to avoid default judgment or other negative effects on their property rights.`;

content = content.replace(oldAttestation, newAttestation);

// Also update the attestation in the receipt window
const oldReceiptAttestation = `<strong>Process Server Attestation:</strong> This receipt certifies that I have made diligent effort to notify the affected party at the blockchain address provided. The recipient has been served with notice that includes information about their legal rights and the requirement to respond within the statutory deadline to avoid default judgment.`;

const newReceiptAttestation = `<strong>Process Server Attestation:</strong> This receipt certifies that I have made diligent effort to notify the affected party at the blockchain address provided. The recipient has been served with notice that includes information about their legal rights and the requirement to respond within the statutory deadline to avoid default judgment or other negative effects on their property rights.`;

content = content.replace(oldReceiptAttestation, newReceiptAttestation);

// Write the updated content
fs.writeFileSync(indexPath, content);

console.log('✅ Fixed receipt issues:');
console.log('  - Added timezone to timestamp display');
console.log('  - Removed hardcoded 30-day deadline (now shows "To be determined")');
console.log('  - Added "or other negative effects on their property rights" to attestation');