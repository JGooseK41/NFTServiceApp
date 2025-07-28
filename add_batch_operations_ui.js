const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Add a batch operations button after the single notice button
const singleNoticeButton = `                    <button class="btn btn-primary" onclick="showMintModal()">
                        <i class="fas fa-plus-circle"></i> Create Legal Notice
                    </button>`;

const batchOperationsButtons = `                    <button class="btn btn-primary" onclick="showMintModal()">
                        <i class="fas fa-plus-circle"></i> Create Legal Notice
                    </button>
                    <button class="btn btn-secondary" onclick="showBatchModal()" style="margin-left: 0.5rem;">
                        <i class="fas fa-layer-group"></i> Batch Operations
                    </button>`;

content = content.replace(singleNoticeButton, batchOperationsButtons);

// 2. Add the batch modal HTML after the mint modal
const mintModalEnd = `        </div>
    </div>

    <!-- Transaction Success Modal -->`;

const batchModal = `        </div>
    </div>

    <!-- Batch Operations Modal -->
    <div id="batchModal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeBatchModal()">&times;</span>
            <h2><i class="fas fa-layer-group"></i> Batch Legal Notices</h2>
            
            <!-- Tab Navigation -->
            <div class="batch-tabs">
                <button class="batch-tab active" onclick="showBatchTab('csv')">
                    <i class="fas fa-file-csv"></i> CSV Upload
                </button>
                <button class="batch-tab" onclick="showBatchTab('manual')">
                    <i class="fas fa-list"></i> Manual Entry
                </button>
            </div>
            
            <!-- CSV Upload Tab -->
            <div id="csvTab" class="batch-tab-content active">
                <div class="form-group">
                    <label for="csvFile" class="form-label">
                        <i class="fas fa-file-upload"></i> Upload CSV File
                    </label>
                    <input type="file" id="csvFile" accept=".csv" onchange="handleCSVUpload(event)" class="form-input">
                    <p class="form-help">
                        CSV format: recipient_address, notice_type, case_number, issuing_agency, public_text
                    </p>
                    <div class="csv-template">
                        <a href="#" onclick="downloadCSVTemplate()" class="btn btn-secondary btn-small">
                            <i class="fas fa-download"></i> Download Template
                        </a>
                    </div>
                </div>
                
                <!-- CSV Preview -->
                <div id="csvPreview" style="display: none;">
                    <h3>Preview</h3>
                    <div class="table-wrapper">
                        <table id="csvPreviewTable" class="data-table">
                            <thead>
                                <tr>
                                    <th>Recipient</th>
                                    <th>Notice Type</th>
                                    <th>Case Number</th>
                                    <th>Agency</th>
                                    <th>Public Text</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <!-- Manual Entry Tab -->
            <div id="manualTab" class="batch-tab-content">
                <div class="batch-common-fields">
                    <h3>Common Fields (Applied to All)</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="batchNoticeType" class="form-label">Notice Type</label>
                            <select id="batchNoticeType" class="form-input">
                                <option value="Summons">Summons</option>
                                <option value="Subpoena">Subpoena</option>
                                <option value="Complaint">Complaint</option>
                                <option value="Motion">Motion</option>
                                <option value="Order">Order</option>
                                <option value="Notice">Notice</option>
                                <option value="Custom">Custom</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="batchIssuingAgency" class="form-label">Issuing Agency</label>
                            <input type="text" id="batchIssuingAgency" class="form-input" placeholder="Superior Court">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="batchDocument" class="form-label">
                            <i class="fas fa-file-image"></i> Document (Same for All)
                        </label>
                        <input type="file" id="batchDocument" accept="image/*" onchange="handleBatchDocumentUpload(event)" class="form-input">
                    </div>
                </div>
                
                <div class="batch-recipients">
                    <h3>Recipients</h3>
                    <div id="recipientsList">
                        <div class="recipient-entry">
                            <input type="text" placeholder="Recipient Address" class="form-input recipient-address">
                            <input type="text" placeholder="Case Number" class="form-input case-number">
                            <button class="btn btn-danger btn-small" onclick="removeRecipient(this)">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <button class="btn btn-secondary" onclick="addRecipient()">
                        <i class="fas fa-plus"></i> Add Recipient
                    </button>
                </div>
            </div>
            
            <!-- Batch Summary -->
            <div class="batch-summary" id="batchSummary" style="display: none;">
                <h3>Batch Summary</h3>
                <div class="summary-details">
                    <div class="summary-item">
                        <span>Total Recipients:</span>
                        <span id="totalRecipients">0</span>
                    </div>
                    <div class="summary-item">
                        <span>Delivery Method:</span>
                        <span id="batchDeliveryMethod">Document</span>
                    </div>
                    <div class="summary-item">
                        <span>Fee per Notice:</span>
                        <span id="batchFeePerNotice">152 TRX</span>
                    </div>
                    <div class="summary-item">
                        <span>Total Cost:</span>
                        <span id="batchTotalCost" class="text-primary">0 TRX</span>
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="modal-actions" style="margin-top: 2rem;">
                <button id="processBatchBtn" class="btn btn-primary" onclick="processBatchNotices()" disabled>
                    <i class="fas fa-paper-plane"></i> Process Batch
                </button>
                <button class="btn btn-secondary" onclick="closeBatchModal()">Cancel</button>
            </div>
        </div>
    </div>

    <!-- Transaction Success Modal -->`;

content = content.replace(mintModalEnd, batchModal);

// 3. Add CSS for batch operations
const cssInsertPoint = `        /* Modal Styles */`;
const batchCSS = `        /* Batch Operations Styles */
        .batch-tabs {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
            border-bottom: 2px solid var(--border-color);
        }
        
        .batch-tab {
            padding: 0.75rem 1.5rem;
            background: none;
            border: none;
            border-bottom: 2px solid transparent;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .batch-tab.active {
            color: var(--primary);
            border-bottom-color: var(--primary);
        }
        
        .batch-tab:hover {
            color: var(--primary);
        }
        
        .batch-tab-content {
            display: none;
        }
        
        .batch-tab-content.active {
            display: block;
        }
        
        .csv-template {
            margin-top: 0.5rem;
        }
        
        .table-wrapper {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            margin-top: 1rem;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .data-table th,
        .data-table td {
            padding: 0.5rem;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }
        
        .data-table th {
            background-color: var(--surface);
            font-weight: 600;
            position: sticky;
            top: 0;
        }
        
        .batch-common-fields {
            background-color: var(--surface);
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1.5rem;
        }
        
        .batch-recipients {
            margin-top: 1.5rem;
        }
        
        .recipient-entry {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
            align-items: center;
        }
        
        .recipient-entry .recipient-address {
            flex: 1.5;
        }
        
        .recipient-entry .case-number {
            flex: 1;
        }
        
        .batch-summary {
            background-color: var(--surface);
            padding: 1rem;
            border-radius: 0.5rem;
            margin-top: 1.5rem;
        }
        
        .summary-details {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
            margin-top: 1rem;
        }
        
        .summary-item {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem;
            background-color: var(--background);
            border-radius: 0.25rem;
        }

        /* Modal Styles */`;

content = content.replace(cssInsertPoint, batchCSS);

// 4. Add JavaScript functions for batch operations
const jsInsertPoint = `        // Close mint modal`;
const batchJS = `        // Batch operations variables
        let batchNotices = [];
        let batchDocument = null;
        
        // Show batch modal
        function showBatchModal() {
            document.getElementById('batchModal').style.display = 'block';
            updateBatchSummary();
        }
        
        // Close batch modal
        function closeBatchModal() {
            document.getElementById('batchModal').style.display = 'none';
            // Reset form
            batchNotices = [];
            batchDocument = null;
            document.getElementById('csvFile').value = '';
            document.getElementById('batchDocument').value = '';
            document.getElementById('csvPreview').style.display = 'none';
            resetManualRecipients();
        }
        
        // Show batch tab
        function showBatchTab(tab) {
            // Update tab buttons
            document.querySelectorAll('.batch-tab').forEach(t => t.classList.remove('active'));
            document.querySelector(\`.batch-tab:nth-child(\${tab === 'csv' ? 1 : 2})\`).classList.add('active');
            
            // Update tab content
            document.querySelectorAll('.batch-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tab + 'Tab').classList.add('active');
        }
        
        // Handle CSV upload
        async function handleCSVUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const text = await file.text();
            const lines = text.split('\\n').filter(line => line.trim());
            
            // Skip header if present
            const startIndex = lines[0].toLowerCase().includes('recipient') ? 1 : 0;
            
            batchNotices = [];
            const tbody = document.querySelector('#csvPreviewTable tbody');
            tbody.innerHTML = '';
            
            for (let i = startIndex; i < lines.length; i++) {
                const parts = lines[i].split(',').map(p => p.trim());
                if (parts.length >= 5) {
                    const notice = {
                        recipient: parts[0],
                        noticeType: parts[1],
                        caseNumber: parts[2],
                        issuingAgency: parts[3],
                        publicText: parts[4]
                    };
                    batchNotices.push(notice);
                    
                    // Add to preview table
                    const row = tbody.insertRow();
                    row.innerHTML = \`
                        <td>\${notice.recipient.substring(0, 10)}...</td>
                        <td>\${notice.noticeType}</td>
                        <td>\${notice.caseNumber}</td>
                        <td>\${notice.issuingAgency}</td>
                        <td>\${notice.publicText.substring(0, 30)}...</td>
                        <td>
                            <button class="btn btn-danger btn-small" onclick="removeBatchNotice(\${i - startIndex})">
                                <i class="fas fa-times"></i>
                            </button>
                        </td>
                    \`;
                }
            }
            
            document.getElementById('csvPreview').style.display = 'block';
            updateBatchSummary();
        }
        
        // Download CSV template
        function downloadCSVTemplate() {
            const template = 'recipient_address,notice_type,case_number,issuing_agency,public_text\\n' +
                            'TVjsYu2yQ3n9E6LYS43gdWKddJu82L3xZy,Summons,CV-2024-001234,Superior Court,You are hereby summoned...\\n' +
                            'TN9RRaXkCFtTXRJ6BpXCow5tzVojQEz6Xb,Complaint,CV-2024-001235,District Court,Complaint filed regarding...';
            
            const blob = new Blob([template], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'legal_notices_template.csv';
            a.click();
            URL.revokeObjectURL(url);
        }
        
        // Handle batch document upload
        async function handleBatchDocumentUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                batchDocument = e.target.result;
                uiManager.showNotification('success', 'Document uploaded for batch notices');
            };
            reader.readAsDataURL(file);
        }
        
        // Add recipient for manual entry
        function addRecipient() {
            const recipientsList = document.getElementById('recipientsList');
            const div = document.createElement('div');
            div.className = 'recipient-entry';
            div.innerHTML = \`
                <input type="text" placeholder="Recipient Address" class="form-input recipient-address">
                <input type="text" placeholder="Case Number" class="form-input case-number">
                <button class="btn btn-danger btn-small" onclick="removeRecipient(this)">
                    <i class="fas fa-times"></i>
                </button>
            \`;
            recipientsList.appendChild(div);
        }
        
        // Remove recipient
        function removeRecipient(button) {
            button.parentElement.remove();
            updateBatchSummary();
        }
        
        // Remove batch notice from CSV
        function removeBatchNotice(index) {
            batchNotices.splice(index, 1);
            handleCSVUpload({ target: { files: [document.getElementById('csvFile').files[0]] } });
        }
        
        // Reset manual recipients
        function resetManualRecipients() {
            const recipientsList = document.getElementById('recipientsList');
            recipientsList.innerHTML = \`
                <div class="recipient-entry">
                    <input type="text" placeholder="Recipient Address" class="form-input recipient-address">
                    <input type="text" placeholder="Case Number" class="form-input case-number">
                    <button class="btn btn-danger btn-small" onclick="removeRecipient(this)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            \`;
        }
        
        // Update batch summary
        function updateBatchSummary() {
            const activeTab = document.querySelector('.batch-tab.active').textContent.includes('CSV') ? 'csv' : 'manual';
            let count = 0;
            
            if (activeTab === 'csv') {
                count = batchNotices.length;
            } else {
                count = document.querySelectorAll('.recipient-entry').length;
            }
            
            document.getElementById('totalRecipients').textContent = count;
            const totalCost = count * 152; // 150 + 2 TRX sponsorship
            document.getElementById('batchTotalCost').textContent = totalCost + ' TRX';
            
            document.getElementById('batchSummary').style.display = count > 0 ? 'block' : 'none';
            document.getElementById('processBatchBtn').disabled = count === 0;
        }
        
        // Process batch notices
        async function processBatchNotices() {
            if (!legalContract) {
                uiManager.showNotification('error', 'Contract not connected');
                return;
            }
            
            const activeTab = document.querySelector('.batch-tab.active').textContent.includes('CSV') ? 'csv' : 'manual';
            let notices = [];
            
            if (activeTab === 'csv') {
                notices = batchNotices;
            } else {
                // Collect from manual entry
                const noticeType = document.getElementById('batchNoticeType').value;
                const issuingAgency = document.getElementById('batchIssuingAgency').value;
                
                document.querySelectorAll('.recipient-entry').forEach(entry => {
                    const recipient = entry.querySelector('.recipient-address').value.trim();
                    const caseNumber = entry.querySelector('.case-number').value.trim();
                    
                    if (recipient && caseNumber) {
                        notices.push({
                            recipient,
                            noticeType,
                            caseNumber,
                            issuingAgency,
                            publicText: \`Legal Notice: \${noticeType} - Case \${caseNumber}\`
                        });
                    }
                });
            }
            
            if (notices.length === 0) {
                uiManager.showNotification('error', 'No valid notices to process');
                return;
            }
            
            // Prepare batch parameters
            const recipients = notices.map(n => n.recipient);
            const params = {
                publicText: notices[0].publicText || 'Legal Notice',
                encryptedIPFS: batchDocument ? await uploadToIPFS(batchDocument) : '',
                encryptionKey: batchDocument ? generateEncryptionKey() : '',
                noticeType: notices[0].noticeType,
                caseNumber: notices.map(n => n.caseNumber).join(', '),
                issuingAgency: notices[0].issuingAgency,
                tokenNamePrefix: 'Batch Notice',
                hasDocument: !!batchDocument,
                sponsorFees: true
            };
            
            const processBatchBtn = document.getElementById('processBatchBtn');
            processBatchBtn.disabled = true;
            processBatchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            
            try {
                showProcessing('Processing batch notices...');
                
                // Calculate total fee
                const feePerNotice = await legalContract.calculateFee(tronWeb.defaultAddress.base58).call();
                const totalFee = tronWeb.toBigNumber(feePerNotice).multipliedBy(notices.length);
                
                // Call batch function
                const tx = await legalContract.createBatchNotices(recipients, params).send({
                    feeLimit: 500_000_000, // 500 TRX for batch
                    callValue: totalFee.toString(),
                    shouldPollResponse: false
                });
                
                hideProcessing();
                closeBatchModal();
                
                // Show success with batch details
                const details = \`
                    <div style="margin-top: 1rem;">
                        <div class="token-detail">
                            <span>Total Notices:</span>
                            <span>\${notices.length}</span>
                        </div>
                        <div class="token-detail">
                            <span>Total Cost:</span>
                            <span>\${tronWeb.fromSun(totalFee)} TRX</span>
                        </div>
                    </div>
                \`;
                
                showTxModal(tx, \`Successfully created \${notices.length} legal notices in batch!\`, details);
                
            } catch (error) {
                hideProcessing();
                console.error('Batch processing error:', error);
                uiManager.showNotification('error', 'Failed to process batch: ' + error.message);
            } finally {
                processBatchBtn.disabled = false;
                processBatchBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Process Batch';
            }
        }

        // Close mint modal`;

content = content.replace(jsInsertPoint, batchJS);

// Write the updated content
fs.writeFileSync(indexPath, content);

console.log('✅ Added batch operations UI');
console.log('✅ Features added:');
console.log('  - Batch operations button in main UI');
console.log('  - Modal with CSV upload and manual entry tabs');
console.log('  - CSV template download');
console.log('  - Batch summary with cost calculation');
console.log('  - Integration with createBatchNotices contract function');