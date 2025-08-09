// Simplified integration - no public key registration needed

// Remove encryption status checks
window.displayEncryptionStatus = function() {
    // No longer needed - everyone can send/receive
};

// Simplified create notice flow
window.createSimplifiedNotice = async function() {
    try {
        const recipientAddress = document.getElementById('recipientAddress').value;
        const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked').value;
        
        if (deliveryMethod === 'viewgated') {
            // Document Images - with encryption
            await createDocumentNotice(recipientAddress);
        } else {
            // Text Only - no encryption
            await createTextOnlyNotice(recipientAddress);
        }
        
    } catch (error) {
        console.error('Error creating notice:', error);
        uiManager.showNotification('error', 'Failed to create notice: ' + error.message);
    }
};

// Create document notice with automatic encryption
async function createDocumentNotice(recipientAddress) {
    try {
        // Get form data
        const noticeType = document.getElementById('noticeType').value;
        const issuingAgency = document.getElementById('issuingAgency').value;
        const caseNumber = document.getElementById('caseNumber').value;
        const publicText = document.getElementById('noticeText').value;
        
        // Check if we have a document
        if (!uploadedImage) {
            uiManager.showNotification('error', 'Please upload a document first');
            return;
        }
        
        showProcessing('Encrypting and sending document...');
        
        // Use new workflow system if available
        if (window.noticeWorkflow) {
            const noticeData = {
                recipientAddress,
                documentData: uploadedImage,
                noticeType,
                issuingAgency,
                caseNumber,
                publicText,
                thumbnailUrl: uploadedThumbnailUrl || null
            };
            
            const result = await window.noticeWorkflow.createNotice(noticeData);
            
            hideProcessing();
            
            if (result) {
                uiManager.showNotification('success', 'Document notice created successfully!');
                closeMintModal();
                refreshNotices();
            }
        } else {
            // Fallback to old method
            const result = await SimpleEncryption.createEncryptedNotice(
                window.legalContract,
                recipientAddress,
                uploadedImage,
                {
                    publicText: publicText,
                    noticeType: noticeType,
                    caseNumber: caseNumber,
                    issuingAgency: issuingAgency,
                    fee: 150e6
                }
            );
            
            hideProcessing();
            
            if (result.success) {
                uiManager.showNotification('success', 'Document notice created successfully!');
                closeMintModal();
                refreshNotices();
            }
        }
        
    } catch (error) {
        hideProcessing();
        console.error('Error:', error);
        uiManager.showNotification('error', 'Failed to create notice: ' + error.message);
    }
}

// Create text-only notice
async function createTextOnlyNotice(recipientAddress) {
    try {
        const noticeType = document.getElementById('noticeType').value;
        const issuingAgency = document.getElementById('issuingAgency').value;
        const caseNumber = document.getElementById('caseNumber').value;
        const publicText = document.getElementById('noticeText').value;
        
        if (!publicText) {
            uiManager.showNotification('error', 'Please enter notice text');
            return;
        }
        
        showProcessing('Sending text notice...');
        
        // Use new workflow system if available
        if (window.noticeWorkflow) {
            const noticeData = {
                recipientAddress,
                noticeType,
                issuingAgency,
                caseNumber,
                publicText,
                documentData: null // No document for text-only
            };
            
            const result = await window.noticeWorkflow.createNotice(noticeData);
            
            hideProcessing();
            
            if (result) {
                uiManager.showNotification('success', 'Text notice created successfully!');
                closeMintModal();
                refreshNotices();
            }
        } else {
            // Fallback to old method
            const tx = await window.legalContract.createTextNotice(
                recipientAddress,
                publicText,
                noticeType,
                caseNumber,
                issuingAgency
            ).send({
                feeLimit: 200_000_000,
                callValue: 15e6 // 15 TRX
            });
            
            hideProcessing();
            
            uiManager.showNotification('success', 'Text notice sent successfully!');
            closeMintModal();
            refreshNotices();
        }
        
    } catch (error) {
        hideProcessing();
        console.error('Error:', error);
        uiManager.showNotification('error', 'Failed to send notice: ' + error.message);
    }
}

// Update the accept modal to be simpler
window.updateAcceptModal = function() {
    const modal = document.getElementById('acceptModal');
    if (!modal) return;
    
    // Simplify the button
    const acceptBtn = modal.querySelector('#acceptNoticeBtn');
    if (acceptBtn) {
        acceptBtn.onclick = acceptNoticeSimplified;
        acceptBtn.innerHTML = '<i class="fas fa-eye"></i> Accept & View Document';
    }
    
    // Update the text
    const infoBox = modal.querySelector('.alert-info');
    if (infoBox) {
        infoBox.innerHTML = `
            <i class="fas fa-info-circle" style="color: #3b82f6;"></i>
            <div>
                <strong>One-Click Process</strong>
                <p style="margin: 0.25rem 0 0 0;">Click the button below to accept this notice and immediately view the document.</p>
            </div>
        `;
    }
};

// Simplified notice display
window.renderSimplifiedNotice = function(notice) {
    const isTextOnly = !notice.hasDocument;
    
    return `
        <div class="notice-card" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
            <div class="notice-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.125rem;">
                        ${notice.noticeType} - ${notice.caseNumber}
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: #6b7280; font-size: 0.875rem;">
                        From: ${notice.issuingAgency}
                    </p>
                </div>
                <div style="text-align: right;">
                    ${isTextOnly ? 
                        '<span class="badge" style="background: #e0f2fe; color: #0369a1; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">TEXT ONLY</span>' :
                        '<span class="badge" style="background: #dcfce7; color: #166534; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">DOCUMENT</span>'
                    }
                </div>
            </div>
            
            <div class="notice-content" style="margin-top: 1rem;">
                <p style="margin: 0;">${notice.publicText}</p>
            </div>
            
            <div class="notice-actions" style="margin-top: 1rem;">
                ${notice.recipient === currentAddress ? 
                    (isTextOnly ? 
                        `<button class="btn btn-secondary" onclick="viewTextNotice(${notice.id})">
                            <i class="fas fa-eye"></i> View Notice
                        </button>` :
                        (!notice.accepted ? 
                            `<button class="btn btn-primary" onclick="acceptNoticeSimplified(${notice.id})">
                                <i class="fas fa-file-download"></i> Accept & View Document
                            </button>` :
                            `<button class="btn btn-secondary" onclick="viewAcceptedDocument(${notice.id})">
                                <i class="fas fa-eye"></i> View Document
                            </button>`
                        )
                    ) : ''
                }
            </div>
        </div>
    `;
};

// View already accepted document
window.viewAcceptedDocument = async function(noticeId) {
    try {
        showProcessing('Retrieving document...');
        
        const document = await window.legalContract.getDocument(noticeId).call();
        const encryptedData = await SimpleEncryption.fetchFromIPFS(document.encryptedIPFS);
        const decrypted = SimpleEncryption.decryptDocument(encryptedData, document.decryptionKey);
        
        hideProcessing();
        
        displayDecryptedDocumentSimple(decrypted, noticeId);
        
    } catch (error) {
        hideProcessing();
        console.error('Error:', error);
        uiManager.showNotification('error', 'Failed to retrieve document');
    }
};

// Override the create legal notice button
window.createLegalNotice = createSimplifiedNotice;

// Remove any registration prompts
window.EncryptionUtils = {
    checkAndPromptRegistration: () => true,
    showRegistrationModal: () => {},
    checkPublicKeyRegistration: () => true
};