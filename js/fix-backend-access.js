/**
 * FIX BACKEND ACCESS ISSUES
 * Fixes 401 errors and ensures proper authentication headers
 */

console.log('🔐 FIXING BACKEND ACCESS');
console.log('=' .repeat(70));

// Override fetch to always include proper headers
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
    // Only modify requests to our backend
    if (url.includes('nftserviceapp.onrender.com')) {
        options.headers = options.headers || {};
        
        // Always include wallet address
        const walletAddress = window.tronWeb?.defaultAddress?.base58;
        if (walletAddress) {
            options.headers['X-Wallet-Address'] = walletAddress;
            options.headers['X-Server-Address'] = walletAddress;
            
            // If accessing as recipient, also include recipient header
            if (window.isRecipientView) {
                options.headers['X-Recipient-Address'] = walletAddress;
            }
        }
        
        // Add content type if not present
        if (!options.headers['Content-Type'] && options.method === 'POST') {
            options.headers['Content-Type'] = 'application/json';
        }
    }
    
    return originalFetch(url, options);
};

// Fix recipient document viewing
window.FixRecipientAccess = {
    
    async viewDocument(noticeId, documentId) {
        console.log(`Attempting to view document ${documentId} for notice ${noticeId}`);
        
        try {
            // First check if already signed
            const signStatus = await this.checkSignatureStatus(documentId);
            
            if (!signStatus.signed) {
                // Show document for signing
                await this.showDocumentForSigning(noticeId, documentId);
            } else {
                // Already signed, show download option
                await this.showSignedDocument(noticeId, documentId, signStatus.signature);
            }
            
        } catch (error) {
            console.error('Error viewing document:', error);
            alert('Error accessing document. Please try again.');
        }
    },
    
    async checkSignatureStatus(documentId) {
        try {
            // Check blockchain for signature
            const contract = await window.tronWeb.contract().at('TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb');
            const walletAddress = window.tronWeb.defaultAddress.base58;
            
            // Try to get acceptance status
            const accepted = await contract.documentAcceptances(documentId, walletAddress).call();
            
            return {
                signed: accepted,
                signature: accepted ? `Signed by ${walletAddress}` : null
            };
        } catch (error) {
            console.log('No signature found');
            return { signed: false, signature: null };
        }
    },
    
    async showDocumentForSigning(noticeId, documentId) {
        // Get document image
        const response = await fetch(`https://nftserviceapp.onrender.com/api/notices/${noticeId}/images`);
        const data = await response.json();
        
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                        background: rgba(0,0,0,0.9); z-index: 10000; overflow: auto;">
                <div style="max-width: 800px; margin: 50px auto; background: white; 
                            border-radius: 10px; overflow: hidden;">
                    
                    <div style="background: linear-gradient(135deg, #667eea, #764ba2); 
                                color: white; padding: 30px;">
                        <h2 style="margin: 0;">Legal Document Requiring Signature</h2>
                        <p style="margin: 10px 0 0 0;">
                            Please review the document below and sign to acknowledge receipt
                        </p>
                    </div>
                    
                    <div style="padding: 30px;">
                        ${data.documentImage ? `
                            <img src="${data.documentImage}" 
                                 style="max-width: 100%; border: 2px solid #ddd; margin-bottom: 30px;" />
                        ` : `
                            <div style="padding: 40px; background: #f5f5f5; text-align: center; 
                                        border-radius: 10px; margin-bottom: 30px;">
                                <p>Document image loading...</p>
                            </div>
                        `}
                        
                        <div style="background: #fff3cd; border: 1px solid #ffc107; 
                                    border-radius: 5px; padding: 15px; margin-bottom: 20px;">
                            <strong>⚠️ Legal Notice:</strong> By signing below, you acknowledge 
                            receipt of this legal document. This creates an immutable blockchain record.
                        </div>
                        
                        <div style="display: flex; gap: 10px;">
                            <button onclick="FixRecipientAccess.signDocument('${documentId}')" 
                                    style="flex: 1; background: #28a745; color: white; border: none; 
                                           padding: 15px; border-radius: 5px; font-size: 18px; 
                                           cursor: pointer;">
                                ✍️ Sign & Acknowledge Receipt
                            </button>
                            
                            <button onclick="FixRecipientAccess.downloadDocument('${noticeId}')" 
                                    style="flex: 1; background: #007bff; color: white; border: none; 
                                           padding: 15px; border-radius: 5px; font-size: 18px; 
                                           cursor: pointer;">
                                💾 Download Document
                            </button>
                            
                            <button onclick="this.closest('[style*=fixed]').remove()" 
                                    style="background: #6c757d; color: white; border: none; 
                                           padding: 15px 30px; border-radius: 5px; font-size: 18px; 
                                           cursor: pointer;">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    async signDocument(documentId) {
        try {
            console.log('Signing document #' + documentId);
            
            // Get contract
            const contract = await window.tronWeb.contract().at('TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb');
            
            // Sign the document
            const result = await contract.acceptDocument(documentId).send({
                feeLimit: 100000000,
                callValue: 0
            });
            
            console.log('Document signed!', result);
            
            // Show success
            alert('✅ Document successfully signed! Transaction: ' + result);
            
            // Reload to show signed status
            location.reload();
            
        } catch (error) {
            console.error('Error signing document:', error);
            alert('Error signing document. Please try again.');
        }
    },
    
    async downloadDocument(noticeId) {
        try {
            // Get document data
            const response = await fetch(`https://nftserviceapp.onrender.com/api/notices/${noticeId}/images`);
            const data = await response.json();
            
            if (data.documentImage) {
                // Create download link
                const a = document.createElement('a');
                a.href = data.documentImage;
                a.download = `Legal_Document_${noticeId}.png`;
                a.click();
            } else {
                alert('Document not available for download');
            }
        } catch (error) {
            console.error('Error downloading document:', error);
            alert('Error downloading document');
        }
    },
    
    async showSignedDocument(noticeId, documentId, signature) {
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                        background: rgba(0,0,0,0.9); z-index: 10000; 
                        display: flex; align-items: center; justify-content: center;">
                <div style="background: white; border-radius: 10px; padding: 40px; 
                            max-width: 500px; text-align: center;">
                    
                    <div style="font-size: 60px; margin-bottom: 20px;">✅</div>
                    
                    <h2 style="color: #28a745; margin-bottom: 20px;">
                        Document Already Signed
                    </h2>
                    
                    <p style="margin-bottom: 30px;">
                        You have already signed and acknowledged receipt of this document.
                        <br><br>
                        <strong>Signature Record:</strong><br>
                        ${signature}
                    </p>
                    
                    <div style="display: flex; gap: 10px;">
                        <button onclick="FixRecipientAccess.downloadDocument('${noticeId}')" 
                                style="flex: 1; background: #007bff; color: white; border: none; 
                                       padding: 15px; border-radius: 5px; cursor: pointer;">
                            💾 Download Document
                        </button>
                        
                        <button onclick="this.closest('[style*=fixed]').remove()" 
                                style="flex: 1; background: #6c757d; color: white; border: none; 
                                       padding: 15px; border-radius: 5px; cursor: pointer;">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
};

// Fix BlockServed integration
if (window.location.hostname === 'blockserved.com' || window.isBlockServed) {
    window.isRecipientView = true;
    
    // Override document viewing
    window.viewDocument = window.FixRecipientAccess.viewDocument;
    window.signDocument = window.FixRecipientAccess.signDocument;
    window.downloadDocument = window.FixRecipientAccess.downloadDocument;
}

console.log('✅ Backend access fixes applied!');