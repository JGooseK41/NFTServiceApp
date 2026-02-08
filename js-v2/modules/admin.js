// Admin Module - Handles contract administration functions
window.admin = {
    isAdmin: false,
    
    // Initialize module
    async init() {
        console.log('Initializing admin module...');
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
        const adminContent = `
            <div class="row">
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header">
                            <h5>Fee Management</h5>
                        </div>
                        <div class="card-body">
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
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header">
                            <h5>Role Management</h5>
                        </div>
                        <div class="card-body">
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
                                        <p class="text-muted">Total NFTs Minted</p>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="text-center">
                                        <h3 id="totalFees">0</h3>
                                        <p class="text-muted">Total Fees (TRX)</p>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="text-center">
                                        <h3 id="activeServers">0</h3>
                                        <p class="text-muted">Active Servers</p>
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
    },
    
    // Load current contract settings
    async loadCurrentSettings() {
        try {
            // Get current fees
            const fees = await window.contract.getCurrentFees();
            const creationFeeEl = document.getElementById('currentCreationFee');
            const sponsorshipFeeEl = document.getElementById('currentSponsorshipFee');
            const creationInputEl = document.getElementById('creationFee');
            const sponsorshipInputEl = document.getElementById('sponsorshipFee');
            if (creationFeeEl) creationFeeEl.textContent = fees.creation;
            if (sponsorshipFeeEl) sponsorshipFeeEl.textContent = fees.sponsorship;
            if (creationInputEl) creationInputEl.value = fees.creation;
            if (sponsorshipInputEl) sponsorshipInputEl.value = fees.sponsorship;

            // Get fee collector
            if (window.contract.instance.feeCollector) {
                const collector = await window.contract.instance.feeCollector().call();
                const collectorEl = document.getElementById('currentFeeCollector');
                if (collectorEl) collectorEl.textContent = this.formatAddress(collector);
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
            // Total supply
            const supply = await window.contract.getTotalSupply();
            const supplyEl = document.getElementById('totalSupply');
            if (supplyEl) supplyEl.textContent = supply;

            // Calculate total fees (supply * average fee)
            const fees = await window.contract.getCurrentFees();
            const totalFees = (parseInt(supply) * parseFloat(fees.creation)).toFixed(2);
            const totalFeesEl = document.getElementById('totalFees');
            if (totalFeesEl) totalFeesEl.textContent = totalFees;

            // Get contract balance
            const balance = await window.wallet.tronWeb.trx.getBalance(window.contract.address);
            const balanceEl = document.getElementById('contractBalance');
            if (balanceEl) balanceEl.textContent = (balance / 1e6).toFixed(2);

            // Active servers (from backend)
            try {
                const response = await fetch(getApiUrl('getServerInfo'));
                if (response.ok) {
                    const data = await response.json();
                    const serversEl = document.getElementById('activeServers');
                    if (serversEl) serversEl.textContent = data.count || 0;
                }
            } catch (error) {
                console.error('Failed to get server count:', error);
            }
            
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    },
    
    // Update creation/service fee (platform revenue)
    async updateCreationFee() {
        try {
            // Check both possible input IDs
            const newFee = document.getElementById('creationFee')?.value ||
                           document.getElementById('newServiceFee')?.value;

            if (!newFee || newFee < 0) {
                throw new Error('Invalid fee amount');
            }

            if (!confirm(`Update service fee to ${newFee} TRX?`)) {
                return;
            }

            window.app.showProcessing('Updating service fee...');

            const result = await window.contract.updateServiceFee(newFee);

            if (result.success) {
                window.app.hideProcessing();
                window.app.showSuccess('Service fee updated successfully');
                await this.loadCurrentSettings();
                // Reload fee config in main app
                if (window.app.loadFeeConfig) {
                    await window.app.loadFeeConfig();
                }
            }

        } catch (error) {
            console.error('Failed to update service fee:', error);
            window.app.hideProcessing();
            window.app.showError('Failed to update fee: ' + error.message);
        }
    },

    // Update recipient funding (TRX sent to recipient for gas)
    async updateRecipientFunding() {
        try {
            // Check both possible input IDs
            const newAmount = document.getElementById('sponsorshipFee')?.value ||
                              document.getElementById('newRecipientFunding')?.value;

            if (!newAmount || newAmount < 0) {
                throw new Error('Invalid amount');
            }

            if (!confirm(`Update recipient sponsorship to ${newAmount} TRX?`)) {
                return;
            }

            window.app.showProcessing('Updating recipient sponsorship...');

            const result = await window.contract.updateRecipientFunding(newAmount);

            if (result.success) {
                window.app.hideProcessing();
                window.app.showSuccess('Recipient sponsorship updated successfully');
                await this.loadCurrentSettings();
                // Reload fee config in main app
                if (window.app.loadFeeConfig) {
                    await window.app.loadFeeConfig();
                }
            }

        } catch (error) {
            console.error('Failed to update recipient sponsorship:', error);
            window.app.hideProcessing();
            window.app.showError('Failed to update sponsorship: ' + error.message);
        }
    },

    // Legacy alias for updateRecipientFunding
    async updateSponsorshipFee() {
        return this.updateRecipientFunding();
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
            
            if (!confirm(`Grant Process Server role to ${address}?`)) {
                return;
            }
            
            window.app.showProcessing('Granting role...');
            
            const role = getConfig('contract.roles.PROCESS_SERVER_ROLE');
            const result = await window.contract.grantRole(role, address);
            
            if (result.success) {
                window.app.hideProcessing();
                window.app.showSuccess('Role granted successfully');
                document.getElementById('serverAddress').value = '';
            }
            
        } catch (error) {
            console.error('Failed to grant role:', error);
            window.app.hideProcessing();
            window.app.showError('Failed to grant role: ' + error.message);
        }
    },
    
    // Grant law enforcement role
    async grantLawRole() {
        try {
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
            window.app.showError('Failed to grant role: ' + error.message);
        }
    },
    
    // Revoke role
    async revokeRole() {
        try {
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
            window.app.showError('Failed to revoke role: ' + error.message);
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