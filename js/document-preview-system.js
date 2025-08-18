/**
 * Document Preview System
 * Shows both Alert NFT image (blockchain) and full PDF (IPFS) before sending
 */

window.DocumentPreviewSystem = {
    
    /**
     * Show comprehensive preview before blockchain transaction
     */
    async showTransactionPreview(caseId) {
        console.log('📋 Preparing transaction preview for case:', caseId);
        
        // Get case data from backend
        const caseData = await this.getCaseData(caseId);
        if (!caseData) {
            console.error('Could not load case data');
            return false;
        }
        
        // Create preview modal
        const modal = this.createPreviewModal();
        
        // Load Alert NFT preview
        await this.loadAlertPreview(modal, caseData);
        
        // Load full PDF preview
        await this.loadPDFPreview(modal, caseId);
        
        // Show modal
        document.body.appendChild(modal);
        
        return new Promise((resolve) => {
            // Add confirm/cancel handlers
            modal.querySelector('#confirmTransaction').onclick = () => {
                modal.remove();
                resolve(true);
            };
            
            modal.querySelector('#cancelTransaction').onclick = () => {
                modal.remove();
                resolve(false);
            };
            
            modal.querySelector('.modal-close').onclick = () => {
                modal.remove();
                resolve(false);
            };
        });
    },
    
    /**
     * Create the preview modal structure
     */
    createPreviewModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display: flex; align-items: center; justify-content: center; z-index: 10000;';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 90%; width: 1200px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>📋 Review Documents Before Sending</h2>
                    <button class="modal-close">&times;</button>
                </div>
                
                <div class="modal-body" style="padding: 20px;">
                    <!-- Alert explaining what will happen -->
                    <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #92400e; margin: 0 0 10px 0;">
                            <i class="fas fa-exclamation-triangle"></i> Important: Review Before Blockchain Transaction
                        </h3>
                        <p style="color: #78350f; margin: 5px 0;">
                            • <strong>Alert NFT (Below):</strong> This image will be stored on-chain as base64 data - visible in wallets immediately
                        </p>
                        <p style="color: #78350f; margin: 5px 0;">
                            • <strong>Full Document (Bottom):</strong> The complete ${window.currentPageCount || '?'}-page PDF will be encrypted and stored on IPFS
                        </p>
                        <p style="color: #78350f; margin: 5px 0;">
                            • <strong>Cost:</strong> ${window.currentTransactionFee || '25'} TRX will be sent to the blockchain
                        </p>
                    </div>
                    
                    <!-- Two-column layout -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <!-- Alert NFT Preview -->
                        <div>
                            <h3 style="margin-bottom: 10px;">
                                🖼️ Alert NFT Image
                                <span style="font-size: 12px; color: #666;">(Stored on Blockchain)</span>
                            </h3>
                            <div id="alertPreviewContainer" style="
                                border: 2px solid #dc2626;
                                border-radius: 8px;
                                padding: 10px;
                                background: #f9f9f9;
                                min-height: 400px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                <div class="loading-spinner">Loading alert preview...</div>
                            </div>
                            <div style="margin-top: 10px; padding: 10px; background: #fee; border-radius: 4px;">
                                <strong>What Recipients See:</strong>
                                <ul style="margin: 5px 0; padding-left: 20px;">
                                    <li>This image appears in their wallet</li>
                                    <li>Shows "Legal Notice" overlay</li>
                                    <li>First page of document with stamp</li>
                                    <li>Stored as base64 on blockchain</li>
                                </ul>
                            </div>
                        </div>
                        
                        <!-- Document Stats -->
                        <div>
                            <h3 style="margin-bottom: 10px;">
                                📄 Document Details
                                <span style="font-size: 12px; color: #666;">(Encrypted to IPFS)</span>
                            </h3>
                            <div id="documentStatsContainer" style="
                                border: 2px solid #2563eb;
                                border-radius: 8px;
                                padding: 20px;
                                background: #f0f9ff;
                            ">
                                <div class="loading-spinner">Loading document info...</div>
                            </div>
                            
                            <!-- Recipient list -->
                            <div style="margin-top: 20px;">
                                <h4>📮 Recipients:</h4>
                                <div id="recipientsList" style="
                                    max-height: 200px;
                                    overflow-y: auto;
                                    border: 1px solid #ddd;
                                    border-radius: 4px;
                                    padding: 10px;
                                ">
                                    Loading recipients...
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Full PDF Preview -->
                    <div>
                        <h3 style="margin-bottom: 10px;">
                            📑 Full Combined PDF Preview
                            <span style="font-size: 12px; color: #666;">(All ${window.currentPageCount || '?'} pages)</span>
                        </h3>
                        <div id="pdfPreviewContainer" style="
                            border: 2px solid #2563eb;
                            border-radius: 8px;
                            padding: 10px;
                            background: #f9f9f9;
                            height: 600px;
                            overflow: hidden;
                        ">
                            <iframe id="pdfFrame" style="
                                width: 100%;
                                height: 100%;
                                border: none;
                                background: white;
                            "></iframe>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer" style="
                    display: flex;
                    justify-content: space-between;
                    padding: 20px;
                    border-top: 1px solid #ddd;
                ">
                    <button id="cancelTransaction" class="btn btn-secondary">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button id="confirmTransaction" class="btn btn-primary" style="
                        background: #10b981;
                        min-width: 200px;
                    ">
                        <i class="fas fa-check"></i> Confirm & Send to Blockchain
                    </button>
                </div>
            </div>
        `;
        
        return modal;
    },
    
    /**
     * Load Alert NFT preview
     */
    async loadAlertPreview(modal, caseData) {
        const container = modal.querySelector('#alertPreviewContainer');
        
        try {
            // Get the alert preview image
            let alertImage;
            
            // Try to get from case data
            if (caseData.alert_preview) {
                alertImage = caseData.alert_preview;
            }
            // Try to get from localStorage (recent generation)
            else if (localStorage.getItem('lastAlertThumbnail')) {
                alertImage = localStorage.getItem('lastAlertThumbnail');
            }
            // Try to get from window.uploadedImage
            else if (window.uploadedImage && window.uploadedImage.preview) {
                alertImage = window.uploadedImage.preview;
            }
            
            if (alertImage) {
                const img = document.createElement('img');
                img.src = alertImage;
                img.style.cssText = 'max-width: 100%; max-height: 500px; display: block; margin: 0 auto;';
                container.innerHTML = '';
                container.appendChild(img);
                
                // Show size info
                const sizeInfo = document.createElement('div');
                sizeInfo.style.cssText = 'text-align: center; margin-top: 10px; color: #666; font-size: 12px;';
                const sizeKB = Math.round(alertImage.length * 0.75 / 1024); // Approximate base64 to bytes
                sizeInfo.textContent = `Image size: ~${sizeKB} KB`;
                container.appendChild(sizeInfo);
            } else {
                container.innerHTML = '<div style="color: #dc2626;">Alert preview not available</div>';
            }
        } catch (error) {
            console.error('Error loading alert preview:', error);
            container.innerHTML = '<div style="color: #dc2626;">Error loading alert preview</div>';
        }
    },
    
    /**
     * Load PDF preview
     */
    async loadPDFPreview(modal, caseId) {
        const iframe = modal.querySelector('#pdfFrame');
        const statsContainer = modal.querySelector('#documentStatsContainer');
        
        try {
            // Load PDF in iframe
            const serverAddress = window.tronWeb?.defaultAddress?.base58 || 'VIEW';
            const pdfUrl = `${window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com'}/api/cases/${caseId}/pdf?serverAddress=${encodeURIComponent(serverAddress)}`;
            iframe.src = pdfUrl;
            
            // Load case stats
            const response = await fetch(`${window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com'}/api/cases/${caseId}?serverAddress=${serverAddress}`);
            if (response.ok) {
                const data = await response.json();
                const caseInfo = data.case;
                
                const pageCount = caseInfo.metadata?.pageCount || '?';
                const fileSize = caseInfo.metadata?.fileSize || 0;
                const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
                
                // Store for reference
                window.currentPageCount = pageCount;
                
                statsContainer.innerHTML = `
                    <div style="display: grid; gap: 10px;">
                        <div>
                            <strong>Total Pages:</strong> ${pageCount}
                        </div>
                        <div>
                            <strong>File Size:</strong> ${fileSizeMB} MB
                        </div>
                        <div>
                            <strong>Documents:</strong> ${caseInfo.metadata?.originalFiles?.length || 1}
                        </div>
                        <div>
                            <strong>Case Number:</strong> ${caseInfo.id}
                        </div>
                        <div>
                            <strong>Status:</strong> 
                            <span style="
                                background: #fbbf24;
                                color: #78350f;
                                padding: 2px 8px;
                                border-radius: 4px;
                                font-size: 12px;
                            ">PREPARED</span>
                        </div>
                        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                            <strong>Encryption:</strong>
                            <div style="font-size: 12px; color: #666; margin-top: 5px;">
                                • Document will be AES-256 encrypted<br>
                                • Stored on IPFS network<br>
                                • Only recipients can decrypt
                            </div>
                        </div>
                    </div>
                `;
                
                // Update page count in title
                const pdfTitle = modal.querySelector('h3 span');
                if (pdfTitle && pdfTitle.textContent.includes('?')) {
                    pdfTitle.textContent = `(All ${pageCount} pages)`;
                }
            }
        } catch (error) {
            console.error('Error loading PDF preview:', error);
            iframe.src = 'about:blank';
            iframe.contentDocument.body.innerHTML = '<div style="padding: 20px; color: #dc2626;">Error loading PDF preview</div>';
        }
    },
    
    /**
     * Get case data from backend
     */
    async getCaseData(caseId) {
        try {
            const serverAddress = window.tronWeb?.defaultAddress?.base58 || 'VIEW';
            const response = await fetch(
                `${window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com'}/api/cases/${caseId}?serverAddress=${serverAddress}`
            );
            
            if (response.ok) {
                const data = await response.json();
                return data.case;
            }
        } catch (error) {
            console.error('Error loading case data:', error);
        }
        return null;
    }
};

// Hook into the document upload flow to show preview immediately
const originalHandleDocumentUpload = window.handleDocumentUpload;
window.handleDocumentUpload = async function(event) {
    // First, handle the upload normally
    const result = await originalHandleDocumentUpload.call(this, event);
    
    // If upload was successful and we have a case ID, show preview
    if (window.currentCaseId) {
        console.log('📋 Showing document preview after upload...');
        
        // Small delay to ensure backend has processed the case
        setTimeout(async () => {
            await window.DocumentPreviewSystem.showUploadPreview(window.currentCaseId);
        }, 1000);
    }
    
    return result;
};

// Add a method for post-upload preview (non-blocking)
window.DocumentPreviewSystem.showUploadPreview = async function(caseId) {
    console.log('📋 Showing preview after document upload for case:', caseId);
    
    // Get case data from backend
    const caseData = await this.getCaseData(caseId);
    if (!caseData) {
        console.error('Could not load case data');
        return;
    }
    
    // Create preview modal (modified for post-upload)
    const modal = this.createUploadPreviewModal();
    
    // Load Alert NFT preview
    await this.loadAlertPreview(modal, caseData);
    
    // Load full PDF preview
    await this.loadPDFPreview(modal, caseId);
    
    // Show modal
    document.body.appendChild(modal);
    
    // Add close handler
    modal.querySelector('.modal-close').onclick = () => {
        modal.remove();
    };
    
    modal.querySelector('#continueBtn').onclick = () => {
        modal.remove();
    };
};

// Create a preview modal for post-upload (informational only)
window.DocumentPreviewSystem.createUploadPreviewModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; width: 1200px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h2>✅ Documents Successfully Prepared</h2>
                <button class="modal-close">&times;</button>
            </div>
            
            <div class="modal-body" style="padding: 20px;">
                <!-- Success message -->
                <div style="background: #d1fae5; border: 1px solid #10b981; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="color: #065f46; margin: 0 0 10px 0;">
                        <i class="fas fa-check-circle"></i> Your Documents Are Ready
                    </h3>
                    <p style="color: #047857; margin: 5px 0;">
                        Your documents have been successfully combined and prepared. Review the previews below to ensure everything looks correct.
                    </p>
                </div>
                
                <!-- Two-column layout -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <!-- Alert NFT Preview -->
                    <div>
                        <h3 style="margin-bottom: 10px;">
                            🖼️ Alert NFT Preview
                            <span style="font-size: 12px; color: #666;">(What recipients will see)</span>
                        </h3>
                        <div id="alertPreviewContainer" style="
                            border: 2px solid #dc2626;
                            border-radius: 8px;
                            padding: 10px;
                            background: #f9f9f9;
                            min-height: 400px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <div class="loading-spinner">Loading alert preview...</div>
                        </div>
                        <div style="margin-top: 10px; padding: 10px; background: #fee; border-radius: 4px;">
                            <strong>This will be:</strong>
                            <ul style="margin: 5px 0; padding-left: 20px; font-size: 14px;">
                                <li>Visible in recipient's wallet</li>
                                <li>First page with "LEGAL NOTICE" stamp</li>
                                <li>Stored on blockchain as NFT metadata</li>
                            </ul>
                        </div>
                    </div>
                    
                    <!-- Document Stats -->
                    <div>
                        <h3 style="margin-bottom: 10px;">
                            📄 Document Information
                        </h3>
                        <div id="documentStatsContainer" style="
                            border: 2px solid #2563eb;
                            border-radius: 8px;
                            padding: 20px;
                            background: #f0f9ff;
                        ">
                            <div class="loading-spinner">Loading document info...</div>
                        </div>
                        
                        <!-- Next steps -->
                        <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-radius: 4px;">
                            <strong>Next Steps:</strong>
                            <ol style="margin: 5px 0; padding-left: 20px; font-size: 14px;">
                                <li>Add recipient addresses</li>
                                <li>Enter case details</li>
                                <li>Review energy requirements</li>
                                <li>Send to blockchain</li>
                            </ol>
                        </div>
                    </div>
                </div>
                
                <!-- Full PDF Preview -->
                <div>
                    <h3 style="margin-bottom: 10px;">
                        📑 Combined PDF Document
                        <span style="font-size: 12px; color: #666;">(Full document - all pages)</span>
                    </h3>
                    <div id="pdfPreviewContainer" style="
                        border: 2px solid #2563eb;
                        border-radius: 8px;
                        padding: 10px;
                        background: #f9f9f9;
                        height: 600px;
                        overflow: hidden;
                    ">
                        <iframe id="pdfFrame" style="
                            width: 100%;
                            height: 100%;
                            border: none;
                            background: white;
                        "></iframe>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer" style="
                display: flex;
                justify-content: center;
                padding: 20px;
                border-top: 1px solid #ddd;
            ">
                <button id="continueBtn" class="btn btn-primary" style="
                    min-width: 200px;
                ">
                    <i class="fas fa-arrow-right"></i> Continue to Add Recipients
                </button>
            </div>
        </div>
    `;
    
    return modal;
};

// Also keep the transaction preview hook
const originalPrepareCase = window.prepareCaseForDelivery;
window.prepareCaseForDelivery = async function(caseId) {
    console.log('🔍 Showing final preview before transaction...');
    
    // Show preview and wait for confirmation
    const confirmed = await window.DocumentPreviewSystem.showTransactionPreview(caseId);
    
    if (!confirmed) {
        console.log('❌ Transaction cancelled by user');
        return false;
    }
    
    console.log('✅ User confirmed, proceeding with transaction...');
    
    // Continue with original function if it exists
    if (originalPrepareCase) {
        return await originalPrepareCase(caseId);
    }
    
    return true;
};

console.log('📋 Document Preview System loaded');
console.log('Preview will show immediately after document upload AND before blockchain transaction');