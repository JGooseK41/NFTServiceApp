const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Fix the undefined caseDetails variable in the transaction details
// The variable is actually called caseDetailsText
const oldCaseDetailsLine = `                                <strong>Case Details:</strong> \${escapeHtml(caseDetails) || 'See attached document'}<br>`;
const newCaseDetailsLine = `                                <strong>Case Details:</strong> \${escapeHtml(caseDetailsText) || 'See attached document'}<br>`;

content = content.replace(oldCaseDetailsLine, newCaseDetailsLine);

// 2. Also need to pass caseDetailsText to showTxModal
const oldShowTxModal = `                showTxModal(displayTxId, 'Legal notice created successfully!', txDetails, ipfsData);`;
const newShowTxModal = `                // Store case details for receipt export
                window.lastTransactionCaseDetails = caseDetailsText || noticeText || 'See attached document';
                showTxModal(displayTxId, 'Legal notice created successfully!', txDetails, ipfsData);`;

content = content.replace(oldShowTxModal, newShowTxModal);

// 3. Fix the receipt export to properly extract case details
const oldCaseDetailsExtract = `                            let caseDetails = '';`;
const newCaseDetailsExtract = `                            let caseDetails = window.lastTransactionCaseDetails || '';`;

content = content.replace(oldCaseDetailsExtract, newCaseDetailsExtract);

// 4. Also add a fallback to extract from the synopsis content
const oldSynopsisExtraction = `                                const caseDetailsMatch = synopsisContent.match(/Case Details: ([^\\n]+)/);
                                if (caseDetailsMatch) caseDetails = caseDetailsMatch[1].trim();`;

const newSynopsisExtraction = `                                const caseDetailsMatch = synopsisContent.match(/Case Details: ([^\\n]+)/);
                                if (caseDetailsMatch && caseDetailsMatch[1] !== '[object HTMLInputElement]') {
                                    caseDetails = caseDetailsMatch[1].trim();
                                }
                                // Fallback to stored value if parsing fails
                                if (!caseDetails || caseDetails === '[object HTMLInputElement]') {
                                    caseDetails = window.lastTransactionCaseDetails || 'See attached document';
                                }`;

content = content.replace(oldSynopsisExtraction, newSynopsisExtraction);

// Write the updated content
fs.writeFileSync(indexPath, content);

console.log('✅ Fixed case details in receipt:');
console.log('  - Changed undefined caseDetails to caseDetailsText in transaction details');
console.log('  - Store case details in window variable for receipt export');
console.log('  - Added fallback to prevent [object HTMLInputElement] from appearing');
console.log('  - Receipt will now show actual case details or public notice text');