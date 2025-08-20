// Get contract address from window or use default
const CONTRACT_ADDRESS = window.CONTRACT_ADDRESS || 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

// Enhanced recent activities with case grouping
async function refreshRecentActivitiesGrouped(forceRefresh = false) {
    const content = document.getElementById('recentActivitiesContent');
    if (!content) return;
    
    if (!window.legalContract || !window.tronWeb || !window.tronWeb.defaultAddress) {
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
        console.log('Fetching grouped activities for:', userAddress);
        
        content.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Loading recent activity...</div>';
        
        // Try backend first for grouped data
        let groupedCases = [];
        
        if (window.BACKEND_API_URL) {
            try {
                const response = await fetch(`${window.BACKEND_API_URL}/api/documents/server/${userAddress}/cases`);
                if (response.ok) {
                    const data = await response.json();
                    groupedCases = data.cases || [];
                    console.log('Backend grouped cases:', groupedCases);
                }
            } catch (e) {
                console.log('Backend not available, falling back to blockchain:', e);
            }
        }
        
        // If no backend data, fetch from blockchain and group manually
        if (groupedCases.length === 0) {
            console.log('Backend failed or returned no data, fetching from blockchain...');
            
            try {
                const notices = [];
                
                // First try to get notices directly from contract without events (avoids rate limiting)
                console.log('Checking contract for recent notices...');
                
                // Check first 20 alert IDs directly from contract
                for (let i = 1; i <= 20; i++) {
                    try {
                        const alertData = await window.legalContract.alertNotices(i).call();
                        
                        // Check if this alert exists and belongs to our server
                        if (alertData && alertData[1]) {
                            const alertServer = window.tronWeb.address.fromHex(alertData[1]);
                            
                            if (alertServer === userAddress) {
                                const acknowledged = alertData[4] || false;
                                const documentId = alertData[2];
                                const recipient = window.tronWeb.address.fromHex(alertData[0]);
                                const timestamp = Number(alertData[3]) * 1000;
                                const noticeType = alertData[6] || 'Legal Notice';
                                const caseNumber = alertData[7] || 'Unknown';
                                
                                const notice = {
                                    noticeId: i.toString(),
                                    alertId: i.toString(),
                                    documentId: documentId ? documentId.toString() : '',
                                    recipient: recipient,
                                    timestamp: timestamp,
                                    alert_acknowledged: acknowledged,
                                    document_accepted: acknowledged,
                                    caseNumber: caseNumber,
                                    noticeType: noticeType,
                                    served_at: timestamp
                                };
                                
                                notices.push(notice);
                                console.log(`Found notice ${i} from direct query:`, notice);
                            }
                        }
                    } catch (e) {
                        // Alert doesn't exist or error, continue
                        break; // If we hit a non-existent alert, stop checking
                    }
                }
                
                // If we found notices via direct query, use those
                if (notices.length > 0) {
                    groupedCases = groupNoticesByCaseNumber(notices);
                    console.log('Grouped cases from direct query:', groupedCases);
                } else {
                    // Fall back to events if no notices found directly
                    console.log('No notices found via direct query, trying events...');
                    
                    try {
                        // Query blockchain events for notices served by this address
                        const events = await window.tronWeb.event.getEventsByContractAddress(
                            CONTRACT_ADDRESS,
                            {
                                eventName: 'NoticeServed',
                                onlyConfirmed: true,
                                orderBy: 'block_timestamp,desc',
                                limit: 50
                            }
                        );
                        
                        console.log('NoticeServed events:', events);
                        
                        // Also check for LegalNoticeCreated events
                        const createdEvents = await window.tronWeb.event.getEventsByContractAddress(
                            CONTRACT_ADDRESS,
                            {
                                eventName: 'LegalNoticeCreated',
                                onlyConfirmed: true,
                                orderBy: 'block_timestamp,desc',
                                limit: 50
                            }
                        );
                        
                                console.log('LegalNoticeCreated events:', createdEvents);
                        
                        // Process events to find notices from this server
                        const processedIds = new Set();
                        const allEvents = [];
                        
                        if (events && events.data) {
                            allEvents.push(...events.data);
                        }
                        if (createdEvents && createdEvents.data) {
                            allEvents.push(...createdEvents.data);
                        }
                        
                        for (const event of allEvents) {
                            try {
                                // Check if this event is from our server
                                let serverAddress = null;
                                if (event.result.server) {
                                    serverAddress = window.tronWeb.address.fromHex(event.result.server);
                                }
                                
                                if (serverAddress !== userAddress) {
                                    continue; // Skip if not from this server
                                }
                                
                                // Get the alert ID from the event
                                const alertId = event.result.alertId || event.result.noticeId;
                                if (!alertId || processedIds.has(alertId.toString())) {
                                    continue; // Skip if already processed
                                }
                                
                                processedIds.add(alertId.toString());
                                
                                // Fetch alert data from contract
                                const alertData = await window.legalContract.alertNotices(alertId).call();
                                console.log(`Alert ${alertId} data:`, alertData);
                                
                                if (!alertData || !alertData[0]) {
                                    continue; // Skip if no data
                                }
                                
                                // Parse alert data
                                const acknowledged = alertData[4] || false;
                                const documentId = alertData[2];
                                const recipient = window.tronWeb.address.fromHex(alertData[0]);
                                const timestamp = Number(alertData[3]) * 1000;
                                const noticeType = alertData[6] || 'Legal Notice';
                                const caseNumber = alertData[7] || 'Unknown';
                                
                                // Create notice object
                                const notice = {
                                    noticeId: alertId.toString(),
                                    alertId: alertId.toString(),
                                    documentId: documentId ? documentId.toString() : '',
                                    recipient: recipient,
                                    timestamp: timestamp,
                                    alert_acknowledged: acknowledged,
                                    document_accepted: acknowledged,
                                    caseNumber: caseNumber,
                                    noticeType: noticeType,
                                    served_at: timestamp
                                };
                                
                                notices.push(notice);
                                console.log('Added notice from event:', notice);
                                
                            } catch (e) {
                                console.error('Error processing event:', e);
                            }
                        }
                        
                        if (notices.length > 0) {
                            groupedCases = groupNoticesByCaseNumber(notices);
                            console.log('Grouped cases from events:', groupedCases);
                        }
                        
                    } catch (e) {
                        console.error('Error fetching event data:', e);
                    }
                }
                
            } catch (e) {
                console.error('Error fetching notices from blockchain:', e);
            }
        }
        
        if (groupedCases.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard"></i>
                    <h3>No recent activity</h3>
                    <p>Your served notices will appear here</p>
                </div>
            `;
            return;
        }
        
        // Render grouped cases
        let html = '<div class="activity-list" style="max-height: 500px; overflow-y: auto;">';
        
        for (const caseGroup of groupedCases) {
            const caseId = `case-${caseGroup.case_number.replace(/\s/g, '-')}`;
            // Document is signed if any notice has alert_acknowledged true
            const hasSignedDocument = caseGroup.notices.some(n => n.alert_acknowledged || n.document_accepted);
            const allDelivered = true; // Alert NFTs are always delivered once created
            
            // Render case notices first (since it's async)
            const noticesHtml = await renderCaseNotices(caseGroup.notices, userAddress);
            
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
                                ${hasSignedDocument ? `
                                    <span class="badge badge-success" style="font-size: 0.75rem;">
                                        <i class="fas fa-check"></i> Document Signed For
                                    </span>
                                ` : `
                                    <span class="badge badge-warning" style="font-size: 0.75rem;">
                                        <i class="fas fa-clock"></i> Awaiting Signature
                                    </span>
                                `}
                            </div>
                            <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                ${caseGroup.notice_count || caseGroup.notices.length} notice(s) • 
                                Served ${new Date(caseGroup.first_served || caseGroup.notices[0].served_at).toLocaleDateString()}
                            </div>
                        </div>
                        <i class="fas fa-chevron-down" id="${caseId}-icon" style="transition: transform 0.3s;"></i>
                    </div>
                    
                    <div id="${caseId}" class="case-details" style="display: none; padding: 1rem; border-top: 1px solid var(--border-color);">
                        ${noticesHtml}
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        content.innerHTML = html;
        
    } catch (error) {
        console.error('Error refreshing grouped activities:', error);
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error loading activity</h3>
                <p>Unable to fetch recent notices</p>
            </div>
        `;
    }
}

// Render individual notices within a case
async function renderCaseNotices(notices, userAddress) {
    let html = '<div class="notices-list">';
    
    for (const notice of notices) {
        // Properly identify Alert vs Document based on the notice structure
        // Each notice can have BOTH an alert_id AND a document_id
        // We need to show both as separate items
        const alertId = notice.alert_id;
        const documentId = notice.document_id;
        
        // Show Alert NFT if it exists
        if (alertId) {
            html += `
                <div class="notice-item" style="display: flex; gap: 1rem; padding: 0.75rem; border-bottom: 1px solid var(--border-color);">
                    ${notice.thumbnail_url ? `
                        <div style="flex-shrink: 0;">
                            <img src="${window.BACKEND_API_URL}${notice.thumbnail_url}" 
                                 alt="Notice thumbnail" 
                                 style="width: 50px; height: 65px; object-fit: cover; border: 1px solid var(--border-color); border-radius: 4px;">
                        </div>
                    ` : ''}
                    
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                            <i class="fas fa-bell" style="color: var(--warning-orange);"></i>
                            <strong>Alert NFT #${alertId}</strong>
                            <span class="badge badge-info" style="font-size: 0.7rem;">
                                <i class="fas fa-paper-plane"></i> Delivered
                            </span>
                        </div>
                        
                        <div style="font-size: 0.875rem; color: var(--text-secondary);">
                            <div>To: ${formatAddress(notice.recipient)}</div>
                            <div>Type: ${notice.notice_type || 'Legal Notice'} Alert</div>
                            <div>Purpose: Initial notification in recipient's wallet</div>
                            <div>Status: Successfully delivered to wallet</div>
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
        if (documentId) {
            // Check if the Alert NFT has been acknowledged - that means the document was signed
            const documentAccepted = notice.alert_acknowledged || notice.document_accepted || false;
            
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
                        <div>Type: ${notice.notice_type || 'Legal Notice'}</div>
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
                            onclick="viewAuditTrail(${notice.notice_id})">
                        <i class="fas fa-history"></i> Audit Trail
                    </button>
                </div>
            </div>
            `;
        }
    }
    
    html += '</div>';
    return html;
}

// Toggle case expanded/collapsed
window.toggleCaseExpanded = function(caseId) {
    const details = document.getElementById(caseId);
    const icon = document.getElementById(`${caseId}-icon`);
    
    if (details && icon) {
        if (details.style.display === 'none') {
            details.style.display = 'block';
            icon.style.transform = 'rotate(180deg)';
        } else {
            details.style.display = 'none';
            icon.style.transform = 'rotate(0deg)';
        }
    }
}

// Group notices by case number
function groupNoticesByCaseNumber(notices) {
    const grouped = {};
    
    for (const notice of notices) {
        const caseNumber = notice.caseNumber || 'Unknown';
        if (!grouped[caseNumber]) {
            grouped[caseNumber] = {
                case_number: caseNumber,
                notices: [],
                first_served: notice.timestamp,
                last_served: notice.timestamp
            };
        }
        
        grouped[caseNumber].notices.push({
            notice_id: notice.noticeId,
            alert_id: notice.alertId,
            document_id: notice.documentId,
            recipient: notice.recipient,
            alert_acknowledged: notice.acknowledged,
            document_accepted: notice.acknowledged, // If alert is acknowledged, document is signed
            thumbnail_url: notice.previewImage,
            notice_type: notice.noticeType,
            served_at: notice.timestamp
        });
        
        // Update first/last served dates
        if (notice.timestamp < grouped[caseNumber].first_served) {
            grouped[caseNumber].first_served = notice.timestamp;
        }
        if (notice.timestamp > grouped[caseNumber].last_served) {
            grouped[caseNumber].last_served = notice.timestamp;
        }
    }
    
    // Convert to array and sort by most recent
    return Object.values(grouped).sort((a, b) => b.last_served - a.last_served);
}

// Fetch notices from blockchain (reuse existing logic)
async function fetchNoticesFromBlockchain(userAddress) {
    // This would use the existing logic from refreshRecentActivities
    // to fetch notices from the contract
    let notices = [];
    
    try {
        console.log('fetchNoticesFromBlockchain called for:', userAddress);
        console.log('window.legalContract exists?', !!window.legalContract);
        console.log('window.legalContract.getServerNotices exists?', !!(window.legalContract && window.legalContract.getServerNotices));
        
        if (window.legalContract && window.legalContract.getServerNotices) {
            console.log('Calling getServerNotices for:', userAddress);
            const noticeIds = await window.legalContract.getServerNotices(userAddress).call();
            console.log('Notice IDs from contract:', noticeIds);
            
            for (const noticeId of noticeIds) {
                const id = noticeId.toString();
                console.log('Fetching notice data for ID:', id);
                const noticeData = await window.legalContract.notices(id).call();
                console.log('Notice data:', noticeData);
                
                if (noticeData) {
                    const alertId = noticeData.alertId || noticeData[0];
                    const documentId = noticeData.documentId || noticeData[1];
                    
                    // Get alert data for preview and acknowledgment
                    let previewImage = '';
                    let acknowledged = false;
                    if (alertId && alertId.toString() !== '0') {
                        try {
                            const alertData = await window.legalContract.alertNotices(alertId).call();
                            previewImage = alertData.previewImage || alertData[11] || '';
                            acknowledged = alertData.acknowledged || alertData[4] || false;
                        } catch(e) {}
                    }
                    
                    notices.push({
                        noticeId: id,
                        alertId: alertId ? alertId.toString() : '',
                        documentId: documentId ? documentId.toString() : '',
                        recipient: window.tronWeb.address.fromHex(noticeData.recipient || noticeData[3]),
                        timestamp: Number(noticeData.timestamp || noticeData[4]) * 1000,
                        acknowledged: acknowledged,
                        noticeType: noticeData.noticeType || noticeData[6] || 'Legal Notice',
                        caseNumber: noticeData.caseNumber || noticeData[7] || '',
                        previewImage: previewImage
                    });
                }
            }
        }
    } catch(e) {
        console.error('Error fetching notices from blockchain:', e);
    }
    
    return notices;
}

// Show Alert NFT receipt with thumbnail and description
async function showAlertReceipt(alertId, serverAddress) {
    try {
        // Get alert data from contract
        const alertData = await window.legalContract.alertNotices(alertId).call();
        
        // Get additional data from backend if available
        let backendData = null;
        if (window.BACKEND_API_URL) {
            try {
                const response = await fetch(`${window.BACKEND_API_URL}/api/documents/notice/${alertId}/receipt-data?serverAddress=${serverAddress}`);
                if (response.ok) {
                    backendData = await response.json();
                }
            } catch(e) {}
        }
        
        const thumbnailUrl = backendData?.notice?.alert_thumbnail_full_url || alertData.previewImage || alertData[11];
        const nftDescription = backendData?.notice?.alert_nft_description || `Legal Notice Alert - ${alertData[6] || 'Document'}`;
        
        // Create receipt modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px; background: white; color: #1e293b;">
                <div class="modal-header">
                    <h3 style="color: #1e293b;">Alert NFT Receipt - ID #${alertId}</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body" style="color: #1e293b;">
                    <div class="receipt-content" style="background: #f8f9fa; padding: 1.5rem; border-radius: 8px;">
                        <h4 style="text-align: center; margin-bottom: 1rem; color: #1e293b;">ALERT NFT SERVICE RECEIPT</h4>
                        
                        ${thumbnailUrl ? `
                            <div style="text-align: center; margin-bottom: 1.5rem;">
                                <img src="${thumbnailUrl}" alt="Notice preview" 
                                     style="max-width: 300px; max-height: 400px; border: 2px solid #333;">
                                <div style="margin-top: 0.5rem; font-size: 0.875rem; color: #64748b;">
                                    Alert NFT Thumbnail
                                </div>
                            </div>
                        ` : ''}
                        
                        <div style="background: white; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
                            <h5 style="color: #1e293b; margin-bottom: 0.5rem;">NFT Description</h5>
                            <div style="color: #475569; white-space: pre-wrap;">${nftDescription}</div>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <h5 style="color: #1e293b;">Alert Details</h5>
                            <table style="width: 100%; font-size: 0.9rem;">
                                <tr><td><strong>Alert ID:</strong></td><td>${alertId}</td></tr>
                                <tr><td><strong>Recipient:</strong></td><td>${window.tronWeb.address.fromHex(alertData[0])}</td></tr>
                                <tr><td><strong>Sender:</strong></td><td>${window.tronWeb.address.fromHex(alertData[1])}</td></tr>
                                <tr><td><strong>Document ID:</strong></td><td>${alertData[2]}</td></tr>
                                <tr><td><strong>Timestamp:</strong></td><td>${new Date(Number(alertData[3]) * 1000).toLocaleString()}</td></tr>
                                <tr><td><strong>Acknowledged:</strong></td><td>${alertData[4] ? '✅ Yes' : '❌ No'}</td></tr>
                            </table>
                        </div>
                        
                        <div class="alert alert-info" style="background: #dbeafe; border: 1px solid #3b82f6; padding: 1rem; border-radius: 4px;">
                            <i class="fas fa-info-circle"></i> 
                            This Alert NFT serves as the initial notification to the recipient. 
                            It appears in their wallet with the thumbnail and description shown above.
                        </div>
                        
                        <!-- Process Server Certification Section -->
                        <div style="margin-top: 2rem; border: 2px solid #333; padding: 1.5rem; background: white;">
                            <h5 style="text-align: center; color: #1e293b; margin-bottom: 1rem;">PROCESS SERVER CERTIFICATION</h5>
                            
                            <div style="margin-bottom: 1.5rem;">
                                <div style="margin-bottom: 0.5rem; font-weight: bold;">I hereby certify under penalty of perjury that:</div>
                                <div style="font-size: 0.9rem; line-height: 1.5;">
                                    I am over the age of 18, not a party to this action, and authorized to serve legal process.
                                    The above-described legal notice was served as indicated.
                                </div>
                            </div>
                            
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 1rem; border-bottom: 2px solid #333; width: 50%;">
                                        <div style="font-weight: bold; margin-bottom: 0.5rem;">Process Server Name (Print):</div>
                                        <div style="height: 40px; border-bottom: 1px solid #999;"></div>
                                    </td>
                                    <td style="padding: 1rem; border-bottom: 2px solid #333; width: 50%;">
                                        <div style="font-weight: bold; margin-bottom: 0.5rem;">Server ID/License #:</div>
                                        <div style="height: 40px; border-bottom: 1px solid #999;"></div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 1rem; width: 50%;">
                                        <div style="font-weight: bold; margin-bottom: 0.5rem;">Process Server Signature:</div>
                                        <div style="height: 60px; border-bottom: 1px solid #999;"></div>
                                    </td>
                                    <td style="padding: 1rem; width: 50%;">
                                        <div style="font-weight: bold; margin-bottom: 0.5rem;">Date Signed:</div>
                                        <div style="height: 60px; border-bottom: 1px solid #999;"></div>
                                    </td>
                                </tr>
                            </table>
                            
                            <div style="margin-top: 1rem; padding: 0.75rem; background: #f8f9fa; font-size: 0.875rem;">
                                <strong>Server Wallet Address:</strong> ${window.tronWeb && window.tronWeb.defaultAddress ? window.tronWeb.defaultAddress.base58 : serverAddress}<br>
                                <strong>Blockchain Network:</strong> TRON Mainnet<br>
                                <strong>Alert NFT ID:</strong> ${alertId}
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 1rem; text-align: center;">
                        <button class="btn btn-primary" onclick="printAlertReceipt(${alertId})">
                            <i class="fas fa-print"></i> Print Receipt
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Error showing alert receipt:', error);
        alert('Failed to load alert receipt');
    }
}

// Show Document NFT receipt with full unencrypted document
async function showDocumentReceipt(documentId, serverAddress) {
    try {
        // Get document data from contract
        const docData = await window.legalContract.documentNotices(documentId).call();
        
        // Get unencrypted document from backend
        let backendData = null;
        if (window.BACKEND_API_URL) {
            try {
                // Find the notice that contains this document
                const response = await fetch(`${window.BACKEND_API_URL}/api/documents/notice/${documentId}/receipt-data?serverAddress=${serverAddress}`);
                if (response.ok) {
                    backendData = await response.json();
                }
            } catch(e) {}
        }
        
        const unencryptedDocUrl = backendData?.notice?.document_unencrypted_full_url;
        
        // Create receipt modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; background: white; color: #1e293b;">
                <div class="modal-header">
                    <h3 style="color: #1e293b;">Document NFT Receipt - ID #${documentId}</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body" style="color: #1e293b;">
                    <div class="receipt-content" style="background: #f8f9fa; padding: 1.5rem; border-radius: 8px;">
                        <h4 style="text-align: center; margin-bottom: 1rem; color: #1e293b;">DOCUMENT NFT SERVICE RECEIPT</h4>
                        
                        ${unencryptedDocUrl ? `
                            <div style="text-align: center; margin-bottom: 1.5rem;">
                                <img src="${unencryptedDocUrl}" alt="Legal document" 
                                     style="max-width: 100%; border: 2px solid #333;">
                                <div style="margin-top: 0.5rem; font-size: 0.875rem; color: #64748b;">
                                    Full Legal Document (Unencrypted)
                                </div>
                            </div>
                        ` : '<div class="alert alert-warning">Unencrypted document not available. Only the encrypted version exists on IPFS.</div>'}
                        
                        <div style="margin-bottom: 1rem;">
                            <h5 style="color: #1e293b;">Document Details</h5>
                            <table style="width: 100%; font-size: 0.9rem;">
                                <tr><td><strong>Document ID:</strong></td><td>${documentId}</td></tr>
                                <tr><td><strong>IPFS Hash:</strong></td><td style="word-break: break-all;">${docData[0] || 'Not available'}</td></tr>
                                <tr><td><strong>Authorized Viewer:</strong></td><td>${window.tronWeb.address.fromHex(docData[2])}</td></tr>
                                <tr><td><strong>Alert ID:</strong></td><td>${docData[3]}</td></tr>
                                <tr><td><strong>Restricted:</strong></td><td>${docData[4] ? '🔒 Yes' : '🔓 No'}</td></tr>
                            </table>
                        </div>
                        
                        <div class="alert alert-success" style="background: #d4edda; border: 1px solid #28a745; padding: 1rem; border-radius: 4px;">
                            <i class="fas fa-shield-alt"></i> 
                            This Document NFT contains the full legal document. 
                            The recipient must acknowledge the Alert NFT to access this document.
                            The unencrypted version shown here is only accessible to the process server.
                        </div>
                        
                        <!-- Process Server Certification Section -->
                        <div style="margin-top: 2rem; border: 2px solid #333; padding: 1.5rem; background: white;">
                            <h5 style="text-align: center; color: #1e293b; margin-bottom: 1rem;">PROCESS SERVER CERTIFICATION</h5>
                            
                            <div style="margin-bottom: 1.5rem;">
                                <div style="margin-bottom: 0.5rem; font-weight: bold;">I hereby certify under penalty of perjury that:</div>
                                <div style="font-size: 0.9rem; line-height: 1.5;">
                                    I am over the age of 18, not a party to this action, and authorized to serve legal process.
                                    The above legal document was served electronically via blockchain NFT as indicated.
                                    The document shown above is a true and correct copy of the document served.
                                </div>
                            </div>
                            
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 1rem; border-bottom: 2px solid #333; width: 50%;">
                                        <div style="font-weight: bold; margin-bottom: 0.5rem;">Process Server Name (Print):</div>
                                        <div style="height: 40px; border-bottom: 1px solid #999;"></div>
                                    </td>
                                    <td style="padding: 1rem; border-bottom: 2px solid #333; width: 50%;">
                                        <div style="font-weight: bold; margin-bottom: 0.5rem;">Server ID/License #:</div>
                                        <div style="height: 40px; border-bottom: 1px solid #999;"></div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 1rem; width: 50%;">
                                        <div style="font-weight: bold; margin-bottom: 0.5rem;">Process Server Signature:</div>
                                        <div style="height: 60px; border-bottom: 1px solid #999;"></div>
                                    </td>
                                    <td style="padding: 1rem; width: 50%;">
                                        <div style="font-weight: bold; margin-bottom: 0.5rem;">Date Signed:</div>
                                        <div style="height: 60px; border-bottom: 1px solid #999;"></div>
                                    </td>
                                </tr>
                            </table>
                            
                            <div style="margin-top: 1rem; padding: 0.75rem; background: #f8f9fa; font-size: 0.875rem;">
                                <strong>Server Wallet Address:</strong> ${window.tronWeb && window.tronWeb.defaultAddress ? window.tronWeb.defaultAddress.base58 : serverAddress}<br>
                                <strong>Blockchain Network:</strong> TRON Mainnet<br>
                                <strong>Document NFT ID:</strong> ${documentId}<br>
                                <strong>IPFS Hash:</strong> ${docData[0] || 'Not available'}
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 1rem; text-align: center;">
                        <button class="btn btn-primary" onclick="printDocumentReceipt(${documentId})">
                            <i class="fas fa-print"></i> Print Receipt
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Error showing document receipt:', error);
        alert('Failed to load document receipt');
    }
}

// Export functions to window
window.refreshRecentActivitiesGrouped = refreshRecentActivitiesGrouped;
window.toggleCaseExpanded = toggleCaseExpanded;
window.showAlertReceipt = showAlertReceipt;
window.showDocumentReceipt = showDocumentReceipt;