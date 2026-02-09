// Receipts Module - Handles service receipts generation and viewing

// HTML escape helper to prevent XSS
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

window.receipts = {

    // Initialize module
    async init() {
        console.log('Initializing receipts module...');
    },

    // Add a new receipt to storage
    addReceipt(receipt) {
        if (!receipt) return;
        try {
            let receipts = JSON.parse(localStorage.getItem('legalnotice_receipts') || '[]');
            // Avoid duplicates
            const exists = receipts.some(r => r.receiptId === receipt.receiptId);
            if (!exists) {
                receipts.push(receipt);
                // Limit to 50 receipts to avoid quota issues
                if (receipts.length > 50) {
                    receipts = receipts.slice(-50);
                }
                try {
                    localStorage.setItem('legalnotice_receipts', JSON.stringify(receipts));
                    console.log('Receipt added:', receipt.receiptId);
                } catch (quotaError) {
                    if (quotaError.name === 'QuotaExceededError' || quotaError.code === 22) {
                        // Aggressively trim and retry
                        receipts = receipts.slice(-25);
                        localStorage.setItem('legalnotice_receipts', JSON.stringify(receipts));
                        console.warn('LocalStorage quota exceeded, trimmed receipts to 25');
                    }
                }
            }
        } catch (error) {
            console.error('Failed to add receipt:', error);
        }
    },

    // Load and display receipts (filtered by connected wallet)
    async loadReceipts() {
        const allReceipts = window.storage.getReceipts();
        const connectedWallet = window.wallet?.address?.toLowerCase() || '';
        const receipts = connectedWallet
            ? allReceipts.filter(r => {
                const w = (r.serverAddress || r.server_address || '').toLowerCase();
                return w === connectedWallet;
            })
            : [];
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
        
        container.innerHTML = receipts.map(receipt => {
            const safeReceiptId = escapeAttr(receipt.receiptId);
            return `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <h6 class="card-title">Receipt: ${escapeHtml(receipt.receiptId)}</h6>
                        <p class="small mb-1"><strong>Case:</strong> ${escapeHtml(receipt.caseNumber)}</p>
                        <p class="small mb-1"><strong>Type:</strong> ${escapeHtml(receipt.type)}</p>
                        <p class="small mb-1"><strong>Recipient${receipt.recipients?.length > 1 ? 's' : ''}:</strong> ${receipt.recipients?.length > 1 ? escapeHtml(receipt.recipients.length + ' recipients') : escapeHtml(this.formatAddress(receipt.recipients?.[0]?.address || receipt.recipients?.[0] || receipt.recipient))}</p>
                        <p class="small mb-1"><strong>Date:</strong> ${new Date(receipt.timestamp).toLocaleString()}</p>

                        <div class="mt-3">
                            <button class="btn btn-sm btn-primary w-100 mb-2"
                                    onclick="receipts.viewReceipt('${safeReceiptId}')">
                                View Receipt
                            </button>
                            <button class="btn btn-sm btn-secondary w-100"
                                    onclick="receipts.downloadReceipt('${safeReceiptId}')">
                                Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `}).join('');
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
    
    // Format date in UTC
    formatDateUTC(dateInput) {
        if (!dateInput) return 'N/A';
        const date = new Date(dateInput);
        return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
    },

    // Get registered server name from backend or localStorage
    async getServerName(walletAddress) {
        if (!walletAddress) return 'N/A';

        // Try to get from window.app state first
        if (window.app?.state?.serverName) {
            return window.app.state.serverName;
        }

        // Try localStorage
        try {
            const serverRegistrations = JSON.parse(localStorage.getItem('serverRegistrations') || '{}');
            const registration = serverRegistrations[walletAddress];
            if (registration?.agency_name) {
                return registration.agency_name;
            }
        } catch (e) {
            console.log('Could not get server name from localStorage');
        }

        // Fall back to wallet address (truncated)
        return `${walletAddress.substring(0, 8)}...${walletAddress.substring(walletAddress.length - 6)}`;
    },

    // Generate receipt HTML
    generateReceiptHTML(receipt) {
        // Handle different field name variations
        const recipientList = receipt.recipients ||
                             (receipt.recipient ? [receipt.recipient] : [receipt.recipient_address || 'N/A']);
        const recipientAddrs = recipientList.map(r => typeof r === 'object' ? r.address : r);

        const txHash = receipt.txId ||
                      receipt.transactionHash ||
                      receipt.transaction_hash ||
                      receipt.alertTxId ||
                      'N/A';

        const chainInfo = window.getChainInfo ? window.getChainInfo() : null;
        const networkName = chainInfo?.name || 'TRON';
        const explorerUrl = window.getExplorerTxUrl ? window.getExplorerTxUrl(txHash) :
                           `https://tronscan.org/#/transaction/${txHash}`;

        // Get server name (use agency name if registered, else truncated address)
        const serverName = receipt.serverName || receipt.agencyName ||
                          window.app?.state?.serverName ||
                          this.formatAddress(receipt.serverAddress || receipt.serverId);

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
                                <strong>Receipt ID:</strong> ${receipt.receiptId || 'N/A'}
                            </td>
                            <td style="width: 50%; padding: 5px;">
                                <strong>Date Served:</strong> ${this.formatDateUTC(receipt.timestamp)}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 5px;">
                                <strong>Case Number:</strong> ${receipt.caseNumber || 'N/A'}
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
                                <strong>Served To:</strong> ${recipientAddrs.length > 1 ? `(${recipientAddrs.length} recipients)` : ''}<br>
                                ${recipientAddrs.map((addr, i) => `${addr}${i < recipientAddrs.length - 1 ? '<br>' : ''}`).join('')}
                                <br><small>(TRON Wallet Address${recipientAddrs.length > 1 ? 'es' : ''})</small>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 5px;">
                                <strong>Process Server:</strong> ${serverName}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 5px;">
                                <strong>Server Wallet:</strong> ${receipt.serverAddress || receipt.serverId || 'N/A'}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 5px;">
                                <strong>Notice ID:</strong> ${receipt.noticeId || 'N/A'}
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
                                <code style="font-size: 12px; word-break: break-all;">${txHash}</code>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 5px;">
                                <strong>Blockchain:</strong> ${networkName}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 5px;">
                                <strong>Verification URL:</strong><br>
                                <a href="${explorerUrl}" target="_blank" style="font-size: 12px;">
                                    ${explorerUrl}
                                </a>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Financial Summary for Government Documentation -->
                <div style="margin-bottom: 30px;">
                    <h4 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">EXPENDITURE SUMMARY</h4>
                    <p style="font-size: 12px; color: #666; margin-top: 5px;">
                        For government accounting and documentation purposes
                    </p>
                    <table style="width: 100%; font-size: 14px; margin-top: 10px; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">Service Fee (Platform)</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">
                                ${receipt.serviceFee || receipt.feeBreakdown?.serviceFee || 'N/A'} TRX
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">Recipient Sponsorship</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">
                                ${receipt.recipientFunding || receipt.feeBreakdown?.recipientFunding || 'N/A'} TRX
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">Network Fee (Estimated)</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">
                                ${receipt.networkFee || receipt.feeBreakdown?.networkFee || '~5'} TRX
                            </td>
                        </tr>
                        <tr style="font-weight: bold; background-color: #f8f9fa;">
                            <td style="padding: 8px;">TOTAL EXPENDITURE</td>
                            <td style="padding: 8px; text-align: right;">
                                ${receipt.totalCost || receipt.feeBreakdown?.totalPaymentTRX || 'N/A'} TRX
                            </td>
                        </tr>
                    </table>
                    <p style="font-size: 11px; color: #888; margin-top: 10px;">
                        * Service Fee: Fee paid to BlockServed.com for blockchain service processing<br>
                        * Recipient Sponsorship: TRX sent to recipient's wallet to cover their signing transaction<br>
                        * Network Fee: TRON blockchain energy/bandwidth consumed (may vary)
                    </p>
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
                        <strong>${receipt.accessUrl || 'https://blockserved.com'}</strong>
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
                        <p style="font-size: 12px; margin: 5px 0;">Process Server: ${serverName}</p>
                        <p style="font-size: 12px; margin: 5px 0;">Wallet: ${receipt.serverAddress || receipt.serverId || 'N/A'}</p>
                        <p style="font-size: 12px; margin: 0;">Generated: ${this.formatDateUTC(receipt.generatedAt)}</p>
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
        
        doc.text(`NFT Token ID: #${alertTokenId || 'N/A'}`, 20, y);
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