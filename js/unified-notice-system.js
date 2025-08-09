/**
 * Unified Notice System - Complete overhaul fixing all issues
 * Handles multi-document PDFs, proper data flow, and court-ready documentation
 */

class UnifiedNoticeSystem {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nft-legal-service-backend.onrender.com';
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
            // ALWAYS query backend by server address first
            const response = await fetch(
                `${this.backend}/api/servers/${this.serverAddress}/cases`
            );
            
            if (response.ok) {
                const data = await response.json();
                this.processCasesData(data.cases || []);
            }
            
            // Then verify with blockchain in background
            this.verifyWithBlockchain();
            
        } catch (error) {
            console.error('Error loading cases:', error);
        }
    }

    /**
     * Process cases data into proper structure
     */
    processCasesData(casesArray) {
        this.cases.clear();
        
        for (const caseData of casesArray) {
            // Ensure each case has both Alert and Document NFTs paired
            const structuredCase = {
                caseNumber: caseData.caseNumber,
                serverAddress: caseData.serverAddress || this.serverAddress,
                recipientAddress: caseData.recipientAddress,
                recipientName: caseData.recipientName || '',
                noticeType: caseData.noticeType,
                issuingAgency: caseData.issuingAgency,
                createdAt: caseData.createdAt,
                
                // Paired NFTs
                alertNFT: {
                    id: caseData.alertId,
                    type: 'ALERT',
                    status: 'DELIVERED',
                    transactionHash: caseData.alertTxHash,
                    deliveredAt: caseData.alertDeliveredAt || caseData.createdAt
                },
                documentNFT: {
                    id: caseData.documentId,
                    type: 'DOCUMENT',
                    status: caseData.documentStatus || 'AWAITING_SIGNATURE',
                    transactionHash: caseData.documentTxHash,
                    signedAt: caseData.documentSignedAt,
                    pageCount: caseData.pageCount || 1
                },
                
                // Tracking data
                viewCount: caseData.viewCount || 0,
                lastViewedAt: caseData.lastViewedAt,
                auditTrail: caseData.auditTrail || []
            };
            
            this.cases.set(caseData.caseNumber, structuredCase);
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
     * Render individual case with paired NFTs
     */
    renderCase(caseData) {
        const caseId = `case-${caseData.caseNumber.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Determine overall case status
        const caseStatus = caseData.documentNFT.status === 'SIGNED' ? 'completed' : 'pending';
        const statusLabel = caseStatus === 'completed' ? 'Completed' : 'Awaiting Signature';
        const statusClass = caseStatus === 'completed' ? 'status-completed' : 'status-pending';
        
        return `
            <div class="case-card" data-case="${caseData.caseNumber}">
                <div class="case-header" onclick="unifiedSystem.toggleCase('${caseData.caseNumber}')">
                    <div class="case-info">
                        <h3>Case #${caseData.caseNumber}</h3>
                        <span class="case-type">${caseData.noticeType}</span>
                        <span class="case-agency">${caseData.issuingAgency}</span>
                    </div>
                    <div class="case-status">
                        <span class="status-badge ${statusClass}">${statusLabel}</span>
                        <i class="fas fa-chevron-down" id="${caseId}-chevron"></i>
                    </div>
                </div>
                
                <div class="case-details" id="${caseId}-details" style="display: none;">
                    <!-- Case Metadata -->
                    <div class="case-meta">
                        <div class="meta-item">
                            <label>Recipient:</label>
                            <span>${caseData.recipientAddress}</span>
                        </div>
                        <div class="meta-item">
                            <label>Served By:</label>
                            <span>${caseData.serverAddress}</span>
                        </div>
                        <div class="meta-item">
                            <label>Created:</label>
                            <span>${new Date(caseData.createdAt).toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <!-- Paired NFTs Display -->
                    <div class="paired-nfts">
                        <h4>Notice Components</h4>
                        
                        <!-- Alert NFT -->
                        <div class="nft-item alert-nft">
                            <div class="nft-icon">
                                <i class="fas fa-bell"></i>
                            </div>
                            <div class="nft-info">
                                <span class="nft-label">Alert Notice</span>
                                <span class="nft-id">NFT ID: ${caseData.alertNFT.id || 'Pending'}</span>
                                <span class="nft-status status-delivered">✓ Delivered</span>
                            </div>
                            <div class="nft-actions">
                                <button onclick="unifiedSystem.viewReceipt('${caseData.caseNumber}', 'alert')" 
                                        class="btn btn-small btn-primary">
                                    <i class="fas fa-file-alt"></i> View Receipt
                                </button>
                            </div>
                        </div>
                        
                        <!-- Document NFT -->
                        <div class="nft-item document-nft">
                            <div class="nft-icon">
                                <i class="fas fa-file-contract"></i>
                            </div>
                            <div class="nft-info">
                                <span class="nft-label">Document Notice (${caseData.documentNFT.pageCount} pages)</span>
                                <span class="nft-id">NFT ID: ${caseData.documentNFT.id || 'Pending'}</span>
                                <span class="nft-status ${caseData.documentNFT.status === 'SIGNED' ? 'status-signed' : 'status-pending'}">
                                    ${caseData.documentNFT.status === 'SIGNED' ? '✓ Signed For' : '⏳ Awaiting Signature'}
                                </span>
                            </div>
                            <div class="nft-actions">
                                <button onclick="unifiedSystem.viewReceipt('${caseData.caseNumber}', 'document')" 
                                        class="btn btn-small btn-primary">
                                    <i class="fas fa-file-alt"></i> View Receipt
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Case Actions -->
                    <div class="case-actions">
                        <button onclick="unifiedSystem.viewServiceCertificate('${caseData.caseNumber}')" 
                                class="btn btn-secondary">
                            <i class="fas fa-certificate"></i> Service Certificate
                        </button>
                        <button onclick="unifiedSystem.viewAuditTrail('${caseData.caseNumber}')" 
                                class="btn btn-secondary">
                            <i class="fas fa-list"></i> Audit Trail
                        </button>
                        <button onclick="unifiedSystem.downloadCaseDocuments('${caseData.caseNumber}')" 
                                class="btn btn-secondary">
                            <i class="fas fa-download"></i> Download All
                        </button>
                        <button onclick="unifiedSystem.printForCourt('${caseData.caseNumber}')" 
                                class="btn btn-primary">
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