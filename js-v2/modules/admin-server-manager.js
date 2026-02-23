/**
 * Admin Server Manager
 * Manages process servers and their cases for admin oversight
 */

window.adminServerManager = {
    baseUrl: null,
    adminAddress: null,

    init() {
        this.baseUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
        console.log('Admin Server Manager initialized');
    },

    // Get current admin address (resolved at call time, not init time)
    getAdminAddress() {
        return window.wallet?.address || window.tronWeb?.defaultAddress?.base58 || this.adminAddress || '';
    },

    // Load all process servers
    async loadProcessServers() {
        const content = document.getElementById('processServersContent');
        if (!content) return;

        content.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-2">Loading process servers...</p>
            </div>
        `;

        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/api/admin/process-servers`, {
                headers: {
                    'X-Admin-Address': this.getAdminAddress()
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to load servers');
            }

            this.servers = data.servers || [];
            this.renderServerList(this.servers);

        } catch (error) {
            console.error('Error loading process servers:', error);
            content.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    Error loading servers: ${error.message}
                </div>
                <button class="btn btn-primary" onclick="adminServerManager.loadProcessServers()">
                    <i class="bi bi-arrow-clockwise"></i> Retry
                </button>
            `;
        }
    },

    // Render the server list
    renderServerList(servers) {
        const content = document.getElementById('processServersContent');

        if (servers.length === 0) {
            content.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> No process servers registered yet.
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="mb-3">
                <input type="text" class="form-control" id="serverSearchInput"
                       placeholder="Search by name, agency, or wallet..."
                       onkeyup="adminServerManager.filterServers()">
            </div>

            <div class="table-responsive">
                <table class="table table-hover" id="serversTable">
                    <thead class="table-dark">
                        <tr>
                            <th>Server</th>
                            <th>Agency</th>
                            <th>Wallet</th>
                            <th class="text-center">Total Cases</th>
                            <th class="text-center">Signed</th>
                            <th class="text-center">Status</th>
                            <th>Last Active</th>
                            <th class="text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${servers.map(server => this.renderServerRow(server)).join('')}
                    </tbody>
                </table>
            </div>

            <div class="text-muted mt-2">
                <small>Total: ${servers.length} registered process server(s)</small>
            </div>
        `;
    },

    // Render a single server row
    renderServerRow(server) {
        let statusBadge;
        if (server.is_active) {
            statusBadge = '<span class="badge bg-success">Active</span>';
        } else if (server.status === 'pending') {
            statusBadge = '<span class="badge bg-warning text-dark">Pending</span>';
        } else if (server.status === 'approved') {
            statusBadge = '<span class="badge bg-info">Registered</span>';
        } else if (server.status === 'suspended') {
            statusBadge = '<span class="badge bg-danger">Suspended</span>';
        } else {
            statusBadge = `<span class="badge bg-secondary">${server.status || 'Unknown'}</span>`;
        }

        const lastActive = server.last_activity
            ? new Date(server.last_activity).toLocaleDateString()
            : 'Never';

        // Show authorize icon for servers not yet active
        const actionIcon = server.is_active ? 'pause' : 'shield-check';
        const actionLabel = server.is_active ? '' : ' Authorize';

        return `
            <tr data-wallet="${server.wallet_address}" data-name="${(server.full_name || '').toLowerCase()}" data-agency="${(server.agency || '').toLowerCase()}">
                <td>
                    <a href="#" onclick="adminServerManager.viewServerDetails('${server.wallet_address}'); return false;" class="text-decoration-none">
                        <strong>${server.full_name || 'Unknown'}</strong>
                    </a>
                    ${server.license_number ? `<br><small class="text-muted">License: ${server.license_number}</small>` : ''}
                </td>
                <td>${server.agency || 'N/A'}</td>
                <td>
                    <code class="small">${this.truncateAddress(server.wallet_address)}</code>
                    <button class="btn btn-sm btn-link p-0 ms-1" onclick="navigator.clipboard.writeText('${server.wallet_address}')" title="Copy">
                        <i class="bi bi-clipboard"></i>
                    </button>
                </td>
                <td class="text-center">
                    <span class="badge bg-primary">${server.total_cases || 0}</span>
                </td>
                <td class="text-center">
                    <span class="badge ${server.signed_cases > 0 ? 'bg-success' : 'bg-secondary'}">${server.signed_cases || 0}</span>
                </td>
                <td class="text-center">${statusBadge}</td>
                <td>${lastActive}</td>
                <td class="text-center">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="adminServerManager.viewServerCases('${server.wallet_address}', '${(server.full_name || '').replace(/'/g, "\\'")}')">
                            <i class="bi bi-folder2-open"></i> Cases
                        </button>
                        ${server.is_active ? `
                            <button class="btn btn-outline-secondary" onclick="adminServerManager.viewServerDetails('${server.wallet_address}')" title="Manage">
                                <i class="bi bi-gear"></i>
                            </button>
                        ` : `
                            <button class="btn btn-outline-success" onclick="adminServerManager.authorizeOnBlockchain('${server.wallet_address}')" title="Authorize on Blockchain">
                                <i class="bi bi-shield-check"></i>
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    },

    // View server details in a modal
    viewServerDetails(walletAddress) {
        const server = (this.servers || []).find(s => s.wallet_address === walletAddress);
        if (!server) {
            alert('Server not found');
            return;
        }

        const modalId = 'serverDetailsModal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        let statusBadge;
        if (server.is_active) {
            statusBadge = '<span class="badge bg-success">Active</span>';
        } else if (server.status === 'pending') {
            statusBadge = '<span class="badge bg-warning text-dark">Pending</span>';
        } else if (server.status === 'approved') {
            statusBadge = '<span class="badge bg-info">Registered</span>';
        } else if (server.status === 'suspended') {
            statusBadge = '<span class="badge bg-danger">Suspended</span>';
        } else {
            statusBadge = `<span class="badge bg-secondary">${server.status || 'Unknown'}</span>`;
        }

        const registeredDate = server.created_at
            ? new Date(server.created_at).toLocaleDateString()
            : 'N/A';

        const lastActive = server.last_activity
            ? new Date(server.last_activity).toLocaleDateString()
            : 'Never';

        // Determine action button states
        const needsAuthorization = server.status === 'pending' || server.status === 'approved';
        const isActive = server.is_active;

        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-person-badge"></i> ${server.full_name || 'Unknown'} ${statusBadge}
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="serverDetailsForm">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Agency Name</label>
                                    <input type="text" class="form-control" id="sd_agency_name" value="${this.escapeHtml(server.agency || '')}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Contact Email</label>
                                    <input type="email" class="form-control" id="sd_contact_email" value="${this.escapeHtml(server.email || '')}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Phone Number</label>
                                    <input type="tel" class="form-control" id="sd_phone_number" value="${this.escapeHtml(server.phone || '')}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Website</label>
                                    <input type="url" class="form-control" id="sd_website" value="${this.escapeHtml(server.website || '')}" placeholder="https://">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">License Number</label>
                                    <input type="text" class="form-control" id="sd_license_number" value="${this.escapeHtml(server.license_number || '')}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Jurisdictions</label>
                                    <input type="text" class="form-control" id="sd_jurisdictions" value="${this.escapeHtml(server.jurisdictions || '')}">
                                </div>
                            </div>
                        </form>

                        <hr>

                        <div class="row">
                            <div class="col-md-6">
                                <h6><i class="bi bi-wallet2"></i> Wallet Address</h6>
                                <div class="d-flex align-items-center">
                                    <code class="small me-2">${server.wallet_address}</code>
                                    <button class="btn btn-sm btn-outline-secondary" onclick="navigator.clipboard.writeText('${server.wallet_address}')" title="Copy">
                                        <i class="bi bi-clipboard"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <h6><i class="bi bi-calendar"></i> Registered</h6>
                                <p class="mb-0">${registeredDate}</p>
                            </div>
                        </div>

                        <div class="row mt-3">
                            <div class="col-md-4">
                                <div class="card text-center">
                                    <div class="card-body py-2">
                                        <h4 class="mb-0">${server.total_cases || 0}</h4>
                                        <small class="text-muted">Total Cases</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card text-center">
                                    <div class="card-body py-2">
                                        <h4 class="mb-0">${server.signed_cases || 0}</h4>
                                        <small class="text-muted">Signed</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card text-center">
                                    <div class="card-body py-2">
                                        <h6 class="mb-0">${lastActive}</h6>
                                        <small class="text-muted">Last Active</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer d-flex justify-content-between">
                        <div>
                            <button class="btn btn-danger" onclick="adminServerManager.deleteServer('${server.wallet_address}')">
                                <i class="bi bi-trash"></i> Delete
                            </button>
                            ${needsAuthorization ? `
                                <button class="btn btn-success ms-2" onclick="adminServerManager.authorizeOnBlockchain('${server.wallet_address}')">
                                    <i class="bi bi-shield-check"></i> Authorize on Blockchain
                                </button>
                            ` : ''}
                            ${isActive ? `
                                <button class="btn btn-danger ms-2" onclick="adminServerManager.revokeOnBlockchain('${server.wallet_address}')">
                                    <i class="bi bi-shield-x"></i> Revoke Access
                                </button>
                                <button class="btn btn-warning ms-2" onclick="adminServerManager.setServerStatus('${server.wallet_address}', 'suspended')">
                                    <i class="bi bi-pause-circle"></i> Suspend
                                </button>
                            ` : ''}
                            ${!isActive && !needsAuthorization ? `
                                <button class="btn btn-success ms-2" onclick="adminServerManager.authorizeOnBlockchain('${server.wallet_address}')">
                                    <i class="bi bi-shield-check"></i> Re-Authorize on Blockchain
                                </button>
                            ` : ''}
                        </div>
                        <div>
                            <button class="btn btn-primary" onclick="adminServerManager.saveServerDetails('${server.wallet_address}')">
                                <i class="bi bi-save"></i> Save Changes
                            </button>
                            <button type="button" class="btn btn-secondary ms-2" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        new bootstrap.Modal(modal).show();
    },

    // Save edited server details
    async saveServerDetails(walletAddress) {
        const data = {
            wallet_address: walletAddress,
            agency_name: document.getElementById('sd_agency_name')?.value || null,
            contact_email: document.getElementById('sd_contact_email')?.value || null,
            phone_number: document.getElementById('sd_phone_number')?.value || null,
            website: document.getElementById('sd_website')?.value || null,
            license_number: document.getElementById('sd_license_number')?.value || null,
            jurisdictions: document.getElementById('sd_jurisdictions')?.value || null
        };

        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/api/admin/process-servers/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Address': this.getAdminAddress()
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Update failed');

            // Close modal and reload
            const modal = document.getElementById('serverDetailsModal');
            if (modal) bootstrap.Modal.getInstance(modal)?.hide();
            await this.loadProcessServers();

        } catch (error) {
            console.error('Error saving server details:', error);
            alert('Error saving: ' + error.message);
        }
    },

    // Delete a server
    async deleteServer(walletAddress) {
        if (!confirm('Are you sure you want to permanently delete this process server? This cannot be undone.')) {
            return;
        }

        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/api/admin/process-servers/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Address': this.getAdminAddress()
                },
                body: JSON.stringify({ wallet_address: walletAddress })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Delete failed');

            // Close modal and reload
            const modal = document.getElementById('serverDetailsModal');
            if (modal) bootstrap.Modal.getInstance(modal)?.hide();
            await this.loadProcessServers();

        } catch (error) {
            console.error('Error deleting server:', error);
            alert('Error deleting: ' + error.message);
        }
    },

    // Set server status (active, suspended, etc.)
    async setServerStatus(walletAddress, newStatus) {
        const label = newStatus === 'active' ? 'approve/activate' : newStatus;
        if (!confirm(`Are you sure you want to ${label} this process server?`)) {
            return;
        }

        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/api/admin/process-servers/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Address': this.getAdminAddress()
                },
                body: JSON.stringify({
                    wallet_address: walletAddress,
                    status: newStatus
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Status update failed');

            // Close modal and reload
            const modal = document.getElementById('serverDetailsModal');
            if (modal) bootstrap.Modal.getInstance(modal)?.hide();
            await this.loadProcessServers();

        } catch (error) {
            console.error('Error updating server status:', error);
            alert('Error updating status: ' + error.message);
        }
    },

    // Authorize a process server on the blockchain (calls setServer)
    async authorizeOnBlockchain(walletAddress) {
        if (!confirm('This will submit a blockchain transaction to authorize this process server. Continue?')) {
            return;
        }

        if (!window.contract || !window.contract.instance) {
            alert('Contract not initialized. Please connect your admin wallet first.');
            return;
        }

        // Validate address is proper Base58Check (TRON addresses are case-sensitive)
        const tronWeb = window.contract.tronWeb || window.tronWeb;
        if (!tronWeb || !tronWeb.isAddress(walletAddress)) {
            alert('Invalid TRON address: "' + walletAddress + '". The address may have been stored in lowercase. Ask the server to reconnect their wallet to fix the stored address, then try again.');
            return;
        }

        try {
            // Step 1: Call setServer(address, true) on-chain
            console.log('Authorizing server on blockchain:', walletAddress);
            await window.contract.grantRole('PROCESS_SERVER', walletAddress);
            console.log('Blockchain authorization successful');

            // Step 2: Update backend status to blockchain_approved
            try {
                const adminKey = prompt('Enter admin API key to send approval notification:');
                if (adminKey) {
                    await fetchWithTimeout(`${this.baseUrl}/api/server/approve`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            wallet_address: walletAddress,
                            admin_key: adminKey
                        })
                    });
                    console.log('Backend status updated and notification sent');
                } else {
                    // Still update the status via the admin update endpoint
                    await fetchWithTimeout(`${this.baseUrl}/api/admin/process-servers/update`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Admin-Address': this.getAdminAddress()
                        },
                        body: JSON.stringify({
                            wallet_address: walletAddress,
                            status: 'blockchain_approved'
                        })
                    });
                    console.log('Backend status updated (no notification)');
                }
            } catch (backendErr) {
                console.error('Backend update failed (blockchain auth succeeded):', backendErr);
            }

            alert('Server authorized on blockchain successfully!');

            // Close modal and reload
            const modal = document.getElementById('serverDetailsModal');
            if (modal) bootstrap.Modal.getInstance(modal)?.hide();
            await this.loadProcessServers();

        } catch (error) {
            console.error('Error authorizing server on blockchain:', error);
            alert('Blockchain authorization failed: ' + (error.message || error));
        }
    },

    // Revoke a process server's blockchain access (calls setServer(address, false))
    async revokeOnBlockchain(walletAddress) {
        if (!confirm('This will revoke this server\'s blockchain access. They will no longer be able to mint NFTs. Continue?')) {
            return;
        }

        if (!window.contract || !window.contract.instance) {
            alert('Contract not initialized. Please connect your admin wallet first.');
            return;
        }

        const tronWeb = window.contract.tronWeb || window.tronWeb;
        if (!tronWeb || !tronWeb.isAddress(walletAddress)) {
            alert('Invalid TRON address: "' + walletAddress + '". The address may have been stored in lowercase.');
            return;
        }

        try {
            // Step 1: Call setServer(address, false) on-chain
            console.log('Revoking server on blockchain:', walletAddress);
            await window.contract.revokeRole('PROCESS_SERVER', walletAddress);
            console.log('Blockchain revocation successful');

            // Step 2: Update backend status to suspended
            try {
                await fetchWithTimeout(`${this.baseUrl}/api/admin/process-servers/update`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Admin-Address': this.getAdminAddress()
                    },
                    body: JSON.stringify({
                        wallet_address: walletAddress,
                        status: 'suspended'
                    })
                });
                console.log('Backend status updated to suspended');
            } catch (backendErr) {
                console.error('Backend update failed (blockchain revoke succeeded):', backendErr);
            }

            alert('Server access revoked successfully.');

            // Close modal and reload
            const modal = document.getElementById('serverDetailsModal');
            if (modal) bootstrap.Modal.getInstance(modal)?.hide();
            await this.loadProcessServers();

        } catch (error) {
            console.error('Error revoking server on blockchain:', error);
            alert('Blockchain revocation failed: ' + (error.message || error));
        }
    },

    // Helper: Escape HTML to prevent XSS in form values
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },

    // Filter servers based on search input
    filterServers() {
        const search = document.getElementById('serverSearchInput')?.value.toLowerCase() || '';
        const rows = document.querySelectorAll('#serversTable tbody tr');

        rows.forEach(row => {
            const wallet = row.dataset.wallet?.toLowerCase() || '';
            const name = row.dataset.name || '';
            const agency = row.dataset.agency || '';

            const matches = wallet.includes(search) || name.includes(search) || agency.includes(search);
            row.style.display = matches ? '' : 'none';
        });
    },

    // View cases for a specific server
    async viewServerCases(walletAddress, serverName) {
        // Create modal
        const modalId = 'serverCasesModal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-folder2-open"></i> Cases for ${serverName || 'Process Server'}
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="serverCasesContent">
                        <div class="text-center py-4">
                            <div class="spinner-border text-primary" role="status"></div>
                            <p class="mt-2">Loading cases...</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <small class="text-muted me-auto">Wallet: ${walletAddress}</small>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        // Load cases
        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/api/admin/process-servers/${walletAddress}/cases`, {
                headers: {
                    'X-Admin-Address': this.getAdminAddress()
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.renderServerCases(data.cases || [], data.server);

        } catch (error) {
            console.error('Error loading cases:', error);
            document.getElementById('serverCasesContent').innerHTML = `
                <div class="alert alert-danger">
                    Error loading cases: ${error.message}
                </div>
            `;
        }
    },

    // Render cases for a server
    renderServerCases(cases, server) {
        this._lastCases = cases; // Cache for detail view
        const content = document.getElementById('serverCasesContent');

        if (cases.length === 0) {
            content.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> No cases found for this server.
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="mb-3">
                <input type="text" class="form-control" id="caseSearchInput"
                       placeholder="Search cases..." onkeyup="adminServerManager.filterCases()">
            </div>

            <div class="table-responsive">
                <table class="table table-hover table-sm" id="casesTable">
                    <thead class="table-light">
                        <tr>
                            <th>Case Number</th>
                            <th>Recipients</th>
                            <th>Pages</th>
                            <th>Served</th>
                            <th>Status</th>
                            <th>TX Hash</th>
                            <th class="text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cases.map(c => this.renderCaseRow(c)).join('')}
                    </tbody>
                </table>
            </div>

            <div class="text-muted">
                <small>Total: ${cases.length} case(s)</small>
            </div>
        `;
    },

    // Render a single case row
    renderCaseRow(c) {
        const statusBadge = c.accepted
            ? '<span class="badge bg-success">Signed</span>'
            : c.status === 'served'
                ? '<span class="badge bg-info">Served</span>'
                : '<span class="badge bg-warning">Pending</span>';

        const servedDate = c.served_at
            ? new Date(c.served_at).toLocaleString()
            : 'N/A';

        // Recipients is a JSON array of addresses
        const recipients = Array.isArray(c.recipients) ? c.recipients : [];
        const recipientDisplay = recipients.length > 0
            ? recipients.map(r => `<code class="small">${this.truncateAddress(r)}</code>`).join('<br>')
            : '<span class="text-muted small">N/A</span>';

        const txHash = c.tx_hash || c.transaction_hash;

        return `
            <tr data-case="${(c.case_number || '').toLowerCase()}">
                <td>
                    <strong>${c.case_number || 'N/A'}</strong>
                    <br><small class="text-muted">${c.issuing_agency || ''}</small>
                </td>
                <td>
                    ${recipientDisplay}
                    <br><small class="text-muted">${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}</small>
                </td>
                <td class="text-center">${c.page_count || '-'}</td>
                <td><small>${servedDate}</small></td>
                <td>${statusBadge}</td>
                <td>
                    ${txHash ? `
                        <a href="${this.getExplorerUrl(txHash)}" target="_blank" class="small">
                            ${this.truncateAddress(txHash)}
                            <i class="bi bi-box-arrow-up-right"></i>
                        </a>
                    ` : '<span class="text-muted small">N/A</span>'}
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="adminServerManager.viewCaseDetail('${this.escapeHtml(c.case_number)}', '${c.id}')">
                        <i class="bi bi-eye"></i> Details
                    </button>
                </td>
            </tr>
        `;
    },

    // Filter cases based on search input
    filterCases() {
        const search = document.getElementById('caseSearchInput')?.value.toLowerCase() || '';
        const rows = document.querySelectorAll('#casesTable tbody tr');

        rows.forEach(row => {
            const caseNum = row.dataset.case || '';
            const text = row.textContent.toLowerCase();
            const matches = caseNum.includes(search) || text.includes(search);
            row.style.display = matches ? '' : 'none';
        });
    },

    // View full case detail from case_service_records data
    viewCaseDetail(caseNumber, caseId) {
        // Find the case in our cached data
        const cases = this._lastCases || [];
        const c = cases.find(x => String(x.id) === String(caseId) || x.case_number === caseNumber);
        if (!c) {
            alert('Case data not found. Try reloading.');
            return;
        }

        const modalId = 'caseDetailModal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        const recipients = Array.isArray(c.recipients) ? c.recipients : [];
        const noticeDetails = Array.isArray(c.notice_details) ? c.notice_details : [];
        const txHash = c.tx_hash || c.transaction_hash;

        // Build recipient rows with notice-level detail
        let recipientRows = '';
        if (noticeDetails.length > 0) {
            recipientRows = noticeDetails.map((nd, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td><code class="small">${nd.recipient_address || 'N/A'}</code>
                        <button class="btn btn-sm btn-link p-0 ms-1" onclick="navigator.clipboard.writeText('${nd.recipient_address || ''}')" title="Copy">
                            <i class="bi bi-clipboard"></i>
                        </button>
                    </td>
                    <td><code class="small">${nd.notice_id || 'N/A'}</code></td>
                    <td>${nd.alert_token_id || '-'}</td>
                    <td>${nd.accepted ? '<span class="badge bg-success">Signed</span>' : '<span class="badge bg-secondary">No</span>'}</td>
                </tr>
            `).join('');
        } else if (recipients.length > 0) {
            recipientRows = recipients.map((addr, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td><code class="small">${addr}</code>
                        <button class="btn btn-sm btn-link p-0 ms-1" onclick="navigator.clipboard.writeText('${addr}')" title="Copy">
                            <i class="bi bi-clipboard"></i>
                        </button>
                    </td>
                    <td><span class="text-muted">-</span></td>
                    <td>-</td>
                    <td>-</td>
                </tr>
            `).join('');
        }

        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-folder2-open"></i> Case: ${c.case_number}
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row g-3 mb-3">
                            <div class="col-md-6">
                                <h6>Case Information</h6>
                                <table class="table table-sm mb-0">
                                    <tr><th style="width:40%">Case Number:</th><td><strong>${c.case_number}</strong></td></tr>
                                    <tr><th>Agency:</th><td>${c.issuing_agency || 'N/A'}</td></tr>
                                    <tr><th>Server Name:</th><td>${c.server_name || 'N/A'}</td></tr>
                                    <tr><th>Status:</th><td>${c.accepted ? '<span class="badge bg-success">Signed</span>' : c.status === 'served' ? '<span class="badge bg-info">Served</span>' : c.status || 'N/A'}</td></tr>
                                    <tr><th>Served At:</th><td>${c.served_at ? new Date(c.served_at).toLocaleString() : 'N/A'}</td></tr>
                                    <tr><th>Pages:</th><td>${c.page_count || 'N/A'}</td></tr>
                                </table>
                            </div>
                            <div class="col-md-6">
                                <h6>Blockchain Data</h6>
                                <table class="table table-sm mb-0">
                                    <tr><th style="width:40%">TX Hash:</th><td>${txHash ? `<a href="${this.getExplorerUrl(txHash)}" target="_blank" class="small">${this.truncateAddress(txHash)} <i class="bi bi-box-arrow-up-right"></i></a>` : 'N/A'}</td></tr>
                                    <tr><th>Alert Token:</th><td>${c.alert_token_id || 'N/A'}</td></tr>
                                    <tr><th>Doc Token:</th><td>${c.document_token_id || 'N/A'}</td></tr>
                                    <tr><th>IPFS Hash:</th><td>${c.ipfs_hash ? `<code class="small">${this.truncateAddress(c.ipfs_hash)}</code>` : 'N/A'}</td></tr>
                                    <tr><th>Server Wallet:</th><td><code class="small">${this.truncateAddress(c.server_address)}</code></td></tr>
                                    <tr><th>Encryption:</th><td>${c.encryption_key ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-secondary">No</span>'}</td></tr>
                                </table>
                            </div>
                        </div>

                        <h6><i class="bi bi-people"></i> Recipients (${recipients.length})</h6>
                        <div class="table-responsive">
                            <table class="table table-sm table-bordered">
                                <thead class="table-light">
                                    <tr>
                                        <th>#</th>
                                        <th>Recipient Address</th>
                                        <th>Notice ID</th>
                                        <th>Token ID</th>
                                        <th>Signed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${recipientRows || '<tr><td colspan="5" class="text-muted text-center">No recipient data</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        ${txHash ? `
                            <a href="${this.getExplorerUrl(txHash)}" target="_blank" class="btn btn-outline-primary me-auto">
                                <i class="bi bi-box-arrow-up-right"></i> View on Explorer
                            </a>
                        ` : ''}
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        new bootstrap.Modal(modal).show();
    },

    // View case details (legacy - uses served_notices by notice_id)
    async viewCaseDetails(noticeId) {
        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/api/admin/cases/${noticeId}`, {
                headers: {
                    'X-Admin-Address': this.getAdminAddress()
                }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            this.showCaseDetailsModal(data.case);

        } catch (error) {
            console.error('Error loading case details:', error);
            alert('Error loading case details: ' + error.message);
        }
    },

    // Show case details modal
    showCaseDetailsModal(caseData) {
        const modalId = 'caseDetailsModal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Case Details: ${caseData.case_number || caseData.notice_id}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>Case Information</h6>
                                <table class="table table-sm">
                                    <tr><th>Notice ID:</th><td>${caseData.notice_id || 'N/A'}</td></tr>
                                    <tr><th>Case Number:</th><td>${caseData.case_number || 'N/A'}</td></tr>
                                    <tr><th>Notice Type:</th><td>${caseData.notice_type || 'N/A'}</td></tr>
                                    <tr><th>Agency:</th><td>${caseData.issuing_agency || 'N/A'}</td></tr>
                                    <tr><th>Status:</th><td>${caseData.status || 'N/A'}</td></tr>
                                    <tr><th>Served At:</th><td>${caseData.served_at ? new Date(caseData.served_at).toLocaleString() : 'N/A'}</td></tr>
                                </table>
                            </div>
                            <div class="col-md-6">
                                <h6>Blockchain Data</h6>
                                <table class="table table-sm">
                                    <tr><th>Server:</th><td><code class="small">${this.truncateAddress(caseData.server_address)}</code></td></tr>
                                    <tr><th>Recipient:</th><td><code class="small">${this.truncateAddress(caseData.recipient_address)}</code></td></tr>
                                    <tr><th>TX Hash:</th><td>
                                        ${caseData.tx_hash ? `<a href="${this.getExplorerUrl(caseData.tx_hash)}" target="_blank" class="small">${this.truncateAddress(caseData.tx_hash)}</a>` : 'N/A'}
                                    </td></tr>
                                    <tr><th>Token ID:</th><td>${caseData.alert_token_id || 'N/A'}</td></tr>
                                    <tr><th>IPFS Hash:</th><td><code class="small">${caseData.ipfs_hash || 'N/A'}</code></td></tr>
                                    <tr><th>Signed:</th><td>${caseData.is_signed ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-secondary">No</span>'}</td></tr>
                                </table>
                            </div>
                        </div>
                        ${caseData.views ? `
                            <h6 class="mt-3">View History (${caseData.views.length})</h6>
                            <div class="table-responsive" style="max-height: 150px; overflow-y: auto;">
                                <table class="table table-sm">
                                    <thead><tr><th>Viewer</th><th>IP</th><th>Time</th></tr></thead>
                                    <tbody>
                                        ${caseData.views.map(v => `
                                            <tr>
                                                <td><code class="small">${this.truncateAddress(v.viewer_address)}</code></td>
                                                <td>${v.ip_address || 'N/A'}</td>
                                                <td>${new Date(v.viewed_at).toLocaleString()}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        new bootstrap.Modal(modal).show();
    },

    // View document (alert or full document)
    async viewDocument(noticeId, type) {
        try {
            const endpoint = type === 'alert'
                ? `/api/admin/documents/${noticeId}/alert`
                : `/api/admin/documents/${noticeId}/document`;

            const response = await fetchWithTimeout(`${this.baseUrl}${endpoint}`, {
                headers: {
                    'X-Admin-Address': this.getAdminAddress()
                }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            if (data.image) {
                this.showImageModal(data.image, `${type === 'alert' ? 'Alert NFT' : 'Document'} - ${noticeId}`);
            } else {
                alert('No image available');
            }

        } catch (error) {
            console.error('Error loading document:', error);
            alert('Error loading document: ' + error.message);
        }
    },

    // Show image in modal
    showImageModal(imageSrc, title) {
        const modalId = 'imageViewModal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <img src="${imageSrc}" class="img-fluid" style="max-height: 70vh;">
                    </div>
                    <div class="modal-footer">
                        <a href="${imageSrc}" download class="btn btn-primary">
                            <i class="bi bi-download"></i> Download
                        </a>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        new bootstrap.Modal(modal).show();
    },

    // Toggle server active status
    async toggleServer(walletAddress, isCurrentlyActive) {
        if (!confirm(`Are you sure you want to ${isCurrentlyActive ? 'deactivate' : 'activate'} this server?`)) {
            return;
        }

        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/api/admin/process-servers/${walletAddress}/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Address': this.getAdminAddress()
                }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            // Reload the server list
            await this.loadProcessServers();

        } catch (error) {
            console.error('Error toggling server:', error);
            alert('Error toggling server: ' + error.message);
        }
    },

    // Helper: Truncate address for display
    truncateAddress(addr) {
        if (!addr) return 'N/A';
        if (addr.length <= 16) return addr;
        return addr.substring(0, 8) + '...' + addr.substring(addr.length - 6);
    },

    // Helper: Get explorer URL
    getExplorerUrl(txHash) {
        const network = window.getCurrentNetwork ? window.getCurrentNetwork() : null;
        if (network?.chain === 'tron-mainnet') {
            return `https://tronscan.org/#/transaction/${txHash}`;
        }
        return `https://nile.tronscan.org/#/transaction/${txHash}`;
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.adminServerManager) {
        window.adminServerManager.init();
    }
});

console.log('Admin Server Manager module loaded');
