/**
 * Fix Case Data Display
 * Ensures case data is properly loaded and displayed in modals
 */

console.log('🔧 Fixing case data display...');

// Store the original viewCaseDetails if it exists
const originalViewCaseDetails = window.viewCaseDetails;

window.viewCaseDetails = async function(caseId) {
    console.log(`📂 Opening case modal for: ${caseId}`);
    
    // Remove any existing modals
    document.querySelectorAll('.case-details-modal, .case-modal-overlay, .modal').forEach(m => m.remove());
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'case-details-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
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
        right: 15px;
        font-size: 30px;
        background: none;
        border: none;
        cursor: pointer;
        color: #666;
        z-index: 1;
    `;
    closeBtn.onclick = () => modal.remove();
    
    content.appendChild(closeBtn);
    
    // Initial content with loading state
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = `
        <h2 style="margin-top: 0;">Case #${caseId}</h2>
        <div id="caseContent">
            <p>Loading case details...</p>
        </div>
    `;
    content.appendChild(contentDiv);
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Click outside to close
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    try {
        // Try to get case data from the unified system first
        let caseData = null;
        
        // Check if we have the case in our local system
        if (window.unifiedNoticeSystem && window.unifiedNoticeSystem.cases) {
            const localCase = window.unifiedNoticeSystem.cases.find(c => 
                c.id === caseId || 
                c.caseId === caseId ||
                c.case_id === caseId
            );
            
            if (localCase) {
                console.log('Found case in local system:', localCase);
                caseData = localCase;
            }
        }
        
        // If not found locally, try to parse the case ID for information
        if (!caseData) {
            // Case IDs often contain timestamp and other data
            // Format: CASE-timestamp-hash
            const parts = caseId.split('-');
            
            caseData = {
                id: caseId,
                status: 'prepared',
                created_at: parts[1] ? new Date(parseInt(parts[1])).toISOString() : new Date().toISOString(),
                description: 'Case prepared for service',
                document_count: 0,
                documents: [],
                recipients: []
            };
            
            // Try to find related notices
            if (window.unifiedNoticeSystem && window.unifiedNoticeSystem.notices) {
                const relatedNotices = window.unifiedNoticeSystem.notices.filter(n => {
                    // Check if notice belongs to this case
                    const noticeCase = n.case_number || n.caseNumber || n.case_id;
                    return noticeCase && noticeCase.includes(caseId.split('-').pop());
                });
                
                if (relatedNotices.length > 0) {
                    console.log('Found related notices:', relatedNotices);
                    
                    // Extract data from notices
                    caseData.document_count = relatedNotices.length;
                    caseData.status = relatedNotices.some(n => n.status === 'served') ? 'served' : 'pending';
                    
                    // Get recipients from notices
                    const recipientSet = new Set();
                    relatedNotices.forEach(n => {
                        if (n.recipient_address) recipientSet.add(n.recipient_address);
                        if (n.recipientAddress) recipientSet.add(n.recipientAddress);
                    });
                    
                    caseData.recipients = Array.from(recipientSet).map(addr => ({
                        recipient_address: addr,
                        status: 'served'
                    }));
                    
                    // Get documents
                    caseData.documents = relatedNotices.map(n => ({
                        name: n.description || `Notice #${n.alert_id || n.alertId || n.id}`,
                        type: n.type || 'notice',
                        alert_id: n.alert_id || n.alertId,
                        document_id: n.document_id || n.documentId
                    }));
                }
            }
        }
        
        // Try API as fallback (might fail due to CORS)
        if (!caseData || caseData.document_count === 0) {
            try {
                const apiUrl = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
                const serverAddress = window.tronWeb?.defaultAddress?.base58 || localStorage.getItem('walletAddress') || '';
                
                const response = await fetch(`${apiUrl}/api/cases/${caseId}`, {
                    headers: { 
                        'X-Server-Address': serverAddress,
                        'Accept': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const apiData = await response.json();
                    // Merge API data with local data
                    caseData = { ...caseData, ...apiData };
                }
            } catch (apiError) {
                console.log('API fetch failed (expected due to CORS), using local data');
            }
        }
        
        // Display the case data
        const displayContent = document.getElementById('caseContent');
        if (displayContent) {
            displayContent.innerHTML = `
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <h3 style="margin-top: 0; color: #333;">📋 Case Information</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                        <div>
                            <strong>Case ID:</strong><br>
                            <span style="font-family: monospace; color: #666;">${caseData.id || caseId}</span>
                        </div>
                        <div>
                            <strong>Status:</strong><br>
                            <span style="
                                display: inline-block;
                                padding: 3px 8px;
                                border-radius: 3px;
                                background: ${caseData.status === 'served' ? '#28a745' : '#ffc107'};
                                color: white;
                                font-size: 12px;
                            ">${caseData.status || 'Prepared'}</span>
                        </div>
                        <div>
                            <strong>Created:</strong><br>
                            ${caseData.created_at ? new Date(caseData.created_at).toLocaleString() : 'Recently'}
                        </div>
                        <div>
                            <strong>Documents:</strong><br>
                            ${caseData.document_count || caseData.documents?.length || 0} file(s)
                        </div>
                    </div>
                    ${caseData.description ? `
                        <div style="margin-top: 15px;">
                            <strong>Description:</strong><br>
                            ${caseData.description}
                        </div>
                    ` : ''}
                </div>
                
                ${caseData.documents && caseData.documents.length > 0 ? `
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <h3 style="margin-top: 0; color: #333;">📄 Documents</h3>
                        ${caseData.documents.map((doc, idx) => `
                            <div style="
                                padding: 10px;
                                margin: 5px 0;
                                background: white;
                                border-radius: 5px;
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                            ">
                                <div>
                                    <strong>${doc.name || `Document ${idx + 1}`}</strong>
                                    ${doc.alert_id ? `<br><small style="color: #666;">Alert ID: ${doc.alert_id}</small>` : ''}
                                    ${doc.document_id ? `<br><small style="color: #666;">Doc ID: ${doc.document_id}</small>` : ''}
                                </div>
                                ${doc.url ? `
                                    <button onclick="window.open('${doc.url}', '_blank')" style="
                                        padding: 5px 10px;
                                        background: #007bff;
                                        color: white;
                                        border: none;
                                        border-radius: 3px;
                                        cursor: pointer;
                                    ">View</button>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${caseData.recipients && caseData.recipients.length > 0 ? `
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                        <h3 style="margin-top: 0; color: #333;">👥 Recipients</h3>
                        ${caseData.recipients.map(r => `
                            <div style="
                                padding: 10px;
                                margin: 5px 0;
                                background: white;
                                border-radius: 5px;
                                font-family: monospace;
                                font-size: 12px;
                            ">
                                ${r.recipient_address || r.address || 'Unknown'}
                                ${r.status ? `
                                    <span style="
                                        float: right;
                                        padding: 2px 6px;
                                        background: ${r.status === 'served' ? '#28a745' : '#6c757d'};
                                        color: white;
                                        border-radius: 3px;
                                        font-size: 11px;
                                    ">${r.status}</span>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${(!caseData.documents || caseData.documents.length === 0) && 
                  (!caseData.recipients || caseData.recipients.length === 0) ? `
                    <div style="
                        padding: 20px;
                        background: #fff3cd;
                        border: 1px solid #ffc107;
                        border-radius: 5px;
                        text-align: center;
                    ">
                        <p style="margin: 0; color: #856404;">
                            This case is prepared and ready for service.
                            No documents have been served yet.
                        </p>
                    </div>
                ` : ''}
                
                <div style="margin-top: 20px; text-align: right;">
                    <button onclick="this.closest('.case-details-modal').remove()" style="
                        padding: 8px 20px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-right: 10px;
                    ">Close</button>
                    ${window.resumeCase ? `
                        <button onclick="window.resumeCase('${caseId}'); this.closest('.case-details-modal').remove();" style="
                            padding: 8px 20px;
                            background: #28a745;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                        ">Resume Case</button>
                    ` : ''}
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading case:', error);
        document.getElementById('caseContent').innerHTML = `
            <div style="
                padding: 20px;
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                border-radius: 5px;
                color: #721c24;
            ">
                <p style="margin: 0;">
                    Unable to load complete case details.
                    <br><br>
                    Case ID: <strong>${caseId}</strong>
                </p>
            </div>
        `;
    }
};

// Also create a function to manually populate case data
window.populateCaseData = function(caseId, data) {
    if (!window.caseDataStore) {
        window.caseDataStore = {};
    }
    window.caseDataStore[caseId] = data;
    console.log(`Case data populated for ${caseId}:`, data);
};

console.log('✅ Case data display fix applied!');
console.log('   - Modal will show case information from local data');
console.log('   - Handles CORS errors gracefully');
console.log('   - Falls back to parsing case ID for basic info');