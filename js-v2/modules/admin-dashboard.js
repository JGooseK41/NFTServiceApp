/**
 * Admin Dashboard Module
 * Integrated backend data viewer for the admin section
 */

window.adminDashboard = {
    baseUrl: null,
    
    // Initialize the dashboard
    init() {
        this.baseUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
        console.log('Admin dashboard initialized with backend:', this.baseUrl);
    },
    
    // Load all data from backend
    async loadAllData() {
        this.updateStatus('loading', 'Loading data from backend...');
        
        try {
            // Load all data in parallel
            const [cases, serviceRecords, images, auditLogs, noticeViews, summary] = await Promise.all([
                this.fetchData('/api/data-export/cases'),
                this.fetchData('/api/data-export/service-records'),
                this.fetchData('/api/data-export/images'),
                this.fetchData('/api/data-export/audit-logs'),
                this.fetchData('/api/data-export/notice-views'),
                this.fetchData('/api/data-export/summary')
            ]);
            
            // Populate all tables
            this.populateCasesTable(cases);
            this.populateServiceTable(serviceRecords);
            this.populateImagesTable(images);
            this.populateAuditTable(auditLogs);
            this.populateViewsTable(noticeViews);
            this.populateSummary(summary);
            
            this.updateStatus('success', `Data loaded successfully at ${new Date().toLocaleTimeString()}`);
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.updateStatus('error', 'Failed to load data: ' + error.message);
        }
    },
    
    // Fetch data from backend
    async fetchData(endpoint) {
        const response = await fetch(this.baseUrl + endpoint);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${endpoint}: ${response.status}`);
        }
        return response.json();
    },
    
    // Update connection status
    updateStatus(type, message) {
        const statusEl = document.getElementById('dashboardStatus');
        const textEl = document.getElementById('dashboardStatusText');
        
        if (!statusEl || !textEl) return;
        
        switch(type) {
            case 'loading':
                statusEl.className = 'alert alert-warning';
                textEl.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>' + message;
                break;
            case 'success':
                statusEl.className = 'alert alert-success';
                textEl.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>' + message;
                break;
            case 'error':
                statusEl.className = 'alert alert-danger';
                textEl.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-2"></i>' + message;
                break;
            default:
                statusEl.className = 'alert alert-info';
                textEl.textContent = message;
        }
    },
    
    // Populate cases table
    populateCasesTable(data) {
        const tbody = document.getElementById('dashCasesTableBody');
        const count = document.getElementById('casesCount');
        
        if (!tbody) return;
        
        count.textContent = data.length;
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No cases found</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(row => {
            const metadata = typeof row.metadata === 'string' ? 
                JSON.parse(row.metadata) : row.metadata;
            
            return `
                <tr>
                    <td><strong>${row.case_number}</strong></td>
                    <td>
                        <span class="badge bg-${this.getStatusColor(row.status)}">
                            ${row.status || 'Unknown'}
                        </span>
                    </td>
                    <td>
                        <small class="text-muted">
                            ${row.server_address ? row.server_address.substring(0, 10) + '...' : 'Not set'}
                        </small>
                    </td>
                    <td>${new Date(row.created_at).toLocaleDateString()}</td>
                    <td>
                        ${metadata ? `
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick='adminDashboard.showJSON(${JSON.stringify(metadata)})'>
                                <i class="bi bi-eye"></i>
                            </button>
                        ` : '-'}
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    // Populate service records table
    populateServiceTable(data) {
        const tbody = document.getElementById('dashServiceTableBody');
        const count = document.getElementById('serviceCount');
        
        if (!tbody) return;
        
        count.textContent = data.length;
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No service records found</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(row => {
            const recipients = typeof row.recipients === 'string' ? 
                JSON.parse(row.recipients) : row.recipients;
            
            return `
                <tr>
                    <td><strong>${row.case_number}</strong></td>
                    <td>
                        ${row.transaction_hash ? `
                            <a href="https://tronscan.org/#/transaction/${row.transaction_hash}" 
                               target="_blank" class="text-decoration-none">
                                <small>${row.transaction_hash.substring(0, 8)}...</small>
                                <i class="bi bi-box-arrow-up-right"></i>
                            </a>
                        ` : '-'}
                    </td>
                    <td>${row.alert_token_id ? `#${row.alert_token_id}` : '-'}</td>
                    <td>${row.document_token_id ? `#${row.document_token_id}` : '-'}</td>
                    <td>
                        ${row.ipfs_hash ? `
                            <small title="${row.ipfs_hash}">
                                ${row.ipfs_hash.substring(0, 8)}...
                            </small>
                        ` : '-'}
                    </td>
                    <td>
                        ${recipients?.length || 0}
                        ${recipients?.length ? `
                            <button class="btn btn-sm btn-link p-0" 
                                    onclick='adminDashboard.showRecipients(${JSON.stringify(recipients)})'>
                                view
                            </button>
                        ` : ''}
                    </td>
                    <td>
                        ${row.served_at ? 
                            new Date(row.served_at).toLocaleDateString() : '-'}
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    // Populate images table
    populateImagesTable(data) {
        const tbody = document.getElementById('dashImagesTableBody');
        const count = document.getElementById('imagesCount');
        
        if (!tbody) return;
        
        count.textContent = data.length;
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No images found</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(row => `
            <tr>
                <td><strong>${row.case_number}</strong></td>
                <td>
                    ${row.alert_image ? `
                        <img src="${row.alert_image}" 
                             style="max-width: 50px; max-height: 50px; cursor: pointer;"
                             onclick="adminDashboard.showImage('${row.alert_image}')"
                             class="border rounded" />
                    ` : '-'}
                </td>
                <td>
                    ${row.document_preview ? 
                        '<span class="badge bg-success">Available</span>' : 
                        '<span class="badge bg-secondary">None</span>'}
                </td>
                <td>${new Date(row.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');
    },
    
    // Populate audit logs table
    populateAuditTable(data) {
        const tbody = document.getElementById('dashAuditTableBody');
        const count = document.getElementById('auditCount');
        
        if (!tbody) return;
        
        count.textContent = data.length;
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No audit logs found</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(row => `
            <tr>
                <td><small>${new Date(row.created_at).toLocaleString()}</small></td>
                <td>
                    <span class="badge bg-${this.getActionColor(row.action_type)}">
                        ${this.formatAction(row.action_type)}
                    </span>
                </td>
                <td>
                    <small class="text-muted">
                        ${row.actor_address?.substring(0, 8)}...
                    </small>
                </td>
                <td>${row.target_id || '-'}</td>
                <td><small>${row.ip_address || '-'}</small></td>
            </tr>
        `).join('');
    },
    
    // Populate notice views table
    populateViewsTable(data) {
        const tbody = document.getElementById('dashViewsTableBody');
        const count = document.getElementById('viewsCount');
        
        if (!tbody) return;
        
        count.textContent = data.length;
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No views recorded</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(row => `
            <tr>
                <td>#${row.alert_id}</td>
                <td>
                    <small class="text-muted">
                        ${row.wallet_address?.substring(0, 10)}...
                    </small>
                </td>
                <td>
                    ${row.viewed_at ? 
                        new Date(row.viewed_at).toLocaleDateString() : '-'}
                </td>
                <td>
                    ${row.signed_at ? 
                        `<span class="badge bg-success">
                            ${new Date(row.signed_at).toLocaleDateString()}
                        </span>` : 
                        '<span class="badge bg-warning">Not Signed</span>'}
                </td>
                <td><small>${row.ip_address || '-'}</small></td>
            </tr>
        `).join('');
    },
    
    // Populate summary cards
    populateSummary(data) {
        const container = document.getElementById('dashSummaryCards');
        if (!container) return;
        
        container.innerHTML = `
            <div class="col-md-4 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">Total Cases</h5>
                        <h2 class="text-primary">${data.total_cases || 0}</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">Served Cases</h5>
                        <h2 class="text-success">${data.served_cases || 0}</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">Service Records</h5>
                        <h2 class="text-info">${data.service_records || 0}</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">Audit Events</h5>
                        <h2 class="text-warning">${data.audit_events || 0}</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">Recipients Tracked</h5>
                        <h2 style="color: #764ba2;">${data.unique_recipients || 0}</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">Documents Signed</h5>
                        <h2 class="text-dark">${data.documents_signed || 0}</h2>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Helper functions
    getStatusColor(status) {
        switch(status?.toLowerCase()) {
            case 'served': return 'success';
            case 'active': return 'primary';
            case 'pending': return 'warning';
            default: return 'secondary';
        }
    },
    
    getActionColor(action) {
        if (action?.includes('view')) return 'info';
        if (action?.includes('sign')) return 'success';
        if (action?.includes('query')) return 'primary';
        return 'secondary';
    },
    
    formatAction(action) {
        return action?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || action;
    },
    
    showJSON(data) {
        const formatted = JSON.stringify(data, null, 2);
        
        // Create a modal to show the JSON
        const modal = `
            <div class="modal fade" id="jsonModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Data Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <pre class="bg-light p-3 rounded" style="max-height: 400px; overflow-y: auto;">
${formatted}
                            </pre>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing modal
        const existing = document.getElementById('jsonModal');
        if (existing) existing.remove();
        
        // Add and show the modal
        document.body.insertAdjacentHTML('beforeend', modal);
        const modalEl = new bootstrap.Modal(document.getElementById('jsonModal'));
        modalEl.show();
        
        // Clean up on close
        document.getElementById('jsonModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },
    
    showRecipients(recipients) {
        const modal = `
            <div class="modal fade" id="recipientsModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Recipients (${recipients.length})</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="list-group">
                                ${recipients.map((r, i) => `
                                    <div class="list-group-item">
                                        <small>${i + 1}. <code>${r}</code></small>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing modal
        const existing = document.getElementById('recipientsModal');
        if (existing) existing.remove();
        
        // Add and show the modal
        document.body.insertAdjacentHTML('beforeend', modal);
        const modalEl = new bootstrap.Modal(document.getElementById('recipientsModal'));
        modalEl.show();
        
        // Clean up on close
        document.getElementById('recipientsModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },
    
    showImage(src) {
        const modal = `
            <div class="modal fade" id="imageModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Alert NFT Image</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center">
                            <img src="${src}" class="img-fluid border rounded" />
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing modal
        const existing = document.getElementById('imageModal');
        if (existing) existing.remove();
        
        // Add and show the modal
        document.body.insertAdjacentHTML('beforeend', modal);
        const modalEl = new bootstrap.Modal(document.getElementById('imageModal'));
        modalEl.show();
        
        // Clean up on close
        document.getElementById('imageModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    adminDashboard.init();
});