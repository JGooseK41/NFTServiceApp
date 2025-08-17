/**
 * Case Management Integration for Legal Notice Creation
 * Seamlessly integrates case management into the existing document upload flow
 */

class CaseIntegration {
    constructor() {
        this.caseManager = null;
        this.currentCaseId = null;
        this.caseData = null;
        this.initialized = false;
    }

    /**
     * Initialize the case integration
     */
    async init() {
        try {
            // Initialize case manager if not already done
            if (!window.caseManager) {
                window.caseManager = new CaseManagementClient();
            }
            this.caseManager = window.caseManager;
            
            // Set server address from wallet
            if (window.tronWeb && window.tronWeb.defaultAddress) {
                this.caseManager.serverAddress = window.tronWeb.defaultAddress.base58;
            }
            
            await this.caseManager.init();
            this.initialized = true;
            
            console.log('✅ Case Integration initialized');
            
            // Hook into the existing document upload flow
            this.attachToDocumentUpload();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize case integration:', error);
            return false;
        }
    }

    /**
     * Attach case management to document upload flow
     */
    attachToDocumentUpload() {
        // Override or enhance the processDocumentFiles function
        const originalProcessFiles = window.processDocumentFiles;
        
        window.processDocumentFiles = async () => {
            console.log('📋 Case Integration: Processing documents through case management');
            
            // First run the original processing
            if (originalProcessFiles) {
                await originalProcessFiles();
            }
            
            // Then create a case with the uploaded documents
            if (window.uploadedDocumentsList && window.uploadedDocumentsList.length > 0) {
                await this.createCaseFromDocuments();
            }
        };
        
        // Also hook into the upload completion
        const originalHandleUpload = window.handleDocumentUpload;
        window.handleDocumentUpload = async (event) => {
            // Call original handler
            if (originalHandleUpload) {
                await originalHandleUpload(event);
            }
            
            // Auto-create case when documents are uploaded (if enabled)
            if (window.AUTO_CREATE_CASE && window.uploadedDocumentsList && window.uploadedDocumentsList.length > 0) {
                // Give a small delay for UI to update
                setTimeout(() => this.createCaseFromDocuments(), 500);
            }
        };
    }

    /**
     * Create a case from uploaded documents
     */
    async createCaseFromDocuments() {
        if (!this.initialized) {
            await this.init();
        }
        
        if (!window.uploadedDocumentsList || window.uploadedDocumentsList.length === 0) {
            console.log('No documents to create case from');
            return null;
        }
        
        try {
            // Show loading indicator
            this.showCaseCreationStatus('Creating case from uploaded documents...');
            
            // Get case metadata from form
            const caseNumber = document.getElementById('mintCaseNumber')?.value || '';
            const noticeType = document.getElementById('noticeType')?.value || 'Legal Notice';
            const issuingAgency = document.getElementById('issuingAgency')?.value || '';
            const recipientAddress = document.getElementById('mintRecipient')?.value || '';
            
            // Sort documents by order
            const sortedDocs = [...window.uploadedDocumentsList].sort((a, b) => a.order - b.order);
            
            // Convert documents to File objects for case manager
            const files = await this.convertDocumentsToFiles(sortedDocs);
            
            // Create case metadata
            const metadata = {
                description: `${noticeType} - ${new Date().toLocaleDateString()}`,
                caseType: noticeType,
                caseNumber: caseNumber || this.generateCaseNumber(),
                issuingAgency: issuingAgency,
                recipientAddress: recipientAddress,
                urgency: 'normal',
                notes: `Created from Legal Notice form with ${files.length} document(s)`
            };
            
            // Create the case
            const result = await this.caseManager.createCase(files, metadata);
            
            if (result.success) {
                this.currentCaseId = result.caseId;
                this.caseData = result;
                
                // Store case ID for reference
                window.currentCaseId = this.currentCaseId;
                
                // Update UI to show case ID
                this.updateUIWithCaseInfo(result);
                
                // If we have an alert preview, update the main preview
                if (result.alertPreview) {
                    this.updateAlertPreview(result.alertPreview);
                }
                
                this.showCaseCreationStatus(`✅ Case created: ${this.currentCaseId}`, 'success');
                
                // Store case ID in form for blockchain transaction
                this.storeCaseIdInForm(this.currentCaseId);
                
                return result;
            } else {
                throw new Error(result.error || 'Failed to create case');
            }
            
        } catch (error) {
            console.error('Failed to create case:', error);
            this.showCaseCreationStatus(`❌ Failed to create case: ${error.message}`, 'error');
            return null;
        }
    }

    /**
     * Convert uploaded documents to File objects
     */
    async convertDocumentsToFiles(documents) {
        const files = [];
        
        for (const doc of documents) {
            try {
                let blob;
                
                if (doc.data) {
                    // Convert base64 to blob
                    if (doc.data.startsWith('data:')) {
                        const response = await fetch(doc.data);
                        blob = await response.blob();
                    } else {
                        // Assume it's already base64 without prefix
                        const byteCharacters = atob(doc.data);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        blob = new Blob([byteArray], { type: doc.fileType || 'application/pdf' });
                    }
                } else if (doc.file) {
                    // Already a file
                    blob = doc.file;
                } else {
                    console.warn('Document has no data:', doc);
                    continue;
                }
                
                // Create File object
                const file = new File([blob], doc.fileName || `document_${files.length + 1}.pdf`, {
                    type: doc.fileType || 'application/pdf'
                });
                
                files.push(file);
            } catch (error) {
                console.error('Failed to convert document:', error, doc);
            }
        }
        
        return files;
    }

    /**
     * Update UI with case information
     */
    updateUIWithCaseInfo(caseResult) {
        // Add case ID badge to the form
        const mintStep2 = document.getElementById('mintStep2');
        if (mintStep2) {
            // Check if case info already exists
            let caseInfo = document.getElementById('caseInfoBadge');
            if (!caseInfo) {
                caseInfo = document.createElement('div');
                caseInfo.id = 'caseInfoBadge';
                caseInfo.style.cssText = `
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                `;
                
                // Insert at the top of step 2
                const firstChild = mintStep2.firstElementChild;
                if (firstChild) {
                    mintStep2.insertBefore(caseInfo, firstChild);
                } else {
                    mintStep2.appendChild(caseInfo);
                }
            }
            
            caseInfo.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin: 0; color: white;">
                            <i class="fas fa-folder-open"></i> Case Management Active
                        </h4>
                        <p style="margin: 5px 0 0 0; opacity: 0.9;">
                            Case ID: <strong>${caseResult.caseId}</strong>
                            ${caseResult.pdfInfo ? ` • ${caseResult.pdfInfo.pageCount} pages` : ''}
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <button class="btn btn-sm" onclick="window.caseIntegration.viewCase('${caseResult.caseId}')" 
                                style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3);">
                            <i class="fas fa-eye"></i> View Case
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Update case number field if empty
        const caseNumberField = document.getElementById('mintCaseNumber');
        if (caseNumberField && !caseNumberField.value) {
            caseNumberField.value = caseResult.caseId;
        }
    }

    /**
     * Update alert preview with case-generated preview
     */
    updateAlertPreview(alertPreview) {
        // Find the preview container
        const previewContainers = document.querySelectorAll('[id*="alertPreview"], [id*="preview"]');
        
        previewContainers.forEach(container => {
            if (container && alertPreview) {
                // Create or update preview image
                let img = container.querySelector('img');
                if (!img) {
                    img = document.createElement('img');
                    img.style.cssText = 'max-width: 100%; height: auto; border-radius: 8px;';
                    container.appendChild(img);
                }
                img.src = alertPreview;
            }
        });
    }

    /**
     * Store case ID in form for blockchain transaction
     */
    storeCaseIdInForm(caseId) {
        // Store in hidden field or data attribute
        let hiddenField = document.getElementById('caseIdField');
        if (!hiddenField) {
            hiddenField = document.createElement('input');
            hiddenField.type = 'hidden';
            hiddenField.id = 'caseIdField';
            hiddenField.name = 'caseId';
            
            const form = document.querySelector('#mintModal form, #mintStep2');
            if (form) {
                form.appendChild(hiddenField);
            }
        }
        hiddenField.value = caseId;
        
        // Also store in window for easy access
        window.currentCaseId = caseId;
    }

    /**
     * Show case creation status
     */
    showCaseCreationStatus(message, type = 'info') {
        // Use existing notification system if available
        if (window.uiManager && window.uiManager.showNotification) {
            window.uiManager.showNotification(type, message);
        }
        
        // Also show inline status
        let statusDiv = document.getElementById('caseCreationStatus');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'caseCreationStatus';
            
            // Find a good place to insert it
            const uploadResult = document.getElementById('uploadResult');
            if (uploadResult) {
                uploadResult.parentNode.insertBefore(statusDiv, uploadResult.nextSibling);
            }
        }
        
        const colors = {
            info: '#2196f3',
            success: '#4caf50',
            error: '#f44336',
            warning: '#ff9800'
        };
        
        statusDiv.style.cssText = `
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px;
            border-radius: 4px;
            margin: 10px 0;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const icons = {
            info: 'fas fa-info-circle',
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle'
        };
        
        statusDiv.innerHTML = `
            <i class="${icons[type] || icons.info}"></i>
            <span>${message}</span>
        `;
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                if (statusDiv) {
                    statusDiv.style.display = 'none';
                }
            }, 5000);
        }
    }

    /**
     * Generate a case number if not provided
     */
    generateCaseNumber() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `CASE-${year}${month}${day}-${random}`;
    }

    /**
     * View case details
     */
    async viewCase(caseId) {
        if (!caseId) caseId = this.currentCaseId;
        if (!caseId) {
            alert('No case ID available');
            return;
        }
        
        // Open case in new tab
        const serverAddress = this.caseManager.serverAddress || 'VIEW';
        const url = `${window.BACKEND_API_URL || ''}/api/cases/${caseId}/pdf?serverAddress=${encodeURIComponent(serverAddress)}`;
        window.open(url, '_blank');
    }

    /**
     * Get current case data
     */
    getCaseData() {
        return {
            caseId: this.currentCaseId,
            data: this.caseData
        };
    }

    /**
     * Mark case as served after blockchain transaction
     */
    async markCaseAsServed(txHash, alertNftId, documentNftId) {
        if (!this.currentCaseId) {
            console.log('No case ID to mark as served');
            return;
        }
        
        try {
            const result = await this.caseManager.markCaseAsServed(
                this.currentCaseId,
                txHash,
                alertNftId,
                documentNftId
            );
            
            if (result.success) {
                console.log(`✅ Case ${this.currentCaseId} marked as served`);
                this.showCaseCreationStatus(`Case ${this.currentCaseId} successfully served on blockchain`, 'success');
            }
            
            return result;
        } catch (error) {
            console.error('Failed to mark case as served:', error);
            return { success: false, error: error.message };
        }
    }
}

// Initialize and expose globally
window.caseIntegration = new CaseIntegration();

// Auto-initialize when document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.caseIntegration.init();
    });
} else {
    // DOM already loaded
    window.caseIntegration.init();
}

// Configuration flags
window.AUTO_CREATE_CASE = true; // Automatically create case when documents are uploaded