/**
 * Fix Case Management Interface
 * - Fixes scrolling issues
 * - Adds delete functionality with confirmation
 * - Adds resume/open case functionality
 */

console.log('🔧 Fixing Case Management interface...');

// Fix scrolling issue
function fixCaseListScrolling() {
    const container = document.getElementById('caseListContainer');
    if (container) {
        // Remove any conflicting styles
        container.style.position = 'relative';
        container.style.overflowY = 'auto';
        container.style.overflowX = 'hidden';
        container.style.maxHeight = '500px'; // Increase height
        container.style.minHeight = '200px';
        
        // Ensure proper scroll behavior
        container.style.scrollBehavior = 'smooth';
        container.style.webkitOverflowScrolling = 'touch'; // For iOS
        
        // Remove any parent overflow hidden that might interfere
        let parent = container.parentElement;
        while (parent && parent !== document.body) {
            if (getComputedStyle(parent).overflow === 'hidden') {
                parent.style.overflow = 'visible';
            }
            parent = parent.parentElement;
        }
        
        console.log('✅ Case list scrolling fixed');
    }
}

// Enhanced refresh function with delete and resume options
async function enhancedRefreshCaseList() {
    const container = document.getElementById('caseListContainer');
    if (!container) return;
    
    container.innerHTML = '<p class="text-muted">Loading cases...</p>';
    
    try {
        const cases = await window.caseManager.listCases();
        
        if (!cases || cases.length === 0) {
            container.innerHTML = '<p class="text-muted">No cases found. Create your first case above.</p>';
            return;
        }
        
        // Create enhanced case list with action buttons
        container.innerHTML = cases.map(c => `
            <div class="case-item-enhanced" data-case-id="${c.id || c.caseId}" style="
                padding: 1rem; 
                margin-bottom: 0.75rem; 
                background: var(--secondary-navy); 
                border-radius: 8px; 
                border: 1px solid var(--border-color);
                transition: all 0.3s ease;
                position: relative;
            ">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1; cursor: pointer;" onclick="viewCaseDetails('${c.id || c.caseId}')">
                        <strong style="color: var(--accent-blue); font-size: 1.1rem;">
                            Case #${c.id || c.caseId}
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
                        <button class="btn btn-info btn-small" onclick="viewCaseDetails('${c.id || c.caseId}')" title="View Details">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn btn-success btn-small" onclick="resumeCase('${c.id || c.caseId}')" title="Open/Resume Case">
                            <i class="fas fa-folder-open"></i> Open
                        </button>
                        <button class="btn btn-danger btn-small" onclick="confirmDeleteCase('${c.id || c.caseId}')" title="Delete Case">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Fix scrolling after content loads
        setTimeout(fixCaseListScrolling, 100);
        
        // Update badge
        const badge = document.getElementById('casesBadge');
        if (badge) {
            badge.textContent = cases.length;
            badge.style.display = cases.length > 0 ? 'inline-block' : 'none';
        }
        
    } catch (error) {
        console.error('List cases error:', error);
        container.innerHTML = '<p style="color: var(--error);">Error loading cases</p>';
    }
}

// View case details in modal
async function viewCaseDetails(caseId) {
    console.log(`📂 Viewing details for case #${caseId}...`);
    
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
        // Fetch case details
        const response = await fetch(`${window.caseManager?.apiUrl || window.BACKEND_API_URL}/api/cases/${caseId}`, {
            headers: {
                'X-Server-Address': window.caseManager?.serverAddress || window.tronWeb?.defaultAddress?.base58 || ''
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch case: ${response.status}`);
        }
        
        const caseData = await response.json();
        console.log('Case data:', caseData);
        
        // Fetch associated notices/services
        let services = [];
        try {
            const servicesResponse = await fetch(`${window.caseManager?.apiUrl || window.BACKEND_API_URL}/api/cases/${caseId}/services`, {
                headers: {
                    'X-Server-Address': window.caseManager?.serverAddress || window.tronWeb?.defaultAddress?.base58 || ''
                }
            });
            
            if (servicesResponse.ok) {
                services = await servicesResponse.json();
            }
        } catch (e) {
            console.log('Could not fetch services:', e);
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
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
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
                            <button class="btn btn-primary" onclick="viewCasePDF('${caseId}')">
                                <i class="fas fa-file-pdf"></i> View Combined PDF
                            </button>
                            <button class="btn btn-success" onclick="resumeCase('${caseId}'); this.closest('.modal').remove();">
                                <i class="fas fa-folder-open"></i> Resume Case
                            </button>
                            <button class="btn btn-info" onclick="downloadCase('${caseId}')">
                                <i class="fas fa-download"></i> Download
                            </button>
                        </div>
                        <div style="display: flex; gap: 1rem;">
                            <button class="btn btn-danger" onclick="confirmDeleteCase('${caseId}'); this.closest('.modal').remove();">
                                <i class="fas fa-trash"></i> Delete Case
                            </button>
                            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Error loading case details:', error);
        loadingModal.remove();
        
        if (window.uiManager) {
            window.uiManager.showNotification('error', `Failed to load case details: ${error.message}`);
        } else {
            alert(`Failed to load case details: ${error.message}`);
        }
    }
}

// Download case documents
async function downloadCase(caseId) {
    try {
        const serverAddress = window.caseManager?.serverAddress || window.tronWeb?.defaultAddress?.base58 || 'TEST-SERVER';
        const url = `${window.caseManager?.apiUrl || window.BACKEND_API_URL}/api/cases/${caseId}/pdf?serverAddress=${encodeURIComponent(serverAddress)}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `case-${caseId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        
        if (window.uiManager) {
            window.uiManager.showNotification('success', 'Case downloaded successfully');
        }
    } catch (error) {
        console.error('Download error:', error);
        if (window.uiManager) {
            window.uiManager.showNotification('error', `Download failed: ${error.message}`);
        }
    }
}

// Delete case with confirmation
async function confirmDeleteCase(caseId) {
    // Create confirmation modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.style.zIndex = '10000';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2 style="color: var(--error);">
                    <i class="fas fa-exclamation-triangle"></i> Delete Case
                </h2>
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete Case #${caseId}?</p>
                <p style="color: var(--text-secondary); font-size: 0.9rem;">
                    This action cannot be undone. All documents associated with this case will be removed.
                </p>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem;">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                    Cancel
                </button>
                <button class="btn btn-danger" onclick="deleteCase('${caseId}'); this.closest('.modal').remove()">
                    <i class="fas fa-trash"></i> Delete Case
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Actually delete the case
async function deleteCase(caseId) {
    try {
        const response = await fetch(`${window.caseManager.apiUrl}/api/cases/${caseId}`, {
            method: 'DELETE',
            headers: {
                'X-Server-Address': window.caseManager.serverAddress || window.tronWeb?.defaultAddress?.base58 || ''
            }
        });
        
        if (response.ok) {
            // Show success notification
            if (window.uiManager) {
                window.uiManager.showNotification('success', `Case #${caseId} deleted successfully`);
            } else {
                alert(`Case #${caseId} deleted successfully`);
            }
            
            // Refresh the list
            enhancedRefreshCaseList();
        } else {
            throw new Error(`Failed to delete case: ${response.status}`);
        }
    } catch (error) {
        console.error('Delete case error:', error);
        if (window.uiManager) {
            window.uiManager.showNotification('error', `Failed to delete case: ${error.message}`);
        } else {
            alert(`Failed to delete case: ${error.message}`);
        }
    }
}

// Resume/Open case functionality
async function resumeCase(caseId) {
    console.log(`📂 Opening case #${caseId}...`);
    
    try {
        // Fetch case details
        const response = await fetch(`${window.caseManager.apiUrl}/api/cases/${caseId}`, {
            headers: {
                'X-Server-Address': window.caseManager.serverAddress || window.tronWeb?.defaultAddress?.base58 || ''
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch case: ${response.status}`);
        }
        
        const caseData = await response.json();
        console.log('Case data:', caseData);
        
        // Switch to the Create tab
        if (window.switchTab) {
            window.switchTab('user');
        }
        
        // Open the mint modal with case data
        if (window.openMintModal) {
            window.openMintModal();
            
            // Pre-fill the form with case data
            setTimeout(() => {
                // Set case number
                const caseNumberInput = document.getElementById('mintCaseNumber');
                if (caseNumberInput) {
                    caseNumberInput.value = caseData.id || caseData.caseId || caseId;
                }
                
                // Set description/notice text
                const noticeTextInput = document.getElementById('noticeText');
                if (noticeTextInput && caseData.description) {
                    noticeTextInput.value = caseData.description;
                }
                
                // Load documents if available
                if (caseData.documents && caseData.documents.length > 0) {
                    console.log('📄 Loading case documents...');
                    
                    // Clear existing documents
                    window.uploadedDocumentsList = [];
                    
                    // Add case documents
                    caseData.documents.forEach((doc, index) => {
                        window.uploadedDocumentsList.push({
                            id: Date.now() + '_' + index,
                            fileName: doc.name || `Document ${index + 1}`,
                            fileSize: doc.size || 0,
                            data: doc.url || doc.data,
                            preview: doc.thumbnail || doc.preview,
                            order: index
                        });
                    });
                    
                    // Update UI
                    if (window.updateDocumentsList) {
                        window.updateDocumentsList();
                    }
                    
                    // Show document step
                    if (window.showDocumentUpload) {
                        window.showDocumentUpload();
                    }
                }
                
                // Show notification
                if (window.uiManager) {
                    window.uiManager.showNotification('success', `Case #${caseId} loaded. Continue where you left off.`);
                }
                
            }, 500);
        }
        
    } catch (error) {
        console.error('Resume case error:', error);
        if (window.uiManager) {
            window.uiManager.showNotification('error', `Failed to open case: ${error.message}`);
        } else {
            alert(`Failed to open case: ${error.message}`);
        }
    }
}

// View case PDF (existing function enhancement)
window.viewCasePDF = function(caseId) {
    if (!caseId) {
        caseId = window.currentSelectedCase;
    }
    
    if (!caseId) {
        if (window.uiManager) {
            window.uiManager.showNotification('error', 'No case selected');
        }
        return;
    }
    
    // Open PDF in new tab
    const serverAddress = window.caseManager?.serverAddress || window.tronWeb?.defaultAddress?.base58 || 'TEST-SERVER';
    const url = `${window.caseManager?.apiUrl || window.BACKEND_API_URL}/api/cases/${caseId}/pdf?serverAddress=${encodeURIComponent(serverAddress)}`;
    window.open(url, '_blank');
};

// Override the original refreshCaseList function
window.refreshCaseList = enhancedRefreshCaseList;

// Also make sure caseManager uses the enhanced version
if (window.caseManager) {
    window.caseManager.refreshList = enhancedRefreshCaseList;
}

// Make functions globally available
window.viewCaseDetails = viewCaseDetails;
window.downloadCase = downloadCase;
window.confirmDeleteCase = confirmDeleteCase;
window.deleteCase = deleteCase;
window.resumeCase = resumeCase;
window.fixCaseListScrolling = fixCaseListScrolling;

// Auto-fix on tab switch
if (!window._originalSwitchTabCaseManagement) {
    window._originalSwitchTabCaseManagement = window.switchTab;
    window.switchTab = function(tabName) {
        if (window._originalSwitchTabCaseManagement) {
            window._originalSwitchTabCaseManagement(tabName);
        }
        
        if (tabName === 'cases') {
            // Fix scrolling when switching to cases tab
            setTimeout(() => {
                fixCaseListScrolling();
                enhancedRefreshCaseList();
            }, 100);
        }
    };
}

// Fix scrolling on initial load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(fixCaseListScrolling, 1000);
});

// Also fix when the window resizes
window.addEventListener('resize', fixCaseListScrolling);

console.log('✅ Case Management interface fixed!');
console.log('   - Scrolling issues resolved');
console.log('   - Delete functionality added (with confirmation)');
console.log('   - Resume/Open case functionality added');
console.log('   - Enhanced UI with action buttons');