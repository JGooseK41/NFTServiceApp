/**
 * Proof of Service Receipt Generator
 * Generates comprehensive receipts with transaction details and document stamps
 */

window.proofOfService = {
    
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
                    <div class="tx-hash">${receipt.transactionHash}</div>
                    
                    <div class="field">
                        <span class="label">Alert NFT Token ID:</span>
                        <span class="value">#${receipt.alertTokenId}</span>
                    </div>
                    <div class="field">
                        <span class="label">Document NFT Token ID:</span>
                        <span class="value">#${receipt.documentTokenId}</span>
                    </div>
                    <div class="field">
                        <span class="label">Server Wallet Address:</span>
                        <span class="value" style="font-size: 12px;">${receipt.serverAddress}</span>
                    </div>
                </div>
                
                ${receipt.alertImage ? `
                <div class="alert-image-section" style="margin: 30px 0; page-break-inside: avoid;">
                    <h2>Alert Notice NFT</h2>
                    <div style="text-align: center; margin: 20px 0;">
                        <img src="${receipt.alertImage}" 
                             style="max-width: 500px; width: 100%; border: 2px solid #ddd; border-radius: 8px;"
                             alt="Alert Notice NFT">
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px;">
                        <p style="font-weight: bold; margin-bottom: 10px;">NFT Description (as shown in wallet):</p>
                        <p style="white-space: pre-line;">⚖️ OFFICIAL LEGAL NOTICE ⚖️

You have been served with an official legal document that requires your attention.

📋 WHAT THIS MEANS:
This NFT represents legal service of process. You have been officially notified of a legal matter that requires your attention or response.

📍 NEXT STEPS:
1. Visit www.BlockServed.com
2. Connect your wallet
3. View your complete legal documents
4. Follow the instructions provided
5. Respond within the specified timeframe

⚠️ IMPORTANT: This is a time-sensitive legal matter. Ignoring this notice may result in legal consequences.

🔒 VERIFICATION: This NFT serves as permanent proof on the blockchain that you received legal notice on ${new Date(receipt.servedAt).toLocaleDateString()}</p>
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
                            <strong>Visit TronScan:</strong><br>
                            Go to: <code>https://tronscan.org</code>
                        </li>
                        <li>
                            <strong>Search for the Transaction:</strong><br>
                            Copy and paste this transaction ID into the search bar:<br>
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
                            Search each recipient address to confirm they received the NFT tokens
                        </li>
                        <li>
                            <strong>Access Documents:</strong><br>
                            Recipients can view their notices at: <code>www.BlockServed.com</code>
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
            const pages = pdfDoc.getPages();
            
            // Stamp each page
            const stampText = `DELIVERED via BlockServed™\nDate: ${new Date(caseData.servedAt).toLocaleDateString()}\nTX: ${caseData.transactionHash}\nCase: ${caseData.caseNumber}`;
            
            for (const page of pages) {
                const { width, height } = page.getSize();
                
                // Add red stamp box in top right corner
                page.drawRectangle({
                    x: width - 200,
                    y: height - 80,
                    width: 180,
                    height: 60,
                    borderColor: PDFLib.rgb(1, 0, 0),
                    borderWidth: 2,
                    color: PDFLib.rgb(1, 1, 0.9)
                });
                
                // Add stamp text
                page.drawText(stampText, {
                    x: width - 190,
                    y: height - 30,
                    size: 8,
                    color: PDFLib.rgb(0.8, 0, 0),
                    lineHeight: 12
                });
            }
            
            // Save the stamped PDF
            const stampedPdfBytes = await pdfDoc.save();
            return new Blob([stampedPdfBytes], { type: 'application/pdf' });
            
        } catch (error) {
            console.error('Failed to stamp documents:', error);
            throw error;
        }
    },
    
    // Export stamped documents
    async exportStampedDocuments(caseData) {
        try {
            // Get the IPFS document
            const ipfsHash = caseData.ipfsDocument || caseData.metadata?.ipfsHash;
            if (!ipfsHash) {
                throw new Error('No document IPFS hash found');
            }
            
            // Fetch from IPFS
            const response = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
            const pdfBlob = await response.blob();
            
            // Generate stamped version
            const stampedBlob = await this.generateStampedDocuments(caseData, pdfBlob);
            
            // Download
            const url = URL.createObjectURL(stampedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stamped-${caseData.caseNumber}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('Failed to export stamped documents:', error);
            alert('Failed to export stamped documents. Please try again.');
        }
    }
};

// Make available globally
window.proofOfService = window.proofOfService;