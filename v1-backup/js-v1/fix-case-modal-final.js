/**
 * Final Fix for Case Modal Display
 * Ensures modal appears when clicking cases in Case Management tab
 */

console.log('🔧 Applying final case modal fix...');

// Ensure viewCaseDetails is globally available
window.viewCaseDetails = async function(caseId) {
    console.log(`📂 Opening case modal for: ${caseId}`);
    
    // Create and show loading modal immediately
    const loadingModal = document.createElement('div');
    loadingModal.className = 'modal fade show';
    loadingModal.style.cssText = 'display: block; z-index: 10000; background: rgba(0,0,0,0.5);';
    loadingModal.innerHTML = `
        <div class="modal-dialog modal-lg" style="margin-top: 100px;">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Loading Case #${caseId}...</h5>
                </div>
                <div class="modal-body text-center" style="padding: 3rem;">
                    <div class="spinner-border text-primary" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                    <p class="mt-3">Fetching case details...</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(loadingModal);
    
    try {
        // Get API URL and server address
        const apiUrl = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        const serverAddress = window.tronWeb?.defaultAddress?.base58 || localStorage.getItem('walletAddress') || '';
        
        console.log(`Fetching from: ${apiUrl}/api/cases/${caseId}`);
        
        // Fetch case details
        const response = await fetch(`${apiUrl}/api/cases/${caseId}`, {
            headers: {
                'X-Server-Address': serverAddress,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch case: ${response.status} - ${errorText}`);
        }
        
        const caseData = await response.json();
        console.log('Case data received:', caseData);
        
        // Remove loading modal
        loadingModal.remove();
        
        // Create the main case details modal
        const modal = document.createElement('div');
        modal.className = 'modal fade show';
        modal.style.cssText = 'display: block; z-index: 10000; background: rgba(0,0,0,0.5);';
        modal.innerHTML = `
            <div class="modal-dialog modal-xl" style="margin-top: 50px; max-width: 1200px;">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">
                            <i class="fas fa-folder-open"></i> Case #${caseData.id || caseData.caseId || caseId}
                        </h5>
                        <button type="button" class="close text-white" onclick="this.closest('.modal').remove()">
                            <span>&times;</span>
                        </button>
                    </div>
                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                        <!-- Case Info -->
                        <div class="card mb-3">
                            <div class="card-header bg-light">
                                <h6 class="mb-0"><i class="fas fa-info-circle"></i> Case Information</h6>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-md-3">
                                        <strong>Case ID:</strong><br>
                                        ${caseData.id || caseData.caseId || caseId}
                                    </div>
                                    <div class="col-md-3">
                                        <strong>Status:</strong><br>
                                        <span class="badge badge-${caseData.status === 'served' ? 'success' : 'warning'}">
                                            ${caseData.status || 'Unknown'}
                                        </span>
                                    </div>
                                    <div class="col-md-3">
                                        <strong>Created:</strong><br>
                                        ${caseData.created_at ? new Date(caseData.created_at).toLocaleString() : 'N/A'}
                                    </div>
                                    <div class="col-md-3">
                                        <strong>Documents:</strong><br>
                                        ${caseData.document_count || caseData.documents?.length || 0} file(s)
                                    </div>
                                </div>
                                ${caseData.description ? `
                                    <div class="mt-3">
                                        <strong>Description:</strong><br>
                                        ${caseData.description}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        <!-- Documents -->
                        ${caseData.documents && caseData.documents.length > 0 ? `
                            <div class="card mb-3">
                                <div class="card-header bg-light">
                                    <h6 class="mb-0"><i class="fas fa-file-alt"></i> Documents</h6>
                                </div>
                                <div class="card-body">
                                    ${caseData.documents.map((doc, idx) => `
                                        <div class="d-flex justify-content-between align-items-center p-2 mb-2 border rounded">
                                            <div>
                                                <i class="fas fa-file-pdf text-danger"></i>
                                                <strong class="ml-2">${doc.name || `Document ${idx + 1}`}</strong>
                                                ${doc.size ? `<small class="text-muted ml-2">(${(doc.size/1024).toFixed(1)} KB)</small>` : ''}
                                            </div>
                                            <div>
                                                ${doc.url ? `
                                                    <button class="btn btn-sm btn-primary" onclick="window.open('${doc.url}', '_blank')">
                                                        <i class="fas fa-eye"></i> View
                                                    </button>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        <!-- Recipients/Services -->
                        ${caseData.recipients && caseData.recipients.length > 0 ? `
                            <div class="card">
                                <div class="card-header bg-light">
                                    <h6 class="mb-0"><i class="fas fa-users"></i> Recipients</h6>
                                </div>
                                <div class="card-body">
                                    <div class="table-responsive">
                                        <table class="table table-sm">
                                            <thead>
                                                <tr>
                                                    <th>Address</th>
                                                    <th>Alert ID</th>
                                                    <th>Document ID</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${caseData.recipients.map(r => `
                                                    <tr>
                                                        <td><small>${r.recipient_address || r.address || 'Unknown'}</small></td>
                                                        <td>${r.alert_id || r.alertId || '-'}</td>
                                                        <td>${r.document_id || r.documentId || '-'}</td>
                                                        <td>
                                                            <span class="badge badge-${r.status === 'served' ? 'success' : 'warning'}">
                                                                ${r.status || 'Pending'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                            Close
                        </button>
                        ${window.resumeCase ? `
                            <button class="btn btn-success" onclick="window.resumeCase('${caseId}'); this.closest('.modal').remove();">
                                <i class="fas fa-folder-open"></i> Resume Case
                            </button>
                        ` : ''}
                        ${window.confirmDeleteCase ? `
                            <button class="btn btn-danger" onclick="window.confirmDeleteCase('${caseId}'); this.closest('.modal').remove();">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Click outside to close
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
    } catch (error) {
        console.error('Error loading case:', error);
        loadingModal.remove();
        
        // Show error modal
        const errorModal = document.createElement('div');
        errorModal.className = 'modal fade show';
        errorModal.style.cssText = 'display: block; z-index: 10000; background: rgba(0,0,0,0.5);';
        errorModal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title">Error Loading Case</h5>
                        <button type="button" class="close text-white" onclick="this.closest('.modal').remove()">
                            <span>&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p>Failed to load case details:</p>
                        <p class="text-danger">${error.message}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(errorModal);
    }
};

// Add event delegation for case clicks
document.addEventListener('click', function(e) {
    // Check if clicked element is within a case item
    const caseItem = e.target.closest('.case-item-enhanced, .case-item, [data-case-id]');
    if (caseItem) {
        const caseId = caseItem.getAttribute('data-case-id');
        if (caseId && !e.target.closest('button')) {
            // Only trigger if not clicking a button
            e.preventDefault();
            e.stopPropagation();
            window.viewCaseDetails(caseId);
        }
    }
});

// Also intercept the refreshCaseList to ensure proper onclick handlers
const originalRefreshCaseList = window.refreshCaseList || window.enhancedRefreshCaseList;
window.refreshCaseList = window.enhancedRefreshCaseList = async function() {
    if (originalRefreshCaseList) {
        await originalRefreshCaseList();
    }
    
    // Ensure all case items have proper data attributes
    setTimeout(() => {
        const caseItems = document.querySelectorAll('.case-item-enhanced, .case-item');
        caseItems.forEach(item => {
            if (!item.getAttribute('data-case-id')) {
                // Try to extract case ID from the item
                const caseText = item.textContent;
                const match = caseText.match(/Case #(\S+)/);
                if (match) {
                    item.setAttribute('data-case-id', match[1]);
                }
            }
        });
    }, 100);
};

console.log('✅ Final case modal fix applied!');
console.log('   - viewCaseDetails() function ready');
console.log('   - Event delegation added for case clicks');
console.log('   - Modal will show with Bootstrap styling');
console.log('   Test: Click any case in Case Management tab');
console.log('   Or run: window.viewCaseDetails("34-2501-1300")');