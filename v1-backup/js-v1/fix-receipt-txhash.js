/**
 * FIX RECEIPT TRANSACTION HASH
 * Ensures the correct transaction hash appears in receipts
 */

console.log('🔧 Fixing receipt transaction hash...');

window.TransactionReceiptFix = {
    
    // Store the actual transaction hash
    lastTransactionHash: null,
    lastTransactionData: null,
    
    // Capture transaction results
    captureTransaction(txHash, data) {
        console.log('📝 Captured transaction hash:', txHash);
        this.lastTransactionHash = txHash;
        this.lastTransactionData = data;
        
        // Store in session for recovery
        sessionStorage.setItem('lastTransactionHash', txHash);
        sessionStorage.setItem('lastTransactionData', JSON.stringify(data));
    },
    
    // Get the correct hash
    getCorrectHash() {
        return this.lastTransactionHash || sessionStorage.getItem('lastTransactionHash');
    },
    
    // Generate proper receipt
    generateReceipt(txHash, details) {
        const receiptData = {
            transactionHash: txHash || this.getCorrectHash(),
            timestamp: new Date().toISOString(),
            ...details
        };
        
        // Create receipt HTML
        const receiptHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                z-index: 10000;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <h2 style="color: #00c851; margin: 0 0 20px 0;">
                    ✅ Transaction Successful
                </h2>
                
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                        Transaction Hash:
                    </h3>
                    <div style="
                        font-family: monospace;
                        font-size: 12px;
                        word-break: break-all;
                        background: white;
                        padding: 10px;
                        border-radius: 3px;
                        border: 1px solid #ddd;
                    ">
                        ${receiptData.transactionHash}
                    </div>
                    <a href="https://tronscan.org/#/transaction/${receiptData.transactionHash}" 
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
                
                <div id="receipt-details" style="margin-bottom: 20px;">
                    <!-- Details will be added here -->
                </div>
                
                <div id="receipt-costs" style="
                    background: #f9f9f9;
                    padding: 15px;
                    border-radius: 5px;
                    margin-bottom: 20px;
                ">
                    <h3 style="margin: 0 0 10px 0; font-size: 16px;">Cost Breakdown:</h3>
                    <!-- Costs will be added here -->
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="TransactionReceiptFix.downloadReceipt('${receiptData.transactionHash}')" style="
                        flex: 1;
                        padding: 12px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-weight: bold;
                    ">📥 Download Receipt</button>
                    <button onclick="TransactionReceiptFix.closeReceipt()" style="
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
            </div>
        `;
        
        // Remove any existing receipt
        this.closeReceipt();
        
        // Add to page
        const receiptDiv = document.createElement('div');
        receiptDiv.id = 'transaction-receipt-modal';
        receiptDiv.innerHTML = receiptHTML;
        document.body.appendChild(receiptDiv);
        
        // Add details
        this.addReceiptDetails(details);
        
        return receiptData;
    },
    
    // Add receipt details
    addReceiptDetails(details) {
        const detailsDiv = document.getElementById('receipt-details');
        const costsDiv = document.getElementById('receipt-costs');
        
        if (detailsDiv && details) {
            let detailsHTML = '';
            
            if (details.caseNumber) {
                detailsHTML += `
                    <div style="margin-bottom: 10px;">
                        <strong>Case Number:</strong> ${details.caseNumber}
                    </div>
                `;
            }
            
            if (details.recipients) {
                detailsHTML += `
                    <div style="margin-bottom: 10px;">
                        <strong>Recipients:</strong> ${details.recipients.length || details.recipients}
                    </div>
                `;
            }
            
            if (details.noticeType) {
                detailsHTML += `
                    <div style="margin-bottom: 10px;">
                        <strong>Notice Type:</strong> ${details.noticeType}
                    </div>
                `;
            }
            
            detailsDiv.innerHTML = detailsHTML;
        }
        
        if (costsDiv) {
            let totalCost = 0;
            let costsHTML = '';
            
            // Add service fee
            if (details.serviceFee) {
                const fee = details.serviceFee / 1000000;
                totalCost += fee;
                costsHTML += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Service Fee:</span>
                        <strong>${fee} TRX</strong>
                    </div>
                `;
            }
            
            // Add energy rental if present
            const rental = window.EnergyRentalTracker?.getLastRental();
            if (rental) {
                totalCost += rental.cost;
                costsHTML += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>⚡ Energy Rental:</span>
                        <strong>${rental.cost} TRX</strong>
                    </div>
                    <div style="font-size: 12px; color: #666; margin-left: 20px; margin-bottom: 5px;">
                        ${rental.amount.toLocaleString()} energy units
                    </div>
                `;
            }
            
            // Add total
            costsHTML += `
                <hr style="margin: 10px 0;">
                <div style="display: flex; justify-content: space-between; font-size: 18px;">
                    <span><strong>Total Cost:</strong></span>
                    <strong style="color: #00c851;">${totalCost.toFixed(2)} TRX</strong>
                </div>
            `;
            
            costsDiv.innerHTML += costsHTML;
        }
    },
    
    // Download receipt
    downloadReceipt(txHash) {
        const receiptText = `
BLOCKCHAIN LEGAL SERVICE RECEIPT
================================
Transaction Hash: ${txHash}
Date: ${new Date().toLocaleString()}
Service: Legal Notice Delivery

View on Blockchain:
https://tronscan.org/#/transaction/${txHash}

This receipt confirms your legal notice has been delivered via blockchain.
        `;
        
        const blob = new Blob([receiptText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt_${txHash.substring(0, 8)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    // Close receipt
    closeReceipt() {
        const modal = document.getElementById('transaction-receipt-modal');
        if (modal) {
            modal.remove();
        }
    }
};

// Hook into transaction success
(function() {
    // Monitor for successful transactions
    const originalSend = window.legalContract?.serveNotice;
    if (originalSend) {
        const wrappedSend = window.legalContract.serveNotice;
        window.legalContract.serveNotice = function(...args) {
            const result = wrappedSend.apply(this, args);
            const originalSendMethod = result.send;
            
            result.send = async function(options) {
                try {
                    const txHash = await originalSendMethod.call(this, options);
                    
                    // Capture the hash
                    TransactionReceiptFix.captureTransaction(txHash, {
                        ...args[0],
                        serviceFee: options.callValue
                    });
                    
                    // Generate receipt
                    setTimeout(() => {
                        TransactionReceiptFix.generateReceipt(txHash, {
                            ...args[0],
                            serviceFee: options.callValue
                        });
                    }, 2000);
                    
                    return txHash;
                } catch (error) {
                    throw error;
                }
            };
            
            return result;
        };
    }
    
    // Same for batch
    const originalBatch = window.legalContract?.serveNoticeBatch;
    if (originalBatch) {
        const wrappedBatch = window.legalContract.serveNoticeBatch;
        window.legalContract.serveNoticeBatch = function(batchNotices) {
            const result = wrappedBatch.call(this, batchNotices);
            const originalSendMethod = result.send;
            
            result.send = async function(options) {
                try {
                    const txHash = await originalSendMethod.call(this, options);
                    
                    // Capture the hash
                    TransactionReceiptFix.captureTransaction(txHash, {
                        recipients: batchNotices,
                        serviceFee: options.callValue
                    });
                    
                    // Generate receipt
                    setTimeout(() => {
                        TransactionReceiptFix.generateReceipt(txHash, {
                            recipients: batchNotices,
                            serviceFee: options.callValue
                        });
                    }, 2000);
                    
                    return txHash;
                } catch (error) {
                    throw error;
                }
            };
            
            return result;
        };
    }
})();

console.log('✅ Receipt transaction hash fix loaded');
console.log('Receipts will now show the correct transaction hash');