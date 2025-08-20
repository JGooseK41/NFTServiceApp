/**
 * Frontend IPFS Document Recovery
 * Recovers documents from IPFS using stored hashes and decryption keys
 */

class IPFSDocumentRecovery {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        this.ipfsGateways = [
            'https://gateway.pinata.cloud/ipfs/',
            'https://ipfs.io/ipfs/',
            'https://cloudflare-ipfs.com/ipfs/',
            'https://gateway.ipfs.io/ipfs/'
        ];
        this.init();
    }

    init() {
        // Add to unified system if available
        if (window.unifiedSystem) {
            window.unifiedSystem.recoverFromIPFS = this.recoverNoticeFromIPFS.bind(this);
            window.unifiedSystem.recoverAllFromIPFS = this.recoverAllNoticesFromIPFS.bind(this);
            console.log('✅ IPFS recovery functions added to unifiedSystem');
        }
    }

    /**
     * Decrypt data using Web Crypto API
     */
    async decryptData(encryptedData, keyHex) {
        try {
            // Parse the encrypted data
            const data = typeof encryptedData === 'string' ? JSON.parse(encryptedData) : encryptedData;
            
            // Convert hex key to buffer
            const keyBuffer = new Uint8Array(keyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            
            // Import the key
            const key = await crypto.subtle.importKey(
                'raw',
                keyBuffer,
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );
            
            // Convert hex strings to buffers
            const iv = new Uint8Array(data.iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const authTag = new Uint8Array(data.authTag.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const ciphertext = new Uint8Array(data.encryptedData.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            
            // Combine ciphertext and auth tag
            const combined = new Uint8Array(ciphertext.length + authTag.length);
            combined.set(ciphertext);
            combined.set(authTag, ciphertext.length);
            
            // Decrypt
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                combined
            );
            
            // Convert to string and parse JSON
            const decoder = new TextDecoder();
            const decryptedText = decoder.decode(decrypted);
            return JSON.parse(decryptedText);
            
        } catch (error) {
            console.error('Decryption error:', error);
            throw error;
        }
    }

    /**
     * Download from IPFS
     */
    async downloadFromIPFS(ipfsHash, showProgress = true) {
        console.log(`Downloading from IPFS: ${ipfsHash}`);
        
        for (const gateway of this.ipfsGateways) {
            try {
                const url = `${gateway}${ipfsHash}`;
                if (showProgress) {
                    console.log(`Trying gateway: ${gateway}`);
                }
                
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.text();
                    console.log(`✅ Downloaded from ${gateway}`);
                    return data;
                }
            } catch (error) {
                console.log(`Failed with ${gateway}:`, error.message);
            }
        }
        
        throw new Error(`Failed to download from IPFS: ${ipfsHash}`);
    }

    /**
     * Recover documents for a specific notice
     */
    async recoverNoticeFromIPFS(noticeId) {
        console.log(`Recovering documents for notice ${noticeId} from IPFS...`);
        
        try {
            // Get notice data from backend
            const response = await fetch(`${this.backend}/api/notices/${noticeId}`);
            if (!response.ok) {
                throw new Error('Notice not found in backend');
            }
            
            const noticeData = await response.json();
            
            if (!noticeData.ipfs_hash || !noticeData.encryption_key) {
                // Try to get from served_notices table
                const servedResponse = await fetch(`${this.backend}/api/served-notices/${noticeId}`);
                if (servedResponse.ok) {
                    const servedData = await servedResponse.json();
                    noticeData.ipfs_hash = servedData.ipfs_hash;
                    noticeData.encryption_key = servedData.encryption_key;
                }
            }
            
            if (!noticeData.ipfs_hash || !noticeData.encryption_key) {
                throw new Error('No IPFS hash or encryption key found for this notice');
            }
            
            // Download encrypted data from IPFS
            const encryptedData = await this.downloadFromIPFS(noticeData.ipfs_hash);
            
            // Decrypt the data
            const decryptedData = await this.decryptData(encryptedData, noticeData.encryption_key);
            
            console.log('✅ Successfully decrypted data from IPFS');
            
            // Extract images
            const images = {
                thumbnail: null,
                document: null
            };
            
            // Check various possible data structures
            if (decryptedData.thumbnail) {
                images.thumbnail = decryptedData.thumbnail;
            }
            if (decryptedData.fullDocument || decryptedData.document) {
                images.document = decryptedData.fullDocument || decryptedData.document;
            }
            
            // Check if documents are in an array
            if (decryptedData.documents && Array.isArray(decryptedData.documents)) {
                decryptedData.documents.forEach((doc, index) => {
                    if (index === 0 && !images.thumbnail) {
                        images.thumbnail = doc.data || doc.url;
                    } else if (!images.document) {
                        images.document = doc.data || doc.url;
                    }
                });
            }
            
            // Now re-upload to backend
            console.log('Re-uploading recovered documents to backend...');
            
            const formData = new FormData();
            formData.append('noticeId', noticeId);
            formData.append('caseNumber', noticeData.case_number || '');
            formData.append('serverAddress', noticeData.server_address || '');
            formData.append('recipientAddress', noticeData.recipient_address || '');
            
            // Convert data URLs to blobs
            if (images.thumbnail) {
                const thumbnailBlob = await this.dataURLtoBlob(images.thumbnail);
                if (thumbnailBlob) {
                    formData.append('thumbnail', thumbnailBlob, 'thumbnail.png');
                }
            }
            
            if (images.document) {
                const documentBlob = await this.dataURLtoBlob(images.document);
                if (documentBlob) {
                    formData.append('unencryptedDocument', documentBlob, 'document.png');
                }
            }
            
            // Upload to backend
            const uploadResponse = await fetch(
                `${this.backend}/api/documents/notice/${noticeId}/components`,
                {
                    method: 'POST',
                    body: formData
                }
            );
            
            if (!uploadResponse.ok) {
                throw new Error('Failed to upload recovered documents to backend');
            }
            
            const uploadResult = await uploadResponse.json();
            console.log('✅ Documents recovered and stored in backend:', uploadResult);
            
            // Show success message
            this.showRecoveryStatus(noticeId, true, images);
            
            return {
                success: true,
                noticeId,
                thumbnail: !!images.thumbnail,
                document: !!images.document
            };
            
        } catch (error) {
            console.error(`Failed to recover notice ${noticeId}:`, error);
            this.showRecoveryStatus(noticeId, false, null, error.message);
            
            return {
                success: false,
                noticeId,
                error: error.message
            };
        }
    }

    /**
     * Recover all notices from IPFS
     */
    async recoverAllNoticesFromIPFS() {
        if (!window.unifiedSystem || !window.unifiedSystem.cases) {
            console.error('Unified system not available');
            return;
        }

        const cases = window.unifiedSystem.cases;
        const results = {
            total: 0,
            successful: 0,
            failed: 0,
            notices: []
        };

        console.log('🚀 Starting IPFS recovery for all notices...');

        for (const [caseNumber, caseData] of cases) {
            for (const recipient of (caseData.recipients || [])) {
                const noticeId = recipient.alertId || recipient.documentId;
                if (!noticeId || noticeId === 'Pending') continue;
                
                results.total++;
                
                const result = await this.recoverNoticeFromIPFS(noticeId);
                results.notices.push(result);
                
                if (result.success) {
                    results.successful++;
                } else {
                    results.failed++;
                }
                
                // Add delay to avoid overwhelming servers
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Show summary
        this.showRecoverySummary(results);
        return results;
    }

    /**
     * Convert data URL to Blob
     */
    async dataURLtoBlob(dataURL) {
        if (!dataURL || !dataURL.startsWith('data:')) return null;
        
        try {
            const response = await fetch(dataURL);
            return await response.blob();
        } catch (error) {
            console.error('Error converting data URL to blob:', error);
            return null;
        }
    }

    /**
     * Show recovery status for a single notice
     */
    showRecoveryStatus(noticeId, success, images, error) {
        const message = success ? 
            `✅ Successfully recovered documents for notice ${noticeId}` :
            `❌ Failed to recover notice ${noticeId}: ${error}`;
        
        if (window.uiManager) {
            window.uiManager.showNotification(
                success ? 'success' : 'error',
                message,
                5000
            );
        } else {
            console.log(message);
        }
    }

    /**
     * Show recovery summary
     */
    showRecoverySummary(results) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>IPFS Document Recovery Complete</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; padding: 2rem;">
                        <h3>Recovery Summary</h3>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 2rem 0;">
                            <div style="padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                                <div style="font-size: 2rem; font-weight: bold; color: #007bff;">
                                    ${results.total}
                                </div>
                                <div style="color: #666;">Total Notices</div>
                            </div>
                            <div style="padding: 1rem; background: #d4edda; border-radius: 8px;">
                                <div style="font-size: 2rem; font-weight: bold; color: #28a745;">
                                    ${results.successful}
                                </div>
                                <div style="color: #155724;">Recovered</div>
                            </div>
                            <div style="padding: 1rem; background: #f8d7da; border-radius: 8px;">
                                <div style="font-size: 2rem; font-weight: bold; color: #dc3545;">
                                    ${results.failed}
                                </div>
                                <div style="color: #721c24;">Failed</div>
                            </div>
                        </div>
                        
                        ${results.failed > 0 ? `
                            <div style="margin-top: 2rem; padding: 1rem; background: #fff3cd; border-radius: 8px;">
                                <h4 style="color: #856404;">Failed Notices</h4>
                                <div style="max-height: 200px; overflow-y: auto; text-align: left;">
                                    ${results.notices
                                        .filter(n => !n.success)
                                        .map(n => `
                                            <div style="padding: 0.5rem; border-bottom: 1px solid #ffeeba;">
                                                Notice ${n.noticeId}: ${n.error}
                                            </div>
                                        `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        <p style="margin-top: 2rem; color: #666;">
                            Documents have been recovered from IPFS and stored in the backend database.
                            They will now persist across deployments.
                        </p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="window.location.reload()" class="btn btn-primary">
                        Refresh Page
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

// Initialize
window.ipfsRecovery = new IPFSDocumentRecovery();

console.log('%c IPFS Recovery Tool Loaded! ', 'background: #9C27B0; color: white; padding: 5px 10px; border-radius: 3px;');
console.log('Commands:');
console.log('  - Recover single notice: unifiedSystem.recoverFromIPFS("noticeId")');
console.log('  - Recover all notices: unifiedSystem.recoverAllFromIPFS()');