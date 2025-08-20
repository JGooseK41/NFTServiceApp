/**
 * WORKING DISMISS SYSTEM
 * Adds dismiss buttons to Recent Served Notices without breaking the page
 */

console.log('🔧 Adding dismiss functionality...');

(function() {
    // Get dismissed notices from localStorage
    let dismissedNotices = JSON.parse(localStorage.getItem('dismissedNotices') || '[]');
    
    // Function to add dismiss buttons
    function addDismissButtons() {
        // Find all case/notice containers in Recent Served section
        const containers = document.querySelectorAll(`
            #recentActivitySection .case-card,
            #recentActivitySection .notice-card,
            #recentActivitiesCard .case-card,
            #recentActivitiesCard .notice-card,
            #recentActivitySection .grouped-case-header,
            #recentActivitiesCard .grouped-case-header,
            .case-dropdown,
            .notice-item
        `);
        
        containers.forEach(container => {
            // Skip if already has dismiss button
            if (container.querySelector('.dismiss-notice-btn')) return;
            
            // Skip if in Served Notices tab (not Recent)
            const parentSection = container.closest('#deliveryTab');
            if (parentSection) return;
            
            // Get notice/case ID
            const noticeId = 
                container.dataset?.noticeId ||
                container.textContent.match(/Notice #(\d+)/)?.[1] ||
                container.textContent.match(/Token (\d+)/)?.[1] ||
                container.textContent.match(/Case.*?(\d+)/)?.[1];
            
            if (!noticeId) return;
            
            // Check if already dismissed
            if (dismissedNotices.includes(noticeId)) {
                container.style.display = 'none';
                return;
            }
            
            // Create dismiss button
            const dismissBtn = document.createElement('button');
            dismissBtn.className = 'btn btn-small dismiss-notice-btn';
            dismissBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Dismiss';
            dismissBtn.title = 'Hide from Recent (stays in Served Notices)';
            
            // Style the button
            dismissBtn.style.cssText = `
                background: #6b7280;
                color: white;
                border: none;
                padding: 4px 10px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                margin-left: 10px;
            `;
            
            // Handle click
            dismissBtn.onclick = function(e) {
                e.stopPropagation();
                e.preventDefault();
                
                if (confirm(`Hide Notice/Case #${noticeId} from Recent Served?\n\nIt will remain available in the Served Notices tab.`)) {
                    // Add to dismissed list
                    dismissedNotices.push(noticeId);
                    localStorage.setItem('dismissedNotices', JSON.stringify(dismissedNotices));
                    
                    // Hide with animation
                    container.style.transition = 'opacity 0.3s';
                    container.style.opacity = '0';
                    
                    setTimeout(() => {
                        container.style.display = 'none';
                    }, 300);
                    
                    // Show notification
                    showDismissNotification(noticeId);
                }
            };
            
            // Find where to add the button
            const header = container.querySelector('.case-header, .grouped-case-header, h4, h5, .card-header');
            const existingButtons = container.querySelector('.case-actions, .notice-actions, .btn-group');
            
            if (existingButtons) {
                existingButtons.appendChild(dismissBtn);
            } else if (header) {
                // Make header a flex container if not already
                if (!header.style.display || header.style.display === 'block') {
                    header.style.display = 'flex';
                    header.style.justifyContent = 'space-between';
                    header.style.alignItems = 'center';
                }
                header.appendChild(dismissBtn);
            } else {
                // Add to top-right corner
                container.style.position = 'relative';
                dismissBtn.style.position = 'absolute';
                dismissBtn.style.top = '10px';
                dismissBtn.style.right = '10px';
                dismissBtn.style.zIndex = '10';
                container.appendChild(dismissBtn);
            }
        });
    }
    
    // Function to show notification
    function showDismissNotification(noticeId) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i> Notice #${noticeId} hidden from Recent Served
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Add animation styles
    if (!document.querySelector('#dismiss-animations-style')) {
        const style = document.createElement('style');
        style.id = 'dismiss-animations-style';
        style.innerHTML = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            
            .dismiss-notice-btn:hover {
                background: #4b5563 !important;
            }
            
            /* Hide X buttons if they exist */
            .dismiss-btn:has(contains("✕")),
            .dismiss-btn:has(contains("×")) {
                display: none;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Function to show all in Served Notices tab
    window.showAllInServedNotices = function() {
        const containers = document.querySelectorAll('#deliveryTab .case-card, #deliveryTab .notice-card');
        containers.forEach(container => {
            container.style.display = '';
            container.style.opacity = '1';
        });
    };
    
    // Override tab switching to show all in Served Notices
    const originalShowTab = window.showTab;
    if (originalShowTab) {
        window.showTab = function(tabName) {
            originalShowTab.apply(this, arguments);
            
            if (tabName === 'delivery') {
                // Show all notices in Served Notices tab
                setTimeout(showAllInServedNotices, 100);
            }
        };
    }
    
    // Add clear dismissed button
    function addClearDismissedButton() {
        const recentHeader = document.querySelector('#recentActivitiesCard .card-header');
        if (recentHeader && !recentHeader.querySelector('.clear-dismissed-btn')) {
            const clearBtn = document.createElement('button');
            clearBtn.className = 'btn btn-small btn-secondary clear-dismissed-btn';
            clearBtn.innerHTML = '<i class="fas fa-eye"></i> Show All';
            clearBtn.title = 'Show all dismissed notices';
            clearBtn.onclick = function() {
                dismissedNotices = [];
                localStorage.setItem('dismissedNotices', '[]');
                
                // Show all hidden notices
                const containers = document.querySelectorAll('.case-card, .notice-card');
                containers.forEach(container => {
                    container.style.display = '';
                    container.style.opacity = '1';
                });
                
                // Re-add dismiss buttons
                addDismissButtons();
                
                // Notification
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #3b82f6;
                    color: white;
                    padding: 12px 20px;
                    border-radius: 6px;
                    z-index: 10000;
                `;
                notification.textContent = 'All notices restored to view';
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 3000);
            };
            
            recentHeader.appendChild(clearBtn);
        }
    }
    
    // Initialize
    function init() {
        addDismissButtons();
        addClearDismissedButton();
    }
    
    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Re-run when content changes
    setInterval(() => {
        addDismissButtons();
        addClearDismissedButton();
    }, 2000);
    
    console.log('✅ Dismiss system active');
})();