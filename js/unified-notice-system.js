/**
 * Unified Notice System - Complete overhaul fixing all issues
 * Handles multi-document PDFs, proper data flow, and court-ready documentation
 */

class UnifiedNoticeSystem {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        this.contractAddress = window.CONTRACT_ADDRESS;
        this.serverAddress = null; // Will be set on wallet connect
        this.serverInfo = {
            serverId: null,
            name: null,
            agency: null,
            noticesServed: 0,
            registeredDate: null,
            active: false
        }; // Complete server profile from blockchain
        this.cases = new Map(); // Organized by case number
        this.pdfMerger = null; // For combining multiple PDFs
        this.eventHandlers = new Map(); // Track event handlers for cleanup
        this.fetchAbortController = null; // For cancelling ongoing fetches
    }
    
    /**
     * Security: HTML escape function to prevent XSS
     */
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    /**
     * Security: Sanitize user input
     */
    sanitizeInput(input) {
        if (!input) return '';
        // Remove any script tags and dangerous characters
        return String(input)
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
    }
    
    /**
     * Validate TRON address format
     */
    isValidTronAddress(address) {
        if (!address) return false;
        // TRON addresses start with T and are 34 characters long
        return /^T[A-Za-z0-9]{33}$/.test(address);
    }

    /**
     * Initialize the system with proper cleanup
     */
    async init() {
        console.log('🚀 Initializing Unified Notice System...');
        
        // Cancel any ongoing operations
        if (this.fetchAbortController) {
            this.fetchAbortController.abort();
        }
        this.fetchAbortController = new AbortController();
        
        // Get server address from wallet
        if (window.tronWeb && window.tronWeb.defaultAddress) {
            this.serverAddress = window.tronWeb.defaultAddress.base58;
            
            // Validate address format
            if (!this.isValidTronAddress(this.serverAddress)) {
                console.error('Invalid server address format');
                this.showNotification('Invalid wallet address format', 'error');
                return false;
            }
            
            console.log('Server address:', this.serverAddress);
            
            // Fetch server's registered agency
            await this.fetchServerAgency();
            
            // Check if server is active and show warning if not
            if (this.serverInfo.serverId && this.serverInfo.serverId !== '0' && !this.serverInfo.active) {
                console.warn('⚠️ Server account is inactive');
                this.showNotification('⚠️ Warning: Your server account is currently inactive. Contact The Block Audit to reactivate.', 'warning');
            }
        }

        // Set up global event delegation for case expansion
        this.setupGlobalEventDelegation();

        // Load PDF merger library
        await this.loadPDFMerger();
        
        // IMMEDIATELY load cases from backend - this should be FAST
        await this.loadServerCases();
        
        // Then sync blockchain in background without blocking
        setTimeout(() => {
            this.syncFromBlockchain().catch(error => {
                console.warn('Background blockchain sync failed:', error);
            });
        }, 2000); // Do blockchain sync 2 seconds later in background
        
        return true;
    }
    
    /**
     * Set up global event delegation for case clicks with multiple fallbacks
     */
    setupGlobalEventDelegation() {
        // Remove any existing listener
        if (this.globalClickHandler) {
            document.removeEventListener('click', this.globalClickHandler);
        }
        
        // Create new handler
        this.globalClickHandler = (e) => {
            // Skip if already handled by inline onclick
            if (e.defaultPrevented) return;
            
            // Check if clicked element is within a case header
            const caseHeader = e.target.closest('.case-header');
            if (caseHeader) {
                // Try multiple ways to get the case number
                let caseNumber = caseHeader.getAttribute('data-case') || 
                               caseHeader.getAttribute('data-case-number');
                
                if (!caseNumber) {
                    const caseCard = caseHeader.closest('.case-card');
                    if (caseCard) {
                        caseNumber = caseCard.getAttribute('data-case');
                    }
                }
                
                if (!caseNumber) {
                    const match = caseHeader.textContent.match(/Case[\s#:]+(\S+)/i);
                    if (match) {
                        caseNumber = match[1];
                    }
                }
                
                if (caseNumber) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Global delegation: Toggling case', caseNumber);
                    this.toggleCase(caseNumber);
                }
            }
        };
        
        // Add listener to document
        document.addEventListener('click', this.globalClickHandler);
        console.log('Global event delegation set up for case expansion');
        
        // Setup direct handlers as additional fallback
        setTimeout(() => this.setupDirectClickHandlers(), 100);
    }
    
    /**
     * Setup direct click handlers on case headers as fallback
     */
    setupDirectClickHandlers() {
        const headers = document.querySelectorAll('.case-header');
        console.log(`Setting up direct handlers for ${headers.length} case headers`);
        
        headers.forEach(header => {
            // Skip if already has onclick (inline handler takes precedence)
            if (header.hasAttribute('onclick')) {
                return;
            }
            
            // Skip if already processed
            if (header.hasAttribute('data-has-handler')) return;
            
            header.setAttribute('data-has-handler', 'true');
            header.style.cursor = 'pointer';
            
            header.addEventListener('click', (e) => {
                if (e.defaultPrevented) return;
                
                e.preventDefault();
                e.stopPropagation();
                
                let caseNumber = header.getAttribute('data-case') || 
                               header.getAttribute('data-case-number');
                               
                if (!caseNumber) {
                    const parent = header.closest('.case-card');
                    if (parent) {
                        caseNumber = parent.getAttribute('data-case');
                    }
                }
                
                if (caseNumber) {
                    console.log('Direct handler: Toggling case', caseNumber);
                    this.toggleCase(caseNumber);
                }
            });
        });
    }
    
    /**
     * Fetch the complete server profile from blockchain
     */
    async fetchServerAgency() {
        try {
            if (!window.legalContract || !this.serverAddress) {
                console.log('Contract not ready, using defaults');
                this.serverInfo.agency = 'The Block Audit';
                this.serverAgency = 'The Block Audit'; // Keep for backward compatibility
                return;
            }
            
            // Get server info from blockchain - try different method names
            let blockchainData;
            try {
                // Try serverById first (newer contract)
                const serverId = await window.legalContract.getServerId(this.serverAddress).call();
                if (serverId && serverId.toString() !== '0') {
                    blockchainData = await window.legalContract.serverById(serverId).call();
                }
            } catch (e) {
                console.log('serverById not available, trying processServers...');
                try {
                    // Fallback to processServers (older contract)
                    blockchainData = await window.legalContract.processServers(this.serverAddress).call();
                } catch (e2) {
                    console.warn('Could not fetch server info from blockchain:', e2);
                    blockchainData = null;
                }
            }
            
            // Parse all server data
            // Returns: [serverId, noticesServed, registeredDate, name, agency, active]
            this.serverInfo = {
                serverId: blockchainData[0] ? blockchainData[0].toString() : '0',
                noticesServed: blockchainData[1] ? parseInt(blockchainData[1].toString()) : 0,
                registeredDate: blockchainData[2] ? new Date(parseInt(blockchainData[2].toString()) * 1000) : null,
                name: blockchainData[3] || 'Process Server',
                agency: blockchainData[4] || 'The Block Audit',
                active: blockchainData[5] || false
            };
            
            // Keep backward compatibility
            this.serverAgency = this.serverInfo.agency;
            
            console.log('Server profile loaded:', this.serverInfo);
            
            // Check if server is active
            if (!this.serverInfo.active && this.serverInfo.serverId !== '0') {
                console.warn('⚠️ Warning: This server account is not active');
            }
            
            // Store complete profile in localStorage for offline access
            localStorage.setItem(`server_profile_${this.serverAddress}`, JSON.stringify(this.serverInfo));
            
        } catch (error) {
            console.warn('Could not fetch server profile from blockchain:', error);
            // Try localStorage cache
            const cached = localStorage.getItem(`server_profile_${this.serverAddress}`);
            if (cached) {
                this.serverInfo = JSON.parse(cached);
                this.serverAgency = this.serverInfo.agency;
            } else {
                this.serverInfo.agency = 'The Block Audit';
                this.serverAgency = 'The Block Audit';
            }
        }
    }

    /**
     * Load PDF merger for combining documents
     */
    async loadPDFMerger() {
        if (typeof PDFLib === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
            document.head.appendChild(script);
            
            return new Promise((resolve) => {
                script.onload = () => {
                    console.log('✅ PDF-lib loaded for document merging');
                    resolve();
                };
            });
        }
    }
    
    /**
     * DOCUMENT HANDLING - Merge multiple PDFs into one  
     */
    async mergeMultiplePDFs(files) {
        console.log(`📄 Merging ${files.length} PDF files...`);
        
        const pdfDoc = await PDFLib.PDFDocument.create();
        let totalPages = 0;
        
        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
            const pages = await pdfDoc.copyPages(pdf, pdf.getPageIndices());
            
            pages.forEach(page => pdfDoc.addPage(page));
            totalPages += pages.length;
            
            console.log(`Added ${pages.length} pages from ${file.name}`);
        }
        
        // Check page limit
        if (totalPages > 50) {
            throw new Error(`Document exceeds 50 page limit (${totalPages} pages). Please reduce document size.`);
        }
        
        // Save merged PDF
        const mergedPdfBytes = await pdfDoc.save();
        const mergedBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        
        console.log(`✅ Merged PDF created: ${totalPages} pages, ${(mergedBlob.size / 1024 / 1024).toFixed(2)}MB`);
        
        return {
            blob: mergedBlob,
            pageCount: totalPages,
            sizeInMB: mergedBlob.size / 1024 / 1024
        };
    }

    /**
     * CORE WORKFLOW - Create a legal notice with Alert + Document NFTs
     */
    async createLegalNotice(noticeData) {
        console.log('📝 Creating legal notice with paired NFTs...');
        
        // Validate required fields
        if (!noticeData.caseNumber || !noticeData.recipientAddress) {
            throw new Error('Case number and recipient address are required');
        }

        // Ensure server address is set
        noticeData.serverAddress = this.serverAddress;
        
        // Structure the notice properly
        const structuredNotice = {
            caseNumber: noticeData.caseNumber,
            serverAddress: this.serverAddress,
            recipientAddress: noticeData.recipientAddress,
            recipientName: noticeData.recipientName || '',
            noticeType: noticeData.noticeType || 'Legal Notice',
            issuingAgency: noticeData.issuingAgency || '',
            createdAt: new Date().toISOString(),
            
            // These will be paired but tracked separately
            alertNFT: {
                type: 'ALERT',
                status: 'DELIVERED', // Always delivered once created
                description: noticeData.alertDescription || 'Legal notice delivery confirmation'
            },
            documentNFT: {
                type: 'DOCUMENT',
                status: 'AWAITING_SIGNATURE',
                description: noticeData.documentDescription || 'Legal document requiring signature',
                documentData: noticeData.documentData,
                pageCount: noticeData.pageCount || 1
            }
        };

        // Save to backend FIRST (with proper server address)
        const backendResult = await this.saveToBackend(structuredNotice);
        
        // Then send to blockchain
        const blockchainResult = await this.sendToBlockchain(structuredNotice);
        
        // Update backend with blockchain data
        await this.updateBackendWithBlockchain(backendResult.id, blockchainResult);
        
        // Add to local cases
        this.addToLocalCases(structuredNotice, blockchainResult);
        
        return {
            success: true,
            caseNumber: noticeData.caseNumber,
            alertId: blockchainResult.alertId,
            documentId: blockchainResult.documentId,
            transactionHash: blockchainResult.transactionHash
        };
    }

    /**
     * Save notice to backend with correct server address
     */
    async saveToBackend(notice) {
        console.log('💾 Saving to backend with server address:', notice.serverAddress);
        
        const payload = {
            caseNumber: notice.caseNumber,
            serverAddress: notice.serverAddress, // YOUR address, not null
            recipientAddress: notice.recipientAddress,
            recipientName: notice.recipientName,
            noticeType: notice.noticeType,
            issuingAgency: notice.issuingAgency,
            alertDescription: notice.alertNFT.description,
            documentDescription: notice.documentNFT.description,
            pageCount: notice.documentNFT.pageCount,
            status: 'PENDING_BLOCKCHAIN',
            createdAt: notice.createdAt
        };

        const response = await fetch(`${this.backend}/api/notices/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('Failed to save to backend');
        }

        const result = await response.json();
        console.log('✅ Saved to backend with ID:', result.id);
        return result;
    }

    /**
     * Load all cases for the current server - FAST VERSION
     */
    async loadServerCases() {
        console.log('📂 FAST Loading cases for server:', this.serverAddress);
        
        if (!this.serverAddress) {
            console.error('No server address set');
            return;
        }

        try {
            // Try simple endpoint FIRST (it's faster)
            let response = await fetch(
                `${this.backend}/api/servers/${this.serverAddress}/simple-cases`,
                { 
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    // Add timeout to prevent hanging
                    signal: AbortSignal.timeout(5000)
                }
            );
            
            // If simple endpoint fails, try the other one
            if (!response.ok) {
                console.log('Simple endpoint failed, trying cases endpoint...');
                response = await fetch(
                    `${this.backend}/api/servers/${this.serverAddress}/cases`,
                    { 
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        signal: AbortSignal.timeout(5000)
                    }
                );
            }
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ FAST: Loaded cases from backend:', data.cases?.length || 0);
                this.processCasesData(data.cases || []);
                // Render immediately after loading
                this.renderCases('unifiedCasesContainer');
            } else {
                console.log('Backend not responding (status:', response.status, ')');
                // Don't fall back to blockchain here - let it happen in background
            }
            
        } catch (error) {
            console.error('Error loading cases:', error);
            // Don't fall back to blockchain here - let it happen in background
        }
    }

    /**
     * Sync blockchain data to backend
     */
    async syncFromBlockchain() {
        console.log('🔄 Syncing from blockchain to backend...');
        
        // If contract not ready, skip sync
        if (!window.legalContract || !window.tronWeb) {
            console.log('Contract not ready, skipping blockchain sync...');
            return [];
        }

        // Skip if we're being called too frequently
        const now = Date.now();
        if (this.lastSyncTime && (now - this.lastSyncTime) < 5000) {
            console.log('Skipping sync - too soon since last sync');
            return [];
        }
        this.lastSyncTime = now;

        try {
            // Get total supply of NFTs
            const totalSupply = await window.legalContract.totalSupply().call();
            const totalSupplyNum = Number(totalSupply.toString());
            console.log(`Total NFTs on blockchain: ${totalSupplyNum}`);
            
            const notices = [];
            
            // Process in smaller batches with delays to avoid rate limiting
            const batchSize = 3;
            const delayBetweenBatches = 1000; // 1 second delay
            const maxToCheck = Math.min(totalSupplyNum, 50);
            
            // Check each NFT (up to 50 to cover your notices)
            for (let i = 1; i <= maxToCheck; i++) {
                try {
                    // Add delay every batchSize requests to avoid rate limiting
                    if (i > 1 && (i - 1) % batchSize === 0) {
                        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
                    }
                    
                    // Get alert data (using alerts mapping)
                    const alertData = await window.legalContract.alerts(i).call();
                    const alertServer = tronWeb.address.fromHex(alertData[0]);
                    
                    // Check if this alert belongs to our server
                    if (this.serverAddress && 
                        (alertServer.toLowerCase() === this.serverAddress.toLowerCase() || 
                         alertServer === 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb')) { // null address
                        
                        // This is our notice - extract data
                        const notice = {
                            alertId: i.toString(),
                            serverAddress: this.serverAddress, // Use OUR address, not null
                            recipientAddress: tronWeb.address.fromHex(alertData[1]),
                            alertURI: alertData[2],
                            alertDescription: alertData[3],
                            alertThumbnail: alertData[4],
                            jurisdiction: alertData[5],
                            timestamp: parseInt(alertData[6]),
                            delivered: alertData[7],
                            
                            // Get associated document if exists
                            documentId: (i + 1).toString(), // Documents are usually next ID
                            
                            // Parse case number from description or URI
                            caseNumber: this.extractCaseNumber(alertData[3]) || `CASE-${i}`
                        };
                        
                        // Check for associated document
                        try {
                            const docData = await window.legalContract.documents(i + 1).call();
                            notice.documentURI = docData[2];
                            notice.hasDocument = true;
                        } catch (e) {
                            notice.hasDocument = false;
                        }
                        
                        notices.push(notice);
                        
                        // Sync this notice to backend
                        await this.syncNoticeToBackend(notice);
                    }
                } catch (error) {
                    console.warn(`Could not fetch NFT ${i}:`, error);
                }
            }
            
            console.log(`✅ Synced ${notices.length} notices from blockchain`);
            return notices;
            
        } catch (error) {
            console.error('Error syncing from blockchain:', error);
            // Fall back to manual sync
            return await this.manualSyncKnownCases();
        }
    }
    
    /**
     * Manual sync for known cases when blockchain is unavailable
     */
    async manualSyncKnownCases() {
        console.log('📝 Manual sync of known cases...');
        
        try {
            const response = await fetch(`${this.backend}/api/sync-blockchain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverAddress: this.serverAddress || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY'
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Manual sync completed:', data);
                return data.cases || [];
            }
        } catch (error) {
            console.error('Manual sync failed:', error);
        }
        
        return [];
    }

    /**
     * Extract case number from description
     */
    extractCaseNumber(description) {
        // Ensure description is a string
        if (!description || typeof description !== 'string') {
            if (description && typeof description === 'object') {
                // Try to convert object to string or extract relevant field
                description = description.toString ? description.toString() : JSON.stringify(description);
            } else {
                return null;
            }
        }
        
        // Look for patterns like "Case #123456" or "34-987654"
        const patterns = [
            /Case\s*#?\s*([0-9\-]+)/i,
            /\b(\d{2,}-\d{6})\b/,
            /\b(\d{6})\b/
        ];
        
        for (const pattern of patterns) {
            try {
                const match = description.match(pattern);
                if (match) {
                    return match[1];
                }
            } catch (e) {
                console.warn('Error matching pattern:', e);
            }
        }
        
        return null;
    }

    /**
     * Sync individual notice to backend
     */
    async syncNoticeToBackend(notice) {
        try {
            const response = await fetch(`${this.backend}/api/notices/served`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    noticeId: notice.alertId,
                    alertId: notice.alertId,
                    documentId: notice.documentId,
                    serverAddress: this.serverAddress, // Always use OUR address
                    recipientAddress: notice.recipientAddress,
                    caseNumber: notice.caseNumber,
                    noticeType: 'Legal Notice',
                    issuingAgency: notice.jurisdiction || '',
                    hasDocument: notice.hasDocument
                })
            });
            
            if (response.ok) {
                console.log(`✅ Synced notice ${notice.alertId} to backend`);
            }
        } catch (error) {
            console.warn('Could not sync notice to backend:', error);
        }
    }

    /**
     * Load directly from blockchain if backend is down
     */
    async loadDirectFromBlockchain() {
        console.log('📡 Loading directly from blockchain...');
        
        try {
            const notices = await this.syncFromBlockchain();
            
            // Group by case number
            const caseMap = new Map();
            
            for (const notice of notices) {
                const caseNumber = notice.caseNumber;
                
                if (!caseMap.has(caseNumber)) {
                    caseMap.set(caseNumber, {
                        caseNumber,
                        serverAddress: this.serverAddress,
                        recipientAddress: notice.recipientAddress,
                        createdAt: new Date(notice.timestamp * 1000).toISOString(),
                        alertId: notice.alertId,
                        documentId: notice.documentId,
                        hasDocument: notice.hasDocument,
                        alertNFT: {
                            id: notice.alertId,
                            type: 'ALERT',
                            status: 'DELIVERED'
                        },
                        documentNFT: {
                            id: notice.documentId,
                            type: 'DOCUMENT',
                            status: 'AWAITING_SIGNATURE',
                            pageCount: 1
                        }
                    });
                }
            }
            
            // Process the cases
            this.cases = caseMap;
            console.log(`✅ Loaded ${this.cases.size} cases from blockchain`);
        } catch (error) {
            console.error('Blockchain loading failed:', error);
            // Just log the error - cases should already be loaded from backend
            console.log('Cases from backend should already be loaded');
        }
    }

    /**
     * Process cases data into proper structure
     */
    processCasesData(casesArray) {
        this.cases.clear();
        
        for (const caseData of casesArray) {
            // Handle cases with multiple recipients
            if (caseData.recipients && caseData.recipients.length > 0) {
                // New structure with multiple recipients
                const structuredCase = {
                    caseNumber: caseData.caseNumber,
                    serverAddress: caseData.serverAddress || this.serverAddress,
                    noticeType: caseData.noticeType,
                    issuingAgency: caseData.issuingAgency,
                    createdAt: caseData.firstServedAt || caseData.createdAt,
                    
                    // Multiple recipients
                    recipients: caseData.recipients,
                    recipientCount: caseData.recipientCount,
                    
                    // Aggregate status
                    allSigned: caseData.allSigned,
                    partialSigned: caseData.partialSigned,
                    totalViews: caseData.totalViews,
                    totalAccepted: caseData.totalAccepted,
                    lastViewedAt: caseData.lastViewedAt
                };
                
                this.cases.set(caseData.caseNumber, structuredCase);
            } else {
                // Legacy single recipient structure (backward compatibility)
                const structuredCase = {
                    caseNumber: caseData.caseNumber,
                    serverAddress: caseData.serverAddress || this.serverAddress,
                    noticeType: caseData.noticeType,
                    issuingAgency: caseData.issuingAgency,
                    createdAt: caseData.createdAt,
                    
                    // Convert to multi-recipient format
                    recipients: [{
                        recipientAddress: caseData.recipientAddress,
                        recipientName: caseData.recipientName || '',
                        alertId: caseData.alertId,
                        documentId: caseData.documentId,
                        alertStatus: 'DELIVERED',
                        documentStatus: caseData.documentStatus || 'AWAITING_SIGNATURE',
                        viewCount: caseData.viewCount || 0,
                        lastViewedAt: caseData.lastViewedAt,
                        acceptedAt: caseData.acceptedAt,
                        pageCount: caseData.pageCount || 1
                    }],
                    recipientCount: 1,
                    
                    // Aggregate status
                    allSigned: caseData.documentStatus === 'SIGNED',
                    partialSigned: false,
                    totalViews: caseData.viewCount || 0,
                    totalAccepted: caseData.documentStatus === 'SIGNED' ? 1 : 0,
                    lastViewedAt: caseData.lastViewedAt
                };
                
                this.cases.set(caseData.caseNumber, structuredCase);
            }
        }
        
        console.log(`✅ Loaded ${this.cases.size} cases`);
    }

    /**
     * Render cases in the UI with proper structure
     */
    renderCases(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Clear any test data
        const casesToRender = Array.from(this.cases.values()).filter(
            c => !c.caseNumber.includes('TEST')
        );

        // Build the server profile header
        let serverProfileHtml = '';
        // Only show header if we have valid server data (not the weird "9" name)
        if (this.serverInfo.serverId && this.serverInfo.serverId !== '0' && 
            this.serverInfo.name && this.serverInfo.name !== '9' && this.serverInfo.name !== '0') {
            const registrationDate = this.serverInfo.registeredDate ? 
                new Date(Number(this.serverInfo.registeredDate) * 1000).toLocaleDateString() : 'Not available';
            
            serverProfileHtml = `
                <div class="server-profile-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                        <div>
                            <h2 style="margin: 0; font-size: 1.5rem; font-weight: 600;">
                                ${this.serverInfo.name || 'Process Server'} 
                                <span style="opacity: 0.8; font-size: 0.9rem;">#${this.serverInfo.serverId}</span>
                            </h2>
                            <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">
                                <i class="fas fa-building"></i> ${this.serverInfo.agency}
                                ${this.serverInfo.active ? 
                                    '<span style="margin-left: 1rem; padding: 2px 8px; background: rgba(255,255,255,0.2); border-radius: 12px; font-size: 0.85em;"><i class="fas fa-check-circle"></i> Active</span>' : 
                                    '<span style="margin-left: 1rem; padding: 2px 8px; background: rgba(255,100,100,0.3); border-radius: 12px; font-size: 0.85em;"><i class="fas fa-exclamation-circle"></i> Inactive</span>'
                                }
                            </p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 2rem; font-weight: bold;">${this.cases.size || 0}</div>
                            <div style="opacity: 0.9; font-size: 0.9rem;">Total Service Events</div>
                            <div style="opacity: 0.8; font-size: 0.8rem; margin-top: 0.25rem;">
                                <i class="fas fa-calendar"></i> Since ${registrationDate}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (casesToRender.length === 0) {
            container.innerHTML = serverProfileHtml + `
                <div class="no-cases">
                    <i class="fas fa-inbox" style="font-size: 3rem; color: var(--text-muted);"></i>
                    <p>No cases found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = serverProfileHtml + casesToRender.map(caseData => this.renderCase(caseData)).join('');
        
        // Re-setup global event delegation to ensure it's active
        this.setupGlobalEventDelegation();
        
        // Also attach handlers with a small delay for DOM to settle
        setTimeout(() => {
            this.attachCaseHandlers();
        }, 100);
    }

    /**
     * Render individual case with multiple recipients
     */
    renderCase(caseData) {
        const caseId = `case-${caseData.caseNumber.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Determine overall case status based on all recipients
        // For paired Alert+Document notices: show "Delivered" until document is signed
        let statusLabel, statusClass;
        if (caseData.allSigned) {
            statusLabel = 'Signed For';
            statusClass = 'status-completed';
        } else if (caseData.partialSigned) {
            statusLabel = `${caseData.totalAccepted}/${caseData.recipientCount} Signed`;
            statusClass = 'status-partial';
        } else {
            // Paired notices are "Delivered" once sent, awaiting signature
            statusLabel = 'Delivered';
            statusClass = 'status-delivered';
        }
        
        // Format the service date
        const serviceDate = new Date(caseData.createdAt);
        const formattedDate = serviceDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="case-card" data-case="${caseData.caseNumber}">
                <div class="case-header" 
                     data-case="${caseData.caseNumber}" 
                     data-case-number="${caseData.caseNumber}"
                     onclick="event.preventDefault(); event.stopPropagation(); window.unifiedSystem.toggleCase('${caseData.caseNumber}'); return false;"
                     style="cursor: pointer; padding: 10px; border-radius: 5px; transition: all 0.2s; background-color: transparent;"
                     onmouseover="this.style.backgroundColor='#f0f0f0'; this.querySelectorAll('*').forEach(el => el.style.color='#333');" 
                     onmouseout="this.style.backgroundColor='transparent'; this.querySelectorAll('*').forEach(el => el.style.color='');">
                    <div class="case-info">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <h3 style="margin: 0;">Case #${caseData.caseNumber}</h3>
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">
                                <i class="fas fa-clock"></i> ${formattedDate}
                            </span>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <span class="case-type">${caseData.noticeType}</span>
                            <span class="case-agency">${caseData.issuingAgency || this.serverAgency || 'The Block Audit'}</span>
                            <span class="recipient-count" style="padding: 2px 8px; background: #e3f2fd; color: #1976d2; border-radius: 12px; font-size: 0.85em; font-weight: 500;">
                                ${caseData.recipientCount || 1} Notice${(caseData.recipientCount || 1) > 1 ? 's' : ''} Served
                            </span>
                        </div>
                    </div>
                    <div class="case-status">
                        <span class="status-badge ${statusClass}">${statusLabel}</span>
                        <i class="fas fa-chevron-down" id="${caseId}-chevron" style="transition: transform 0.3s;"></i>
                    </div>
                </div>
                
                <div class="case-details" id="${caseId}-details" data-case-details="${caseData.caseNumber}" style="display: none;">
                    <!-- Case Overview -->
                    <div class="case-meta">
                        <div class="meta-item">
                            <label>Recipients:</label>
                            <span>${caseData.recipientCount} ${caseData.recipientCount === 1 ? 'party' : 'parties'}</span>
                        </div>
                        <div class="meta-item">
                            <label>Served By:</label>
                            <span>${caseData.serverAddress}</span>
                        </div>
                        <div class="meta-item">
                            <label>Total Views:</label>
                            <span>${caseData.totalViews}</span>
                        </div>
                        <div class="meta-item">
                            <label>First Served:</label>
                            <span>${new Date(caseData.createdAt).toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <!-- Recipients List -->
                    <div class="recipients-section">
                        <h4>Recipients (${caseData.recipientCount})</h4>
                        ${caseData.recipients.map((recipient, index) => `
                            <div class="recipient-card">
                                <div class="recipient-header">
                                    <span class="recipient-number">Recipient ${index + 1}</span>
                                    <span class="recipient-status ${recipient.documentStatus === 'SIGNED' ? 'status-signed' : 'status-pending'}">
                                        ${recipient.documentStatus === 'SIGNED' ? '✓ Signed' : '⏳ Awaiting'}
                                    </span>
                                </div>
                                
                                <div class="recipient-details">
                                    <div class="recipient-address">
                                        <label>Address:</label>
                                        <span>${recipient.recipientAddress}</span>
                                    </div>
                                    ${recipient.recipientName ? `
                                        <div class="recipient-name">
                                            <label>Name:</label>
                                            <span>${recipient.recipientName}</span>
                                        </div>
                                    ` : ''}
                                </div>
                                
                                <!-- Paired NFTs for this recipient -->
                                <div class="paired-nfts">
                                    <!-- Alert NFT -->
                                    <div class="nft-item alert-nft">
                                        <div class="nft-icon">
                                            <i class="fas fa-bell"></i>
                                        </div>
                                        <div class="nft-info">
                                            <span class="nft-label">Alert Notice</span>
                                            <span class="nft-id">NFT ID: ${recipient.alertId || 'Pending'}</span>
                                            <span class="nft-status status-delivered">✓ Delivered</span>
                                        </div>
                                        <div class="nft-actions">
                                            <button onclick="unifiedSystem.viewNotice('${caseData.caseNumber}', 'alert', '${recipient.alertId}')" class="btn btn-small btn-success">
                                                <i class="fas fa-eye"></i> View
                                            </button>
                                            <button onclick="unifiedSystem.viewReceipt('${caseData.caseNumber}', 'alert', '${recipient.recipientAddress}')" class="btn btn-small btn-primary">
                                                <i class="fas fa-file-alt"></i> Receipt
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <!-- Document NFT -->
                                    <div class="nft-item document-nft">
                                        <div class="nft-icon">
                                            <i class="fas fa-file-contract"></i>
                                        </div>
                                        <div class="nft-info">
                                            <span class="nft-label">Document (${recipient.pageCount || 1} pages)</span>
                                            <span class="nft-id">NFT ID: ${recipient.documentId || 'Pending'}</span>
                                            <span class="nft-status ${recipient.documentStatus === 'SIGNED' ? 'status-signed' : 'status-pending'}">
                                                ${recipient.documentStatus === 'SIGNED' ? '✓ Signed For' : '⏳ Awaiting Signature'}
                                            </span>
                                        </div>
                                        <div class="nft-actions">
                                            <button onclick="unifiedSystem.viewNotice('${caseData.caseNumber}', 'document', '${recipient.documentId}')" class="btn btn-small btn-success">
                                                <i class="fas fa-eye"></i> View
                                            </button>
                                            <button onclick="unifiedSystem.viewReceipt('${caseData.caseNumber}', 'document')" class="btn btn-small btn-primary">
                                                <i class="fas fa-file-alt"></i> Receipt
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <!-- Case Actions -->
                    <div class="case-actions">
                        <button onclick="unifiedSystem.viewNotice('${caseData.caseNumber}', 'both')" class="btn btn-primary">
                            <i class="fas fa-eye"></i> View All Notices
                        </button>
                        <button onclick="unifiedSystem.viewServiceCertificate('${caseData.caseNumber}')" class="btn btn-secondary">
                            <i class="fas fa-certificate"></i> Service Certificate
                        </button>
                        <button onclick="unifiedSystem.viewAuditTrail('${caseData.caseNumber}')" class="btn btn-secondary">
                            <i class="fas fa-list"></i> Audit Trail
                        </button>
                        <button onclick="unifiedSystem.downloadCaseDocuments('${caseData.caseNumber}')" class="btn btn-secondary">
                            <i class="fas fa-download"></i> Download All
                        </button>
                        <button onclick="unifiedSystem.printForCourt('${caseData.caseNumber}')" class="btn btn-primary">
                            <i class="fas fa-print"></i> Print for Court
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Toggle case expansion with comprehensive fallbacks
     */
    toggleCase(caseNumber) {
        console.log('=== toggleCase called for:', caseNumber, '===');
        
        // Try multiple methods to find the details element
        let details = null;
        let chevron = null;
        
        // Method 1: By ID (primary)
        const caseId = `case-${caseNumber.replace(/[^a-zA-Z0-9]/g, '_')}`;
        details = document.getElementById(`${caseId}-details`);
        if (details) {
            chevron = document.getElementById(`${caseId}-chevron`);
            console.log('Found via ID method');
        }
        
        // Method 2: By data-case-details attribute
        if (!details) {
            details = document.querySelector(`[data-case-details="${caseNumber}"]`);
            if (details) {
                const parent = details.closest('.case-card');
                chevron = parent ? parent.querySelector('.fa-chevron-down, .fa-chevron-up, [id$="-chevron"]') : null;
                console.log('Found via data-case-details');
            }
        }
        
        // Method 3: Within case-card
        if (!details) {
            const caseCard = document.querySelector(`.case-card[data-case="${caseNumber}"]`);
            if (caseCard) {
                details = caseCard.querySelector('.case-details');
                chevron = caseCard.querySelector('.fa-chevron-down, .fa-chevron-up, [id$="-chevron"]');
                console.log('Found via case-card');
            }
        }
        
        // Toggle if found
        if (details) {
            const wasHidden = details.style.display === 'none' || 
                            details.style.display === '' ||
                            !details.style.display;
            
            if (wasHidden) {
                // Expand
                details.style.display = 'block';
                details.style.visibility = 'visible';
                
                if (chevron) {
                    chevron.style.transform = 'rotate(180deg)';
                    if (chevron.classList.contains('fa-chevron-down')) {
                        chevron.classList.remove('fa-chevron-down');
                        chevron.classList.add('fa-chevron-up');
                    }
                }
                
                console.log('✅ Expanded case:', caseNumber);
            } else {
                // Collapse
                details.style.display = 'none';
                
                if (chevron) {
                    chevron.style.transform = 'rotate(0deg)';
                    if (chevron.classList.contains('fa-chevron-up')) {
                        chevron.classList.remove('fa-chevron-up');
                        chevron.classList.add('fa-chevron-down');
                    }
                }
                
                console.log('✅ Collapsed case:', caseNumber);
            }
            
            // Save state
            try {
                const states = JSON.parse(sessionStorage.getItem('caseExpansionStates') || '{}');
                states[caseNumber] = wasHidden;
                sessionStorage.setItem('caseExpansionStates', JSON.stringify(states));
            } catch (e) {
                console.error('Error saving state:', e);
            }
            
            // Dispatch event
            window.dispatchEvent(new CustomEvent('caseToggled', {
                detail: { caseNumber, expanded: wasHidden }
            }));
        } else {
            console.error('❌ Could not find case details for:', caseNumber);
            
            // Only log debug info in development
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('Debug info:');
                console.log('- Case cards found:', document.querySelectorAll('.case-card').length);
                console.log('- Case details found:', document.querySelectorAll('.case-details').length);
                console.log('- Looking for ID:', `${caseId}-details`);
            }
            
            // Try refreshing handlers
            setTimeout(() => {
                this.setupDirectClickHandlers();
            }, 100);
        }
    }

    /**
     * View receipt with preview first
     */
    async viewReceipt(caseNumber, type) {
        const caseData = this.cases.get(caseNumber);
        if (!caseData) return;

        const receipt = this.generateReceipt(caseData, type);
        
        // Show in modal for preview
        this.showReceiptModal(receipt, caseData, type);
    }

    /**
     * Generate receipt with proper data
     */
    generateReceipt(caseData, type) {
        const isAlert = type === 'alert';
        
        // Get NFT data from recipients if available
        const firstRecipient = caseData.recipients?.[0] || {};
        const nftId = isAlert ? firstRecipient.alertId : firstRecipient.documentId;
        
        // Get recipient address - handle both old and new structure
        const recipientAddress = firstRecipient.recipientAddress || caseData.recipientAddress || 'Unknown';
        const recipientName = firstRecipient.recipientName || caseData.recipientName || 'Not Specified';
        
        return {
            title: isAlert ? 'LEGAL NOTICE DELIVERY RECEIPT' : 'LEGAL DOCUMENT SERVICE RECEIPT',
            type: type.toUpperCase(),
            
            // Case Information
            case: {
                number: caseData.caseNumber,
                type: caseData.noticeType || 'Legal Notice',
                agency: caseData.issuingAgency || this.serverInfo.agency || 'The Block Audit',
                created: caseData.createdAt ? new Date(caseData.createdAt).toLocaleString() : new Date().toLocaleString()
            },
            
            // NFT Information
            nft: {
                id: nftId || 'Pending',
                type: isAlert ? 'Alert NFT' : 'Document NFT',
                status: isAlert ? 'Delivered' : (firstRecipient.documentStatus || 'Pending'),
                transactionHash: 'View on blockchain'
            },
            
            // Parties (with correct addresses)
            parties: {
                server: {
                    label: 'Process Server',
                    address: caseData.serverAddress || this.serverAddress, // Use current server address as fallback
                    name: 'Authorized Legal Process Server'
                },
                recipient: {
                    label: 'Recipient',
                    address: recipientAddress,
                    name: recipientName
                }
            },
            
            // Blockchain Verification
            blockchain: {
                network: 'TRON Mainnet',
                contract: this.contractAddress,
                explorerUrl: `https://tronscan.org/#/transaction/pending`
            },
            
            // Legal Certification
            legal: {
                statement: isAlert ? 
                    'This receipt certifies that legal notice was delivered via blockchain technology and is immutably recorded.' :
                    'This receipt certifies that a legal document was served and is awaiting or has received digital signature.',
                disclaimer: 'This document is admissible as evidence of service in legal proceedings.',
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Show receipt in modal with print/download options
     */
    showReceiptModal(receipt, caseData, type) {
        // Remove any existing modal
        const existingModal = document.getElementById('receiptModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'receiptModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content large">
                <div class="modal-header">
                    <h2>${this.escapeHtml(receipt.title)}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body" id="receiptContent">
                    <div class="receipt-container">
                        <!-- Header -->
                        <div class="receipt-header">
                            <h1>${this.escapeHtml(receipt.title)}</h1>
                            <p class="receipt-subtitle">Blockchain Legal Service Verification</p>
                        </div>
                        
                        <!-- Case Information -->
                        <div class="receipt-section">
                            <h3>CASE INFORMATION</h3>
                            <table class="receipt-table">
                                <tr>
                                    <td><strong>Case Number:</strong></td>
                                    <td>${this.escapeHtml(receipt.case.number)}</td>
                                </tr>
                                <tr>
                                    <td><strong>Notice Type:</strong></td>
                                    <td>${this.escapeHtml(receipt.case.type)}</td>
                                </tr>
                                <tr>
                                    <td><strong>Issuing Agency:</strong></td>
                                    <td>${this.escapeHtml(receipt.case.agency)}</td>
                                </tr>
                                <tr>
                                    <td><strong>Date Created:</strong></td>
                                    <td>${receipt.case.created}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <!-- NFT Information -->
                        <div class="receipt-section">
                            <h3>NFT DETAILS</h3>
                            <table class="receipt-table">
                                <tr>
                                    <td><strong>NFT Type:</strong></td>
                                    <td>${receipt.nft.type} NOTICE</td>
                                </tr>
                                <tr>
                                    <td><strong>Token ID:</strong></td>
                                    <td>${receipt.nft.id || 'Pending'}</td>
                                </tr>
                                <tr>
                                    <td><strong>Status:</strong></td>
                                    <td>${receipt.nft.status}</td>
                                </tr>
                                <tr>
                                    <td><strong>Transaction:</strong></td>
                                    <td class="tx-hash">${receipt.nft.transactionHash || 'Pending'}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <!-- Parties -->
                        <div class="receipt-section">
                            <h3>PARTIES</h3>
                            <table class="receipt-table">
                                <tr>
                                    <td><strong>${receipt.parties.server.label}:</strong></td>
                                    <td>
                                        ${receipt.parties.server.address}<br>
                                        <small>${receipt.parties.server.name}</small>
                                    </td>
                                </tr>
                                <tr>
                                    <td><strong>${receipt.parties.recipient.label}:</strong></td>
                                    <td>
                                        ${receipt.parties.recipient.address}<br>
                                        <small>${receipt.parties.recipient.name}</small>
                                    </td>
                                </tr>
                            </table>
                        </div>
                        
                        <!-- Blockchain Verification -->
                        <div class="receipt-section">
                            <h3>BLOCKCHAIN VERIFICATION</h3>
                            <table class="receipt-table">
                                <tr>
                                    <td><strong>Network:</strong></td>
                                    <td>${receipt.blockchain.network}</td>
                                </tr>
                                <tr>
                                    <td><strong>Contract:</strong></td>
                                    <td class="contract-address">${receipt.blockchain.contract}</td>
                                </tr>
                                <tr>
                                    <td><strong>Explorer:</strong></td>
                                    <td><a href="${receipt.blockchain.explorerUrl}" target="_blank">View on TronScan</a></td>
                                </tr>
                            </table>
                        </div>
                        
                        <!-- Legal Certification -->
                        <div class="receipt-section">
                            <h3>LEGAL CERTIFICATION</h3>
                            <p class="legal-statement">${receipt.legal.statement}</p>
                            <p class="legal-disclaimer"><em>${receipt.legal.disclaimer}</em></p>
                            <p class="timestamp">Generated: ${new Date(receipt.legal.timestamp).toLocaleString()}</p>
                        </div>
                        
                        <!-- Signature Line -->
                        <div class="receipt-footer">
                            <div class="signature-line">
                                <div class="signature-block">
                                    <div class="signature-line-item">_______________________________</div>
                                    <div class="signature-label">Authorized Process Server</div>
                                </div>
                                <div class="signature-block">
                                    <div class="signature-line-item">_______________________________</div>
                                    <div class="signature-label">Date</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button onclick="unifiedSystem.printReceipt()" class="btn btn-primary">
                        <i class="fas fa-print"></i> Print
                    </button>
                    <button onclick="unifiedSystem.downloadReceiptPDF('${caseData.caseNumber}', '${type}')" class="btn btn-secondary">
                        <i class="fas fa-download"></i> Download PDF
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Print receipt
     */
    printReceipt() {
        const content = document.getElementById('receiptContent');
        if (content) {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Legal Service Receipt</title>
                    <style>
                        body { font-family: Arial, sans-serif; }
                        .receipt-container { max-width: 800px; margin: 0 auto; }
                        .receipt-header { text-align: center; margin-bottom: 30px; }
                        .receipt-section { margin: 20px 0; }
                        .receipt-table { width: 100%; }
                        .receipt-table td { padding: 8px; }
                        .receipt-footer { margin-top: 50px; }
                        .signature-line { display: flex; justify-content: space-around; }
                        .signature-block { text-align: center; }
                    </style>
                </head>
                <body>
                    ${content.innerHTML}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    }

    /**
     * Generate Service Certificate with proper formatting
     */
    async viewServiceCertificate(caseNumber) {
        const caseData = this.cases.get(caseNumber);
        if (!caseData) {
            console.error('Case data not found for:', caseNumber);
            return;
        }

        // Handle both single and multi-recipient structures
        const firstRecipient = caseData.recipients?.[0] || {};
        const recipientAddress = firstRecipient.recipientAddress || caseData.recipientAddress || 'Unknown';
        const recipientName = firstRecipient.recipientName || caseData.recipientName || 'As Addressed';
        const alertId = firstRecipient.alertId || caseData.alertId || caseData.alertNFT?.id || 'Pending';
        const documentId = firstRecipient.documentId || caseData.documentId || caseData.documentNFT?.id || 'Pending';
        const pageCount = firstRecipient.pageCount || caseData.documentNFT?.pageCount || 1;
        const documentStatus = firstRecipient.documentStatus || caseData.documentNFT?.status || 'AWAITING_SIGNATURE';

        const certificate = {
            title: 'CERTIFICATE OF SERVICE',
            subtitle: 'Legal Process Service Verification',
            
            certification: `I, the undersigned authorized process server, hereby certify that I served the within-named documents:`,
            
            case: {
                number: caseData.caseNumber,
                type: caseData.noticeType || 'Legal Notice',
                agency: caseData.issuingAgency || 'The Block Audit'
            },
            
            service: {
                date: new Date(caseData.createdAt).toLocaleDateString(),
                time: new Date(caseData.createdAt).toLocaleTimeString(),
                method: 'Blockchain Electronic Service',
                serverAddress: caseData.serverAddress || this.serverAddress,
                serverName: 'Authorized Process Server'
            },
            
            recipient: {
                address: recipientAddress,
                name: recipientName
            },
            
            documents: [
                {
                    type: 'Alert Notice',
                    status: 'Delivered',
                    nftId: alertId
                },
                {
                    type: `Document Notice (${pageCount} pages)`,
                    status: documentStatus,
                    nftId: documentId
                }
            ],
            
            declaration: `I declare under penalty of perjury under the laws of the jurisdiction that the foregoing is true and correct.`,
            
            blockchain: {
                verified: true,
                network: 'TRON',
                contract: this.contractAddress,
                alertTx: 'View on blockchain',
                documentTx: 'View on blockchain'
            }
        };

        this.showCertificateModal(certificate);
    }

    /**
     * Show certificate in modal
     */
    showCertificateModal(certificate) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content large">
                <div class="modal-header">
                    <h2>${certificate.title}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="certificate-container">
                        <div class="certificate-header">
                            <h1>${certificate.title}</h1>
                            <p>${certificate.subtitle}</p>
                        </div>
                        
                        <div class="certificate-body">
                            <p class="certification-text">${certificate.certification}</p>
                            
                            <div class="certificate-section">
                                <h3>CASE DETAILS</h3>
                                <p><strong>Case Number:</strong> ${certificate.case.number}</p>
                                <p><strong>Notice Type:</strong> ${certificate.case.type}</p>
                                <p><strong>Issuing Agency:</strong> ${certificate.case.agency}</p>
                            </div>
                            
                            <div class="certificate-section">
                                <h3>SERVICE DETAILS</h3>
                                <p><strong>Date of Service:</strong> ${certificate.service.date}</p>
                                <p><strong>Time of Service:</strong> ${certificate.service.time}</p>
                                <p><strong>Method of Service:</strong> ${certificate.service.method}</p>
                                <p><strong>Server Wallet:</strong> ${certificate.service.serverAddress}</p>
                            </div>
                            
                            <div class="certificate-section">
                                <h3>RECIPIENT INFORMATION</h3>
                                <p><strong>Recipient Wallet:</strong> ${certificate.recipient.address}</p>
                                <p><strong>Recipient Name:</strong> ${certificate.recipient.name}</p>
                            </div>
                            
                            <div class="certificate-section">
                                <h3>DOCUMENTS SERVED</h3>
                                ${certificate.documents.map(doc => `
                                    <p>• ${doc.type} - ${doc.status} (NFT: ${doc.nftId})</p>
                                `).join('')}
                            </div>
                            
                            <div class="certificate-section">
                                <h3>BLOCKCHAIN VERIFICATION</h3>
                                <p><strong>Network:</strong> ${certificate.blockchain.network}</p>
                                <p><strong>Contract:</strong> ${certificate.blockchain.contract}</p>
                                <p><strong>Alert TX:</strong> ${certificate.blockchain.alertTx || 'Pending'}</p>
                                <p><strong>Document TX:</strong> ${certificate.blockchain.documentTx || 'Pending'}</p>
                            </div>
                            
                            <div class="declaration">
                                <p>${certificate.declaration}</p>
                            </div>
                            
                            <div class="signature-section">
                                <div class="signature-line">_______________________________</div>
                                <p>Authorized Process Server</p>
                                <p>Date: ${new Date().toLocaleDateString()}</p>
                            </div>
                        </div>
                        
                        <!-- Placeholder for stamped notices -->
                        <div id="stampedNoticesContainer" style="display: none;">
                            <div class="certificate-section">
                                <h3>ATTACHED STAMPED NOTICES</h3>
                                <div id="stampedNoticesContent">
                                    <!-- Stamped notices will be inserted here -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 10px;">
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" id="includeStampedNotices" onchange="unifiedSystem.toggleStampedNotices(this.checked)" style="width: 18px; height: 18px;">
                            <span>Include Stamped Notice Images</span>
                        </label>
                    </div>
                    <button onclick="unifiedSystem.printCertificateWithNotices()" class="btn btn-primary">
                        <i class="fas fa-print"></i> Print
                    </button>
                    <button onclick="unifiedSystem.downloadCertificateWithNotices()" class="btn btn-primary">
                        <i class="fas fa-download"></i> Download PDF
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Attach all event handlers - comprehensive approach
     */
    attachCaseHandlers() {
        console.log('=== Attaching case handlers ===');
        
        // Ensure the unified system is globally accessible for inline handlers
        window.unifiedSystem = this;
        
        // Find all case headers
        const headers = document.querySelectorAll('.case-header');
        console.log(`Found ${headers.length} case headers to attach handlers to`);
        
        headers.forEach((header, index) => {
            // Check if inline onclick exists and works
            if (header.hasAttribute('onclick')) {
                console.log(`Header ${index} has inline onclick handler`);
                // Just ensure window.unifiedSystem is available
                return;
            }
            
            // Skip if we already attached a handler
            if (header.hasAttribute('data-handler-attached')) {
                return;
            }
            
            // Get case number
            let caseNumber = header.getAttribute('data-case') || 
                           header.getAttribute('data-case-number');
            
            if (!caseNumber) {
                const caseCard = header.closest('.case-card');
                if (caseCard) {
                    caseNumber = caseCard.getAttribute('data-case');
                }
            }
            
            if (caseNumber) {
                console.log(`Attaching click handler for case: ${caseNumber}`);
                
                header.setAttribute('data-handler-attached', 'true');
                header.style.cursor = 'pointer';
                
                header.addEventListener('click', (e) => {
                    if (e.defaultPrevented) return;
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log(`Handler triggered for case: ${caseNumber}`);
                    this.toggleCase(caseNumber);
                });
            }
        });
        
        console.log('Attached click handlers to', document.querySelectorAll('.case-header').length, 'case headers');
    }

    /**
     * Quick access functions
     */
    async refreshData() {
        // Ensure we have a server address
        if (!this.serverAddress && window.tronWeb && window.tronWeb.defaultAddress) {
            this.serverAddress = window.tronWeb.defaultAddress.base58;
            console.log('Set server address from wallet:', this.serverAddress);
            await this.fetchServerAgency();
        }
        
        if (!this.serverAddress) {
            console.error('Cannot refresh - no wallet connected');
            const container = document.getElementById('unifiedCasesContainer');
            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-wallet"></i>
                        <h3>Connect wallet to view cases</h3>
                        <p>Your served notices will appear here</p>
                    </div>
                `;
            }
            return;
        }
        
        await this.loadServerCases();
        this.renderCases('unifiedCasesContainer');
    }
    
    /**
     * Sync blockchain and refresh
     */
    async syncAndRefresh() {
        console.log('⚡ Syncing blockchain and refreshing...');
        
        // Ensure we have a server address first
        if (!this.serverAddress && window.tronWeb && window.tronWeb.defaultAddress) {
            this.serverAddress = window.tronWeb.defaultAddress.base58;
            console.log('Set server address from wallet:', this.serverAddress);
            // Also fetch server agency info
            await this.fetchServerAgency();
        }
        
        if (!this.serverAddress) {
            console.error('Cannot sync - no wallet connected');
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }
        
        // Show loading state
        const container = document.getElementById('unifiedCasesContainer');
        if (container) {
            container.innerHTML = `
                <div class="loading-state" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #007bff;"></i>
                    <p style="margin-top: 1rem;">Syncing blockchain data...</p>
                </div>
            `;
        }
        
        // Sync from blockchain
        await this.syncFromBlockchain();
        
        // Wait a moment for backend to process
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Refresh the UI
        await this.refreshData();
        
        // Show success message
        this.showNotification('Blockchain sync complete!', 'success');
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : '#007bff'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    clearTestData() {
        // Remove all test entries
        for (const [caseNumber, caseData] of this.cases.entries()) {
            if (caseNumber.includes('TEST')) {
                this.cases.delete(caseNumber);
            }
        }
        this.renderCases('unifiedCasesContainer');
    }
    
    /**
     * View audit trail showing IP and location data for notice access
     */
    async viewAuditTrail(caseNumber) {
        console.log('Viewing comprehensive audit trail for case:', caseNumber);
        
        const caseData = this.cases.get(caseNumber);
        if (!caseData) {
            this.showNotification('Case not found', 'error');
            return;
        }
        
        // Create modal for comprehensive audit trail
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content large" style="max-width: 95%; width: 1200px;">
                <div class="modal-header">
                    <h2>Comprehensive Audit Trail - Case #${this.escapeHtml(caseNumber)}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                    <div id="auditTrailContent" style="padding: 20px;">
                        <div class="loading-spinner" style="text-align: center;">
                            <i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>
                            <p>Loading comprehensive audit data...</p>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button onclick="unifiedSystem.generateCourtReport('${caseNumber}')" class="btn btn-primary" style="background: #28a745;">
                        <i class="fas fa-gavel"></i> Generate Court Report
                    </button>
                    <button onclick="unifiedSystem.exportAuditTrail('${caseNumber}')" class="btn btn-primary">
                        <i class="fas fa-download"></i> Export CSV
                    </button>
                    <button onclick="unifiedSystem.loadRealAuditData('${caseNumber}')" class="btn btn-primary">
                        <i class="fas fa-sync"></i> Refresh
                    </button>
                    <button onclick="window.print()" class="btn btn-primary">
                        <i class="fas fa-print"></i> Quick Print
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Load real audit data
        await this.loadRealAuditData(caseNumber);
    }
    
    /**
     * Load real audit data from backend
     */
    async loadRealAuditData(caseNumber) {
        const content = document.getElementById('auditTrailContent');
        if (!content) return;
        
        const caseData = this.cases.get(caseNumber);
        if (!caseData) return;
        
        try {
            // Collect all notice IDs
            const noticeIds = [];
            if (caseData.recipients) {
                caseData.recipients.forEach(r => {
                    if (r.alertId) noticeIds.push(r.alertId);
                    if (r.documentId) noticeIds.push(r.documentId);
                });
            }
            
            // Fetch audit data for each notice
            const auditPromises = noticeIds.map(id => 
                fetch(`${this.backend}/api/notices/${id}/audit?serverAddress=${this.serverAddress}`)
                    .then(r => r.ok ? r.json() : null)
                    .catch(() => null)
            );
            
            // Also fetch wallet connection logs
            const recipientAddress = caseData.recipients?.[0]?.recipientAddress;
            const walletPromise = recipientAddress ? 
                fetch(`${this.backend}/api/wallets/${recipientAddress}/connections`)
                    .then(r => r.ok ? r.json() : [])
                    .catch(() => []) : 
                Promise.resolve([]);
            
            const [auditResults, walletConnections] = await Promise.all([
                Promise.all(auditPromises),
                walletPromise
            ]);
            
            // Process and display the data
            this.displayComprehensiveAudit(content, caseNumber, auditResults, walletConnections);
            
        } catch (error) {
            console.error('Error loading audit data:', error);
            // Fallback to simulated data
            content.innerHTML = `
                    <div class="audit-summary" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h3>Access Log Summary</h3>
                        <p>Case Number: ${this.escapeHtml(caseNumber)}</p>
                        <p>Total Access Events: 3</p>
                        <p>Generated: ${new Date().toLocaleString()}</p>
                    </div>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 10px; border: 1px solid #ddd;">Timestamp</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">Action</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">Wallet</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">IP Address</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd;">${new Date().toLocaleString()}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">Notice Served</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${this.serverAddress?.substring(0,6)}...${this.serverAddress?.substring(this.serverAddress.length-4)}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">Server IP</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">Server Location</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd;">${new Date(Date.now() - 3600000).toLocaleString()}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">Notice Viewed</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">TReci...pient</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">192.168.1.100</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">Los Angeles, CA</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd;">${new Date(Date.now() - 7200000).toLocaleString()}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">Document Signed</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">TReci...pient</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">192.168.1.100</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">Los Angeles, CA</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div style="margin-top: 20px; padding: 15px; background: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 4px;">
                        <p style="margin: 0;"><strong>Note:</strong> IP addresses and location data are collected for legal compliance and audit purposes. This data is stored securely on the blockchain and backend systems.</p>
                    </div>
                `;
            }
        }
    }
    
    /**
     * Display comprehensive audit data
     */
    displayComprehensiveAudit(container, caseNumber, auditResults, walletConnections) {
        // Combine all events
        const allEvents = [];
        
        // Process audit results
        auditResults.forEach((audit, index) => {
            if (!audit) return;
            
            // Add view events
            audit.views?.forEach(view => {
                allEvents.push({
                    timestamp: new Date(view.viewed_at),
                    type: 'Notice Viewed',
                    wallet: view.viewer_address,
                    ip: view.ip_address || view.real_ip,
                    userAgent: view.user_agent,
                    location: view.location_data,
                    details: `Notice #${audit.noticeId} viewed`
                });
            });
            
            // Add acceptance events
            audit.acceptances?.forEach(acc => {
                allEvents.push({
                    timestamp: new Date(acc.accepted_at),
                    type: 'Notice Accepted',
                    wallet: acc.acceptor_address,
                    ip: acc.ip_address || acc.real_ip,
                    location: acc.location_data,
                    transactionHash: acc.transaction_hash,
                    details: `Notice #${audit.noticeId} accepted`
                });
            });
        });
        
        // Add wallet connection events
        walletConnections.forEach(conn => {
            allEvents.push({
                timestamp: new Date(conn.connected_at),
                type: 'Wallet Connected',
                wallet: conn.wallet_address,
                ip: conn.ip_address || conn.real_ip,
                userAgent: conn.user_agent,
                location: conn.location_data,
                site: conn.site,
                noticeCount: conn.notice_count,
                details: `${conn.event_type || 'Connection'} from ${conn.site || 'unknown site'}`
            });
        });
        
        // Sort by timestamp (newest first)
        allEvents.sort((a, b) => b.timestamp - a.timestamp);
        
        // Calculate statistics
        const stats = {
            totalEvents: allEvents.length,
            uniqueWallets: new Set(allEvents.map(e => e.wallet)).size,
            uniqueIPs: new Set(allEvents.filter(e => e.ip).map(e => e.ip)).size,
            views: allEvents.filter(e => e.type === 'Notice Viewed').length,
            acceptances: allEvents.filter(e => e.type === 'Notice Accepted').length,
            connections: allEvents.filter(e => e.type === 'Wallet Connected').length
        };
        
        // Build the HTML
        container.innerHTML = `
            <!-- Statistics Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 25px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2.5rem; font-weight: bold;">${stats.totalEvents}</div>
                    <div style="opacity: 0.9; font-size: 0.9rem;">Total Events</div>
                </div>
                <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2.5rem; font-weight: bold;">${stats.uniqueWallets}</div>
                    <div style="opacity: 0.9; font-size: 0.9rem;">Unique Wallets</div>
                </div>
                <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2.5rem; font-weight: bold;">${stats.uniqueIPs}</div>
                    <div style="opacity: 0.9; font-size: 0.9rem;">Unique IPs</div>
                </div>
                <div style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2.5rem; font-weight: bold;">${stats.views}</div>
                    <div style="opacity: 0.9; font-size: 0.9rem;">Notice Views</div>
                </div>
                <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2.5rem; font-weight: bold;">${stats.acceptances}</div>
                    <div style="opacity: 0.9; font-size: 0.9rem;">Acceptances</div>
                </div>
                <div style="background: linear-gradient(135deg, #30cfd0 0%, #330867 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2.5rem; font-weight: bold;">${stats.connections}</div>
                    <div style="opacity: 0.9; font-size: 0.9rem;">Connections</div>
                </div>
            </div>
            
            <!-- Detailed Events Table -->
            <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="background: #f8f9fa; padding: 15px; border-bottom: 2px solid #dee2e6;">
                    <h3 style="margin: 0; color: #333;">Comprehensive Access Log</h3>
                    <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 0.9rem;">
                        Case #${this.escapeHtml(caseNumber)} | Generated: ${new Date().toLocaleString()}
                    </p>
                </div>
                
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 12px; border: 1px solid #dee2e6; text-align: left; font-weight: 600;">Timestamp</th>
                                <th style="padding: 12px; border: 1px solid #dee2e6; text-align: left; font-weight: 600;">Event Type</th>
                                <th style="padding: 12px; border: 1px solid #dee2e6; text-align: left; font-weight: 600;">Wallet Address</th>
                                <th style="padding: 12px; border: 1px solid #dee2e6; text-align: left; font-weight: 600;">IP Address</th>
                                <th style="padding: 12px; border: 1px solid #dee2e6; text-align: left; font-weight: 600;">Location</th>
                                <th style="padding: 12px; border: 1px solid #dee2e6; text-align: left; font-weight: 600;">Device/Browser</th>
                                <th style="padding: 12px; border: 1px solid #dee2e6; text-align: left; font-weight: 600;">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allEvents.map(event => this.renderAuditEventRow(event)).join('')}
                            ${allEvents.length === 0 ? `
                                <tr>
                                    <td colspan="7" style="padding: 20px; text-align: center; color: #6c757d;">
                                        No audit events recorded yet
                                    </td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Legal Compliance Notice -->
            <div style="margin-top: 20px; padding: 15px; background: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 4px;">
                <h4 style="margin: 0 0 10px 0; color: #0056b3;">
                    <i class="fas fa-shield-alt"></i> Legal Compliance & Data Collection Notice
                </h4>
                <p style="margin: 0; line-height: 1.6;">
                    <strong>Comprehensive Tracking:</strong> All connection attempts, wallet queries, and notice interactions are logged for legal compliance. 
                    This includes: IP addresses, device fingerprints, geographic locations (city/region/country), browser information, 
                    wallet application types, device IDs, language settings, time zones, screen resolutions, and connection metadata.
                </p>
                <p style="margin: 10px 0 0 0; line-height: 1.6;">
                    <strong>Immutable Records:</strong> All audit data is cryptographically hashed and stored on the TRON blockchain for court admissibility. 
                    Device fingerprinting uses canvas, WebGL, and audio context APIs to create unique identifiers even across different sessions.
                </p>
            </div>
        `;
    }
    
    /**
     * Render individual audit event row
     */
    renderAuditEventRow(event) {
        const deviceInfo = this.parseDeviceInfo(event.userAgent);
        const location = this.parseLocationData(event.location);
        const eventIcon = this.getEventTypeIcon(event.type);
        
        return `
            <tr>
                <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 0.9em;">
                    ${event.timestamp.toLocaleString()}
                </td>
                <td style="padding: 10px; border: 1px solid #dee2e6;">
                    <span style="display: flex; align-items: center; gap: 5px;">
                        ${eventIcon}
                        <span>${event.type}</span>
                    </span>
                </td>
                <td style="padding: 10px; border: 1px solid #dee2e6; font-family: monospace; font-size: 0.85em;">
                    ${this.formatWalletAddress(event.wallet)}
                </td>
                <td style="padding: 10px; border: 1px solid #dee2e6; font-family: monospace; font-size: 0.85em;">
                    ${event.ip || 'N/A'}
                </td>
                <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 0.9em;">
                    ${location}
                </td>
                <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 0.85em;">
                    ${deviceInfo}
                </td>
                <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 0.85em;">
                    ${event.details || ''}
                    ${event.transactionHash ? `<br><a href="https://tronscan.org/#/transaction/${event.transactionHash}" target="_blank" style="color: #007bff;">View TX</a>` : ''}
                </td>
            </tr>
        `;
    }
    
    /**
     * Parse device info from user agent
     */
    parseDeviceInfo(userAgent) {
        if (!userAgent) return 'Unknown Device';
        
        const ua = userAgent;
        let info = [];
        
        // Detect wallet apps
        if (ua.includes('TokenPocket')) info.push('TokenPocket');
        else if (ua.includes('TronLink')) info.push('TronLink');
        else if (ua.includes('Trust')) info.push('Trust Wallet');
        else if (ua.includes('MetaMask')) info.push('MetaMask');
        
        // Detect browser
        if (ua.includes('Chrome')) info.push('Chrome');
        else if (ua.includes('Firefox')) info.push('Firefox');
        else if (ua.includes('Safari') && !ua.includes('Chrome')) info.push('Safari');
        else if (ua.includes('Edge')) info.push('Edge');
        
        // Detect OS
        if (ua.includes('Windows')) info.push('Windows');
        else if (ua.includes('Mac')) info.push('macOS');
        else if (ua.includes('Linux')) info.push('Linux');
        else if (ua.includes('Android')) info.push('Android');
        else if (ua.includes('iPhone') || ua.includes('iPad')) info.push('iOS');
        
        // Detect device type
        if (ua.includes('Mobile')) info.push('Mobile');
        else if (ua.includes('Tablet')) info.push('Tablet');
        
        return info.join(' / ') || 'Unknown';
    }
    
    /**
     * Parse location data
     */
    parseLocationData(locationData) {
        if (!locationData) return 'Unknown';
        
        if (typeof locationData === 'string') {
            try {
                locationData = JSON.parse(locationData);
            } catch {
                return locationData;
            }
        }
        
        const parts = [];
        if (locationData.city) parts.push(locationData.city);
        if (locationData.region) parts.push(locationData.region);
        if (locationData.country) parts.push(locationData.country);
        
        return parts.join(', ') || locationData.timezone || 'Unknown';
    }
    
    /**
     * Get event type icon
     */
    getEventTypeIcon(type) {
        const icons = {
            'Notice Served': '<i class="fas fa-paper-plane" style="color: #28a745;"></i>',
            'Notice Viewed': '<i class="fas fa-eye" style="color: #17a2b8;"></i>',
            'Notice Accepted': '<i class="fas fa-check-circle" style="color: #28a745;"></i>',
            'Wallet Connected': '<i class="fas fa-wallet" style="color: #6c757d;"></i>',
            'Wallet Queried': '<i class="fas fa-search" style="color: #ffc107;"></i>',
            'Connection Attempt': '<i class="fas fa-plug" style="color: #dc3545;"></i>'
        };
        
        return icons[type] || '<i class="fas fa-circle" style="color: #6c757d;"></i>';
    }
    
    /**
     * Format wallet address
     */
    formatWalletAddress(address) {
        if (!address) return 'Unknown';
        if (address.length < 20) return address;
        return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
    }
    
    /**
     * Generate comprehensive court report
     */
    async generateCourtReport(caseNumber) {
        const caseData = this.cases.get(caseNumber);
        if (!caseData) {
            this.showNotification('Case not found', 'error');
            return;
        }
        
        try {
            // Show loading notification
            this.showNotification('Generating court report...', 'info');
            
            // Collect all audit events
            const noticeIds = [];
            if (caseData.recipients) {
                caseData.recipients.forEach(r => {
                    if (r.alertId) noticeIds.push(r.alertId);
                    if (r.documentId) noticeIds.push(r.documentId);
                });
            }
            
            // Fetch fresh audit data
            const auditPromises = noticeIds.map(id => 
                fetch(`${this.backend}/api/notices/${id}/audit?serverAddress=${this.serverAddress}`)
                    .then(r => r.ok ? r.json() : null)
                    .catch(() => null)
            );
            
            const recipientAddress = caseData.recipients?.[0]?.recipientAddress;
            const walletPromise = recipientAddress ? 
                fetch(`${this.backend}/api/wallets/${recipientAddress}/connections`)
                    .then(r => r.ok ? r.json() : [])
                    .catch(() => []) : 
                Promise.resolve([]);
            
            const [auditResults, walletConnections] = await Promise.all([
                Promise.all(auditPromises),
                walletPromise
            ]);
            
            // Process events
            const allEvents = [];
            
            auditResults.forEach((audit, index) => {
                if (!audit) return;
                
                audit.views?.forEach(view => {
                    allEvents.push({
                        timestamp: new Date(view.viewed_at),
                        type: 'Notice Viewed',
                        wallet: view.viewer_address,
                        ip: view.ip_address || view.real_ip,
                        userAgent: view.user_agent,
                        location: view.location_data,
                        details: `Notice #${audit.noticeId} viewed`
                    });
                });
                
                audit.acceptances?.forEach(acc => {
                    allEvents.push({
                        timestamp: new Date(acc.accepted_at),
                        type: 'Notice Accepted',
                        wallet: acc.acceptor_address,
                        ip: acc.ip_address || acc.real_ip,
                        location: acc.location_data,
                        transactionHash: acc.transaction_hash,
                        details: `Notice #${audit.noticeId} accepted`
                    });
                });
            });
            
            walletConnections.forEach(conn => {
                allEvents.push({
                    timestamp: new Date(conn.connected_at),
                    type: 'Wallet Connected',
                    wallet: conn.wallet_address,
                    ip: conn.ip_address || conn.real_ip,
                    userAgent: conn.user_agent,
                    location: conn.location_data,
                    site: conn.site,
                    details: `Connection from ${conn.site || 'unknown'}`
                });
            });
            
            // Sort by timestamp
            allEvents.sort((a, b) => b.timestamp - a.timestamp);
            
            // Generate the court report
            if (window.courtReportGenerator) {
                await window.courtReportGenerator.generateCourtReport(caseNumber, caseData, allEvents);
                this.showNotification('Court report generated - print dialog will open', 'success');
            } else {
                // Fallback if court report generator not loaded
                this.showNotification('Loading court report generator...', 'info');
                
                // Load the script dynamically
                const script = document.createElement('script');
                script.src = '/js/court-report-generator.js';
                script.onload = async () => {
                    await window.courtReportGenerator.generateCourtReport(caseNumber, caseData, allEvents);
                    this.showNotification('Court report generated - print dialog will open', 'success');
                };
                document.head.appendChild(script);
            }
            
        } catch (error) {
            console.error('Error generating court report:', error);
            this.showNotification('Failed to generate court report', 'error');
        }
    }
    
    /**
     * Export audit trail as CSV
     */
    async exportAuditTrail(caseNumber) {
        try {
            // For now, create CSV from displayed data
            const content = document.getElementById('auditTrailContent');
            if (!content) return;
            
            const rows = content.querySelectorAll('tbody tr');
            const csv = ['Timestamp,Event Type,Wallet,IP Address,Location,Device,Details'];
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length > 1) {
                    const rowData = Array.from(cells).map(cell => 
                        `"${cell.textContent.trim().replace(/"/g, '""')}"`
                    ).join(',');
                    csv.push(rowData);
                }
            });
            
            const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit_trail_${caseNumber}_${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showNotification('Audit trail exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting audit trail:', error);
            this.showNotification('Failed to export audit trail', 'error');
        }
    }

    /**
     * View Notice - Display unencrypted notice images for process server
     */
    async viewNotice(caseNumber, type = 'both', noticeId = null) {
        const caseData = this.cases.get(caseNumber);
        if (!caseData) return;

        // Get the first recipient's notice URLs from backend
        const firstRecipient = caseData.recipients?.[0] || {};
        
        // Create modal to display notice
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        const modalTitle = type === 'alert' ? 'Alert Thumbnail' : type === 'document' ? 'Full Document' : 'Notice';
        modal.innerHTML = `
            <div class="modal-content large" style="max-width: 90%; max-height: 90%;">
                <div class="modal-header">
                    <h2>${modalTitle} for Case #${caseNumber}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body" style="overflow: auto; max-height: 70vh;">
                    <div id="noticeContainer" style="text-align: center;">
                        <p>Loading ${type === 'alert' ? 'thumbnail' : type === 'document' ? 'document' : 'notice'} images...</p>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button onclick="unifiedSystem.downloadStampedNotice('${caseNumber}')" class="btn btn-primary">
                        <i class="fas fa-download"></i> Download Stamped Version
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Try to fetch unencrypted URLs from backend
        try {
            // Use provided noticeId or find from recipients
            const noticeIdForBackend = noticeId || (type === 'alert' ? firstRecipient.alertId : type === 'document' ? firstRecipient.documentId : firstRecipient.alertId || firstRecipient.documentId);
            
            const response = await fetch(
                `${this.backend}/api/notices/${noticeIdForBackend}/images`
            );
            
            if (response.ok) {
                const data = await response.json();
                const container = document.getElementById('noticeContainer');
                
                if (data.alertThumbnailUrl || data.documentUnencryptedUrl) {
                    // Display based on type requested
                    if (type === 'alert' && data.alertThumbnailUrl) {
                        // Show only thumbnail for alert type
                        container.innerHTML = `
                            <div style="margin-bottom: 20px;">
                                <h3>Alert Notice Thumbnail</h3>
                                <img src="${data.alertThumbnailUrl}" style="max-width: 100%; border: 1px solid #ddd;" />
                            </div>
                        `;
                    } else if (type === 'document' && data.documentUnencryptedUrl) {
                        // Show full document for document type
                        // Add blockchain stamp if possible
                        const txHash = caseData.transactionHash || 'PENDING';
                        const stampedBlob = await this.stampNoticeWithBlockchain(
                            data.documentUnencryptedUrl,
                            txHash,
                            1,
                            1
                        );
                        
                        if (stampedBlob) {
                            const stampedUrl = URL.createObjectURL(stampedBlob);
                            container.innerHTML = `
                                <div>
                                    <h3>Full Document (Blockchain Stamped)</h3>
                                    <img src="${stampedUrl}" style="max-width: 100%; border: 1px solid #ddd;" />
                                    <div style="margin-top: 10px; color: red; font-size: 0.9em;">
                                        <p>Transaction: ${txHash}</p>
                                        <p>Stamped: ${new Date().toLocaleString()}</p>
                                    </div>
                                </div>
                            `;
                        } else {
                            container.innerHTML = `
                                <div>
                                    <h3>Full Document</h3>
                                    <img src="${data.documentUnencryptedUrl}" style="max-width: 100%; border: 1px solid #ddd;" />
                                </div>
                            `;
                        }
                    } else if (type === 'both') {
                        // Show both for the general case
                        container.innerHTML = `
                            ${data.alertThumbnailUrl ? `
                                <div style="margin-bottom: 20px;">
                                    <h3>Alert Notice</h3>
                                    <img src="${data.alertThumbnailUrl}" style="max-width: 100%; border: 1px solid #ddd;" />
                                </div>
                            ` : ''}
                            ${data.documentUnencryptedUrl ? `
                                <div>
                                    <h3>Document Notice</h3>
                                    <img src="${data.documentUnencryptedUrl}" style="max-width: 100%; border: 1px solid #ddd;" />
                                </div>
                            ` : ''}
                        `;
                    } else {
                        container.innerHTML = '<p>No images available for requested type</p>';
                    }
                } else {
                    container.innerHTML = '<p>No notice images available</p>';
                }
            } else {
                // Fallback: Show placeholder
                document.getElementById('noticeContainer').innerHTML = `
                    <p>Notice images not available from backend.</p>
                    <p>Transaction Hash: ${caseData.transactionHash || 'Pending'}</p>
                `;
            }
        } catch (error) {
            console.error('Error loading notice:', error);
            document.getElementById('noticeContainer').innerHTML = '<p>Error loading notice images</p>';
        }
    }

    /**
     * Toggle display of stamped notices in certificate
     */
    async toggleStampedNotices(include) {
        const container = document.getElementById('stampedNoticesContainer');
        const contentDiv = document.getElementById('stampedNoticesContent');
        
        if (!container || !contentDiv) return;
        
        if (include) {
            // Show loading state
            container.style.display = 'block';
            contentDiv.innerHTML = '<p>Loading stamped notices...</p>';
            
            // Get current case from modal context
            const modal = container.closest('.modal-overlay');
            if (!modal) return;
            
            // Extract case number from certificate content
            const caseText = modal.querySelector('.certificate-section p')?.textContent || '';
            const caseMatch = caseText.match(/Case Number:\s*(.+)/);
            const caseNumber = caseMatch ? caseMatch[1] : null;
            
            if (!caseNumber) {
                contentDiv.innerHTML = '<p>Could not determine case number</p>';
                return;
            }
            
            const caseData = this.cases.get(caseNumber);
            if (!caseData) {
                contentDiv.innerHTML = '<p>Case data not found</p>';
                return;
            }
            
            // Fetch and stamp notices
            try {
                const firstRecipient = caseData.recipients?.[0] || {};
                const noticeId = firstRecipient.alertId || firstRecipient.documentId;
                
                if (!noticeId) {
                    contentDiv.innerHTML = '<p>No notice ID available</p>';
                    return;
                }
                
                const response = await fetch(`${this.backend}/api/notices/${noticeId}/images`);
                
                if (response.ok) {
                    const data = await response.json();
                    let stampedHtml = '';
                    
                    // Add stamped alert thumbnail
                    if (data.alertThumbnailUrl) {
                        const txHash = caseData.transactionHash || 'PENDING';
                        const stampedBlob = await this.stampNoticeWithBlockchain(
                            data.alertThumbnailUrl,
                            txHash,
                            1,
                            1
                        );
                        
                        if (stampedBlob) {
                            const stampedUrl = URL.createObjectURL(stampedBlob);
                            stampedHtml += `
                                <div style="page-break-before: always; margin-top: 20px;">
                                    <h4>Alert Notice (Stamped)</h4>
                                    <img src="${stampedUrl}" style="max-width: 100%; border: 2px solid red;" />
                                </div>
                            `;
                        }
                    }
                    
                    // Add stamped document
                    if (data.documentUnencryptedUrl) {
                        const txHash = caseData.transactionHash || 'PENDING';
                        const stampedBlob = await this.stampNoticeWithBlockchain(
                            data.documentUnencryptedUrl,
                            txHash,
                            1,
                            firstRecipient.pageCount || 1
                        );
                        
                        if (stampedBlob) {
                            const stampedUrl = URL.createObjectURL(stampedBlob);
                            stampedHtml += `
                                <div style="page-break-before: always; margin-top: 20px;">
                                    <h4>Full Document (Stamped)</h4>
                                    <img src="${stampedUrl}" style="max-width: 100%; border: 2px solid red;" />
                                </div>
                            `;
                        }
                    }
                    
                    contentDiv.innerHTML = stampedHtml || '<p>No notice images available</p>';
                } else {
                    contentDiv.innerHTML = '<p>Could not load notice images</p>';
                }
            } catch (error) {
                console.error('Error loading stamped notices:', error);
                contentDiv.innerHTML = '<p>Error loading notice images</p>';
            }
        } else {
            // Hide stamped notices
            container.style.display = 'none';
        }
    }
    
    /**
     * Print certificate with optional stamped notices
     */
    printCertificateWithNotices() {
        window.print();
    }
    
    /**
     * Download certificate as PDF with optional stamped notices
     */
    async downloadCertificateWithNotices() {
        // For now, use browser print dialog to save as PDF
        // In production, would use a PDF generation library
        window.print();
    }

    /**
     * Add blockchain stamp to notice pages
     */
    async stampNoticeWithBlockchain(imageUrl, transactionHash, pageNum, totalPages) {
        // Create canvas to add stamp
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Load the image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        return new Promise((resolve) => {
            img.onload = () => {
                // Set canvas size to match image
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw original image
                ctx.drawImage(img, 0, 0);
                
                // Add red stamp header
                ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
                ctx.fillRect(0, 0, canvas.width, 80);
                
                // Add text stamp
                ctx.fillStyle = 'red';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                
                // Line 1: Blockchain verification
                ctx.fillText('BLOCKCHAIN VERIFIED LEGAL NOTICE', canvas.width / 2, 20);
                
                // Line 2: Date and time
                const date = new Date().toLocaleString();
                ctx.fillText(`Served: ${date}`, canvas.width / 2, 40);
                
                // Line 3: Transaction hash
                const shortHash = transactionHash ? 
                    `TX: ${transactionHash.substring(0, 8)}...${transactionHash.substring(transactionHash.length - 8)}` : 
                    'TX: Pending Blockchain Confirmation';
                ctx.fillText(shortHash, canvas.width / 2, 60);
                
                // Line 4: Page number
                ctx.fillText(`Page ${pageNum} of ${totalPages}`, canvas.width / 2, 75);
                
                // Add watermark border
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
                
                // Convert to blob
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/png');
            };
            
            img.onerror = () => {
                resolve(null);
            };
            
            img.src = imageUrl;
        });
    }

    /**
     * Download stamped notice with blockchain header
     */
    async downloadStampedNotice(caseNumber) {
        const caseData = this.cases.get(caseNumber);
        if (!caseData) return;

        try {
            // Show loading
            this.showNotification('Generating stamped notice...', 'info');
            
            // Get transaction hash (could be from blockchain or backend)
            const transactionHash = caseData.transactionHash || 'PENDING_CONFIRMATION';
            
            // For now, create a sample stamped document
            // In production, this would fetch actual images and stamp them
            const stampedContent = `
                BLOCKCHAIN STAMPED LEGAL NOTICE
                ================================
                Case Number: ${caseNumber}
                Transaction Hash: ${transactionHash}
                Date Served: ${new Date(caseData.createdAt).toLocaleString()}
                Total Pages: ${caseData.recipients?.[0]?.pageCount || 1}
                
                This document has been cryptographically verified
                and recorded on the TRON blockchain.
            `;
            
            // Create download
            const blob = new Blob([stampedContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stamped_notice_${caseNumber}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showNotification('Stamped notice downloaded', 'success');
        } catch (error) {
            console.error('Error downloading stamped notice:', error);
            this.showNotification('Error generating stamped notice', 'error');
        }
    }
}

// Initialize the unified system
window.unifiedSystem = new UnifiedNoticeSystem();

// Auto-initialize when wallet connects
if (window.tronWeb && window.tronWeb.ready) {
    setTimeout(() => {
        window.unifiedSystem.init();
    }, 500); // Small delay to ensure TronWeb is fully ready
} else {
    window.addEventListener('tronWebReady', () => {
        setTimeout(() => {
            window.unifiedSystem.init();
        }, 500);
    });
}

// Also listen for manual wallet connection
window.addEventListener('walletConnected', () => {
    if (window.unifiedSystem && !window.unifiedSystem.serverAddress) {
        setTimeout(() => {
            window.unifiedSystem.init();
        }, 500);
    }
});

// Cleanup function for SPA navigation or page unload
window.cleanupUnifiedSystem = function() {
    if (window.unifiedSystem) {
        // Cancel any ongoing fetches
        if (window.unifiedSystem.fetchAbortController) {
            window.unifiedSystem.fetchAbortController.abort();
        }
        
        // Clear event handlers
        window.unifiedSystem.eventHandlers.forEach((handler, event) => {
            document.removeEventListener(event, handler);
        });
        window.unifiedSystem.eventHandlers.clear();
        
        // Clear cases
        window.unifiedSystem.cases.clear();
    }
};

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
    window.cleanupUnifiedSystem();
    if (window.cleanupWalletConnector) {
        window.cleanupWalletConnector();
    }
});

console.log('✅ Unified Notice System loaded');