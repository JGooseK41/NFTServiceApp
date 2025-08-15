/**
 * COURT-READY PROOF OF SERVICE GENERATOR
 * Creates legally compliant proof of service documents with blockchain verification
 */

console.log('⚖️ COURT-READY PROOF OF SERVICE SYSTEM');
console.log('=' .repeat(70));

window.CourtReadyProof = {
    
    async generateProofOfService(txData) {
        console.log('Generating court-ready proof of service...');
        
        try {
            // Get transaction details from blockchain
            const txInfo = await window.tronWeb.trx.getTransaction(txData.txHash);
            const block = await window.tronWeb.trx.getBlock(txInfo.blockNumber);
            
            // Get notice data
            const alertId = txData.alertId || txData.alertTokenId;
            const documentId = txData.documentId || txData.documentTokenId;
            
            // Get images from backend
            const images = await this.fetchNoticeImages(alertId);
            
            // Generate the proof document
            const proofHTML = this.createProofDocument({
                txHash: txData.txHash,
                blockNumber: txInfo.blockNumber,
                blockTimestamp: new Date(block.timestamp),
                alertId: alertId,
                documentId: documentId,
                recipientAddress: txData.recipientAddress,
                recipientName: txData.recipientName,
                caseNumber: txData.caseNumber,
                serverAddress: txData.serverAddress || window.tronWeb.defaultAddress.base58,
                serverName: txData.serverName || 'Process Server',
                agency: txData.issuingAgency || 'Legal Services',
                documentType: txData.documentType || 'Legal Notice',
                alertImage: images.alert,
                documentImage: images.document,
                networkFee: txData.networkFee || '2 TRX',
                energyCost: txData.energyCost || '30 TRX',
                totalCost: txData.totalCost || '32 TRX'
            });
            
            // Show in modal with print option
            this.showProofModal(proofHTML);
            
            return proofHTML;
            
        } catch (error) {
            console.error('Error generating proof:', error);
            return this.createBasicProof(txData);
        }
    },
    
    async fetchNoticeImages(noticeId) {
        try {
            const response = await fetch(`https://nftserviceapp.onrender.com/api/notices/${noticeId}/images`, {
                headers: {
                    'X-Wallet-Address': window.tronWeb.defaultAddress.base58,
                    'X-Server-Address': window.tronWeb.defaultAddress.base58
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return {
                    alert: data.alertImage,
                    document: data.documentImage
                };
            }
        } catch (error) {
            console.error('Error fetching images:', error);
        }
        
        return { alert: null, document: null };
    },
    
    createProofDocument(data) {
        const now = new Date();
        
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Proof of Service - ${data.caseNumber}</title>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none !important; }
            .page-break { page-break-after: always; }
        }
        
        body {
            font-family: 'Times New Roman', serif;
            line-height: 1.6;
            color: #000;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 0.5in;
            background: white;
        }
        
        .header {
            text-align: center;
            border-bottom: 3px double #000;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        h1 {
            font-size: 24px;
            margin: 0 0 10px 0;
            text-transform: uppercase;
        }
        
        .court-info {
            font-size: 14px;
            margin: 10px 0;
        }
        
        .section {
            margin: 30px 0;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            padding-bottom: 5px;
            margin-bottom: 15px;
        }
        
        .field {
            margin: 10px 0;
            display: flex;
            justify-content: space-between;
        }
        
        .field-label {
            font-weight: bold;
            min-width: 200px;
        }
        
        .field-value {
            flex: 1;
            text-align: right;
        }
        
        .blockchain-verify {
            background: #f0f0f0;
            border: 2px solid #000;
            padding: 20px;
            margin: 30px 0;
        }
        
        .signature-section {
            margin-top: 60px;
            border-top: 1px solid #000;
            padding-top: 20px;
        }
        
        .signature-line {
            border-bottom: 1px solid #000;
            width: 300px;
            margin: 40px 0 5px 0;
            display: inline-block;
        }
        
        .document-image {
            max-width: 100%;
            border: 1px solid #000;
            margin: 20px 0;
            page-break-inside: avoid;
        }
        
        .tx-stamp {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255, 0, 0, 0.1);
            border: 2px solid red;
            padding: 10px;
            transform: rotate(-15deg);
            font-weight: bold;
            color: red;
        }
        
        .cost-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        .cost-table td {
            padding: 8px;
            border-bottom: 1px solid #ccc;
        }
        
        .cost-table .total {
            font-weight: bold;
            font-size: 18px;
            border-top: 2px solid #000;
            border-bottom: 3px double #000;
        }
        
        .verification-qr {
            text-align: center;
            margin: 20px 0;
        }
        
        @page {
            size: letter;
            margin: 0.5in;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>PROOF OF SERVICE</h1>
        <div class="court-info">
            BLOCKCHAIN VERIFIED LEGAL NOTICE<br>
            TRON Network - Immutable Record
        </div>
    </div>
    
    <div class="section">
        <div class="section-title">Case Information</div>
        <div class="field">
            <span class="field-label">Case Number:</span>
            <span class="field-value">${data.caseNumber}</span>
        </div>
        <div class="field">
            <span class="field-label">Document Type:</span>
            <span class="field-value">${data.documentType}</span>
        </div>
        <div class="field">
            <span class="field-label">Issuing Agency:</span>
            <span class="field-value">${data.agency}</span>
        </div>
    </div>
    
    <div class="section">
        <div class="section-title">Service Details</div>
        <div class="field">
            <span class="field-label">Date of Service:</span>
            <span class="field-value">${data.blockTimestamp.toLocaleString()}</span>
        </div>
        <div class="field">
            <span class="field-label">Recipient Name:</span>
            <span class="field-value">${data.recipientName}</span>
        </div>
        <div class="field">
            <span class="field-label">Recipient Address:</span>
            <span class="field-value" style="font-family: monospace; font-size: 12px;">
                ${data.recipientAddress}
            </span>
        </div>
        <div class="field">
            <span class="field-label">Process Server:</span>
            <span class="field-value">${data.serverName}</span>
        </div>
        <div class="field">
            <span class="field-label">Server Wallet:</span>
            <span class="field-value" style="font-family: monospace; font-size: 12px;">
                ${data.serverAddress}
            </span>
        </div>
    </div>
    
    <div class="blockchain-verify">
        <div class="section-title">BLOCKCHAIN VERIFICATION</div>
        <div class="field">
            <span class="field-label">Transaction Hash:</span>
            <span class="field-value" style="font-family: monospace; font-size: 11px; word-break: break-all;">
                ${data.txHash}
            </span>
        </div>
        <div class="field">
            <span class="field-label">Block Number:</span>
            <span class="field-value">${data.blockNumber}</span>
        </div>
        <div class="field">
            <span class="field-label">Alert Token ID:</span>
            <span class="field-value">#${data.alertId}</span>
        </div>
        <div class="field">
            <span class="field-label">Document Token ID:</span>
            <span class="field-value">#${data.documentId}</span>
        </div>
        <div style="margin-top: 15px; font-size: 12px;">
            <strong>Verify on TronScan:</strong><br>
            https://tronscan.org/#/transaction/${data.txHash}
        </div>
    </div>
    
    <div class="section">
        <div class="section-title">Service Costs</div>
        <table class="cost-table">
            <tr>
                <td>Network Transaction Fee:</td>
                <td style="text-align: right;">${data.networkFee}</td>
            </tr>
            <tr>
                <td>Energy Rental Cost:</td>
                <td style="text-align: right;">${data.energyCost}</td>
            </tr>
            <tr class="total">
                <td>TOTAL COST:</td>
                <td style="text-align: right;">${data.totalCost}</td>
            </tr>
        </table>
    </div>
    
    ${data.alertImage ? `
    <div class="page-break"></div>
    <div class="section">
        <div class="section-title">Alert Notice Image</div>
        <div style="position: relative;">
            <div class="tx-stamp">TX: ${data.txHash.substring(0, 16)}...</div>
            <img src="${data.alertImage}" class="document-image" />
        </div>
        <div style="text-align: center; margin-top: 10px;">
            Alert Token #${data.alertId} - Immutably Recorded on Blockchain
        </div>
    </div>
    ` : ''}
    
    ${data.documentImage ? `
    <div class="page-break"></div>
    <div class="section">
        <div class="section-title">Legal Document Image</div>
        <div style="position: relative;">
            <div class="tx-stamp">TX: ${data.txHash.substring(0, 16)}...</div>
            <img src="${data.documentImage}" class="document-image" />
        </div>
        <div style="text-align: center; margin-top: 10px;">
            Document Token #${data.documentId} - Cryptographically Secured
        </div>
    </div>
    ` : ''}
    
    <div class="signature-section">
        <div class="section-title">Certification</div>
        <p>
            I hereby certify under penalty of perjury that the above information is true and correct,
            and that service was completed as indicated. This document was generated from immutable
            blockchain records on the TRON network.
        </p>
        
        <div style="margin-top: 40px;">
            <div class="signature-line"></div>
            <div>Process Server Signature</div>
        </div>
        
        <div style="margin-top: 20px;">
            <div class="signature-line"></div>
            <div>Date</div>
        </div>
        
        <div style="margin-top: 30px; font-size: 12px; color: #666;">
            Document Generated: ${now.toLocaleString()}<br>
            Blockchain Network: TRON<br>
            Smart Contract: TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb<br>
            This is an official blockchain-verified proof of service document.
        </div>
    </div>
</body>
</html>
        `;
    },
    
    createBasicProof(txData) {
        // Fallback basic proof
        return `
            <h2>Proof of Service</h2>
            <p>Transaction Hash: ${txData.txHash}</p>
            <p>Case Number: ${txData.caseNumber}</p>
            <p>Recipient: ${txData.recipientName}</p>
            <p>Date: ${new Date().toLocaleString()}</p>
        `;
    },
    
    showProofModal(proofHTML) {
        // Remove existing modal
        const existing = document.getElementById('proofModal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'proofModal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                        background: rgba(0,0,0,0.9); z-index: 10001;">
                <div style="position: absolute; top: 20px; right: 20px; left: 20px; bottom: 20px; 
                            background: white; overflow: auto; border-radius: 10px;">
                    
                    <div class="no-print" style="position: sticky; top: 0; background: #1a1a2e; 
                                color: white; padding: 20px; display: flex; 
                                justify-content: space-between; align-items: center; z-index: 100;">
                        <h2 style="margin: 0;">Court-Ready Proof of Service</h2>
                        <div>
                            <button onclick="CourtReadyProof.print()" 
                                    style="background: #00ff88; color: #1a1a2e; border: none; 
                                           padding: 10px 20px; border-radius: 5px; margin-right: 10px; 
                                           cursor: pointer; font-weight: bold;">
                                🖨️ Print Document
                            </button>
                            <button onclick="CourtReadyProof.download()" 
                                    style="background: #00ccff; color: #1a1a2e; border: none; 
                                           padding: 10px 20px; border-radius: 5px; margin-right: 10px; 
                                           cursor: pointer; font-weight: bold;">
                                💾 Download PDF
                            </button>
                            <button onclick="document.getElementById('proofModal').remove()" 
                                    style="background: #ff4444; color: white; border: none; 
                                           padding: 10px 20px; border-radius: 5px; 
                                           cursor: pointer; font-weight: bold;">
                                ✕ Close
                            </button>
                        </div>
                    </div>
                    
                    <div id="proofContent" style="padding: 20px;">
                        ${proofHTML}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    print() {
        const content = document.getElementById('proofContent').innerHTML;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
    },
    
    download() {
        // Generate filename
        const filename = `Proof_of_Service_${new Date().getTime()}.html`;
        const content = document.getElementById('proofContent').innerHTML;
        
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// Auto-generate proof after successful transaction
window.addEventListener('transactionSuccess', (event) => {
    if (event.detail && event.detail.txHash) {
        setTimeout(() => {
            CourtReadyProof.generateProofOfService(event.detail);
        }, 3000);
    }
});

console.log('✅ Court-ready proof system initialized!');