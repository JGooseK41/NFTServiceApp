// Admin Module - Handles contract administration functions
window.admin = {
    isAdmin: false,
    isLite: false,

    // Initialize module
    async init() {
        console.log('Initializing admin module...');
        this.isLite = window.contract && window.contract.isLiteContract();
    },
    
    // Load admin settings and check role
    async loadSettings() {
        try {
            // Check if user has admin role
            if (window.contract && window.contract.instance) {
                this.isAdmin = await window.contract.checkAdminRole();
                
                if (this.isAdmin) {
                    console.log('Admin access granted');
                    await this.displayAdminPanel();
                    await this.loadCurrentSettings();
                } else {
                    this.displayNoAccessMessage();
                }
            } else {
                this.displayNotConnectedMessage();
            }
        } catch (error) {
            console.error('Failed to load admin settings:', error);
        }
    },
    
    // Display admin panel
    async displayAdminPanel() {
        this.isLite = window.contract && window.contract.isLiteContract();
        const contractType = this.isLite ? 'Lite' : 'V5';

        // Fee management section - simplified for Lite
        const feeManagementHtml = this.isLite ? `
            <div class="mb-3">
                <label class="form-label">Service Fee (TRX)</label>
                <div class="input-group">
                    <input type="number" id="creationFee" class="form-control" step="0.1" min="0">
                    <button class="btn btn-primary" onclick="admin.updateCreationFee()">Update</button>
                </div>
                <small class="text-muted">Current: <span id="currentCreationFee">Loading...</span> TRX</small>
            </div>

            <div class="mb-3">
                <label class="form-label">Fee Collector Address</label>
                <div class="input-group">
                    <input type="text" id="feeCollector" class="form-control" placeholder="T...">
                    <button class="btn btn-primary" onclick="admin.updateFeeCollector()">Update</button>
                </div>
                <small class="text-muted">Current: <span id="currentFeeCollector">Loading...</span></small>
            </div>

            <div class="mb-3">
                <label class="form-label">Fee Exempt Address</label>
                <div class="input-group">
                    <input type="text" id="feeExemptAddress" class="form-control" placeholder="T...">
                    <button class="btn btn-success" onclick="admin.setFeeExempt(true)">Exempt</button>
                    <button class="btn btn-warning" onclick="admin.setFeeExempt(false)">Remove</button>
                </div>
            </div>
        ` : `
            <div class="mb-3">
                <label class="form-label">Creation Fee (TRX)</label>
                <div class="input-group">
                    <input type="number" id="creationFee" class="form-control" step="0.1" min="0">
                    <button class="btn btn-primary" onclick="admin.updateCreationFee()">Update</button>
                </div>
                <small class="text-muted">Current: <span id="currentCreationFee">Loading...</span> TRX</small>
            </div>

            <div class="mb-3">
                <label class="form-label">Sponsorship Fee (TRX)</label>
                <div class="input-group">
                    <input type="number" id="sponsorshipFee" class="form-control" step="0.1" min="0">
                    <button class="btn btn-primary" onclick="admin.updateSponsorshipFee()">Update</button>
                </div>
                <small class="text-muted">Current: <span id="currentSponsorshipFee">Loading...</span> TRX</small>
            </div>

            <div class="mb-3">
                <label class="form-label">Fee Collector Address</label>
                <div class="input-group">
                    <input type="text" id="feeCollector" class="form-control" placeholder="T...">
                    <button class="btn btn-primary" onclick="admin.updateFeeCollector()">Update</button>
                </div>
                <small class="text-muted">Current: <span id="currentFeeCollector">Loading...</span></small>
            </div>
        `;

        // Role management section - simplified for Lite
        const roleManagementHtml = this.isLite ? `
            <div class="mb-3">
                <label class="form-label">Authorize Process Server</label>
                <div class="input-group">
                    <input type="text" id="serverAddress" class="form-control" placeholder="T...">
                    <button class="btn btn-success" onclick="admin.grantServerRole()">Authorize</button>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label">Revoke Process Server</label>
                <div class="input-group">
                    <input type="text" id="revokeServerAddress" class="form-control" placeholder="T...">
                    <button class="btn btn-danger" onclick="admin.revokeServerRoleLite()">Revoke</button>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label">Manage Admin</label>
                <div class="input-group">
                    <input type="text" id="adminAddress" class="form-control" placeholder="T...">
                    <button class="btn btn-success" onclick="admin.grantAdminRole()">Grant Admin</button>
                    <button class="btn btn-danger" onclick="admin.revokeAdminRole()">Revoke</button>
                </div>
            </div>

            <hr>
            <h6>Authorized Servers</h6>
            <div id="serverList" class="small">Loading...</div>
        ` : `
            <div class="mb-3">
                <label class="form-label">Grant Process Server Role</label>
                <div class="input-group">
                    <input type="text" id="serverAddress" class="form-control" placeholder="T...">
                    <button class="btn btn-success" onclick="admin.grantServerRole()">Grant</button>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label">Grant Law Enforcement Role</label>
                <div class="input-group">
                    <input type="text" id="lawAddress" class="form-control" placeholder="T...">
                    <button class="btn btn-success" onclick="admin.grantLawRole()">Grant</button>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label">Revoke Role</label>
                <div class="input-group">
                    <select id="roleToRevoke" class="form-select">
                        <option value="">Select role...</option>
                        <option value="PROCESS_SERVER">Process Server</option>
                        <option value="LAW_ENFORCEMENT">Law Enforcement</option>
                    </select>
                    <input type="text" id="revokeAddress" class="form-control" placeholder="T...">
                    <button class="btn btn-danger" onclick="admin.revokeRole()">Revoke</button>
                </div>
            </div>
        `;

        const adminContent = `
            <div class="alert alert-info mb-3">
                <strong>Contract Type:</strong> ${contractType}
                <span class="ms-3"><strong>Address:</strong> ${window.contract.address}</span>
                <span class="ms-3"><strong>Network:</strong> ${window.AppConfig.network.current}</span>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header">
                            <h5>Fee Management</h5>
                        </div>
                        <div class="card-body">
                            ${feeManagementHtml}
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header">
                            <h5>Server & Role Management</h5>
                        </div>
                        <div class="card-body">
                            ${roleManagementHtml}
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5>Contract Statistics</h5>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-3">
                                    <div class="text-center">
                                        <h3 id="totalSupply">0</h3>
                                        <p class="text-muted">Total Notices Served</p>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="text-center">
                                        <h3 id="totalFees">0</h3>
                                        <p class="text-muted">Est. Fees Collected (TRX)</p>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="text-center">
                                        <h3 id="activeServers">0</h3>
                                        <p class="text-muted">Authorized Servers</p>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="text-center">
                                        <h3 id="contractBalance">0</h3>
                                        <p class="text-muted">Contract Balance (TRX)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('adminPage').querySelector('.card-body').innerHTML = adminContent;

        // Load server list for Lite contract
        if (this.isLite) {
            this.loadServerList();
        }
    },

    // Load and display server list (Lite contract)
    async loadServerList() {
        try {
            const servers = await window.contract.getServers();
            const serverListEl = document.getElementById('serverList');
            if (servers && servers.length > 0) {
                // Convert hex addresses to base58 if needed
                const formattedServers = servers.map(s => {
                    if (s.startsWith('41') && s.length === 42) {
                        // Hex format - convert to base58
                        return window.wallet.tronWeb.address.fromHex(s);
                    } else if (s.startsWith('0x')) {
                        // 0x hex format
                        return window.wallet.tronWeb.address.fromHex('41' + s.slice(2));
                    }
                    return s; // Already base58
                });

                serverListEl.innerHTML = formattedServers.map(s =>
                    `<div class="d-flex justify-content-between align-items-center mb-1">
                        <code>${s}</code>
                        <button class="btn btn-sm btn-outline-danger" onclick="admin.revokeServerDirect('${s}')">Revoke</button>
                    </div>`
                ).join('');
            } else {
                serverListEl.innerHTML = '<em>No servers authorized yet</em>';
            }
        } catch (error) {
            console.error('Failed to load server list:', error);
            document.getElementById('serverList').innerHTML = '<em>Error loading servers</em>';
        }
    },

    // Revoke server directly from list
    async revokeServerDirect(address) {
        if (!confirm(`Revoke server authorization for ${address}?`)) return;

        try {
            window.app.showProcessing('Revoking server...');
            const result = await window.contract.revokeServerRole(address);
            if (result.success) {
                window.app.hideProcessing();
                window.app.showSuccess('Server revoked');
                await this.loadServerList();
                await this.loadStatistics();
            }
        } catch (error) {
            window.app.hideProcessing();
            window.app.showError('Failed: ' + error.message);
        }
    },
    
    // Load current contract settings
    async loadCurrentSettings() {
        try {
            // Get current fees
            const fees = await window.contract.getCurrentFees();
            document.getElementById('currentCreationFee').textContent = fees.creation;
            document.getElementById('creationFee').value = fees.creation;

            // Sponsorship fee only for V5
            const sponsorshipEl = document.getElementById('currentSponsorshipFee');
            const sponsorshipInput = document.getElementById('sponsorshipFee');
            if (sponsorshipEl) {
                sponsorshipEl.textContent = fees.sponsorship;
            }
            if (sponsorshipInput) {
                sponsorshipInput.value = fees.sponsorship;
            }

            // Get fee collector
            if (window.contract.instance.feeCollector) {
                const collector = await window.contract.instance.feeCollector().call();
                document.getElementById('currentFeeCollector').textContent = this.formatAddress(collector);
            }

            // Get statistics
            await this.loadStatistics();

        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    },

    // Load contract statistics
    async loadStatistics() {
        try {
            // Total notices/supply
            let supply;
            if (this.isLite) {
                supply = await window.contract.instance.totalNotices().call();
            } else {
                supply = await window.contract.getTotalSupply();
            }
            document.getElementById('totalSupply').textContent = supply.toString();

            // Calculate total fees
            const fees = await window.contract.getCurrentFees();
            const totalFees = (parseInt(supply) * parseFloat(fees.creation)).toFixed(2);
            document.getElementById('totalFees').textContent = totalFees;

            // Get contract balance
            const balance = await window.wallet.tronWeb.trx.getBalance(window.contract.address);
            document.getElementById('contractBalance').textContent = (balance / 1e6).toFixed(2);

            // Active servers
            if (this.isLite) {
                try {
                    const servers = await window.contract.getServers();
                    document.getElementById('activeServers').textContent = servers.length;
                } catch (e) {
                    document.getElementById('activeServers').textContent = '?';
                }
            } else {
                try {
                    const response = await fetch(getApiUrl('getServerInfo'));
                    if (response.ok) {
                        const data = await response.json();
                        document.getElementById('activeServers').textContent = data.count || 0;
                    }
                } catch (error) {
                    console.error('Failed to get server count:', error);
                }
            }

        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    },
    
    // Update creation fee
    async updateCreationFee() {
        try {
            const newFee = document.getElementById('creationFee').value;
            if (!newFee || newFee < 0) {
                throw new Error('Invalid fee amount');
            }
            
            if (!confirm(`Update creation fee to ${newFee} TRX?`)) {
                return;
            }
            
            window.app.showProcessing('Updating creation fee...');
            
            const result = await window.contract.updateServiceFee(newFee);
            
            if (result.success) {
                window.app.hideProcessing();
                window.app.showSuccess('Creation fee updated successfully');
                await this.loadCurrentSettings();
            }
            
        } catch (error) {
            console.error('Failed to update creation fee:', error);
            window.app.hideProcessing();
            window.app.showError('Failed to update fee: ' + error.message);
        }
    },
    
    // Update sponsorship fee
    async updateSponsorshipFee() {
        try {
            const newFee = document.getElementById('sponsorshipFee').value;
            if (!newFee || newFee < 0) {
                throw new Error('Invalid fee amount');
            }
            
            if (!confirm(`Update sponsorship fee to ${newFee} TRX?`)) {
                return;
            }
            
            window.app.showProcessing('Updating sponsorship fee...');
            
            const result = await window.contract.updateSponsorshipFee(newFee);
            
            if (result.success) {
                window.app.hideProcessing();
                window.app.showSuccess('Sponsorship fee updated successfully');
                await this.loadCurrentSettings();
            }
            
        } catch (error) {
            console.error('Failed to update sponsorship fee:', error);
            window.app.hideProcessing();
            window.app.showError('Failed to update fee: ' + error.message);
        }
    },
    
    // Update fee collector
    async updateFeeCollector() {
        try {
            const address = document.getElementById('feeCollector').value;
            if (!window.wallet.isValidAddress(address)) {
                throw new Error('Invalid address');
            }
            
            if (!confirm(`Update fee collector to ${address}?`)) {
                return;
            }
            
            window.app.showProcessing('Updating fee collector...');
            
            const result = await window.contract.updateFeeCollector(address);
            
            if (result.success) {
                window.app.hideProcessing();
                window.app.showSuccess('Fee collector updated successfully');
                await this.loadCurrentSettings();
            }
            
        } catch (error) {
            console.error('Failed to update fee collector:', error);
            window.app.hideProcessing();
            window.app.showError('Failed to update: ' + error.message);
        }
    },
    
    // Grant process server role
    async grantServerRole() {
        try {
            const address = document.getElementById('serverAddress').value;
            if (!window.wallet.isValidAddress(address)) {
                throw new Error('Invalid address');
            }

            if (!confirm(`Authorize ${address} as a Process Server?`)) {
                return;
            }

            window.app.showProcessing('Authorizing server...');

            const result = await window.contract.grantServerRole(address);

            if (result.success) {
                window.app.hideProcessing();
                window.app.showSuccess('Server authorized successfully');
                document.getElementById('serverAddress').value = '';

                // Refresh server list for Lite
                if (this.isLite) {
                    await this.loadServerList();
                    await this.loadStatistics();
                }
            }

        } catch (error) {
            console.error('Failed to grant server role:', error);
            window.app.hideProcessing();
            window.app.showError('Failed: ' + error.message);
        }
    },

    // Revoke server role (Lite contract)
    async revokeServerRoleLite() {
        try {
            const address = document.getElementById('revokeServerAddress').value;
            if (!window.wallet.isValidAddress(address)) {
                throw new Error('Invalid address');
            }

            if (!confirm(`Revoke server authorization from ${address}?`)) {
                return;
            }

            window.app.showProcessing('Revoking server...');

            const result = await window.contract.revokeServerRole(address);

            if (result.success) {
                window.app.hideProcessing();
                window.app.showSuccess('Server revoked successfully');
                document.getElementById('revokeServerAddress').value = '';
                await this.loadServerList();
                await this.loadStatistics();
            }

        } catch (error) {
            console.error('Failed to revoke server:', error);
            window.app.hideProcessing();
            window.app.showError('Failed: ' + error.message);
        }
    },

    // Grant admin role (Lite contract)
    async grantAdminRole() {
        try {
            const address = document.getElementById('adminAddress').value;
            if (!window.wallet.isValidAddress(address)) {
                throw new Error('Invalid address');
            }

            if (!confirm(`Grant ADMIN role to ${address}? This gives full control over the contract.`)) {
                return;
            }

            window.app.showProcessing('Granting admin...');

            const result = await window.contract.grantAdminRole(address);

            if (result.success) {
                window.app.hideProcessing();
                window.app.showSuccess('Admin role granted');
                document.getElementById('adminAddress').value = '';
            }

        } catch (error) {
            console.error('Failed to grant admin:', error);
            window.app.hideProcessing();
            window.app.showError('Failed: ' + error.message);
        }
    },

    // Revoke admin role (Lite contract)
    async revokeAdminRole() {
        try {
            const address = document.getElementById('adminAddress').value;
            if (!window.wallet.isValidAddress(address)) {
                throw new Error('Invalid address');
            }

            if (!confirm(`Revoke ADMIN role from ${address}? Make sure you have another admin.`)) {
                return;
            }

            window.app.showProcessing('Revoking admin...');

            const result = await window.contract.revokeAdminRole(address);

            if (result.success) {
                window.app.hideProcessing();
                window.app.showSuccess('Admin role revoked');
                document.getElementById('adminAddress').value = '';
            }

        } catch (error) {
            console.error('Failed to revoke admin:', error);
            window.app.hideProcessing();
            window.app.showError('Failed: ' + error.message);
        }
    },

    // Set fee exempt (Lite contract)
    async setFeeExempt(exempt) {
        try {
            const address = document.getElementById('feeExemptAddress').value;
            if (!window.wallet.isValidAddress(address)) {
                throw new Error('Invalid address');
            }

            const action = exempt ? 'exempt from fees' : 'remove fee exemption for';
            if (!confirm(`${action} ${address}?`)) {
                return;
            }

            window.app.showProcessing(exempt ? 'Setting exempt...' : 'Removing exemption...');

            const result = await window.contract.setFeeExempt(address, exempt);

            if (result.success) {
                window.app.hideProcessing();
                window.app.showSuccess(exempt ? 'Address exempted from fees' : 'Fee exemption removed');
                document.getElementById('feeExemptAddress').value = '';
            }

        } catch (error) {
            console.error('Failed to set fee exempt:', error);
            window.app.hideProcessing();
            window.app.showError('Failed: ' + error.message);
        }
    },

    // Grant law enforcement role (V5 only)
    async grantLawRole() {
        try {
            if (this.isLite) {
                throw new Error('Law enforcement role not available on Lite contract');
            }

            const address = document.getElementById('lawAddress').value;
            if (!window.wallet.isValidAddress(address)) {
                throw new Error('Invalid address');
            }

            if (!confirm(`Grant Law Enforcement role to ${address}?`)) {
                return;
            }

            window.app.showProcessing('Granting role...');

            const role = getConfig('contract.roles.LAW_ENFORCEMENT_ROLE');
            const result = await window.contract.grantRole(role, address);

            if (result.success) {
                window.app.hideProcessing();
                window.app.showSuccess('Role granted successfully');
                document.getElementById('lawAddress').value = '';
            }

        } catch (error) {
            console.error('Failed to grant role:', error);
            window.app.hideProcessing();
            window.app.showError('Failed: ' + error.message);
        }
    },

    // Revoke role (V5 only)
    async revokeRole() {
        try {
            if (this.isLite) {
                throw new Error('Use revokeServerRoleLite for Lite contract');
            }

            const roleType = document.getElementById('roleToRevoke').value;
            const address = document.getElementById('revokeAddress').value;

            if (!roleType) {
                throw new Error('Please select a role');
            }

            if (!window.wallet.isValidAddress(address)) {
                throw new Error('Invalid address');
            }

            if (!confirm(`Revoke ${roleType} role from ${address}?`)) {
                return;
            }

            window.app.showProcessing('Revoking role...');

            const roles = getConfig('contract.roles');
            const role = roleType === 'PROCESS_SERVER'
                ? roles.PROCESS_SERVER_ROLE
                : roles.LAW_ENFORCEMENT_ROLE;

            const result = await window.contract.revokeRole(role, address);

            if (result.success) {
                window.app.hideProcessing();
                window.app.showSuccess('Role revoked successfully');
                document.getElementById('roleToRevoke').value = '';
                document.getElementById('revokeAddress').value = '';
            }

        } catch (error) {
            console.error('Failed to revoke role:', error);
            window.app.hideProcessing();
            window.app.showError('Failed: ' + error.message);
        }
    },
    
    // Display no access message
    displayNoAccessMessage() {
        const adminPage = document.getElementById('adminPage');
        if (adminPage) {
            adminPage.querySelector('.card-body').innerHTML = `
                <div class="alert alert-warning">
                    <h5>Admin Access Required</h5>
                    <p>You do not have admin privileges for this contract.</p>
                    <p>Only the contract owner can access these functions.</p>
                </div>
            `;
        }
    },
    
    // Display not connected message
    displayNotConnectedMessage() {
        const adminPage = document.getElementById('adminPage');
        if (adminPage) {
            adminPage.querySelector('.card-body').innerHTML = `
                <div class="alert alert-info">
                    <h5>Wallet Not Connected</h5>
                    <p>Please connect your wallet to access admin functions.</p>
                    <button class="btn btn-primary" onclick="app.connectWallet()">Connect Wallet</button>
                </div>
            `;
        }
    },
    
    // Format address for display
    formatAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
};

console.log('Admin module loaded');