/**
 * Case Management Client
 * Frontend integration for case creation and serving workflow
 */

class CaseManagementClient {
    constructor() {
        // Use the Render backend URL or localhost for development
        this.apiUrl = window.BACKEND_API_URL || 
                     'https://nftserviceapp.onrender.com' || 
                     'http://localhost:3000';
        this.serverAddress = null;
        this.currentCase = null;
    }

    /**
     * Initialize and get server address
     */
    async init() {
        // Get server address from TronWeb
        if (window.tronWeb && window.tronWeb.defaultAddress) {
            this.serverAddress = window.tronWeb.defaultAddress.base58;
        }
        
        console.log('📋 Case Management initialized for:', this.serverAddress);
    }

    /**
     * Create a new case from uploaded documents
     */
    async createCase(files, metadata = {}) {
        if (!this.serverAddress) {
            console.warn('Server address not available, using test address');
            this.serverAddress = 'TEST-SERVER-' + Date.now();
        }
        
        console.log(`📤 Creating case with ${files.length} documents`);
        
        const formData = new FormData();
        
        // Add PDF files
        for (let i = 0; i < files.length; i++) {
            formData.append('documents', files[i]);
        }
        
        // Add metadata
        formData.append('serverAddress', this.serverAddress);
        formData.append('description', metadata.description || '');
        formData.append('caseType', metadata.caseType || 'standard');
        formData.append('urgency', metadata.urgency || 'normal');
        formData.append('notes', metadata.notes || '');
        
        try {
            const response = await fetch(`${this.apiUrl}/api/cases`, {
                method: 'POST',
                headers: {
                    'X-Server-Address': this.serverAddress
                },
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Case created:', result.caseId);
                this.currentCase = result.case;
                
                // Display alert preview if available
                if (result.alertPreview) {
                    this.displayAlertPreview(result.alertPreview);
                }
                
                return result;
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Failed to create case:', error);
            throw error;
        }
    }

    /**
     * Get case details
     */
    async getCase(caseId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/cases/${caseId}`, {
                headers: {
                    'X-Server-Address': this.serverAddress
                }
            });
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to get case:', error);
            throw error;
        }
    }

    /**
     * List all cases for current server
     */
    async listCases(status = null) {
        try {
            // Ensure we have a server address
            if (!this.serverAddress) {
                this.serverAddress = 'TEST-SERVER-' + Date.now();
            }
            
            const url = new URL(`${this.apiUrl}/api/cases`);
            if (status) {
                url.searchParams.append('status', status);
            }
            
            const response = await fetch(url, {
                headers: {
                    'X-Server-Address': this.serverAddress
                }
            });
            
            if (!response.ok) {
                console.warn(`List cases returned ${response.status}`);
                return []; // Return empty array on error
            }
            
            const data = await response.json();
            
            // Handle response format from backend
            if (data && data.success && Array.isArray(data.cases)) {
                return data.cases;
            } else if (Array.isArray(data)) {
                return data;
            } else {
                console.warn('Unexpected cases response format:', data);
                return [];
            }
            
        } catch (error) {
            console.error('Failed to list cases:', error);
            throw error;
        }
    }

    /**
     * View case PDF in new tab
     */
    viewCasePDF(caseId) {
        const url = `${this.apiUrl}/api/cases/${caseId}/pdf`;
        window.open(url, '_blank');
    }

    /**
     * Display alert preview in UI
     */
    displayAlertPreview(alertPreview) {
        const previewContainer = document.getElementById('alertPreviewContainer');
        if (previewContainer) {
            const img = document.createElement('img');
            img.src = alertPreview;
            img.style.maxWidth = '100%';
            img.style.border = '2px solid #e74c3c';
            img.style.borderRadius = '8px';
            
            previewContainer.innerHTML = '';
            previewContainer.appendChild(img);
        }
    }

    /**
     * Prepare case for serving (encrypt and get IPFS ready)
     */
    async prepareCaseForServing(caseId, recipientAddress) {
        try {
            const response = await fetch(`${this.apiUrl}/api/cases/${caseId}/prepare`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Server-Address': this.serverAddress
                },
                body: JSON.stringify({
                    recipientAddress: recipientAddress
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Case prepared for serving');
                console.log('IPFS Hash:', result.ipfsHash);
                console.log('Encryption Key:', result.encryptionKey);
                
                return result;
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Failed to prepare case:', error);
            throw error;
        }
    }

    /**
     * Serve notice with prepared case data
     * Can be called multiple times for the same case with different recipients
     */
    async serveNoticeWithCase(caseId, recipientAddress, additionalParams = {}) {
        // First prepare the case for this specific recipient
        const prepareResult = await this.prepareCaseForServing(caseId, recipientAddress);
        
        if (!prepareResult.success) {
            throw new Error('Failed to prepare case for serving');
        }
        
        // Now serve the notice using existing contract
        if (window.serveNotice) {
            const result = await window.serveNotice(
                recipientAddress,
                prepareResult.ipfsHash,
                prepareResult.encryptionKey,
                additionalParams.issuingAgency || this.serverAddress,
                additionalParams.noticeType || 'Legal Document Service',
                caseId, // Use same caseId for all recipients
                additionalParams.caseDetails || '',
                additionalParams.legalRights || '',
                additionalParams.sponsorFees || '0',
                additionalParams.metadataURI || ''
            );
            
            // Mark this specific service as complete
            if (result && result.txid) {
                await this.markServiceAsComplete(caseId, recipientAddress, result.txid, result.alertId, result.documentId);
            }
            
            return result;
        } else {
            throw new Error('serveNotice function not available');
        }
    }
    
    /**
     * Serve the same case to multiple recipients
     */
    async serveCaseToMultipleRecipients(caseId, recipients, additionalParams = {}) {
        console.log(`📤 Serving case ${caseId} to ${recipients.length} recipients`);
        
        const results = {
            successful: [],
            failed: [],
            total: recipients.length
        };
        
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            console.log(`Serving ${i + 1}/${recipients.length}: ${recipient}`);
            
            try {
                const result = await this.serveNoticeWithCase(caseId, recipient, additionalParams);
                
                results.successful.push({
                    recipient,
                    txHash: result.txid,
                    alertId: result.alertId,
                    documentId: result.documentId,
                    timestamp: new Date().toISOString()
                });
                
                // Optional delay between transactions to avoid network congestion
                if (i < recipients.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
                }
                
            } catch (error) {
                console.error(`Failed to serve to ${recipient}:`, error);
                results.failed.push({
                    recipient,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        console.log(`✅ Batch service complete: ${results.successful.length} successful, ${results.failed.length} failed`);
        
        return results;
    }
    
    /**
     * Get service history for a case
     */
    async getCaseServiceHistory(caseId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/cases/${caseId}/services`, {
                headers: {
                    'X-Server-Address': this.serverAddress
                }
            });
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to get service history:', error);
            throw error;
        }
    }

    /**
     * Mark case as served after blockchain confirmation
     */
    async markCaseAsServed(caseId, txHash, alertNftId, documentNftId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/cases/${caseId}/served`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Server-Address': this.serverAddress
                },
                body: JSON.stringify({
                    txHash,
                    alertNftId,
                    documentNftId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Case marked as served');
            }
            
            return result;
            
        } catch (error) {
            console.error('Failed to mark case as served:', error);
        }
    }

    /**
     * Delete draft case
     */
    async deleteCase(caseId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/cases/${caseId}`, {
                method: 'DELETE',
                headers: {
                    'X-Server-Address': this.serverAddress
                }
            });
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to delete case:', error);
            throw error;
        }
    }

    /**
     * Get storage statistics
     */
    async getStorageStats() {
        try {
            const response = await fetch(`${this.apiUrl}/api/storage/stats`, {
                headers: {
                    'X-Server-Address': this.serverAddress
                }
            });
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to get storage stats:', error);
            throw error;
        }
    }
}

// Initialize global instance
window.caseManager = new CaseManagementClient();

// Auto-initialize when TronWeb is ready
if (window.tronWeb && window.tronWeb.ready) {
    window.caseManager.init();
} else {
    window.addEventListener('tronWebReady', () => {
        window.caseManager.init();
    });
}

// Export for use
window.CaseManagementClient = CaseManagementClient;