/**
 * Force Case Modal to Work
 * This will make absolutely sure the modal appears when clicking cases
 */

console.log('🔨 FORCING case modal to work...');

// Global function that WILL work
window.viewCaseDetails = function(caseId) {
    console.log(`🚀 FORCE OPENING MODAL FOR CASE: ${caseId}`);
    
    // Remove any existing modals first
    document.querySelectorAll('.modal').forEach(m => m.remove());
    
    // Create a simple but functional modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        width: 90%;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
        border-radius: 10px;
        padding: 20px;
        position: relative;
    `;
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        font-size: 30px;
        background: none;
        border: none;
        cursor: pointer;
        color: #666;
    `;
    closeBtn.onclick = () => modal.remove();
    modalContent.appendChild(closeBtn);
    
    // Add content
    modalContent.innerHTML += `
        <h2 style="color: #333; margin-bottom: 20px;">Case Details: ${caseId}</h2>
        <div id="modalLoading" style="text-align: center; padding: 40px;">
            <div style="font-size: 24px;">⏳ Loading case data...</div>
        </div>
        <div id="modalContent" style="display: none;"></div>
        <div id="modalError" style="display: none; color: red; padding: 20px;"></div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close on background click
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    // Fetch case data
    const apiUrl = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
    const serverAddress = window.tronWeb?.defaultAddress?.base58 || localStorage.getItem('walletAddress') || '';
    
    fetch(`${apiUrl}/api/cases/${caseId}`, {
        headers: {
            'X-Server-Address': serverAddress
        }
    })
    .then(response => response.json())
    .then(caseData => {
        document.getElementById('modalLoading').style.display = 'none';
        const content = document.getElementById('modalContent');
        content.style.display = 'block';
        
        content.innerHTML = `
            <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
                <h3 style="color: #333; margin-bottom: 10px;">📋 Case Information</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                    <div><strong>ID:</strong> ${caseData.id || caseId}</div>
                    <div><strong>Status:</strong> ${caseData.status || 'Unknown'}</div>
                    <div><strong>Created:</strong> ${caseData.created_at ? new Date(caseData.created_at).toLocaleString() : 'N/A'}</div>
                    <div><strong>Documents:</strong> ${caseData.document_count || 0}</div>
                </div>
                ${caseData.description ? `<div style="margin-top: 10px;"><strong>Description:</strong> ${caseData.description}</div>` : ''}
            </div>
            
            ${caseData.documents && caseData.documents.length > 0 ? `
                <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
                    <h3 style="color: #333; margin-bottom: 10px;">📄 Documents</h3>
                    ${caseData.documents.map(doc => `
                        <div style="padding: 10px; margin: 5px 0; background: white; border-radius: 5px;">
                            ${doc.name || 'Document'}
                            ${doc.url ? `<a href="${doc.url}" target="_blank" style="margin-left: 10px;">View</a>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            ${caseData.recipients && caseData.recipients.length > 0 ? `
                <div style="padding: 15px; background: #f5f5f5; border-radius: 5px;">
                    <h3 style="color: #333; margin-bottom: 10px;">👥 Recipients</h3>
                    ${caseData.recipients.map(r => `
                        <div style="padding: 10px; margin: 5px 0; background: white; border-radius: 5px;">
                            ${r.recipient_address || r.address || 'Unknown'}
                            <span style="margin-left: 10px; color: #666;">
                                Alert: ${r.alert_id || '-'} | Doc: ${r.document_id || '-'}
                            </span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    })
    .catch(error => {
        console.error('Error loading case:', error);
        document.getElementById('modalLoading').style.display = 'none';
        document.getElementById('modalError').style.display = 'block';
        document.getElementById('modalError').innerHTML = `
            <h3>Error Loading Case</h3>
            <p>${error.message}</p>
            <p>Case ID: ${caseId}</p>
        `;
    });
};

// Force refresh of case list with working onclick
window.forceRefreshCaseList = async function() {
    console.log('🔄 Force refreshing case list with working onclick...');
    
    const container = document.getElementById('caseListContainer');
    if (!container) {
        console.error('Case list container not found!');
        return;
    }
    
    try {
        // Get cases
        let cases = [];
        if (window.caseManager && window.caseManager.listCases) {
            cases = await window.caseManager.listCases();
        } else {
            // Direct API call
            const apiUrl = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
            const serverAddress = window.tronWeb?.defaultAddress?.base58 || localStorage.getItem('walletAddress') || '';
            
            const response = await fetch(`${apiUrl}/api/cases`, {
                headers: {
                    'X-Server-Address': serverAddress
                }
            });
            cases = await response.json();
        }
        
        if (!cases || cases.length === 0) {
            container.innerHTML = '<p style="color: #666;">No cases found.</p>';
            return;
        }
        
        // Render cases with INLINE onclick that WILL work
        container.innerHTML = cases.map(c => {
            const caseId = c.id || c.caseId;
            return `
                <div style="
                    padding: 15px;
                    margin-bottom: 10px;
                    background: #f5f5f5;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.3s;
                " 
                onmouseover="this.style.background='#e0e0e0'"
                onmouseout="this.style.background='#f5f5f5'"
                onclick="window.viewCaseDetails('${caseId}')">
                    <div style="display: flex; justify-content: space-between;">
                        <div>
                            <strong style="color: #333; font-size: 16px;">Case #${caseId}</strong><br>
                            <small style="color: #666;">
                                Status: ${c.status} | Created: ${new Date(c.created_at).toLocaleDateString()}
                            </small>
                            ${c.description ? `<br><small style="color: #666;">${c.description}</small>` : ''}
                        </div>
                        <div>
                            <button class="btn btn-sm btn-info" 
                                onclick="event.stopPropagation(); window.viewCaseDetails('${caseId}')"
                                style="padding: 5px 10px; font-size: 12px;">
                                View Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        console.log(`✅ Rendered ${cases.length} cases with working onclick handlers`);
        
    } catch (error) {
        console.error('Error refreshing cases:', error);
        container.innerHTML = `<p style="color: red;">Error loading cases: ${error.message}</p>`;
    }
};

// Override the refresh function
window.refreshCaseList = window.forceRefreshCaseList;

// Auto-refresh on tab switch
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabName) {
    if (originalSwitchTab) originalSwitchTab(tabName);
    if (tabName === 'cases') {
        setTimeout(window.forceRefreshCaseList, 100);
    }
};

// Add global click handler as backup
document.addEventListener('click', function(e) {
    // Check for case ID in various places
    const target = e.target;
    const text = target.textContent || '';
    const caseMatch = text.match(/Case #(\S+)/);
    
    if (caseMatch && !target.closest('button')) {
        const caseId = caseMatch[1];
        console.log('Detected case click via text:', caseId);
        window.viewCaseDetails(caseId);
    }
}, true);

// Auto-refresh if on cases tab
setTimeout(() => {
    const casesTab = document.getElementById('casesTab');
    if (casesTab && casesTab.style.display !== 'none') {
        window.forceRefreshCaseList();
    }
}, 1000);

console.log('✅ CASE MODAL FORCED TO WORK!');
console.log('   - viewCaseDetails() is ready');
console.log('   - forceRefreshCaseList() will add working onclick');
console.log('   - Modal WILL appear when clicking cases');
console.log('   Test: window.viewCaseDetails("34-2501-1300")');