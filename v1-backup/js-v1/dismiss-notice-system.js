/**
 * DISMISS NOTICE SYSTEM
 * Allows process servers to dismiss notices from recent view
 * Dismissed notices remain accessible in "Served Notices" tab
 */

console.log('📋 IMPLEMENTING DISMISS NOTICE SYSTEM');
console.log('=' .repeat(70));

window.DismissNoticeSystem = {
    
    // Store dismissed notice IDs in localStorage
    dismissedNotices: JSON.parse(localStorage.getItem('dismissedNotices') || '[]'),
    
    init() {
        console.log('Initializing dismiss notice system...');
        
        // Rename "Delivery Status" tab to "Served Notices"
        this.renameDeliveryTab();
        
        // Add dismiss buttons to recent notices
        this.addDismissButtons();
        
        // Filter recent notices view
        this.filterRecentNotices();
        
        // Set up observer for new notices
        this.observeChanges();
        
        console.log(`✅ System initialized. ${this.dismissedNotices.length} notices currently dismissed.`);
    },
    
    renameDeliveryTab() {
        // Find and rename the Delivery Status tab
        const tabs = document.querySelectorAll('.tab-button, .nav-link, button');
        tabs.forEach(tab => {
            if (tab.textContent.includes('Delivery Status')) {
                tab.innerHTML = tab.innerHTML.replace('Delivery Status', '📂 Served Notices');
                console.log('✅ Renamed tab to "Served Notices"');
            }
        });
        
        // Also update any headers
        const headers = document.querySelectorAll('h1, h2, h3, .section-title');
        headers.forEach(header => {
            if (header.textContent.includes('Delivery Status')) {
                header.textContent = header.textContent.replace('Delivery Status', 'Served Notices (Complete History)');
            }
        });
    },
    
    dismissNotice(noticeId) {
        // Add to dismissed list
        if (!this.dismissedNotices.includes(noticeId)) {
            this.dismissedNotices.push(noticeId);
            localStorage.setItem('dismissedNotices', JSON.stringify(this.dismissedNotices));
            console.log(`✅ Dismissed notice #${noticeId}`);
            
            // Hide the notice card with animation
            const noticeCard = document.querySelector(`[data-notice-id="${noticeId}"]`)?.closest('.case-card, .notice-card');
            if (noticeCard) {
                noticeCard.style.transition = 'opacity 0.3s, transform 0.3s';
                noticeCard.style.opacity = '0';
                noticeCard.style.transform = 'translateX(-20px)';
                
                setTimeout(() => {
                    noticeCard.style.display = 'none';
                    this.updateNoticeCount();
                }, 300);
            }
            
            // Show confirmation
            this.showDismissConfirmation(noticeId);
        }
    },
    
    undoDismiss(noticeId) {
        // Remove from dismissed list
        const index = this.dismissedNotices.indexOf(noticeId);
        if (index > -1) {
            this.dismissedNotices.splice(index, 1);
            localStorage.setItem('dismissedNotices', JSON.stringify(this.dismissedNotices));
            console.log(`✅ Restored notice #${noticeId}`);
            
            // Show the notice card again
            const noticeCard = document.querySelector(`[data-notice-id="${noticeId}"]`)?.closest('.case-card, .notice-card');
            if (noticeCard) {
                noticeCard.style.display = '';
                noticeCard.style.opacity = '1';
                noticeCard.style.transform = 'translateX(0)';
            }
            
            this.updateNoticeCount();
        }
    },
    
    addDismissButtons() {
        // Add dismiss button to each notice card
        const noticeCards = document.querySelectorAll('.case-card, .notice-card, [data-notice-id]');
        
        noticeCards.forEach(card => {
            // Skip if already has dismiss button
            if (card.querySelector('.dismiss-btn')) return;
            
            // Get notice ID
            const noticeIdElement = card.querySelector('[data-notice-id]') || card;
            const noticeId = noticeIdElement.dataset?.noticeId || 
                           card.textContent.match(/Notice #(\d+)/)?.[1] ||
                           card.textContent.match(/Token (\d+)/)?.[1];
            
            if (noticeId) {
                // Create dismiss button
                const dismissBtn = document.createElement('button');
                dismissBtn.className = 'dismiss-btn';
                dismissBtn.innerHTML = '✕';
                dismissBtn.title = 'Dismiss from recent view';
                dismissBtn.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: rgba(255, 59, 48, 0.9);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    cursor: pointer;
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    z-index: 10;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                `;
                
                dismissBtn.onmouseover = () => {
                    dismissBtn.style.background = 'rgba(255, 59, 48, 1)';
                    dismissBtn.style.transform = 'scale(1.1)';
                };
                
                dismissBtn.onmouseout = () => {
                    dismissBtn.style.background = 'rgba(255, 59, 48, 0.9)';
                    dismissBtn.style.transform = 'scale(1)';
                };
                
                dismissBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.dismissNotice(noticeId);
                };
                
                // Ensure card has relative positioning
                card.style.position = 'relative';
                
                // Add button to card
                card.appendChild(dismissBtn);
            }
        });
    },
    
    filterRecentNotices() {
        // Hide dismissed notices from recent view
        this.dismissedNotices.forEach(noticeId => {
            const noticeCard = document.querySelector(`[data-notice-id="${noticeId}"]`)?.closest('.case-card, .notice-card');
            if (noticeCard) {
                // Only hide in recent notices section, not in served notices tab
                const isInRecentSection = noticeCard.closest('.recent-notices, #recentNotices, .cases-container');
                if (isInRecentSection) {
                    noticeCard.style.display = 'none';
                }
            }
        });
        
        this.updateNoticeCount();
    },
    
    updateNoticeCount() {
        // Update the count of visible notices
        const visibleNotices = document.querySelectorAll('.case-card:not([style*="display: none"]), .notice-card:not([style*="display: none"])');
        const countElement = document.querySelector('.notice-count, .total-notices');
        
        if (countElement) {
            const totalNotices = document.querySelectorAll('.case-card, .notice-card').length;
            const dismissedCount = this.dismissedNotices.length;
            
            countElement.innerHTML = `
                <span>${visibleNotices.length} Active</span>
                ${dismissedCount > 0 ? `<span style="color: #999; margin-left: 10px;">(${dismissedCount} dismissed)</span>` : ''}
            `;
        }
    },
    
    showDismissConfirmation(noticeId) {
        // Show confirmation message with undo option
        const confirmation = document.createElement('div');
        confirmation.className = 'dismiss-confirmation';
        confirmation.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 15px;
            animation: slideIn 0.3s ease;
        `;
        
        confirmation.innerHTML = `
            <span>Notice #${noticeId} dismissed</span>
            <button onclick="DismissNoticeSystem.undoDismiss('${noticeId}'); this.parentElement.remove();" 
                    style="background: #007bff; color: white; border: none; padding: 5px 15px; 
                           border-radius: 4px; cursor: pointer;">
                Undo
            </button>
        `;
        
        document.body.appendChild(confirmation);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            confirmation.style.opacity = '0';
            setTimeout(() => confirmation.remove(), 300);
        }, 5000);
    },
    
    clearAllDismissed() {
        // Clear all dismissed notices and restore them
        const dismissed = [...this.dismissedNotices];
        dismissed.forEach(noticeId => this.undoDismiss(noticeId));
        console.log('✅ All dismissed notices restored');
    },
    
    viewDismissedNotices() {
        // Switch to Served Notices tab to see all notices
        const servedTab = Array.from(document.querySelectorAll('.tab-button, .nav-link, button'))
            .find(tab => tab.textContent.includes('Served Notices'));
        
        if (servedTab) {
            servedTab.click();
            console.log('✅ Switched to Served Notices tab');
        }
    },
    
    observeChanges() {
        // Watch for new notices being added to the DOM
        const observer = new MutationObserver(() => {
            this.addDismissButtons();
            this.filterRecentNotices();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },
    
    // Add management UI
    addManagementUI() {
        // Create management panel
        const panel = document.createElement('div');
        panel.className = 'dismiss-management-panel';
        panel.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 1000;
            min-width: 200px;
        `;
        
        panel.innerHTML = `
            <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">Notice Management</h4>
            <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
                ${this.dismissedNotices.length} notices dismissed
            </div>
            <button onclick="DismissNoticeSystem.viewDismissedNotices()" 
                    style="width: 100%; padding: 8px; margin-bottom: 5px; background: #007bff; 
                           color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                View All Served Notices
            </button>
            <button onclick="DismissNoticeSystem.clearAllDismissed()" 
                    style="width: 100%; padding: 8px; background: #6c757d; 
                           color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                Restore All Dismissed
            </button>
        `;
        
        // Add to page if not already present
        if (!document.querySelector('.dismiss-management-panel')) {
            document.body.appendChild(panel);
        }
    }
};

// Initialize the system
DismissNoticeSystem.init();

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .case-card.dismissed {
        opacity: 0.5;
        filter: grayscale(50%);
    }
    
    .dismiss-btn:hover {
        animation: pulse 0.3s ease;
    }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
    }
`;
document.head.appendChild(style);

console.log('\n✅ Dismiss Notice System Ready!');
console.log('\n📚 Commands:');
console.log('  DismissNoticeSystem.dismissNotice("19") - Dismiss a specific notice');
console.log('  DismissNoticeSystem.clearAllDismissed() - Restore all dismissed notices');
console.log('  DismissNoticeSystem.viewDismissedNotices() - View all in Served Notices tab');
console.log('  DismissNoticeSystem.addManagementUI() - Show management panel');