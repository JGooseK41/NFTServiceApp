/**
 * Temporary script to update case display with transaction hashes
 * Run this in browser console on theblockservice.com to see changes immediately
 */

// Override the displayCases function to show transaction hashes
if (window.cases) {
    console.log('Updating case display to show transaction hashes...');
    
    // Store original function
    const originalDisplay = window.cases.displayCases;
    
    // Override with enhanced version
    window.cases.displayCases = function(cases) {
        this.currentCases = cases;
        
        const tbody = document.getElementById('casesTableBody');
        if (!tbody) return;
        
        if (cases.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted">No cases found</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = cases.map(c => {
            const caseId = c.caseNumber || c.case_number || c.id || 'Unknown';
            const createdDate = c.created_at || c.createdAt || Date.now();
            const pageCount = c.page_count || c.pageCount || c.documentCount || 0;
            const status = c.status || 'Active';
            const txHash = c.transactionHash || c.transaction_hash;
            const alertTokenId = c.alertTokenId || c.alert_token_id;
            const documentTokenId = c.documentTokenId || c.document_token_id;
            
            return `
                <tr>
                    <td>
                        <a href="#" onclick="cases.viewCase('${caseId}'); return false;">
                            ${caseId}
                        </a>
                    </td>
                    <td>${new Date(createdDate).toLocaleDateString()}</td>
                    <td>${pageCount} pages</td>
                    <td>
                        <span class="badge bg-${this.getStatusColor(status)}">
                            ${status}
                        </span>
                        ${txHash ? `
                            <br>
                            <small style="font-size: 10px; line-height: 1.2;">
                                Tx: <code>${txHash.substring(0, 8)}...</code>
                                <a href="https://tronscan.org/#/transaction/${txHash}" target="_blank" 
                                   class="text-info" title="View on TronScan">
                                    <i class="bi bi-box-arrow-up-right"></i>
                                </a>
                            </small>
                        ` : ''}
                        ${(alertTokenId || documentTokenId) ? `
                            <br>
                            <small style="font-size: 10px; color: #666;">
                                NFTs: ${alertTokenId ? `#${alertTokenId}` : ''} ${documentTokenId ? `#${documentTokenId}` : ''}
                            </small>
                        ` : ''}
                    </td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-primary" onclick="cases.resumeCase('${caseId}')" title="Resume">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                            ${(c.served_at || c.servedAt || status === 'served' || status.toLowerCase() === 'served' || txHash) ? `
                                <button class="btn btn-sm btn-primary" onclick="cases.viewReceipt('${caseId}')" title="View Delivery Receipt">
                                    <i class="bi bi-receipt"></i> Receipt
                                </button>
                                <button class="btn btn-sm btn-warning" onclick="cases.syncBlockchainData('${caseId}')" title="Sync Blockchain Data">
                                    <i class="bi bi-cloud-download"></i>
                                </button>
                                <button class="btn btn-sm btn-success" onclick="cases.printReceipt('${caseId}')" title="Print Receipt">
                                    <i class="bi bi-printer"></i>
                                </button>
                                <button class="btn btn-sm btn-info" onclick="cases.exportStamped('${caseId}')" title="Export Stamped">
                                    <i class="bi bi-file-earmark-pdf"></i>
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-danger" onclick="cases.deleteCase('${caseId}', '${c.server_address || window.wallet?.address}')" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    };
    
    // Also add the viewReceipt function if it doesn't exist
    if (!window.cases.viewReceipt) {
        window.cases.viewReceipt = async function(caseId) {
            try {
                // Get case data
                let caseData = this.getCaseData(caseId);
                const caseNumber = caseData?.caseNumber || caseData?.case_number || caseId;
                
                if (!caseData) {
                    // Try fetching from backend
                    const backendUrl = 'https://nftserviceapp.onrender.com';
                    const response = await fetch(`${backendUrl}/api/cases/${caseNumber}/service-data`);
                    
                    if (response.ok) {
                        const data = await response.json();
                        caseData = data.case;
                    }
                }
                
                if (!caseData) {
                    alert('Case not found');
                    return;
                }
                
                // Show receipt modal
                const txHash = caseData.transactionHash || caseData.transaction_hash;
                const alertTokenId = caseData.alertTokenId || caseData.alert_token_id;
                const documentTokenId = caseData.documentTokenId || caseData.document_token_id;
                const servedAt = caseData.servedAt || caseData.served_at;
                const recipients = caseData.recipients || [];
                
                const modalHtml = `
                    <div class="modal fade show" id="receiptModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.5);">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content">
                                <div class="modal-header bg-primary text-white">
                                    <h5 class="modal-title"><i class="bi bi-receipt"></i> Delivery Receipt - Case ${caseNumber}</h5>
                                    <button type="button" class="btn-close btn-close-white" onclick="document.getElementById('receiptModal').remove()"></button>
                                </div>
                                <div class="modal-body">
                                    <div class="text-center mb-4">
                                        <h3 class="text-success"><i class="bi bi-check-circle-fill"></i> Successfully Served</h3>
                                        <p class="text-muted">${servedAt ? new Date(servedAt).toLocaleString() : 'Date not available'}</p>
                                    </div>
                                    
                                    <div class="row mb-3">
                                        <div class="col-md-6">
                                            <strong>Transaction Hash:</strong><br>
                                            <code style="font-size: 11px;">${txHash || 'Click sync button to retrieve'}</code>
                                        </div>
                                        <div class="col-md-6">
                                            <strong>NFT Token IDs:</strong><br>
                                            Alert: #${alertTokenId || 'N/A'}, Document: #${documentTokenId || 'N/A'}
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <strong>Recipients (${recipients.length}):</strong>
                                        <ul class="list-unstyled mt-2">
                                            ${recipients.map(r => `<li><code>${r}</code></li>`).join('')}
                                        </ul>
                                    </div>
                                    
                                    ${caseData.alertImage || caseData.alert_preview ? `
                                        <div class="text-center mt-3">
                                            <strong>Alert NFT Preview:</strong><br>
                                            <img src="${caseData.alertImage || caseData.alert_preview}" 
                                                 style="max-width: 400px; border: 1px solid #ddd; border-radius: 8px; margin-top: 10px;">
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="modal-footer">
                                    ${txHash ? `
                                        <a href="https://tronscan.org/#/transaction/${txHash}" target="_blank" class="btn btn-info">
                                            <i class="bi bi-box-arrow-up-right"></i> View on TronScan
                                        </a>
                                    ` : ''}
                                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('receiptModal').remove()">Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Remove any existing modal
                const existingModal = document.getElementById('receiptModal');
                if (existingModal) existingModal.remove();
                
                // Add modal to page
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                
            } catch (error) {
                console.error('Error viewing receipt:', error);
                alert('Failed to view receipt: ' + error.message);
            }
        };
    }
    
    // Reload the cases to show new display
    window.cases.loadCases();
    
    console.log('✅ Case display updated! You should now see:');
    console.log('- Transaction hashes with TronScan links');
    console.log('- NFT Token IDs');
    console.log('- Receipt buttons for served cases');
    
} else {
    console.error('Cases module not found. Make sure you are on the Cases tab.');
}