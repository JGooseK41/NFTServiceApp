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
    
    // Process multiple PDFs - only first page becomes base64 for Alert NFT
    async processDocuments(files, options = {}) {
        try {
            console.log('Processing documents:', files.length, 'files');
            
            // Check if we're using an existing case from Case Manager
            if (window.app && window.app.currentCaseId && window.app.consolidatedPDFUrl) {
                console.log('Using existing case from Case Manager:', window.app.currentCaseId);
                
                // Get the alert preview from saved cases
                const cases = JSON.parse(localStorage.getItem('savedCases') || '[]');
                const existingCase = cases.find(c => c.caseNumber === window.app.currentCaseId);
                
                if (existingCase && existingCase.alertPreview) {
                    console.log('Using existing alert preview and PDF from Case Manager');
                    return {
                        success: true,
                        diskPath: window.app.consolidatedPDFUrl,
                        diskUrl: window.app.consolidatedPDFUrl,
                        alertNFTImage: existingCase.alertPreview, // Use the image from Case Manager
                        thumbnail: existingCase.alertPreview,
                        pageCount: existingCase.pageCount || 44,
                        size: existingCase.fileSize || 2500000
                    };
                }
            }
            
            // Otherwise process normally
            // Step 1: Consolidate PDFs into single document (stays as PDF blob/file)
            const consolidatedPDF = await this.consolidatePDFs(files);
            
            // Step 2: Extract ONLY first page as base64 for Alert NFT
            const alertNFTImage = await this.generateAlertNFTImage(consolidatedPDF, options);
            
            // Step 3: Upload PDF to disk storage (NOT base64 converted)
            const diskStorage = await this.uploadPDFToDisk(consolidatedPDF, options);
            
            // Step 4: Optional - Upload encrypted version to IPFS for blockchain verification
            let ipfsHash = null;
            let encryptionKey = null;
            
            if (options.encrypt && options.useIPFS) {
                const encrypted = await this.encryptDocument(consolidatedPDF, options.recipientAddress);
                ipfsHash = await this.uploadToIPFS(encrypted.data, options);
                encryptionKey = encrypted.key;
            }
            
            // Step 5: Store document reference in backend (points to disk file)
            const documentId = await this.storeDocumentReference({
                diskPath: diskStorage.path,
                diskFilename: diskStorage.filename,
                ipfsHash,
                encryptionKey,
                alertNFTImage, // Base64 of first page only
                pageCount: await this.getPageCount(consolidatedPDF),
                fileSize: consolidatedPDF.size,
                recipient: options.recipientAddress,
                caseNumber: options.caseNumber
            });
            
            return {
                success: true,
                documentId,
                diskPath: diskStorage.path,
                diskUrl: diskStorage.url,
                ipfsHash,
                alertNFTImage, // Base64 data URI for Alert NFT (first page only)
                encryptionKey,
                pageCount: await this.getPageCount(consolidatedPDF),
                size: consolidatedPDF.size
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
    
    // Generate Alert NFT image from ONLY first page with overlay
    async generateAlertNFTImage(pdfBlob, options = {}) {
        console.log('Generating Alert NFT image from first page only...');
        
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1); // ONLY first page
        
        // Set up canvas
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Render ONLY the first page
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        // Add LEGAL NOTICE overlay
        const overlayHeight = 180;
        
        // Semi-transparent yellow/gold background for overlay
        const gradient = context.createLinearGradient(0, 0, 0, overlayHeight);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.95)');
        gradient.addColorStop(1, 'rgba(255, 193, 7, 0.95)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, overlayHeight);
        
        // Red border around overlay
        context.strokeStyle = '#cc0000';
        context.lineWidth = 4;
        context.strokeRect(2, 2, canvas.width - 4, overlayHeight - 4);
        
        // Add text to overlay
        context.textAlign = 'center';
        
        // LEGAL NOTICE title
        context.fillStyle = '#cc0000';
        context.font = 'bold 48px Arial';
        context.fillText('LEGAL NOTICE', canvas.width / 2, 60);
        
        // Notice type if provided
        if (options.noticeType) {
            context.fillStyle = '#000000';
            context.font = 'bold 24px Arial';
            context.fillText(options.noticeType.toUpperCase(), canvas.width / 2, 95);
        }
        
        // Case number
        if (options.caseNumber) {
            context.fillStyle = '#000000';
            context.font = '20px Arial';
            context.fillText(`Case: ${options.caseNumber}`, canvas.width / 2, 125);
        }
        
        // Website reference
        context.fillStyle = '#0066cc';
        context.font = 'bold 22px Arial';
        context.fillText('View at: www.blockserved.com', canvas.width / 2, 160);
        
        // Convert to Base64 data URI (ONLY the first page with overlay)
        const dataUri = canvas.toDataURL('image/png', 0.9);
        console.log('Alert NFT image generated (first page only), size:', Math.round(dataUri.length / 1024), 'KB');
        
        return dataUri;
    },
    
    // Upload PDF to disk storage (NOT converted to base64)
    async uploadPDFToDisk(pdfBlob, options = {}) {
        console.log('Uploading PDF to disk storage...');
        
        // Check if we already have a saved case with cleaned PDFs
        if (window.app && window.app.currentCaseId && window.app.consolidatedPDFUrl) {
            console.log('Using existing case PDF from server:', window.app.currentCaseId);
            return {
                success: true,
                path: window.app.consolidatedPDFUrl,
                filename: `case_${window.app.currentCaseId}.pdf`,
                url: window.app.consolidatedPDFUrl,
                size: pdfBlob.size
            };
        }
        
        // Otherwise try to upload directly
        try {
            const formData = new FormData();
            formData.append('document', pdfBlob, `notice_${Date.now()}.pdf`);
            formData.append('noticeId', options.noticeId || `notice_${Date.now()}`);
            formData.append('caseNumber', options.caseNumber || '');
            formData.append('serverAddress', window.wallet?.address || '');
            formData.append('recipientAddress', options.recipientAddress || '');
            
            const response = await fetch(getApiUrl('uploadPDF'), {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                // If upload fails, use local blob URL as fallback
                console.warn('Failed to upload to server, using local blob URL');
                const blobUrl = URL.createObjectURL(pdfBlob);
                return {
                    success: true,
                    path: blobUrl,
                    filename: `local_notice_${Date.now()}.pdf`,
                    url: blobUrl,
                    size: pdfBlob.size,
                    isLocal: true
                };
            }
            
            const result = await response.json();
            
            return {
                success: true,
                path: result.diskPath,
                filename: result.filename,
                url: result.url,
                size: pdfBlob.size
            };
        } catch (error) {
            console.warn('Error uploading to server, using local blob URL:', error);
            const blobUrl = URL.createObjectURL(pdfBlob);
            return {
                success: true,
                path: blobUrl,
                filename: `local_notice_${Date.now()}.pdf`,
                url: blobUrl,
                size: pdfBlob.size,
                isLocal: true
            };
        }
    },
    
    // Generate Base64 thumbnail from first page (DEPRECATED - use generateAlertNFTImage instead)
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