/**
 * Server Dashboard - Complete case management and documentation system
 */

class ServerDashboard {
    constructor() {
        this.workflow = window.noticeWorkflow;
        this.currentServer = null;
        this.cases = new Map();
        this.filters = {
            status: 'all',
            dateRange: 'all',
            search: ''
        };
    }

    /**
     * Initialize the dashboard
     */
    async init() {
        console.log('🎯 Initializing Server Dashboard...');
        
        // Get current server address
        this.currentServer = tronWeb.defaultAddress.base58;
        
        // Load all cases for this server
        await this.loadServerCases();
        
        // Set up UI
        this.setupUI();
        
        // Start auto-refresh
        this.startAutoRefresh();
    }

    /**
     * Load all cases for the current server
     */
    async loadServerCases() {
        console.log('📂 Loading cases for server:', this.currentServer);
        
        try {
            // Fetch from blockchain and backend
            const notices = await this.workflow.fetchNoticesFromBlockchain(this.currentServer);
            
            // Group by case number
            this.cases.clear();
            
            for (const notice of notices) {
                const caseNum = notice.caseNumber;
                
                if (!this.cases.has(caseNum)) {
                    this.cases.set(caseNum, {
                        caseNumber: caseNum,
                        notices: [],
                        status: 'pending',
                        createdAt: notice.createdAt,
                        lastActivity: notice.createdAt,
                        recipientAddress: notice.recipientAddress,
                        noticeType: notice.noticeType,
                        issuingAgency: notice.issuingAgency
                    });
                }
                
                const caseData = this.cases.get(caseNum);
                caseData.notices.push(notice);
                
                // Update case status based on notices
                if (notice.accepted) {
                    caseData.status = 'completed';
                } else if (notice.documentId) {
                    caseData.status = 'awaiting_signature';
                } else {
                    caseData.status = 'delivered';
                }
                
                // Update last activity
                if (new Date(notice.createdAt) > new Date(caseData.lastActivity)) {
                    caseData.lastActivity = notice.createdAt;
                }
            }
            
            console.log(`✅ Loaded ${this.cases.size} cases`);
            
        } catch (error) {
            console.error('❌ Error loading cases:', error);
        }
    }

    /**
     * Set up the dashboard UI
     */
    setupUI() {
        // Create dashboard container if it doesn't exist
        let dashboard = document.getElementById('serverDashboard');
        if (!dashboard) {
            dashboard = document.createElement('div');
            dashboard.id = 'serverDashboard';
            dashboard.className = 'server-dashboard';
            document.body.appendChild(dashboard);
        }

        dashboard.innerHTML = `
            <div class="dashboard-header">
                <h2>📊 Process Server Dashboard</h2>
                <div class="dashboard-stats">
                    <div class="stat-card">
                        <span class="stat-value">${this.cases.size}</span>
                        <span class="stat-label">Total Cases</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${this.getCompletedCount()}</span>
                        <span class="stat-label">Completed</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${this.getPendingCount()}</span>
                        <span class="stat-label">Pending</span>
                    </div>
                </div>
            </div>

            <div class="dashboard-controls">
                <div class="search-box">
                    <i class="fas fa-search"></i>
                    <input type="text" id="caseSearch" placeholder="Search by case number..." />
                </div>
                
                <div class="filter-controls">
                    <select id="statusFilter">
                        <option value="all">All Status</option>
                        <option value="delivered">Delivered</option>
                        <option value="awaiting_signature">Awaiting Signature</option>
                        <option value="completed">Completed</option>
                    </select>
                    
                    <select id="dateFilter">
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                    
                    <button onclick="serverDashboard.refreshCases()" class="btn-refresh">
                        <i class="fas fa-sync"></i> Refresh
                    </button>
                </div>
            </div>

            <div class="cases-container" id="casesContainer">
                ${this.renderCases()}
            </div>
        `;

        // Add event listeners
        this.attachEventListeners();
    }

    /**
     * Render all cases
     */
    renderCases() {
        const filteredCases = this.getFilteredCases();
        
        if (filteredCases.length === 0) {
            return '<div class="no-cases">No cases found</div>';
        }

        return filteredCases.map(caseData => `
            <div class="case-card" data-case="${caseData.caseNumber}">
                <div class="case-header" onclick="serverDashboard.toggleCase('${caseData.caseNumber}')">
                    <div class="case-info">
                        <h3>Case #${caseData.caseNumber}</h3>
                        <span class="case-type">${caseData.noticeType}</span>
                        <span class="case-agency">${caseData.issuingAgency}</span>
                    </div>
                    <div class="case-status">
                        <span class="status-badge status-${caseData.status}">
                            ${this.getStatusLabel(caseData.status)}
                        </span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                </div>
                
                <div class="case-details" id="case-${caseData.caseNumber}" style="display: none;">
                    <div class="case-meta">
                        <div class="meta-item">
                            <label>Recipient:</label>
                            <span>${this.formatAddress(caseData.recipientAddress)}</span>
                        </div>
                        <div class="meta-item">
                            <label>Created:</label>
                            <span>${this.formatDate(caseData.createdAt)}</span>
                        </div>
                        <div class="meta-item">
                            <label>Last Activity:</label>
                            <span>${this.formatDate(caseData.lastActivity)}</span>
                        </div>
                    </div>
                    
                    <div class="notice-list">
                        <h4>Notices (${caseData.notices.length})</h4>
                        ${caseData.notices.map(notice => this.renderNotice(notice)).join('')}
                    </div>
                    
                    <div class="case-actions">
                        <button onclick="serverDashboard.viewFullCase('${caseData.caseNumber}')" class="btn-primary">
                            <i class="fas fa-eye"></i> View Full Details
                        </button>
                        <button onclick="serverDashboard.generateCaseReceipts('${caseData.caseNumber}')" class="btn-secondary">
                            <i class="fas fa-file-pdf"></i> Generate Receipts
                        </button>
                        <button onclick="serverDashboard.viewAuditTrail('${caseData.caseNumber}')" class="btn-secondary">
                            <i class="fas fa-list"></i> Audit Trail
                        </button>
                        <button onclick="serverDashboard.printCase('${caseData.caseNumber}')" class="btn-secondary">
                            <i class="fas fa-print"></i> Print for Court
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Render individual notice
     */
    renderNotice(notice) {
        const isAlert = notice.alertId && !notice.documentId;
        const isDocument = !!notice.documentId;
        
        return `
            <div class="notice-item">
                <div class="notice-type-icon">
                    ${isAlert ? '<i class="fas fa-bell"></i>' : '<i class="fas fa-file-contract"></i>'}
                </div>
                <div class="notice-info">
                    <span class="notice-label">${isAlert ? 'Alert Notice' : 'Document Notice'}</span>
                    <span class="notice-id">ID: ${notice.alertId || notice.documentId}</span>
                    ${notice.transactionHash ? `
                        <a href="https://tronscan.org/#/transaction/${notice.transactionHash}" 
                           target="_blank" class="tx-link">
                            <i class="fas fa-external-link-alt"></i> View on TronScan
                        </a>
                    ` : ''}
                </div>
                <div class="notice-status">
                    ${isAlert ? 
                        '<span class="status-delivered">Delivered</span>' : 
                        `<span class="status-${notice.accepted ? 'signed' : 'pending'}">
                            ${notice.accepted ? 'Signed For' : 'Awaiting Signature'}
                        </span>`
                    }
                </div>
            </div>
        `;
    }

    /**
     * Toggle case expansion
     */
    toggleCase(caseNumber) {
        const details = document.getElementById(`case-${caseNumber}`);
        const card = document.querySelector(`[data-case="${caseNumber}"]`);
        const chevron = card.querySelector('.fa-chevron-down, .fa-chevron-up');
        
        if (details.style.display === 'none') {
            details.style.display = 'block';
            chevron.className = 'fas fa-chevron-up';
        } else {
            details.style.display = 'none';
            chevron.className = 'fas fa-chevron-down';
        }
    }

    /**
     * View full case details
     */
    async viewFullCase(caseNumber) {
        const caseData = this.cases.get(caseNumber);
        if (!caseData) return;

        // Create modal for full case view
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content large">
                <div class="modal-header">
                    <h2>Case #${caseNumber} - Complete Details</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="case-full-details">
                        ${await this.renderFullCaseDetails(caseData)}
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button onclick="serverDashboard.generateCaseReceipts('${caseNumber}')" class="btn-primary">
                        Generate All Receipts
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Generate receipts for all notices in a case
     */
    async generateCaseReceipts(caseNumber) {
        const caseData = this.cases.get(caseNumber);
        if (!caseData) return;

        console.log(`📄 Generating receipts for case ${caseNumber}`);
        
        try {
            const receipts = [];
            
            for (const notice of caseData.notices) {
                // Generate receipt for alert notice
                if (notice.alertId) {
                    const alertReceipt = await this.workflow.generateReceipt(notice.alertId, 'alert');
                    receipts.push(alertReceipt);
                }
                
                // Generate receipt for document notice
                if (notice.documentId) {
                    const docReceipt = await this.workflow.generateReceipt(notice.documentId, 'document');
                    receipts.push(docReceipt);
                }
            }

            // Create combined PDF
            await this.createReceiptPDF(caseNumber, receipts);
            
        } catch (error) {
            console.error('❌ Error generating receipts:', error);
            alert('Failed to generate receipts: ' + error.message);
        }
    }

    /**
     * Create PDF from receipts
     */
    async createReceiptPDF(caseNumber, receipts) {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        let yPosition = 20;
        
        // Title page
        pdf.setFontSize(20);
        pdf.text(`Legal Service Receipts`, 105, yPosition, { align: 'center' });
        
        yPosition += 15;
        pdf.setFontSize(16);
        pdf.text(`Case Number: ${caseNumber}`, 105, yPosition, { align: 'center' });
        
        yPosition += 10;
        pdf.setFontSize(12);
        pdf.text(`Generated: ${new Date().toLocaleString()}`, 105, yPosition, { align: 'center' });
        
        // Add each receipt
        for (const receipt of receipts) {
            pdf.addPage();
            this.addReceiptToPDF(pdf, receipt);
        }
        
        // Save the PDF
        pdf.save(`Case_${caseNumber}_Receipts_${Date.now()}.pdf`);
        
        console.log('✅ PDF generated successfully');
    }

    /**
     * Add receipt content to PDF
     */
    addReceiptToPDF(pdf, receipt) {
        let y = 20;
        
        // Header
        pdf.setFontSize(16);
        pdf.setFont(undefined, 'bold');
        pdf.text(receipt.title, 105, y, { align: 'center' });
        
        y += 15;
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'normal');
        
        // Notice Information
        pdf.setFont(undefined, 'bold');
        pdf.text('NOTICE INFORMATION', 20, y);
        pdf.setFont(undefined, 'normal');
        
        y += 8;
        pdf.text(`Notice ID: ${receipt.notice.id}`, 25, y);
        y += 6;
        pdf.text(`Case Number: ${receipt.notice.caseNumber}`, 25, y);
        y += 6;
        pdf.text(`Type: ${receipt.notice.type}`, 25, y);
        y += 6;
        pdf.text(`Status: ${receipt.notice.status}`, 25, y);
        y += 6;
        pdf.text(`Delivered: ${new Date(receipt.notice.deliveredAt).toLocaleString()}`, 25, y);
        
        // Blockchain Information
        y += 12;
        pdf.setFont(undefined, 'bold');
        pdf.text('BLOCKCHAIN VERIFICATION', 20, y);
        pdf.setFont(undefined, 'normal');
        
        y += 8;
        pdf.setFontSize(10);
        pdf.text(`Network: ${receipt.blockchain.network}`, 25, y);
        y += 5;
        pdf.text(`Contract: ${receipt.blockchain.contractAddress}`, 25, y);
        y += 5;
        pdf.text(`Token ID: ${receipt.blockchain.tokenId}`, 25, y);
        y += 5;
        pdf.text(`Transaction: ${receipt.blockchain.transactionHash}`, 25, y);
        y += 5;
        pdf.text(`Block: ${receipt.blockchain.blockNumber}`, 25, y);
        
        // Parties
        y += 10;
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text('PARTIES', 20, y);
        pdf.setFont(undefined, 'normal');
        
        y += 8;
        pdf.text(`Process Server: ${receipt.parties.server.address}`, 25, y);
        y += 6;
        pdf.text(`Recipient: ${receipt.parties.recipient.address}`, 25, y);
        y += 6;
        pdf.text(`Status: ${receipt.parties.recipient.status}`, 25, y);
        
        // Legal Statement
        y += 12;
        pdf.setFont(undefined, 'bold');
        pdf.text('LEGAL CERTIFICATION', 20, y);
        pdf.setFont(undefined, 'normal');
        
        y += 8;
        pdf.setFontSize(10);
        const lines = pdf.splitTextToSize(receipt.legal.statement, 170);
        lines.forEach(line => {
            pdf.text(line, 25, y);
            y += 5;
        });
        
        // Footer
        y = 270;
        pdf.setFontSize(8);
        pdf.text(receipt.legal.disclaimer, 105, y, { align: 'center' });
        y += 5;
        pdf.text(`Verification Code: ${receipt.parties.server.signature}`, 105, y, { align: 'center' });
    }

    /**
     * View audit trail for a case
     */
    async viewAuditTrail(caseNumber) {
        const caseData = this.cases.get(caseNumber);
        if (!caseData) return;

        console.log(`📋 Loading audit trail for case ${caseNumber}`);
        
        try {
            const auditEvents = [];
            
            // Get audit trail for each notice
            for (const notice of caseData.notices) {
                const trail = await this.workflow.getAuditTrail(notice.id || notice.alertId || notice.documentId);
                auditEvents.push(...trail.map(e => ({
                    ...e,
                    noticeId: notice.id,
                    noticeType: notice.alertId ? 'Alert' : 'Document'
                })));
            }
            
            // Sort by timestamp
            auditEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // Display audit trail
            this.displayAuditTrail(caseNumber, auditEvents);
            
        } catch (error) {
            console.error('❌ Error loading audit trail:', error);
            alert('Failed to load audit trail: ' + error.message);
        }
    }

    /**
     * Display audit trail in modal
     */
    displayAuditTrail(caseNumber, events) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content large">
                <div class="modal-header">
                    <h2>Audit Trail - Case #${caseNumber}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="audit-trail">
                        <table class="audit-table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Event</th>
                                    <th>Notice</th>
                                    <th>Actor</th>
                                    <th>IP Address</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${events.map(event => `
                                    <tr>
                                        <td>${this.formatDate(event.timestamp)}</td>
                                        <td><span class="event-type event-${event.type}">${event.type}</span></td>
                                        <td>${event.noticeType} #${event.noticeId}</td>
                                        <td>${this.formatAddress(event.actor)}</td>
                                        <td>${event.ipAddress || '-'}</td>
                                        <td>${event.details}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button onclick="serverDashboard.exportAuditTrail('${caseNumber}')" class="btn-primary">
                        <i class="fas fa-download"></i> Export CSV
                    </button>
                    <button onclick="serverDashboard.printAuditTrail('${caseNumber}')" class="btn-secondary">
                        <i class="fas fa-print"></i> Print
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Print case for court
     */
    async printCase(caseNumber) {
        const caseData = this.cases.get(caseNumber);
        if (!caseData) return;

        // Generate all receipts
        await this.generateCaseReceipts(caseNumber);
        
        // Open print dialog
        window.print();
    }

    /**
     * Helper functions
     */
    
    getFilteredCases() {
        let cases = Array.from(this.cases.values());
        
        // Apply status filter
        if (this.filters.status !== 'all') {
            cases = cases.filter(c => c.status === this.filters.status);
        }
        
        // Apply date filter
        if (this.filters.dateRange !== 'all') {
            const now = new Date();
            const ranges = {
                today: 24 * 60 * 60 * 1000,
                week: 7 * 24 * 60 * 60 * 1000,
                month: 30 * 24 * 60 * 60 * 1000
            };
            
            const range = ranges[this.filters.dateRange];
            cases = cases.filter(c => {
                const created = new Date(c.createdAt);
                return (now - created) <= range;
            });
        }
        
        // Apply search filter
        if (this.filters.search) {
            const search = this.filters.search.toLowerCase();
            cases = cases.filter(c => 
                c.caseNumber.toLowerCase().includes(search) ||
                c.noticeType.toLowerCase().includes(search) ||
                c.issuingAgency.toLowerCase().includes(search)
            );
        }
        
        // Sort by last activity
        cases.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
        
        return cases;
    }

    getCompletedCount() {
        return Array.from(this.cases.values()).filter(c => c.status === 'completed').length;
    }

    getPendingCount() {
        return Array.from(this.cases.values()).filter(c => c.status !== 'completed').length;
    }

    getStatusLabel(status) {
        const labels = {
            pending: 'Pending',
            delivered: 'Delivered',
            awaiting_signature: 'Awaiting Signature',
            completed: 'Completed'
        };
        return labels[status] || status;
    }

    formatAddress(address) {
        if (!address) return 'N/A';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }

    formatDate(date) {
        if (!date) return 'N/A';
        return new Date(date).toLocaleString();
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Search
        const searchInput = document.getElementById('caseSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.updateDisplay();
            });
        }

        // Status filter
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.updateDisplay();
            });
        }

        // Date filter
        const dateFilter = document.getElementById('dateFilter');
        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
                this.filters.dateRange = e.target.value;
                this.updateDisplay();
            });
        }
    }

    /**
     * Update the display
     */
    updateDisplay() {
        const container = document.getElementById('casesContainer');
        if (container) {
            container.innerHTML = this.renderCases();
        }
    }

    /**
     * Refresh cases from blockchain
     */
    async refreshCases() {
        console.log('🔄 Refreshing cases...');
        await this.loadServerCases();
        this.updateDisplay();
    }

    /**
     * Start auto-refresh
     */
    startAutoRefresh() {
        // Refresh every 60 seconds
        setInterval(() => {
            this.refreshCases();
        }, 60000);
    }

    /**
     * Export audit trail as CSV
     */
    exportAuditTrail(caseNumber) {
        // Implementation for CSV export
        console.log('Exporting audit trail for case:', caseNumber);
    }

    /**
     * Print audit trail
     */
    printAuditTrail(caseNumber) {
        window.print();
    }

    /**
     * Render full case details
     */
    async renderFullCaseDetails(caseData) {
        // Implementation for full case details
        return `
            <div class="case-complete">
                <h3>Complete Case Information</h3>
                <p>Case Number: ${caseData.caseNumber}</p>
                <p>Total Notices: ${caseData.notices.length}</p>
                <!-- Add more details here -->
            </div>
        `;
    }
}

// Initialize dashboard
window.serverDashboard = new ServerDashboard();

// Export for use
window.ServerDashboard = ServerDashboard;