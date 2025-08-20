/**
 * DATABASE PORTAL FIXED
 * Handles missing columns and database errors gracefully
 */

console.log('🔧 LOADING FIXED DATABASE PORTAL');
console.log('=' .repeat(70));

window.DatabasePortalFixed = {
    
    init() {
        console.log('Initializing Fixed Database Portal...');
        
        // Override the existing initDatabaseManagement function
        window.initDatabaseManagement = () => {
            this.openPortal();
        };
        
        // Setup keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                this.openPortal();
            }
        });
        
        console.log('✅ Fixed Database Portal ready');
        console.log('Use Ctrl+Shift+D to open portal quickly');
    },
    
    openPortal() {
        console.log('Opening Fixed Database Portal...');
        
        const container = document.getElementById('databaseManagementContent') || 
                         this.createContainer();
        
        if (!container) {
            console.error('Could not create database container');
            return;
        }
        
        // Show the container
        container.style.display = 'block';
        
        // Create the portal interface
        container.innerHTML = `
            <div class="database-portal" style="padding: 20px; background: var(--card-bg, #1a1a1a); border-radius: 8px;">
                <!-- Header -->
                <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #333;">
                    <h3 style="color: #fff; margin: 0; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-database"></i>
                        Database Portal (Fixed Version)
                        <span id="db-status" style="margin-left: auto; font-size: 12px; padding: 4px 8px; background: #10b981; color: white; border-radius: 4px;">
                            Ready
                        </span>
                    </h3>
                </div>
                
                <!-- Error Display -->
                <div id="error-display" style="display: none; padding: 15px; background: #ef444422; border: 1px solid #ef4444; border-radius: 6px; margin-bottom: 20px;">
                    <strong>Error:</strong> <span id="error-message"></span>
                </div>
                
                <!-- Statistics Grid -->
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px;">
                    <div class="stat-card" style="background: #2a2a2a; padding: 15px; border-radius: 8px; border: 1px solid #444;">
                        <div style="color: #999; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">
                            Total Notices
                        </div>
                        <div id="stat-notices" style="color: #fff; font-size: 28px; font-weight: bold;">-</div>
                    </div>
                    <div class="stat-card" style="background: #2a2a2a; padding: 15px; border-radius: 8px; border: 1px solid #444;">
                        <div style="color: #999; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">
                            Pending
                        </div>
                        <div id="stat-pending" style="color: #f59e0b; font-size: 28px; font-weight: bold;">-</div>
                    </div>
                    <div class="stat-card" style="background: #2a2a2a; padding: 15px; border-radius: 8px; border: 1px solid #444;">
                        <div style="color: #999; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">
                            Served
                        </div>
                        <div id="stat-served" style="color: #10b981; font-size: 28px; font-weight: bold;">-</div>
                    </div>
                    <div class="stat-card" style="background: #2a2a2a; padding: 15px; border-radius: 8px; border: 1px solid #444;">
                        <div style="color: #999; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">
                            Alerts
                        </div>
                        <div id="stat-alerts" style="color: #0ea5e9; font-size: 28px; font-weight: bold;">-</div>
                    </div>
                </div>
                
                <!-- Control Buttons -->
                <div class="controls" style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="DatabasePortalFixed.loadNotices()" class="btn" style="padding: 8px 16px; background: #0ea5e9; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        📋 View Notices
                    </button>
                    <button onclick="DatabasePortalFixed.loadAlerts()" class="btn" style="padding: 8px 16px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        🔔 View Alerts
                    </button>
                    <button onclick="DatabasePortalFixed.loadLocalStorage()" class="btn" style="padding: 8px 16px; background: #8b5cf6; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        💾 Local Storage
                    </button>
                    <button onclick="DatabasePortalFixed.runDiagnostics()" class="btn" style="padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        🔍 Diagnostics
                    </button>
                    <button onclick="DatabasePortalFixed.refreshAll()" class="btn" style="padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        🔄 Refresh All
                    </button>
                </div>
                
                <!-- Data Display -->
                <div class="data-display" style="background: #2a2a2a; border: 1px solid #444; border-radius: 8px; padding: 20px; min-height: 300px; max-height: 600px; overflow: auto;">
                    <h4 id="data-title" style="color: #fff; margin-top: 0;">Welcome to Database Portal</h4>
                    <div id="data-content" style="color: #ccc;">
                        <p>Select an option above to view data. This portal works even when backend columns are missing.</p>
                    </div>
                </div>
            </div>
        `;
        
        // Auto-load statistics
        this.loadStats();
    },
    
    createContainer() {
        // Create a floating container if admin tab not available
        const container = document.createElement('div');
        container.id = 'floating-db-portal';
        container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90%;
            max-width: 1200px;
            max-height: 90vh;
            overflow: auto;
            background: #1a1a1a;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8);
            z-index: 10000;
        `;
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            cursor: pointer;
            z-index: 10001;
        `;
        closeBtn.onclick = () => container.remove();
        
        container.appendChild(closeBtn);
        document.body.appendChild(container);
        
        return container;
    },
    
    async loadStats() {
        console.log('Loading statistics...');
        
        try {
            // Load notices with error handling
            const notices = await this.safeLoadNotices();
            if (notices) {
                document.getElementById('stat-notices').textContent = notices.length;
                document.getElementById('stat-pending').textContent = 
                    notices.filter(n => n.status === 'pending').length;
                document.getElementById('stat-served').textContent = 
                    notices.filter(n => n.status === 'served').length;
                
                // Count alerts
                const alertCount = notices.filter(n => n.alert_nft_id && n.alert_nft_id !== 'null').length;
                document.getElementById('stat-alerts').textContent = alertCount;
            }
        } catch (error) {
            console.error('Stats loading error:', error);
            this.showError('Could not load statistics: ' + error.message);
        }
    },
    
    async safeLoadNotices() {
        try {
            const response = await fetch('/api/notices', {
                headers: {
                    'X-Server-Address': localStorage.getItem('currentServerAddress') || ''
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Notice loading failed:', error);
            
            // Try to load from localStorage as fallback
            const stored = localStorage.getItem('cached_notices');
            if (stored) {
                console.log('Using cached notices from localStorage');
                return JSON.parse(stored);
            }
            
            return null;
        }
    },
    
    async loadNotices() {
        document.getElementById('data-title').textContent = 'Legal Notices';
        document.getElementById('data-content').innerHTML = '<p>Loading notices...</p>';
        
        try {
            const notices = await this.safeLoadNotices();
            
            if (!notices || notices.length === 0) {
                document.getElementById('data-content').innerHTML = 
                    '<p style="color: #999;">No notices found or unable to load</p>';
                return;
            }
            
            // Cache for future use
            localStorage.setItem('cached_notices', JSON.stringify(notices));
            
            let html = `
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="background: #333;">
                                <th style="padding: 10px; text-align: left; color: #fff;">ID</th>
                                <th style="padding: 10px; text-align: left; color: #fff;">Alert NFT</th>
                                <th style="padding: 10px; text-align: left; color: #fff;">Document NFT</th>
                                <th style="padding: 10px; text-align: left; color: #fff;">Case</th>
                                <th style="padding: 10px; text-align: left; color: #fff;">Recipient</th>
                                <th style="padding: 10px; text-align: left; color: #fff;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            notices.forEach(notice => {
                const statusColor = notice.status === 'served' ? '#10b981' : 
                                  notice.status === 'pending' ? '#f59e0b' : '#0ea5e9';
                
                const alertId = notice.alert_nft_id || (notice.id * 2 - 1);
                const docId = notice.document_nft_id || (notice.id * 2);
                
                html += `
                    <tr style="border-bottom: 1px solid #444;">
                        <td style="padding: 8px; color: #fff;">${notice.id}</td>
                        <td style="padding: 8px; color: #fff;">
                            ${notice.alert_nft_id ? `#${alertId}` : `<span style="color: #ef4444;">#${alertId} (calc)</span>`}
                        </td>
                        <td style="padding: 8px; color: #fff;">
                            ${notice.document_nft_id ? `#${docId}` : `<span style="color: #ef4444;">#${docId} (calc)</span>`}
                        </td>
                        <td style="padding: 8px; color: #ccc;">${notice.case_number || '-'}</td>
                        <td style="padding: 8px; color: #ccc;">${(notice.recipient_name || '-').substring(0, 20)}</td>
                        <td style="padding: 8px;">
                            <span style="color: ${statusColor}; font-weight: bold;">${notice.status}</span>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            
            html += `
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #444;">
                    <p style="color: #999; font-size: 12px;">
                        Total: ${notices.length} notices | 
                        <span style="color: #ef4444;">Red IDs</span> = calculated from notice ID
                    </p>
                </div>
            `;
            
            document.getElementById('data-content').innerHTML = html;
            
        } catch (error) {
            console.error('Failed to load notices:', error);
            document.getElementById('data-content').innerHTML = 
                `<p style="color: #ef4444;">Error: ${error.message}</p>`;
        }
    },
    
    async loadAlerts() {
        document.getElementById('data-title').textContent = 'Alert NFT Status';
        document.getElementById('data-content').innerHTML = '<p>Checking alerts...</p>';
        
        const alertIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
        const results = [];
        
        for (const id of alertIds) {
            try {
                // Check if metadata exists
                const resp = await fetch(`/api/alerts/alert/${id}/metadata`);
                results.push({
                    id,
                    hasMetadata: resp.ok,
                    status: resp.ok ? 'OK' : 'Missing'
                });
            } catch (e) {
                results.push({
                    id,
                    hasMetadata: false,
                    status: 'Error'
                });
            }
        }
        
        let html = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px;">
        `;
        
        results.forEach(alert => {
            const color = alert.hasMetadata ? '#10b981' : '#ef4444';
            html += `
                <div style="background: #333; padding: 15px; border-radius: 6px; text-align: center; border: 2px solid ${color};">
                    <div style="color: #fff; font-size: 20px; font-weight: bold;">Alert #${alert.id}</div>
                    <div style="color: ${color}; font-size: 14px; margin-top: 5px;">${alert.status}</div>
                </div>
            `;
        });
        
        html += '</div>';
        
        document.getElementById('data-content').innerHTML = html;
    },
    
    loadLocalStorage() {
        document.getElementById('data-title').textContent = 'Local Storage Data';
        
        const relevantKeys = [
            'currentServerAddress',
            'registrations',
            'cached_notices',
            'isAdmin',
            'serverRole'
        ];
        
        let html = '<div style="font-family: monospace;">';
        
        relevantKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value) {
                let displayValue = value;
                try {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) {
                        displayValue = `Array[${parsed.length}]`;
                    } else if (typeof parsed === 'object') {
                        displayValue = `Object{${Object.keys(parsed).length} keys}`;
                    }
                } catch (e) {
                    // Not JSON, show as is
                    if (displayValue.length > 50) {
                        displayValue = displayValue.substring(0, 50) + '...';
                    }
                }
                
                html += `
                    <div style="margin-bottom: 15px; padding: 10px; background: #333; border-radius: 4px;">
                        <div style="color: #0ea5e9; font-weight: bold;">${key}:</div>
                        <div style="color: #ccc; margin-top: 5px;">${displayValue}</div>
                    </div>
                `;
            }
        });
        
        html += '</div>';
        
        document.getElementById('data-content').innerHTML = html;
    },
    
    async runDiagnostics() {
        document.getElementById('data-title').textContent = 'System Diagnostics';
        document.getElementById('data-content').innerHTML = '<p>Running diagnostics...</p>';
        
        const checks = [];
        
        // Check API connectivity
        try {
            const resp = await fetch('/api/notices');
            checks.push({
                component: 'API Backend',
                status: resp.ok ? 'OK' : `Error ${resp.status}`,
                color: resp.ok ? '#10b981' : '#ef4444'
            });
        } catch (e) {
            checks.push({
                component: 'API Backend',
                status: 'Unreachable',
                color: '#ef4444'
            });
        }
        
        // Check contract
        checks.push({
            component: 'Smart Contract',
            status: window.legalContract ? 'Connected' : 'Not Connected',
            color: window.legalContract ? '#10b981' : '#f59e0b'
        });
        
        // Check wallet
        checks.push({
            component: 'TronLink Wallet',
            status: window.tronWeb?.defaultAddress?.base58 ? 'Connected' : 'Not Connected',
            color: window.tronWeb?.defaultAddress?.base58 ? '#10b981' : '#f59e0b'
        });
        
        // Check base64 fix
        checks.push({
            component: 'Base64 Alert Fix',
            status: window.FixFutureAlertMinting ? 'Installed' : 'Not Installed',
            color: window.FixFutureAlertMinting ? '#10b981' : '#ef4444'
        });
        
        // Check BlockServed overlay
        checks.push({
            component: 'BlockServed Overlay',
            status: window.AlertOverlayBlockServed ? 'Installed' : 'Not Installed',
            color: window.AlertOverlayBlockServed ? '#10b981' : '#f59e0b'
        });
        
        let html = '<div style="display: grid; gap: 10px;">';
        
        checks.forEach(check => {
            html += `
                <div style="display: flex; justify-content: space-between; padding: 12px; background: #333; border-radius: 6px;">
                    <span style="color: #fff;">${check.component}</span>
                    <span style="color: ${check.color}; font-weight: bold;">${check.status}</span>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Add recommendations
        const issues = checks.filter(c => c.status !== 'OK' && c.status !== 'Connected' && c.status !== 'Installed');
        if (issues.length > 0) {
            html += `
                <div style="margin-top: 20px; padding: 15px; background: #ef444422; border: 1px solid #ef4444; border-radius: 6px;">
                    <div style="color: #ef4444; font-weight: bold; margin-bottom: 10px;">⚠️ Issues Detected</div>
                    <div style="color: #ccc;">`;
            
            if (checks.find(c => c.component === 'Base64 Alert Fix' && c.status === 'Not Installed')) {
                html += '<p>• Load base64 fix: <code>fix-future-alert-minting.js</code></p>';
            }
            if (checks.find(c => c.component === 'BlockServed Overlay' && c.status === 'Not Installed')) {
                html += '<p>• Load overlay: <code>alert-overlay-blockserved.js</code></p>';
            }
            
            html += '</div></div>';
        }
        
        document.getElementById('data-content').innerHTML = html;
    },
    
    async refreshAll() {
        document.getElementById('db-status').textContent = 'Refreshing...';
        document.getElementById('db-status').style.background = '#f59e0b';
        
        await this.loadStats();
        
        document.getElementById('db-status').textContent = 'Ready';
        document.getElementById('db-status').style.background = '#10b981';
        
        // Show success message
        document.getElementById('data-title').textContent = 'Data Refreshed';
        document.getElementById('data-content').innerHTML = 
            '<p style="color: #10b981;">✅ All data has been refreshed successfully</p>';
    },
    
    showError(message) {
        const errorDiv = document.getElementById('error-display');
        const errorMsg = document.getElementById('error-message');
        
        if (errorDiv && errorMsg) {
            errorMsg.textContent = message;
            errorDiv.style.display = 'block';
            
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    }
};

// Auto-initialize
DatabasePortalFixed.init();

// Auto-open if admin tab is visible
setTimeout(() => {
    const adminTab = document.getElementById('adminTab');
    if (adminTab && adminTab.style.display !== 'none') {
        console.log('Admin tab detected - auto-opening portal');
        DatabasePortalFixed.openPortal();
    }
}, 1000);

console.log('\n✅ Fixed Database Portal loaded');
console.log('Press Ctrl+Shift+D to open portal');
console.log('Or run: DatabasePortalFixed.openPortal()');