/**
 * Admin Dashboard Frontend
 * Complete administrative interface for managing the system
 */

class AdminDashboard {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        this.adminAddress = null;
        this.currentView = 'overview';
        this.selectedServer = null;
        this.selectedCase = null;
    }

    /**
     * Initialize admin dashboard in existing tab section
     */
    async initInTabSection() {
        // Check if user is admin
        if (!await this.checkAdminAccess()) {
            document.getElementById('databaseManagementContent').innerHTML = `
                <div class="alert alert-error">
                    <i class="fas fa-lock"></i>
                    <div>
                        <strong>Access Denied</strong>
                        <p>Admin access required. Your wallet: ${window.tronWeb?.defaultAddress?.base58 || 'Not connected'}</p>
                    </div>
                </div>
            `;
            return;
        }

        // Create dashboard UI in the database management content area
        this.createDashboardInSection();
        
        // Load initial data
        await this.loadOverview();
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('👨‍💼 Database Management initialized');
    }

    /**
     * Initialize admin dashboard in existing tab (deprecated)
     */
    async initInTab() {
        // Check if user is admin
        if (!await this.checkAdminAccess()) {
            this.showAccessDenied();
            return;
        }

        // Create dashboard UI in existing admin content area
        this.createDashboardInTab();
        
        // Load initial data
        await this.loadOverview();
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('👨‍💼 Database Management initialized');
    }

    /**
     * Initialize admin dashboard (full screen - deprecated)
     */
    async init() {
        // Check if user is admin
        if (!await this.checkAdminAccess()) {
            this.showAccessDenied();
            return;
        }

        // Create dashboard UI
        this.createDashboardUI();
        
        // Load initial data
        await this.loadOverview();
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('👨‍💼 Admin Dashboard initialized');
    }

    /**
     * Check if current user is admin
     */
    async checkAdminAccess() {
        const ADMIN_ADDRESSES = [
            'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY', // Your actual admin address
            'TJRex3vGsNeoNjKWEXsM87qCDdvqV7Koa6'  // Backup/test address (remove if not needed)
        ];
        
        if (window.tronWeb && window.tronWeb.defaultAddress) {
            this.adminAddress = window.tronWeb.defaultAddress.base58;
            return ADMIN_ADDRESSES.includes(this.adminAddress);
        }
        
        return false;
    }

    /**
     * Create dashboard UI in the database management section
     */
    createDashboardInSection() {
        const container = document.getElementById('databaseManagementContent');
        if (!container) {
            console.error('Database management content area not found');
            return;
        }
        
        container.innerHTML = `
            <!-- Navigation tabs -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 2px solid var(--gray-700); padding-bottom: 0.5rem;">
                <button class="db-nav-tab active" data-view="overview" onclick="adminDashboard.switchView('overview')">
                    📊 Overview
                </button>
                <button class="db-nav-tab" data-view="servers" onclick="adminDashboard.switchView('servers')">
                    👮 All Servers & Cases
                </button>
                <button class="db-nav-tab" data-view="cases" onclick="adminDashboard.switchView('cases')">
                    📋 Recent Cases
                </button>
                <button class="db-nav-tab" data-view="documents" onclick="adminDashboard.switchView('documents')">
                    📄 Documents
                </button>
                <button class="db-nav-tab" data-view="audit" onclick="adminDashboard.switchView('audit')">
                    📝 Audit Logs
                </button>
                <button class="db-nav-tab" data-view="search" onclick="adminDashboard.switchView('search')">
                    🔍 Search Database
                </button>
            </div>
            
            <!-- Content area -->
            <div id="adminContent" style="min-height: 400px;">
                <!-- Content will be loaded here -->
            </div>
            
            <style>
                .db-nav-tab {
                    padding: 0.5rem 1rem;
                    background: var(--gray-800);
                    border: 1px solid var(--gray-700);
                    border-radius: 4px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.3s;
                }
                
                .db-nav-tab:hover {
                    background: var(--gray-700);
                    color: var(--text-primary);
                }
                
                .db-nav-tab.active {
                    background: var(--accent-blue);
                    color: white;
                    border-color: var(--accent-blue);
                }
                
                .db-stat-card {
                    background: var(--gray-800);
                    padding: 1.5rem;
                    border-radius: 8px;
                    border: 1px solid var(--gray-700);
                }
                
                .db-stat-label {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 0.5rem;
                }
                
                .db-stat-value {
                    font-size: 2rem;
                    font-weight: bold;
                    color: var(--text-primary);
                }
                
                .db-data-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: var(--gray-800);
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                .db-data-table th {
                    background: var(--gray-900);
                    padding: 0.75rem;
                    text-align: left;
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 2px solid var(--gray-700);
                }
                
                .db-data-table td {
                    padding: 0.75rem;
                    border-bottom: 1px solid var(--gray-700);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }
                
                .db-data-table tr:hover {
                    background: rgba(59, 130, 246, 0.1);
                }
                
                .db-badge {
                    display: inline-block;
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                
                .db-badge.success {
                    background: rgba(34, 197, 94, 0.2);
                    color: #22c55e;
                }
                
                .db-badge.warning {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                }
                
                .db-badge.error {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }
                
                .db-badge.info {
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                }
            </style>
        `;
    }

    /**
     * Create dashboard UI in existing admin tab
     */
    createDashboardInTab() {
        // Find or create database management section
        let dbSection = document.getElementById('databaseManagementSection');
        if (!dbSection) {
            // Create new section in admin content
            const adminContent = document.getElementById('adminContent');
            if (!adminContent) {
                console.error('Admin content area not found');
                return;
            }
            
            dbSection = document.createElement('div');
            dbSection.id = 'databaseManagementSection';
            dbSection.className = 'card';
            dbSection.style.marginTop = '2rem';
            adminContent.appendChild(dbSection);
        }
        
        // Create the database management interface
        dbSection.innerHTML = `
            <div class="card-header">
                <h2><i class="fas fa-database"></i> Database Management</h2>
                <button class="btn btn-secondary btn-small" onclick="adminDashboard.refresh()">
                    <i class="fas fa-sync"></i> Refresh
                </button>
            </div>
            
            <div style="padding: 1rem;">
                <!-- Navigation tabs -->
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 2px solid var(--gray-700);">
                    <button class="db-nav-tab active" data-view="overview" onclick="adminDashboard.switchView('overview')">
                        📊 Overview
                    </button>
                    <button class="db-nav-tab" data-view="servers" onclick="adminDashboard.switchView('servers')">
                        👮 Process Servers
                    </button>
                    <button class="db-nav-tab" data-view="cases" onclick="adminDashboard.switchView('cases')">
                        📋 All Cases
                    </button>
                    <button class="db-nav-tab" data-view="documents" onclick="adminDashboard.switchView('documents')">
                        📄 Documents
                    </button>
                    <button class="db-nav-tab" data-view="audit" onclick="adminDashboard.switchView('audit')">
                        📝 Audit Logs
                    </button>
                    <button class="db-nav-tab" data-view="search" onclick="adminDashboard.switchView('search')">
                        🔍 Search
                    </button>
                </div>
                
                <!-- Content area -->
                <div id="adminContent" style="min-height: 400px;">
                    <!-- Content will be loaded here -->
                </div>
            </div>
            
            <style>
                .db-nav-tab {
                    padding: 0.75rem 1.25rem;
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.3s;
                    position: relative;
                }
                
                .db-nav-tab:hover {
                    color: var(--text-primary);
                }
                
                .db-nav-tab.active {
                    color: var(--accent-blue);
                }
                
                .db-nav-tab.active::after {
                    content: '';
                    position: absolute;
                    bottom: -2px;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: var(--accent-blue);
                }
                
                .db-stat-card {
                    background: var(--gray-800);
                    padding: 1.5rem;
                    border-radius: 8px;
                    border: 1px solid var(--gray-700);
                }
                
                .db-stat-label {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 0.5rem;
                }
                
                .db-stat-value {
                    font-size: 2rem;
                    font-weight: bold;
                    color: var(--text-primary);
                }
                
                .db-data-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: var(--gray-800);
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                .db-data-table th {
                    background: var(--gray-900);
                    padding: 0.75rem;
                    text-align: left;
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .db-data-table td {
                    padding: 0.75rem;
                    border-top: 1px solid var(--gray-700);
                    color: var(--text-primary);
                }
                
                .db-data-table tr:hover {
                    background: var(--gray-750);
                }
            </style>
        `;
    }

    /**
     * Create main dashboard UI (full screen)
     */
    createDashboardUI() {
        const dashboard = document.createElement('div');
        dashboard.id = 'adminDashboard';
        dashboard.className = 'admin-dashboard';
        dashboard.innerHTML = `
            <style>
                .admin-dashboard {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: #f3f4f6;
                    z-index: 9999;
                    overflow: auto;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .admin-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                
                .admin-nav {
                    background: white;
                    padding: 0;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    display: flex;
                    gap: 0;
                }
                
                .nav-tab {
                    padding: 15px 25px;
                    cursor: pointer;
                    border: none;
                    background: none;
                    font-size: 14px;
                    font-weight: 500;
                    color: #6b7280;
                    position: relative;
                    transition: all 0.3s;
                }
                
                .nav-tab:hover {
                    background: #f9fafb;
                    color: #111827;
                }
                
                .nav-tab.active {
                    color: #7c3aed;
                    background: #f9fafb;
                }
                
                .nav-tab.active::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: #7c3aed;
                }
                
                .admin-content {
                    padding: 20px;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .stat-card {
                    background: white;
                    padding: 20px;
                    border-radius: 12px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                
                .stat-label {
                    color: #6b7280;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 8px;
                }
                
                .stat-value {
                    font-size: 28px;
                    font-weight: bold;
                    color: #111827;
                }
                
                .stat-change {
                    font-size: 12px;
                    margin-top: 8px;
                }
                
                .stat-change.positive {
                    color: #10b981;
                }
                
                .stat-change.negative {
                    color: #ef4444;
                }
                
                .data-table {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                
                .table-header {
                    padding: 20px;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .search-box {
                    padding: 8px 16px;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    width: 300px;
                    font-size: 14px;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                
                th {
                    background: #f9fafb;
                    padding: 12px 20px;
                    text-align: left;
                    font-size: 12px;
                    font-weight: 600;
                    color: #6b7280;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                td {
                    padding: 16px 20px;
                    border-top: 1px solid #e5e7eb;
                    font-size: 14px;
                    color: #111827;
                }
                
                tr:hover {
                    background: #f9fafb;
                }
                
                .badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 100px;
                    font-size: 12px;
                    font-weight: 500;
                }
                
                .badge.success {
                    background: #d1fae5;
                    color: #065f46;
                }
                
                .badge.warning {
                    background: #fed7aa;
                    color: #92400e;
                }
                
                .badge.error {
                    background: #fee2e2;
                    color: #991b1b;
                }
                
                .badge.info {
                    background: #dbeafe;
                    color: #1e40af;
                }
                
                .action-btn {
                    padding: 6px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    background: white;
                    color: #374151;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .action-btn:hover {
                    background: #f3f4f6;
                    border-color: #9ca3af;
                }
                
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }
                
                .modal-content {
                    background: white;
                    border-radius: 12px;
                    max-width: 90%;
                    max-height: 90%;
                    overflow: auto;
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
                }
                
                .document-viewer {
                    padding: 20px;
                    min-width: 600px;
                }
                
                .close-btn {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    border: none;
                    background: #f3f4f6;
                    color: #6b7280;
                    cursor: pointer;
                    font-size: 18px;
                }
                
                .close-btn:hover {
                    background: #e5e7eb;
                    color: #111827;
                }
            </style>
            
            <div class="admin-header">
                <h1 style="margin: 0; font-size: 24px;">🛡️ Admin Dashboard</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">
                    Connected as: ${this.adminAddress}
                </p>
            </div>
            
            <nav class="admin-nav">
                <button class="nav-tab active" data-view="overview">📊 Overview</button>
                <button class="nav-tab" data-view="servers">👮 Process Servers</button>
                <button class="nav-tab" data-view="cases">📋 Cases</button>
                <button class="nav-tab" data-view="documents">📄 Documents</button>
                <button class="nav-tab" data-view="audit">📝 Audit Logs</button>
                <button class="nav-tab" data-view="search">🔍 Search</button>
                <button class="nav-tab" style="margin-left: auto; color: #ef4444;" id="closeAdmin">❌ Close</button>
            </nav>
            
            <div class="admin-content" id="adminContent">
                <!-- Content will be loaded here -->
            </div>
        `;
        
        document.body.appendChild(dashboard);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Navigation tabs
        document.querySelectorAll('.nav-tab[data-view]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });
        
        // Close button
        document.getElementById('closeAdmin').addEventListener('click', () => {
            this.close();
        });
    }

    /**
     * Switch between views
     */
    async switchView(view) {
        this.currentView = view;
        
        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`.nav-tab[data-view="${view}"]`).classList.add('active');
        
        // Load view content
        const content = document.getElementById('adminContent');
        content.innerHTML = '<div style="text-align: center; padding: 50px;">Loading...</div>';
        
        switch(view) {
            case 'overview':
                await this.loadOverview();
                break;
            case 'servers':
                await this.loadProcessServers();
                break;
            case 'cases':
                await this.loadCases();
                break;
            case 'documents':
                await this.loadDocuments();
                break;
            case 'audit':
                await this.loadAuditLogs();
                break;
            case 'search':
                this.loadSearchView();
                break;
        }
    }

    /**
     * Load overview statistics
     */
    async loadOverview() {
        try {
            const response = await fetch(`${this.backend}/api/admin/overview`, {
                headers: {
                    'X-Admin-Address': this.adminAddress
                }
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error);
            }
            
            const content = document.getElementById('adminContent');
            content.innerHTML = `
                <h2 style="margin-bottom: 30px;">System Overview</h2>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Process Servers</div>
                        <div class="stat-value">${data.overview.processServers.total}</div>
                        <div class="stat-change positive">
                            ${data.overview.processServers.active} active
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-label">Total Cases</div>
                        <div class="stat-value">${data.overview.cases.total}</div>
                        <div class="stat-change">
                            ${data.overview.cases.unique_servers} servers
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-label">Signed Documents</div>
                        <div class="stat-value">${data.overview.serviceStatus.signed}</div>
                        <div class="stat-change">
                            ${data.overview.serviceStatus.unsigned} unsigned
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-label">Last 24 Hours</div>
                        <div class="stat-value">${data.overview.recentActivity.last_24h}</div>
                        <div class="stat-change positive">Recent activity</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-label">Documents</div>
                        <div class="stat-value">${data.overview.documents.total_documents}</div>
                        <div class="stat-change">
                            ${Math.round(data.overview.documents.avg_pages || 0)} avg pages
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-label">IPFS Storage</div>
                        <div class="stat-value">${data.overview.documents.on_ipfs}</div>
                        <div class="stat-change info">Distributed storage</div>
                    </div>
                </div>
                
                <div id="recentActivity" style="margin-top: 30px;">
                    <!-- Recent activity will be loaded here -->
                </div>
            `;
            
            // Load recent activity
            await this.loadRecentActivity();
            
        } catch (error) {
            console.error('Error loading overview:', error);
            document.getElementById('adminContent').innerHTML = `
                <div style="color: red; padding: 20px;">
                    Error loading overview: ${error.message}
                </div>
            `;
        }
    }

    /**
     * Load process servers list
     */
    async loadProcessServers() {
        try {
            const response = await fetch(`${this.backend}/api/admin/process-servers`, {
                headers: {
                    'X-Admin-Address': this.adminAddress
                }
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error);
            }
            
            const content = document.getElementById('adminContent');
            content.innerHTML = `
                <h2 style="margin-bottom: 30px;">Process Servers (${data.servers.length})</h2>
                
                <div class="data-table">
                    <div class="table-header">
                        <h3 style="margin: 0;">Registered Servers</h3>
                        <input type="text" class="search-box" placeholder="Search servers..." id="serverSearch">
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Agency</th>
                                <th>Wallet</th>
                                <th>Cases</th>
                                <th>Signed</th>
                                <th>Status</th>
                                <th>Last Active</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.servers.map(server => `
                                <tr>
                                    <td><strong>${server.full_name || 'Unknown'}</strong></td>
                                    <td>${server.agency || 'N/A'}</td>
                                    <td>
                                        <code style="font-size: 12px;">
                                            ${this.truncateAddress(server.wallet_address)}
                                        </code>
                                    </td>
                                    <td>${server.total_cases || 0}</td>
                                    <td>
                                        <span class="badge ${server.signed_cases > 0 ? 'success' : 'warning'}">
                                            ${server.signed_cases || 0}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge ${server.is_active ? 'success' : 'error'}">
                                            ${server.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>${server.last_activity ? new Date(server.last_activity).toLocaleDateString() : 'Never'}</td>
                                    <td>
                                        <button class="action-btn" onclick="adminDashboard.viewServerCases('${server.wallet_address}')">
                                            View Cases
                                        </button>
                                        <button class="action-btn" onclick="adminDashboard.toggleServer('${server.wallet_address}')">
                                            ${server.is_active ? 'Deactivate' : 'Activate'}
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            // Setup search
            document.getElementById('serverSearch').addEventListener('input', (e) => {
                this.filterTable(e.target.value);
            });
            
        } catch (error) {
            console.error('Error loading servers:', error);
            document.getElementById('adminContent').innerHTML = `
                <div style="color: red; padding: 20px;">
                    Error loading servers: ${error.message}
                </div>
            `;
        }
    }

    /**
     * View cases for a specific server
     */
    async viewServerCases(serverAddress) {
        try {
            const response = await fetch(
                `${this.backend}/api/admin/process-servers/${serverAddress}/cases`,
                {
                    headers: {
                        'X-Admin-Address': this.adminAddress
                    }
                }
            );
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error);
            }
            
            // Create modal with cases
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 1200px; width: 90%;">
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
                    <div style="padding: 30px;">
                        <h2>Cases for ${data.server?.full_name || 'Process Server'}</h2>
                        <p style="color: #6b7280; margin-bottom: 20px;">
                            ${data.server?.agency || ''} | ${serverAddress}
                        </p>
                        
                        <table style="width: 100%;">
                            <thead>
                                <tr>
                                    <th>Notice ID</th>
                                    <th>Case Number</th>
                                    <th>Recipient</th>
                                    <th>Served Date</th>
                                    <th>Status</th>
                                    <th>TX Hash</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.cases.map(c => `
                                    <tr>
                                        <td>${c.notice_id}</td>
                                        <td><strong>${c.case_number}</strong></td>
                                        <td><code>${this.truncateAddress(c.recipient_address)}</code></td>
                                        <td>${new Date(c.served_at).toLocaleString()}</td>
                                        <td>
                                            <span class="badge ${c.is_signed ? 'success' : 'warning'}">
                                                ${c.is_signed ? 'Signed' : 'Unsigned'}
                                            </span>
                                        </td>
                                        <td>
                                            ${c.tx_hash ? `<code style="font-size: 11px;">${this.truncateAddress(c.tx_hash)}</code>` : 'N/A'}
                                        </td>
                                        <td>
                                            <button class="action-btn" onclick="adminDashboard.viewCaseDetails('${c.notice_id}')">
                                                Details
                                            </button>
                                            ${c.has_alert_image ? `
                                                <button class="action-btn" onclick="adminDashboard.viewDocument('${c.notice_id}', 'alert')">
                                                    Alert
                                                </button>
                                            ` : ''}
                                            ${c.has_full_document ? `
                                                <button class="action-btn" onclick="adminDashboard.viewDocument('${c.notice_id}', 'document')">
                                                    Document
                                                </button>
                                            ` : ''}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
        } catch (error) {
            console.error('Error loading server cases:', error);
            alert('Error loading cases: ' + error.message);
        }
    }

    /**
     * View case details
     */
    async viewCaseDetails(noticeId) {
        try {
            const response = await fetch(
                `${this.backend}/api/admin/cases/${noticeId}`,
                {
                    headers: {
                        'X-Admin-Address': this.adminAddress
                    }
                }
            );
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error);
            }
            
            // Create modal with case details
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 900px; width: 90%;">
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
                    <div style="padding: 30px;">
                        <h2>Case Details: ${data.notice.case_number}</h2>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                            <div>
                                <h3>Notice Information</h3>
                                <p><strong>Notice ID:</strong> ${data.notice.notice_id}</p>
                                <p><strong>Type:</strong> ${data.notice.notice_type || 'Legal Document'}</p>
                                <p><strong>Status:</strong> 
                                    <span class="badge ${data.notice.is_signed ? 'success' : 'warning'}">
                                        ${data.notice.is_signed ? 'Signed' : 'Unsigned'}
                                    </span>
                                </p>
                                <p><strong>Served:</strong> ${new Date(data.notice.served_at).toLocaleString()}</p>
                            </div>
                            
                            <div>
                                <h3>Process Server</h3>
                                <p><strong>Name:</strong> ${data.notice.server_name || 'Unknown'}</p>
                                <p><strong>Agency:</strong> ${data.notice.server_agency || 'N/A'}</p>
                                <p><strong>Badge:</strong> ${data.notice.badge_number || 'N/A'}</p>
                                <p><strong>Wallet:</strong> <code>${this.truncateAddress(data.notice.server_address)}</code></p>
                            </div>
                        </div>
                        
                        <div style="margin: 20px 0;">
                            <h3>Blockchain Information</h3>
                            <p><strong>Transaction Hash:</strong> 
                                ${data.notice.tx_hash ? `<code>${data.notice.tx_hash}</code>` : 'Not available'}
                            </p>
                            <p><strong>Alert Token ID:</strong> ${data.notice.alert_token_id || 'N/A'}</p>
                            <p><strong>Document Token ID:</strong> ${data.notice.document_token_id || 'N/A'}</p>
                        </div>
                        
                        <div style="margin: 20px 0;">
                            <h3>Document Information</h3>
                            <p><strong>Has Alert Image:</strong> ${data.components?.has_alert_image ? 'Yes' : 'No'}</p>
                            <p><strong>Has Document:</strong> ${data.components?.has_full_document ? 'Yes' : 'No'}</p>
                            <p><strong>Page Count:</strong> ${data.components?.page_count || 'Unknown'}</p>
                            <p><strong>IPFS Hash:</strong> ${data.components?.ipfs_hash || 'Not stored'}</p>
                        </div>
                        
                        <div style="margin: 20px 0;">
                            <h3>View History (${data.views?.length || 0} views)</h3>
                            ${data.views && data.views.length > 0 ? `
                                <table style="width: 100%; margin-top: 10px;">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Type</th>
                                            <th>Wallet</th>
                                            <th>IP</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${data.views.slice(0, 5).map(v => `
                                            <tr>
                                                <td>${new Date(v.viewed_at).toLocaleString()}</td>
                                                <td>${v.view_type}</td>
                                                <td>${v.wallet_address ? this.truncateAddress(v.wallet_address) : 'Anonymous'}</td>
                                                <td>${v.ip_address || 'N/A'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            ` : '<p>No views recorded</p>'}
                        </div>
                        
                        <div style="margin-top: 30px; display: flex; gap: 10px;">
                            ${data.components?.has_alert_image ? `
                                <button class="action-btn" style="background: #3b82f6; color: white; padding: 10px 20px;" 
                                        onclick="adminDashboard.viewDocument('${noticeId}', 'alert')">
                                    View Alert Image
                                </button>
                            ` : ''}
                            ${data.components?.has_full_document ? `
                                <button class="action-btn" style="background: #3b82f6; color: white; padding: 10px 20px;"
                                        onclick="adminDashboard.viewDocument('${noticeId}', 'document')">
                                    View Document
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
        } catch (error) {
            console.error('Error loading case details:', error);
            alert('Error loading case details: ' + error.message);
        }
    }

    /**
     * View document or alert image
     */
    async viewDocument(noticeId, type) {
        try {
            const endpoint = type === 'alert' 
                ? `${this.backend}/api/admin/documents/${noticeId}/alert`
                : `${this.backend}/api/admin/documents/${noticeId}/document`;
            
            const response = await fetch(endpoint, {
                headers: {
                    'X-Admin-Address': this.adminAddress
                }
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error);
            }
            
            // Create modal with document viewer
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content document-viewer">
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
                    <div style="padding: 20px;">
                        <h2>${type === 'alert' ? 'Alert Image' : 'Document'}</h2>
                        <p style="color: #6b7280;">
                            Notice ID: ${noticeId} | Case: ${data.caseNumber}
                            ${data.pageCount ? ` | Pages: ${data.pageCount}` : ''}
                        </p>
                        
                        <div style="margin: 20px 0; text-align: center; background: #f9fafb; padding: 20px; border-radius: 8px;">
                            ${data.mimeType && data.mimeType.includes('pdf') ? `
                                <iframe src="data:${data.mimeType};base64,${data.document}" 
                                        style="width: 100%; height: 600px; border: none;">
                                </iframe>
                            ` : `
                                <img src="${data.alertImage || data.document}" 
                                     style="max-width: 100%; max-height: 600px; object-fit: contain;">
                            `}
                        </div>
                        
                        <div style="margin-top: 20px; display: flex; gap: 10px;">
                            <button class="action-btn" style="background: #3b82f6; color: white; padding: 10px 20px;"
                                    onclick="adminDashboard.downloadDocument('${data.alertImage || data.document}', '${data.caseNumber}_${type}')">
                                Download
                            </button>
                            ${data.ipfsHash ? `
                                <button class="action-btn" style="background: #8b5cf6; color: white; padding: 10px 20px;"
                                        onclick="window.open('https://gateway.pinata.cloud/ipfs/${data.ipfsHash}', '_blank')">
                                    View on IPFS
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
        } catch (error) {
            console.error('Error loading document:', error);
            alert('Error loading document: ' + error.message);
        }
    }

    /**
     * Download document
     */
    downloadDocument(dataUrl, filename) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename + '.png';
        link.click();
    }

    /**
     * Toggle server active status
     */
    async toggleServer(address) {
        if (!confirm('Are you sure you want to toggle this server\'s status?')) {
            return;
        }
        
        try {
            const response = await fetch(
                `${this.backend}/api/admin/process-servers/${address}/toggle`,
                {
                    method: 'POST',
                    headers: {
                        'X-Admin-Address': this.adminAddress,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            const data = await response.json();
            
            if (data.success) {
                alert(data.message);
                await this.loadProcessServers(); // Reload the list
            } else {
                throw new Error(data.error);
            }
            
        } catch (error) {
            console.error('Error toggling server:', error);
            alert('Error: ' + error.message);
        }
    }

    /**
     * Load recent activity
     */
    async loadRecentActivity() {
        try {
            const response = await fetch(
                `${this.backend}/api/admin/audit-logs?limit=10`,
                {
                    headers: {
                        'X-Admin-Address': this.adminAddress
                    }
                }
            );
            
            const data = await response.json();
            
            if (!data.success) {
                return;
            }
            
            const activityDiv = document.getElementById('recentActivity');
            if (!activityDiv) return;
            
            activityDiv.innerHTML = `
                <div class="data-table">
                    <div class="table-header">
                        <h3 style="margin: 0;">Recent Activity</h3>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Status</th>
                                <th>Case</th>
                                <th>Sender</th>
                                <th>Recipient</th>
                                <th>Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.logs.map(log => `
                                <tr>
                                    <td>${new Date(log.created_at).toLocaleString()}</td>
                                    <td>
                                        <span class="badge ${
                                            log.status === 'success' ? 'success' : 
                                            log.status === 'failed' ? 'error' : 
                                            'warning'
                                        }">
                                            ${log.status}
                                        </span>
                                    </td>
                                    <td>${log.case_number || 'N/A'}</td>
                                    <td><code>${this.truncateAddress(log.sender_address)}</code></td>
                                    <td><code>${this.truncateAddress(log.recipient_address)}</code></td>
                                    <td>${log.notice_type || 'N/A'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
        } catch (error) {
            console.error('Error loading recent activity:', error);
        }
    }

    /**
     * Load search view
     */
    loadSearchView() {
        const content = document.getElementById('adminContent');
        content.innerHTML = `
            <h2 style="margin-bottom: 30px;">Search System</h2>
            
            <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <input type="text" id="searchQuery" class="search-box" style="flex: 1;" 
                           placeholder="Search by case number, wallet address, transaction hash...">
                    <select id="searchType" style="padding: 8px; border: 1px solid #d1d5db; border-radius: 8px;">
                        <option value="all">All</option>
                        <option value="cases">Cases</option>
                        <option value="servers">Servers</option>
                        <option value="recipients">Recipients</option>
                    </select>
                    <button class="action-btn" style="background: #3b82f6; color: white; padding: 8px 20px;"
                            onclick="adminDashboard.performSearch()">
                        Search
                    </button>
                </div>
                
                <div id="searchResults">
                    <!-- Results will appear here -->
                </div>
            </div>
        `;
        
        // Allow enter key to search
        document.getElementById('searchQuery').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
    }

    /**
     * Perform search
     */
    async performSearch() {
        const query = document.getElementById('searchQuery').value;
        const type = document.getElementById('searchType').value;
        
        if (!query) {
            alert('Please enter a search query');
            return;
        }
        
        try {
            const response = await fetch(
                `${this.backend}/api/admin/search?q=${encodeURIComponent(query)}&type=${type}`,
                {
                    headers: {
                        'X-Admin-Address': this.adminAddress
                    }
                }
            );
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error);
            }
            
            const resultsDiv = document.getElementById('searchResults');
            
            let html = '<h3>Search Results</h3>';
            
            // Cases results
            if (data.results.cases && data.results.cases.length > 0) {
                html += `
                    <h4>Cases (${data.results.cases.length})</h4>
                    <table style="width: 100%; margin-bottom: 20px;">
                        <thead>
                            <tr>
                                <th>Notice ID</th>
                                <th>Case Number</th>
                                <th>Recipient</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.results.cases.map(c => `
                                <tr>
                                    <td>${c.notice_id}</td>
                                    <td>${c.case_number}</td>
                                    <td><code>${this.truncateAddress(c.recipient_address)}</code></td>
                                    <td>
                                        <span class="badge ${c.is_signed ? 'success' : 'warning'}">
                                            ${c.is_signed ? 'Signed' : 'Unsigned'}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="action-btn" onclick="adminDashboard.viewCaseDetails('${c.notice_id}')">
                                            View
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
            
            // Servers results
            if (data.results.servers && data.results.servers.length > 0) {
                html += `
                    <h4>Process Servers (${data.results.servers.length})</h4>
                    <table style="width: 100%; margin-bottom: 20px;">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Agency</th>
                                <th>Wallet</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.results.servers.map(s => `
                                <tr>
                                    <td>${s.full_name}</td>
                                    <td>${s.agency}</td>
                                    <td><code>${this.truncateAddress(s.wallet_address)}</code></td>
                                    <td>
                                        <button class="action-btn" onclick="adminDashboard.viewServerCases('${s.wallet_address}')">
                                            View Cases
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
            
            if (!data.results.cases?.length && !data.results.servers?.length && !data.results.recipients?.length) {
                html = '<p>No results found</p>';
            }
            
            resultsDiv.innerHTML = html;
            
        } catch (error) {
            console.error('Error searching:', error);
            alert('Search error: ' + error.message);
        }
    }

    /**
     * Helper function to truncate addresses
     */
    truncateAddress(address) {
        if (!address) return 'N/A';
        return `${address.substring(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Filter table rows
     */
    filterTable(searchTerm) {
        const rows = document.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
        });
    }

    /**
     * Show access denied message
     */
    showAccessDenied() {
        alert('Admin access required. Please connect with an admin wallet.');
    }

    /**
     * Close dashboard
     */
    close() {
        const dashboard = document.getElementById('adminDashboard');
        if (dashboard) {
            dashboard.remove();
        }
    }
}

// Initialize globally
window.adminDashboard = new AdminDashboard();

// Initialize when admin tab is opened
window.initDatabaseManagement = function() {
    // Show/hide the content area
    const contentArea = document.getElementById('databaseManagementContent');
    const button = event.target;
    
    if (contentArea.style.display === 'none' || !contentArea.style.display) {
        contentArea.style.display = 'block';
        button.innerHTML = '<i class="fas fa-times"></i> Close Database Manager';
        
        // Initialize the dashboard
        if (!window.adminDashboard) {
            window.adminDashboard = new AdminDashboard();
        }
        window.adminDashboard.initInTabSection();
    } else {
        contentArea.style.display = 'none';
        button.innerHTML = '<i class="fas fa-chart-line"></i> Open Database Manager';
    }
};

console.log('👨‍💼 Admin Dashboard loaded - available in Admin Panel');