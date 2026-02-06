/**
 * Proof of Service Receipt Generator
 * Generates comprehensive receipts with transaction details and document stamps
 */

window.proofOfService = {

    // Get network-aware TronScan URL
    getTronScanUrl(txHash) {
        // Use global helper if available
        if (window.getTronScanUrl) {
            return window.getTronScanUrl(txHash);
        }
        // Fallback: check current network
        const isNile = window.AppConfig?.network?.current === 'nile' ||
                      window.tronWeb?.fullNode?.host?.includes('nile');
        const baseUrl = isNile
            ? 'https://nile.tronscan.org/#/transaction/'
            : 'https://tronscan.org/#/transaction/';
        return baseUrl + (txHash || '');
    },

    // Generate comprehensive proof of service receipt
    async generateServiceReceipt(caseData) {
        // Try to get alert image from various sources
        let alertImage = null;
        
        // Check if we have it in case data
        if (caseData.alertImage || caseData.alertPreview || caseData.alertThumbnail) {
            alertImage = caseData.alertImage || caseData.alertPreview || caseData.alertThumbnail;
        } 
        // Try to get from local storage
        else {
            const localCases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
            const localCase = localCases.find(c => 
                c.caseNumber === caseData.caseNumber || 
                c.id === caseData.caseNumber
            );
            if (localCase && localCase.alertImage) {
                alertImage = localCase.alertImage;
            }
        }
        
        // Generate receipt number based on case number
        const caseNum = caseData.caseNumber || caseData.id;
        const receiptCount = parseInt(sessionStorage.getItem(`receipt_count_${caseNum}`) || '0') + 1;
        sessionStorage.setItem(`receipt_count_${caseNum}`, receiptCount.toString());
        const receiptId = receiptCount > 1 ? `${caseNum}-${receiptCount}` : caseNum;
        
        const receipt = {
            receiptId: receiptId,
            generatedAt: new Date().toISOString(),
            caseNumber: caseData.caseNumber || caseData.id,
            serverAddress: caseData.serverAddress || window.tronWeb?.defaultAddress?.base58,
            servedAt: caseData.servedAt || new Date().toISOString(),
            transactionHash: caseData.transactionHash,
            alertTokenId: caseData.alertTokenId,
            documentTokenId: caseData.documentTokenId,
            recipients: caseData.recipients || [],
            documents: caseData.documents || [],
            agency: caseData.agency || caseData.metadata?.issuingAgency,
            noticeType: caseData.noticeType || caseData.metadata?.noticeType,
            alertImage: alertImage
        };
        
        return receipt;
    },
    
    // Generate printable HTML receipt
    generatePrintableReceipt(receipt) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Proof of Service - Case ${receipt.caseNumber}</title>
                <style>
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                        .page-break { page-break-after: always; }
                    }
                    body {
                        font-family: 'Times New Roman', serif;
                        max-width: 8.5in;
                        margin: 0 auto;
                        padding: 0.5in;
                        line-height: 1.6;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 3px double #000;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    h1 {
                        font-size: 24px;
                        margin: 10px 0;
                        text-transform: uppercase;
                    }
                    h2 {
                        font-size: 18px;
                        margin: 20px 0 10px 0;
                        border-bottom: 1px solid #000;
                    }
                    .case-info {
                        background: #f5f5f5;
                        padding: 15px;
                        border: 1px solid #ddd;
                        margin: 20px 0;
                    }
                    .field {
                        margin: 10px 0;
                        display: flex;
                        justify-content: space-between;
                    }
                    .label {
                        font-weight: bold;
                        min-width: 150px;
                    }
                    .value {
                        flex: 1;
                        font-family: 'Courier New', monospace;
                    }
                    .tx-hash {
                        word-break: break-all;
                        font-size: 12px;
                        background: #fffee0;
                        padding: 5px;
                        border: 1px solid #ddd;
                    }
                    .recipients-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                    }
                    .recipients-table th,
                    .recipients-table td {
                        border: 1px solid #000;
                        padding: 8px;
                        text-align: left;
                    }
                    .recipients-table th {
                        background: #f0f0f0;
                    }
                    .verification-section {
                        background: #e8f4f8;
                        padding: 20px;
                        border: 2px solid #0066cc;
                        margin: 30px 0;
                    }
                    .signature-section {
                        margin-top: 50px;
                        border: 1px solid #000;
                        padding: 20px;
                        min-height: 150px;
                    }
                    .signature-line {
                        border-bottom: 1px solid #000;
                        margin: 30px 0;
                        position: relative;
                    }
                    .footer {
                        margin-top: 50px;
                        text-align: center;
                        font-size: 12px;
                        color: #666;
                    }
                    .seal {
                        text-align: center;
                        margin: 30px 0;
                        font-weight: bold;
                        font-size: 14px;
                        color: #cc0000;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Proof of Blockchain Service</h1>
                    <h2>Legal Notice Delivery Confirmation</h2>
                    <div><strong>Case #${receipt.receiptId}</strong></div>
                    <div>Generated: ${new Date(receipt.generatedAt).toLocaleString()}</div>
                </div>
                
                <div class="case-info">
                    <h2>Case Information</h2>
                    <div class="field">
                        <span class="label">Case Number:</span>
                        <span class="value">${receipt.caseNumber}</span>
                    </div>
                    <div class="field">
                        <span class="label">Issuing Agency:</span>
                        <span class="value">${receipt.agency || 'Legal Services'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Notice Type:</span>
                        <span class="value">${receipt.noticeType || 'Legal Notice'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Service Date:</span>
                        <span class="value">${new Date(receipt.servedAt).toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="blockchain-info">
                    <h2>Blockchain Verification</h2>
                    <div class="field">
                        <span class="label">Transaction Hash:</span>
                    </div>
                    <div class="tx-hash">
                        <a href="${this.getTronScanUrl(receipt.transactionHash)}" target="_blank" style="color: #0066cc; text-decoration: none;">
                            ${receipt.transactionHash}
                        </a>
                    </div>

                    <div class="field">
                        <span class="label">NFT Token ID:</span>
                        <span class="value">#${receipt.alertTokenId || 'N/A'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Server Wallet Address:</span>
                        <span class="value" style="font-size: 12px;">${receipt.serverAddress || 'N/A'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Verify on TronScan:</span>
                        <span class="value">
                            <a href="${this.getTronScanUrl(receipt.transactionHash)}" target="_blank" style="color: #0066cc;">
                                Click to verify transaction
                            </a>
                        </span>
                    </div>
                </div>
                
                ${receipt.alertImage ? `
                <div class="alert-image-section" style="margin: 30px 0; page-break-inside: avoid;">
                    <h2>Legal Notice NFT</h2>
                    <div style="text-align: center; margin: 20px 0;">
                        <img src="${receipt.alertImage}"
                             style="max-width: 500px; width: 100%; border: 2px solid #ddd; border-radius: 8px;"
                             alt="Legal Notice NFT">
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px;">
                        <p style="font-weight: bold; margin-bottom: 10px;">NFT Description (as shown in wallet):</p>
                        <p style="white-space: pre-line;">OFFICIAL LEGAL NOTICE

You have been served with an official legal document that requires your attention.

WHAT THIS MEANS:
This NFT represents legal service of process. You have been officially notified of a legal matter that requires your attention or response.

NEXT STEPS:
1. Visit www.BlockServed.com
2. Connect your wallet
3. View your complete legal documents
4. Follow the instructions provided
5. Respond within the specified timeframe

IMPORTANT: This is a time-sensitive legal matter. Ignoring this notice may result in legal consequences.

VERIFICATION: This NFT serves as permanent proof on the blockchain that you received legal notice on ${new Date(receipt.servedAt).toLocaleDateString()}</p>
                    </div>
                </div>
                ` : ''}
                
                <div class="recipients-section">
                    <h2>Recipients</h2>
                    <table class="recipients-table">
                        <thead>
                            <tr>
                                <th>Recipient Address</th>
                                <th>Token ID</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${receipt.recipients.map((r, i) => `
                                <tr>
                                    <td style="font-family: monospace; font-size: 11px;">
                                        ${typeof r === 'string' ? r : r.address}
                                    </td>
                                    <td>#${parseInt(receipt.alertTokenId) + (i * 2)}</td>
                                    <td>Delivered</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="verification-section">
                    <h2>How to Verify This Service</h2>
                    <ol>
                        <li>
                            <strong>Click to Verify Transaction:</strong><br>
                            <a href="${this.getTronScanUrl(receipt.transactionHash)}" target="_blank" style="color: #0066cc;">
                                ${this.getTronScanUrl(receipt.transactionHash)}
                            </a>
                        </li>
                        <li>
                            <strong>Transaction ID:</strong><br>
                            <div style="background: #fff; padding: 8px; margin: 10px 0; border: 1px solid #ccc; word-break: break-all; font-family: monospace; font-size: 11px;">
                                ${receipt.transactionHash}
                            </div>
                        </li>
                        <li>
                            <strong>Verify Recipients:</strong><br>
                            Check that the recipient addresses match those listed above
                        </li>
                        <li>
                            <strong>Confirm NFT Ownership:</strong><br>
                            Search each recipient address to confirm they received the NFT token
                        </li>
                        <li>
                            <strong>Access Documents:</strong><br>
                            Recipients can view their notices at: <a href="https://www.BlockServed.com" target="_blank">www.BlockServed.com</a>
                        </li>
                    </ol>
                </div>
                
                <div class="seal">
                    *** OFFICIAL BLOCKCHAIN SERVICE ***<br>
                    This document certifies that legal notice was properly served<br>
                    via blockchain technology on the TRON network
                </div>
                
                <div class="signature-section">
                    <h2>Server Affirmation</h2>
                    <p>
                        I hereby affirm under penalty of perjury that on <strong>${new Date(receipt.servedAt).toLocaleDateString()}</strong>,
                        I served the legal documents described above to the listed recipient addresses via blockchain technology
                        using the wallet address <strong>${receipt.serverAddress}</strong> as recorded in transaction
                        <strong>${receipt.transactionHash.substring(0, 20)}...</strong> on the TRON blockchain network.
                    </p>
                    
                    <div style="margin-top: 40px;">
                        <div class="signature-line" style="width: 300px; display: inline-block;">
                            <div style="position: absolute; bottom: -20px; font-size: 12px;">Signature</div>
                        </div>
                        <div class="signature-line" style="width: 200px; display: inline-block; margin-left: 50px;">
                            <div style="position: absolute; bottom: -20px; font-size: 12px;">Date</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 60px;">
                        <div class="signature-line" style="width: 400px;">
                            <div style="position: absolute; bottom: -20px; font-size: 12px;">Print Name and Title</div>
                        </div>
                    </div>
                </div>
                
                <div class="footer">
                    <p>This receipt was generated electronically via BlockServed™ Legal Notice System</p>
                    <p>For verification assistance, visit www.BlockServed.com</p>
                </div>
            </body>
            </html>
        `;
        
        return html;
    },
    
    // Print the receipt
    async printReceipt(caseData) {
        const receipt = await this.generateServiceReceipt(caseData);
        const html = this.generatePrintableReceipt(receipt);
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    },
    
    // Save receipt as PDF (using browser print to PDF)
    async saveReceiptAsPDF(caseData) {
        const receipt = await this.generateServiceReceipt(caseData);
        const html = this.generatePrintableReceipt(receipt);
        
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `proof-of-service-${receipt.caseNumber}.html`;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    // Generate stamped documents with delivery confirmation
    async generateStampedDocuments(caseData, pdfBlob) {
        try {
            // Load the PDF
            const arrayBuffer = await pdfBlob.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            
            // Create alert NFT info page as first page
            const alertPage = pdfDoc.insertPage(0, [612, 792]); // Letter size
            const { width: pageWidth, height: pageHeight } = alertPage.getSize();
            
            // Add title
            alertPage.drawText('LEGAL NOTICE DELIVERY CONFIRMATION', {
                x: 50,
                y: pageHeight - 80,
                size: 18,
                color: PDFLib.rgb(0, 0, 0)
            });
            
            // Add alert NFT thumbnail if available - check multiple possible locations
            const alertImage = caseData.alertImage || 
                             caseData.alertPreview || 
                             caseData.alert_preview || 
                             caseData.alert_image ||
                             caseData.metadata?.alertImage;
            
            console.log('Alert image available:', !!alertImage);
            
            if (alertImage) {
                try {
                    let imageBytes;
                    
                    // Check if it's a data URL or just base64
                    if (alertImage.startsWith('data:image')) {
                        // It's a data URL, extract the base64 part
                        const base64Data = alertImage.split(',')[1];
                        imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                    } else if (alertImage.startsWith('/9j/') || alertImage.startsWith('iVBOR')) {
                        // It's raw base64 (JPEG starts with /9j/, PNG with iVBOR)
                        imageBytes = Uint8Array.from(atob(alertImage), c => c.charCodeAt(0));
                    } else {
                        // Assume it needs to be fetched or is already bytes
                        console.log('Alert image format not recognized, skipping');
                        throw new Error('Unrecognized image format');
                    }
                    
                    // Determine image type and embed
                    let embeddedImage;
                    // Check for PNG magic bytes (89 50 4E 47)
                    if (imageBytes[0] === 0x89 && imageBytes[1] === 0x50) {
                        console.log('Embedding as PNG');
                        embeddedImage = await pdfDoc.embedPng(imageBytes);
                    } else {
                        // Assume JPEG
                        console.log('Embedding as JPEG');
                        embeddedImage = await pdfDoc.embedJpg(imageBytes);
                    }
                    
                    // Calculate dimensions to fit nicely on page
                    const maxWidth = pageWidth - 100; // Leave 50px margins
                    const maxHeight = 250; // Max height for the image
                    
                    let scale = 1;
                    const origWidth = embeddedImage.width;
                    const origHeight = embeddedImage.height;
                    
                    if (origWidth > maxWidth) {
                        scale = maxWidth / origWidth;
                    }
                    if (origHeight * scale > maxHeight) {
                        scale = maxHeight / origHeight;
                    }
                    
                    const imgDims = embeddedImage.scale(scale);
                    
                    // Center the image horizontally, position below title
                    alertPage.drawImage(embeddedImage, {
                        x: pageWidth / 2 - imgDims.width / 2,
                        y: pageHeight - 120 - imgDims.height, // Position below title
                        width: imgDims.width,
                        height: imgDims.height
                    });
                    
                    console.log('Alert NFT image successfully embedded');
                } catch (imgError) {
                    console.error('Failed to embed alert image:', imgError);
                    // Continue without image
                }
            } else {
                console.log('No alert image found in case data');
            }
            
            // Add NFT details
            const detailsY = alertImage ? pageHeight - 450 : pageHeight - 150;
            const details = [
                'ALERT NFT INFORMATION',
                '---------------------------------------------------',
                '',
                `Token ID: #${caseData.alertTokenId || 'N/A'}`,
                `Case Number: ${caseData.caseNumber}`,
                `Service Date: ${new Date(caseData.servedAt).toLocaleString()}`,
                `Issuing Agency: ${caseData.agency || 'The Block Audit'}`,
                `Notice Type: ${caseData.noticeType || 'Legal Notice'}`,
                '',
                'BLOCKCHAIN VERIFICATION',
                '---------------------------------------------------',
                '',
                `Transaction Hash:`,
                `${caseData.transactionHash}`,
                '',
                'INSTRUCTIONS FOR RECIPIENTS',
                '---------------------------------------------------',
                '',
                '1. This Alert NFT serves as proof of delivery for the attached legal documents.',
                '2. The NFT has been permanently recorded on the TRON blockchain.',
                '3. You can verify this transaction on TronScan using the transaction hash above.',
                '4. The following pages contain the served legal documents.',
                '5. If action is required, please refer to the document contents.',
                '',
                'IMPORTANT: This is an official legal notice. The Alert NFT in your wallet',
                'confirms delivery. Please review the attached documents carefully.'
            ];
            
            let yPosition = detailsY;
            for (const line of details) {
                const fontSize = line.includes('---') ? 10 : 
                               line.includes('INSTRUCTIONS') || line.includes('BLOCKCHAIN') || line.includes('ALERT NFT') ? 12 : 10;
                const fontColor = line.includes('---') ? PDFLib.rgb(0.5, 0.5, 0.5) :
                                 line.includes('INSTRUCTIONS') || line.includes('BLOCKCHAIN') || line.includes('ALERT NFT') ? PDFLib.rgb(0, 0, 0.8) :
                                 PDFLib.rgb(0, 0, 0);
                
                alertPage.drawText(line, {
                    x: 50,
                    y: yPosition,
                    size: fontSize,
                    color: fontColor
                });
                yPosition -= fontSize + 6;
            }
            
            // Get all existing pages
            const pages = pdfDoc.getPages();
            
            // Stamp each page (skip the first alert page)
            for (let i = 1; i < pages.length; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();
                
                // Position stamp at bottom center
                const stampWidth = 400; // Wide enough for transaction hash
                const stampHeight = 70;
                const stampX = (width - stampWidth) / 2; // Center horizontally
                const stampY = 30; // 30px from bottom
                
                // Add red stamp box with rounded appearance
                page.drawRectangle({
                    x: stampX,
                    y: stampY,
                    width: stampWidth,
                    height: stampHeight,
                    borderColor: PDFLib.rgb(0.8, 0, 0),
                    borderWidth: 2,
                    color: PDFLib.rgb(1, 0.98, 0.98)
                });
                
                // Add stamp text centered
                const lines = [
                    'DELIVERED via BlockServed™',
                    `Date: ${new Date(caseData.servedAt).toLocaleDateString()} | Case: ${caseData.caseNumber}`,
                    `Transaction Hash:`,
                    `${caseData.transactionHash || 'Not Available'}`
                ];
                
                // Calculate text positioning for centering
                let textY = stampY + stampHeight - 18;
                for (let j = 0; j < lines.length; j++) {
                    const line = lines[j];
                    const fontSize = j === 0 ? 10 : 8; // Larger font for title
                    const isBold = j === 0 || j === 2; // Bold for title and "Transaction Hash:"
                    
                    // Estimate text width for centering (rough approximation)
                    const textWidth = line.length * (fontSize * 0.5);
                    const textX = stampX + (stampWidth - textWidth) / 2;
                    
                    page.drawText(line, {
                        x: textX,
                        y: textY,
                        size: fontSize,
                        color: isBold ? PDFLib.rgb(0.6, 0, 0) : PDFLib.rgb(0.8, 0, 0)
                    });
                    textY -= fontSize + 4;
                }
            }
            
            // Save the stamped PDF
            const stampedPdfBytes = await pdfDoc.save();
            return new Blob([stampedPdfBytes], { type: 'application/pdf' });
            
        } catch (error) {
            console.error('Failed to stamp documents:', error);
            throw error;
        }
    },
    
    // Decrypt AES-256-GCM encrypted PDF data
    async decryptPDF(encryptedBuffer, keyHex) {
        try {
            // The encrypted data format is: IV (16 bytes) + Auth Tag (16 bytes) + Encrypted Data
            const IV_LENGTH = 16;
            const TAG_LENGTH = 16;
            
            const encrypted = new Uint8Array(encryptedBuffer);
            
            // Extract components
            const iv = encrypted.slice(0, IV_LENGTH);
            const authTag = encrypted.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
            const ciphertext = encrypted.slice(IV_LENGTH + TAG_LENGTH);
            
            // Import the key for decryption
            const keyBuffer = this.hexToBuffer(keyHex);
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyBuffer,
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );
            
            // Decrypt the data
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv,
                    tagLength: 128, // 16 bytes * 8 = 128 bits
                    additionalData: new Uint8Array(0)
                },
                cryptoKey,
                new Uint8Array([...ciphertext, ...authTag]) // Combine ciphertext with auth tag
            );
            
            return decrypted;
        } catch (error) {
            console.error('Failed to decrypt PDF:', error);
            return null;
        }
    },
    
    // Helper to convert hex string to buffer
    hexToBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes.buffer;
    },
    
    // Show PDF in modal with print/save options
    showPDFModal(pdfBlob, caseNumber) {
        // Create modal HTML
        const modalHTML = `
            <div id="pdfModal" class="modal fade show" style="display: block; background: rgba(0,0,0,0.5);">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Stamped Legal Documents - Case ${caseNumber}</h5>
                            <button type="button" class="btn-close" onclick="document.getElementById('pdfModal').remove()"></button>
                        </div>
                        <div class="modal-body">
                            <iframe id="pdfFrame" style="width: 100%; height: 500px; border: 1px solid #ddd;"></iframe>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" id="printPdfBtn">
                                <i class="bi bi-printer"></i> Print Document
                            </button>
                            <button type="button" class="btn btn-success" id="savePdfBtn">
                                <i class="bi bi-download"></i> Save to Computer
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="document.getElementById('pdfModal').remove()">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = modalHTML;
        document.body.appendChild(modalDiv.firstElementChild);
        
        // Load PDF in iframe
        const pdfUrl = URL.createObjectURL(pdfBlob);
        document.getElementById('pdfFrame').src = pdfUrl;
        
        // Print button handler
        document.getElementById('printPdfBtn').onclick = () => {
            const printWindow = window.open(pdfUrl, '_blank');
            printWindow.onload = () => {
                printWindow.print();
            };
        };
        
        // Save button handler
        document.getElementById('savePdfBtn').onclick = () => {
            const a = document.createElement('a');
            a.href = pdfUrl;
            a.download = `stamped-${caseNumber}.pdf`;
            a.click();
        };
        
        // Clean up object URL when modal is closed
        const modal = document.getElementById('pdfModal');
        const observer = new MutationObserver(() => {
            if (!document.contains(modal)) {
                URL.revokeObjectURL(pdfUrl);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true });
    },
    
    // Show loading indicator
    showLoading(message = 'Generating stamped documents...') {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'stampedDocLoading';
        loadingDiv.className = 'alert alert-info position-fixed top-50 start-50 translate-middle';
        loadingDiv.style.cssText = 'z-index: 9999; min-width: 300px; text-align: center;';
        loadingDiv.innerHTML = `
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            <span>${message}</span>
        `;
        document.body.appendChild(loadingDiv);
        return loadingDiv;
    },
    
    // Hide loading indicator
    hideLoading() {
        const loadingDiv = document.getElementById('stampedDocLoading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    },
    
    // Export stamped documents
    async exportStampedDocuments(caseData) {
        // Show loading indicator
        this.showLoading('Preparing stamped documents...');
        
        try {
            let pdfBlob = null;
            const caseId = caseData.caseNumber || caseData.case_number || caseData.id;
            const ipfsHash = caseData.ipfsDocument || caseData.ipfsHash || caseData.metadata?.ipfsHash;
            
            // First try IPFS if we have a hash (since IPFS contains the encrypted binary)
            if (ipfsHash) {
                try {
                    this.showLoading('Fetching document from IPFS...');
                    console.log('Fetching encrypted PDF from IPFS:', ipfsHash);
                    const ipfsGateway = 'https://gateway.pinata.cloud/ipfs/';
                    
                    // Try IPFS with timeout to avoid hanging on CORS/rate limit issues
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
                    
                    const ipfsResponse = await fetch(ipfsGateway + ipfsHash, {
                        signal: controller.signal,
                        mode: 'cors'
                    });
                    clearTimeout(timeout);
                    
                    if (ipfsResponse.ok) {
                        const encryptedData = await ipfsResponse.arrayBuffer();
                        
                        // Get the encryption key - it should be stored with the case
                        const encryptionKey = caseData.encryptionKey || caseData.encryption_key || caseData.metadata?.encryptionKey;
                        
                        if (encryptionKey) {
                            // Try decrypting with the stored encryption key
                            const decryptedData = await this.decryptPDF(encryptedData, encryptionKey);
                            
                            if (decryptedData) {
                                // Check if decrypted data is a valid PDF
                                const bytes = new Uint8Array(decryptedData);
                                const pdfHeader = [0x25, 0x50, 0x44, 0x46]; // %PDF
                                const isPDF = bytes[0] === pdfHeader[0] && bytes[1] === pdfHeader[1] && 
                                             bytes[2] === pdfHeader[2] && bytes[3] === pdfHeader[3];
                                
                                if (isPDF) {
                                    console.log('Successfully decrypted PDF from IPFS');
                                    pdfBlob = new Blob([decryptedData], { type: 'application/pdf' });
                                }
                            }
                        }
                        
                        if (!pdfBlob) {
                            // Maybe it's not encrypted, try as raw PDF
                            const rawBytes = new Uint8Array(encryptedData);
                            const pdfHeader = [0x25, 0x50, 0x44, 0x46]; // %PDF
                            const isRawPDF = rawBytes[0] === pdfHeader[0] && rawBytes[1] === pdfHeader[1] && 
                                            rawBytes[2] === pdfHeader[2] && rawBytes[3] === pdfHeader[3];
                            
                            if (isRawPDF) {
                                console.log('IPFS data is already a PDF (not encrypted)');
                                pdfBlob = new Blob([encryptedData], { type: 'application/pdf' });
                            } else {
                                console.log('IPFS data is encrypted but no encryption key found in case data');
                            }
                        }
                    }
                } catch (ipfsError) {
                    console.error('IPFS fetch/decrypt failed:', ipfsError);
                    // Don't worry about IPFS failures, just fallback to backend
                    if (ipfsError.name === 'AbortError') {
                        console.log('IPFS request timed out, falling back to backend');
                    } else if (ipfsError.message.includes('CORS')) {
                        console.log('IPFS CORS issue, falling back to backend');
                    } else {
                        console.log('IPFS error, falling back to backend');
                    }
                }
            }
            
            // If IPFS didn't work, try backend
            if (!pdfBlob) {
                this.showLoading('Fetching document from server...');
                const backendUrl = 'https://nftserviceapp.onrender.com';
                const pdfUrl = `${backendUrl}/api/cases/${caseId}/pdf`;
                
                console.log('Fetching PDF from backend:', pdfUrl);
                
                const response = await fetch(pdfUrl, {
                    headers: {
                        'X-Server-Address': window.wallet?.address || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch PDF: Backend returned ${response.status}`);
                }
                
                pdfBlob = await response.blob();
                
                // Verify it's actually a PDF
                const arrayBuffer = await pdfBlob.slice(0, 4).arrayBuffer();
                const header = new Uint8Array(arrayBuffer);
                const pdfHeader = [0x25, 0x50, 0x44, 0x46]; // %PDF
                const isPDF = header[0] === pdfHeader[0] && header[1] === pdfHeader[1] && 
                             header[2] === pdfHeader[2] && header[3] === pdfHeader[3];
                
                if (!isPDF) {
                    console.error('Backend data is not a valid PDF');
                    alert('The document is not in PDF format. Downloading original file.');
                    
                    // Just download the original
                    const url = URL.createObjectURL(pdfBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `case-${caseId}-documents`;
                    a.click();
                    URL.revokeObjectURL(url);
                    return;
                }
            }
            
            if (!pdfBlob) {
                throw new Error('No document data available');
            }
            
            // Update loading message
            this.showLoading('Generating stamps and adding delivery confirmation...');
            
            // Generate stamped version
            const stampedBlob = await this.generateStampedDocuments(caseData, pdfBlob);
            
            // Hide loading indicator
            this.hideLoading();
            
            // Show in modal with print/save options
            this.showPDFModal(stampedBlob, caseData.caseNumber);
            
        } catch (error) {
            console.error('Failed to export stamped documents:', error);
            
            // Hide loading indicator if visible
            this.hideLoading();
            
            alert('Failed to export stamped documents. Please ensure the case has valid document data.');
        }
    }
};

// Make available globally
window.proofOfService = window.proofOfService;