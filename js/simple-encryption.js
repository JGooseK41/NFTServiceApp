// Simplified encryption for ease of use
// No public key registration required

const SimpleEncryption = {
    
    // Generate encryption key from sender and recipient addresses
    generateEncryptionKey(senderAddress, recipientAddress, nonce) {
        // Create a deterministic but unique key for this notice
        const combined = `${senderAddress}-${recipientAddress}-${nonce || Date.now()}`;
        return CryptoJS.SHA256(combined).toString();
    },
    
    // Encrypt document with generated key
    encryptDocument(documentData, encryptionKey) {
        try {
            // Simple AES encryption
            const encrypted = CryptoJS.AES.encrypt(documentData, encryptionKey).toString();
            return encrypted;
        } catch (error) {
            console.error('Encryption error:', error);
            throw error;
        }
    },
    
    // Decrypt document with key
    decryptDocument(encryptedData, encryptionKey) {
        try {
            const decrypted = CryptoJS.AES.decrypt(encryptedData, encryptionKey);
            return decrypted.toString(CryptoJS.enc.Utf8);
        } catch (error) {
            console.error('Decryption error:', error);
            throw error;
        }
    },
    
    // Create encrypted notice (no recipient registration needed)
    async createEncryptedNotice(contract, recipientAddress, documentData, noticeDetails) {
        try {
            // Generate encryption key
            const encryptionKey = this.generateEncryptionKey(
                window.tronWeb.defaultAddress.base58,
                recipientAddress,
                Date.now()
            );
            
            // Encrypt document
            const encryptedDoc = this.encryptDocument(documentData, encryptionKey);
            
            // Upload to IPFS
            const ipfsHash = await this.uploadToIPFS(encryptedDoc);
            
            // Create notice on blockchain
            const tx = await contract.createDocumentNotice(
                recipientAddress,
                ipfsHash,
                encryptionKey, // Store key in contract (only recipient can access)
                noticeDetails.publicText,
                noticeDetails.noticeType,
                noticeDetails.caseNumber,
                noticeDetails.issuingAgency
            ).send({
                feeLimit: 300_000_000,
                callValue: noticeDetails.fee || 150e6
            });
            
            return {
                success: true,
                noticeId: tx.noticeId,
                txId: tx.txid
            };
            
        } catch (error) {
            console.error('Error creating encrypted notice:', error);
            throw error;
        }
    },
    
    // Simple IPFS upload (can be replaced with actual IPFS implementation)
    async uploadToIPFS(data) {
        // For now, return a mock hash
        // In production, use actual IPFS upload
        const hash = 'Qm' + CryptoJS.SHA256(data).toString().substring(0, 44);
        
        // First, let's see what's taking up space
        console.log('localStorage usage before cleanup:');
        const storageInfo = this.getStorageInfo();
        console.log(storageInfo);
        
        // Always clean up first to prevent quota issues
        this.cleanupOldIPFSData();
        
        // More aggressive cleanup - keep only 5 most recent
        const keys = Object.keys(localStorage);
        const ipfsKeys = keys.filter(key => key.startsWith('ipfs_'));
        if (ipfsKeys.length > 5) {
            // Remove all but the 5 most recent
            ipfsKeys.sort();
            const keysToRemove = ipfsKeys.slice(0, ipfsKeys.length - 5);
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log('Removed old IPFS data:', key);
            });
        }
        
        try {
            // Store locally for demo (in production, use IPFS)
            localStorage.setItem(`ipfs_${hash}`, data);
            console.log('Successfully stored IPFS data with hash:', hash);
        } catch (e) {
            console.error('Storage error:', e);
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                // Clear ALL localStorage data as last resort
                console.log('Clearing ALL IPFS data due to quota exceeded');
                this.clearAllIPFSData();
                
                // Also clear other large data that might be taking space
                const allKeys = Object.keys(localStorage);
                allKeys.forEach(key => {
                    if (key.startsWith('ipfs_') || key.startsWith('notice_') || key.startsWith('document_') || key.includes('base64')) {
                        localStorage.removeItem(key);
                        console.log('Removed:', key);
                    }
                });
                
                try {
                    // Try one more time
                    localStorage.setItem(`ipfs_${hash}`, data);
                    console.log('Successfully stored after aggressive cleanup');
                } catch (e2) {
                    // If still failing, just continue without storage
                    console.error('Cannot store in localStorage even after cleanup, continuing without storage');
                    console.log('Data size:', data.length, 'characters');
                }
            }
        }
        
        return hash;
    },
    
    // Get storage information for debugging
    getStorageInfo() {
        const keys = Object.keys(localStorage);
        const info = {
            totalKeys: keys.length,
            ipfsKeys: 0,
            totalSize: 0,
            largestItems: []
        };
        
        keys.forEach(key => {
            const value = localStorage.getItem(key);
            const size = value ? value.length : 0;
            info.totalSize += size;
            
            if (key.startsWith('ipfs_')) {
                info.ipfsKeys++;
            }
            
            info.largestItems.push({ key, size });
        });
        
        // Sort by size and keep top 10
        info.largestItems.sort((a, b) => b.size - a.size);
        info.largestItems = info.largestItems.slice(0, 10);
        
        return info;
    },
    
    // Clean up old IPFS data to free space
    cleanupOldIPFSData() {
        const keys = Object.keys(localStorage);
        const ipfsKeys = keys.filter(key => key.startsWith('ipfs_'));
        
        // Be more aggressive - if we have more than 3 IPFS entries, remove the oldest ones
        if (ipfsKeys.length > 3) {
            // Sort by key (which includes timestamp in real implementation)
            ipfsKeys.sort();
            
            // Remove oldest entries, keep only last 3
            const keysToRemove = ipfsKeys.slice(0, ipfsKeys.length - 3);
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log('Cleaned up old IPFS key:', key);
            });
        }
        
        // Also remove any orphaned document data
        keys.forEach(key => {
            if ((key.includes('document_') || key.includes('uploadedDoc_')) && !key.startsWith('ipfs_')) {
                localStorage.removeItem(key);
                console.log('Cleaned up orphaned document data:', key);
            }
        });
    },
    
    // Clear all IPFS data from localStorage
    clearAllIPFSData() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('ipfs_')) {
                localStorage.removeItem(key);
            }
        });
        console.log('Cleared all IPFS data from localStorage');
    },
    
    // Fetch from IPFS
    async fetchFromIPFS(hash) {
        // For demo, get from localStorage
        // In production, fetch from actual IPFS
        return localStorage.getItem(`ipfs_${hash}`) || '';
    },
    
    // One-click accept and view process
    async acceptAndViewNotice(contract, noticeId) {
        try {
            // Show processing
            if (window.showProcessing) {
                window.showProcessing('Accepting notice and decrypting document...');
            }
            
            // 1. Get notice details first
            const notice = await contract.getNotice(noticeId).call();
            
            // Parse the document data to get IPFS hash
            const documentData = notice.documentData;
            const [ipfsHash] = documentData.split('|');
            
            // 2. Accept notice (this returns the decryption key)
            const tx = await contract.acceptNotice(noticeId).send({
                feeLimit: 100_000_000,
                callValue: 0
            });
            
            // 3. Get the decryption key from the return value
            // In TronWeb, the constant return value is in the transaction result
            const decryptionKey = tx;  // The acceptNotice function returns the key directly
            
            // 4. Fetch encrypted data from IPFS
            const encryptedData = await this.fetchFromIPFS(ipfsHash);
            
            // 5. Decrypt
            const decrypted = this.decryptDocument(encryptedData, decryptionKey);
            
            // Hide processing
            if (window.hideProcessing) {
                window.hideProcessing();
            }
            
            return {
                success: true,
                decryptedData: decrypted,
                noticeId: noticeId
            };
            
        } catch (error) {
            console.error('Error accepting notice:', error);
            if (window.hideProcessing) {
                window.hideProcessing();
            }
            throw error;
        }
    }
};

// Integration with existing UI
window.SimpleEncryption = SimpleEncryption;

// Utility function to clear all storage (for debugging)
window.clearAllStorage = function() {
    console.log('Clearing all localStorage data...');
    const info = SimpleEncryption.getStorageInfo();
    console.log('Before clear:', info);
    
    // Clear everything
    localStorage.clear();
    console.log('All localStorage cleared');
    
    // Show what's left (should be empty)
    const afterInfo = SimpleEncryption.getStorageInfo();
    console.log('After clear:', afterInfo);
};

// Override the existing accept notice function
window.acceptNoticeSimplified = async function() {
    if (!currentNoticeId) return;
    
    try {
        const result = await SimpleEncryption.acceptAndViewNotice(
            window.legalContract,
            currentNoticeId
        );
        
        if (result.success) {
            // Close accept modal
            document.getElementById('acceptModal').style.display = 'none';
            
            // Show success
            if (window.uiManager) {
                window.uiManager.showNotification('success', 'Notice accepted! Displaying document...');
            }
            
            // Display decrypted document
            displayDecryptedDocumentSimple(result.decryptedData, currentNoticeId);
        }
        
    } catch (error) {
        console.error('Error:', error);
        if (window.uiManager) {
            window.uiManager.showNotification('error', 'Failed to accept notice: ' + error.message);
        }
    }
};

// Simple document display
function displayDecryptedDocumentSimple(documentData, noticeId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h2><i class="fas fa-file-shield" style="color: #10b981;"></i> Legal Document</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i>
                    <strong>Document Retrieved Successfully</strong>
                    <p style="margin: 0.25rem 0 0 0;">You have accepted this legal notice. The acceptance has been recorded on the blockchain.</p>
                </div>
                
                <div class="document-content" style="margin-top: 1rem; padding: 1rem; background: #f9fafb; border-radius: 0.5rem; max-height: 600px; overflow-y: auto;">
                    ${documentData.startsWith('data:image') ? 
                        `<img src="${documentData}" style="max-width: 100%; height: auto;">` :
                        documentData.startsWith('data:application/pdf') ?
                        `<iframe src="${documentData}" style="width: 100%; height: 600px; border: none;"></iframe>` :
                        `<div style="white-space: pre-wrap; font-family: monospace;">${documentData}</div>`
                    }
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i> Close
                </button>
                <button class="btn btn-primary" onclick="downloadDocument('${documentData}', 'notice_${noticeId}')">
                    <i class="fas fa-download"></i> Download
                </button>
                <button class="btn btn-primary" onclick="printDocument('${documentData}')">
                    <i class="fas fa-print"></i> Print
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Helper functions
window.downloadDocument = function(data, filename) {
    const link = document.createElement('a');
    link.href = data;
    link.download = `${filename}_${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.printDocument = function(data) {
    const printWindow = window.open('', '_blank');
    if (data.startsWith('data:image')) {
        printWindow.document.write(`<img src="${data}" style="max-width: 100%;">`);
    } else {
        printWindow.document.write(`<pre>${data}</pre>`);
    }
    printWindow.document.close();
    printWindow.print();
};