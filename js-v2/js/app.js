// Main Application Controller for LegalNotice v2
window.app = {
    // Application state
    state: {
        initialized: false,
        walletConnected: false,
        currentPage: 'welcome',
        userAddress: null,
        serverId: null,
        contract: null,
        tronWeb: null
    },
    
    // Initialize application
    async init() {
        console.log('Initializing LegalNotice v2...');
        
        try {
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize modules
            await this.initializeModules();
            
            // Check for existing wallet connection
            await this.checkWalletConnection();
            
            // Load saved data
            this.loadSavedData();
            
            // Check URL for notice viewing
            this.checkUrlParams();
            
            this.state.initialized = true;
            console.log('App initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application');
        }
    },
    
    // Initialize all modules
    async initializeModules() {
        // Initialize each module
        const modules = ['wallet', 'contract', 'notices', 'cases', 'receipts', 'admin', 'storage', 'energy'];
        
        for (const moduleName of modules) {
            if (window[moduleName] && window[moduleName].init) {
                try {
                    await window[moduleName].init();
                    console.log(`Module ${moduleName} initialized`);
                } catch (error) {
                    console.error(`Failed to initialize ${moduleName}:`, error);
                }
            }
        }
    },
    
    // Set up event listeners
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.dataset.page;
                this.navigate(page);
            });
        });
        
        // Wallet connection
        const connectBtn = document.getElementById('connectWallet');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectWallet());
        }
        
        // Serve form
        const serveForm = document.getElementById('serveForm');
        if (serveForm) {
            serveForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleServeSubmit();
            });
        }
        
        // Document section is always visible now (removed type selection logic)
    },
    
    // Navigate to page
    navigate(page) {
        console.log('Navigating to:', page);
        
        // Hide all pages
        document.querySelectorAll('.page-content').forEach(p => {
            p.style.display = 'none';
        });
        
        // Show requested page
        const pageElement = document.getElementById(page + 'Page');
        if (pageElement) {
            pageElement.style.display = 'block';
            this.state.currentPage = page;
            
            // Load page-specific data
            this.loadPageData(page);
        }
    },
    
    // Load page-specific data
    async loadPageData(page) {
        switch(page) {
            case 'cases':
                if (window.cases) {
                    await window.cases.loadCases();
                }
                break;
            case 'receipts':
                if (window.receipts) {
                    await window.receipts.loadReceipts();
                }
                break;
            case 'admin':
                if (window.admin) {
                    await window.admin.loadSettings();
                }
                break;
        }
    },
    
    // Connect wallet
    async connectWallet() {
        try {
            this.showProcessing('Connecting to wallet...');
            
            if (window.wallet) {
                const connected = await window.wallet.connect();
                if (connected) {
                    this.state.walletConnected = true;
                    this.state.userAddress = window.wallet.address;
                    this.state.tronWeb = window.wallet.tronWeb;
                    
                    // Update UI
                    this.updateWalletUI(this.state.userAddress);

                    // Initialize contract with wallet
                    if (window.contract) {
                        await window.contract.initialize(this.state.tronWeb);
                        this.state.contract = window.contract.instance;
                    }
                    
                    // Register server if needed
                    await this.registerServer();
                    
                    this.hideProcessing();
                    this.showSuccess('Wallet connected successfully');
                }
            }
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            this.hideProcessing();
            this.showError('Failed to connect wallet');
        }
    },
    
    // Check existing wallet connection
    async checkWalletConnection() {
        // Wait a bit for TronLink to inject
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (window.tronWeb && window.tronWeb.ready) {
            // Already connected, just set up our app state
            try {
                this.state.walletConnected = true;
                this.state.userAddress = window.tronWeb.defaultAddress.base58;
                this.state.tronWeb = window.tronWeb;
                
                // Initialize wallet module state
                window.wallet.tronWeb = window.tronWeb;
                window.wallet.address = window.tronWeb.defaultAddress.base58;
                window.wallet.connected = true;
                
                // Update UI
                this.updateWalletUI(this.state.userAddress);

                // Initialize contract
                if (window.contract) {
                    await window.contract.initialize(window.tronWeb);
                    this.state.contract = window.contract.instance;
                }
                
                console.log('Wallet auto-connected:', this.state.userAddress);
            } catch (error) {
                console.log('Auto-connection setup failed:', error);
            }
        }
    },
    
    // Register server
    async registerServer() {
        if (!getConfig('features.requireServerRegistration')) {
            return;
        }
        
        try {
            // Check if already registered
            const savedId = localStorage.getItem(getConfig('storage.keys.serverId'));
            if (savedId) {
                this.state.serverId = savedId;
                return;
            }
            
            // Register new server
            const response = await fetch(getApiUrl('registerServer'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: this.state.userAddress,
                    name: 'Process Server',
                    agency: 'Legal Services'
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.state.serverId = data.serverId;
                localStorage.setItem(getConfig('storage.keys.serverId'), data.serverId);
                console.log('Server registered:', data.serverId);
            }
        } catch (error) {
            console.error('Failed to register server:', error);
        }
    },
    
    // Add recipient field
    addRecipientField() {
        const recipientsList = document.getElementById('recipientsList');
        const currentCount = recipientsList.querySelectorAll('.recipient-input').length;
        
        if (currentCount >= 10) {
            this.showError('Maximum 10 recipients allowed');
            return;
        }
        
        const newField = document.createElement('div');
        newField.className = 'input-group mb-2';
        newField.innerHTML = `
            <input type="text" class="form-control recipient-input" 
                   placeholder="T... (Recipient ${currentCount + 1})" required>
            <button type="button" class="btn btn-danger" onclick="this.parentElement.remove()">
                Remove
            </button>
        `;
        
        recipientsList.appendChild(newField);
    },
    
    // Handle serve form submission
    async handleServeSubmit() {
        try {
            const fileInput = document.getElementById('documentFile');
            
            // Collect all recipient addresses
            const recipientInputs = document.querySelectorAll('.recipient-input');
            const recipients = Array.from(recipientInputs)
                .map(input => input.value.trim())
                .filter(addr => addr.length > 0);
            
            const formData = {
                type: 'package', // Always create both Alert and Document
                recipients: recipients, // Now an array of addresses
                caseNumber: document.getElementById('caseNumber').value,
                noticeText: document.getElementById('noticeText').value,
                documents: Array.from(fileInput.files),
                encrypt: document.getElementById('encryptDocument').checked
            };
            
            // Validate
            if (!this.validateServeForm(formData)) {
                return;
            }
            
            // Check wallet connection
            if (!this.state.walletConnected) {
                this.showError('Please connect your wallet first');
                return;
            }
            
            const recipientCount = formData.recipients.length;
            const totalNFTs = recipientCount * 2; // Each recipient gets Alert + Document
            this.showProcessing(`Creating ${totalNFTs} NFTs for ${recipientCount} recipient(s)...`);
            
            // Create notice through notices module
            if (window.notices) {
                const result = await window.notices.createNotice(formData);
                
                if (result.success) {
                    this.hideProcessing();
                    this.showSuccess('Notice created successfully!');
                    
                    // Clear form
                    document.getElementById('serveForm').reset();
                    
                    // Navigate to receipts
                    this.navigate('receipts');
                } else {
                    throw new Error(result.error);
                }
            }
            
        } catch (error) {
            console.error('Failed to create notice:', error);
            this.hideProcessing();
            this.showError('Failed to create notice: ' + error.message);
        }
    },
    
    // Validate serve form
    validateServeForm(data) {
        if (!data.recipients || data.recipients.length === 0) {
            this.showError('Please enter at least one recipient address');
            return false;
        }
        
        if (data.recipients.length > 10) {
            this.showError('Maximum 10 recipients allowed');
            return false;
        }
        
        // Validate each recipient address
        for (const recipient of data.recipients) {
            if (!recipient.startsWith('T') || recipient.length !== 34) {
                this.showError(`Invalid TRON address: ${recipient}`);
                return false;
            }
        }
        
        if (!data.caseNumber) {
            this.showError('Please enter a case number');
            return false;
        }
        
        if (!data.noticeText) {
            this.showError('Please enter notice description');
            return false;
        }
        
        if (!data.documents || data.documents.length === 0) {
            this.showError('Please upload at least one PDF document');
            return false;
        }
        
        return true;
    },
    
    // Upload document
    async uploadDocument(file) {
        const formData = new FormData();
        formData.append('document', file);
        
        const response = await fetch(getApiUrl('uploadDocument'), {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to upload document');
        }
        
        const data = await response.json();
        return data.documentId;
    },
    
    // Load saved data
    loadSavedData() {
        // Load server ID
        const serverId = localStorage.getItem(getConfig('storage.keys.serverId'));
        if (serverId) {
            this.state.serverId = serverId;
            const serverIdElement = document.getElementById('serverId');
            if (serverIdElement) {
                serverIdElement.value = serverId;
            }
        }
    },
    
    // Check URL parameters
    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const noticeId = params.get('notice');
        
        if (noticeId) {
            // Handle notice viewing
            this.viewNotice(noticeId);
        }
    },
    
    // View notice
    async viewNotice(noticeId) {
        console.log('Viewing notice:', noticeId);
        // This will be handled by the notices module
        if (window.notices) {
            await window.notices.viewNotice(noticeId);
        }
    },
    
    // UI Helper Functions
    showProcessing(message, details = '') {
        const modal = document.getElementById('processingModal');
        const messageEl = document.getElementById('processingMessage');
        const detailsEl = document.getElementById('processingDetails');
        
        if (messageEl) messageEl.textContent = message;
        if (detailsEl) detailsEl.textContent = details;
        
        if (modal) {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        }
    },
    
    hideProcessing() {
        const modal = document.getElementById('processingModal');
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
        }
    },
    
    showAlert(message, type = 'info') {
        const container = document.getElementById('alertContainer');
        if (!container) return;
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        container.appendChild(alert);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            alert.remove();
        }, getConfig('ui.toastDuration'));
    },
    
    showSuccess(message) {
        this.showAlert(message, 'success');
    },
    
    showError(message) {
        this.showAlert(message, 'danger');
    },
    
    showInfo(message) {
        this.showAlert(message, 'info');
    },
    
    // Format address for display
    formatAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    },

    // Update wallet UI after connection
    updateWalletUI(address) {
        document.getElementById('connectWallet').style.display = 'none';

        const dropdown = document.getElementById('walletDropdown');
        const addressElement = document.getElementById('walletAddress');
        const fullAddressElement = document.getElementById('walletFullAddress');

        if (dropdown) {
            dropdown.style.display = 'block';
        }
        if (addressElement) {
            addressElement.textContent = this.formatAddress(address);
        }
        if (fullAddressElement) {
            fullAddressElement.textContent = address;
        }
    },

    // Disconnect wallet
    disconnectWallet() {
        // Reset app state
        this.state.walletConnected = false;
        this.state.userAddress = null;
        this.state.tronWeb = null;
        this.state.contract = null;

        // Call wallet module disconnect
        if (window.wallet) {
            window.wallet.disconnect();
        }

        // Note: wallet.disconnect() reloads the page, so the UI reset below
        // is just a fallback in case that doesn't happen
        document.getElementById('connectWallet').style.display = 'block';
        const dropdown = document.getElementById('walletDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    },
    
    // Format TRX amount
    formatTRX(amount) {
        return (amount / 1e6).toFixed(2);
    },
    
    // Handle account change from wallet
    handleAccountChange(newAddress) {
        console.log('Account changed to:', newAddress);
        this.state.userAddress = newAddress;

        // Update UI
        this.updateWalletUI(newAddress);

        // Reload page data
        this.loadPageData(this.state.currentPage);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});