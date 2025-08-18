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
                    <div style="flex: 1; cursor: pointer;" onclick="selectCase('${c.id || c.caseId}')">
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
                        <button class="btn btn-success btn-small" onclick="resumeCase('${c.id || c.caseId}')" title="Open/Resume Case">
                            <i class="fas fa-folder-open"></i> Open
                        </button>
                        <button class="btn btn-primary btn-small" onclick="viewCasePDF('${c.id || c.caseId}')" title="View PDF">
                            <i class="fas fa-file-pdf"></i>
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