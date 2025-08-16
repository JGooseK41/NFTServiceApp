/**
 * Case Preparation System
 * Stage 1: Prepare and store cases with documents
 * Stage 2: Mint NFTs from prepared cases
 */

window.CasePreparationSystem = {
    
    backend: 'https://nftserviceapp.onrender.com',
    currentCase: null,
    preparedCases: [],
    
    /**
     * Initialize the system
     */
    async init() {
        console.log('🗂️ Initializing Case Preparation System...');
        
        // Load prepared cases from backend
        await this.loadPreparedCases();
        
        // Add UI elements
        this.injectUI();
        
        // Hook into document upload
        this.hookDocumentUpload();
        
        console.log('✅ Case Preparation System ready');
    },
    
    /**
     * Create new case
     */
    async createCase(caseData) {
        console.log('📋 Creating new case:', caseData.caseNumber);
        
        try {
            const response = await fetch(`${this.backend}/api/cases`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58
                },
                body: JSON.stringify({
                    case_number: caseData.caseNumber,
                    case_title: caseData.caseTitle,
                    notice_type: caseData.noticeType,
                    issuing_agency: caseData.issuingAgency,
                    server_address: window.tronWeb?.defaultAddress?.base58,
                    status: 'preparing',
                    created_at: new Date().toISOString()
                })
            });
            
            if (!response.ok) throw new Error('Failed to create case');
            
            const result = await response.json();
            this.currentCase = result;
            
            console.log('✅ Case created:', result);
            return result;
            
        } catch (error) {
            console.error('❌ Failed to create case:', error);
            throw error;
        }
    },
    
    /**
     * Process and store documents for current case
     */
    async processDocuments(documents) {
        if (!this.currentCase) {
            throw new Error('No case selected. Create a case first.');
        }
        
        console.log(`📄 Processing ${documents.length} documents for case ${this.currentCase.case_number}`);
        
        try {
            // Step 1: Merge PDFs if multiple
            let combinedDocument;
            if (documents.length > 1) {
                console.log('📑 Merging multiple documents...');
                combinedDocument = await this.mergeDocuments(documents);
            } else {
                combinedDocument = documents[0];
            }
            
            // Step 2: Create alert thumbnail with overlay
            console.log('🖼️ Creating alert NFT image...');
            const alertImage = await this.createAlertImage(combinedDocument);
            
            // Step 3: Store to backend
            console.log('💾 Storing processed documents...');
            const stored = await this.storeProcessedDocuments({
                case_id: this.currentCase.id,
                case_number: this.currentCase.case_number,
                alert_image: alertImage,
                alert_thumbnail: alertImage,
                document_image: combinedDocument.data,
                document_thumbnail: combinedDocument.preview,
                page_count: combinedDocument.pageCount || 1,
                file_names: documents.map(d => d.fileName).join(', ')
            });
            
            // Step 4: Update case status
            await this.updateCaseStatus(this.currentCase.id, 'prepared');
            
            console.log('✅ Documents processed and stored');
            return stored;
            
        } catch (error) {
            console.error('❌ Document processing failed:', error);
            throw error;
        }
    },
    
    /**
     * Merge multiple documents into one
     */
    async mergeDocuments(documents) {
        // Use existing multi-document-handler if available
        if (window.MultiDocumentHandler) {
            const handler = new MultiDocumentHandler();
            handler.documents = documents;
            return await handler.mergePDFs();
        }
        
        // Fallback: concatenate images
        console.log('📋 Concatenating documents...');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate total height
        let totalHeight = 0;
        let maxWidth = 0;
        const images = [];
        
        for (const doc of documents) {
            const img = new Image();
            img.src = doc.data;
            await new Promise(resolve => img.onload = resolve);
            images.push(img);
            totalHeight += img.height;
            maxWidth = Math.max(maxWidth, img.width);
        }
        
        canvas.width = maxWidth;
        canvas.height = totalHeight;
        
        // Draw all images
        let currentY = 0;
        for (const img of images) {
            ctx.drawImage(img, 0, currentY);
            currentY += img.height;
        }
        
        return {
            data: canvas.toDataURL('image/jpeg', 0.9),
            preview: canvas.toDataURL('image/jpeg', 0.5),
            pageCount: documents.reduce((sum, d) => sum + (d.pageCount || 1), 0)
        };
    },
    
    /**
     * Create alert image with legal notice overlay
     */
    async createAlertImage(document) {
        console.log('🎨 Adding legal notice overlay...');
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Load document image
        const img = new Image();
        img.src = document.preview || document.data;
        await new Promise(resolve => img.onload = resolve);
        
        // Set canvas size
        canvas.width = Math.min(img.width, 800);
        canvas.height = Math.min(img.height, 1000);
        
        // Draw document
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Add red border
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
        
        // Add header banner
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, 0, canvas.width, 100);
        
        // Add text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LEGAL NOTICE', canvas.width / 2, 40);
        
        ctx.font = '20px Arial';
        ctx.fillText('Blockchain Service Document', canvas.width / 2, 70);
        
        // Add timestamp footer
        ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
        ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
        
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Prepared: ${new Date().toLocaleString()}`, 10, canvas.height - 15);
        
        ctx.textAlign = 'right';
        ctx.fillText(`Case: ${this.currentCase?.case_number || 'N/A'}`, canvas.width - 10, canvas.height - 15);
        
        return canvas.toDataURL('image/jpeg', 0.85);
    },
    
    /**
     * Store processed documents to backend
     */
    async storeProcessedDocuments(data) {
        const response = await fetch(`${this.backend}/api/cases/${data.case_id}/documents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) throw new Error('Failed to store documents');
        
        return await response.json();
    },
    
    /**
     * Update case status
     */
    async updateCaseStatus(caseId, status) {
        const response = await fetch(`${this.backend}/api/cases/${caseId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58
            },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) throw new Error('Failed to update case');
        
        return await response.json();
    },
    
    /**
     * Load prepared cases from backend
     */
    async loadPreparedCases() {
        try {
            const response = await fetch(`${this.backend}/api/cases?status=prepared`, {
                headers: {
                    'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58
                }
            });
            
            if (response.ok) {
                this.preparedCases = await response.json();
                console.log(`📂 Loaded ${this.preparedCases.length} prepared cases`);
            }
        } catch (error) {
            console.error('Failed to load cases:', error);
        }
    },
    
    /**
     * Mint NFTs from prepared case
     */
    async mintFromCase(caseId, recipients) {
        console.log(`🚀 Minting NFTs from case ${caseId}`);
        
        // Load case data
        const caseData = await this.loadCase(caseId);
        if (!caseData) throw new Error('Case not found');
        
        // Load stored images
        const documents = await this.loadCaseDocuments(caseId);
        if (!documents) throw new Error('No documents found for case');
        
        // Prepare transaction data
        const transactionData = {
            caseNumber: caseData.case_number,
            noticeType: caseData.notice_type,
            issuingAgency: caseData.issuing_agency,
            recipients: recipients,
            alertImage: documents.alert_image,
            documentImage: documents.document_image,
            // These will be encrypted and sent to IPFS during minting
            documentData: documents.document_image,
            hasDocument: true
        };
        
        // Use existing minting flow
        if (window.createLegalNoticeWithStaging) {
            return await window.createLegalNoticeWithStaging(transactionData);
        } else if (window.createLegalNotice) {
            return await window.createLegalNotice(transactionData);
        } else {
            throw new Error('Minting function not available');
        }
    },
    
    /**
     * Load specific case
     */
    async loadCase(caseId) {
        const response = await fetch(`${this.backend}/api/cases/${caseId}`, {
            headers: {
                'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58
            }
        });
        
        if (!response.ok) return null;
        return await response.json();
    },
    
    /**
     * Load case documents
     */
    async loadCaseDocuments(caseId) {
        const response = await fetch(`${this.backend}/api/cases/${caseId}/documents`, {
            headers: {
                'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58
            }
        });
        
        if (!response.ok) return null;
        return await response.json();
    },
    
    /**
     * Inject UI elements
     */
    injectUI() {
        // Add "Prepare Case" button to Create tab
        const createTabButtons = document.querySelector('#createTab .form-actions');
        if (createTabButtons && !document.getElementById('prepareCaseBtn')) {
            const prepareBtn = document.createElement('button');
            prepareBtn.id = 'prepareCaseBtn';
            prepareBtn.className = 'btn btn-warning';
            prepareBtn.innerHTML = `
                <i class="fas fa-folder-plus"></i>
                Prepare Case (No Cost)
            `;
            prepareBtn.onclick = () => this.showPrepareCaseModal();
            
            // Insert before the mint button
            const mintBtn = createTabButtons.querySelector('.btn-primary');
            createTabButtons.insertBefore(prepareBtn, mintBtn);
        }
        
        // Add "Prepared Cases" tab
        this.addPreparedCasesTab();
    },
    
    /**
     * Add Prepared Cases tab
     */
    addPreparedCasesTab() {
        // Add tab button
        const tabButtons = document.querySelector('.tab-buttons');
        if (tabButtons && !document.querySelector('[onclick*="preparedCases"]')) {
            const tabBtn = document.createElement('button');
            tabBtn.className = 'tab-btn';
            tabBtn.innerHTML = `
                <i class="fas fa-folder-open"></i>
                <span>Prepared Cases</span>
            `;
            tabBtn.onclick = () => this.showPreparedCases();
            
            // Insert after Create tab
            const createTab = tabButtons.querySelector('[onclick*="create"]');
            if (createTab) {
                createTab.parentNode.insertBefore(tabBtn, createTab.nextSibling);
            }
        }
    },
    
    /**
     * Show prepare case modal
     */
    showPrepareCaseModal() {
        // Check if documents are uploaded
        if (!window.uploadedDocumentsList || window.uploadedDocumentsList.length === 0) {
            alert('Please upload documents first');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Prepare Case for Later Service</h3>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body">
                    <p>This will process and store your documents without any blockchain transaction or cost.</p>
                    
                    <div class="form-group">
                        <label>Case Number *</label>
                        <input type="text" id="prepCaseNumber" class="form-control" 
                               value="${document.getElementById('mintCaseNumber')?.value || ''}" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Case Title</label>
                        <input type="text" id="prepCaseTitle" class="form-control" 
                               placeholder="e.g., Smith v. Jones">
                    </div>
                    
                    <div class="form-group">
                        <label>Notice Type</label>
                        <select id="prepNoticeType" class="form-control">
                            <option>Legal Notice</option>
                            <option>Court Summons</option>
                            <option>Subpoena</option>
                            <option>Eviction Notice</option>
                            <option>Other</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Issuing Agency</label>
                        <input type="text" id="prepIssuingAgency" class="form-control" 
                               value="${document.getElementById('issuingAgency')?.value || ''}">
                    </div>
                    
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        <strong>What happens next:</strong>
                        <ul style="margin: 10px 0 0 20px;">
                            <li>Documents will be merged into one PDF</li>
                            <li>Alert image will be created with legal notice overlay</li>
                            <li>Everything saved to database for later use</li>
                            <li>You can mint NFTs anytime from Prepared Cases tab</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="CasePreparationSystem.prepareCurrentCase(this)">
                        <i class="fas fa-save"></i> Prepare Case
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    /**
     * Prepare current case
     */
    async prepareCurrentCase(button) {
        const modal = button.closest('.modal');
        const caseNumber = modal.querySelector('#prepCaseNumber').value;
        
        if (!caseNumber) {
            alert('Case number is required');
            return;
        }
        
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        try {
            // Create case
            const caseData = {
                caseNumber: caseNumber,
                caseTitle: modal.querySelector('#prepCaseTitle').value,
                noticeType: modal.querySelector('#prepNoticeType').value,
                issuingAgency: modal.querySelector('#prepIssuingAgency').value
            };
            
            await this.createCase(caseData);
            
            // Process documents
            await this.processDocuments(window.uploadedDocumentsList);
            
            // Clear form
            window.uploadedDocumentsList = [];
            if (window.updateDocumentsList) window.updateDocumentsList();
            
            // Success
            modal.remove();
            alert(`✅ Case ${caseNumber} prepared successfully!\n\nGo to "Prepared Cases" tab to mint NFTs when ready.`);
            
            // Reload cases
            await this.loadPreparedCases();
            
        } catch (error) {
            console.error('Preparation failed:', error);
            alert('Failed to prepare case: ' + error.message);
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-save"></i> Prepare Case';
        }
    },
    
    /**
     * Show prepared cases
     */
    async showPreparedCases() {
        // Load latest cases
        await this.loadPreparedCases();
        
        // Create or update tab content
        let tabContent = document.getElementById('preparedCasesTab');
        if (!tabContent) {
            tabContent = document.createElement('div');
            tabContent.id = 'preparedCasesTab';
            tabContent.className = 'tab-content';
            document.querySelector('.main-content').appendChild(tabContent);
        }
        
        // Hide other tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        
        tabContent.style.display = 'block';
        tabContent.innerHTML = `
            <h2>📂 Prepared Cases</h2>
            <p>Cases ready for NFT minting. No blockchain costs until you mint.</p>
            
            <div class="cases-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">
                ${this.preparedCases.map(case_ => `
                    <div class="case-card" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; background: white;">
                        <h3 style="margin: 0 0 10px 0; color: #333;">
                            📋 ${case_.case_number}
                        </h3>
                        ${case_.case_title ? `<p style="margin: 5px 0; color: #666;">${case_.case_title}</p>` : ''}
                        <div style="font-size: 14px; color: #888;">
                            <p><strong>Type:</strong> ${case_.notice_type}</p>
                            <p><strong>Agency:</strong> ${case_.issuing_agency || 'N/A'}</p>
                            <p><strong>Prepared:</strong> ${new Date(case_.created_at).toLocaleDateString()}</p>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <button class="btn btn-info btn-sm" onclick="CasePreparationSystem.viewCase('${case_.id}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button class="btn btn-primary btn-sm" onclick="CasePreparationSystem.mintCase('${case_.id}')">
                                <i class="fas fa-rocket"></i> Mint NFTs
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="CasePreparationSystem.deleteCase('${case_.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('') || '<p>No prepared cases. Go to Create tab to prepare a case.</p>'}
            </div>
        `;
    },
    
    /**
     * View case details
     */
    async viewCase(caseId) {
        const caseData = await this.loadCase(caseId);
        const documents = await this.loadCaseDocuments(caseId);
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>Case ${caseData.case_number}</h3>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div>
                            <h4>Alert NFT Preview</h4>
                            <img src="${documents.alert_image}" style="width: 100%; border: 1px solid #ddd;">
                        </div>
                        <div>
                            <h4>Document Preview</h4>
                            <img src="${documents.document_thumbnail}" style="width: 100%; border: 1px solid #ddd;">
                        </div>
                    </div>
                    <div style="margin-top: 20px;">
                        <p><strong>Pages:</strong> ${documents.page_count}</p>
                        <p><strong>Files:</strong> ${documents.file_names}</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    <button class="btn btn-primary" onclick="CasePreparationSystem.mintCase('${caseId}'); this.closest('.modal').remove()">
                        <i class="fas fa-rocket"></i> Mint NFTs
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    /**
     * Mint case - show recipient entry
     */
    async mintCase(caseId) {
        const caseData = await this.loadCase(caseId);
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Mint NFTs - Case ${caseData.case_number}</h3>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Recipient Wallet Address(es) *</label>
                        <textarea id="mintRecipients" class="form-control" rows="3" 
                                  placeholder="Enter one or more TRON addresses (one per line)" required></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="mintSponsorFees"> 
                            Sponsor Transaction Fees (2 TRX per recipient)
                        </label>
                    </div>
                    
                    <div class="alert alert-warning">
                        <strong>⚠️ This will initiate blockchain transactions</strong>
                        <ul style="margin: 10px 0 0 20px;">
                            <li>Energy will be rented (~25-35 TRX)</li>
                            <li>NFTs will be minted to recipients</li>
                            <li>Documents will be encrypted and stored to IPFS</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="CasePreparationSystem.executeMint('${caseId}', this)">
                        <i class="fas fa-rocket"></i> Mint NFTs
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    /**
     * Execute minting
     */
    async executeMint(caseId, button) {
        const modal = button.closest('.modal');
        const recipientText = modal.querySelector('#mintRecipients').value;
        const sponsorFees = modal.querySelector('#mintSponsorFees').checked;
        
        if (!recipientText) {
            alert('Please enter at least one recipient address');
            return;
        }
        
        const recipients = recipientText.split('\n')
            .map(r => r.trim())
            .filter(r => r.length > 0);
        
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Minting...';
        
        try {
            // Set sponsor fees flag
            const sponsorCheckbox = document.getElementById('sponsorTransactionFees');
            if (sponsorCheckbox) sponsorCheckbox.checked = sponsorFees;
            
            // Mint from prepared case
            await this.mintFromCase(caseId, recipients);
            
            // Update case status
            await this.updateCaseStatus(caseId, 'served');
            
            modal.remove();
            
        } catch (error) {
            console.error('Minting failed:', error);
            alert('Minting failed: ' + error.message);
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-rocket"></i> Mint NFTs';
        }
    },
    
    /**
     * Delete case
     */
    async deleteCase(caseId) {
        if (!confirm('Delete this prepared case? This cannot be undone.')) return;
        
        try {
            const response = await fetch(`${this.backend}/api/cases/${caseId}`, {
                method: 'DELETE',
                headers: {
                    'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58
                }
            });
            
            if (!response.ok) throw new Error('Failed to delete case');
            
            await this.loadPreparedCases();
            this.showPreparedCases();
            
        } catch (error) {
            alert('Failed to delete case: ' + error.message);
        }
    },
    
    /**
     * Hook into document upload to capture converted images
     */
    hookDocumentUpload() {
        const originalUpdate = window.updateDocumentsList;
        if (originalUpdate) {
            window.updateDocumentsList = function() {
                // Call original
                originalUpdate.call(this);
                
                // Store converted images for later use
                if (window.uploadedDocumentsList && window.uploadedDocumentsList.length > 0) {
                    const lastDoc = window.uploadedDocumentsList[window.uploadedDocumentsList.length - 1];
                    if (lastDoc.preview) {
                        localStorage.setItem('lastAlertThumbnail', lastDoc.preview);
                    }
                    if (lastDoc.data) {
                        localStorage.setItem('lastDocumentImage', lastDoc.data);
                    }
                }
            };
        }
    }
};

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        CasePreparationSystem.init();
    });
} else {
    CasePreparationSystem.init();
}