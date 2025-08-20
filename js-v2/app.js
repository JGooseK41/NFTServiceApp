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
                recipients: Array.from(document.querySelectorAll('.recipient-input'))
                    .map(input => input.value)
                    .filter(v => v),
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
                
                // Restore recipients
                if (data.recipients && data.recipients.length > 0) {
                    data.recipients.forEach((recipient, index) => {
                        if (index > 0) this.addRecipientField();
                        const inputs = document.querySelectorAll('.recipient-input');
                        if (inputs[index]) inputs[index].value = recipient;
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
                    document.getElementById('connectWallet').style.display = 'none';
                    const addressElement = document.getElementById('walletAddress');
                    if (addressElement) {
                        addressElement.textContent = this.formatAddress(this.state.userAddress);
                        addressElement.style.display = 'inline';
                    }
                    
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
                document.getElementById('connectWallet').style.display = 'none';
                const addressElement = document.getElementById('walletAddress');
                if (addressElement) {
                    addressElement.textContent = this.formatAddress(this.state.userAddress);
                    addressElement.style.display = 'inline';
                }
                
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
    
    // Get all recipient addresses from the form
    getRecipientAddresses() {
        const recipientInputs = document.querySelectorAll('.recipient-input');
        const addresses = [];
        
        recipientInputs.forEach(input => {
            const value = input.value.trim();
            if (value) {
                addresses.push(value);
            }
        });
        
        return addresses;
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
            
            // Validate all PDFs first
            for (const fileItem of this.state.fileQueue) {
                const validation = await this.validatePDF(fileItem.file);
                if (!validation.valid) {
                    this.showError(`Invalid PDF: ${fileItem.name} - ${validation.error}`);
                    return;
                }
            }
            
            // Collect and validate recipient addresses
            const recipientInputs = document.querySelectorAll('.recipient-input');
            const recipients = Array.from(recipientInputs)
                .map(input => this.sanitizeInput(input.value.trim()))
                .filter(addr => addr.length > 0);
            
            // Validate each address
            for (const recipient of recipients) {
                if (!this.validateTronAddress(recipient)) {
                    this.showError(`Invalid TRON address: ${recipient}`);
                    return;
                }
            }
            
            // Check for duplicates
            const uniqueRecipients = [...new Set(recipients)];
            if (uniqueRecipients.length < recipients.length) {
                this.showError('Duplicate recipient addresses detected');
                return;
            }
            
            if (recipients.length === 0) {
                this.showError('Please add at least one recipient');
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
                issuingAgency: document.getElementById('issuingAgency').value,
                noticeType: document.getElementById('noticeType').value,
                caseDetails: document.getElementById('caseDetails').value,
                legalRights: document.getElementById('legalRights').value,
                responseDeadline: parseInt(document.getElementById('responseDeadline').value) || 30
            };
            
            // Populate Alert preview with all metadata
            document.getElementById('previewIssuingAgency').textContent = this.pendingFormData.issuingAgency;
            document.getElementById('previewNoticeType').textContent = this.pendingFormData.noticeType;
            document.getElementById('previewCaseNumber').textContent = this.pendingFormData.caseNumber;
            document.getElementById('previewResponseDeadline').textContent = this.pendingFormData.responseDeadline;
            document.getElementById('previewNoticeText').textContent = this.pendingFormData.noticeText;
            
            // Populate recipients list
            const recipientsList = document.getElementById('previewRecipients');
            recipientsList.innerHTML = recipients.map((addr, idx) => 
                `<li><small>${idx + 1}. ${addr}</small></li>`
            ).join('');
            
            // Populate document list
            const docList = document.getElementById('previewDocumentList');
            docList.innerHTML = this.state.fileQueue.map(item => 
                `<li>${item.name} (${(item.size / 1024).toFixed(1)} KB)</li>`
            ).join('');
            
            // Create Alert NFT preview image
            await this.createAlertNFTPreview();
            
            // Create merged PDF preview with page separators
            await this.createMergedPDFPreview();
            
            // Calculate costs
            const perRecipientCost = 10; // TRX per recipient for Alert + Document
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
    
    // Create Alert NFT preview image with overlay
    async createAlertNFTPreview() {
        try {
            // Check if PDF.js is loaded for rendering
            if (!window.pdfjsLib) {
                // Load PDF.js if not available
                await this.loadPDFJS();
            }
            
            // Get first PDF file
            const firstFile = this.state.fileQueue[0];
            if (!firstFile) {
                throw new Error('No PDF file available');
            }
            
            // Use PDF.js to render the first page to canvas
            const arrayBuffer = await firstFile.file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(1); // Get first page
            
            // Set up canvas
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            // Render the first page
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            // Add smaller, more transparent overlay at the top
            const overlayHeight = 150; // Overlay height
            
            // Semi-transparent gradient overlay
            const gradient = context.createLinearGradient(0, 0, 0, overlayHeight);
            gradient.addColorStop(0, 'rgba(255, 215, 0, 0.9)'); // Golden yellow
            gradient.addColorStop(1, 'rgba(255, 215, 0, 0.7)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, canvas.width, overlayHeight);
            
            // Add border around the overlay
            context.strokeStyle = 'rgb(204, 0, 0)'; // Dark red border
            context.lineWidth = 3;
            context.strokeRect(0, 0, canvas.width, overlayHeight);
            
            // Add "LEGAL NOTICE" text using canvas context
            context.fillStyle = 'rgb(204, 0, 0)'; // Dark red
            context.font = 'bold 48px Arial';
            context.textAlign = 'center';
            context.fillText('LEGAL NOTICE', canvas.width / 2, 50);
            
            // Subtitle
            context.fillStyle = 'rgb(0, 0, 0)'; // Black
            context.font = '24px Arial';
            context.fillText('DELIVERED VIA BLOCKCHAIN', canvas.width / 2, 90);
            
            // Date and time
            context.font = '18px Arial';
            context.fillText(new Date().toLocaleString(), canvas.width / 2, 120);
            
            // Case number (if available)
            if (this.pendingFormData && this.pendingFormData.caseNumber) {
                context.fillStyle = 'rgb(0, 0, 0)';
                context.font = '16px Arial';
                context.fillText(`Case: ${this.pendingFormData.caseNumber}`, canvas.width / 2, 140);
            }
            
            // Get the alert preview canvas
            const alertCanvas = document.getElementById('alertPreviewCanvas');
            const ctx = alertCanvas.getContext('2d');
            
            // Set canvas size (standard letter size ratio)
            alertCanvas.width = 400;
            alertCanvas.height = 520;
            
            // Draw white background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, alertCanvas.width, alertCanvas.height);
            
            // Draw document preview (simplified representation)
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(20, 160, alertCanvas.width - 40, alertCanvas.height - 180);
            
            // Draw some fake document lines
            ctx.fillStyle = '#dee2e6';
            for (let i = 0; i < 10; i++) {
                ctx.fillRect(40, 180 + i * 25, alertCanvas.width - 80, 2);
            }
            
            // Copy the rendered PDF page with overlay to the alert canvas
            // Scale down to fit
            const scale = Math.min(alertCanvas.width / canvas.width, (alertCanvas.height - 100) / canvas.height);
            const scaledWidth = canvas.width * scale;
            const scaledHeight = canvas.height * scale;
            const xOffset = (alertCanvas.width - scaledWidth) / 2;
            const yOffset = 100; // Leave space for header
            
            // Draw the PDF preview with overlay
            ctx.drawImage(canvas, xOffset, yOffset, scaledWidth, scaledHeight);
            
            // Store the base64 image
            this.alertNFTImage = alertCanvas.toDataURL('image/png', 0.9);
            console.log('Alert NFT image generated successfully');
            
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
                iframe.src = this.consolidatedPDFUrl;
                console.log('📄 Displaying server-processed consolidated PDF');
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
            if (window.StreamlinedEnergyFlow) {
                window.StreamlinedEnergyFlow.showEnergyModal({
                    currentEnergy: energyAvailable,
                    energyDetails: {
                        total: Math.max(3000000, Math.ceil(totalSizeMB * 1400000)),
                        estimatedTRXBurn: (Math.max(3000000, Math.ceil(totalSizeMB * 1400000)) * 0.00042).toFixed(2)
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
            
            this.showInfo('Processing documents and creating case...');
            
            // Create FormData for multipart upload
            const formData = new FormData();
            
            // Add metadata
            formData.append('caseNumber', caseNumber);
            formData.append('noticeText', document.getElementById('noticeText')?.value || '');
            formData.append('issuingAgency', document.getElementById('issuingAgency')?.value || '');
            formData.append('noticeType', document.getElementById('noticeType')?.value || '');
            formData.append('caseDetails', document.getElementById('caseDetails')?.value || '');
            formData.append('responseDeadline', document.getElementById('responseDeadline')?.value || '');
            formData.append('legalRights', document.getElementById('legalRights')?.value || 'View full notice at www.blockserved.com');
            formData.append('serverAddress', window.tronWeb.defaultAddress.base58);
            
            // Add recipients as JSON
            const recipients = this.getRecipientAddresses();
            formData.append('recipients', JSON.stringify(recipients));
            
            // Debug: Log what we're sending
            console.log('FormData contents:');
            console.log('- Case number:', caseNumber);
            console.log('- Recipients:', recipients);
            console.log('- File count:', this.state.fileQueue.length);
            
            // Add all PDF files
            for (let i = 0; i < this.state.fileQueue.length; i++) {
                const doc = this.state.fileQueue[i];
                formData.append('documents', doc.file, doc.file.name);
                console.log(`- Added file ${i + 1}: ${doc.file.name} (${doc.file.size} bytes)`);
            }
            
            // First, process documents to generate merged PDF and Alert NFT preview
            const processedDocs = await this.processDocumentsForCase();
            if (processedDocs) {
                // Add processed data
                if (processedDocs.mergedPDF) {
                    formData.append('mergedPDF', processedDocs.mergedPDF, 'merged.pdf');
                }
                if (processedDocs.alertPreview) {
                    formData.append('alertPreview', processedDocs.alertPreview);
                }
            }
            
            // Save to backend with multipart form data
            const backendUrl = getConfig('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
            const apiUrl = `${backendUrl}/api/cases`;
            console.log('Saving case to:', apiUrl);
            console.log('Server address:', window.tronWeb.defaultAddress.base58);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'X-Server-Address': window.tronWeb.defaultAddress.base58
                    // Don't set Content-Type, let browser set it for FormData
                },
                body: formData
            });
            
            if (!response.ok) {
                // Try to get error message
                const contentType = response.headers.get('content-type');
                let errorMessage = 'Failed to save case';
                
                if (contentType && contentType.includes('application/json')) {
                    try {
                        const error = await response.json();
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
            
            const result = await response.json();
            
            // If backend returned a consolidated PDF URL, store it
            if (result.consolidatedPdfUrl) {
                this.consolidatedPDFUrl = `${backendUrl}${result.consolidatedPdfUrl}`;
                console.log('✅ Received cleaned consolidated PDF from server');
            }
            
            // Show success message
            this.showSuccess(`Case "${caseNumber}" saved successfully! PDFs cleaned and consolidated on server.`);
            
            // Store case ID for later use
            this.currentCaseId = result.caseId;
            
            // Optionally refresh the cases list if on cases page
            if (window.cases) {
                await window.cases.loadCases();
            }
            
            return result;
            
        } catch (error) {
            console.error('Error saving to case manager:', error);
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
            
            // Minimum recommended energy (3 million)
            const MINIMUM_ENERGY = 3000000;
            const energySufficient = energyAvailable >= MINIMUM_ENERGY;
            
            // Calculate estimated document size (rough estimate based on number of files)
            const documentCount = this.state.fileQueue.length || 0;
            const estimatedSizeMB = documentCount * 0.5; // Estimate 0.5MB per document
            const estimatedEnergyNeeded = Math.max(MINIMUM_ENERGY, Math.ceil(estimatedSizeMB * 1400000));
            
            // Display resources
            document.getElementById('walletResourcesContent').innerHTML = `
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
            if (window.StreamlinedEnergyFlow) {
                window.StreamlinedEnergyFlow.showEnergyModal({
                    currentEnergy: this.currentEnergy || 0,
                    energyDetails: {
                        total: this.estimatedEnergyNeeded || 3000000,
                        estimatedTRXBurn: ((this.estimatedEnergyNeeded || 3000000) * 0.00042).toFixed(2)
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
    
    // Format TRX amount
    formatTRX(amount) {
        return (amount / 1e6).toFixed(2);
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
            item.draggable = true;
            item.dataset.fileId = fileItem.id;
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
    
    // Update fee calculation based on recipients
    updateFeeCalculation() {
        const recipientInputs = document.querySelectorAll('.recipient-input');
        const recipientCount = recipientInputs.length;
        
        const recipientCountEl = document.getElementById('recipientCount');
        const totalFeeEl = document.getElementById('totalFee');
        const energyEstimateEl = document.getElementById('energyEstimate');
        
        if (recipientCountEl) recipientCountEl.textContent = recipientCount;
        if (totalFeeEl) totalFeeEl.textContent = recipientCount * 10; // 5 TRX per NFT x 2 NFTs
        if (energyEstimateEl) energyEstimateEl.textContent = (recipientCount * 140000).toLocaleString();
    },
    
    // Handle account change from wallet
    handleAccountChange(newAddress) {
        console.log('Account changed to:', newAddress);
        this.state.userAddress = newAddress;
        
        // Update UI
        const addressElement = document.getElementById('walletAddress');
        if (addressElement) {
            addressElement.textContent = this.formatAddress(newAddress);
        }
        
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
    
    // Show processing modal
    showProcessing(message, details = '') {
        const modal = document.getElementById('processingModal');
        if (modal) {
            document.getElementById('processingMessage').textContent = message;
            document.getElementById('processingDetails').textContent = details;
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        }
    },
    
    // Hide processing modal
    hideProcessing() {
        const modal = document.getElementById('processingModal');
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});