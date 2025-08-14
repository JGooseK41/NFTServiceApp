/**
 * COMPLETE RECEIPT FIX
 * Captures and displays all actual transaction data in receipts
 */

console.log('📋 Loading complete receipt fix...');

window.CompleteReceiptSystem = {
    
    // Store all transaction data
    transactionData: {
        txHash: null,
        alertId: null,
        documentId: null,
        ipfsHash: null,
        metadataURI: null,
        thumbnailHash: null,
        caseNumber: null,
        noticeType: null,
        recipients: [],
        energyUsed: 0,
        energyRental: null,
        fees: {},
        timestamp: null
    },
    
    // Capture data throughout the transaction process
    captureData(key, value) {
        this.transactionData[key] = value;
        console.log(`📝 Captured ${key}:`, value);
        
        // Also store in session
        sessionStorage.setItem('currentTransaction', JSON.stringify(this.transactionData));
    },
    
    // Generate comprehensive receipt
    generateFullReceipt(finalTxHash) {
        console.log('📋 Generating comprehensive receipt...');
        console.log('Transaction data collected:', this.transactionData);
        
        // Get the actual transaction hash or use the one provided
        const txHash = finalTxHash || this.transactionData.txHash;
        
        if (!txHash || txHash.includes('pending') || txHash.includes('temp')) {
            console.error('Invalid transaction hash for receipt:', txHash);
            return;
        }
        
        // Create receipt modal
        const modal = document.createElement('div');
        modal.id = 'comprehensive-receipt';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            z-index: 10001;
            max-width: 700px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
        `;
        
        // Calculate total cost
        let totalCost = 0;
        const serviceFee = (this.transactionData.fees.service || 2000000) / 1000000;
        totalCost += serviceFee;
        
        const energyRental = this.transactionData.energyRental;
        if (energyRental) {
            totalCost += energyRental.cost;
        }
        
        modal.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #00c851; margin: 0;">
                    ✅ Transaction Successful
                </h2>
                <p style="color: #666; margin: 10px 0 0 0;">Legal Notice Successfully Delivered</p>
            </div>
            
            <!-- Transaction Hash Section -->
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                    Transaction Hash:
                </h3>
                <div style="
                    font-family: monospace;
                    font-size: 12px;
                    word-break: break-all;
                    background: white;
                    padding: 10px;
                    border-radius: 5px;
                    border: 1px solid #dee2e6;
                    color: #000;
                ">
                    ${txHash}
                </div>
                <a href="https://tronscan.org/#/transaction/${txHash}" 
                   target="_blank" 
                   style="
                       display: inline-block;
                       margin-top: 10px;
                       color: #007bff;
                       text-decoration: none;
                       font-size: 14px;
                   ">
                    View on TronScan →
                </a>
            </div>
            
            <!-- Notice Details -->
            <div style="background: #fff; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Notice Details</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px; font-size: 14px;">
                    <div style="color: #666;">Date & Time:</div>
                    <div><strong>${new Date().toLocaleString()}</strong></div>
                    
                    <div style="color: #666;">Case Number:</div>
                    <div><strong>${this.transactionData.caseNumber || 'N/A'}</strong></div>
                    
                    <div style="color: #666;">Notice Type:</div>
                    <div><strong>${this.transactionData.noticeType || 'Legal Notice'}</strong></div>
                    
                    <div style="color: #666;">Recipients:</div>
                    <div><strong>${this.transactionData.recipients.length || 1}</strong></div>
                    
                    ${this.transactionData.alertId ? `
                        <div style="color: #666;">Alert NFT ID:</div>
                        <div><strong>#${this.transactionData.alertId}</strong></div>
                    ` : ''}
                    
                    ${this.transactionData.documentId ? `
                        <div style="color: #666;">Document NFT ID:</div>
                        <div><strong>#${this.transactionData.documentId}</strong></div>
                    ` : ''}
                </div>
            </div>
            
            <!-- IPFS Storage -->
            ${this.transactionData.ipfsHash ? `
            <div style="background: #f0f8ff; padding: 20px; border: 1px solid #b3d9ff; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #0066cc;">
                    📁 Document Storage
                </h3>
                
                <div style="font-size: 14px;">
                    <div style="margin-bottom: 10px;">
                        <span style="color: #666;">IPFS Hash:</span><br>
                        <code style="
                            display: block;
                            margin-top: 5px;
                            padding: 8px;
                            background: white;
                            border-radius: 4px;
                            font-size: 12px;
                            word-break: break-all;
                        ">${this.transactionData.ipfsHash}</code>
                    </div>
                    
                    ${this.transactionData.metadataURI ? `
                    <div style="margin-bottom: 10px;">
                        <span style="color: #666;">Metadata URI:</span><br>
                        <code style="
                            display: block;
                            margin-top: 5px;
                            padding: 8px;
                            background: white;
                            border-radius: 4px;
                            font-size: 12px;
                            word-break: break-all;
                        ">${this.transactionData.metadataURI}</code>
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            
            <!-- Cost Breakdown -->
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">
                    💰 Cost Breakdown
                </h3>
                
                <div style="font-size: 14px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Service Fee:</span>
                        <strong>${serviceFee} TRX</strong>
                    </div>
                    
                    ${energyRental ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>⚡ Energy Rental:</span>
                        <strong>${energyRental.cost} TRX</strong>
                    </div>
                    <div style="font-size: 12px; color: #666; margin-left: 20px; margin-bottom: 8px;">
                        ${energyRental.amount.toLocaleString()} energy units
                    </div>
                    ` : ''}
                    
                    <hr style="margin: 15px 0; border: none; border-top: 1px solid #dee2e6;">
                    
                    <div style="display: flex; justify-content: space-between; font-size: 18px;">
                        <span><strong>Total Cost:</strong></span>
                        <strong style="color: #00c851;">${totalCost.toFixed(2)} TRX</strong>
                    </div>
                </div>
            </div>
            
            <!-- Actions -->
            <div style="display: flex; gap: 10px;">
                <button onclick="CompleteReceiptSystem.downloadReceipt('${txHash}')" style="
                    flex: 1;
                    padding: 12px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">📥 Download Receipt</button>
                <button onclick="CompleteReceiptSystem.printReceipt()" style="
                    flex: 1;
                    padding: 12px;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">🖨️ Print</button>
                <button onclick="CompleteReceiptSystem.closeReceipt()" style="
                    flex: 1;
                    padding: 12px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">Close</button>
            </div>
        `;
        
        // Remove any existing receipt
        this.closeReceipt();
        
        // Add to page
        document.body.appendChild(modal);
    },
    
    // Download receipt
    downloadReceipt(txHash) {
        const data = this.transactionData;
        const receiptText = `
BLOCKCHAIN LEGAL SERVICE RECEIPT
=====================================
Transaction Hash: ${txHash}
Date & Time: ${new Date().toLocaleString()}
Network: TRON Mainnet

NOTICE DETAILS
--------------
Case Number: ${data.caseNumber || 'N/A'}
Notice Type: ${data.noticeType || 'Legal Notice'}
Recipients: ${data.recipients.length || 1}
Alert NFT ID: ${data.alertId || 'Pending'}
Document NFT ID: ${data.documentId || 'Pending'}

DOCUMENT STORAGE
----------------
IPFS Hash: ${data.ipfsHash || 'N/A'}
Metadata URI: ${data.metadataURI || 'N/A'}

COST BREAKDOWN
--------------
Service Fee: ${(data.fees.service || 2000000) / 1000000} TRX
Energy Rental: ${data.energyRental ? data.energyRental.cost + ' TRX' : 'N/A'}
Total Cost: ${this.calculateTotal()} TRX

BLOCKCHAIN VERIFICATION
-----------------------
View on TronScan:
https://tronscan.org/#/transaction/${txHash}

This receipt confirms your legal notice has been successfully
delivered via blockchain technology.
        `;
        
        const blob = new Blob([receiptText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `legal_notice_receipt_${data.caseNumber || txHash.substring(0, 8)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    // Print receipt
    printReceipt() {
        window.print();
    },
    
    // Close receipt
    closeReceipt() {
        const modal = document.getElementById('comprehensive-receipt');
        if (modal) {
            modal.remove();
        }
    },
    
    // Calculate total cost
    calculateTotal() {
        let total = (this.transactionData.fees.service || 2000000) / 1000000;
        if (this.transactionData.energyRental) {
            total += this.transactionData.energyRental.cost;
        }
        return total.toFixed(2);
    }
};

// Hook into various points to capture data
(function() {
    // Capture IPFS uploads
    const originalUploadToIPFS = window.SimpleEncryption?.uploadToIPFS;
    if (originalUploadToIPFS) {
        window.SimpleEncryption.uploadToIPFS = async function(data) {
            const result = await originalUploadToIPFS.call(this, data);
            CompleteReceiptSystem.captureData('ipfsHash', result);
            return result;
        };
    }
    
    // Capture metadata uploads
    const originalProcessDocument = window.IPFSIntegration?.processDocumentForNFT;
    if (originalProcessDocument) {
        window.IPFSIntegration.processDocumentForNFT = async function(...args) {
            const result = await originalProcessDocument.apply(this, args);
            if (result) {
                if (result.metadataURI) CompleteReceiptSystem.captureData('metadataURI', result.metadataURI);
                if (result.thumbnailHash) CompleteReceiptSystem.captureData('thumbnailHash', result.thumbnailHash);
            }
            return result;
        };
    }
    
    // Capture energy rental
    if (window.EnergyRentalTracker) {
        const originalRecord = window.EnergyRentalTracker.recordRental;
        window.EnergyRentalTracker.recordRental = function(amount, cost, txId) {
            originalRecord.call(this, amount, cost, txId);
            CompleteReceiptSystem.captureData('energyRental', { amount, cost, txId });
        };
    }
    
    // Capture transaction details from the form
    document.addEventListener('DOMContentLoaded', () => {
        // Monitor form submissions
        const form = document.querySelector('#noticeForm, form');
        if (form) {
            form.addEventListener('submit', (e) => {
                const formData = new FormData(form);
                CompleteReceiptSystem.captureData('caseNumber', formData.get('caseNumber'));
                CompleteReceiptSystem.captureData('noticeType', formData.get('noticeType'));
            });
        }
    });
})();

// Override transaction success handlers
(function() {
    // Monitor console logs for transaction hash
    const originalLog = console.log;
    console.log = function(...args) {
        originalLog.apply(console, args);
        
        // Look for transaction hash patterns
        const message = args.join(' ');
        if (message.includes('Transaction successful') || message.includes('TX:')) {
            const hashMatch = message.match(/[a-f0-9]{64}/i);
            if (hashMatch) {
                CompleteReceiptSystem.captureData('txHash', hashMatch[0]);
                
                // Generate receipt after a delay
                setTimeout(() => {
                    CompleteReceiptSystem.generateFullReceipt(hashMatch[0]);
                }, 3000);
            }
        }
        
        // Capture Alert and Document IDs
        if (message.includes('Alert ID:') || message.includes('alertId')) {
            const idMatch = message.match(/\d+/);
            if (idMatch) CompleteReceiptSystem.captureData('alertId', idMatch[0]);
        }
        
        if (message.includes('Document ID:') || message.includes('documentId')) {
            const idMatch = message.match(/\d+/);
            if (idMatch) CompleteReceiptSystem.captureData('documentId', idMatch[0]);
        }
    };
})();

console.log('✅ Complete receipt system loaded');
console.log('All transaction data will be captured and displayed in receipts');