const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Add a View on Tronscan button to the transaction modal
// Find the modal actions section
const oldModalActions = `                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="copyTxHash()">
                        <i class="fas fa-copy"></i> Copy TX Hash
                    </button>
                    <button class="btn btn-secondary" onclick="exportReceipt()">
                        <i class="fas fa-file-download"></i> Export Receipt
                    </button>
                    <button class="btn btn-secondary" onclick="closeTxModal()">Close</button>
                </div>`;

const newModalActions = `                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="copyTxHash()">
                        <i class="fas fa-copy"></i> Copy TX Hash
                    </button>
                    <a id="viewOnTronscanBtn" href="#" target="_blank" class="btn btn-primary">
                        <i class="fas fa-external-link-alt"></i> View on Tronscan
                    </a>
                    <button class="btn btn-secondary" onclick="exportReceipt()">
                        <i class="fas fa-file-download"></i> Export Receipt
                    </button>
                    <button class="btn btn-secondary" onclick="closeTxModal()">Close</button>
                </div>`;

content = content.replace(oldModalActions, newModalActions);

// 2. Update showTxModal to set the Tronscan link
const oldShowTxModal = `            txLink.href = tronscanUrl + txHash;
            modal.style.display = 'block';`;

const newShowTxModal = `            txLink.href = tronscanUrl + txHash;
            
            // Also update the View on Tronscan button
            const viewOnTronscanBtn = document.getElementById('viewOnTronscanBtn');
            if (viewOnTronscanBtn) {
                viewOnTronscanBtn.href = tronscanUrl + txHash;
            }
            
            modal.style.display = 'block';`;

content = content.replace(oldShowTxModal, newShowTxModal);

// 3. Add save functionality to the receipt window
// Find the print button in the receipt
const oldPrintButton = `                    <button class="print-button no-print" onclick="window.print()">Print Receipt</button>`;

const newPrintSaveButtons = `                    <div class="no-print" style="display: flex; gap: 1rem; justify-content: center; margin: 2rem 0;">
                        <button class="print-button" onclick="window.print()">
                            <i class="fas fa-print"></i> Print Receipt
                        </button>
                        <button class="print-button" onclick="saveReceiptAsHTML()" style="background: #059669;">
                            <i class="fas fa-save"></i> Save Receipt
                        </button>
                    </div>`;

content = content.replace(oldPrintButton, newPrintSaveButtons);

// 4. Add the saveReceiptAsHTML function to the receipt window
const oldReceiptScriptEnd = `            receiptWindow.document.write(receiptHTML);
            receiptWindow.document.close();`;

const newReceiptScriptEnd = `            receiptWindow.document.write(receiptHTML);
            receiptWindow.document.close();
            
            // Add save function to the receipt window
            receiptWindow.saveReceiptAsHTML = function() {
                // Get the full HTML content
                const htmlContent = receiptWindow.document.documentElement.outerHTML;
                
                // Create a blob with the HTML
                const blob = new Blob([htmlContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                
                // Create download link
                const a = document.createElement('a');
                a.href = url;
                a.download = 'legal-notice-receipt-' + txHash.substring(0, 8) + '.html';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            };`;

content = content.replace(oldReceiptScriptEnd, newReceiptScriptEnd);

// 5. Update button styling in receipt CSS
const oldPrintButtonStyle = `            .print-button {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 12px 24px;
                font-size: 16px;
                border-radius: 6px;
                cursor: pointer;
                margin: 20px auto;
                display: block;
            }`;

const newPrintButtonStyle = `            .print-button {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 12px 24px;
                font-size: 16px;
                border-radius: 6px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .print-button i {
                font-size: 18px;
            }`;

content = content.replace(oldPrintButtonStyle, newPrintButtonStyle);

// Write the updated content
fs.writeFileSync(indexPath, content);

console.log('✅ Added Tronscan button and save receipt functionality:');
console.log('  - Added "View on Tronscan" button to transaction success modal');
console.log('  - Button opens transaction in new tab on appropriate network');
console.log('  - Added "Save Receipt" button next to Print button');
console.log('  - Save button downloads receipt as HTML file to computer');
console.log('  - Updated button styling with icons');