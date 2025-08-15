const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Fix the event name from NoticeServed to NoticeCreated
const oldEventSearch = `                                    // Look for NoticeServed event
                                    const createEvent = events.find(e => e.name === 'NoticeServed');
                                    if (createEvent && createEvent.result) {
                                        noticeId = createEvent.result.documentId || createEvent.result.noticeId || 'N/A';
                                        alertId = createEvent.result.alertId || 'N/A';
                                        console.log('Found NoticeServed event:', createEvent.result);
                                    }`;

const newEventSearch = `                                    // Look for NoticeCreated event
                                    const createEvent = events.find(e => e.name === 'NoticeCreated');
                                    if (createEvent && createEvent.result) {
                                        noticeId = createEvent.result.noticeId || 'N/A';
                                        // No alertId in hybrid contract - show server ID instead
                                        const serverId = createEvent.result.serverId || '0';
                                        console.log('Found NoticeCreated event:', createEvent.result);
                                    }`;

content = content.replace(oldEventSearch, newEventSearch);

// 2. Update the details display to remove Alert ID and add more useful info
const oldDetailsDisplay = `                const detailsHtml = \`
                    <div style="margin-top: 1rem;">
                        <div class="token-detail">
                            <span>Token Name:</span>
                            <span>\${baseTokenName || 'Legal Notice'}</span>
                        </div>
                        <div class="token-detail">
                            <span>Notice ID:</span>
                            <span>\${noticeId}</span>
                        </div>
                        <div class="token-detail">
                            <span>Alert ID:</span>
                            <span>\${alertId}</span>
                        </div>`;

const newDetailsDisplay = `                const detailsHtml = \`
                    <div style="margin-top: 1rem;">
                        <div class="token-detail">
                            <span>Token Name:</span>
                            <span>\${baseTokenName || 'Legal Notice'}</span>
                        </div>
                        <div class="token-detail">
                            <span>Notice ID:</span>
                            <span>\${noticeId}</span>
                        </div>
                        <div class="token-detail">
                            <span>Notice Type:</span>
                            <span>\${noticeType || documentType || 'Legal Notice'}</span>
                        </div>`;

content = content.replace(oldDetailsDisplay, newDetailsDisplay);

// 3. Also fix the showTransactionResult function to not expect alertId
const oldShowTransactionResult = `function showTransactionResult(success, data = {}) {
            const { noticeId, alertId, txHash, recipient, feePaid, energyUsed, bandwidthUsed } = data;`;

const newShowTransactionResult = `function showTransactionResult(success, data = {}) {
            const { noticeId, txHash, recipient, feePaid, energyUsed, bandwidthUsed } = data;`;

content = content.replace(oldShowTransactionResult, newShowTransactionResult);

// 4. Remove Alert ID from transaction result modal
const oldModalDisplay = `                    <div class="result-item">
                        <span class="result-label">Alert ID:</span>
                        <span class="result-value">\${alertId || 'N/A'}</span>
                    </div>`;

// Replace with empty string to remove it
content = content.replace(oldModalDisplay, '');

// Write the updated content
fs.writeFileSync(indexPath, content);

console.log('✅ Fixed notice event parsing:');
console.log('  - Changed event name from NoticeServed to NoticeCreated');
console.log('  - Removed Alert ID (not in hybrid contract)');
console.log('  - Added Notice Type to transaction details');
console.log('  - Updated event result parsing to match actual contract events');