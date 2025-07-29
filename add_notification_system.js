const fs = require('fs');
const path = require('path');

console.log('🔔 Adding Notification System...\n');

const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Add notification system HTML
const notificationHTML = `
    <\!-- Notification Bell for Recipients -->
    <div id="notificationBell" class="notification-bell" style="display: none;">
        <button class="btn-icon notification-bell-btn" onclick="toggleNotificationPanel()">
            <i class="fas fa-bell"></i>
            <span class="notification-badge" id="notificationCount" style="display: none;">0</span>
        </button>
    </div>
    
    <\!-- Notification Panel -->
    <div id="notificationPanel" class="notification-panel" style="display: none;">
        <div class="notification-panel-header">
            <h3>Legal Notices</h3>
            <button class="btn-icon" onclick="toggleNotificationPanel()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div id="notificationList" class="notification-list">
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No new notices</p>
            </div>
        </div>
        <div class="notification-panel-footer">
            <button class="btn btn-secondary btn-small" onclick="markAllAsRead()">
                Mark all as read
            </button>
        </div>
    </div>`;

// Insert notification HTML after header
const headerEndIndex = content.indexOf('</header>');
if (headerEndIndex > 0) {
    content = content.slice(0, headerEndIndex + 9) + '\n\n    ' + notificationHTML + '\n' + content.slice(headerEndIndex + 9);
}

// Add notification CSS
const notificationCSS = `
        /* Notification System Styles */
        .notification-bell {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            z-index: 1000;
        }
        
        .notification-bell-btn {
            position: relative;
            width: 56px;
            height: 56px;
            background: var(--accent-blue);
            color: white;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            transition: transform 0.2s;
        }
        
        .notification-bell-btn:hover {
            transform: scale(1.1);
        }
        
        .notification-badge {
            position: absolute;
            top: -4px;
            right: -4px;
            background: var(--error);
            color: white;
            font-size: 0.75rem;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 10px;
            min-width: 20px;
            text-align: center;
        }
        
        .notification-panel {
            position: fixed;
            bottom: 6rem;
            right: 2rem;
            width: 320px;
            max-height: 400px;
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
            z-index: 999;
            display: flex;
            flex-direction: column;
        }
        
        .notification-panel-header {
            padding: 1rem;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .notification-panel-header h3 {
            margin: 0;
            font-size: 1.1rem;
        }
        
        .notification-list {
            flex: 1;
            overflow-y: auto;
            padding: 0.5rem;
        }
        
        .notification-item {
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            background: var(--bg-secondary);
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .notification-item:hover {
            background: var(--bg-hover);
        }
        
        .notification-item.unread {
            border-left: 3px solid var(--accent-blue);
        }
        
        .notification-item-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.25rem;
        }
        
        .notification-item-title {
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        .notification-item-time {
            font-size: 0.75rem;
            color: var(--text-secondary);
        }
        
        .notification-item-body {
            font-size: 0.875rem;
            color: var(--text-secondary);
        }
        
        .notification-panel-footer {
            padding: 0.75rem;
            border-top: 1px solid var(--border-color);
            text-align: center;
        }
        
        @media (max-width: 768px) {
            .notification-bell {
                bottom: 1rem;
                right: 1rem;
            }
            
            .notification-panel {
                right: 1rem;
                left: 1rem;
                width: auto;
            }
        }`;

// Insert CSS before loading-spinner
const cssInsertIndex = content.indexOf('.loading-spinner {');
if (cssInsertIndex > 0) {
    content = content.slice(0, cssInsertIndex) + notificationCSS + '\n\n        ' + content.slice(cssInsertIndex);
}

// Add notification functions
const notificationFunctions = `
        // Notification System
        class NotificationSystem {
            constructor() {
                this.notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
                this.unreadCount = 0;
                this.checkInterval = null;
            }
            
            async init() {
                // Show bell for recipients only
                if (tronWeb && tronWeb.defaultAddress) {
                    const isRecipient = await this.checkIfRecipient();
                    if (isRecipient) {
                        document.getElementById('notificationBell').style.display = 'block';
                        this.updateNotificationUI();
                        this.startPolling();
                    }
                }
            }
            
            async checkIfRecipient() {
                try {
                    const balance = await legalContract.balanceOf(tronWeb.defaultAddress.base58).call();
                    return parseInt(balance) > 0;
                } catch (error) {
                    return false;
                }
            }
            
            async checkForNewNotices() {
                if (\!legalContract || \!tronWeb.defaultAddress) return;
                
                try {
                    const myAddress = tronWeb.defaultAddress.base58;
                    const noticeIds = await getRecipientNoticeIds(myAddress);
                    
                    // Check for new notices
                    const existingIds = this.notifications.map(n => n.noticeId);
                    const newNotices = [];
                    
                    for (const noticeId of noticeIds) {
                        if (\!existingIds.includes(noticeId.toString())) {
                            try {
                                const notice = await legalContract.getNotice(noticeId).call();
                                const { timestamp, serverId, hasDocument, accepted } = parsePackedData(notice.packedData);
                                
                                newNotices.push({
                                    noticeId: noticeId.toString(),
                                    sender: notice.sender,
                                    timestamp: timestamp,
                                    type: notice.metadata.split('|')[0] || 'Legal Notice',
                                    hasDocument: hasDocument,
                                    accepted: accepted,
                                    read: false,
                                    receivedAt: Date.now()
                                });
                            } catch (e) {
                                console.error('Error fetching notice:', e);
                            }
                        }
                    }
                    
                    if (newNotices.length > 0) {
                        this.addNotifications(newNotices);
                        this.showDesktopNotification(newNotices[0]);
                    }
                    
                } catch (error) {
                    console.error('Error checking for notices:', error);
                }
            }
            
            addNotifications(newNotices) {
                this.notifications.unshift(...newNotices);
                this.saveNotifications();
                this.updateNotificationUI();
            }
            
            showDesktopNotification(notice) {
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('New Legal Notice', {
                        body: \`You have received a new legal notice from \${notice.sender.substring(0, 10)}...\`,
                        icon: '/favicon.ico',
                        tag: notice.noticeId
                    });
                }
            }
            
            updateNotificationUI() {
                const unread = this.notifications.filter(n => \!n.read);
                this.unreadCount = unread.length;
                
                // Update badge
                const badge = document.getElementById('notificationCount');
                if (badge) {
                    badge.textContent = this.unreadCount;
                    badge.style.display = this.unreadCount > 0 ? 'block' : 'none';
                }
                
                // Update list
                const list = document.getElementById('notificationList');
                if (list) {
                    if (this.notifications.length === 0) {
                        list.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No notices</p></div>';
                    } else {
                        list.innerHTML = this.notifications.map(n => \`
                            <div class="notification-item \${n.read ? '' : 'unread'}" onclick="viewNoticeFromNotification('\${n.noticeId}')">
                                <div class="notification-item-header">
                                    <span class="notification-item-title">\${n.type}</span>
                                    <span class="notification-item-time">\${this.formatTime(n.receivedAt)}</span>
                                </div>
                                <div class="notification-item-body">
                                    From: \${n.sender.substring(0, 10)}...\${n.sender.substring(n.sender.length - 8)}
                                </div>
                            </div>
                        \`).join('');
                    }
                }
            }
            
            formatTime(timestamp) {
                const now = Date.now();
                const diff = now - timestamp;
                
                if (diff < 60000) return 'Just now';
                if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
                if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
                return new Date(timestamp).toLocaleDateString();
            }
            
            markAsRead(noticeId) {
                const notification = this.notifications.find(n => n.noticeId === noticeId);
                if (notification && \!notification.read) {
                    notification.read = true;
                    this.saveNotifications();
                    this.updateNotificationUI();
                }
            }
            
            markAllAsRead() {
                this.notifications.forEach(n => n.read = true);
                this.saveNotifications();
                this.updateNotificationUI();
            }
            
            saveNotifications() {
                localStorage.setItem('notifications', JSON.stringify(this.notifications));
            }
            
            startPolling() {
                // Check every 30 seconds
                this.checkInterval = setInterval(() => {
                    this.checkForNewNotices();
                }, 30000);
                
                // Initial check
                this.checkForNewNotices();
            }
            
            stopPolling() {
                if (this.checkInterval) {
                    clearInterval(this.checkInterval);
                }
            }
        }
        
        // Initialize notification system
        const notificationSystem = new NotificationSystem();
        
        // Notification functions
        function toggleNotificationPanel() {
            const panel = document.getElementById('notificationPanel');
            panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
        }
        
        function markAllAsRead() {
            notificationSystem.markAllAsRead();
        }
        
        function viewNoticeFromNotification(noticeId) {
            notificationSystem.markAsRead(noticeId);
            showAcceptModal(noticeId);
            toggleNotificationPanel();
        }
        
        // Request notification permission
        function requestNotificationPermission() {
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }`;

// Insert notification functions
const functionsInsertIndex = content.indexOf('// Initialize tooltips');
if (functionsInsertIndex > 0) {
    content = content.slice(0, functionsInsertIndex) + notificationFunctions + '\n\n        ' + content.slice(functionsInsertIndex);
}

// Update initialization
content = content.replace(
    'initializeTooltips();',
    `initializeTooltips();
            
            // Initialize notifications
            if (legalContract) {
                notificationSystem.init();
                requestNotificationPermission();
            }`
);

// Save the updated file
fs.writeFileSync(indexPath, content);

console.log('✅ Notification System Added:');
console.log('  - Notification bell for recipients');
console.log('  - Real-time notice checking (30s intervals)');
console.log('  - Desktop notifications support');
console.log('  - Unread badges');
console.log('  - Notification panel with history');
console.log('  - Local storage persistence');

