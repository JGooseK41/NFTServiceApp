// Main Application Controller for LegalNotice v2
window.app = {
    // Application state
    state: {
        initialized: false,
        walletConnected: false,
        isRegisteredServer: false, // Whether wallet is a registered process server
        currentPage: 'welcome',
        userAddress: null,
        serverId: null,
        agencyName: null,
        contract: null,
        tronWeb: null,
        fileQueue: [], // Store files in order
        processing: false,
        autoSaveInterval: null,
        blobUrls: new Set() // Track blob URLs for cleanup
    },
    
    // Initialize application with comprehensive error handling
    async init() {
        console.log('Initializing LegalNotice v2...');
        
        try {
            // Check browser compatibility first
            this.checkBrowserCompatibility();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize modules
            await this.initializeModules();
            
            // Check for existing wallet connection
            await this.checkWalletConnection();

            // Update UI based on role (handles unconnected/unregistered state)
            this.updateUIForRole();

            // Load saved form data if exists
            this.loadSavedFormData();
            
            // Set up auto-save
            this.setupAutoSave();
            
            // Check URL for notice viewing
            this.checkUrlParams();
            
            // Set up cleanup handlers
            this.setupCleanupHandlers();
            
            this.state.initialized = true;
            console.log('App initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application: ' + error.message);
        }
    },
    
    // Check browser compatibility
    checkBrowserCompatibility() {
        const required = {
            fetch: typeof fetch !== 'undefined',
            formData: typeof FormData !== 'undefined',
            fileAPI: typeof File !== 'undefined',
            canvas: !!document.createElement('canvas').getContext,
            crypto: typeof crypto !== 'undefined'
        };
        
        const missing = Object.entries(required)
            .filter(([feature, supported]) => !supported)
            .map(([feature]) => feature);
        
        if (missing.length > 0) {
            throw new Error('Browser missing required features: ' + missing.join(', '));
        }
    },
    
    // Set up auto-save functionality
    setupAutoSave() {
        // Save form data every 30 seconds
        this.state.autoSaveInterval = setInterval(() => {
            this.saveFormData();
        }, 30000);
        
        // Save on input change (debounced)
        const saveDebounced = this.debounce(() => {
            this.saveFormData();
        }, 2000);
        
        document.querySelectorAll('#serveForm input, #serveForm textarea, #serveForm select').forEach(input => {
            input.addEventListener('input', saveDebounced);
            input.addEventListener('change', saveDebounced);
        });
    },
    
    // Save form data to localStorage
    saveFormData() {
        if (this.state.processing) return;
        
        try {
            const formData = {
                caseNumber: document.getElementById('caseNumber')?.value || '',
                noticeText: document.getElementById('noticeText')?.value || '',
                issuingAgency: document.getElementById('issuingAgency')?.value || '',
                noticeType: document.getElementById('noticeType')?.value || '',
                caseDetails: document.getElementById('caseDetails')?.value || '',
                responseDeadline: document.getElementById('responseDeadline')?.value || '',
                recipients: this.getRecipients(),
                fileQueue: this.state.fileQueue.map(f => ({
                    name: f.name,
                    size: f.size,
                    id: f.id
                }))
            };
            
            localStorage.setItem('formData_serveForm', JSON.stringify({
                data: formData,
                timestamp: Date.now()
            }));
            
            this.showSaveIndicator();
        } catch (error) {
            console.error('Failed to save form data:', error);
        }
    },
    
    // Load saved form data
    loadSavedFormData() {
        try {
            const saved = localStorage.getItem('formData_serveForm');
            if (!saved) return;
            
            const { data, timestamp } = JSON.parse(saved);
            
            // Check if data is not too old (24 hours)
            if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
                localStorage.removeItem('formData_serveForm');
                return;
            }
            
            // Ask user if they want to restore
            if (confirm('Found unsaved form data. Would you like to restore it?')) {
                // Restore form fields
                if (data.caseNumber) document.getElementById('caseNumber').value = data.caseNumber;
                if (data.noticeText) document.getElementById('noticeText').value = data.noticeText;
                if (data.issuingAgency) document.getElementById('issuingAgency').value = data.issuingAgency;
                if (data.noticeType) document.getElementById('noticeType').value = data.noticeType;
                if (data.caseDetails) document.getElementById('caseDetails').value = data.caseDetails;
                if (data.responseDeadline) document.getElementById('responseDeadline').value = data.responseDeadline;
                
                // Restore recipients (handle both old format [string] and new format [{address, label}])
                if (data.recipients && data.recipients.length > 0) {
                    data.recipients.forEach((recipient, index) => {
                        if (index > 0) this.addRecipientField();
                        const rows = document.querySelectorAll('.recipient-row');
                        const row = rows[index];
                        if (row) {
                            const addressInput = row.querySelector('.recipient-input');
                            const labelInput = row.querySelector('.recipient-label');
                            // Handle both old (string) and new ({address, label}) formats
                            if (typeof recipient === 'string') {
                                if (addressInput) addressInput.value = recipient;
                            } else {
                                if (addressInput) addressInput.value = recipient.address || '';
                                if (labelInput) labelInput.value = recipient.label || '';
                            }
                        }
                    });
                }
                
                this.showSuccess('Form data restored');
            }
        } catch (error) {
            console.error('Failed to load saved data:', error);
        }
    },
    
    // Show save indicator
    showSaveIndicator() {
        let indicator = document.getElementById('saveIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'saveIndicator';
            indicator.style.cssText = 'position:fixed;top:70px;right:10px;background:#28a745;color:white;padding:5px 10px;border-radius:4px;display:none;z-index:9999;font-size:12px';
            indicator.textContent = '✓ Saved';
            document.body.appendChild(indicator);
        }
        
        indicator.style.display = 'block';
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 2000);
    },
    
    // Set up cleanup handlers
    setupCleanupHandlers() {
        // Cleanup on page unload
        window.addEventListener('beforeunload', (e) => {
            this.cleanup();
            
            // Warn if processing
            if (this.state.processing) {
                e.preventDefault();
                e.returnValue = 'Transaction in progress. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
        
        // Cleanup blob URLs when modal closes
        const previewModal = document.getElementById('previewModal');
        if (previewModal) {
            previewModal.addEventListener('hidden.bs.modal', () => {
                if (this.previewPdfUrl) {
                    URL.revokeObjectURL(this.previewPdfUrl);
                    this.previewPdfUrl = null;
                }
            });
        }
    },
    
    // Cleanup resources
    cleanup() {
        // Clear auto-save interval
        if (this.state.autoSaveInterval) {
            clearInterval(this.state.autoSaveInterval);
        }
        
        // Revoke all blob URLs
        this.state.blobUrls.forEach(url => {
            URL.revokeObjectURL(url);
        });
        this.state.blobUrls.clear();
        
        // Clean up preview PDF URL
        if (this.previewPdfUrl) {
            URL.revokeObjectURL(this.previewPdfUrl);
            this.previewPdfUrl = null;
        }
    },
    
    // Debounce helper
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
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
        
        // Set up drag and drop
        this.setupDragAndDrop();
        
        // File input change handler
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            // Remove any existing change listeners
            fileInput.removeEventListener('change', this.fileInputHandler);
            
            // Create bound handler
            this.fileInputHandler = (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.handleFileSelect(e.target.files);
                    // Clear input for re-selection after a small delay
                    setTimeout(() => {
                        e.target.value = '';
                    }, 100);
                }
            };
            
            fileInput.addEventListener('change', this.fileInputHandler);
        }
    },
    
    // Navigate to page
    navigate(page) {
        console.log('Navigating to:', page);

        // Check access for restricted pages
        const restrictedPages = ['serve', 'cases', 'receipts'];
        if (restrictedPages.includes(page)) {
            if (!this.state.walletConnected) {
                this.showError('Please connect your wallet first');
                this.navigate('welcome');
                return;
            }
            if (!this.state.isRegisteredServer) {
                this.showError('You must be a registered process server to access this feature. Please register first.');
                this.navigate('welcome');
                return;
            }
        }

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
            case 'serve':
                // Load agency name into form
                this.loadAgencyInfo();
                break;
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
                        try {
                            await window.contract.initialize(this.state.tronWeb);
                            this.state.contract = window.contract.instance;

                            // Load fee configuration from contract
                            await this.loadFeeConfig();
                        } catch (contractError) {
                            console.warn('Contract initialization warning:', contractError);
                        }
                    }

                    // Check server registration status
                    await this.registerServer();

                    // Dispatch walletConnected event for admin-access and other modules
                    document.dispatchEvent(new CustomEvent('walletConnected', { detail: { address: this.state.userAddress } }));

                    this.hideProcessing();
                    this.showSuccess('Wallet connected successfully');
                } else {
                    this.hideProcessing();
                }
            } else {
                this.hideProcessing();
                this.showError('Wallet module not available');
            }
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            this.hideProcessing();
            this.showError('Failed to connect wallet: ' + error.message);
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

                    // Load fee configuration from contract
                    await this.loadFeeConfig();
                }

                // Check server registration status
                await this.registerServer();

                // Dispatch walletConnected event for admin-access and other modules
                document.dispatchEvent(new CustomEvent('walletConnected', { detail: { address: this.state.userAddress } }));

                console.log('Wallet auto-connected:', this.state.userAddress);
            } catch (error) {
                console.log('Auto-connection setup failed:', error);
            }
        }
    },
    
    // Check if server is registered and load agency info
    async registerServer() {
        try {
            // Check if server is already registered on backend
            const checkUrl = `${getConfig('backend.baseUrl')}/api/server/check/${this.state.userAddress}`;
            const checkResponse = await fetch(checkUrl);
            const checkData = await checkResponse.json();

            if (checkData.registered) {
                // Server is registered in backend - store agency info
                this.state.isRegisteredServer = true;
                this.state.agencyName = checkData.agency_name;
                this.state.serverId = this.state.userAddress;
                localStorage.setItem('legalnotice_agency_name', checkData.agency_name);
                localStorage.setItem(getConfig('storage.keys.serverId'), this.state.userAddress);

                // Auto-fill agency name in the serve form
                const agencyField = document.getElementById('issuingAgency');
                if (agencyField) {
                    agencyField.value = checkData.agency_name;
                }

                console.log('Server registered as:', checkData.agency_name);
            } else {
                // Not in backend - check blockchain role
                let hasBlockchainRole = false;

                if (window.contract && window.contract.instance) {
                    try {
                        // Lite v2: use isServer() mapping
                        if (window.contract.instance.isServer) {
                            hasBlockchainRole = await window.contract.instance.isServer(this.state.userAddress).call();
                            console.log('Blockchain isServer check:', hasBlockchainRole);
                        }
                        // V5 fallback: use PROCESS_SERVER_ROLE + hasRole
                        if (!hasBlockchainRole && window.contract.instance.PROCESS_SERVER_ROLE) {
                            const serverRole = await window.contract.instance.PROCESS_SERVER_ROLE().call();
                            hasBlockchainRole = await window.contract.instance.hasRole(serverRole, this.state.userAddress).call();
                            console.log('Blockchain PROCESS_SERVER_ROLE check:', hasBlockchainRole);
                        }
                    } catch (contractError) {
                        console.log('Contract role check failed:', contractError.message);
                    }
                }

                if (hasBlockchainRole) {
                    // Has blockchain role but not in backend - still grant access
                    this.state.isRegisteredServer = true;
                    this.state.serverId = this.state.userAddress;
                    console.log('Wallet authorized as server on blockchain');
                } else {
                    this.state.isRegisteredServer = false;
                    console.log('Wallet not registered as a process server');
                }
            }

            // Update UI based on registration status
            this.updateUIForRole();

        } catch (error) {
            console.error('Failed to check server registration:', error);

            // Backend unavailable - still try blockchain role check as fallback
            let hasBlockchainRole = false;
            if (window.contract && window.contract.instance) {
                try {
                    // Lite v2: use isServer() mapping
                    if (window.contract.instance.isServer) {
                        hasBlockchainRole = await window.contract.instance.isServer(this.state.userAddress).call();
                    }
                    // V5 fallback
                    if (!hasBlockchainRole && window.contract.instance.PROCESS_SERVER_ROLE) {
                        const serverRole = await window.contract.instance.PROCESS_SERVER_ROLE().call();
                        hasBlockchainRole = await window.contract.instance.hasRole(serverRole, this.state.userAddress).call();
                    }
                    console.log('Blockchain server role fallback check:', hasBlockchainRole);
                } catch (contractError) {
                    console.log('Contract role fallback check failed:', contractError.message);
                }
            }

            if (hasBlockchainRole) {
                this.state.isRegisteredServer = true;
                this.state.serverId = this.state.userAddress;
                console.log('Wallet authorized as server on blockchain (backend unavailable)');
            } else {
                this.state.isRegisteredServer = false;
            }

            this.updateUIForRole();
        }
    },

    // Update UI elements based on user role
    updateUIForRole() {
        const isRegistered = this.state.isRegisteredServer;
        const isConnected = this.state.walletConnected;

        console.log('Updating UI for role - Connected:', isConnected, 'Registered:', isRegistered);

        // Nav items that require registration
        const restrictedNavItems = document.querySelectorAll('[data-page="serve"], [data-page="cases"], [data-page="receipts"]');
        restrictedNavItems.forEach(item => {
            const parentLi = item.closest('li');
            if (parentLi) {
                parentLi.style.display = (isConnected && isRegistered) ? '' : 'none';
            }
        });

        // Welcome page sections
        const getStartedSection = document.getElementById('getStartedSection');
        const registeredServerSection = document.getElementById('registeredServerSection');
        const connectWalletPrompt = document.getElementById('connectWalletPrompt');
        const registerPrompt = document.getElementById('registerPrompt');
        const welcomeAgencyName = document.getElementById('welcomeAgencyName');

        if (getStartedSection) {
            // Show get started section if not registered
            getStartedSection.style.display = !isRegistered ? 'block' : 'none';
        }

        if (connectWalletPrompt) {
            // Show connect wallet prompt only if not connected
            connectWalletPrompt.style.display = !isConnected ? 'block' : 'none';
        }

        if (registerPrompt) {
            // Show register prompt only if connected but not registered
            registerPrompt.style.display = (isConnected && !isRegistered) ? 'block' : 'none';
        }

        if (registeredServerSection) {
            // Show registered server section only if connected AND registered
            registeredServerSection.style.display = (isConnected && isRegistered) ? 'block' : 'none';
        }

        if (welcomeAgencyName && this.state.agencyName) {
            welcomeAgencyName.textContent = this.state.agencyName;
        }
    },

    // Show the server registration modal
    showRegistrationModal() {
        // Pre-fill wallet address
        const walletField = document.getElementById('regWalletAddress');
        if (walletField) {
            walletField.value = this.state.userAddress;
        }

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('serverRegistrationModal'));
        modal.show();
    },

    // Submit server registration
    async submitServerRegistration() {
        const form = document.getElementById('serverRegistrationForm');
        const errorDiv = document.getElementById('registrationError');

        // Get form values with null safety
        const agencyName = document.getElementById('regAgencyName')?.value?.trim() || '';
        const contactEmail = document.getElementById('regContactEmail')?.value?.trim() || '';
        const phoneNumber = document.getElementById('regPhoneNumber')?.value?.trim() || '';
        const website = document.getElementById('regWebsite')?.value?.trim() || '';
        const licenseNumber = document.getElementById('regLicenseNumber')?.value?.trim() || '';

        // Validate
        if (!agencyName || !contactEmail || !phoneNumber) {
            errorDiv.textContent = 'Please fill in all required fields';
            errorDiv.style.display = 'block';
            return;
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contactEmail)) {
            errorDiv.textContent = 'Please enter a valid email address';
            errorDiv.style.display = 'block';
            return;
        }

        // Validate phone (at least 10 digits)
        const phoneDigits = phoneNumber.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
            errorDiv.textContent = 'Phone number must have at least 10 digits';
            errorDiv.style.display = 'block';
            return;
        }

        try {
            errorDiv.style.display = 'none';
            this.showProcessing('Registering your agency...');

            const response = await fetch(getApiUrl('registerServer'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: this.state.userAddress,
                    agency_name: agencyName,
                    contact_email: contactEmail,
                    phone_number: phoneNumber,
                    website: website,
                    license_number: licenseNumber
                })
            });

            const data = await response.json();

            // Always hide processing when done
            this.hideProcessing();

            if (response.ok && data.success) {
                try {
                    // Store agency info and mark as registered
                    this.state.isRegisteredServer = true;
                    this.state.agencyName = agencyName;
                    this.state.serverId = this.state.userAddress;
                    localStorage.setItem('legalnotice_agency_name', agencyName);
                    localStorage.setItem(getConfig('storage.keys.serverId'), this.state.userAddress);

                    // Auto-fill agency name in the serve form
                    const agencyField = document.getElementById('issuingAgency');
                    if (agencyField) {
                        agencyField.value = agencyName;
                    }

                    // Update UI to show registered server options
                    this.updateUIForRole();

                    // Close registration modal
                    const regModal = bootstrap.Modal.getInstance(document.getElementById('serverRegistrationModal'));
                    if (regModal) regModal.hide();

                    this.showSuccess('Agency registered successfully! Your agency name is now permanently linked to this wallet.');
                } catch (successError) {
                    console.error('Error in registration success handler:', successError);
                    this.showSuccess('Agency registered successfully!');
                }
            } else {
                errorDiv.textContent = data.error || 'Registration failed';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.hideProcessing();
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
        }
    },

    // ========== ONBOARDING FLOW ==========

    // Current onboarding step (1, 2, or 3)
    onboardingStep: 1,

    // Show the onboarding modal
    showOnboardingModal() {
        this.onboardingStep = 1;
        this.updateOnboardingUI();

        const modal = new bootstrap.Modal(document.getElementById('onboardingModal'));
        modal.show();
    },

    // Update UI for current step
    updateOnboardingUI() {
        // Update step indicators
        for (let i = 1; i <= 3; i++) {
            const indicator = document.getElementById(`step${i}Indicator`);
            if (indicator) {
                if (i < this.onboardingStep) {
                    indicator.className = 'rounded-circle bg-success text-white d-flex align-items-center justify-content-center';
                    indicator.innerHTML = '<i class="bi bi-check"></i>';
                } else if (i === this.onboardingStep) {
                    indicator.className = 'rounded-circle bg-primary text-white d-flex align-items-center justify-content-center';
                    indicator.textContent = i;
                } else {
                    indicator.className = 'rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center';
                    indicator.textContent = i;
                }
                indicator.style.width = '36px';
                indicator.style.height = '36px';
                indicator.style.fontWeight = 'bold';
            }
        }

        // Show/hide step content
        document.querySelectorAll('.onboarding-step').forEach(el => el.style.display = 'none');
        const currentStep = document.getElementById(`onboardingStep${this.onboardingStep}`);
        if (currentStep) currentStep.style.display = 'block';

        // Update buttons
        const backBtn = document.getElementById('onboardingBackBtn');
        const nextBtn = document.getElementById('onboardingNextBtn');

        if (backBtn) backBtn.style.display = this.onboardingStep > 1 ? 'inline-block' : 'none';

        if (nextBtn) {
            if (this.onboardingStep === 1) {
                nextBtn.innerHTML = "I've Installed TronLink <i class='bi bi-arrow-right'></i>";
                nextBtn.style.display = 'inline-block';
            } else if (this.onboardingStep === 2) {
                nextBtn.style.display = 'none'; // Connect button handles this
            } else {
                nextBtn.style.display = 'none'; // Registration button handles this
            }
        }

        // Step-specific logic
        if (this.onboardingStep === 2) {
            this.checkTronLinkForOnboarding();
        } else if (this.onboardingStep === 3) {
            this.checkRegistrationStatus();
        }
    },

    // Go to specific step
    goToOnboardingStep(step) {
        this.onboardingStep = step;
        this.updateOnboardingUI();
    },

    // Next step
    nextOnboardingStep() {
        if (this.onboardingStep < 3) {
            this.onboardingStep++;
            this.updateOnboardingUI();
        }
    },

    // Previous step
    previousOnboardingStep() {
        if (this.onboardingStep > 1) {
            this.onboardingStep--;
            this.updateOnboardingUI();
        }
    },

    // Check if TronLink is installed
    async checkTronLinkForOnboarding() {
        const checkStatus = document.getElementById('walletCheckStatus');
        const notDetected = document.getElementById('walletNotDetected');
        const detected = document.getElementById('walletDetected');
        const connected = document.getElementById('walletConnected');

        // Show loading
        if (checkStatus) checkStatus.style.display = 'block';
        if (notDetected) notDetected.style.display = 'none';
        if (detected) detected.style.display = 'none';
        if (connected) connected.style.display = 'none';

        // Wait a moment for TronLink to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));

        const hasTronLink = window.tronWeb || window.tronLink;

        if (checkStatus) checkStatus.style.display = 'none';

        if (this.state.userAddress) {
            // Already connected
            if (connected) {
                connected.style.display = 'block';
                const walletAddr = document.getElementById('onboardingWalletAddress');
                if (walletAddr) walletAddr.textContent = this.state.userAddress;
            }
            // Auto-advance to step 3
            setTimeout(() => {
                this.onboardingStep = 3;
                this.updateOnboardingUI();
            }, 1000);
        } else if (hasTronLink) {
            if (detected) detected.style.display = 'block';
        } else {
            if (notDetected) notDetected.style.display = 'block';
        }
    },

    // Connect wallet from onboarding flow
    async connectFromOnboarding() {
        try {
            await this.connectWallet();

            if (this.state.userAddress) {
                const connected = document.getElementById('walletConnected');
                const detected = document.getElementById('walletDetected');
                if (detected) detected.style.display = 'none';
                if (connected) {
                    connected.style.display = 'block';
                    const walletAddr = document.getElementById('onboardingWalletAddress');
                    if (walletAddr) walletAddr.textContent = this.state.userAddress;
                }

                // Move to step 3
                setTimeout(() => {
                    this.onboardingStep = 3;
                    this.updateOnboardingUI();
                }, 1500);
            }
        } catch (error) {
            console.error('Onboarding connect error:', error);
            this.showError('Failed to connect wallet: ' + error.message);
        }
    },

    // Check if user is already registered
    async checkRegistrationStatus() {
        const alreadyRegistered = document.getElementById('alreadyRegistered');
        const needsRegistration = document.getElementById('needsRegistration');

        if (!this.state.userAddress) {
            if (needsRegistration) needsRegistration.style.display = 'block';
            return;
        }

        try {
            const checkUrl = `${getConfig('backend.baseUrl')}/api/server/check/${this.state.userAddress}`;
            const response = await fetch(checkUrl);
            const data = await response.json();

            if (data.registered) {
                if (alreadyRegistered) {
                    alreadyRegistered.style.display = 'block';
                    document.getElementById('onboardingAgencyName').textContent = data.agency_name;
                }
                if (needsRegistration) needsRegistration.style.display = 'none';
            } else {
                if (alreadyRegistered) alreadyRegistered.style.display = 'none';
                if (needsRegistration) needsRegistration.style.display = 'block';
            }
        } catch (error) {
            console.error('Check registration error:', error);
            if (needsRegistration) needsRegistration.style.display = 'block';
        }
    },

    // Open registration modal from onboarding
    openRegistrationFromOnboarding() {
        // Close onboarding modal
        const onboardingModal = bootstrap.Modal.getInstance(document.getElementById('onboardingModal'));
        if (onboardingModal) onboardingModal.hide();

        // Open registration modal
        setTimeout(() => {
            this.showRegistrationModal();
        }, 300);
    },

    // ========== END ONBOARDING FLOW ==========

    // Check the role of the connected wallet
    async checkMyRole() {
        if (!this.state.userAddress) {
            this.showError('Please connect your wallet first');
            return;
        }

        this.showProcessing('Checking wallet role...');

        try {
            const roles = [];

            // Check backend registration
            const checkUrl = `${getConfig('backend.baseUrl')}/api/server/check/${this.state.userAddress}`;
            const response = await fetch(checkUrl);
            const data = await response.json();

            if (data.registered) {
                roles.push({
                    role: 'Registered Process Server',
                    icon: 'bi-person-badge-fill',
                    color: 'success',
                    details: `Agency: ${data.agency_name}`
                });
            }

            // Check contract roles if contract is available
            if (window.contract && window.contract.instance) {
                try {
                    // Check ADMIN_ROLE
                    const adminRole = await window.contract.instance.ADMIN_ROLE().call();
                    const isAdmin = await window.contract.instance.hasRole(adminRole, this.state.userAddress).call();
                    if (isAdmin) {
                        roles.push({
                            role: 'Contract Admin',
                            icon: 'bi-shield-fill-check',
                            color: 'danger',
                            details: 'Full administrative access to the smart contract'
                        });
                    }

                    // Check PROCESS_SERVER_ROLE
                    const serverRole = await window.contract.instance.PROCESS_SERVER_ROLE().call();
                    const isServer = await window.contract.instance.hasRole(serverRole, this.state.userAddress).call();
                    if (isServer) {
                        roles.push({
                            role: 'Approved Process Server (On-Chain)',
                            icon: 'bi-patch-check-fill',
                            color: 'primary',
                            details: 'Authorized to mint legal notice NFTs'
                        });
                    }
                } catch (contractError) {
                    console.log('Contract role check skipped:', contractError.message);
                }
            }

            this.hideProcessing();

            // Show results in a modal
            this.showRoleModal(roles);

        } catch (error) {
            console.error('Error checking role:', error);
            this.hideProcessing();
            this.showError('Failed to check wallet role: ' + error.message);
        }
    },

    // Show role information modal
    showRoleModal(roles) {
        // Remove any existing role modal
        const existingModal = document.getElementById('roleModal');
        if (existingModal) existingModal.remove();

        let rolesHtml = '';
        if (roles.length === 0) {
            rolesHtml = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle"></i> <strong>No roles assigned</strong><br>
                    This wallet is not registered as a process server.
                </div>
                <p>To get started, click the "Get Started" button on the home page or register through the registration form.</p>
            `;
        } else {
            rolesHtml = '<div class="list-group">';
            roles.forEach(r => {
                rolesHtml += `
                    <div class="list-group-item">
                        <div class="d-flex align-items-center">
                            <i class="bi ${r.icon} text-${r.color} me-3" style="font-size: 1.5rem;"></i>
                            <div>
                                <h6 class="mb-0">${r.role}</h6>
                                <small class="text-muted">${r.details}</small>
                            </div>
                        </div>
                    </div>
                `;
            });
            rolesHtml += '</div>';
        }

        const modalHtml = `
            <div class="modal fade" id="roleModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header bg-dark text-white">
                            <h5 class="modal-title"><i class="bi bi-person-badge"></i> Wallet Role Information</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label text-muted">Connected Wallet</label>
                                <div class="font-monospace bg-light p-2 rounded" style="word-break: break-all;">
                                    ${this.state.userAddress}
                                </div>
                            </div>
                            <hr>
                            <h6>Assigned Roles:</h6>
                            ${rolesHtml}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('roleModal'));
        modal.show();

        // Clean up when closed
        document.getElementById('roleModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },

    // Load agency name into forms (called when navigating to serve page)
    loadAgencyInfo() {
        let agencyName = localStorage.getItem('legalnotice_agency_name') || this.state.agencyName;

        // Fallback: check old v1 server profile format
        if (!agencyName && this.state.userAddress) {
            try {
                const oldProfile = localStorage.getItem(`server_profile_${this.state.userAddress}`);
                if (oldProfile) {
                    const parsed = JSON.parse(oldProfile);
                    agencyName = parsed.agency || parsed.agencyName;
                    // Migrate to new key
                    if (agencyName) {
                        localStorage.setItem('legalnotice_agency_name', agencyName);
                    }
                }
            } catch (e) {
                console.log('Could not parse old server profile:', e);
            }
        }

        if (agencyName) {
            const agencyField = document.getElementById('issuingAgency');
            if (agencyField && !agencyField.value) {
                agencyField.value = agencyName;
            }
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
        newField.className = 'recipient-row mb-2';
        newField.innerHTML = `
            <div class="input-group">
                <input type="text" class="form-control recipient-input"
                       placeholder="T... (Wallet Address)" required>
                <input type="text" class="form-control recipient-label"
                       placeholder="Label (optional)" style="max-width: 150px;">
                <button type="button" class="btn btn-danger" onclick="this.closest('.recipient-row').remove()">
                    Remove
                </button>
            </div>
        `;

        recipientsList.appendChild(newField);
    },
    
    // Get all recipients with addresses and optional labels
    getRecipients() {
        const recipientRows = document.querySelectorAll('.recipient-row');
        const recipients = [];

        recipientRows.forEach(row => {
            const addressInput = row.querySelector('.recipient-input');
            const labelInput = row.querySelector('.recipient-label');

            const address = addressInput?.value?.trim();
            const label = labelInput?.value?.trim() || null;

            if (address) {
                recipients.push({ address, label });
            }
        });

        // Fallback for old HTML structure (single inputs without rows)
        if (recipients.length === 0) {
            const recipientInputs = document.querySelectorAll('.recipient-input');
            recipientInputs.forEach(input => {
                const address = input.value.trim();
                if (address) {
                    recipients.push({ address, label: null });
                }
            });
        }

        return recipients;
    },

    // Get just the addresses (for backward compatibility)
    getRecipientAddresses() {
        return this.getRecipients().map(r => r.address);
    },
    
    // Preview notice before minting
    async previewNotice() {
        try {
            // Check if case has been saved first (for server-side PDF cleaning)
            if (!this.currentCaseId || !this.consolidatedPDFUrl) {
                this.showError('Please save to Case Manager first. This will clean and consolidate your PDFs on the server.');
                
                // Highlight the Save to Case Manager button
                const saveButton = document.querySelector('button[onclick*="saveToCase"]');
                if (saveButton) {
                    saveButton.classList.add('animate-pulse');
                    saveButton.style.animation = 'pulse 1s 3';
                    setTimeout(() => {
                        saveButton.style.animation = '';
                    }, 3000);
                }
                return;
            }
            
            // Validate we have documents
            if (this.state.fileQueue.length === 0) {
                this.showError('Please upload at least one PDF document');
                return;
            }
            
            // Validate all PDFs first (skip validation for backend documents)
            for (const fileItem of this.state.fileQueue) {
                // Skip validation for documents from backend - they're already processed
                if (fileItem.isExisting && fileItem.fromBackend) {
                    console.log('Skipping validation for backend document:', fileItem.name);
                    continue;
                }
                
                const validation = await this.validatePDF(fileItem.file);
                if (!validation.valid) {
                    this.showError(`Invalid PDF: ${fileItem.name} - ${validation.error}`);
                    return;
                }
            }
            
            // Collect and validate recipient addresses with labels
            const recipients = this.getRecipients();
            const recipientAddresses = recipients.map(r => this.sanitizeInput(r.address));

            // Validate each address
            for (const recipient of recipients) {
                if (!this.validateTronAddress(recipient.address)) {
                    const label = recipient.label ? ` (${recipient.label})` : '';
                    this.showError(`Invalid TRON address${label}: ${recipient.address}`);
                    return;
                }
            }

            // Check for duplicates
            const uniqueAddresses = [...new Set(recipientAddresses)];
            if (uniqueAddresses.length < recipientAddresses.length) {
                this.showError('Duplicate recipient addresses detected');
                return;
            }

            if (recipients.length === 0) {
                this.showError('Please add at least one recipient');
                return;
            }
            
            // Validate case-specific contact info
            const noticeEmail = document.getElementById('noticeEmail').value.trim();
            const noticePhone = document.getElementById('noticePhone').value.trim();

            if (!noticeEmail) {
                this.showError('Please enter a contact email for this case');
                return;
            }
            if (!noticePhone) {
                this.showError('Please enter a contact phone for this case');
                return;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(noticeEmail)) {
                this.showError('Please enter a valid contact email');
                return;
            }

            // Store form data for later submission with all metadata
            this.pendingFormData = {
                type: 'package',
                recipients: recipients,
                caseNumber: document.getElementById('caseNumber').value,
                noticeText: document.getElementById('noticeText').value,
                documents: this.state.fileQueue.map(item => item.file),
                encrypt: document.getElementById('encryptDocument').checked,
                // Additional metadata fields
                issuingAgency: document.getElementById('issuingAgency')?.value || this.state.agencyName || localStorage.getItem('legalnotice_agency_name') || '',
                noticeType: document.getElementById('noticeType').value,
                caseDetails: document.getElementById('caseDetails').value,
                legalRights: document.getElementById('legalRights').value,
                responseDeadline: parseInt(document.getElementById('responseDeadline').value) || 30,
                // Case-specific contact info (for recipient)
                noticeEmail: noticeEmail,
                noticePhone: noticePhone
            };
            
            // Populate Alert preview with all metadata
            document.getElementById('previewIssuingAgency').textContent = this.pendingFormData.issuingAgency;
            document.getElementById('previewNoticeType').textContent = this.pendingFormData.noticeType;
            document.getElementById('previewCaseNumber').textContent = this.pendingFormData.caseNumber;
            document.getElementById('previewResponseDeadline').textContent = this.pendingFormData.responseDeadline;
            document.getElementById('previewNoticeText').textContent = this.pendingFormData.noticeText;
            
            // Populate recipients list (handle {address, label} format)
            const recipientsList = document.getElementById('previewRecipients');
            recipientsList.innerHTML = recipients.map((r, idx) => {
                const addr = typeof r === 'string' ? r : r.address;
                const label = typeof r === 'object' && r.label ? `[${r.label}] ` : '';
                return `<li><small>${idx + 1}. ${label}${addr}</small></li>`;
            }).join('');
            
            // Populate document list
            const docList = document.getElementById('previewDocumentList');
            docList.innerHTML = this.state.fileQueue.map(item => 
                `<li>${item.name} (${(item.size / 1024).toFixed(1)} KB)</li>`
            ).join('');
            
            // Create Alert NFT preview image
            await this.createAlertNFTPreview();
            
            // Create merged PDF preview with page separators
            await this.createMergedPDFPreview();
            
            // Calculate costs using actual fee config
            const feeConfig = this.feeConfig || { serviceFeeInTRX: 10, recipientFundingInTRX: 20, totalPerNoticeInTRX: 30 };
            const perRecipientCost = feeConfig.totalPerNoticeInTRX || 30;
            const totalCost = recipients.length * perRecipientCost;
            const energyEstimate = recipients.length * 140000;

            // Update cost summary
            document.getElementById('previewRecipientCount').textContent = recipients.length;
            document.getElementById('previewPerRecipientCost').textContent = perRecipientCost;
            document.getElementById('previewTotalCost').textContent = totalCost;
            document.getElementById('previewEnergyEstimate').textContent = energyEstimate.toLocaleString();
            
            // Show preview modal
            const previewModal = new bootstrap.Modal(document.getElementById('previewModal'));
            previewModal.show();
            
        } catch (error) {
            console.error('Preview error:', error);
            this.showError('Failed to generate preview: ' + error.message);
        }
    },
    
    // Create Alert NFT preview image - matches actual NFT design from documents.js
    async createAlertNFTPreview() {
        try {
            // Check if PDF.js is loaded for rendering
            if (!window.pdfjsLib) {
                await this.loadPDFJS();
            }

            // Header height matching documents.js
            const HEADER_HEIGHT = 140; // Scaled down for preview (350px at full size)

            // Get the alert preview canvas
            const alertCanvas = document.getElementById('alertPreviewCanvas');
            const ctx = alertCanvas.getContext('2d');

            // Set canvas size
            alertCanvas.width = 400;
            alertCanvas.height = 520;

            // White background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, alertCanvas.width, alertCanvas.height);

            // Draw the BlockServed header (matches documents.js drawBlockServedHeader)
            // Red border around header
            ctx.strokeStyle = '#cc0000';
            ctx.lineWidth = 3;
            ctx.strokeRect(2, 2, alertCanvas.width - 4, HEADER_HEIGHT - 4);

            // Header text
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // LEGAL NOTICE title
            ctx.fillStyle = '#cc0000';
            ctx.font = 'bold 24px Arial';
            ctx.fillText('LEGAL NOTICE', alertCanvas.width / 2, HEADER_HEIGHT * 0.18);

            // Main message
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 16px Arial';
            ctx.fillText('Visit', alertCanvas.width / 2, HEADER_HEIGHT * 0.38);

            // Website - prominent
            ctx.fillStyle = '#0066cc';
            ctx.font = 'bold 20px Arial';
            ctx.fillText('www.BlockServed.com', alertCanvas.width / 2, HEADER_HEIGHT * 0.54);

            // Bottom message
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 14px Arial';
            ctx.fillText('to View Full Document', alertCanvas.width / 2, HEADER_HEIGHT * 0.70);

            // Add issuing agency if available
            if (this.pendingFormData && this.pendingFormData.issuingAgency) {
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 12px Arial';
                ctx.fillText(`From: ${this.pendingFormData.issuingAgency}`, alertCanvas.width / 2, HEADER_HEIGHT * 0.85);
            }

            // Add case number if available
            if (this.pendingFormData && this.pendingFormData.caseNumber) {
                ctx.fillStyle = '#666666';
                ctx.font = 'bold 10px Arial';
                ctx.fillText(`Case: ${this.pendingFormData.caseNumber}`, alertCanvas.width / 2, HEADER_HEIGHT * 0.95);
            }

            // Red separator line between header and document
            ctx.strokeStyle = '#cc0000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(10, HEADER_HEIGHT);
            ctx.lineTo(alertCanvas.width - 10, HEADER_HEIGHT);
            ctx.stroke();

            // Render PDF first page BELOW the header
            const firstFile = this.state.fileQueue[0];
            if (firstFile) {
                const arrayBuffer = await firstFile.file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const page = await pdf.getPage(1);

                // Create temp canvas for PDF rendering
                const viewport = page.getViewport({ scale: 1.0 });
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = viewport.width;
                tempCanvas.height = viewport.height;

                await page.render({
                    canvasContext: tempCtx,
                    viewport: viewport
                }).promise;

                // Scale and draw PDF below header (show top portion)
                const availableHeight = alertCanvas.height - HEADER_HEIGHT;
                const scale = alertCanvas.width / viewport.width;
                const scaledHeight = viewport.height * scale;
                const portionToShow = Math.min(scaledHeight, availableHeight);

                ctx.drawImage(
                    tempCanvas,
                    0, 0, viewport.width, portionToShow / scale,
                    0, HEADER_HEIGHT, alertCanvas.width, portionToShow
                );
            } else {
                // No PDF - show placeholder
                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(10, HEADER_HEIGHT + 10, alertCanvas.width - 20, alertCanvas.height - HEADER_HEIGHT - 20);
                ctx.fillStyle = '#999';
                ctx.font = '14px Arial';
                ctx.fillText('Document preview will appear here', alertCanvas.width / 2, HEADER_HEIGHT + 100);
            }

            // Store the base64 image
            this.alertNFTImage = alertCanvas.toDataURL('image/png', 0.9);
            console.log('Alert NFT preview generated (matches actual NFT design)');
            
        } catch (error) {
            console.error('Alert NFT preview error:', error);
            // Show error in canvas
            const errorCanvas = document.getElementById('alertPreviewCanvas');
            if (errorCanvas) {
                const ctx = errorCanvas.getContext('2d');
                errorCanvas.width = 400;
                errorCanvas.height = 520;
                ctx.fillStyle = '#f8d7da';
                ctx.fillRect(0, 0, errorCanvas.width, errorCanvas.height);
                ctx.fillStyle = '#721c24';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Failed to generate Alert preview', errorCanvas.width / 2, 260);
                ctx.font = '12px Arial';
                ctx.fillText(error.message, errorCanvas.width / 2, 280);
            }
        }
    },
    
    // Load PDF.js library if needed
    async loadPDFJS() {
        if (window.pdfjsLib) return;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                console.log('PDF.js loaded');
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },
    
    // Create merged PDF preview with separators
    async createMergedPDFPreview() {
        try {
            // If we have a consolidated PDF from backend, display it
            if (this.consolidatedPDFUrl) {
                const iframe = document.getElementById('pdfPreviewFrame');
                
                // Add authentication header by appending server address as query param
                const urlWithAuth = this.consolidatedPDFUrl + 
                    (this.consolidatedPDFUrl.includes('?') ? '&' : '?') + 
                    'serverAddress=' + encodeURIComponent(window.tronWeb.defaultAddress.base58);
                
                iframe.src = urlWithAuth;
                console.log('📄 Displaying server-processed consolidated PDF');
                console.log('   URL:', urlWithAuth);
                return;
            }
            
            // Otherwise, try client-side merge as fallback
            // Check if PDFLib is loaded
            if (!window.PDFLib) {
                throw new Error('PDF library not loaded. Please refresh the page.');
            }
            
            const mergedPdf = await PDFLib.PDFDocument.create();
            
            for (let docIndex = 0; docIndex < this.state.fileQueue.length; docIndex++) {
                const fileItem = this.state.fileQueue[docIndex];
                console.log(`Processing document ${docIndex + 1}: ${fileItem.name}`);
                
                const arrayBuffer = await fileItem.file.arrayBuffer();
                let pdf;
                
                try {
                    // Try loading with ignoreEncryption and updateMetadata options
                    pdf = await PDFLib.PDFDocument.load(arrayBuffer, { 
                        ignoreEncryption: true,
                        updateMetadata: false 
                    });
                } catch (loadError) {
                    console.error(`Failed to load ${fileItem.name}:`, loadError);
                    // Add error page for this document
                    const errorPage = mergedPdf.addPage();
                    const { width, height } = errorPage.getSize();
                    const helvetica = await mergedPdf.embedFont(PDFLib.StandardFonts.Helvetica);
                    
                    errorPage.drawText('Failed to load document', {
                        x: width / 2 - 100,
                        y: height / 2,
                        size: 16,
                        font: helvetica,
                        color: PDFLib.rgb(0.8, 0, 0)
                    });
                    
                    errorPage.drawText(fileItem.name, {
                        x: width / 2 - 150,
                        y: height / 2 - 30,
                        size: 12,
                        font: helvetica,
                        color: PDFLib.rgb(0.3, 0.3, 0.3)
                    });
                    
                    continue; // Skip to next document
                }
                
                // Add separator page between documents (except before first document)
                if (docIndex > 0) {
                    const separatorPage = mergedPdf.addPage();
                    const { width, height } = separatorPage.getSize();
                    
                    // Embed font for separator page
                    const helveticaBold = await mergedPdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
                    const helvetica = await mergedPdf.embedFont(PDFLib.StandardFonts.Helvetica);
                    
                    // Draw separator content
                    separatorPage.drawText(`DOCUMENT ${docIndex + 1}`, {
                        x: width / 2 - 100,
                        y: height / 2 + 50,
                        size: 30,
                        font: helveticaBold,
                        color: PDFLib.rgb(0, 0, 0)
                    });
                    
                    separatorPage.drawText(fileItem.name, {
                        x: width / 2 - 150,
                        y: height / 2,
                        size: 14,
                        font: helvetica,
                        color: PDFLib.rgb(0.3, 0.3, 0.3)
                    });
                    
                    // Draw a line using a rectangle
                    separatorPage.drawRectangle({
                        x: 50,
                        y: height / 2 - 30,
                        width: width - 100,
                        height: 2,
                        color: PDFLib.rgb(0.7, 0.7, 0.7)
                    });
                }
                
                // Copy all pages from the document
                try {
                    const pageCount = pdf.getPageCount();
                    console.log(`Document has ${pageCount} pages`);
                    
                    // Try to copy pages one by one to isolate issues
                    for (let pageNum = 0; pageNum < pageCount; pageNum++) {
                        try {
                            const [page] = await mergedPdf.copyPages(pdf, [pageNum]);
                            mergedPdf.addPage(page);
                            console.log(`Successfully copied page ${pageNum + 1}`);
                        } catch (pageError) {
                            console.error(`Failed to copy page ${pageNum + 1}:`, pageError);
                            // Add a placeholder page for the failed page
                            const placeholderPage = mergedPdf.addPage();
                            const { width, height } = placeholderPage.getSize();
                            const helvetica = await mergedPdf.embedFont(PDFLib.StandardFonts.Helvetica);
                            
                            placeholderPage.drawText(`Page ${pageNum + 1} could not be loaded`, {
                                x: width / 2 - 120,
                                y: height / 2,
                                size: 14,
                                font: helvetica,
                                color: PDFLib.rgb(0.5, 0.5, 0.5)
                            });
                            
                            placeholderPage.drawText('(Permission-protected content)', {
                                x: width / 2 - 100,
                                y: height / 2 - 25,
                                size: 12,
                                font: helvetica,
                                color: PDFLib.rgb(0.7, 0.7, 0.7)
                            });
                        }
                    }
                } catch (pageError) {
                    console.error(`Error processing pages from ${fileItem.name}:`, pageError);
                    // Add single error page for entire document
                    const errorPage = mergedPdf.addPage();
                    const { width, height } = errorPage.getSize();
                    const helvetica = await mergedPdf.embedFont(PDFLib.StandardFonts.Helvetica);
                    
                    errorPage.drawText('Document could not be processed', {
                        x: width / 2 - 130,
                        y: height / 2,
                        size: 16,
                        font: helvetica,
                        color: PDFLib.rgb(0.8, 0, 0)
                    });
                    
                    errorPage.drawText(fileItem.name, {
                        x: width / 2 - 150,
                        y: height / 2 - 30,
                        size: 12,
                        font: helvetica,
                        color: PDFLib.rgb(0.3, 0.3, 0.3)
                    });
                    
                    errorPage.drawText('The document may have permission restrictions', {
                        x: width / 2 - 150,
                        y: height / 2 - 55,
                        size: 10,
                        font: helvetica,
                        color: PDFLib.rgb(0.5, 0.5, 0.5)
                    });
                }
            }
            
            // Convert to blob and display in iframe
            const pdfBytes = await mergedPdf.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            // Set iframe source
            const iframe = document.getElementById('pdfPreviewFrame');
            iframe.src = url;
            
            // Store URL for cleanup
            this.previewPdfUrl = url;
            this.state.blobUrls.add(url);
            
        } catch (error) {
            console.error('PDF preview error:', error);
            // Show error in preview
            const iframe = document.getElementById('pdfPreviewFrame');
            iframe.srcdoc = `
                <div style="padding: 20px; text-align: center;">
                    <p style="color: red;">Failed to generate PDF preview</p>
                    <p style="color: #666;">${error.message}</p>
                </div>
            `;
        }
    },
    
    // Check wallet resources from main form
    async checkWalletResourcesMain() {
        // Same as checkWalletResources but can be called from main form
        return this.checkWalletResources();
    },
    
    // Rent energy directly from main form
    async rentEnergyDirect() {
        try {
            // Check if wallet is connected
            if (!window.tronWeb || !window.tronWeb.defaultAddress.base58) {
                this.showError('Please connect your wallet first');
                return;
            }
            
            // Get current energy
            const address = window.tronWeb.defaultAddress.base58;
            const resources = await window.tronWeb.trx.getAccountResources(address);
            const energyTotal = resources.EnergyLimit || 0;
            const energyUsed = resources.EnergyUsed || 0;
            const energyAvailable = energyTotal - energyUsed;
            
            // Calculate document size if files are uploaded
            let totalSizeMB = 0;
            if (this.state.fileQueue && this.state.fileQueue.length > 0) {
                for (const doc of this.state.fileQueue) {
                    totalSizeMB += (doc.file.size / (1024 * 1024));
                }
            } else {
                totalSizeMB = 2.5; // Default estimate
            }
            
            // Show energy rental modal directly
            const isLite = window.contract?.isLiteContract?.() || getCurrentNetwork()?.contractType === 'lite';
            const minEnergy = isLite ? 350000 : 3000000;
            const estimatedEnergy = isLite ? 300000 : Math.max(minEnergy, Math.ceil(totalSizeMB * 1400000));

            if (window.StreamlinedEnergyFlow) {
                window.StreamlinedEnergyFlow.showEnergyModal({
                    currentEnergy: energyAvailable,
                    energyDetails: {
                        total: estimatedEnergy,
                        estimatedTRXBurn: (estimatedEnergy * 0.00042).toFixed(2)
                    },
                    documentSizeMB: totalSizeMB,
                    onComplete: () => {
                        console.log('Energy rental completed');
                        this.showSuccess('Energy rental completed! You can now proceed with creating notices.');
                    }
                });
            } else {
                this.showError('Energy rental system not loaded');
            }
            
        } catch (error) {
            console.error('Error opening energy rental:', error);
            this.showError('Failed to open energy rental: ' + error.message);
        }
    },
    
    // Save current form to case manager
    async saveToCase() {
        try {
            // Check if wallet is connected
            if (!window.tronWeb || !window.tronWeb.defaultAddress.base58) {
                this.showError('Please connect your wallet to save cases');
                return;
            }

            // Validate basic fields
            const caseNumber = document.getElementById('caseNumber')?.value?.trim();
            if (!caseNumber) {
                this.showError('Please enter a case number before saving');
                return;
            }

            // Check if documents are uploaded
            if (!this.state.fileQueue || this.state.fileQueue.length === 0) {
                this.showError('Please upload at least one document before saving');
                return;
            }

            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            const serverAddress = window.tronWeb.defaultAddress.base58;

            // If we already have a currentCaseId, we're updating an existing case
            const isUpdating = !!this.currentCaseId;

            // Show processing modal immediately
            this.showProcessing(
                isUpdating ? 'Updating case...' : 'Saving to Case Manager...',
                'Uploading documents to server...',
                120000
            );

            console.log('📋 saveToCase started:', { caseNumber, serverAddress, isUpdating, fileCount: this.state.fileQueue.length });

            if (!isUpdating) {
                // Only check if case exists when creating new (not updating)

                try {
                    const checkController = new AbortController();
                    const checkTimeout = setTimeout(() => checkController.abort(), 10000);
                    const checkResponse = await fetch(`${backendUrl}/api/cases/by-number/${caseNumber}?serverAddress=${serverAddress}`, {
                        method: 'GET',
                        headers: {
                            'X-Server-Address': serverAddress
                        },
                        signal: checkController.signal
                    }).finally(() => clearTimeout(checkTimeout));

                    console.log('Case check response:', checkResponse.status);

                    if (checkResponse.ok) {
                        const existingCase = await checkResponse.json();
                        if (existingCase.success && existingCase.case) {
                            // Case exists - prompt to resume
                            this.hideProcessing();
                            const shouldResume = confirm(`Case ${caseNumber} already exists. Would you like to resume it instead?\n\nClick OK to resume the existing case, or Cancel to use a different case number.`);

                            if (shouldResume) {
                                // Navigate to cases page and resume
                                this.showInfo('Resuming existing case...');

                                // Store the case data for resuming
                                sessionStorage.setItem('resumeCase', JSON.stringify({
                                    caseNumber: caseNumber,
                                    serverAddress: serverAddress
                                }));

                                // Navigate to cases page
                                window.location.hash = '#cases';

                                // Trigger resume after navigation
                                setTimeout(() => {
                                    if (window.cases && window.cases.resumeCase) {
                                        window.cases.resumeCase(caseNumber);
                                    }
                                }, 500);

                                return;
                            } else {
                                this.showError('Please use a different case number');
                                document.getElementById('caseNumber').focus();
                                return;
                            }
                        }
                    }
                } catch (checkError) {
                    console.log('Case check failed, proceeding with creation:', checkError.message);
                }
            }

            // Create FormData for multipart upload
            const formData = new FormData();

            // Add metadata
            formData.append('caseNumber', caseNumber);
            formData.append('noticeText', document.getElementById('noticeText')?.value || '');
            formData.append('issuingAgency', document.getElementById('issuingAgency')?.value || this.state.agencyName || localStorage.getItem('legalnotice_agency_name') || '');
            formData.append('noticeType', document.getElementById('noticeType')?.value || '');
            formData.append('caseDetails', document.getElementById('caseDetails')?.value || '');
            formData.append('responseDeadline', document.getElementById('responseDeadline')?.value || '');
            formData.append('legalRights', document.getElementById('legalRights')?.value || 'View full notice at www.blockserved.com');
            formData.append('serverAddress', window.tronWeb.defaultAddress.base58);

            // Add recipients as JSON (includes labels)
            const recipients = this.getRecipients();
            formData.append('recipients', JSON.stringify(recipients));

            // Debug: Log what we're sending
            console.log('FormData contents:');
            console.log('- Case number:', caseNumber);
            console.log('- Recipients:', recipients.length);
            console.log('- File count:', this.state.fileQueue.length);

            // Add all PDF files (skip existing backend documents)
            let addedFiles = 0;
            let totalSize = 0;
            for (let i = 0; i < this.state.fileQueue.length; i++) {
                const doc = this.state.fileQueue[i];
                // Skip placeholder/existing documents from backend
                if (doc.isExisting && !doc.file.size) {
                    console.log(`- Skipping placeholder for existing document`);
                    continue;
                }
                formData.append('documents', doc.file, doc.file.name);
                addedFiles++;
                totalSize += doc.file.size;
                console.log(`- Added file ${addedFiles}: ${doc.file.name} (${(doc.file.size / 1024 / 1024).toFixed(2)} MB)`);
            }

            // Check if we actually have files to upload
            if (addedFiles === 0) {
                this.hideProcessing();
                this.showError('No new documents to upload. Please add PDF files or use existing case.');
                return;
            }

            console.log(`📤 Uploading ${addedFiles} file(s), ${(totalSize / 1024 / 1024).toFixed(2)} MB total...`);

            // Save to backend with multipart form data
            const apiUrl = `${backendUrl}/api/cases`;
            console.log('Saving case to:', apiUrl);

            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for large PDF uploads

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'X-Server-Address': serverAddress
                    // Don't set Content-Type, let browser set it for FormData
                },
                body: formData,
                signal: controller.signal
            }).finally(() => {
                clearTimeout(timeoutId);
            });

            console.log('✅ Upload complete, processing response...');
            
            console.log('Response received:', response.status, response.statusText);
            console.log('Response headers:', response.headers.get('content-type'));
            console.log('Response size:', response.headers.get('content-length'), 'bytes');
            
            if (!response.ok) {
                // Try to get error message
                const contentType = response.headers.get('content-type');
                let errorMessage = 'Failed to save case';
                
                if (contentType && contentType.includes('application/json')) {
                    try {
                        const error = await response.json();
                        
                        // Check if case already exists (409 Conflict)
                        if (response.status === 409 || error.error === 'CASE_EXISTS' || error.exists) {
                            const choice = confirm(
                                `Case ${caseNumber} already exists.\n\n` +
                                `Would you like to:\n` +
                                `OK - Resume/amend the existing case\n` +
                                `Cancel - Use a different case number`
                            );
                            
                            if (choice) {
                                // Hide processing modal
                                this.hideProcessing();

                                // Store the existing case data
                                this.currentCaseId = error.caseId || caseNumber;

                                // Show the existing PDFs and allow replacement
                                await this.showExistingCaseDocuments(error.case);

                                this.showSuccess(`Resuming existing case ${caseNumber}`);

                                // Don't proceed yet - let user review and potentially update documents
                                return {
                                    success: false,
                                    resuming: true,
                                    caseId: this.currentCaseId,
                                    case: error.case,
                                    message: 'Review and update documents as needed'
                                };
                            } else {
                                // Hide processing modal
                                this.hideProcessing();

                                // User wants to use a different case number
                                document.getElementById('caseNumber').focus();
                                document.getElementById('caseNumber').select();
                                this.showError('Please use a different case number');
                                return;
                            }
                        }
                        
                        errorMessage = error.message || errorMessage;
                    } catch (e) {
                        // JSON parse failed
                    }
                } else {
                    // Got HTML or other content - likely a 404 or server error
                    const text = await response.text();
                    console.error('Server returned non-JSON response:', text.substring(0, 200));
                    errorMessage = `Server error (${response.status}): ${response.statusText}`;
                }
                
                throw new Error(errorMessage);
            }
            
            // Parse response
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Expected JSON but got:', text.substring(0, 200));
                throw new Error('Server returned invalid response format');
            }
            
            let result;
            try {
                result = await response.json();
                // Log only essential parts to avoid console overflow
                console.log('Save case response:', {
                    success: result.success,
                    caseId: result.caseId,
                    hasPdfInfo: !!result.pdfInfo,
                    hasAlertPreview: !!result.alertPreview,
                    message: result.message
                });
            } catch (parseError) {
                console.error('Failed to parse response:', parseError);
                // If we can't parse the response but got 200, assume success with case number
                if (response.ok) {
                    result = {
                        success: true,
                        caseId: caseNumber,
                        message: 'Case saved (response parse failed)'
                    };
                    console.log('Using fallback result:', result);
                } else {
                    throw new Error('Invalid response from server');
                }
            }
            
            // Check if the backend actually returned a successful response
            if (!result.success) {
                console.error('Backend returned unsuccessful response:', result);
                
                // Check if PDFs need manual conversion
                if (result.error === 'PDF_CONVERSION_REQUIRED' || result.requiresManualConversion) {
                    // Show detailed instructions in a modal or alert
                    const instructions = result.message || 'Some PDFs require manual conversion';
                    
                    // Create a detailed error modal
                    const modal = document.createElement('div');
                    modal.className = 'modal fade show';
                    modal.style.display = 'block';
                    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
                    modal.innerHTML = `
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content">
                                <div class="modal-header bg-warning text-dark">
                                    <h5 class="modal-title">
                                        <i class="bi bi-exclamation-triangle"></i> PDF Conversion Required
                                    </h5>
                                </div>
                                <div class="modal-body">
                                    <div class="alert alert-warning">
                                        <strong>Your PDFs need to be converted before they can be processed.</strong>
                                    </div>
                                    <pre style="white-space: pre-wrap; font-family: inherit;">${instructions}</pre>
                                    <hr>
                                    <h6>Why is this needed?</h6>
                                    <p>Some PDFs have encryption or corruption that prevents automatic processing. 
                                    Using your browser's Print-to-PDF feature creates a clean, processable version 
                                    while preserving the visual content.</p>
                                </div>
                                <div class="modal-footer">
                                    <button class="btn btn-primary" onclick="this.closest('.modal').remove()">
                                        I'll Convert and Re-upload
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);
                    
                    // Clear the file queue so user can upload converted files
                    this.state.fileQueue = [];
                    this.updateFileQueueDisplay();
                    
                    throw new Error('Please convert your PDFs using Print-to-PDF and re-upload them');
                }
                
                throw new Error(result.error || 'Case save failed');
            }
            
            // Store case ID for later use - backend returns caseId
            this.currentCaseId = result.caseId || result.id || caseNumber;
            
            // Always construct the PDF URL for consistency
            this.consolidatedPDFUrl = `${backendUrl}/api/cases/${this.currentCaseId}/pdf`;
            console.log('✅ Case saved/updated successfully');
            console.log('   Case ID:', this.currentCaseId);
            console.log('   Server Address:', serverAddress);
            console.log('   PDF URL:', this.consolidatedPDFUrl);
            console.log('   Full result:', result);
            
            // Also save to local storage as backup
            const caseData = {
                caseNumber: this.currentCaseId,
                serverAddress: serverAddress,
                createdAt: Date.now(),
                metadata: {
                    caseNumber: caseNumber,
                    noticeText: document.getElementById('noticeText')?.value,
                    issuingAgency: document.getElementById('issuingAgency')?.value,
                    noticeType: document.getElementById('noticeType')?.value,
                    recipients: recipients
                },
                status: 'draft'
            };
            
            // Store in local storage
            const existingCases = window.storage.get('cases') || [];
            const existingIndex = existingCases.findIndex(c => c.caseNumber === this.currentCaseId);
            if (existingIndex >= 0) {
                existingCases[existingIndex] = caseData;
            } else {
                existingCases.push(caseData);
            }
            window.storage.set('cases', existingCases);
            console.log('   Also saved to local storage');
            
            // Mark that we now have the consolidated PDF ready
            this.hasConsolidatedPDF = true;

            // Hide processing modal
            this.hideProcessing();

            // Show success message with case ID
            this.showSuccess(`Case "${this.currentCaseId}" saved successfully! PDFs cleaned and consolidated on server.`);
            
            // Optionally refresh the cases list if on cases page
            if (window.cases) {
                await window.cases.loadCases();
            }
            
            return result;
            
        } catch (error) {
            // Hide processing modal on error
            this.hideProcessing();

            console.error('Error saving to case manager:', error);
            console.error('Current state:', {
                currentCaseId: this.currentCaseId,
                consolidatedPDFUrl: this.consolidatedPDFUrl,
                fileQueue: this.state.fileQueue.length
            });

            // Clear any partial state on error
            this.currentCaseId = null;
            this.consolidatedPDFUrl = null;
            this.hasConsolidatedPDF = false;
            
            this.showError('Failed to save case: ' + error.message);
        }
    },
    
    // Process documents for case creation
    async processDocumentsForCase() {
        try {
            if (!this.state.fileQueue || this.state.fileQueue.length === 0) {
                return null;
            }
            
            // Load PDF-lib if not loaded
            if (!window.PDFLib) {
                await this.loadPDFLib();
            }
            
            // Merge all PDFs into one
            const mergedPdf = await PDFLib.PDFDocument.create();
            
            for (const doc of this.state.fileQueue) {
                const arrayBuffer = await doc.file.arrayBuffer();
                // Load with ignoreEncryption to handle protected PDFs
                const pdf = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                pages.forEach(page => mergedPdf.addPage(page));
            }
            
            const mergedBytes = await mergedPdf.save();
            const mergedBlob = new Blob([mergedBytes], { type: 'application/pdf' });
            
            // Generate Alert NFT preview (first page with overlay)
            const alertPreview = await this.generateAlertPreview(mergedBytes);
            
            return {
                mergedPDF: mergedBlob,
                alertPreview: alertPreview
            };
            
        } catch (error) {
            console.error('Error processing documents:', error);
            return null;
        }
    },
    
    // Generate alert preview for case
    async generateAlertPreview(pdfBytes) {
        try {
            // Load PDF.js if needed
            await this.loadPDFJS();
            
            // Create canvas for first page
            const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
            const page = await pdf.getPage(1);
            
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            // Render first page
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            // Add overlay
            const overlayHeight = 100;
            const gradient = context.createLinearGradient(0, 0, 0, overlayHeight);
            gradient.addColorStop(0, 'rgba(255, 215, 0, 0.7)');
            gradient.addColorStop(1, 'rgba(255, 215, 0, 0.5)');
            
            context.fillStyle = gradient;
            context.fillRect(0, 0, canvas.width, overlayHeight);
            
            // Add text
            context.fillStyle = '#8B0000';
            context.font = 'bold 36px Arial';
            context.textAlign = 'center';
            context.fillText('LEGAL NOTICE', canvas.width / 2, 45);
            
            context.fillStyle = '#000';
            context.font = '18px Arial';
            context.fillText('www.blockserved.com', canvas.width / 2, 75);
            
            // Convert to base64
            return canvas.toDataURL('image/png');
            
        } catch (error) {
            console.error('Error generating alert preview:', error);
            return null;
        }
    },
    
    // Check wallet resources
    async checkWalletResources() {
        try {
            // Show the modal
            const modal = new bootstrap.Modal(document.getElementById('walletResourcesModal'));
            modal.show();
            
            // Get wallet info
            if (!window.tronWeb || !window.tronWeb.defaultAddress.base58) {
                document.getElementById('walletResourcesContent').innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle"></i> Please connect your wallet first
                    </div>
                `;
                return;
            }
            
            const address = window.tronWeb.defaultAddress.base58;
            const account = await window.tronWeb.trx.getAccount(address);
            const resources = await window.tronWeb.trx.getAccountResources(address);
            
            // Calculate energy and bandwidth
            const balance = account.balance ? (account.balance / 1e6).toFixed(2) : '0.00';
            const energyTotal = resources.EnergyLimit || 0;
            const energyUsed = resources.EnergyUsed || 0;
            const energyAvailable = energyTotal - energyUsed;
            const bandwidthTotal = resources.freeNetLimit + (resources.NetLimit || 0);
            const bandwidthUsed = resources.freeNetUsed + (resources.NetUsed || 0);
            const bandwidthAvailable = bandwidthTotal - bandwidthUsed;
            
            // Minimum recommended energy - Lite contract needs ~300K, V5 needs ~3M
            const isLiteContract = window.contract?.isLiteContract?.() || getCurrentNetwork()?.contractType === 'lite';
            const MINIMUM_ENERGY = isLiteContract ? 350000 : 3000000; // 350K for Lite, 3M for V5
            const energySufficient = energyAvailable >= MINIMUM_ENERGY;

            // Calculate estimated energy based on recipients
            const recipientCount = document.querySelectorAll('.recipient-input').length || 1;
            const estimatedEnergyNeeded = isLiteContract
                ? recipientCount * 300000  // ~300K per serve for Lite
                : Math.max(MINIMUM_ENERGY, recipientCount * 1500000); // ~1.5M per recipient for V5
            
            // Display resources
            document.getElementById('walletResourcesContent').innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="mb-0">Wallet Resources</h6>
                    <button class="btn btn-sm btn-outline-primary" onclick="app.checkWalletResources()">
                        <i class="bi bi-arrow-clockwise"></i> Refresh
                    </button>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="card mb-3">
                            <div class="card-body">
                                <h6 class="card-title text-primary">
                                    <i class="bi bi-wallet2"></i> TRX Balance
                                </h6>
                                <p class="card-text fs-4">${balance} TRX</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card mb-3">
                            <div class="card-body">
                                <h6 class="card-title text-info">
                                    <i class="bi bi-hdd-network"></i> Bandwidth
                                </h6>
                                <p class="card-text fs-4">${bandwidthAvailable.toLocaleString()} / ${bandwidthTotal.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card ${energySufficient ? 'border-success' : 'border-danger'}">
                    <div class="card-body">
                        <h6 class="card-title ${energySufficient ? 'text-success' : 'text-danger'}">
                            <i class="bi bi-lightning-charge"></i> Energy Status
                        </h6>
                        <div class="row">
                            <div class="col-md-6">
                                <p class="mb-2"><strong>Available Energy:</strong> ${energyAvailable.toLocaleString()}</p>
                                <p class="mb-2"><strong>Total Energy:</strong> ${energyTotal.toLocaleString()}</p>
                            </div>
                            <div class="col-md-6">
                                <p class="mb-2"><strong>Recommended Minimum:</strong> ${MINIMUM_ENERGY.toLocaleString()}</p>
                                <p class="mb-2"><strong>Estimated Needed:</strong> ${estimatedEnergyNeeded.toLocaleString()}</p>
                            </div>
                        </div>
                        
                        ${!energySufficient ? `
                            <div class="alert alert-warning mt-3">
                                <i class="bi bi-exclamation-triangle"></i> 
                                <strong>Insufficient Energy!</strong><br>
                                You need at least ${MINIMUM_ENERGY.toLocaleString()} energy to mint NFTs.<br>
                                Current deficit: ${(MINIMUM_ENERGY - energyAvailable).toLocaleString()} energy
                            </div>
                            <div class="alert alert-info">
                                <i class="bi bi-info-circle"></i> 
                                <strong>Options:</strong><br>
                                1. Rent energy using the button below (recommended)<br>
                                2. Freeze TRX for energy (takes 14 days to unfreeze)<br>
                                3. Wait for energy to regenerate (24 hours)
                            </div>
                        ` : `
                            <div class="alert alert-success mt-3">
                                <i class="bi bi-check-circle"></i> 
                                <strong>Sufficient Energy!</strong><br>
                                You have enough energy to proceed with minting.
                            </div>
                        `}
                    </div>
                </div>
            `;
            
            // Show/hide rent energy button
            const rentBtn = document.getElementById('rentEnergyBtn');
            if (!energySufficient) {
                rentBtn.style.display = 'block';
                // Store energy details for rental
                this.energyDeficit = MINIMUM_ENERGY - energyAvailable;
                this.currentEnergy = energyAvailable;
                this.estimatedEnergyNeeded = estimatedEnergyNeeded;
            } else {
                rentBtn.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Error checking wallet resources:', error);
            document.getElementById('walletResourcesContent').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Error checking wallet resources: ${error.message}
                </div>
            `;
        }
    },
    
    // Open energy rental modal
    async openEnergyRental() {
        try {
            // Close resources modal
            const resourcesModal = bootstrap.Modal.getInstance(document.getElementById('walletResourcesModal'));
            resourcesModal.hide();
            
            // Calculate document size
            let totalSizeMB = 0;
            if (this.state.fileQueue && this.state.fileQueue.length > 0) {
                for (const doc of this.state.fileQueue) {
                    totalSizeMB += (doc.file.size / (1024 * 1024));
                }
            } else {
                totalSizeMB = 2.5; // Default estimate
            }
            
            // Show streamlined energy rental
            const isLiteContract = window.contract?.isLiteContract?.() || getCurrentNetwork()?.contractType === 'lite';
            const defaultEnergy = isLiteContract ? 350000 : 3000000;
            const neededEnergy = this.estimatedEnergyNeeded || defaultEnergy;

            if (window.StreamlinedEnergyFlow) {
                window.StreamlinedEnergyFlow.showEnergyModal({
                    currentEnergy: this.currentEnergy || 0,
                    energyDetails: {
                        total: neededEnergy,
                        estimatedTRXBurn: (neededEnergy * 0.00042).toFixed(2)
                    },
                    documentSizeMB: totalSizeMB,
                    onComplete: () => {
                        console.log('Energy rental completed');
                        this.showSuccess('Energy rental completed! You can now proceed with minting.');
                    }
                });
            } else {
                throw new Error('Energy rental system not loaded');
            }
            
        } catch (error) {
            console.error('Error opening energy rental:', error);
            this.showError('Failed to open energy rental: ' + error.message);
        }
    },
    
    // Confirm and mint NFTs
    async confirmAndMint() {
        try {
            // Close preview modal
            const previewModal = bootstrap.Modal.getInstance(document.getElementById('previewModal'));
            previewModal.hide();
            
            // Clean up preview PDF URL
            if (this.previewPdfUrl) {
                URL.revokeObjectURL(this.previewPdfUrl);
                this.previewPdfUrl = null;
            }
            
            // Use stored form data
            if (!this.pendingFormData) {
                this.showError('No pending notice data found');
                return;
            }
            
            // Process the notice
            await this.processNotice(this.pendingFormData);
            
        } catch (error) {
            console.error('Mint error:', error);
            this.showError('Failed to mint NFTs: ' + error.message);
        }
    },
    
    // Process notice (factored out from handleServeSubmit)
    async processNotice(formData) {
        try {
            // Validate form data
            if (!this.validateServeForm(formData)) {
                return;
            }
            
            // Check wallet connection
            if (!this.state.walletConnected) {
                this.showError('Please connect your wallet first');
                return;
            }
            
            const recipientCount = formData.recipients.length;
            // Check if using Lite contract (1 NFT per serve) or V5 (2 NFTs per serve)
            const isLiteContract = window.contract?.isLiteContract?.() ||
                window.getCurrentNetwork?.()?.contractType === 'lite';
            const nftsPerRecipient = isLiteContract ? 1 : 2;
            const totalNFTs = recipientCount * nftsPerRecipient;
            this.showProcessing(`Minting ${totalNFTs} NFT${totalNFTs > 1 ? 's' : ''} for ${recipientCount} recipient${recipientCount > 1 ? 's' : ''}...`);
            
            // Create notice through notices module
            if (window.notices) {
                const result = await window.notices.createNotice(formData);
                
                if (result.success) {
                    this.hideProcessing();
                    this.showSuccess('Notice created successfully!');
                    
                    // Clear form
                    document.getElementById('serveForm').reset();
                    this.clearFileQueue();
                    
                    // Clear pending data
                    this.pendingFormData = null;
                    
                    // Store receipt
                    if (window.receipts) {
                        window.receipts.addReceipt(result.receipt);
                    }
                    
                    // Navigate to receipts page
                    this.navigate('receipts');
                } else {
                    throw new Error(result.error || 'Failed to create notice');
                }
            } else {
                throw new Error('Notices module not loaded');
            }
        } catch (error) {
            this.hideProcessing();
            this.showError(error.message);
        }
    },

    // Handle serve form submission with validation
    async handleServeSubmit() {
        // Prevent multiple submissions
        if (this.state.processing) {
            this.showWarning('Please wait for the current operation to complete');
            return;
        }
        
        try {
            this.state.processing = true;
            
            // Trigger preview with validation
            await this.previewNotice();
            
        } catch (error) {
            console.error('Form submission error:', error);
            this.showError('Failed to process form: ' + error.message);
        } finally {
            this.state.processing = false;
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

        // Validate each recipient address (handles both string and {address, label} formats)
        for (const recipient of data.recipients) {
            const address = typeof recipient === 'string' ? recipient : recipient.address;
            if (!address || !address.startsWith('T') || address.length !== 34) {
                const label = typeof recipient === 'object' && recipient.label ? ` (${recipient.label})` : '';
                this.showError(`Invalid TRON address${label}: ${address || 'empty'}`);
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
    processingTimeout: null,

    showProcessing(message, details = '', maxDuration = 30000) {
        // Clear any existing timeout
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
            this.processingTimeout = null;
        }

        const modal = document.getElementById('processingModal');
        const messageEl = document.getElementById('processingMessage');
        const detailsEl = document.getElementById('processingDetails');

        if (messageEl) messageEl.textContent = message;
        if (detailsEl) detailsEl.textContent = details;

        if (modal) {
            // Reuse existing instance or create new one
            let bsModal = bootstrap.Modal.getInstance(modal);
            if (!bsModal) {
                bsModal = new bootstrap.Modal(modal, {
                    backdrop: 'static',
                    keyboard: false
                });
            }
            bsModal.show();

            // Safety timeout - auto-hide after maxDuration to prevent stuck modals
            this.processingTimeout = setTimeout(() => {
                console.warn('Processing modal auto-hidden after timeout');
                this.hideProcessing();
            }, maxDuration);
        }
    },

    hideProcessing() {
        // Clear timeout
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
            this.processingTimeout = null;
        }

        const modal = document.getElementById('processingModal');
        if (modal) {
            try {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) {
                    bsModal.hide();
                }
            } catch (e) {
                console.error('Error hiding modal via Bootstrap:', e);
            }

            // Force cleanup - remove backdrop and modal-open class
            setTimeout(() => {
                const backdrops = document.querySelectorAll('.modal-backdrop');
                backdrops.forEach(backdrop => backdrop.remove());
                document.body.classList.remove('modal-open');
                document.body.style.removeProperty('padding-right');
                document.body.style.removeProperty('overflow');
                modal.classList.remove('show');
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }, 150);
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
    
    // Format TRX amount
    formatTRX(amount) {
        return (amount / 1e6).toFixed(2);
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

    // Switch wallet - prompts user to switch in TronLink
    async switchWallet() {
        // Show instructions to user
        this.showInfo('Please switch your wallet in TronLink, then the page will refresh automatically.');

        // Reset current connection state
        this.state.walletConnected = false;
        this.state.userAddress = null;

        // Show connect button again
        document.getElementById('connectWallet').style.display = 'block';
        const dropdown = document.getElementById('walletDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }

        // Try to trigger TronLink account selection
        if (window.tronLink) {
            try {
                // Request accounts again - this may prompt the user to select an account
                await window.tronLink.request({ method: 'tron_requestAccounts' });
            } catch (e) {
                console.log('TronLink request during switch:', e);
            }
        }
    },

    // Disconnect wallet
    disconnectWallet() {
        // Reset app state
        this.state.walletConnected = false;
        this.state.isRegisteredServer = false;
        this.state.userAddress = null;
        this.state.agencyName = null;
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

        // Update UI for role (in case page doesn't reload)
        this.updateUIForRole();
    },

    // Set up drag and drop
    setupDragAndDrop() {
        console.log('Setting up drag and drop...');
        
        const dropZone = document.getElementById('dropZone');
        if (!dropZone) return;
        
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            document.body.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        // Highlight drop zone when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-hover');
                dropZone.style.backgroundColor = '#e3f2fd';
                dropZone.style.borderColor = '#2196f3';
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-hover');
                dropZone.style.backgroundColor = '#f8f9fa';
                dropZone.style.borderColor = '#dee2e6';
            });
        });
        
        // Handle dropped files
        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFileSelect(files);
        });
        
        // Also make the drop zone clickable (but not if clicking the browse button or file input)
        dropZone.addEventListener('click', (e) => {
            // Don't trigger if clicking on the button, file input, or any interactive element
            if (e.target.closest('button') || 
                e.target.closest('#fileInput') || 
                e.target.closest('label[for="fileInput"]')) {
                return; // Let the button's own onclick handle it
            }
            
            // Otherwise, trigger file selection
            e.preventDefault();
            const fileInput = document.getElementById('fileInput');
            if (fileInput) {
                fileInput.click();
            }
        });
    },
    
    // Handle file selection
    handleFileSelect(files) {
        // Debounce to prevent double processing
        if (this.fileSelectTimeout) {
            clearTimeout(this.fileSelectTimeout);
        }
        
        this.fileSelectTimeout = setTimeout(() => {
            // Filter for PDF files only
            const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
            
            if (pdfFiles.length === 0) {
                this.showError('Please select PDF files only');
                return;
            }
            
            // Add files to queue
            let filesAdded = 0;
            pdfFiles.forEach(file => {
                // Check if file already exists in queue
                if (!this.state.fileQueue.find(f => f.name === file.name && f.size === file.size)) {
                    this.state.fileQueue.push({
                        file: file,
                        name: file.name,
                        size: file.size,
                        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    });
                    filesAdded++;
                }
            });
            
            // Update display
            this.displayFileQueue();
            
            // Show success message if files were added
            if (filesAdded > 0) {
                this.showSuccess(`Added ${filesAdded} file${filesAdded > 1 ? 's' : ''} to queue`);
            }
        }, 50); // Small delay to debounce
    },
    
    // Display file queue
    displayFileQueue() {
        const fileQueue = document.getElementById('fileQueue');
        const fileList = document.getElementById('fileList');
        const fileCount = document.getElementById('fileCount');
        const dropZone = document.getElementById('dropZone');
        
        if (this.state.fileQueue.length === 0) {
            fileQueue.style.display = 'none';
            dropZone.style.display = 'block';
            return;
        }
        
        // Show queue, minimize drop zone
        fileQueue.style.display = 'block';
        dropZone.style.display = 'block';
        dropZone.style.padding = '1rem';
        
        // Update count
        if (fileCount) {
            fileCount.textContent = this.state.fileQueue.length;
        }
        
        // Clear and rebuild list
        fileList.innerHTML = '';
        
        this.state.fileQueue.forEach((fileItem, index) => {
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            item.draggable = !fileItem.isExisting; // Don't allow dragging existing documents
            item.dataset.fileId = fileItem.id || Date.now();
            
            // Special handling for existing documents
            if (fileItem.isExisting) {
                const displayName = fileItem.fromBackend ? fileItem.name : 'Existing Case Documents';
                const displaySize = fileItem.fromBackend ? this.formatFileSize(fileItem.size) : 'Previously uploaded documents';
                
                item.innerHTML = `
                    <div class="d-flex align-items-center">
                        <i class="bi bi-file-earmark-pdf-fill text-primary me-2"></i>
                        <div>
                            <strong>${displayName}</strong>
                            <small class="text-muted d-block">${displaySize}</small>
                        </div>
                    </div>
                    <div>
                        <span class="badge bg-info me-2">From Backend</span>
                        ${this.currentCaseId ? `
                            <a href="${getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com'}/api/cases/${this.currentCaseId}/pdf?serverAddress=${window.wallet?.address}" 
                               target="_blank" class="btn btn-sm btn-primary me-2">
                                <i class="bi bi-eye"></i> View
                            </a>
                        ` : ''}
                        <button type="button" class="btn btn-sm btn-warning" onclick="app.clearExistingDocuments()">
                            <i class="bi bi-arrow-repeat"></i> Replace
                        </button>
                    </div>
                `;
            } else {
                item.innerHTML = `
                    <div class="d-flex align-items-center">
                        <svg width="20" height="20" fill="#6c757d" class="me-2" style="cursor: move;">
                            <path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <div>
                            <strong>${fileItem.name}</strong>
                            <small class="text-muted d-block">${this.formatFileSize(fileItem.size)}</small>
                        </div>
                    </div>
                    <div>
                        ${index === 0 ? '<span class="badge bg-primary me-2">First Page = Thumbnail</span>' : ''}
                        <button type="button" class="btn btn-sm btn-outline-danger" onclick="app.removeFile('${fileItem.id}')">
                            Remove
                        </button>
                    </div>
                `;
            }
            
            // Add drag event listeners
            item.addEventListener('dragstart', (e) => this.handleDragStart(e, fileItem));
            item.addEventListener('dragover', (e) => this.handleDragOver(e));
            item.addEventListener('drop', (e) => this.handleDrop(e));
            item.addEventListener('dragend', (e) => this.handleDragEnd(e));
            
            fileList.appendChild(item);
        });
        
        // Update the hidden input for form validation
        const documentFile = document.getElementById('documentFile');
        if (documentFile) {
            documentFile.value = 'files-selected';
        }
        
        // Update fee calculation
        this.updateFeeCalculation();
    },
    
    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },
    
    // Remove file from queue
    removeFile(fileId) {
        this.state.fileQueue = this.state.fileQueue.filter(f => f.id !== fileId);
        this.displayFileQueue();
    },
    
    // Clear file queue
    clearFileQueue() {
        this.state.fileQueue = [];
        this.displayFileQueue();
        
        // Reset file input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }
        
        // Reset hidden input
        const documentFile = document.getElementById('documentFile');
        if (documentFile) {
            documentFile.value = '';
        }
    },
    
    // Drag and drop reordering handlers
    handleDragStart(e, fileItem) {
        this.draggedItem = fileItem;
        e.dataTransfer.effectAllowed = 'move';
        e.target.style.opacity = '0.5';
    },
    
    handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        
        const afterElement = this.getDragAfterElement(document.getElementById('fileList'), e.clientY);
        const draggingElement = document.querySelector('[style*="opacity: 0.5"]');
        
        if (afterElement == null) {
            document.getElementById('fileList').appendChild(draggingElement);
        } else {
            document.getElementById('fileList').insertBefore(draggingElement, afterElement);
        }
        
        return false;
    },
    
    handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        
        if (!this.draggedItem) return false;
        
        // Reorder the fileQueue array based on the new DOM order
        const fileList = document.getElementById('fileList');
        const newOrder = [];
        fileList.querySelectorAll('[data-file-id]').forEach(item => {
            const fileId = item.dataset.fileId;
            const fileItem = this.state.fileQueue.find(f => f.id === fileId);
            if (fileItem) {
                newOrder.push(fileItem);
            }
        });
        
        this.state.fileQueue = newOrder;
        this.displayFileQueue();
        
        return false;
    },
    
    handleDragEnd(e) {
        e.target.style.opacity = '';
        this.draggedItem = null;
    },
    
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.list-group-item:not([style*="opacity: 0.5"])')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },
    
    // Cached fee configuration
    feeConfig: null,

    // Load fee configuration from contract
    async loadFeeConfig() {
        try {
            if (window.contract && window.contract.getFeeConfig) {
                this.feeConfig = await window.contract.getFeeConfig();
                console.log('Fee config loaded:', this.feeConfig);

                // Update admin display if on admin page
                const configDisplay = document.getElementById('currentFeeConfigDisplay');
                if (configDisplay) {
                    configDisplay.innerHTML = `
                        Service Fee: ${this.feeConfig.serviceFeeInTRX} TRX<br>
                        Recipient Sponsorship: ${this.feeConfig.recipientFundingInTRX} TRX<br>
                        <strong>Total per Notice: ${this.feeConfig.totalPerNoticeInTRX} TRX</strong>
                    `;
                }

                // Update input placeholders
                const serviceFeeInput = document.getElementById('newServiceFee');
                const recipientFundingInput = document.getElementById('newRecipientFunding');
                if (serviceFeeInput) serviceFeeInput.placeholder = `Current: ${this.feeConfig.serviceFeeInTRX} TRX`;
                if (recipientFundingInput) recipientFundingInput.placeholder = `Current: ${this.feeConfig.recipientFundingInTRX} TRX`;
            }
        } catch (error) {
            console.warn('Could not load fee config:', error);
            // Use defaults
            this.feeConfig = {
                serviceFee: 10000000,
                recipientFunding: 20000000,
                totalPerNotice: 30000000,
                serviceFeeInTRX: 10,
                recipientFundingInTRX: 20,
                totalPerNoticeInTRX: 30
            };
        }

        // Update the fee display
        this.updateFeeCalculation();
    },

    // Update fee calculation based on recipients
    updateFeeCalculation() {
        const recipientInputs = document.querySelectorAll('.recipient-input');
        const recipientCount = recipientInputs.length;

        // Use loaded fee config or defaults
        const serviceFee = this.feeConfig?.serviceFeeInTRX || 10;
        const recipientFunding = this.feeConfig?.recipientFundingInTRX || 20;
        const totalPerRecipient = this.feeConfig?.totalPerNoticeInTRX || 30;

        // Update UI elements
        const recipientCountEl = document.getElementById('recipientCount');
        const serviceFeeEl = document.getElementById('serviceFeeDisplay');
        const recipientFundingEl = document.getElementById('recipientFundingDisplay');
        const perRecipientFeeEl = document.getElementById('perRecipientFee');
        const totalFeeEl = document.getElementById('totalFee');
        const energyEstimateEl = document.getElementById('energyEstimate');

        if (recipientCountEl) recipientCountEl.textContent = recipientCount;
        if (serviceFeeEl) serviceFeeEl.textContent = serviceFee;
        if (recipientFundingEl) recipientFundingEl.textContent = recipientFunding;
        if (perRecipientFeeEl) perRecipientFeeEl.textContent = totalPerRecipient;
        if (totalFeeEl) totalFeeEl.textContent = recipientCount * totalPerRecipient;
        if (energyEstimateEl) energyEstimateEl.textContent = (recipientCount * 140000).toLocaleString();
    },
    
    // Handle account change from wallet
    handleAccountChange(newAddress) {
        console.log('Account changed to:', newAddress);
        this.state.userAddress = newAddress;

        // Update UI
        this.updateWalletUI(newAddress);

        // Reload page data
        this.loadPageData(this.state.currentPage);
    },
    
    // Validation and Sanitization Methods
    
    // Sanitize input to prevent XSS
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
    },
    
    // Validate TRON address
    validateTronAddress(address) {
        if (!address || typeof address !== 'string') return false;
        
        address = address.trim();
        
        // TRON addresses start with T and are 34 characters long
        if (!address.startsWith('T') || address.length !== 34) return false;
        
        // Check for valid base58 characters
        const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
        return base58Regex.test(address.substring(1));
    },
    
    // Validate PDF file
    async validatePDF(file) {
        if (!file) {
            return { valid: false, error: 'No file provided' };
        }
        
        // Check file type
        if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
            return { valid: false, error: 'File must be a PDF' };
        }
        
        // Check file size (50MB limit)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            return { valid: false, error: `File size exceeds ${maxSize / 1024 / 1024}MB limit` };
        }
        
        // Check if file is empty
        if (file.size === 0) {
            return { valid: false, error: 'File is empty' };
        }
        
        // Check PDF header
        try {
            const arrayBuffer = await file.slice(0, 5).arrayBuffer();
            const header = new TextDecoder().decode(arrayBuffer);
            
            if (!header.startsWith('%PDF-')) {
                return { valid: false, error: 'Invalid PDF file structure' };
            }
            
            return { valid: true, file: file };
        } catch (error) {
            return { valid: false, error: 'Could not validate PDF structure' };
        }
    },
    
    // Show warning message
    showWarning(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-warning alert-dismissible fade show position-fixed';
        alert.style.cssText = 'top: 80px; right: 20px; z-index: 9999; max-width: 400px;';
        alert.innerHTML = `
            ${this.sanitizeInput(message)}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alert);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            alert.remove();
        }, 5000);
    },
    
    // Show error message
    showError(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger alert-dismissible fade show position-fixed';
        alert.style.cssText = 'top: 80px; right: 20px; z-index: 9999; max-width: 400px;';
        alert.innerHTML = `
            ${this.sanitizeInput(message)}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alert);
        
        // Auto-dismiss after 7 seconds
        setTimeout(() => {
            alert.remove();
        }, 7000);
    },
    
    // Show success message
    showSuccess(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
        alert.style.cssText = 'top: 80px; right: 20px; z-index: 9999; max-width: 400px;';
        alert.innerHTML = `
            ${this.sanitizeInput(message)}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alert);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            alert.remove();
        }, 5000);
    },
    
    // Show processing modal (delegate to main implementation)
    // Note: Primary implementation is above - this is kept for compatibility

    // Show existing case documents when resuming
    async showExistingCaseDocuments(caseData) {
        try {
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            
            // Store the consolidated PDF URL
            if (caseData.pdf_path) {
                this.consolidatedPDFUrl = `${backendUrl}/api/cases/${caseData.id}/pdf`;
            }
            
            // Update the file upload area to show existing documents
            const fileUploadDiv = document.getElementById('fileUpload');
            if (fileUploadDiv) {
                // Add a section showing existing documents
                const existingDocsHTML = `
                    <div class="alert alert-info mb-3" id="existingDocsAlert">
                        <h5>📁 Existing Case Documents</h5>
                        <p>This case already has documents uploaded. You can:</p>
                        <ul>
                            <li>Keep the existing documents and continue</li>
                            <li>Replace them by uploading new PDFs</li>
                        </ul>
                        ${caseData.pdf_path ? `
                            <div class="mt-3">
                                <a href="${backendUrl}/api/cases/${caseData.id}/pdf?serverAddress=${window.wallet?.address}" 
                                   target="_blank" class="btn btn-sm btn-primary">
                                    <i class="bi bi-file-pdf"></i> View Existing Documents
                                </a>
                                <button onclick="app.clearExistingDocuments()" class="btn btn-sm btn-warning ms-2">
                                    <i class="bi bi-trash"></i> Clear & Upload New
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `;
                
                // Insert before the file input
                const fileInput = fileUploadDiv.querySelector('input[type="file"]');
                if (fileInput && fileInput.parentElement) {
                    // Remove any existing alert first
                    const existing = document.getElementById('existingDocsAlert');
                    if (existing) existing.remove();
                    
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = existingDocsHTML;
                    fileInput.parentElement.insertBefore(tempDiv.firstElementChild, fileInput.parentElement.firstChild);
                }
                
                // Set a flag that we have existing documents
                this.hasExistingDocuments = true;
                
                // Add a placeholder to the file queue
                this.state.fileQueue = [{
                    file: new File(['existing'], 'Existing case documents.pdf', { type: 'application/pdf' }),
                    preview: null,
                    isExisting: true
                }];
                
                // Update file list display
                this.displayFileQueue();
            }
            
        } catch (error) {
            console.error('Error showing existing documents:', error);
            this.showError('Failed to load existing documents');
        }
    },
    
    // Clear existing documents and allow new upload
    clearExistingDocuments() {
        this.hasExistingDocuments = false;
        this.consolidatedPDFUrl = null;
        // Don't clear currentCaseId - we're still working with the same case
        // Just replacing its documents
        this.state.fileQueue = [];
        this.displayFileQueue();
        
        // Remove the existing documents alert
        const existingAlert = document.getElementById('existingDocsAlert');
        if (existingAlert) {
            existingAlert.remove();
        }
        
        // Re-enable the file input
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.disabled = false;
        }
        
        this.showInfo('Existing documents cleared. Please upload new PDFs.');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});