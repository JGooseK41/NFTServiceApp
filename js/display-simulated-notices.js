/**
 * Display Simulated Notices
 * Shows simulated notices in Recent Served Notices for testing
 */

(function() {
    'use strict';
    
    // Hook into unified system to add simulated notices
    const originalLoadCases = window.unifiedSystem?.loadCases;
    if (window.unifiedSystem && originalLoadCases) {
        window.unifiedSystem.loadCases = async function() {
            // Load real cases first
            await originalLoadCases.call(this);
            
            // Add simulated notices
            const simulatedNotices = JSON.parse(localStorage.getItem('simulatedNotices') || '[]');
            
            simulatedNotices.forEach(notice => {
                // Check if already added
                if (!this.cases[notice.caseNumber]) {
                    this.cases[notice.caseNumber] = {
                        caseNumber: notice.caseNumber,
                        notices: [],
                        recipients: {},
                        timestamp: notice.timestamp,
                        noticeType: 'Legal Notice (SIMULATED)',
                        issuingAgency: 'SIMULATION MODE',
                        simulated: true
                    };
                }
                
                // Add notice to case
                this.cases[notice.caseNumber].notices.push({
                    alertId: notice.alertId,
                    documentId: notice.documentId,
                    recipientAddress: notice.recipient,
                    timestamp: notice.timestamp,
                    status: 'SIMULATED',
                    pageCount: 1,
                    simulated: true
                });
                
                // Add to recipients
                if (!this.cases[notice.caseNumber].recipients[notice.recipient]) {
                    this.cases[notice.caseNumber].recipients[notice.recipient] = [];
                }
                this.cases[notice.caseNumber].recipients[notice.recipient].push({
                    alertId: notice.alertId,
                    documentId: notice.documentId
                });
            });
            
            // Re-render with simulated notices
            this.renderCases();
        };
    }
    
    // Override image loading for simulated notices
    const originalLoadNoticeImage = window.loadNoticeImage;
    if (originalLoadNoticeImage) {
        window.loadNoticeImage = async function(noticeId) {
            // Check if it's a simulated notice
            const simulatedDocs = JSON.parse(localStorage.getItem('simulatedDocuments') || '{}');
            if (simulatedDocs[noticeId]) {
                const container = document.getElementById('noticeImageContainer');
                if (container) {
                    const docData = simulatedDocs[noticeId];
                    const imageUrl = docData.alertImage || docData.thumbnail || docData.documentImage;
                    
                    if (imageUrl) {
                        container.innerHTML = `
                            <div style="text-align: center;">
                                <div style="background: #fef3c7; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
                                    <strong>🎭 SIMULATED NOTICE</strong>
                                </div>
                                <img src="${imageUrl}" alt="Simulated Notice #${noticeId}" style="max-width: 100%;">
                            </div>
                        `;
                    } else {
                        container.innerHTML = `
                            <div style="background: #fef3c7; padding: 20px; border-radius: 8px;">
                                <h3>🎭 Simulated Notice #${noticeId}</h3>
                                <p>This is a simulated notice for testing purposes.</p>
                                <p>No actual blockchain transaction occurred.</p>
                            </div>
                        `;
                    }
                    return;
                }
            }
            
            // Not simulated, use original function
            return originalLoadNoticeImage.call(this, noticeId);
        };
    }
    
    // Add method to unified system for adding simulated notices
    if (window.unifiedSystem) {
        window.unifiedSystem.addSimulatedNotice = function(noticeData) {
            if (!this.cases[noticeData.caseNumber]) {
                this.cases[noticeData.caseNumber] = {
                    caseNumber: noticeData.caseNumber,
                    notices: [],
                    recipients: {},
                    timestamp: noticeData.timestamp,
                    noticeType: noticeData.noticeType + ' (SIMULATED)',
                    issuingAgency: noticeData.issuingAgency,
                    simulated: true
                };
            }
            
            this.cases[noticeData.caseNumber].notices.push({
                alertId: noticeData.alertId,
                documentId: noticeData.documentId,
                recipientAddress: noticeData.recipientAddress,
                timestamp: noticeData.timestamp,
                status: noticeData.status,
                pageCount: noticeData.pageCount,
                simulated: true
            });
            
            // Render immediately
            this.renderCases();
        };
    }
    
    // Add visual indicator for simulated notices
    const style = document.createElement('style');
    style.innerHTML = `
        .simulated-notice {
            position: relative;
            border: 2px dashed #8b5cf6 !important;
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(124, 58, 237, 0.05)) !important;
        }
        
        .simulated-notice::before {
            content: "🎭 SIMULATED";
            position: absolute;
            top: 5px;
            right: 5px;
            background: #8b5cf6;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            z-index: 10;
        }
        
        .simulated-badge {
            display: inline-block;
            background: #8b5cf6;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            margin-left: 5px;
            vertical-align: middle;
        }
    `;
    document.head.appendChild(style);
    
    // Mark simulated notices in DOM
    const markSimulatedNotices = () => {
        const simulatedNotices = JSON.parse(localStorage.getItem('simulatedNotices') || '[]');
        
        simulatedNotices.forEach(notice => {
            // Find notice elements by case number or alert ID
            const elements = document.querySelectorAll(`
                [data-case-number="${notice.caseNumber}"],
                [data-alert-id="${notice.alertId}"],
                [data-notice-id="${notice.alertId}"],
                .case-header:contains("${notice.caseNumber}")
            `);
            
            elements.forEach(el => {
                if (!el.classList.contains('simulated-notice')) {
                    el.classList.add('simulated-notice');
                }
            });
            
            // Also mark by text content
            const caseElements = Array.from(document.querySelectorAll('.case-header, .notice-item'));
            caseElements.forEach(el => {
                if (el.textContent.includes(notice.caseNumber) || 
                    el.textContent.includes(notice.alertId)) {
                    if (!el.classList.contains('simulated-notice')) {
                        el.classList.add('simulated-notice');
                    }
                }
            });
        });
    };
    
    // Run marking periodically
    setInterval(markSimulatedNotices, 2000);
    
    // Clear simulated notices function
    window.clearSimulatedNotices = function() {
        localStorage.removeItem('simulatedNotices');
        localStorage.removeItem('simulatedDocuments');
        console.log('✅ Cleared all simulated notices');
        
        // Refresh display
        if (window.unifiedSystem?.loadCases) {
            window.unifiedSystem.loadCases();
        }
    };
    
    console.log('✅ Simulated notice display system loaded');
    console.log('Simulated notices will appear in Recent Served Notices with 🎭 indicator');
    console.log('Run clearSimulatedNotices() to remove all simulated data');
})();