/**
 * Draft Management System
 * Save and resume NFT creation progress
 */

window.DraftsManager = {
    API_BASE: window.location.hostname === 'localhost' 
        ? 'http://localhost:3001/api/drafts'
        : 'https://nftserviceapp.onrender.com/api/drafts',
    
    currentDraftId: null,
    autoSaveTimer: null,
    
    /**
     * Save current form as draft
     */
    async saveDraft(draftName = null) {
        try {
            // Collect all form data
            const formData = new FormData();
            
            // Basic fields
            const recipients = window.getAllRecipients ? window.getAllRecipients() : 
                              [document.getElementById('mintRecipient')?.value.trim() || ''];
            const publicText = document.getElementById('noticeText')?.value.trim() || '';
            const noticeType = document.getElementById('noticeType')?.value || 'Legal Notice';
            const customType = document.getElementById('customNoticeType')?.value.trim() || '';
            const caseNumber = document.getElementById('mintCaseNumber')?.value.trim() || '';
            const issuingAgency = document.getElementById('issuingAgency')?.value.trim() || '';
            const tokenName = document.getElementById('mintTokenName')?.value.trim() || 'Legal Notice';
            const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked')?.value || 'document';
            const sponsorFees = document.getElementById('sponsorTransactionFees')?.checked || false;
            
            // Generate draft name if not provided
            if (!draftName) {
                const timestamp = new Date().toLocaleString();
                draftName = `${caseNumber || 'Untitled'} - ${timestamp}`;
            }
            
            // Add to FormData
            formData.append('draftId', this.currentDraftId || '');
            formData.append('draftName', draftName);
            formData.append('serverAddress', window.tronWeb?.defaultAddress?.base58 || '');
            formData.append('recipients', JSON.stringify(recipients));
            formData.append('noticeType', customType || noticeType);
            formData.append('caseNumber', caseNumber);
            formData.append('issuingAgency', issuingAgency);
            formData.append('publicText', publicText);
            formData.append('tokenName', tokenName);
            formData.append('deliveryMethod', deliveryMethod);
            formData.append('sponsorFees', sponsorFees);
            
            // Save base64 data for images if they exist
            const thumbnailPreview = document.getElementById('thumbnailPreview');
            if (thumbnailPreview && thumbnailPreview.src && !thumbnailPreview.src.includes('placeholder')) {
                formData.append('thumbnailData', thumbnailPreview.src);
            }
            
            const documentPreview = document.getElementById('documentPreview');
            if (documentPreview && documentPreview.src) {
                formData.append('documentData', documentPreview.src);
            }
            
            // Save IPFS data if exists
            if (window.currentIPFSHash) {
                formData.append('ipfsHash', window.currentIPFSHash);
                formData.append('encryptedIPFS', window.encryptedIPFSHash || '');
                formData.append('encryptionKey', window.currentEncryptionKey || '');
                formData.append('metadataURI', window.currentMetadataURI || '');
            }
            
            // Save any custom fields
            const customFields = {
                hasDocument: deliveryMethod === 'document',
                requiresSignature: deliveryMethod === 'document',
                creationFee: '2',
                sponsorshipFee: '10'
            };
            formData.append('customFields', JSON.stringify(customFields));
            
            // Send to backend
            const response = await fetch(`${this.API_BASE}/save`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to save draft');
            }
            
            // Update current draft ID
            this.currentDraftId = result.draftId;
            
            // Show success notification
            this.showSaveNotification(result.draftName);
            
            return result;
            
        } catch (error) {
            console.error('Error saving draft:', error);
            throw error;
        }
    },
    
    /**
     * Load drafts list for current wallet
     */
    async loadDraftsList() {
        try {
            const serverAddress = window.tronWeb?.defaultAddress?.base58;
            if (!serverAddress) {
                return [];
            }
            
            const response = await fetch(`${this.API_BASE}/list?serverAddress=${serverAddress}`);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to load drafts');
            }
            
            return result.drafts;
            
        } catch (error) {
            console.error('Error loading drafts:', error);
            return [];
        }
    },
    
    /**
     * Load specific draft
     */
    async loadDraft(draftId) {
        try {
            const response = await fetch(`${this.API_BASE}/load/${draftId}`);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to load draft');
            }
            
            // Fill form with draft data
            this.fillFormFromDraft(result.draft);
            
            // Update current draft ID
            this.currentDraftId = draftId;
            
            // Show loaded notification
            if (window.uiManager) {
                window.uiManager.showNotification('success', `Draft "${result.draft.draft_name}" loaded`);
            }
            
            return result;
            
        } catch (error) {
            console.error('Error loading draft:', error);
            throw error;
        }
    },
    
    /**
     * Fill form fields from draft data
     */
    fillFormFromDraft(draft) {
        // Basic fields
        if (document.getElementById('mintCaseNumber')) {
            document.getElementById('mintCaseNumber').value = draft.case_number || '';
        }
        
        if (document.getElementById('issuingAgency')) {
            document.getElementById('issuingAgency').value = draft.issuing_agency || '';
        }
        
        if (document.getElementById('noticeText')) {
            document.getElementById('noticeText').value = draft.public_text || '';
        }
        
        if (document.getElementById('mintTokenName')) {
            document.getElementById('mintTokenName').value = draft.token_name || '';
        }
        
        // Notice type
        if (document.getElementById('noticeType')) {
            const noticeType = document.getElementById('noticeType');
            if (draft.notice_type && ['Legal Notice', 'Subpoena', 'Summons', 'Citation', 'Other'].includes(draft.notice_type)) {
                noticeType.value = draft.notice_type;
            } else if (draft.notice_type) {
                noticeType.value = 'Other';
                if (document.getElementById('customNoticeType')) {
                    document.getElementById('customNoticeType').value = draft.notice_type;
                    document.getElementById('customNoticeType').style.display = 'block';
                }
            }
        }
        
        // Recipients
        if (draft.recipients && draft.recipients.length > 0) {
            // Clear existing recipients
            const recipientsContainer = document.getElementById('recipientsContainer');
            if (recipientsContainer) {
                recipientsContainer.innerHTML = '';
                
                // Add each recipient
                draft.recipients.forEach((recipient, index) => {
                    if (index === 0 && document.getElementById('mintRecipient')) {
                        document.getElementById('mintRecipient').value = recipient;
                    } else if (window.addRecipientField) {
                        window.addRecipientField();
                        const inputs = recipientsContainer.querySelectorAll('input[type="text"]');
                        if (inputs[inputs.length - 1]) {
                            inputs[inputs.length - 1].value = recipient;
                        }
                    }
                });
            }
        }
        
        // Delivery method
        if (draft.delivery_method) {
            const radio = document.querySelector(`input[name="deliveryMethod"][value="${draft.delivery_method}"]`);
            if (radio) {
                radio.checked = true;
            }
        }
        
        // Sponsor fees
        if (document.getElementById('sponsorTransactionFees')) {
            document.getElementById('sponsorTransactionFees').checked = draft.sponsor_fees || false;
        }
        
        // Restore images if they exist
        if (draft.thumbnail_data) {
            const thumbnailPreview = document.getElementById('thumbnailPreview');
            if (thumbnailPreview) {
                thumbnailPreview.src = draft.thumbnail_data;
                thumbnailPreview.style.display = 'block';
            }
        }
        
        if (draft.document_data) {
            const documentPreview = document.getElementById('documentPreview');
            if (documentPreview) {
                documentPreview.src = draft.document_data;
                documentPreview.style.display = 'block';
            }
        }
        
        // Restore IPFS data
        if (draft.ipfs_hash) {
            window.currentIPFSHash = draft.ipfs_hash;
            window.encryptedIPFSHash = draft.encrypted_ipfs;
            window.currentEncryptionKey = draft.encryption_key;
            window.currentMetadataURI = draft.metadata_uri;
        }
    },
    
    /**
     * Delete a draft
     */
    async deleteDraft(draftId) {
        try {
            const response = await fetch(`${this.API_BASE}/${draftId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to delete draft');
            }
            
            // Clear current draft ID if it matches
            if (this.currentDraftId === draftId) {
                this.currentDraftId = null;
            }
            
            return result;
            
        } catch (error) {
            console.error('Error deleting draft:', error);
            throw error;
        }
    },
    
    /**
     * Show save notification
     */
    showSaveNotification(draftName) {
        const notification = document.createElement('div');
        notification.className = 'draft-save-notification';
        notification.innerHTML = `
            <style>
                .draft-save-notification {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: var(--success);
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    z-index: 10000;
                    animation: slideIn 0.3s ease;
                }
                
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                .draft-save-notification i {
                    font-size: 18px;
                }
            </style>
            <i class="fas fa-save"></i>
            <span>Draft saved: ${draftName}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },
    
    /**
     * Show drafts dialog
     */
    showDraftsDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'drafts-dialog-overlay';
        dialog.innerHTML = `
            <style>
                .drafts-dialog-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }
                
                .drafts-dialog {
                    background: var(--gray-900);
                    border: 1px solid var(--gray-700);
                    border-radius: 12px;
                    width: 90%;
                    max-width: 800px;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                }
                
                .drafts-header {
                    padding: 20px;
                    border-bottom: 1px solid var(--gray-700);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .drafts-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }
                
                .drafts-close {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    font-size: 24px;
                    cursor: pointer;
                }
                
                .drafts-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }
                
                .drafts-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .draft-item {
                    background: var(--gray-800);
                    border: 1px solid var(--gray-700);
                    border-radius: 8px;
                    padding: 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: all 0.2s;
                }
                
                .draft-item:hover {
                    background: var(--gray-750);
                    border-color: var(--accent-blue);
                }
                
                .draft-info {
                    flex: 1;
                }
                
                .draft-name {
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 4px;
                }
                
                .draft-details {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                }
                
                .draft-actions {
                    display: flex;
                    gap: 8px;
                }
                
                .draft-btn {
                    padding: 8px 16px;
                    border-radius: 6px;
                    border: none;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .draft-btn-load {
                    background: var(--accent-blue);
                    color: white;
                }
                
                .draft-btn-load:hover {
                    background: var(--accent-blue-dark);
                }
                
                .draft-btn-delete {
                    background: var(--danger);
                    color: white;
                }
                
                .draft-btn-delete:hover {
                    background: var(--danger-dark);
                }
                
                .no-drafts {
                    text-align: center;
                    padding: 40px;
                    color: var(--text-secondary);
                }
            </style>
            <div class="drafts-dialog">
                <div class="drafts-header">
                    <div class="drafts-title">Saved Drafts</div>
                    <button class="drafts-close" onclick="this.closest('.drafts-dialog-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="drafts-content">
                    <div class="drafts-list" id="draftsList">
                        <div class="no-drafts">Loading drafts...</div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Load drafts
        this.loadAndDisplayDrafts();
    },
    
    /**
     * Load and display drafts in dialog
     */
    async loadAndDisplayDrafts() {
        const container = document.getElementById('draftsList');
        if (!container) return;
        
        try {
            const drafts = await this.loadDraftsList();
            
            if (drafts.length === 0) {
                container.innerHTML = '<div class="no-drafts">No saved drafts found</div>';
                return;
            }
            
            container.innerHTML = drafts.map(draft => {
                const date = new Date(draft.last_accessed).toLocaleString();
                const recipients = draft.recipients || [];
                
                return `
                    <div class="draft-item">
                        <div class="draft-info">
                            <div class="draft-name">${draft.draft_name}</div>
                            <div class="draft-details">
                                ${draft.case_number ? `Case: ${draft.case_number} | ` : ''}
                                ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''} | 
                                Last saved: ${date}
                            </div>
                        </div>
                        <div class="draft-actions">
                            <button class="draft-btn draft-btn-load" onclick="DraftsManager.loadDraft('${draft.draft_id}'); this.closest('.drafts-dialog-overlay').remove();">
                                <i class="fas fa-folder-open"></i> Load
                            </button>
                            <button class="draft-btn draft-btn-delete" onclick="DraftsManager.deleteDraftWithConfirm('${draft.draft_id}', '${draft.draft_name}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            container.innerHTML = '<div class="no-drafts">Error loading drafts</div>';
        }
    },
    
    /**
     * Delete draft with confirmation
     */
    async deleteDraftWithConfirm(draftId, draftName) {
        if (confirm(`Delete draft "${draftName}"? This cannot be undone.`)) {
            try {
                await this.deleteDraft(draftId);
                
                // Refresh the list
                this.loadAndDisplayDrafts();
                
                if (window.uiManager) {
                    window.uiManager.showNotification('success', 'Draft deleted');
                }
            } catch (error) {
                if (window.uiManager) {
                    window.uiManager.showNotification('error', 'Failed to delete draft');
                }
            }
        }
    },
    
    /**
     * Enable auto-save
     */
    enableAutoSave(intervalMinutes = 5) {
        // Clear existing timer
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        // Set new timer
        this.autoSaveTimer = setInterval(() => {
            if (this.hasUnsavedChanges()) {
                this.saveDraft().catch(console.error);
            }
        }, intervalMinutes * 60 * 1000);
    },
    
    /**
     * Check if form has unsaved changes
     */
    hasUnsavedChanges() {
        // Check if any form fields have values
        const hasCase = document.getElementById('mintCaseNumber')?.value?.trim();
        const hasRecipient = document.getElementById('mintRecipient')?.value?.trim();
        const hasText = document.getElementById('noticeText')?.value?.trim();
        
        return !!(hasCase || hasRecipient || hasText);
    },
    
    /**
     * Disable auto-save
     */
    disableAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }
};

console.log('Drafts Manager module loaded');