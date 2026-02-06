// Receipts Module - Handles service receipts generation and viewing
window.receipts = {
    
    // Initialize module
    async init() {
        console.log('Initializing receipts module...');
    },

    // Add a new receipt to storage
    addReceipt(receipt) {
        if (!receipt) return;
        try {
            const receipts = JSON.parse(localStorage.getItem('legalnotice_receipts') || '[]');
            // Avoid duplicates
            const exists = receipts.some(r => r.receiptId === receipt.receiptId);
            if (!exists) {
                receipts.push(receipt);
                localStorage.setItem('legalnotice_receipts', JSON.stringify(receipts));
                console.log('Receipt added:', receipt.receiptId);
            }
        } catch (error) {
            console.error('Failed to add receipt:', error);
        }
    },

    // Load and display receipts
    async loadReceipts() {
        const receipts = window.storage.getReceipts();
        this.displayReceipts(receipts);
    },
    
    // Display receipts
    displayReceipts(receipts) {
        const container = document.getElementById('receiptsList');
        if (!container) return;
        
        if (receipts.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center text-muted">
                    <p>No receipts found. Receipts will appear here after serving notices.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = receipts.map(receipt => `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <h6 class="card-title">Receipt: ${receipt.receiptId}</h6>
                        <p class="small mb-1"><strong>Case:</strong> ${receipt.caseNumber}</p>
                        <p class="small mb-1"><strong>Type:</strong> ${receipt.type}</p>
                        <p class="small mb-1"><strong>Recipient:</strong> ${this.formatAddress(receipt.recipient)}</p>
                        <p class="small mb-1"><strong>Date:</strong> ${new Date(receipt.timestamp).toLocaleString()}</p>
                        
                        <div class="mt-3">
                            <button class="btn btn-sm btn-primary w-100 mb-2" 
                                    onclick="receipts.viewReceipt('${receipt.receiptId}')">
                                View Receipt
                            </button>
                            <button class="btn btn-sm btn-secondary w-100" 
                                    onclick="receipts.downloadReceipt('${receipt.receiptId}')">
                                Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    },
    
    // View receipt details
    viewReceipt(receiptId) {
        const receipts = window.storage.getReceipts();
        const receipt = receipts.find(r => r.receiptId === receiptId);
        
        if (!receipt) {
            window.app.showError('Receipt not found');
            return;
        }
        
        this.displayReceiptModal(receipt);
    },
    
    // Display receipt modal
    displayReceiptModal(receipt) {
        const modalHtml = `
            <div class="modal fade" id="receiptModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Proof of Service Receipt</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="receiptContent">
                            ${this.generateReceiptHTML(receipt)}
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-primary" onclick="receipts.printReceipt()">
                                Print
                            </button>
                            <button class="btn btn-success" onclick="receipts.downloadReceipt('${receipt.receiptId}')">
                                Download PDF
                            </button>
                            <button class="btn btn-info" onclick="window.open('${receipt.verificationUrl}')">
                                Verify on TronScan
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('receiptModal'));
        modal.show();
        
        // Clean up on close
        document.getElementById('receiptModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },
    
    // Generate receipt HTML
    generateReceiptHTML(receipt) {
        return `
            <div class="receipt-document" style="padding: 20px; font-family: 'Times New Roman', serif;">
                <!-- Header -->
                <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px;">
                    <h2 style="margin: 0; font-size: 24px;">PROOF OF SERVICE</h2>
                    <p style="margin: 10px 0 0 0; font-size: 14px;">Blockchain-Verified Legal Notice Delivery</p>
                </div>
                
                <!-- Receipt Info -->
                <div style="margin-bottom: 30px;">
                    <table style="width: 100%; font-size: 14px;">
                        <tr>
                            <td style="width: 50%; padding: 5px;">
                                <strong>Receipt ID:</strong> ${receipt.receiptId}
                            </td>
                            <td style="width: 50%; padding: 5px;">
                                <strong>Date Served:</strong> ${new Date(receipt.timestamp).toLocaleString()}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 5px;">
                                <strong>Case Number:</strong> ${receipt.caseNumber}
                            </td>
                            <td style="padding: 5px;">
                                <strong>Notice Type:</strong> ${receipt.type === 'alert' ? 'Alert Notice' : 'Document for Signature'}
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Service Details -->
                <div style="margin-bottom: 30px;">
                    <h4 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">SERVICE DETAILS</h4>
                    <table style="width: 100%; font-size: 14px; margin-top: 10px;">
                        <tr>
                            <td style="padding: 5px;">
                                <strong>Served To:</strong><br>
                                ${receipt.recipient}<br>
                                <small>(TRON Wallet Address)</small>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 5px;">
                                <strong>Process Server ID:</strong> ${receipt.serverId}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 5px;">
                                <strong>Notice ID:</strong> ${receipt.noticeId}
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Blockchain Verification -->
                <div style="margin-bottom: 30px;">
                    <h4 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">BLOCKCHAIN VERIFICATION</h4>
                    <table style="width: 100%; font-size: 14px; margin-top: 10px;">
                        <tr>
                            <td style="padding: 5px;">
                                <strong>Transaction Hash:</strong><br>
                                <code style="font-size: 12px; word-break: break-all;">${receipt.txId}</code>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 5px;">
                                <strong>Blockchain:</strong> TRON Mainnet
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 5px;">
                                <strong>Verification URL:</strong><br>
                                <a href="${receipt.verificationUrl}" target="_blank" style="font-size: 12px;">
                                    ${receipt.verificationUrl}
                                </a>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Thumbnail Preview -->
                ${receipt.thumbnail ? `
                    <div style="margin-bottom: 30px;">
                        <h4 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">DOCUMENT PREVIEW</h4>
                        <div style="text-align: center; margin-top: 10px;">
                            <img src="${receipt.thumbnail}" style="max-width: 300px; border: 1px solid #ccc;">
                        </div>
                    </div>
                ` : ''}
                
                <!-- Access Information -->
                <div style="margin-bottom: 30px;">
                    <h4 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">RECIPIENT ACCESS</h4>
                    <p style="font-size: 14px; margin-top: 10px;">
                        The recipient can view and respond to this notice at:<br>
                        <strong>${receipt.accessUrl}</strong>
                    </p>
                </div>
                
                <!-- Legal Certification -->
                <div style="border-top: 2px solid #000; padding-top: 20px; margin-top: 30px;">
                    <h4>CERTIFICATION</h4>
                    <p style="font-size: 14px; line-height: 1.6;">
                        I hereby certify that the above-described legal notice was served via blockchain technology
                        on the date and time indicated. This service has been recorded immutably on the TRON blockchain
                        and can be independently verified using the transaction hash provided above.
                    </p>
                    
                    <div style="margin-top: 30px;">
                        <div style="border-bottom: 1px solid #000; width: 300px; margin-bottom: 5px;"></div>
                        <p style="font-size: 14px; margin: 0;">Digital Signature</p>
                        <p style="font-size: 12px; margin: 5px 0;">Server ID: ${receipt.serverId}</p>
                        <p style="font-size: 12px; margin: 0;">Generated: ${new Date(receipt.generatedAt).toLocaleString()}</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Print receipt
    printReceipt() {
        const content = document.getElementById('receiptContent').innerHTML;
        const printWindow = window.open('', '', 'width=800,height=600');
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Proof of Service Receipt</title>
                <style>
                    @media print {
                        body { margin: 0; }
                        .receipt-document { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                ${content}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.print();
    },
    
    // Download receipt as PDF
    async downloadReceiptPDF(caseNumber) {
        try {
            // Fetch case data
            const backendUrl = window.app.getBackendUrl();
            const response = await fetch(`${backendUrl}/api/cases/${caseNumber}/service-data`);
            
            let caseData;
            if (response.ok) {
                const data = await response.json();
                caseData = data.case;
            } else {
                // Fallback to localStorage
                const localCases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
                caseData = localCases.find(c => 
                    c.caseNumber === caseNumber || c.case_number === caseNumber
                );
            }
            
            if (!caseData) {
                window.app.showError('Case not found');
                return;
            }
        
        // Load jsPDF if not already loaded
        await this.loadJSPDF();
        
        // Create PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add content
        doc.setFontSize(20);
        doc.text('PROOF OF SERVICE', 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text('Blockchain-Verified Legal Notice Delivery', 105, 30, { align: 'center' });
        
        // Add receipt details
        let y = 50;
        doc.setFontSize(10);
        
        const txHash = caseData.transactionHash || caseData.transaction_hash;
        const alertTokenId = caseData.alertTokenId || caseData.alert_token_id;
        const documentTokenId = caseData.documentTokenId || caseData.document_token_id;
        const servedAt = caseData.servedAt || caseData.served_at;
        const serverAddress = caseData.serverAddress || caseData.server_address;
        const recipients = caseData.recipients || [];
        
        doc.text(`Case Number: ${caseNumber}`, 20, y);
        y += 10;
        
        doc.text(`Date Served: ${servedAt ? new Date(servedAt).toLocaleString() : 'N/A'}`, 20, y);
        y += 10;
        
        doc.text(`Alert NFT Token ID: #${alertTokenId || 'N/A'}`, 20, y);
        y += 10;
        
        doc.text(`Document NFT Token ID: #${documentTokenId || 'N/A'}`, 20, y);
        y += 15;
        
        doc.setFontSize(12);
        doc.text('SERVICE DETAILS', 20, y);
        y += 10;
        
        doc.setFontSize(10);
        doc.text(`Served To: ${recipients.length} recipient(s)`, 20, y);
        y += 10;
        
        doc.text(`Process Server: ${serverAddress || 'N/A'}`, 20, y);
        y += 10;
        
        doc.text(`Transaction Hash:`, 20, y);
        y += 15;
        
        doc.setFontSize(12);
        doc.text('BLOCKCHAIN VERIFICATION', 20, y);
        y += 10;
        
        doc.setFontSize(10);
        doc.text(`Transaction Hash:`, 20, y);
        y += 7;
        doc.setFontSize(8);
        doc.text(txHash || 'N/A', 20, y);
        y += 10;
        
        doc.setFontSize(10);
        doc.text(`Verification URL: https://tronscan.org/#/transaction/${txHash}`, 20, y);
        
        // Save PDF
        doc.save(`receipt_case_${caseNumber}.pdf`);
        
        } catch (error) {
            console.error('Error downloading receipt PDF:', error);
            window.app.showError('Failed to generate PDF: ' + error.message);
        }
    },
    
    // Load jsPDF library
    async loadJSPDF() {
        return new Promise((resolve) => {
            if (window.jspdf) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    },
    
    // Format address
    formatAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
};

console.log('Receipts module loaded');