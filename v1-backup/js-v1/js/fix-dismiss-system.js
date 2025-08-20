/**
 * FIX DISMISS SYSTEM
 * Makes dismissal case-by-case with confirmation dialog
 */

console.log('🔧 FIXING DISMISS SYSTEM');
console.log('=' .repeat(70));

window.ImprovedDismissSystem = {
    
    dismissedNotices: JSON.parse(localStorage.getItem('dismissedNotices') || '[]'),
    
    init() {
        console.log('Initializing improved dismiss system...');
        
        // Rename tab
        this.renameDeliveryTab();
        
        // Remove old X buttons
        this.removeOldDismissButtons();
        
        // Add new dismiss buttons to case dropdowns
        this.addDismissToDropdowns();
        
        // Filter dismissed notices
        this.filterDismissedNotices();
        
        // Watch for changes
        this.observeChanges();
        
        console.log(`✅ Improved dismiss system ready. ${this.dismissedNotices.length} notices dismissed.`);
    },
    
    renameDeliveryTab() {
        const tabs = document.querySelectorAll('.tab-button, .nav-link, button');
        tabs.forEach(tab => {
            if (tab.textContent.includes('Delivery Status')) {
                tab.innerHTML = tab.innerHTML.replace('Delivery Status', '📂 Served Notices');
            }
        });
    },
    
    removeOldDismissButtons() {
        // Remove the X buttons that were added to all cards
        document.querySelectorAll('.dismiss-btn').forEach(btn => {
            if (btn.innerHTML.includes('✕')) {
                btn.remove();
            }
        });
    },
    
    addDismissToDropdowns() {
        // Find all case cards
        const caseCards = document.querySelectorAll('.case-card, .notice-card, [data-notice-id]');
        
        caseCards.forEach(card => {
            // Look for the dropdown/details section
            const detailsSection = card.querySelector('.case-details, .notice-details, .expanded-content');
            if (!detailsSection) return;
            
            // Check if already has dismiss button
            if (detailsSection.querySelector('.dismiss-notice-btn')) return;
            
            // Get notice ID
            const noticeId = this.getNoticeId(card);
            if (!noticeId) return;
            
            // Find the button container (near "Delivered" button)
            const buttonContainer = detailsSection.querySelector('.button-container, .action-buttons') || 
                                  this.findOrCreateButtonContainer(detailsSection);
            
            // Create dismiss button
            const dismissBtn = document.createElement('button');
            dismissBtn.className = 'dismiss-notice-btn';
            dismissBtn.innerHTML = '📁 Dismiss from Recent';
            dismissBtn.style.cssText = `
                background: linear-gradient(135deg, #ff9a00, #ff6b00);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: bold;
                margin: 5px;
                transition: all 0.3s;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;
            
            dismissBtn.onmouseover = () => {
                dismissBtn.style.transform = 'translateY(-2px)';
                dismissBtn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
            };
            
            dismissBtn.onmouseout = () => {
                dismissBtn.style.transform = 'translateY(0)';
                dismissBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            };
            
            dismissBtn.onclick = (e) => {
                e.stopPropagation();
                this.confirmDismissal(noticeId);
            };
            
            buttonContainer.appendChild(dismissBtn);
        });
    },
    
    findOrCreateButtonContainer(detailsSection) {
        // Look for existing buttons
        const existingButtons = detailsSection.querySelector('button');
        if (existingButtons && existingButtons.parentElement) {
            return existingButtons.parentElement;
        }
        
        // Create new container
        const container = document.createElement('div');
        container.className = 'action-buttons';
        container.style.cssText = 'margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;';
        
        // Insert after any existing content
        detailsSection.appendChild(container);
        return container;
    },
    
    getNoticeId(card) {
        // Try various methods to get notice ID
        const idElement = card.querySelector('[data-notice-id]');
        if (idElement) return idElement.dataset.noticeId;
        
        // Try from text content
        const textMatch = card.textContent.match(/Notice #(\d+)|Token (\d+)|Alert.*?(\d+)/);
        if (textMatch) return textMatch[1] || textMatch[2] || textMatch[3];
        
        // Try from case number or other identifiers
        const caseMatch = card.textContent.match(/Case.*?(\d+-\d+-\d+)/);
        if (caseMatch) return caseMatch[1];
        
        return null;
    },
    
    confirmDismissal(noticeId) {
        // Create confirmation modal
        const modal = document.createElement('div');
        modal.id = 'dismissConfirmModal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                        background: rgba(0,0,0,0.8); z-index: 10000; 
                        display: flex; align-items: center; justify-content: center;">
                <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); 
                            border: 2px solid #ff9a00; border-radius: 15px; 
                            padding: 30px; max-width: 500px; color: white; 
                            box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                    
                    <h3 style="margin: 0 0 20px 0; color: #ff9a00; font-size: 24px;">
                        ⚠️ Confirm Dismissal
                    </h3>
                    
                    <p style="margin-bottom: 20px; line-height: 1.6;">
                        Are you sure you want to dismiss <strong>Notice #${noticeId}</strong> from your recent view?
                    </p>
                    
                    <div style="background: rgba(255, 154, 0, 0.1); border-left: 4px solid #ff9a00; 
                                padding: 15px; margin-bottom: 25px; border-radius: 5px;">
                        <p style="margin: 0; font-size: 14px;">
                            <strong>📂 Note:</strong> This notice will remain permanently accessible 
                            in the <strong>"Served Notices"</strong> tab. You're only removing it 
                            from the recent cases view.
                        </p>
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button onclick="ImprovedDismissSystem.performDismissal('${noticeId}')" 
                                style="flex: 1; background: linear-gradient(135deg, #ff9a00, #ff6b00); 
                                       color: white; border: none; padding: 12px; 
                                       border-radius: 8px; cursor: pointer; font-weight: bold; 
                                       transition: all 0.3s;">
                            ✓ Yes, Dismiss from Recent
                        </button>
                        
                        <button onclick="document.getElementById('dismissConfirmModal').remove()" 
                                style="flex: 1; background: transparent; 
                                       color: white; border: 2px solid #666; padding: 12px; 
                                       border-radius: 8px; cursor: pointer; font-weight: bold; 
                                       transition: all 0.3s;">
                            ✕ Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    performDismissal(noticeId) {
        // Add to dismissed list
        if (!this.dismissedNotices.includes(noticeId)) {
            this.dismissedNotices.push(noticeId);
            localStorage.setItem('dismissedNotices', JSON.stringify(this.dismissedNotices));
        }
        
        // Remove confirmation modal
        const modal = document.getElementById('dismissConfirmModal');
        if (modal) modal.remove();
        
        // Find and hide the notice card
        const cards = document.querySelectorAll('.case-card, .notice-card, [data-notice-id]');
        cards.forEach(card => {
            const cardNoticeId = this.getNoticeId(card);
            if (cardNoticeId === noticeId) {
                // Animate out
                card.style.transition = 'all 0.5s';
                card.style.opacity = '0';
                card.style.transform = 'translateX(-50px)';
                
                setTimeout(() => {
                    card.style.display = 'none';
                    this.updateNoticeCount();
                }, 500);
            }
        });
        
        // Show success notification
        this.showSuccessNotification(noticeId);
    },
    
    showSuccessNotification(noticeId) {
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="position: fixed; bottom: 20px; right: 20px; 
                        background: linear-gradient(135deg, #00c851, #00ff88); 
                        color: #1a1a2e; padding: 20px; border-radius: 10px; 
                        box-shadow: 0 4px 12px rgba(0,200,81,0.4); 
                        z-index: 10001; max-width: 400px; 
                        animation: slideInRight 0.3s ease;">
                
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="font-size: 30px;">✅</div>
                    <div>
                        <strong style="display: block; margin-bottom: 5px;">
                            Notice #${noticeId} Dismissed
                        </strong>
                        <span style="font-size: 14px;">
                            Still accessible in Served Notices tab
                        </span>
                    </div>
                </div>
                
                <button onclick="ImprovedDismissSystem.undoDismiss('${noticeId}'); this.parentElement.parentElement.remove();" 
                        style="position: absolute; top: 10px; right: 10px; 
                               background: transparent; border: none; 
                               color: #1a1a2e; cursor: pointer; font-size: 20px;">
                    ↩️
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    },
    
    undoDismiss(noticeId) {
        // Remove from dismissed list
        const index = this.dismissedNotices.indexOf(noticeId);
        if (index > -1) {
            this.dismissedNotices.splice(index, 1);
            localStorage.setItem('dismissedNotices', JSON.stringify(this.dismissedNotices));
        }
        
        // Show the card again
        const cards = document.querySelectorAll('.case-card, .notice-card, [data-notice-id]');
        cards.forEach(card => {
            const cardNoticeId = this.getNoticeId(card);
            if (cardNoticeId === noticeId) {
                card.style.display = '';
                card.style.opacity = '1';
                card.style.transform = 'translateX(0)';
            }
        });
        
        this.updateNoticeCount();
    },
    
    filterDismissedNotices() {
        // Hide dismissed notices
        this.dismissedNotices.forEach(noticeId => {
            const cards = document.querySelectorAll('.case-card, .notice-card, [data-notice-id]');
            cards.forEach(card => {
                const cardNoticeId = this.getNoticeId(card);
                if (cardNoticeId === noticeId) {
                    // Only hide in recent section
                    const isInRecent = card.closest('.recent-notices, #recentNotices, .cases-container');
                    if (isInRecent) {
                        card.style.display = 'none';
                    }
                }
            });
        });
    },
    
    updateNoticeCount() {
        const visible = document.querySelectorAll('.case-card:not([style*="display: none"]), .notice-card:not([style*="display: none"])');
        const countElem = document.querySelector('.notice-count, .total-notices');
        
        if (countElem) {
            countElem.innerHTML = `
                <span>${visible.length} Active</span>
                ${this.dismissedNotices.length > 0 ? 
                    `<span style="color: #ff9a00; margin-left: 10px;">(${this.dismissedNotices.length} in Served Notices)</span>` 
                    : ''}
            `;
        }
    },
    
    observeChanges() {
        const observer = new MutationObserver(() => {
            // Reapply dismiss buttons when content changes
            setTimeout(() => {
                this.addDismissToDropdowns();
                this.filterDismissedNotices();
            }, 100);
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
};

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Replace old system with improved one
if (window.DismissNoticeSystem) {
    window.DismissNoticeSystem = window.ImprovedDismissSystem;
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ImprovedDismissSystem.init();
    });
} else {
    ImprovedDismissSystem.init();
}

console.log('✅ Improved dismiss system ready!');