// Integration code for encryption in the main app

// Add encryption status to wallet info display
async function displayEncryptionStatus() {
    if (!window.legalContract || !window.tronWeb.defaultAddress.base58) {
        return;
    }
    
    try {
        const address = window.tronWeb.defaultAddress.base58;
        const hasKey = await EncryptionUtils.checkPublicKeyRegistration(window.legalContract, address);
        
        const walletInfo = document.getElementById('walletInfo');
        if (walletInfo) {
            const existingStatus = document.getElementById('encryptionStatus');
            if (existingStatus) {
                existingStatus.remove();
            }
            
            const statusHtml = `
                <div id="encryptionStatus" style="margin-top: 0.5rem; padding: 0.5rem; background: ${hasKey ? '#d1fae5' : '#fee2e2'}; border-radius: 0.5rem;">
                    <i class="fas ${hasKey ? 'fa-lock' : 'fa-lock-open'}" style="color: ${hasKey ? '#10b981' : '#ef4444'};"></i>
                    <span style="font-size: 0.875rem; color: ${hasKey ? '#065f46' : '#991b1b'};">
                        ${hasKey ? 'Encryption Ready' : 'Encryption Not Set Up'}
                    </span>
                    ${!hasKey ? `
                        <button class="btn btn-small" style="margin-left: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem;" 
                                onclick="EncryptionUtils.showRegistrationModal()">
                            Set Up
                        </button>
                    ` : ''}
                </div>
            `;
            
            walletInfo.insertAdjacentHTML('beforeend', statusHtml);
        }
    } catch (error) {
        console.error('Error checking encryption status:', error);
    }
}

// Modified createLegalNotice function with encryption
async function createLegalNoticeWithEncryption() {
    try {
        const recipientAddress = document.getElementById('recipientAddress').value;
        const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked').value;
        
        // Check if encryption is needed (document images method)
        if (deliveryMethod === 'viewgated') {
            // Check if recipient has public key
            const recipientHasKey = await EncryptionUtils.checkPublicKeyRegistration(
                window.legalContract, 
                recipientAddress
            );
            
            if (!recipientHasKey) {
                // Show warning modal
                showRecipientKeyWarning(recipientAddress);
                return;
            }
            
            // Get recipient's public key
            const recipientPublicKey = await EncryptionUtils.getRecipientPublicKey(
                window.legalContract,
                recipientAddress
            );
            
            if (!recipientPublicKey) {
                uiManager.showNotification('error', 'Failed to get recipient public key');
                return;
            }
            
            // Encrypt the document
            const documentData = uploadedImage; // Base64 or binary data
            const encrypted = await EncryptionUtils.encryptDocument(
                documentData,
                recipientPublicKey
            );
            
            // Upload encrypted document to IPFS
            const ipfsData = {
                encrypted: encrypted.encryptedDocument,
                metadata: {
                    algorithm: encrypted.algorithm,
                    keyEncryption: encrypted.keyEncryption,
                    timestamp: Date.now()
                }
            };
            
            const ipfsHash = await uploadToIPFS(JSON.stringify(ipfsData));
            
            // Create the notice with encrypted data
            await createEncryptedNotice(
                recipientAddress,
                ipfsHash,
                encrypted.encryptedKey
            );
            
        } else {
            // Text-only notice, no encryption needed
            await createTextOnlyNotice(recipientAddress);
        }
        
    } catch (error) {
        console.error('Error creating notice:', error);
        uiManager.showNotification('error', 'Failed to create notice: ' + error.message);
    }
}

// Show warning when recipient doesn't have public key
function showRecipientKeyWarning(recipientAddress) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> Recipient Not Ready</h2>
            </div>
            <div class="modal-body">
                <div class="alert alert-warning">
                    <i class="fas fa-lock-open"></i>
                    <div>
                        <strong>Recipient hasn't registered their encryption key</strong>
                        <p style="margin: 0.5rem 0 0 0;">The recipient (${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}) needs to register their public key before they can receive encrypted documents.</p>
                    </div>
                </div>
                
                <div style="margin-top: 1rem;">
                    <h4>Your options:</h4>
                    <ol style="margin-top: 0.5rem;">
                        <li>Send a text-only notice asking them to register</li>
                        <li>Contact them directly to set up encryption</li>
                        <li>Wait for them to register their key</li>
                    </ol>
                </div>
                
                <div class="alert alert-info" style="margin-top: 1rem;">
                    <i class="fas fa-info-circle"></i>
                    <p style="margin: 0;">You could send a text-only notice with instructions on how to register their encryption key.</p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i> Close
                </button>
                <button class="btn btn-primary" onclick="switchToTextOnly(this)">
                    <i class="fas fa-comment-alt"></i> Send Text Notice Instead
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Switch to text-only delivery
function switchToTextOnly(button) {
    button.closest('.modal').remove();
    document.querySelector('input[name="deliveryMethod"][value="text"]').click();
}

// Create encrypted notice
async function createEncryptedNotice(recipient, ipfsHash, encryptedKey) {
    try {
        // Get form data
        const noticeType = document.getElementById('noticeType').value;
        const issuingAgency = document.getElementById('issuingAgency').value;
        const caseNumber = document.getElementById('caseNumber').value;
        const publicNoticeText = document.getElementById('noticeText').value; // Public text
        const legalRights = document.getElementById('legalRights').value;
        const sponsorFees = document.getElementById('sponsorAcceptanceFees').checked;
        
        // Calculate fee
        const fee = sponsorFees ? 152e6 : 150e6; // 150 + 2 TRX if sponsoring
        
        // Call contract
        const tx = await window.legalContract.serveEncryptedNotice(
            recipient,
            ipfsHash,
            encryptedKey,
            issuingAgency,
            noticeType,
            caseNumber,
            publicNoticeText,
            legalRights,
            sponsorFees
        ).send({
            feeLimit: 300_000_000,
            callValue: fee
        });
        
        console.log('Encrypted notice created:', tx);
        uiManager.showNotification('success', 'Encrypted notice created successfully!');
        
        // Close modal and refresh
        closeMintModal();
        refreshNotices();
        
    } catch (error) {
        console.error('Error creating encrypted notice:', error);
        throw error;
    }
}

// Handle document decryption after acceptance
async function decryptDocumentAfterAcceptance(noticeId) {
    try {
        // Get notice details
        const notice = await window.legalContract.alertNotices(noticeId).call();
        const documentId = notice.documentId;
        
        if (!documentId || documentId == 0) {
            console.log('No document to decrypt');
            return;
        }
        
        // Get document info
        const docInfo = await window.legalContract.viewDocument(documentId).call();
        
        if (!docInfo.canDecrypt) {
            uiManager.showNotification('error', 'You must accept the notice first');
            return;
        }
        
        // Fetch encrypted document from IPFS
        const ipfsData = await fetchFromIPFS(docInfo.encryptedIPFS);
        const encryptedData = JSON.parse(ipfsData);
        
        // Decrypt the document
        showProcessing('Decrypting document...');
        
        const decrypted = await EncryptionUtils.decryptDocument(
            encryptedData.encrypted,
            docInfo.encryptedKey
        );
        
        hideProcessing();
        
        // Display decrypted document
        displayDecryptedDocument(decrypted, notice);
        
    } catch (error) {
        console.error('Error decrypting document:', error);
        hideProcessing();
        uiManager.showNotification('error', 'Failed to decrypt document');
    }
}

// Display decrypted document
function displayDecryptedDocument(documentData, noticeInfo) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h2><i class="fas fa-file-shield" style="color: #10b981;"></i> Decrypted Document</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i>
                    <strong>Document successfully decrypted</strong>
                    <p style="margin: 0.25rem 0 0 0;">This document was encrypted specifically for your wallet address.</p>
                </div>
                
                <div class="document-info" style="margin-top: 1rem;">
                    <div class="token-detail">
                        <span>Notice Type:</span>
                        <span>${noticeInfo.noticeType}</span>
                    </div>
                    <div class="token-detail">
                        <span>Case Number:</span>
                        <span>${noticeInfo.caseNumber}</span>
                    </div>
                    <div class="token-detail">
                        <span>Issuing Agency:</span>
                        <span>${noticeInfo.issuingAgency}</span>
                    </div>
                </div>
                
                <div class="document-content" style="margin-top: 1rem; padding: 1rem; background: #f9fafb; border-radius: 0.5rem;">
                    ${documentData.startsWith('data:image') ? 
                        `<img src="${documentData}" style="max-width: 100%; height: auto;">` :
                        `<pre style="white-space: pre-wrap;">${documentData}</pre>`
                    }
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i> Close
                </button>
                <button class="btn btn-primary" onclick="downloadDecryptedDocument('${documentData}', '${noticeInfo.caseNumber}')">
                    <i class="fas fa-download"></i> Download
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Download decrypted document
function downloadDecryptedDocument(data, filename) {
    const link = document.createElement('a');
    link.href = data;
    link.download = `decrypted_${filename}_${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Modify the accept notice flow to include decryption
const originalAcceptNotice = window.acceptNotice;
window.acceptNotice = async function() {
    try {
        // Call original accept function
        await originalAcceptNotice();
        
        // After successful acceptance, decrypt document
        if (currentNoticeId) {
            await decryptDocumentAfterAcceptance(currentNoticeId);
        }
        
    } catch (error) {
        console.error('Error in accept flow:', error);
    }
};

// Add encryption status check to wallet connection
const originalCheckWallet = window.checkWalletConnection;
window.checkWalletConnection = async function() {
    if (originalCheckWallet) {
        await originalCheckWallet();
    }
    await displayEncryptionStatus();
};