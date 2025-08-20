/**
 * Fix Case Modal Display Issue
 * Ensures the viewCaseDetails modal appears when clicking on cases
 */

console.log('🔧 Fixing case modal display...');

// Make viewCaseDetails globally available immediately
window.viewCaseDetails = async function(caseId) {
    console.log(`📂 Opening case details modal for case #${caseId}...`);
    
    // Show loading modal first
    const loadingModal = document.createElement('div');
    loadingModal.className = 'modal';
    loadingModal.style.display = 'block';
    loadingModal.style.zIndex = '10000';
    loadingModal.innerHTML = `
        <div class="modal-content" style="max-width: 900px;">
            <div class="modal-header">
                <h2><i class="fas fa-folder-open"></i> Loading Case #${caseId}...</h2>
            </div>
            <div class="modal-body" style="text-align: center; padding: 2rem;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-blue);"></i>
                <p style="margin-top: 1rem;">Loading case details...</p>
            </div>
        </div>
    `;
    document.body.appendChild(loadingModal);
    
    try {
        // Determine API URL
        const apiUrl = window.caseManager?.apiUrl || window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        const serverAddress = window.caseManager?.serverAddress || window.tronWeb?.defaultAddress?.base58 || '';
        
        console.log('Fetching case from:', `${apiUrl}/api/cases/${caseId}`);
        
        // Fetch case details
        const response = await fetch(`${apiUrl}/api/cases/${caseId}`, {
            headers: {
                'X-Server-Address': serverAddress
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch case: ${response.status}`);
        }
        
        const caseData = await response.json();
        console.log('Case data loaded:', caseData);
        
        // Fetch associated services (optional)
        let services = [];
        try {
            const servicesResponse = await fetch(`${apiUrl}/api/cases/${caseId}/services`, {
                headers: {
                    'X-Server-Address': serverAddress
                }
            });
            
            if (servicesResponse.ok) {
                services = await servicesResponse.json();
            }
        } catch (e) {
            console.log('Services not available:', e);
        }
        
        // Remove loading modal
        loadingModal.remove();
        
        // Create detailed view modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.zIndex = '10000';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2><i class="fas fa-folder-open"></i> Case #${caseId} Details</h2>
                    <span class="close" onclick="this.closest('.modal').remove()" style="cursor: pointer;">&times;</span>
                </div>
                <div class="modal-body">
                    <!-- Case Overview -->
                    <div style="background: var(--secondary-navy); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
                        <h3 style="margin-top: 0; color: var(--accent-blue);">
                            <i class="fas fa-info-circle"></i> Case Overview
                        </h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                            <div>
                                <strong>Case ID:</strong><br>
                                <span style="color: var(--text-primary);">${caseData.id || caseData.caseId || caseId}</span>
                            </div>
                            <div>
                                <strong>Status:</strong><br>
                                <span class="badge badge-${caseData.status === 'prepared' ? 'warning' : caseData.status === 'served' ? 'success' : 'info'}">
                                    ${caseData.status || 'Unknown'}
                                </span>
                            </div>
                            <div>
                                <strong>Created:</strong><br>
                                <span style="color: var(--text-primary);">${new Date(caseData.created_at).toLocaleString()}</span>
                            </div>
                            <div>
                                <strong>Documents:</strong><br>
                                <span style="color: var(--text-primary);">
                                    <i class="fas fa-file"></i> ${caseData.document_count || caseData.documents?.length || 0} file(s)
                                </span>
                            </div>
                        </div>
                        ${caseData.description ? `
                            <div style="margin-top: 1rem;">
                                <strong>Description:</strong><br>
                                <p style="margin: 0.5rem 0; color: var(--text-primary);">${caseData.description}</p>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Documents Section -->
                    <div style="background: var(--card-bg); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
                        <h3 style="margin-top: 0; color: var(--accent-blue);">
                            <i class="fas fa-file-alt"></i> Documents
                        </h3>
                        ${caseData.documents && caseData.documents.length > 0 ? `
                            <div style="display: grid; gap: 1rem;">
                                ${caseData.documents.map((doc, index) => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--secondary-navy); border-radius: 6px;">
                                        <div>
                                            <i class="fas fa-file-pdf" style="color: #dc3545;"></i>
                                            <strong style="margin-left: 0.5rem;">${doc.name || `Document ${index + 1}`}</strong>
                                            ${doc.size ? `<small style="margin-left: 1rem; color: var(--text-secondary);">${(doc.size / 1024).toFixed(2)} KB</small>` : ''}
                                        </div>
                                        <div style="display: flex; gap: 0.5rem;">
                                            ${doc.url ? `
                                                <button class="btn btn-primary btn-small" onclick="window.open('${doc.url}', '_blank')">
                                                    <i class="fas fa-eye"></i> View
                                                </button>
                                            ` : ''}
                                            ${doc.ipfs_hash ? `
                                                <button class="btn btn-secondary btn-small" onclick="window.open('https://gateway.pinata.cloud/ipfs/${doc.ipfs_hash}', '_blank')">
                                                    <i class="fas fa-globe"></i> IPFS
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <p style="color: var(--text-secondary);">No documents attached to this case.</p>
                        `}
                    </div>
                    
                    <!-- Services/Notices Section -->
                    ${services && services.length > 0 ? `
                        <div style="background: var(--card-bg); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
                            <h3 style="margin-top: 0; color: var(--accent-blue);">
                                <i class="fas fa-truck"></i> Service History
                            </h3>
                            <div style="display: grid; gap: 1rem;">
                                ${services.map(service => `
                                    <div style="padding: 1rem; background: var(--secondary-navy); border-radius: 6px;">
                                        <div style="display: flex; justify-content: space-between;">
                                            <div>
                                                <strong>Recipient:</strong> ${service.recipient_address || 'Unknown'}<br>
                                                <small>Served: ${service.served_at ? new Date(service.served_at).toLocaleString() : 'Pending'}</small>
                                            </div>
                                            <div>
                                                <span class="badge badge-${service.status === 'served' ? 'success' : service.status === 'accepted' ? 'info' : 'warning'}">
                                                    ${service.status || 'Pending'}
                                                </span>
                                            </div>
                                        </div>
                                        ${service.alert_id ? `
                                            <div style="margin-top: 0.5rem;">
                                                <small>Alert ID: ${service.alert_id} | Document ID: ${service.document_id || 'N/A'}</small>
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Actions -->
                    <div style="display: flex; justify-content: space-between; gap: 1rem; margin-top: 1.5rem;">
                        <div style="display: flex; gap: 1rem;">
                            ${window.viewCasePDF ? `
                                <button class="btn btn-primary" onclick="viewCasePDF('${caseId}')">
                                    <i class="fas fa-file-pdf"></i> View Combined PDF
                                </button>
                            ` : ''}
                            ${window.resumeCase ? `
                                <button class="btn btn-success" onclick="resumeCase('${caseId}'); this.closest('.modal').remove();">
                                    <i class="fas fa-folder-open"></i> Resume Case
                                </button>
                            ` : ''}
                            ${window.downloadCase ? `
                                <button class="btn btn-info" onclick="downloadCase('${caseId}')">
                                    <i class="fas fa-download"></i> Download
                                </button>
                            ` : ''}
                        </div>
                        <div style="display: flex; gap: 1rem;">
                            ${window.confirmDeleteCase ? `
                                <button class="btn btn-danger" onclick="confirmDeleteCase('${caseId}'); this.closest('.modal').remove();">
                                    <i class="fas fa-trash"></i> Delete Case
                                </button>
                            ` : ''}
                            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add click outside to close
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        console.log('✅ Case details modal displayed');
        
    } catch (error) {
        console.error('Error loading case details:', error);
        loadingModal.remove();
        
        // Show error modal
        const errorModal = document.createElement('div');
        errorModal.className = 'modal';
        errorModal.style.display = 'block';
        errorModal.style.zIndex = '10000';
        errorModal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2 style="color: var(--error);"><i class="fas fa-exclamation-triangle"></i> Error</h2>
                    <span class="close" onclick="this.closest('.modal').remove()" style="cursor: pointer;">&times;</span>
                </div>
                <div class="modal-body">
                    <p>Failed to load case details: ${error.message}</p>
                </div>
                <div style="text-align: right; margin-top: 1rem;">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(errorModal);
    }
};

// Also ensure the enhanced refresh function is working
window.enhancedRefreshCaseList = async function() {
    const container = document.getElementById('caseListContainer');
    if (!container) {
        console.log('Case list container not found');
        return;
    }
    
    container.innerHTML = '<p class="text-muted">Loading cases...</p>';
    
    try {
        const cases = await window.caseManager.listCases();
        
        if (!cases || cases.length === 0) {
            container.innerHTML = '<p class="text-muted">No cases found. Create your first case above.</p>';
            return;
        }
        
        console.log(`Rendering ${cases.length} cases with click handlers`);
        
        // Create enhanced case list with working onclick handlers
        container.innerHTML = cases.map(c => {
            const caseId = c.id || c.caseId;
            return `
                <div class="case-item-enhanced" data-case-id="${caseId}" style="
                    padding: 1rem; 
                    margin-bottom: 0.75rem; 
                    background: var(--secondary-navy); 
                    border-radius: 8px; 
                    border: 1px solid var(--border-color);
                    transition: all 0.3s ease;
                    position: relative;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1; cursor: pointer;" onclick="window.viewCaseDetails('${caseId}')">
                            <strong style="color: var(--accent-blue); font-size: 1.1rem;">
                                Case #${caseId}
                            </strong><br>
                            <small style="color: var(--text-secondary);">
                                Status: <span class="badge badge-${c.status === 'prepared' ? 'warning' : c.status === 'served' ? 'success' : 'info'}">${c.status}</span> 
                                | Created: ${new Date(c.created_at).toLocaleString()}
                            </small><br>
                            <small style="color: var(--text-primary);">
                                ${c.description || 'No description'}
                            </small>
                            ${c.document_count ? `<br><small style="color: var(--text-secondary);">
                                <i class="fas fa-file"></i> ${c.document_count} document(s)
                            </small>` : ''}
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-info btn-small" onclick="window.viewCaseDetails('${caseId}')" title="View Details">
                                <i class="fas fa-eye"></i> View
                            </button>
                            ${window.resumeCase ? `
                                <button class="btn btn-success btn-small" onclick="window.resumeCase('${caseId}')" title="Open/Resume Case">
                                    <i class="fas fa-folder-open"></i> Open
                                </button>
                            ` : ''}
                            ${window.confirmDeleteCase ? `
                                <button class="btn btn-danger btn-small" onclick="window.confirmDeleteCase('${caseId}')" title="Delete Case">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Fix scrolling
        container.style.overflowY = 'auto';
        container.style.maxHeight = '500px';
        container.style.scrollBehavior = 'smooth';
        
        // Update badge
        const badge = document.getElementById('casesBadge');
        if (badge) {
            badge.textContent = cases.length;
            badge.style.display = cases.length > 0 ? 'inline-block' : 'none';
        }
        
        console.log('✅ Case list refreshed with click handlers');
        
    } catch (error) {
        console.error('List cases error:', error);
        container.innerHTML = '<p style="color: var(--error);">Error loading cases</p>';
    }
};

// Override refreshCaseList if it exists
if (window.refreshCaseList) {
    window.refreshCaseList = window.enhancedRefreshCaseList;
}

// Also update caseManager if it exists
if (window.caseManager) {
    window.caseManager.refreshList = window.enhancedRefreshCaseList;
}

// Auto-refresh when switching to cases tab
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabName) {
    if (originalSwitchTab) {
        originalSwitchTab(tabName);
    }
    
    if (tabName === 'cases') {
        setTimeout(() => {
            window.enhancedRefreshCaseList();
        }, 100);
    }
};

console.log('✅ Case modal display fix loaded');
console.log('   - viewCaseDetails() function available globally');
console.log('   - Click handlers will open modal properly');
console.log('   - Test by clicking any case in Case Management tab');