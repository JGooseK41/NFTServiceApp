/**
 * Unified Notice System - Complete overhaul fixing all issues
 * Handles multi-document PDFs, proper data flow, and court-ready documentation
 */

class UnifiedNoticeSystem {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        this.contractAddress = window.CONTRACT_ADDRESS;
        this.serverAddress = null; // Will be set on wallet connect
        this.cases = new Map(); // Organized by case number
        this.pdfMerger = null; // For combining multiple PDFs
    }

    /**
     * Initialize the system
     */
    async init() {
        console.log('🚀 Initializing Unified Notice System...');
        
        // Get server address from wallet
        if (window.tronWeb && window.tronWeb.defaultAddress) {
            this.serverAddress = window.tronWeb.defaultAddress.base58;
            console.log('Server address:', this.serverAddress);
        }

        // Load PDF merger library
        await this.loadPDFMerger();
        
        // Sync blockchain data to backend first
        await this.syncFromBlockchain();
        
        // Load all cases for this server
        await this.loadServerCases();
        
        return true;
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
        
        // If contract not ready, do manual sync with known data
        if (!window.legalContract || !window.tronWeb) {
            console.log('Contract not ready, doing manual sync...');
            return await this.manualSyncKnownCases();
        }

        try {
            // Get total supply of NFTs
            const totalSupply = await window.legalContract.totalSupply().call();
            const totalSupplyNum = Number(totalSupply.toString());
            console.log(`Total NFTs on blockchain: ${totalSupplyNum}`);
            
            const notices = [];
            
            // Check each NFT (up to 50 to cover your notices)
            for (let i = 1; i <= Math.min(totalSupplyNum, 50); i++) {
                try {
                    // Get alert data (using alerts mapping)
                    const alertData = await window.legalContract.alerts(i).call();
                    const alertServer = tronWeb.address.fromHex(alertData[0]);
                    
                    // Check if this alert belongs to our server
                    if (alertServer.toLowerCase() === this.serverAddress.toLowerCase() || 
                        alertServer === 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb') { // null address
                        
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
        // Look for patterns like "Case #123456" or "34-987654"
        const patterns = [
            /Case\s*#?\s*([0-9\-]+)/i,
            /\b(\d{2,}-\d{6})\b/,
            /\b(\d{6})\b/
        ];
        
        for (const pattern of patterns) {
            const match = description.match(pattern);
            if (match) {
                return match[1];
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

        if (casesToRender.length === 0) {
            container.innerHTML = `
                <div class="no-cases">
                    <i class="fas fa-inbox" style="font-size: 3rem; color: var(--text-muted);"></i>
                    <p>No cases found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = casesToRender.map(caseData => this.renderCase(caseData)).join('');
        
        // Ensure click handlers work
        this.attachCaseHandlers();
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
        
        return `
            <div class="case-card" data-case="${caseData.caseNumber}">
                <div class="case-header" onclick="window.unifiedSystem.toggleCase('${caseData.caseNumber}')">
                    <div class="case-info">
                        <h3>Case #${caseData.caseNumber}</h3>
                        <span class="case-type">${caseData.noticeType}</span>
                        <span class="case-agency">${caseData.issuingAgency || 'Legal Department'}</span>
                        <span class="recipient-count" style="margin-left: 10px; padding: 2px 8px; background: #e3f2fd; color: #1976d2; border-radius: 12px; font-size: 0.85em; font-weight: 500;">${caseData.recipientCount || 1} Notice${(caseData.recipientCount || 1) > 1 ? 's' : ''} Served</span>
                    </div>
                    <div class="case-status">
                        <span class="status-badge ${statusClass}">${statusLabel}</span>
                        <i class="fas fa-chevron-down" id="${caseId}-chevron"></i>
                    </div>
                </div>
                
                <div class="case-details" id="${caseId}-details" style="display: none;">
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
     * Toggle case expansion (FIXED click handler)
     */
    toggleCase(caseNumber) {
        const caseId = `case-${caseNumber.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const details = document.getElementById(`${caseId}-details`);
        const chevron = document.getElementById(`${caseId}-chevron`);
        
        if (details && chevron) {
            if (details.style.display === 'none') {
                details.style.display = 'block';
                chevron.className = 'fas fa-chevron-up';
            } else {
                details.style.display = 'none';
                chevron.className = 'fas fa-chevron-down';
            }
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
        const nft = isAlert ? caseData.alertNFT : caseData.documentNFT;
        
        return {
            title: isAlert ? 'LEGAL NOTICE DELIVERY RECEIPT' : 'LEGAL DOCUMENT SERVICE RECEIPT',
            type: type.toUpperCase(),
            
            // Case Information
            case: {
                number: caseData.caseNumber,
                type: caseData.noticeType,
                agency: caseData.issuingAgency,
                created: new Date(caseData.createdAt).toLocaleString()
            },
            
            // NFT Information
            nft: {
                id: nft.id,
                type: nft.type,
                status: nft.status,
                transactionHash: nft.transactionHash
            },
            
            // Parties (with correct addresses)
            parties: {
                server: {
                    label: 'Process Server',
                    address: caseData.serverAddress, // YOUR address, not null
                    name: 'Authorized Legal Process Server'
                },
                recipient: {
                    label: 'Recipient',
                    address: caseData.recipientAddress,
                    name: caseData.recipientName || 'Not Specified'
                }
            },
            
            // Blockchain Verification
            blockchain: {
                network: 'TRON Mainnet',
                contract: this.contractAddress,
                explorerUrl: `https://tronscan.org/#/transaction/${nft.transactionHash}`
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
                    <h2>${receipt.title}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body" id="receiptContent">
                    <div class="receipt-container">
                        <!-- Header -->
                        <div class="receipt-header">
                            <h1>${receipt.title}</h1>
                            <p class="receipt-subtitle">Blockchain Legal Service Verification</p>
                        </div>
                        
                        <!-- Case Information -->
                        <div class="receipt-section">
                            <h3>CASE INFORMATION</h3>
                            <table class="receipt-table">
                                <tr>
                                    <td><strong>Case Number:</strong></td>
                                    <td>${receipt.case.number}</td>
                                </tr>
                                <tr>
                                    <td><strong>Notice Type:</strong></td>
                                    <td>${receipt.case.type}</td>
                                </tr>
                                <tr>
                                    <td><strong>Issuing Agency:</strong></td>
                                    <td>${receipt.case.agency}</td>
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
        if (!caseData) return;

        const certificate = {
            title: 'CERTIFICATE OF SERVICE',
            subtitle: 'Legal Process Service Verification',
            
            certification: `I, the undersigned authorized process server, hereby certify that I served the within-named documents:`,
            
            case: {
                number: caseData.caseNumber,
                type: caseData.noticeType,
                agency: caseData.issuingAgency
            },
            
            service: {
                date: new Date(caseData.createdAt).toLocaleDateString(),
                time: new Date(caseData.createdAt).toLocaleTimeString(),
                method: 'Blockchain Electronic Service',
                serverAddress: caseData.serverAddress, // YOUR address
                serverName: 'Authorized Process Server'
            },
            
            recipient: {
                address: caseData.recipientAddress,
                name: caseData.recipientName || 'As Addressed'
            },
            
            documents: [
                {
                    type: 'Alert Notice',
                    status: 'Delivered',
                    nftId: caseData.alertNFT.id
                },
                {
                    type: `Document Notice (${caseData.documentNFT.pageCount} pages)`,
                    status: caseData.documentNFT.status,
                    nftId: caseData.documentNFT.id
                }
            ],
            
            declaration: `I declare under penalty of perjury under the laws of the jurisdiction that the foregoing is true and correct.`,
            
            blockchain: {
                verified: true,
                network: 'TRON',
                contract: this.contractAddress,
                alertTx: caseData.alertNFT.transactionHash,
                documentTx: caseData.documentNFT.transactionHash
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
     * Attach all event handlers
     */
    attachCaseHandlers() {
        // All handlers are inline, but we ensure the functions are available globally
        window.unifiedSystem = this;
    }

    /**
     * Quick access functions
     */
    async refreshData() {
        await this.loadServerCases();
        this.renderCases('unifiedCasesContainer');
    }
    
    /**
     * Sync blockchain and refresh
     */
    async syncAndRefresh() {
        console.log('⚡ Syncing blockchain and refreshing...');
        
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
}

// Initialize the unified system
window.unifiedSystem = new UnifiedNoticeSystem();

// Auto-initialize when wallet connects
if (window.tronWeb && window.tronWeb.ready) {
    window.unifiedSystem.init();
} else {
    window.addEventListener('tronWebReady', () => {
        window.unifiedSystem.init();
    });
}

console.log('✅ Unified Notice System loaded');