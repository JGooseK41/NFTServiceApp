/**
 * Final Working Case Modal
 * This WILL make the modal appear when clicking cases
 */

console.log('🚀 Installing final case modal solution...');

// Define the modal function globally
window.viewCaseDetails = function(caseId) {
    console.log(`Opening modal for case: ${caseId}`);
    
    // Remove any existing modals
    document.querySelectorAll('.case-modal-overlay').forEach(m => m.remove());
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'case-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        width: 90%;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    modal.innerHTML = `
        <div style="padding: 20px; border-bottom: 1px solid #ddd; position: sticky; top: 0; background: white; z-index: 1;">
            <h2 style="margin: 0; color: #333;">Case #${caseId}</h2>
            <button onclick="this.closest('.case-modal-overlay').remove()" style="
                position: absolute;
                top: 20px;
                right: 20px;
                background: none;
                border: none;
                font-size: 30px;
                cursor: pointer;
                color: #666;
            ">&times;</button>
        </div>
        <div style="padding: 20px;">
            <div id="caseModalContent">
                <p>Loading case details...</p>
            </div>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Click outside to close
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };
    
    // Load case data
    const apiUrl = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
    const serverAddress = window.tronWeb?.defaultAddress?.base58 || localStorage.getItem('walletAddress') || '';
    
    fetch(`${apiUrl}/api/cases/${caseId}`, {
        headers: { 'X-Server-Address': serverAddress }
    })
    .then(r => r.json())
    .then(data => {
        const content = document.getElementById('caseModalContent');
        content.innerHTML = `
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <h3 style="margin-top: 0;">Case Information</h3>
                <p><strong>Status:</strong> ${data.status || 'Unknown'}</p>
                <p><strong>Created:</strong> ${data.created_at ? new Date(data.created_at).toLocaleString() : 'N/A'}</p>
                <p><strong>Documents:</strong> ${data.document_count || 0}</p>
                ${data.description ? `<p><strong>Description:</strong> ${data.description}</p>` : ''}
            </div>
            
            ${data.documents && data.documents.length ? `
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <h3 style="margin-top: 0;">Documents</h3>
                    ${data.documents.map(d => `
                        <div style="padding: 10px; background: white; margin: 5px 0; border-radius: 3px;">
                            ${d.name || 'Document'}
                            ${d.url ? ` - <a href="${d.url}" target="_blank">View</a>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            ${data.recipients && data.recipients.length ? `
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                    <h3 style="margin-top: 0;">Recipients</h3>
                    ${data.recipients.map(r => `
                        <div style="padding: 10px; background: white; margin: 5px 0; border-radius: 3px;">
                            ${r.recipient_address || r.address || 'Unknown'}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    })
    .catch(err => {
        document.getElementById('caseModalContent').innerHTML = `
            <p style="color: red;">Error loading case: ${err.message}</p>
        `;
    });
};

// Test function
window.testCaseModal = function() {
    console.log('Testing case modal...');
    window.viewCaseDetails('TEST-CASE-123');
};

console.log('✅ Case modal ready!');
console.log('Test with: window.viewCaseDetails("34-2501-1300")');
console.log('Or: window.testCaseModal()');