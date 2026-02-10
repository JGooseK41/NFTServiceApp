/**
 * Admin Access Control Module
 * Manages admin authentication and UI visibility
 */

window.adminAccess = {
    isAdmin: false,
    adminData: null,
    checkInterval: null,
    
    // Initialize admin access control
    async init() {
        console.log('Initializing admin access control...');
        
        // Check admin status when wallet connects
        if (window.wallet?.address) {
            await this.checkAdminStatus();
        }
        
        // Listen for wallet connection events
        document.addEventListener('walletConnected', async (e) => {
            console.log('Wallet connected, checking admin status...');
            await this.checkAdminStatus();
        });
        
        // Listen for wallet disconnection
        document.addEventListener('walletDisconnected', () => {
            this.isAdmin = false;
            this.adminData = null;
            this.hideAdminUI();
        });
        
        // Check periodically if admin status changes
        this.startPeriodicCheck();
    },
    
    // Check if current wallet is admin
    async checkAdminStatus() {
        try {
            if (!window.wallet?.address) {
                this.isAdmin = false;
                this.hideAdminUI();
                return false;
            }
            
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            const response = await fetchWithTimeout(`${backendUrl}/api/admin-auth/check/${window.wallet.address}`);
            
            if (!response.ok) {
                throw new Error('Failed to check admin status');
            }
            
            const data = await response.json();
            
            this.isAdmin = data.isAdmin;
            this.adminData = data.admin;
            
            if (this.isAdmin) {
                console.log('✅ Admin access confirmed:', this.adminData);
                this.showAdminUI();
                this.displayAdminInfo();
            } else {
                console.log('❌ Not an admin');
                this.hideAdminUI();
            }
            
            return this.isAdmin;
            
        } catch (error) {
            console.error('Error checking admin status:', error);
            this.isAdmin = false;
            this.hideAdminUI();
            return false;
        }
    },
    
    // Show admin UI elements
    showAdminUI() {
        // Show admin tab in navigation
        const adminTab = document.querySelector('[data-page="admin"]');
        if (adminTab) {
            adminTab.parentElement.style.display = 'block';
        }
        
        // Add admin badge to wallet display
        const walletDisplay = document.getElementById('walletAddress');
        if (walletDisplay && !walletDisplay.querySelector('.admin-badge')) {
            walletDisplay.insertAdjacentHTML('afterend', `
                <span class="badge bg-danger ms-2 admin-badge">
                    <i class="bi bi-shield-check"></i> ${this.adminData?.role || 'Admin'}
                </span>
            `);
        }
        
        // Enable admin features in other modules
        if (window.adminDashboard) {
            window.adminDashboard.enabled = true;
        }
    },
    
    // Hide admin UI elements
    hideAdminUI() {
        // Hide admin tab
        const adminTab = document.querySelector('[data-page="admin"]');
        if (adminTab) {
            adminTab.parentElement.style.display = 'none';
        }
        
        // Remove admin badge
        const adminBadge = document.querySelector('.admin-badge');
        if (adminBadge) {
            adminBadge.remove();
        }
        
        // Hide admin page if currently viewing it
        const adminPage = document.getElementById('adminPage');
        if (adminPage && adminPage.style.display !== 'none') {
            // Switch to home page
            document.querySelector('[data-page="mint"]')?.click();
        }
        
        // Disable admin features
        if (window.adminDashboard) {
            window.adminDashboard.enabled = false;
        }
    },
    
    // Display admin info in admin panel
    displayAdminInfo() {
        if (!this.adminData) return;
        
        const adminInfoEl = document.getElementById('adminInfo');
        if (adminInfoEl) {
            adminInfoEl.innerHTML = `
                <div class="alert alert-success">
                    <h6><i class="bi bi-shield-check"></i> Admin Access Granted</h6>
                    <small>
                        <strong>Name:</strong> ${this.adminData.name || 'Admin'}<br>
                        <strong>Role:</strong> ${this.adminData.role}<br>
                        <strong>Last Login:</strong> ${this.adminData.lastLogin ? 
                            new Date(this.adminData.lastLogin).toLocaleString() : 'First login'}<br>
                        <strong>Blockchain Synced:</strong> ${this.adminData.isBlockchainSynced ? 
                            '<span class="text-success">✓ Yes</span>' : 
                            '<span class="text-warning">✗ No</span>'}
                    </small>
                </div>
            `;
        }
    },
    
    // Start periodic admin check (every 5 minutes)
    startPeriodicCheck() {
        // Clear any existing interval
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        
        // Check every 5 minutes
        this.checkInterval = setInterval(() => {
            if (window.wallet?.address) {
                this.checkAdminStatus();
            }
        }, 5 * 60 * 1000); // 5 minutes
    },
    
    // Stop periodic check
    stopPeriodicCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    },
    
    // Check if user has specific permission
    hasPermission(permission) {
        if (!this.isAdmin || !this.adminData?.permissions) {
            return false;
        }
        
        return this.adminData.permissions[permission] === true;
    },
    
    // Admin management functions (for super admins)
    async addAdmin(walletAddress, name, role = 'admin') {
        if (!this.hasPermission('manage_admins')) {
            window.app.showError('You do not have permission to manage admins');
            return false;
        }
        
        try {
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            const response = await fetchWithTimeout(`${backendUrl}/api/admin-auth/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'adminWallet': window.wallet.address
                },
                body: JSON.stringify({ walletAddress, name, role })
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.app.showSuccess('Admin added successfully');
                return true;
            } else {
                throw new Error(data.error);
            }
            
        } catch (error) {
            console.error('Error adding admin:', error);
            window.app.showError('Failed to add admin: ' + error.message);
            return false;
        }
    },
    
    async removeAdmin(walletAddress) {
        if (!this.hasPermission('manage_admins')) {
            window.app.showError('You do not have permission to manage admins');
            return false;
        }
        
        try {
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            const response = await fetchWithTimeout(`${backendUrl}/api/admin-auth/remove`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'adminWallet': window.wallet.address
                },
                body: JSON.stringify({ walletAddress })
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.app.showSuccess('Admin removed successfully');
                return true;
            } else {
                throw new Error(data.error);
            }
            
        } catch (error) {
            console.error('Error removing admin:', error);
            window.app.showError('Failed to remove admin: ' + error.message);
            return false;
        }
    },
    
    async listAdmins() {
        if (!this.hasPermission('manage_admins')) {
            window.app.showError('You do not have permission to view admin list');
            return null;
        }
        
        try {
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            const response = await fetchWithTimeout(`${backendUrl}/api/admin-auth/list`, {
                headers: {
                    'adminWallet': window.wallet.address
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                return data.admins;
            } else {
                throw new Error(data.error);
            }
            
        } catch (error) {
            console.error('Error listing admins:', error);
            window.app.showError('Failed to list admins: ' + error.message);
            return null;
        }
    },
    
    async syncWithBlockchain() {
        if (!this.hasPermission('sync_blockchain')) {
            window.app.showError('You do not have permission to sync with blockchain');
            return false;
        }
        
        try {
            window.app.showProcessing('Syncing with blockchain...');
            
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            const response = await fetchWithTimeout(`${backendUrl}/api/admin-auth/sync-blockchain`, {
                method: 'POST',
                headers: {
                    'adminWallet': window.wallet.address
                }
            });
            
            const data = await response.json();
            
            window.app.hideProcessing();
            
            if (data.success) {
                window.app.showSuccess('Blockchain sync completed');
                if (data.contractOwner) {
                    window.app.showInfo(`Contract owner: ${data.contractOwner}`);
                }
                return true;
            } else {
                throw new Error(data.error);
            }
            
        } catch (error) {
            window.app.hideProcessing();
            console.error('Error syncing with blockchain:', error);
            window.app.showError('Failed to sync with blockchain: ' + error.message);
            return false;
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    adminAccess.init();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    adminAccess.stopPeriodicCheck();
});