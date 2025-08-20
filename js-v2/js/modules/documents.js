// Document Processing Module - Handles PDF consolidation, thumbnails, and encryption
window.documents = {
    
    // Initialize module
    async init() {
        console.log('Initializing documents module...');
        
        // Load PDF.js library dynamically
        await this.loadPDFJS();
    },
    
    // Load PDF.js library
    async loadPDFJS() {
        return new Promise((resolve) => {
            if (window.pdfjsLib) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                console.log('PDF.js loaded');
                resolve();
            };
            document.head.appendChild(script);
        });
    },
    
    // Process multiple PDFs into single document with Alert NFT thumbnail
    async processDocuments(files, options = {}) {
        try {
            console.log('Processing documents:', files.length, 'files');
            
            // Step 1: Consolidate PDFs into single document
            const consolidatedPDF = await this.consolidatePDFs(files);
            
            // Step 2: Generate Base64 thumbnail from first page
            const thumbnail = await this.generateThumbnail(consolidatedPDF);
            
            // Step 3: Encrypt document if requested
            let documentData = consolidatedPDF;
            let encryptionKey = null;
            
            if (options.encrypt) {
                const encrypted = await this.encryptDocument(consolidatedPDF, options.recipientAddress);
                documentData = encrypted.data;
                encryptionKey = encrypted.key;
            }
            
            // Step 4: Upload to IPFS
            const ipfsHash = await this.uploadToIPFS(documentData, options);
            
            // Step 5: Store document reference in backend
            const documentId = await this.storeDocumentReference({
                ipfsHash,
                encryptionKey,
                thumbnail,
                pageCount: await this.getPageCount(consolidatedPDF),
                recipient: options.recipientAddress,
                caseNumber: options.caseNumber
            });
            
            return {
                success: true,
                documentId,
                ipfsHash,
                thumbnail, // Base64 data URI for Alert NFT
                encryptionKey,
                pageCount: await this.getPageCount(consolidatedPDF),
                size: documentData.size || documentData.length
            };
            
        } catch (error) {
            console.error('Failed to process documents:', error);
            throw error;
        }
    },
    
    // Consolidate multiple PDFs into one
    async consolidatePDFs(files) {
        console.log('Consolidating PDFs...');
        
        // If only one file, return it as-is
        if (files.length === 1) {
            return files[0];
        }
        
        // Use PDF-lib for merging
        await this.loadPDFLib();
        
        const pdfDoc = await PDFLib.PDFDocument.create();
        
        for (const file of files) {
            const pdfBytes = await file.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            const pages = await pdfDoc.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(page => pdfDoc.addPage(page));
        }
        
        const mergedPdfBytes = await pdfDoc.save();
        return new Blob([mergedPdfBytes], { type: 'application/pdf' });
    },
    
    // Generate Base64 thumbnail from first page
    async generateThumbnail(pdfBlob) {
        console.log('Generating thumbnail...');
        
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        
        // Set up canvas
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Render page
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        // Add watermark/overlay with notice info
        context.fillStyle = 'rgba(255, 0, 0, 0.7)';
        context.font = 'bold 48px Arial';
        context.textAlign = 'center';
        context.fillText('LEGAL NOTICE', canvas.width / 2, 80);
        
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.font = '24px Arial';
        context.fillText('Delivered via BlockServed', canvas.width / 2, 120);
        
        // Add timestamp
        context.font = '18px Arial';
        context.fillText(new Date().toLocaleDateString(), canvas.width / 2, 150);
        
        // Add access instructions at bottom
        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.fillRect(0, canvas.height - 100, canvas.width, 100);
        
        context.fillStyle = 'black';
        context.font = 'bold 20px Arial';
        context.fillText('View Full Document at:', canvas.width / 2, canvas.height - 60);
        context.font = 'bold 24px Arial';
        context.fillStyle = 'blue';
        context.fillText('blockserved.com', canvas.width / 2, canvas.height - 30);
        
        // Convert to Base64 data URI
        const dataUri = canvas.toDataURL('image/png', 0.9);
        console.log('Thumbnail generated, size:', dataUri.length);
        
        return dataUri;
    },
    
    // Encrypt document
    async encryptDocument(pdfBlob, recipientAddress) {
        console.log('Encrypting document...');
        
        // Generate encryption key
        const key = this.generateEncryptionKey();
        
        // Convert PDF to base64
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        
        // Encrypt using AES
        const encrypted = CryptoJS.AES.encrypt(base64, key).toString();
        
        // Create encrypted blob
        const encryptedBlob = new Blob([encrypted], { type: 'application/octet-stream' });
        
        return {
            data: encryptedBlob,
            key: key,
            recipient: recipientAddress
        };
    },
    
    // Generate encryption key
    generateEncryptionKey() {
        return CryptoJS.lib.WordArray.random(256/8).toString();
    },
    
    // Upload to IPFS via Pinata
    async uploadToIPFS(blob, options = {}) {
        console.log('Uploading to IPFS...');
        
        const formData = new FormData();
        formData.append('file', blob, `notice_${Date.now()}.pdf`);
        
        // Add Pinata metadata
        const metadata = {
            name: `Legal Notice - ${options.caseNumber || 'Unknown'}`,
            keyvalues: {
                type: options.type || 'legal_notice',
                caseNumber: options.caseNumber || '',
                recipient: options.recipientAddress || '',
                encrypted: options.encrypt ? 'true' : 'false',
                timestamp: new Date().toISOString()
            }
        };
        
        formData.append('pinataMetadata', JSON.stringify(metadata));
        
        // Upload via backend proxy (to protect API keys)
        const response = await fetch(getApiUrl('uploadDocument'), {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to upload to IPFS');
        }
        
        const data = await response.json();
        console.log('IPFS upload successful:', data.ipfsHash);
        
        return data.ipfsHash;
    },
    
    // Store document reference in backend
    async storeDocumentReference(data) {
        const response = await fetch(getApiUrl('createNotice'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ipfsHash: data.ipfsHash,
                encryptionKey: data.encryptionKey,
                thumbnail: data.thumbnail,
                pageCount: data.pageCount,
                recipient: data.recipient,
                caseNumber: data.caseNumber,
                type: 'document'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to store document reference');
        }
        
        const result = await response.json();
        return result.noticeId;
    },
    
    // Get page count from PDF
    async getPageCount(pdfBlob) {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        return pdf.numPages;
    },
    
    // Load PDF-lib for merging
    async loadPDFLib() {
        return new Promise((resolve) => {
            if (window.PDFLib) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
            script.onload = () => {
                console.log('PDF-lib loaded');
                resolve();
            };
            document.head.appendChild(script);
        });
    },
    
    // Load CryptoJS for encryption
    async loadCryptoJS() {
        return new Promise((resolve) => {
            if (window.CryptoJS) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js';
            script.onload = () => {
                console.log('CryptoJS loaded');
                resolve();
            };
            document.head.appendChild(script);
        });
    },
    
    // Decrypt document (for viewing)
    async decryptDocument(encryptedData, key) {
        await this.loadCryptoJS();
        
        try {
            const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
            const base64 = decrypted.toString(CryptoJS.enc.Utf8);
            
            // Convert base64 back to blob
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            return new Blob([bytes], { type: 'application/pdf' });
        } catch (error) {
            console.error('Failed to decrypt document:', error);
            throw new Error('Invalid decryption key');
        }
    },
    
    // Create document preview URL
    createPreviewURL(blob) {
        return URL.createObjectURL(blob);
    },
    
    // Clean up preview URL
    revokePreviewURL(url) {
        URL.revokeObjectURL(url);
    }
};

console.log('Documents module loaded');