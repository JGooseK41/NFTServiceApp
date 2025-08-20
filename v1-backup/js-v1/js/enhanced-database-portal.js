/**
 * ENHANCED DATABASE PORTAL
 * Complete database management solution for admin tab
 */

console.log('🗄️ ENHANCED DATABASE PORTAL INITIALIZING');
console.log('=' .repeat(70));

window.EnhancedDatabasePortal = {
    
    isInitialized: false,
    
    init() {
        console.log('Initializing Enhanced Database Portal...');
        
        // Override the existing initDatabaseManagement function
        window.initDatabaseManagement = () => {
            this.openPortal();
        };
        
        // Also check if admin tab is currently open
        const adminTab = document.getElementById('adminTab');
        if (adminTab && adminTab.style.display !== 'none') {
            // Admin tab is open, auto-initialize
            setTimeout(() => this.setupPortalButton(), 500);
        }
        
        console.log('✅ Enhanced Database Portal ready');
    },
    
    setupPortalButton() {
        // Find the database management button and ensure it works
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            if (btn.textContent.includes('Open Database Manager')) {
                btn.onclick = () => this.openPortal();
                console.log('✅ Database Manager button configured');
            }
        });
    },
    
    openPortal() {
        console.log('Opening Enhanced Database Portal...');
        
        const container = document.getElementById('databaseManagementContent');
        if (!container) {
            console.error('Database management container not found');
            return;
        }
        
        // Show the container
        container.style.display = 'block';
        
        // Create the portal interface
        container.innerHTML = `
            <div class="database-portal" style="padding: 20px;">
                <!-- Header -->
                <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid var(--border-color);">
                    <h3 style="color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-database"></i>
                        Database Management Portal
                        <span id="db-connection-status" style="margin-left: auto; font-size: 14px; padding: 5px 10px; background: var(--success); color: white; border-radius: 4px;">
                            <i class="fas fa-check-circle"></i> Connected
                        </span>
                    </h3>
                </div>
                
                <!-- Statistics Grid -->
                <div class="db-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px;">
                    <div class="stat-card" style="background: var(--card-bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
                        <div style="color: var(--text-secondary); font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">
                            <i class="fas fa-file-alt"></i> Total Notices
                        </div>
                        <div id="stat-total-notices" style="color: var(--text-primary); font-size: 32px; font-weight: bold;">-</div>
                    </div>
                    <div class="stat-card" style="background: var(--card-bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
                        <div style="color: var(--text-secondary); font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">
                            <i class="fas fa-clock"></i> Pending
                        </div>
                        <div id="stat-pending" style="color: #f59e0b; font-size: 32px; font-weight: bold;">-</div>
                    </div>
                    <div class="stat-card" style="background: var(--card-bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
                        <div style="color: var(--text-secondary); font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">
                            <i class="fas fa-check"></i> Served
                        </div>
                        <div id="stat-served" style="color: #10b981; font-size: 32px; font-weight: bold;">-</div>
                    </div>
                    <div class="stat-card" style="background: var(--card-bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
                        <div style="color: var(--text-secondary); font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">
                            <i class="fas fa-users"></i> Process Servers
                        </div>
                        <div id="stat-servers" style="color: #8b5cf6; font-size: 32px; font-weight: bold;">-</div>
                    </div>
                </div>
                
                <!-- Control Buttons -->
                <div class="db-controls" style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="EnhancedDatabasePortal.refreshData()" class="btn btn-primary">
                        <i class="fas fa-sync"></i> Refresh Data
                    </button>
                    <button onclick="EnhancedDatabasePortal.viewNotices()" class="btn btn-success">
                        <i class="fas fa-file-alt"></i> View Notices
                    </button>
                    <button onclick="EnhancedDatabasePortal.viewServers()" class="btn btn-info">
                        <i class="fas fa-users"></i> View Servers
                    </button>
                    <button onclick="EnhancedDatabasePortal.viewAlerts()" class="btn btn-warning">
                        <i class="fas fa-bell"></i> View Alerts
                    </button>
                    <button onclick="EnhancedDatabasePortal.runDiagnostics()" class="btn btn-danger">
                        <i class="fas fa-stethoscope"></i> Run Diagnostics
                    </button>
                    <button onclick="EnhancedDatabasePortal.exportData()" class="btn btn-secondary">
                        <i class="fas fa-download"></i> Export Data
                    </button>
                </div>
                
                <!-- Data Display Area -->
                <div class="db-data-area" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px; min-height: 400px;">
                    <h4 id="data-title" style="color: var(--text-primary); margin-top: 0;">Select a view option above</h4>
                    <div id="data-content" style="overflow-x: auto;">
                        <p style="color: var(--text-secondary);">Click one of the buttons above to view database contents</p>
                    </div>
                </div>
                
                <!-- Status Messages -->
                <div id="db-status-messages" style="margin-top: 20px;"></div>
            </div>
        `;
        
        // Load initial data
        this.refreshData();
        this.isInitialized = true;
    },
    
    async refreshData() {
        this.showStatus('Refreshing database statistics...', 'info');
        
        try {
            // Fetch notices
            const noticesResp = await fetch('/api/notices', {
                headers: {
                    'X-Server-Address': localStorage.getItem('currentServerAddress') || ''
                }
            });
            
            if (noticesResp.ok) {
                const notices = await noticesResp.json();
                document.getElementById('stat-total-notices').textContent = notices.length;
                document.getElementById('stat-pending').textContent = 
                    notices.filter(n => n.status === 'pending').length;
                document.getElementById('stat-served').textContent = 
                    notices.filter(n => n.status === 'served').length;
                
                // Store for later use
                this.cachedNotices = notices;
                console.log(`Loaded ${notices.length} notices`);
            }
            
            // Fetch process servers
            const serversResp = await fetch('/api/process-servers');
            if (serversResp.ok) {
                const servers = await serversResp.json();
                document.getElementById('stat-servers').textContent = servers.length;
                this.cachedServers = servers;
                console.log(`Loaded ${servers.length} process servers`);
            }
            
            this.showStatus('Data refreshed successfully', 'success');
            
        } catch (error) {
            console.error('Failed to refresh data:', error);
            this.showStatus('Failed to refresh data: ' + error.message, 'error');
        }
    },
    
    async viewNotices() {
        this.showStatus('Loading notices...', 'info');
        document.getElementById('data-title').textContent = 'Legal Notices';
        
        try {
            const notices = this.cachedNotices || await this.fetchNotices();
            
            if (notices.length === 0) {
                document.getElementById('data-content').innerHTML = 
                    '<p style="color: var(--text-secondary);">No notices found</p>';
                return;
            }
            
            let html = `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--gray-800);">
                            <th style="padding: 12px; text-align: left; color: var(--text-primary);">ID</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-primary);">Alert NFT</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-primary);">Document NFT</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-primary);">Case Number</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-primary);">Recipient</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-primary);">Status</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-primary);">Created</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            notices.forEach(notice => {
                const statusColor = notice.status === 'served' ? '#10b981' : 
                                  notice.status === 'pending' ? '#f59e0b' : '#0ea5e9';
                
                html += `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 10px; color: var(--text-primary);">${notice.id}</td>
                        <td style="padding: 10px; color: var(--text-primary);">
                            ${notice.alert_nft_id ? `#${notice.alert_nft_id}` : '<span style="color: #ef4444;">NULL</span>'}
                        </td>
                        <td style="padding: 10px; color: var(--text-primary);">
                            ${notice.document_nft_id ? `#${notice.document_nft_id}` : '<span style="color: #ef4444;">NULL</span>'}
                        </td>
                        <td style="padding: 10px; color: var(--text-primary);">${notice.case_number || '-'}</td>
                        <td style="padding: 10px; color: var(--text-primary);">${notice.recipient_name || '-'}</td>
                        <td style="padding: 10px;">
                            <span style="color: ${statusColor}; font-weight: bold;">${notice.status}</span>
                        </td>
                        <td style="padding: 10px; color: var(--text-secondary);">
                            ${new Date(notice.created_at).toLocaleDateString()}
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
            document.getElementById('data-content').innerHTML = html;
            this.showStatus(`Showing ${notices.length} notices`, 'success');
            
        } catch (error) {
            console.error('Failed to load notices:', error);
            this.showStatus('Failed to load notices: ' + error.message, 'error');
        }
    },
    
    async viewServers() {
        this.showStatus('Loading process servers...', 'info');
        document.getElementById('data-title').textContent = 'Process Servers';
        
        try {
            const servers = this.cachedServers || await this.fetchServers();
            
            if (servers.length === 0) {
                document.getElementById('data-content').innerHTML = 
                    '<p style="color: var(--text-secondary);">No process servers found</p>';
                return;
            }
            
            let html = `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--gray-800);">
                            <th style="padding: 12px; text-align: left; color: var(--text-primary);">ID</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-primary);">Name</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-primary);">Agency</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-primary);">Wallet Address</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-primary);">Status</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-primary);">Verified</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            servers.forEach(server => {
                const statusColor = server.status === 'active' ? '#10b981' : 
                                  server.status === 'pending' ? '#f59e0b' : '#6b7280';
                
                html += `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 10px; color: var(--text-primary);">${server.id}</td>
                        <td style="padding: 10px; color: var(--text-primary);">${server.name || '-'}</td>
                        <td style="padding: 10px; color: var(--text-primary);">${server.agency || '-'}</td>
                        <td style="padding: 10px; color: var(--text-primary);">
                            ${server.wallet_address ? server.wallet_address.substring(0, 10) + '...' : '-'}
                        </td>
                        <td style="padding: 10px;">
                            <span style="color: ${statusColor}; font-weight: bold;">${server.status || 'unknown'}</span>
                        </td>
                        <td style="padding: 10px; text-align: center;">
                            ${server.verified ? '✅' : '❌'}
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
            document.getElementById('data-content').innerHTML = html;
            this.showStatus(`Showing ${servers.length} process servers`, 'success');
            
        } catch (error) {
            console.error('Failed to load servers:', error);
            this.showStatus('Failed to load servers: ' + error.message, 'error');
        }
    },
    
    async viewAlerts() {
        this.showStatus('Loading alert metadata...', 'info');
        document.getElementById('data-title').textContent = 'Alert NFT Metadata';
        
        const alerts = [];
        const alertIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
        
        for (const id of alertIds) {
            try {
                const resp = await fetch(`/api/alerts/alert/${id}/metadata`);
                if (resp.ok) {
                    const data = await resp.json();
                    alerts.push({ id, ...data });
                }
            } catch (e) {
                // Skip if not found
            }
        }
        
        if (alerts.length === 0) {
            document.getElementById('data-content').innerHTML = 
                '<p style="color: var(--text-secondary);">No alert metadata found</p>';
            return;
        }
        
        let html = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--gray-800);">
                        <th style="padding: 12px; text-align: left; color: var(--text-primary);">Alert ID</th>
                        <th style="padding: 12px; text-align: left; color: var(--text-primary);">Type</th>
                        <th style="padding: 12px; text-align: left; color: var(--text-primary);">Has Metadata</th>
                        <th style="padding: 12px; text-align: left; color: var(--text-primary);">Has Image</th>
                        <th style="padding: 12px; text-align: left; color: var(--text-primary);">BlockServed Compatible</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        alerts.forEach(alert => {
            html += `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 10px; color: var(--text-primary);">#${alert.id}</td>
                    <td style="padding: 10px; color: var(--text-primary);">${alert.type || 'unknown'}</td>
                    <td style="padding: 10px; text-align: center;">
                        ${alert.metadata ? '✅' : '❌'}
                    </td>
                    <td style="padding: 10px; text-align: center;">
                        ${alert.metadata?.image ? '✅' : '❌'}
                    </td>
                    <td style="padding: 10px; text-align: center;">
                        ${alert.blockserved_compatible ? '✅' : '❌'}
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        document.getElementById('data-content').innerHTML = html;
        this.showStatus(`Found ${alerts.length} alert metadata records`, 'success');
    },
    
    async runDiagnostics() {
        this.showStatus('Running diagnostics...', 'info');
        document.getElementById('data-title').textContent = 'System Diagnostics';
        
        const issues = [];
        const checks = [];
        
        // Check for null NFT IDs
        if (this.cachedNotices) {
            const nullAlerts = this.cachedNotices.filter(n => !n.alert_nft_id || n.alert_nft_id === 'null');
            checks.push({
                name: 'Null Alert IDs',
                status: nullAlerts.length === 0 ? 'OK' : 'ISSUE',
                details: nullAlerts.length === 0 ? 'All notices have valid alert IDs' : 
                        `${nullAlerts.length} notices with null alert IDs: ${nullAlerts.map(n => n.id).join(', ')}`
            });
        }
        
        // Check backend connectivity
        try {
            const resp = await fetch('/api/health');
            checks.push({
                name: 'Backend API',
                status: resp.ok ? 'OK' : 'ERROR',
                details: resp.ok ? 'Backend is responding' : `HTTP ${resp.status}`
            });
        } catch (e) {
            checks.push({
                name: 'Backend API',
                status: 'ERROR',
                details: 'Cannot connect to backend'
            });
        }
        
        // Check contract connection
        checks.push({
            name: 'Smart Contract',
            status: window.legalContract ? 'OK' : 'ERROR',
            details: window.legalContract ? `Connected to ${window.CONTRACT_ADDRESS}` : 'Contract not initialized'
        });
        
        // Check wallet connection
        checks.push({
            name: 'Wallet Connection',
            status: window.tronWeb?.defaultAddress?.base58 ? 'OK' : 'WARNING',
            details: window.tronWeb?.defaultAddress?.base58 || 'No wallet connected'
        });
        
        // Display results
        let html = `
            <div style="margin-bottom: 20px;">
                <h4 style="color: var(--text-primary);">System Health Check</h4>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--gray-800);">
                        <th style="padding: 12px; text-align: left; color: var(--text-primary);">Component</th>
                        <th style="padding: 12px; text-align: left; color: var(--text-primary);">Status</th>
                        <th style="padding: 12px; text-align: left; color: var(--text-primary);">Details</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        checks.forEach(check => {
            const statusColor = check.status === 'OK' ? '#10b981' : 
                              check.status === 'WARNING' ? '#f59e0b' : '#ef4444';
            
            html += `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 10px; color: var(--text-primary);">${check.name}</td>
                    <td style="padding: 10px;">
                        <span style="color: ${statusColor}; font-weight: bold;">${check.status}</span>
                    </td>
                    <td style="padding: 10px; color: var(--text-secondary);">${check.details}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        
        // Add fix button if issues found
        const hasIssues = checks.some(c => c.status !== 'OK');
        if (hasIssues) {
            html += `
                <div style="margin-top: 20px;">
                    <button onclick="EnhancedDatabasePortal.fixIssues()" class="btn btn-warning">
                        <i class="fas fa-wrench"></i> Attempt Auto-Fix
                    </button>
                </div>
            `;
        }
        
        document.getElementById('data-content').innerHTML = html;
        this.showStatus('Diagnostics complete', hasIssues ? 'warning' : 'success');
    },
    
    async fixIssues() {
        this.showStatus('Attempting to fix issues...', 'info');
        
        // Fix null alert IDs
        if (this.cachedNotices) {
            const nullAlerts = this.cachedNotices.filter(n => !n.alert_nft_id || n.alert_nft_id === 'null');
            
            for (const notice of nullAlerts) {
                const alertId = notice.id * 2 - 1;
                const documentId = notice.id * 2;
                
                try {
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
                    
                    console.log(`Fixed notice ${notice.id}`);
                } catch (e) {
                    console.error(`Failed to fix notice ${notice.id}:`, e);
                }
            }
        }
        
        this.showStatus('Fix attempt complete. Refreshing data...', 'success');
        await this.refreshData();
        await this.runDiagnostics();
    },
    
    async exportData() {
        this.showStatus('Preparing export...', 'info');
        
        const data = {
            exportDate: new Date().toISOString(),
            notices: this.cachedNotices || [],
            servers: this.cachedServers || [],
            stats: {
                totalNotices: document.getElementById('stat-total-notices').textContent,
                pending: document.getElementById('stat-pending').textContent,
                served: document.getElementById('stat-served').textContent,
                servers: document.getElementById('stat-servers').textContent
            }
        };
        
        // Create download
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `database-export-${Date.now()}.json`;
        a.click();
        
        this.showStatus('Export complete', 'success');
    },
    
    async fetchNotices() {
        const resp = await fetch('/api/notices', {
            headers: {
                'X-Server-Address': localStorage.getItem('currentServerAddress') || ''
            }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
    },
    
    async fetchServers() {
        const resp = await fetch('/api/process-servers');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
    },
    
    showStatus(message, type = 'info') {
        const container = document.getElementById('db-status-messages');
        if (!container) return;
        
        const colors = {
            info: '#0ea5e9',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444'
        };
        
        const statusDiv = document.createElement('div');
        statusDiv.style.cssText = `
            padding: 12px;
            margin-bottom: 10px;
            background: ${colors[type]}22;
            border: 1px solid ${colors[type]};
            border-radius: 6px;
            color: ${colors[type]};
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const icon = type === 'info' ? 'fa-info-circle' :
                    type === 'success' ? 'fa-check-circle' :
                    type === 'warning' ? 'fa-exclamation-triangle' :
                    'fa-times-circle';
        
        statusDiv.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        `;
        
        container.innerHTML = '';
        container.appendChild(statusDiv);
        
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                statusDiv.style.opacity = '0';
                setTimeout(() => statusDiv.remove(), 300);
            }, 5000);
        }
    }
};

// Auto-initialize
EnhancedDatabasePortal.init();

console.log('\n✅ Enhanced Database Portal loaded');
console.log('Click "Open Database Manager" button in admin panel to use');
console.log('Or run: EnhancedDatabasePortal.openPortal()');