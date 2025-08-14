/**
 * PDF Direct Storage
 * Store PDFs as base64 without conversion to images
 * Preserves full quality and all pages
 */

class PDFDirectStorage {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
    }

    /**
     * Process PDF for dual storage (encrypted IPFS + unencrypted backend)
     */
    async processPDFForStorage(file, noticeData) {
        console.log('📄 Processing PDF for dual storage...');
        console.log(`File: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        
        try {
            // 1. Read file as base64
            const base64PDF = await this.fileToBase64(file);
            console.log(`✅ PDF converted to base64: ${(base64PDF.length / 1024).toFixed(2)} KB`);
            
            // 2. Generate encryption key for IPFS storage
            const encryptionKey = await this.generateEncryptionKey();
            console.log('🔐 Generated encryption key for recipient');
            
            // 3. Encrypt PDF for IPFS
            const encryptedPDF = await this.encryptPDF(base64PDF, encryptionKey);
            console.log(`🔒 PDF encrypted: ${(encryptedPDF.length / 1024).toFixed(2)} KB`);
            
            // 4. Upload encrypted to IPFS
            const ipfsHash = await this.uploadToIPFS(encryptedPDF);
            console.log('📦 Uploaded to IPFS:', ipfsHash);
            
            // 5. Store unencrypted in backend for process server access
            const backendResult = await this.storeInBackend({
                noticeId: noticeData.noticeId,
                caseNumber: noticeData.caseNumber,
                recipientAddress: noticeData.recipientAddress,
                serverAddress: noticeData.serverAddress,
                documentData: base64PDF, // Unencrypted for process server
                documentMimeType: 'application/pdf',
                ipfsHash: ipfsHash,
                encryptionKey: encryptionKey, // Store key securely
                pageCount: await this.countPDFPages(base64PDF)
            });
            
            console.log('💾 Stored in backend:', backendResult);
            
            return {
                success: true,
                ipfsHash: ipfsHash,
                encryptionKey: encryptionKey,
                backendId: backendResult.id,
                pageCount: backendResult.pageCount,
                fileSize: file.size,
                encrypted: true,
                unencryptedAvailable: true
            };
            
        } catch (error) {
            console.error('❌ Error processing PDF:', error);
            throw error;
        }
    }

    /**
     * Convert file to base64
     */
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove data URL prefix to get pure base64
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Generate AES-256 encryption key
     */
    async generateEncryptionKey() {
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        const exported = await crypto.subtle.exportKey('jwk', key);
        return JSON.stringify(exported);
    }

    /**
     * Encrypt PDF using AES-256-GCM
     */
    async encryptPDF(base64PDF, keyString) {
        const key = await crypto.subtle.importKey(
            'jwk',
            JSON.parse(keyString),
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );
        
        // Convert base64 to ArrayBuffer
        const pdfBuffer = Uint8Array.from(atob(base64PDF), c => c.charCodeAt(0));
        
        // Generate IV
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        // Encrypt
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            pdfBuffer
        );
        
        // Combine IV and encrypted data
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);
        
        // Convert to base64
        return btoa(String.fromCharCode(...combined));
    }

    /**
     * Upload to IPFS via Pinata
     */
    async uploadToIPFS(encryptedData) {
        // This would use your Pinata API keys
        const formData = new FormData();
        const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
        formData.append('file', blob, 'encrypted-document.bin');
        
        const metadata = JSON.stringify({
            name: 'Encrypted Legal Document',
            keyvalues: {
                encrypted: 'true',
                type: 'legal-document'
            }
        });
        formData.append('pinataMetadata', metadata);
        
        // Mock response for now - implement with actual Pinata API
        console.log('📤 Would upload to IPFS:', (encryptedData.length / 1024).toFixed(2), 'KB');
        return 'QmExample' + Date.now(); // Mock IPFS hash
    }

    /**
     * Store unencrypted in backend
     */
    async storeInBackend(data) {
        const response = await fetch(`${this.backend}/api/documents/store-complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Failed to store in backend');
        }
        
        return await response.json();
    }

    /**
     * Count PDF pages without rendering
     */
    async countPDFPages(base64PDF) {
        try {
            // Decode base64
            const pdfString = atob(base64PDF);
            
            // Simple page count by counting page objects
            const pageMatches = pdfString.match(/\/Type\s*\/Page(?!s)/g);
            return pageMatches ? pageMatches.length : 1;
        } catch (error) {
            console.warn('Could not count pages:', error);
            return 1;
        }
    }

    /**
     * Decrypt PDF for recipient (after service acceptance)
     */
    async decryptPDF(encryptedData, keyString) {
        const key = await crypto.subtle.importKey(
            'jwk',
            JSON.parse(keyString),
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );
        
        // Convert base64 to ArrayBuffer
        const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
        
        // Extract IV and encrypted data
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);
        
        // Decrypt
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encrypted
        );
        
        // Convert back to base64
        const decryptedBytes = new Uint8Array(decrypted);
        return btoa(String.fromCharCode(...decryptedBytes));
    }
}

// Initialize globally
window.pdfStorage = new PDFDirectStorage();

console.log('📄 PDF Direct Storage loaded - preserves full document quality');