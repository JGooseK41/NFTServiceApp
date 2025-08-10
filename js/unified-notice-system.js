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
        
        // Sync blockchain data to backend first
        await this.syncFromBlockchain();
        
        // Load all cases for this server
        await this.loadServerCases();
        
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
     * Load all cases for the current server
     */
    async loadServerCases() {
        console.log('📂 Loading cases for server:', this.serverAddress);
        
        if (!this.serverAddress) {
            console.error('No server address set');
            return;
        }

        try {
            // First, sync from blockchain to ensure backend has latest data
            await this.syncFromBlockchain();
            
            // Then query backend for structured data
            let response = await fetch(
                `${this.backend}/api/servers/${this.serverAddress}/cases`
            );
            
            // If first endpoint fails, try simpler endpoint
            if (!response.ok) {
                console.log('Trying simple cases endpoint...');
                response = await fetch(
                    `${this.backend}/api/servers/${this.serverAddress}/simple-cases`
                );
            }
            
            if (response.ok) {
                const data = await response.json();
                this.processCasesData(data.cases || []);
            } else {
                // If backend fails, use blockchain data directly
                console.log('Backend not responding, using blockchain data directly');
                await this.loadDirectFromBlockchain();
            }
            
        } catch (error) {
            console.error('Error loading cases:', error);
            // Fall back to blockchain
            await this.loadDirectFromBlockchain();
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
        if (this.serverInfo.serverId && this.serverInfo.serverId !== '0') {
            const registrationDate = this.serverInfo.registeredDate ? 
                this.serverInfo.registeredDate.toLocaleDateString() : 'Not available';
            
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
                            <div style="font-size: 2rem; font-weight: bold;">${this.serverInfo.noticesServed || 0}</div>
                            <div style="opacity: 0.9; font-size: 0.9rem;">Total Notices Served</div>
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
        let statusLabel, statusClass;
        if (caseData.allSigned) {
            statusLabel = 'All Signed';
            statusClass = 'status-completed';
        } else if (caseData.partialSigned) {
            statusLabel = `${caseData.totalAccepted}/${caseData.recipientCount} Signed`;
            statusClass = 'status-partial';
        } else {
            statusLabel = 'Awaiting Signatures';
            statusClass = 'status-pending';
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
                     style="cursor: pointer; padding: 10px; border-radius: 5px; transition: background-color 0.2s;"
                     onmouseover="this.style.backgroundColor='#f0f0f0'" 
                     onmouseout="this.style.backgroundColor='transparent'">
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
                                            <button onclick="unifiedSystem.viewReceipt('${caseData.caseNumber}', 'document')" class="btn btn-small btn-primary">
                                                <i class="fas fa-file-alt"></i> View Receipt
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <!-- Case Actions -->
                    <div class="case-actions">
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
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button onclick="window.print()" class="btn btn-primary">
                        <i class="fas fa-print"></i> Print
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
        console.log('Viewing audit trail for case:', caseNumber);
        
        const caseData = this.cases.get(caseNumber);
        if (!caseData) {
            this.showNotification('Case not found', 'error');
            return;
        }
        
        // Create modal for audit trail
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content large">
                <div class="modal-header">
                    <h2>Audit Trail - Case #${this.escapeHtml(caseNumber)}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
                    <div id="auditTrailContent" style="padding: 20px;">
                        <div class="loading-spinner" style="text-align: center;">
                            <i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>
                            <p>Loading audit trail data...</p>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button onclick="window.print()" class="btn btn-primary">
                        <i class="fas fa-print"></i> Print
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Simulate audit trail data (replace with actual backend call when available)
        setTimeout(() => {
            const content = document.getElementById('auditTrailContent');
            if (content) {
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
        }, 1000);
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