/**
 * FIX RECIPIENT DOCUMENT VIEWING
 * Allows recipients to view documents even after accepting
 * Works without requiring TronWeb/wallet connection
 */

console.log('📄 Loading recipient document view fix...');

window.RecipientDocumentFix = {
    
    // Get current wallet address (works without TronWeb)
    getCurrentAddress() {
        // Try multiple methods to get address
        if (window.tronWeb && window.tronWeb.defaultAddress) {
            return window.tronWeb.defaultAddress.base58;
        }
        
        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const addressParam = urlParams.get('address') || urlParams.get('wallet');
        if (addressParam) {
            return addressParam;
        }
        
        // Check session storage
        const stored = sessionStorage.getItem('recipientAddress');
        if (stored) {
            return stored;
        }
        
        // Prompt for address
        const address = prompt('Please enter your wallet address to view documents:');
        if (address) {
            sessionStorage.setItem('recipientAddress', address);
            return address;
        }
        
        return null;
    },
    
    // View document (even if already accepted)
    async viewDocument(alertId) {
        console.log('📄 Attempting to view document for alert:', alertId);
        
        const address = this.getCurrentAddress();
        if (!address) {
            alert('Please provide your wallet address to view documents');
            return;
        }
        
        try {
            // Get document from backend
            const response = await fetch(`/api/recipient-access/recipient/${address}/notice/${alertId}/document`);
            
            if (!response.ok) {
                throw new Error('Failed to retrieve document');
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to retrieve document');
            }
            
            const notice = data.notice;
            
            // Display document
            this.displayDocument(notice);
            
        } catch (error) {
            console.error('Error viewing document:', error);
            alert('Error retrieving document: ' + error.message);
        }
    },
    
    // Display the document
    displayDocument(notice) {
        console.log('📄 Displaying document:', notice);
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'document-viewer-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            width: 90%;
            max-width: 900px;
            height: 90%;
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;
        
        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        `;
        header.innerHTML = `
            <h2 style="margin: 0;">Legal Document - Case #${notice.caseNumber}</h2>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">
                ${notice.noticeType} | ${notice.issuingAgency}
            </p>
            ${notice.alreadySigned ? `
                <div style="
                    margin-top: 15px;
                    padding: 10px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 5px;
                ">
                    ✅ You accepted this document on ${new Date(notice.signedAt).toLocaleString()}
                </div>
            ` : ''}
        `;
        
        // Document viewer
        const viewer = document.createElement('div');
        viewer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: #f5f5f5;
        `;
        
        if (notice.document) {
            // Display document based on type
            if (notice.document.startsWith('data:image')) {
                viewer.innerHTML = `
                    <img src="${notice.document}" style="max-width: 100%; height: auto;">
                `;
            } else if (notice.document.startsWith('data:application/pdf')) {
                viewer.innerHTML = `
                    <iframe src="${notice.document}" style="width: 100%; height: 100%; border: none;"></iframe>
                `;
            } else {
                viewer.innerHTML = `
                    <div style="
                        padding: 20px;
                        background: white;
                        border-radius: 5px;
                    ">
                        <p>Document type: ${notice.documentType || 'Unknown'}</p>
                        <p>Document is available but cannot be displayed in this viewer.</p>
                        <button onclick="RecipientDocumentFix.downloadDocument('${notice.document}')" style="
                            padding: 10px 20px;
                            background: #007bff;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                        ">Download Document</button>
                    </div>
                `;
            }
        } else if (notice.thumbnail) {
            viewer.innerHTML = `
                <img src="${notice.thumbnail}" style="max-width: 100%; height: auto;">
                <p style="margin-top: 20px; text-align: center; color: #666;">
                    This is a preview. Full document may require additional authentication.
                </p>
            `;
        } else {
            viewer.innerHTML = `
                <div style="
                    padding: 40px;
                    text-align: center;
                    background: white;
                    border-radius: 5px;
                ">
                    <h3>Document Not Available</h3>
                    <p>The document data could not be retrieved. Please contact support.</p>
                </div>
            `;
        }
        
        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 20px;
            background: white;
            border-top: 1px solid #dee2e6;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        `;
        
        footer.innerHTML = `
            ${!notice.alreadySigned ? `
                <button onclick="RecipientDocumentFix.acceptDocument('${notice.alertId}')" style="
                    padding: 10px 30px;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">Accept & Sign</button>
            ` : ''}
            <button onclick="RecipientDocumentFix.closeViewer()" style="
                padding: 10px 30px;
                background: #6c757d;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
            ">Close</button>
        `;
        
        content.appendChild(header);
        content.appendChild(viewer);
        content.appendChild(footer);
        modal.appendChild(content);
        
        document.body.appendChild(modal);
    },
    
    // Accept document
    async acceptDocument(alertId) {
        const address = this.getCurrentAddress();
        if (!address) {
            alert('Please provide your wallet address');
            return;
        }
        
        try {
            const response = await fetch(`/api/recipient-access/recipient/${address}/notice/${alertId}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signature: 'accepted_' + Date.now(),
                    ipAddress: 'user_ip',
                    userAgent: navigator.userAgent
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                if (data.alreadySigned) {
                    alert('You have already accepted this document');
                } else {
                    alert('Document accepted successfully!');
                }
                this.closeViewer();
                location.reload();
            }
            
        } catch (error) {
            console.error('Error accepting document:', error);
            alert('Failed to accept document');
        }
    },
    
    // Download document
    downloadDocument(dataUrl) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'legal_document.pdf';
        a.click();
    },
    
    // Close viewer
    closeViewer() {
        const modal = document.getElementById('document-viewer-modal');
        if (modal) {
            modal.remove();
        }
    }
};

// Override existing handlers
(function() {
    // Fix "already accepted" issue
    document.addEventListener('click', (e) => {
        // Check for view document buttons
        if (e.target.matches('.view-document-btn, [onclick*="viewDocument"]')) {
            e.preventDefault();
            e.stopPropagation();
            
            // Extract alert ID
            const onclick = e.target.getAttribute('onclick');
            const alertMatch = onclick?.match(/\d+/);
            if (alertMatch) {
                RecipientDocumentFix.viewDocument(alertMatch[0]);
            }
        }
        
        // Check for accept notice buttons
        if (e.target.textContent.includes('Accept Notice') || 
            e.target.textContent.includes('View Document')) {
            
            const alertId = e.target.dataset.alertId || 
                          e.target.closest('[data-alert-id]')?.dataset.alertId;
            
            if (alertId) {
                e.preventDefault();
                e.stopPropagation();
                RecipientDocumentFix.viewDocument(alertId);
            }
        }
    }, true);
})();

// Make available globally
window.viewRecipientDocument = function(alertId) {
    RecipientDocumentFix.viewDocument(alertId);
};

console.log('✅ Recipient document view fix loaded');
console.log('Recipients can now view documents even after accepting');