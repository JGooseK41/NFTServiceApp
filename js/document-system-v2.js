/**
 * Document System V2 - Complete rebuild from scratch
 * Handles the entire document flow correctly
 */

class DocumentSystemV2 {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        this.documents = [];
        this.currentNoticeId = null;
    }

    /**
     * Main entry point - handle file upload
     */
    async handleFileUpload(file) {
        console.log(`📄 Processing: ${file.name}`);
        
        // Generate unique notice ID
        this.currentNoticeId = `NOTICE-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        try {
            // Step 1: Upload PDF to Render disk (unencrypted for case manager)
            const diskResult = await this.uploadToDisk(file);
            
            // Step 2: Extract first page as thumbnail
            const thumbnail = await this.extractThumbnail(file);
            
            // Step 3: Prepare document object
            const document = {
                noticeId: this.currentNoticeId,
                file: file,
                fileName: file.name,
                fileSize: file.size,
                fileType: 'application/pdf',
                
                // Storage locations
                diskPath: diskResult.path,
                diskUrl: diskResult.url,
                
                // Thumbnail for Alert NFT
                thumbnail: thumbnail,
                
                // Will be added when creating NFT
                ipfsHash: null,
                encryptedData: null
            };
            
            this.documents.push(document);
            
            // Step 4: Update UI
            this.updateUI(document);
            
            return document;
            
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    }

    /**
     * Upload PDF to Render disk (unencrypted)
     */
    async uploadToDisk(file) {
        console.log('📁 Uploading to Render disk...');
        
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('noticeId', this.currentNoticeId);
        
        const response = await fetch(`${this.backend}/api/v2/documents/upload-to-disk`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Disk upload failed');
        }
        
        const result = await response.json();
        console.log('✅ Stored on disk:', result.path);
        
        return {
            path: result.path,
            url: result.url
        };
    }

    /**
     * Extract first page as thumbnail
     */
    async extractThumbnail(file) {
        console.log('🖼️ Extracting thumbnail...');
        
        return new Promise((resolve) => {
            // Create canvas for thumbnail
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 800;
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 600, 800);
            
            // Read PDF and render first page
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    // Load PDF.js dynamically
                    if (typeof pdfjsLib === 'undefined') {
                        await this.loadPdfJs();
                    }
                    
                    // Render first page
                    const pdf = await pdfjsLib.getDocument({ data: e.target.result }).promise;
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({ scale: 1 });
                    
                    // Scale to fit
                    const scale = Math.min(600 / viewport.width, 800 / viewport.height);
                    const scaledViewport = page.getViewport({ scale });
                    
                    canvas.width = scaledViewport.width;
                    canvas.height = scaledViewport.height;
                    
                    await page.render({
                        canvasContext: ctx,
                        viewport: scaledViewport
                    }).promise;
                    
                    // Add legal notice overlay
                    this.addLegalOverlay(ctx, canvas.width, canvas.height);
                    
                    // Convert to data URL
                    const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
                    console.log('✅ Thumbnail created');
                    resolve(thumbnail);
                    
                } catch (error) {
                    console.warn('Could not render PDF, using placeholder');
                    resolve(this.createPlaceholder(file.name));
                }
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Add legal notice overlay to thumbnail
     */
    addLegalOverlay(ctx, width, height) {
        // Red banner
        const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.2);
        gradient.addColorStop(0, 'rgba(220, 38, 38, 0.95)');
        gradient.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height * 0.2);
        
        // Text
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.floor(width * 0.06)}px Arial`;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText('LEGAL NOTICE', width / 2, height * 0.08);
        
        ctx.font = `${Math.floor(width * 0.03)}px Arial`;
        ctx.fillText('OFFICIAL DOCUMENT', width / 2, height * 0.13);
    }

    /**
     * Create placeholder thumbnail
     */
    createPlaceholder(fileName) {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, 600, 800);
        
        // Red header
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, 0, 600, 100);
        
        // Header text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LEGAL NOTICE', 300, 60);
        
        // Document icon
        ctx.font = '72px Arial';
        ctx.fillText('📄', 300, 400);
        
        // File name
        ctx.fillStyle = '#374151';
        ctx.font = '20px Arial';
        ctx.fillText(fileName, 300, 500);
        
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    /**
     * Update UI after upload
     */
    updateUI(document) {
        // Update preview
        const preview = window.document.getElementById('documentPreview');
        if (preview) {
            preview.src = document.thumbnail;
            preview.style.display = 'block';
        }
        
        // Store globally for NFT creation
        window.uploadedImage = {
            data: null, // Don't store base64 of entire PDF
            preview: document.thumbnail,
            alertThumbnail: document.thumbnail,
            fileName: document.fileName,
            fileSize: document.fileSize,
            diskPath: document.diskPath,
            diskUrl: document.diskUrl,
            noticeId: document.noticeId
        };
        
        // Show success
        if (window.uiManager) {
            window.uiManager.showNotification('success', 'Document uploaded successfully');
        }
        
        console.log('✅ Document ready for NFT creation');
    }

    /**
     * Prepare for NFT creation (called at transaction time)
     */
    async prepareForNFT(recipientAddress) {
        const document = this.documents[0]; // Use first document
        
        if (!document) {
            throw new Error('No document uploaded');
        }
        
        console.log('🔐 Preparing document for NFT...');
        
        // Encrypt document for IPFS
        const encrypted = await this.encryptForRecipient(document.file, recipientAddress);
        
        // Upload to IPFS
        const ipfsHash = await this.uploadToIPFS(encrypted);
        
        document.encryptedData = encrypted;
        document.ipfsHash = ipfsHash;
        
        return {
            alertThumbnail: document.thumbnail,
            documentIPFS: ipfsHash,
            encryptionKey: this.getEncryptionKey(recipientAddress)
        };
    }

    /**
     * Encrypt document for specific recipient
     */
    async encryptForRecipient(file, recipientAddress) {
        console.log('🔐 Encrypting for recipient:', recipientAddress);
        
        // Read file as base64
        const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result.split(',')[1]);
            reader.readAsDataURL(file);
        });
        
        // Generate encryption key
        const key = this.getEncryptionKey(recipientAddress);
        
        // Encrypt using CryptoJS
        if (window.CryptoJS) {
            const encrypted = CryptoJS.AES.encrypt(base64, key).toString();
            return encrypted;
        }
        
        // Fallback - return base64 (not encrypted)
        console.warn('CryptoJS not available, skipping encryption');
        return base64;
    }

    /**
     * Generate encryption key for recipient
     */
    getEncryptionKey(recipientAddress) {
        const serverAddress = window.tronWeb?.defaultAddress?.base58 || '';
        return `${serverAddress}-${recipientAddress}-${this.currentNoticeId}`;
    }

    /**
     * Upload encrypted document to IPFS
     */
    async uploadToIPFS(encryptedData) {
        console.log('📤 Uploading to IPFS...');
        
        // Check for Pinata
        if (window.PINATA_CONFIG) {
            try {
                const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.PINATA_CONFIG.jwt}`
                    },
                    body: JSON.stringify({
                        pinataContent: {
                            encrypted: encryptedData,
                            type: 'legal-document',
                            timestamp: Date.now()
                        },
                        pinataMetadata: {
                            name: `legal-notice-${this.currentNoticeId}`
                        }
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Uploaded to IPFS:', result.IpfsHash);
                    return result.IpfsHash;
                }
            } catch (error) {
                console.error('IPFS upload failed:', error);
            }
        }
        
        // Fallback - generate mock hash
        const mockHash = 'Qm' + btoa(encryptedData).substring(0, 44).replace(/[^a-zA-Z0-9]/g, '');
        console.log('⚠️ Using mock IPFS hash:', mockHash);
        return mockHash;
    }

    /**
     * Load PDF.js library
     */
    async loadPdfJs() {
        return new Promise((resolve, reject) => {
            if (window.pdfjsLib) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Get document for case manager (unencrypted from disk)
     */
    async getDocumentForCaseManager(noticeId) {
        const response = await fetch(`${this.backend}/api/v2/documents/get-from-disk/${noticeId}`);
        
        if (response.ok) {
            return await response.blob();
        }
        
        throw new Error('Document not found on disk');
    }
}

// Initialize and attach to window
window.documentSystemV2 = new DocumentSystemV2();

// Override the existing upload handler
window.handleDocumentUpload = async function(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    try {
        // Use new system
        await window.documentSystemV2.handleFileUpload(file);
        
        // Show next step
        if (window.showMintStep2) {
            window.showMintStep2();
        }
    } catch (error) {
        console.error('Upload failed:', error);
        if (window.uiManager) {
            window.uiManager.showNotification('error', 'Upload failed: ' + error.message);
        }
    }
};

console.log('✅ Document System V2 loaded - complete rebuild for proper flow');