// Enhanced recent activities with hybrid data fetching
// Uses backend for speed, blockchain for verification

async function refreshRecentActivitiesHybrid(forceBlockchain = false) {
    console.log('=== refreshRecentActivitiesHybrid CALLED ===');
    const content = document.getElementById('recentActivitiesContent');
    if (!content) {
        console.error('No recentActivitiesContent element found!');
        return;
    }
    
    console.log('Checking dependencies:');
    console.log('- window.legalContract:', !!window.legalContract);
    console.log('- window.tronWeb:', !!window.tronWeb);
    console.log('- window.tronWeb.defaultAddress:', !!window.tronWeb?.defaultAddress);
    console.log('- window.hybridDataService:', !!window.hybridDataService);
    
    if (!window.legalContract || !window.tronWeb || !window.tronWeb.defaultAddress) {
        console.log('Missing dependencies, showing connect wallet message');
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard"></i>
                <h3>Connect wallet to view activity</h3>
                <p>Your recent notices will appear here</p>
            </div>
        `;
        return;
    }
    
    try {
        const userAddress = window.tronWeb.defaultAddress.base58;
        console.log('User address:', userAddress);
        console.log('Force blockchain:', forceBlockchain);
        
        // Show loading state
        content.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Loading recent activity...</div>';
        
        // Use hybrid data service
        console.log('Calling hybridDataService.fetchNoticesHybrid...');
        const result = await window.hybridDataService.fetchNoticesHybrid(userAddress, forceBlockchain);
        console.log('Hybrid service result:', result);
        const notices = result.notices;
        console.log('Notices count:', notices ? notices.length : 0);
        
        // Show source indicator
        const sourceIndicator = result.verified 
            ? '<span class="badge badge-success"><i class="fas fa-check-circle"></i> Blockchain Verified</span>'
            : result.source === 'backend'
            ? '<span class="badge badge-info"><i class="fas fa-database"></i> Cached Data</span>'
            : '<span class="badge badge-primary"><i class="fas fa-link"></i> Blockchain</span>';
        
        if (!notices || notices.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard"></i>
                    <h3>No recent activity</h3>
                    <p>Your served notices will appear here</p>
                    <div style="margin-top: 1rem;">${sourceIndicator}</div>
                </div>
            `;
            return;
        }
        
        // Group notices by case number
        const groupedCases = groupNoticesByCaseNumber(notices);
        
        // Render grouped cases
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div>${sourceIndicator}</div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">
                    ${result.verified ? '' : '<i class="fas fa-info-circle"></i> Verifying with blockchain...'}
                </div>
            </div>
            <div class="activity-list" style="max-height: 500px; overflow-y: auto;">
        `;
        
        for (const caseGroup of groupedCases) {
            const caseId = `case-${caseGroup.case_number.replace(/\s/g, '-')}`;
            const hasAcknowledged = caseGroup.notices.some(n => n.acknowledged);
            
            html += `
                <div class="case-group" style="margin-bottom: 1rem; border: 1px solid var(--border-color); border-radius: 8px;">
                    <div class="case-header" style="padding: 1rem; background: var(--bg-secondary); cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
                         onclick="toggleCaseExpanded('${caseId}')">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fas fa-folder" style="color: var(--accent-blue);"></i>
                                <strong>Case #${caseGroup.case_number}</strong>
                                <span class="badge badge-info" style="font-size: 0.75rem;">
                                    <i class="fas fa-paper-plane"></i> Delivered
                                </span>
                                ${hasAcknowledged ? `
                                    <span class="badge badge-success" style="font-size: 0.75rem;">
                                        <i class="fas fa-check"></i> Document Signed For
                                    </span>
                                ` : `
                                    <span class="badge badge-warning" style="font-size: 0.75rem;">
                                        <i class="fas fa-clock"></i> Awaiting Signature
                                    </span>
                                `}
                                ${!result.verified && caseGroup.notices[0].isBackendData ? `
                                    <span class="badge badge-secondary" style="font-size: 0.75rem;">
                                        <i class="fas fa-sync"></i> Pending Verification
                                    </span>
                                ` : ''}
                            </div>
                            <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                ${caseGroup.notices.length} notice(s) • 
                                Served ${new Date(caseGroup.notices[0].timestamp).toLocaleDateString()}
                            </div>
                        </div>
                        <i class="fas fa-chevron-down" id="${caseId}-icon" style="transition: transform 0.3s;"></i>
                    </div>
                    <div id="${caseId}" class="case-notices" style="display: none; padding: 1rem; border-top: 1px solid var(--border-color);">
                        ${await renderCaseNoticesHybrid(caseGroup.notices, userAddress)}
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        // Add refresh controls
        html += `
            <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button class="btn btn-sm btn-secondary" onclick="refreshRecentActivitiesHybrid()">
                    <i class="fas fa-sync"></i> Refresh
                </button>
                ${!result.verified ? `
                    <button class="btn btn-sm btn-primary" onclick="refreshRecentActivitiesHybrid(true)">
                        <i class="fas fa-link"></i> Verify on Blockchain
                    </button>
                ` : ''}
            </div>
        `;
        
        content.innerHTML = html;
        
        // Listen for blockchain verification completion
        if (!result.verified) {
            const verificationListener = (event) => {
                if (event.detail.serverAddress === userAddress) {
                    console.log('Blockchain verification complete, updating UI...');
                    // Update the source indicator
                    const indicator = content.querySelector('.badge');
                    if (indicator) {
                        indicator.className = 'badge badge-success';
                        indicator.innerHTML = '<i class="fas fa-check-circle"></i> Blockchain Verified';
                    }
                    // Remove verification message
                    const verifyMsg = content.querySelector('.fa-info-circle');
                    if (verifyMsg && verifyMsg.parentElement) {
                        verifyMsg.parentElement.style.display = 'none';
                    }
                    // Remove listener
                    window.removeEventListener('blockchainVerified', verificationListener);
                }
            };
            window.addEventListener('blockchainVerified', verificationListener);
        }
        
    } catch (error) {
        console.error('Error refreshing activities:', error);
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                <h3>Error loading activities</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="refreshRecentActivitiesHybrid()" style="margin-top: 1rem;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// Helper function to format address
function formatAddress(address) {
    if (!address) return 'Unknown';
    return `${address.substring(0, 6)}...${address.slice(-4)}`;
}

// Render case notices with hybrid data
async function renderCaseNoticesHybrid(notices, userAddress) {
    let html = '<div class="notices-list">';
    
    for (const notice of notices) {
        // Each notice can have BOTH an alertId AND a documentId
        // We need to show both as separate items
        const alertId = notice.alertId;
        const documentId = notice.documentId;
        
        // Show Alert NFT if it exists
        if (alertId && alertId !== '0') {
            html += `
                <div class="notice-item" style="display: flex; gap: 1rem; padding: 0.75rem; border-bottom: 1px solid var(--border-color);">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                            <i class="fas fa-bell" style="color: #ff9800;"></i>
                            <strong>Alert NFT #${alertId}</strong>
                            <span class="badge badge-info" style="font-size: 0.7rem;">
                                <i class="fas fa-paper-plane"></i> Delivered
                            </span>
                        </div>
                        
                        <div style="font-size: 0.875rem; color: var(--text-secondary);">
                            <div>To: ${formatAddress(notice.recipient)}</div>
                            <div>Type: ${notice.noticeType || 'Legal Notice'} Alert</div>
                            <div>Purpose: Initial notification in recipient's wallet</div>
                            <div>Status: Successfully delivered to wallet</div>
                            <div>Served: ${new Date(notice.timestamp).toLocaleString()}</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <button class="btn btn-small btn-secondary" 
                                onclick="showAlertReceipt(${alertId}, '${userAddress}')">
                            <i class="fas fa-receipt"></i> Alert Receipt
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Show Document NFT if it exists
        if (documentId && documentId !== '0') {
            // Check if the Alert NFT has been acknowledged - that means the document was signed
            const documentAccepted = notice.acknowledged || false;
            
            html += `
                <div class="notice-item" style="display: flex; gap: 1rem; padding: 0.75rem; border-bottom: 1px solid var(--border-color);">
                    <div style="flex-shrink: 0; width: 50px; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-file-contract" style="font-size: 2rem; color: var(--accent-blue);"></i>
                    </div>
                    
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                            <i class="fas fa-file-alt" style="color: var(--accent-blue);"></i>
                            <strong>Document NFT #${documentId}</strong>
                            ${documentAccepted ? `
                                <span class="badge badge-success" style="font-size: 0.7rem;">
                                    <i class="fas fa-check"></i> Document Signed For
                                </span>
                            ` : `
                                <span class="badge badge-warning" style="font-size: 0.7rem;">
                                    <i class="fas fa-clock"></i> Awaiting Signature
                                </span>
                            `}
                        </div>
                    
                        <div style="font-size: 0.875rem; color: var(--text-secondary);">
                            <div>To: ${formatAddress(notice.recipient)}</div>
                            <div>Type: ${notice.noticeType || 'Legal Notice'}</div>
                            <div>Purpose: Full legal document for signature</div>
                            <div>Status: ${documentAccepted ? 'Document has been signed' : 'Awaiting recipient signature'}</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <button class="btn btn-small btn-primary" 
                                onclick="showDocumentReceipt(${documentId}, '${userAddress}')">
                            <i class="fas fa-file-certificate"></i> Document Receipt
                        </button>
                        <button class="btn btn-small btn-outline" 
                                onclick="viewAuditTrail(${notice.noticeId})">
                            <i class="fas fa-history"></i> Audit Trail
                        </button>
                    </div>
                </div>
            `;
        }
        
        // If neither Alert nor Document ID exists, show generic notice
        if ((!alertId || alertId === '0') && (!documentId || documentId === '0')) {
            const statusBadge = notice.acknowledged 
                ? '<span class="badge badge-success">Acknowledged</span>'
                : '<span class="badge badge-warning">Pending</span>';
            
            html += `
                <div style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${notice.noticeType}</strong>
                            <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                To: ${formatAddress(notice.recipient)}
                            </div>
                            <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                ${new Date(notice.timestamp).toLocaleString()}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            ${statusBadge}
                            <button class="btn btn-sm btn-primary" onclick="viewNoticeDetails('${notice.noticeId}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    html += '</div>';
    return html;
}

// Helper function to group notices by case number
function groupNoticesByCaseNumber(notices) {
    const groups = {};
    
    notices.forEach(notice => {
        const caseNumber = notice.caseNumber || 'Unknown';
        if (!groups[caseNumber]) {
            groups[caseNumber] = {
                case_number: caseNumber,
                notices: []
            };
        }
        groups[caseNumber].notices.push(notice);
    });
    
    // Convert to array and sort by most recent
    return Object.values(groups).sort((a, b) => {
        const aTime = Math.max(...a.notices.map(n => n.timestamp));
        const bTime = Math.max(...b.notices.map(n => n.timestamp));
        return bTime - aTime;
    });
}

// Toggle case expansion
window.toggleCaseExpanded = function(caseId) {
    const caseContent = document.getElementById(caseId);
    const icon = document.getElementById(caseId + '-icon');
    
    if (caseContent && icon) {
        if (caseContent.style.display === 'none') {
            caseContent.style.display = 'block';
            icon.style.transform = 'rotate(180deg)';
        } else {
            caseContent.style.display = 'none';
            icon.style.transform = 'rotate(0deg)';
        }
    }
};

// View notice details
window.viewNoticeDetails = function(noticeId) {
    console.log('Viewing notice:', noticeId);
    // Implement notice details view
};