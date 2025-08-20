/**
 * FIX ADMIN DATABASE PORTAL
 * Repairs the database management UI in the admin tab
 */

console.log('🔧 FIXING DATABASE MANAGEMENT PORTAL');
console.log('=' .repeat(70));

window.FixAdminDatabasePortal = {
    
    init() {
        console.log('Initializing database portal fix...');
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupPortal());
        } else {
            this.setupPortal();
        }
    },
    
    setupPortal() {
        console.log('Setting up database portal...');
        
        // Find or create the database management section
        let dbSection = document.getElementById('database-management');
        
        if (!dbSection) {
            console.log('Creating database management section...');
            
            // Find admin content area
            const adminContent = document.querySelector('.admin-content') || 
                                document.querySelector('#admin-content') ||
                                document.querySelector('[id*="admin"]');
            
            if (!adminContent) {
                console.error('Admin content area not found');
                return;
            }
            
            // Create database section
            dbSection = document.createElement('div');
            dbSection.id = 'database-management';
            dbSection.className = 'database-portal';
            dbSection.innerHTML = this.getPortalHTML();
            
            adminContent.appendChild(dbSection);
        } else {
            // Update existing section
            dbSection.innerHTML = this.getPortalHTML();
        }
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Load initial data
        this.loadDatabaseOverview();
        
        console.log('✅ Database portal setup complete');
    },
    
    getPortalHTML() {
        return `
            <div class="database-portal-container" style="padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #333; margin-bottom: 20px;">🗄️ Database Management Portal</h2>
                
                <!-- Stats Overview -->
                <div class="db-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px;">
                    <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="color: #666; font-size: 14px; margin: 0;">Total Notices</h3>
                        <p id="total-notices" style="font-size: 32px; font-weight: bold; color: #2196F3; margin: 10px 0;">-</p>
                    </div>
                    <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="color: #666; font-size: 14px; margin: 0;">Pending</h3>
                        <p id="pending-notices" style="font-size: 32px; font-weight: bold; color: #FF9800; margin: 10px 0;">-</p>
                    </div>
                    <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="color: #666; font-size: 14px; margin: 0;">Served</h3>
                        <p id="served-notices" style="font-size: 32px; font-weight: bold; color: #4CAF50; margin: 10px 0;">-</p>
                    </div>
                    <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="color: #666; font-size: 14px; margin: 0;">Process Servers</h3>
                        <p id="total-servers" style="font-size: 32px; font-weight: bold; color: #9C27B0; margin: 10px 0;">-</p>
                    </div>
                </div>
                
                <!-- Control Buttons -->
                <div class="db-controls" style="margin-bottom: 20px;">
                    <button id="refresh-db" style="background: #2196F3; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                        🔄 Refresh Data
                    </button>
                    <button id="view-notices" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                        📋 View Notices
                    </button>
                    <button id="view-servers" style="background: #9C27B0; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                        👥 View Servers
                    </button>
                    <button id="fix-issues" style="background: #FF5722; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                        🔧 Fix Issues
                    </button>
                </div>
                
                <!-- Data Table -->
                <div class="db-table-container" style="background: white; border-radius: 8px; padding: 20px; max-height: 500px; overflow-y: auto;">
                    <h3 id="table-title" style="margin-top: 0;">Database Contents</h3>
                    <div id="db-table-content">
                        <p style="color: #999;">Select a view option above to display data</p>
                    </div>
                </div>
                
                <!-- Status Messages -->
                <div id="db-status" style="margin-top: 20px; padding: 10px; border-radius: 4px; display: none;"></div>
            </div>
        `;
    },
    
    attachEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-db');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadDatabaseOverview());
        }
        
        // View notices button
        const noticesBtn = document.getElementById('view-notices');
        if (noticesBtn) {
            noticesBtn.addEventListener('click', () => this.viewNotices());
        }
        
        // View servers button
        const serversBtn = document.getElementById('view-servers');
        if (serversBtn) {
            serversBtn.addEventListener('click', () => this.viewServers());
        }
        
        // Fix issues button
        const fixBtn = document.getElementById('fix-issues');
        if (fixBtn) {
            fixBtn.addEventListener('click', () => this.fixDatabaseIssues());
        }
    },
    
    async loadDatabaseOverview() {
        console.log('Loading database overview...');
        this.showStatus('Loading database statistics...', 'info');
        
        try {
            // Fetch notices
            const noticesResp = await fetch('/api/notices', {
                headers: {
                    'X-Server-Address': localStorage.getItem('currentServerAddress') || ''
                }
            });
            
            if (noticesResp.ok) {
                const notices = await noticesResp.json();
                
                // Update stats
                document.getElementById('total-notices').textContent = notices.length;
                document.getElementById('pending-notices').textContent = 
                    notices.filter(n => n.status === 'pending').length;
                document.getElementById('served-notices').textContent = 
                    notices.filter(n => n.status === 'served').length;
                
                // Store for later use
                window.dbNotices = notices;
            }
            
            // Fetch process servers
            const serversResp = await fetch('/api/process-servers');
            if (serversResp.ok) {
                const servers = await serversResp.json();
                document.getElementById('total-servers').textContent = servers.length;
                window.dbServers = servers;
            }
            
            this.showStatus('Database overview loaded successfully', 'success');
            
        } catch (error) {
            console.error('Failed to load database overview:', error);
            this.showStatus('Failed to load database: ' + error.message, 'error');
        }
    },
    
    async viewNotices() {
        console.log('Viewing notices...');
        this.showStatus('Loading notices...', 'info');
        
        try {
            const response = await fetch('/api/notices', {
                headers: {
                    'X-Server-Address': localStorage.getItem('currentServerAddress') || ''
                }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const notices = await response.json();
            
            // Create table HTML
            let tableHTML = `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">ID</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Alert ID</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Case Number</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Recipient</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Status</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Created</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            notices.forEach(notice => {
                const statusColor = notice.status === 'served' ? '#4CAF50' : 
                                  notice.status === 'pending' ? '#FF9800' : '#2196F3';
                
                tableHTML += `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${notice.id}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${notice.alert_nft_id || '-'}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${notice.case_number || '-'}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${notice.recipient_name || '-'}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">
                            <span style="color: ${statusColor}; font-weight: bold;">${notice.status}</span>
                        </td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">
                            ${new Date(notice.created_at).toLocaleDateString()}
                        </td>
                    </tr>
                `;
            });
            
            tableHTML += '</tbody></table>';
            
            document.getElementById('table-title').textContent = `Notices (${notices.length} total)`;
            document.getElementById('db-table-content').innerHTML = tableHTML;
            
            this.showStatus(`Showing ${notices.length} notices`, 'success');
            
        } catch (error) {
            console.error('Failed to load notices:', error);
            this.showStatus('Failed to load notices: ' + error.message, 'error');
        }
    },
    
    async viewServers() {
        console.log('Viewing process servers...');
        this.showStatus('Loading process servers...', 'info');
        
        try {
            const response = await fetch('/api/process-servers');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const servers = await response.json();
            
            // Create table HTML
            let tableHTML = `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">ID</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Name</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Wallet Address</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Status</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Notices</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Verified</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            servers.forEach(server => {
                const statusColor = server.status === 'active' ? '#4CAF50' : '#999';
                
                tableHTML += `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${server.id}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${server.name || '-'}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">
                            ${server.wallet_address ? server.wallet_address.substring(0, 10) + '...' : '-'}
                        </td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">
                            <span style="color: ${statusColor}; font-weight: bold;">${server.status}</span>
                        </td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${server.notice_count || 0}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">
                            ${server.verified ? '✅' : '❌'}
                        </td>
                    </tr>
                `;
            });
            
            tableHTML += '</tbody></table>';
            
            document.getElementById('table-title').textContent = `Process Servers (${servers.length} total)`;
            document.getElementById('db-table-content').innerHTML = tableHTML;
            
            this.showStatus(`Showing ${servers.length} process servers`, 'success');
            
        } catch (error) {
            console.error('Failed to load servers:', error);
            this.showStatus('Failed to load servers: ' + error.message, 'error');
        }
    },
    
    async fixDatabaseIssues() {
        console.log('Fixing database issues...');
        this.showStatus('Scanning for database issues...', 'info');
        
        try {
            const response = await fetch('/api/notices');
            if (!response.ok) throw new Error('Failed to fetch notices');
            
            const notices = await response.json();
            const issues = [];
            
            // Check for null alert IDs
            const nullAlerts = notices.filter(n => !n.alert_nft_id || n.alert_nft_id === 'null');
            if (nullAlerts.length > 0) {
                issues.push(`${nullAlerts.length} notices with null alert IDs`);
            }
            
            if (issues.length === 0) {
                this.showStatus('No database issues found!', 'success');
                return;
            }
            
            // Fix null references
            this.showStatus(`Fixing ${issues.join(', ')}...`, 'warning');
            
            for (const notice of nullAlerts) {
                const alertId = notice.id * 2 - 1;
                const documentId = notice.id * 2;
                
                await fetch(`/api/notices/${notice.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Server-Address': localStorage.getItem('currentServerAddress') || ''
                    },
                    body: JSON.stringify({
                        alert_nft_id: alertId,
                        document_nft_id: documentId
                    })
                });
            }
            
            this.showStatus(`✅ Fixed ${issues.join(', ')}`, 'success');
            
            // Reload data
            this.loadDatabaseOverview();
            
        } catch (error) {
            console.error('Failed to fix issues:', error);
            this.showStatus('Failed to fix issues: ' + error.message, 'error');
        }
    },
    
    showStatus(message, type = 'info') {
        const statusDiv = document.getElementById('db-status');
        if (!statusDiv) return;
        
        const colors = {
            info: '#2196F3',
            success: '#4CAF50',
            warning: '#FF9800',
            error: '#F44336'
        };
        
        statusDiv.style.display = 'block';
        statusDiv.style.background = colors[type] + '22';
        statusDiv.style.border = `1px solid ${colors[type]}`;
        statusDiv.style.color = colors[type];
        statusDiv.innerHTML = `<strong>${type.toUpperCase()}:</strong> ${message}`;
        
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    }
};

// Auto-initialize when script loads
FixAdminDatabasePortal.init();

console.log('\n✅ Database Management Portal initialized');
console.log('The portal should now be visible in the admin tab');