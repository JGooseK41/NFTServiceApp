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
                            <h5>Access Management</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">Process Server</label>
                                <div class="input-group">
                                    <input type="text" id="serverAddress" class="form-control" placeholder="T...">
                                    <button class="btn btn-success btn-sm" onclick="admin.grantServerRole()">Grant</button>
                                    <button class="btn btn-outline-danger btn-sm" onclick="admin.revokeServerRole()">Revoke</button>
                                </div>
                                <small class="text-muted">Can serve legal notices</small>
                            </div>

                            <div class="mb-3">
                                <label class="form-label">Admin</label>
                                <div class="input-group">
                                    <input type="text" id="adminAddress" class="form-control" placeholder="T...">
                                    <button class="btn btn-success btn-sm" onclick="admin.grantAdminRole()">Grant</button>
                                    <button class="btn btn-outline-danger btn-sm" onclick="admin.revokeAdminRole()">Revoke</button>
                                </div>
                                <small class="text-muted">Can manage fees and roles</small>
                            </div>

                            <div class="mb-3">
                                <label class="form-label">Fee Exemption</label>
                                <div class="input-group">
                                    <input type="text" id="exemptAddress" class="form-control" placeholder="T...">
                                    <button class="btn btn-success btn-sm" onclick="admin.setFeeExempt(true)">Exempt</button>
                                    <button class="btn btn-outline-danger btn-sm" onclick="admin.setFeeExempt(false)">Remove</button>
                                </div>
                                <small class="text-muted">Exempt address from service fee (still pays recipient funding)</small>
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
            // Get fee config (v2 contract with service fee + recipient funding)
            const feeConfig = await window.contract.getFeeConfig();

            const creationFeeEl = document.getElementById('currentCreationFee');
            const sponsorshipFeeEl = document.getElementById('currentSponsorshipFee');
            const creationInputEl = document.getElementById('creationFee');
            const sponsorshipInputEl = document.getElementById('sponsorshipFee');

            if (creationFeeEl) creationFeeEl.textContent = feeConfig.serviceFeeInTRX;
            if (sponsorshipFeeEl) sponsorshipFeeEl.textContent = feeConfig.recipientFundingInTRX;
            if (creationInputEl) creationInputEl.value = feeConfig.serviceFeeInTRX;
            if (sponsorshipInputEl) sponsorshipInputEl.value = feeConfig.recipientFundingInTRX;

            // Get fee collector address
            if (window.contract.instance.feeCollector) {
                let collector = await window.contract.instance.feeCollector().call();
                // Convert hex to base58 if needed
                if (collector && collector.startsWith('41')) {
                    collector = window.tronWeb.address.fromHex(collector);
                }
                const collectorEl = document.getElementById('currentFeeCollector');
                if (collectorEl) collectorEl.textContent = this.formatAddress(collector);
                // Also set the input field placeholder
                const collectorInputEl = document.getElementById('feeCollector');
                if (collectorInputEl) collectorInputEl.placeholder = collector;
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

            // Calculate total fees collected (supply * service fee)
            const feeConfig = await window.contract.getFeeConfig();
            const totalFees = (parseInt(supply) * feeConfig.serviceFeeInTRX).toFixed(2);
            const totalFeesEl = document.getElementById('totalFees');
            if (totalFeesEl) totalFeesEl.textContent = totalFees;

            // Get contract balance
            const balance = await window.wallet.tronWeb.trx.getBalance(window.contract.address);
            const balanceEl = document.getElementById('contractBalance');
            if (balanceEl) balanceEl.textContent = (balance / 1e6).toFixed(2);

            // Active servers (from backend)
            try {
                const response = await fetchWithTimeout(getApiUrl('getServerInfo'));
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

            window.app.showProcessing('Granting server role...');

            const tx = await window.contract.instance.setServer(address, true).send();

            window.app.hideProcessing();
            window.app.showSuccess('Server role granted');
            document.getElementById('serverAddress').value = '';

        } catch (error) {
            console.error('Failed to grant server role:', error);
            window.app.hideProcessing();
            window.app.showError('Failed: ' + error.message);
        }
    },

    // Revoke process server role
    async revokeServerRole() {
        try {
            const address = document.getElementById('serverAddress').value;
            if (!window.wallet.isValidAddress(address)) {
                throw new Error('Invalid address');
            }

            if (!confirm(`Revoke Process Server role from ${address}?`)) {
                return;
            }

            window.app.showProcessing('Revoking server role...');

            const tx = await window.contract.instance.setServer(address, false).send();

            window.app.hideProcessing();
            window.app.showSuccess('Server role revoked');
            document.getElementById('serverAddress').value = '';

        } catch (error) {
            console.error('Failed to revoke server role:', error);
            window.app.hideProcessing();
            window.app.showError('Failed: ' + error.message);
        }
    },

    // Grant admin role
    async grantAdminRole() {
        try {
            const address = document.getElementById('adminAddress').value;
            if (!window.wallet.isValidAddress(address)) {
                throw new Error('Invalid address');
            }

            if (!confirm(`Grant Admin role to ${address}? This gives full control over fees and roles.`)) {
                return;
            }

            window.app.showProcessing('Granting admin role...');

            const tx = await window.contract.instance.setAdmin(address, true).send();

            window.app.hideProcessing();
            window.app.showSuccess('Admin role granted');
            document.getElementById('adminAddress').value = '';

        } catch (error) {
            console.error('Failed to grant admin role:', error);
            window.app.hideProcessing();
            window.app.showError('Failed: ' + error.message);
        }
    },

    // Revoke admin role
    async revokeAdminRole() {
        try {
            const address = document.getElementById('adminAddress').value;
            if (!window.wallet.isValidAddress(address)) {
                throw new Error('Invalid address');
            }

            if (!confirm(`Revoke Admin role from ${address}?`)) {
                return;
            }

            window.app.showProcessing('Revoking admin role...');

            const tx = await window.contract.instance.setAdmin(address, false).send();

            window.app.hideProcessing();
            window.app.showSuccess('Admin role revoked');
            document.getElementById('adminAddress').value = '';

        } catch (error) {
            console.error('Failed to revoke admin role:', error);
            window.app.hideProcessing();
            window.app.showError('Failed: ' + error.message);
        }
    },

    // Set fee exemption
    async setFeeExempt(exempt) {
        try {
            const address = document.getElementById('exemptAddress').value;
            if (!window.wallet.isValidAddress(address)) {
                throw new Error('Invalid address');
            }

            const action = exempt ? 'exempt from fees' : 'remove fee exemption for';
            if (!confirm(`${exempt ? 'Exempt' : 'Remove exemption for'} ${address}?`)) {
                return;
            }

            window.app.showProcessing(exempt ? 'Setting fee exemption...' : 'Removing fee exemption...');

            const tx = await window.contract.instance.setFeeExempt(address, exempt).send();

            window.app.hideProcessing();
            window.app.showSuccess(exempt ? 'Address is now fee exempt' : 'Fee exemption removed');
            document.getElementById('exemptAddress').value = '';

        } catch (error) {
            console.error('Failed to set fee exemption:', error);
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