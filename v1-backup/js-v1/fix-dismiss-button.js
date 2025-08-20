/**
 * FIX DISMISS BUTTON
 * Replace X with proper "Dismiss" button in case dropdowns
 * Ensure dismissed items still appear in Served Notices tab
 */

console.log('🔧 Fixing dismiss button appearance and functionality...');

(function() {
    // Override the dismiss system's button creation
    if (window.DismissNoticeSystem) {
        
        // Store original function
        const originalAddButtons = window.DismissNoticeSystem.addDismissButtons;
        
        // Override with better button
        window.DismissNoticeSystem.addDismissButtons = function() {
            console.log('Adding improved dismiss buttons...');
            
            // Find all case cards and notice containers
            const noticeContainers = document.querySelectorAll(`
                .case-card, 
                .notice-card, 
                .case-details,
                .notice-item,
                [data-notice-id],
                .grouped-case-header,
                .case-dropdown
            `);
            
            noticeContainers.forEach(container => {
                // Skip if already has a proper dismiss button
                if (container.querySelector('.dismiss-button-proper')) return;
                
                // Remove any old X buttons
                const oldDismissBtn = container.querySelector('.dismiss-btn');
                if (oldDismissBtn) {
                    oldDismissBtn.remove();
                }
                
                // Get notice ID from various possible sources
                const noticeId = 
                    container.dataset?.noticeId || 
                    container.querySelector('[data-notice-id]')?.dataset?.noticeId ||
                    container.textContent.match(/Notice #(\d+)/)?.[1] ||
                    container.textContent.match(/Token (\d+)/)?.[1] ||
                    container.textContent.match(/Case.*?(\d+)/)?.[1];
                
                if (noticeId) {
                    // Create proper dismiss button
                    const dismissBtn = document.createElement('button');
                    dismissBtn.className = 'btn btn-small btn-secondary dismiss-button-proper';
                    dismissBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Dismiss';
                    dismissBtn.title = 'Hide from Recent Served (remains in Served Notices tab)';
                    dismissBtn.dataset.noticeId = noticeId;
                    
                    // Style the button
                    dismissBtn.style.cssText = `
                        margin-left: 10px;
                        padding: 4px 12px;
                        font-size: 12px;
                        background: #6b7280;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        transition: all 0.2s;
                    `;
                    
                    // Add hover effect
                    dismissBtn.onmouseover = () => {
                        dismissBtn.style.background = '#4b5563';
                    };
                    dismissBtn.onmouseout = () => {
                        dismissBtn.style.background = '#6b7280';
                    };
                    
                    // Handle click
                    dismissBtn.onclick = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        
                        // Confirm dismissal
                        const confirmDismiss = confirm(
                            `Hide Notice #${noticeId} from Recent Served?\n\n` +
                            `This notice will still be available in the "Served Notices" tab.`
                        );
                        
                        if (confirmDismiss) {
                            // Add to dismissed list
                            const dismissed = JSON.parse(localStorage.getItem('dismissedNotices') || '[]');
                            if (!dismissed.includes(noticeId)) {
                                dismissed.push(noticeId);
                                localStorage.setItem('dismissedNotices', JSON.stringify(dismissed));
                            }
                            
                            // Hide the container with animation
                            container.style.transition = 'opacity 0.3s, transform 0.3s';
                            container.style.opacity = '0';
                            container.style.transform = 'translateX(20px)';
                            
                            setTimeout(() => {
                                container.style.display = 'none';
                                
                                // Show success message
                                showNotification(`Notice #${noticeId} hidden from Recent Served`, 'success');
                            }, 300);
                            
                            console.log(`✅ Notice #${noticeId} dismissed from recent view`);
                        }
                    };
                    
                    // Find best place to insert button
                    const header = container.querySelector('.case-header, .grouped-case-header, h4, h5');
                    const actionsArea = container.querySelector('.case-actions, .notice-actions');
                    
                    if (actionsArea) {
                        actionsArea.appendChild(dismissBtn);
                    } else if (header) {
                        // Add to header area
                        header.style.display = 'flex';
                        header.style.justifyContent = 'space-between';
                        header.style.alignItems = 'center';
                        header.appendChild(dismissBtn);
                    } else {
                        // Add to top of container
                        container.style.position = 'relative';
                        dismissBtn.style.position = 'absolute';
                        dismissBtn.style.top = '10px';
                        dismissBtn.style.right = '10px';
                        container.appendChild(dismissBtn);
                    }
                }
            });
        };
        
        // Run the improved version immediately
        window.DismissNoticeSystem.addDismissButtons();
    }
    
    // Function to show notifications
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            border-radius: 6px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Add animation styles if not present
    if (!document.querySelector('#dismiss-animations')) {
        const style = document.createElement('style');
        style.id = 'dismiss-animations';
        style.innerHTML = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Ensure dismissed notices still show in Served Notices tab
    const originalShowTab = window.showTab;
    window.showTab = function(tabName) {
        if (originalShowTab) {
            originalShowTab.call(this, tabName);
        }
        
        // If showing delivery/served notices tab, show all notices
        if (tabName === 'delivery' || tabName === 'served') {
            // Remove dismiss filter for this tab
            const allNotices = document.querySelectorAll('[data-notice-id]');
            allNotices.forEach(notice => {
                if (notice.style.display === 'none' && 
                    notice.classList.contains('dismissed-from-recent')) {
                    notice.style.display = '';
                    notice.style.opacity = '1';
                    notice.style.transform = '';
                }
            });
            console.log('Showing all notices in Served Notices tab');
        }
    };
    
    // Re-apply dismiss buttons when content changes
    const observer = new MutationObserver(() => {
        if (window.DismissNoticeSystem) {
            window.DismissNoticeSystem.addDismissButtons();
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('✅ Dismiss button fixes applied');
})();