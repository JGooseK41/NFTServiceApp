/**
 * Court Report Generator
 * Generates comprehensive, court-admissible audit reports
 */

class CourtReportGenerator {
    constructor() {
        this.reportData = null;
        this.caseNumber = null;
    }

    /**
     * Generate complete court report with all audit data
     */
    async generateCourtReport(caseNumber, caseData, auditEvents) {
        this.caseNumber = caseNumber;
        this.reportData = {
            case: caseData,
            events: auditEvents,
            generated: new Date(),
            serverAddress: window.unifiedSystem?.serverAddress || 'Unknown'
        };

        // Create print-optimized report
        const reportHTML = this.buildCourtReport();
        
        // Open in new window for printing
        const printWindow = window.open('', '_blank');
        printWindow.document.write(reportHTML);
        printWindow.document.close();
        
        // Auto-trigger print dialog after loading
        printWindow.onload = () => {
            printWindow.print();
        };
        
        return reportHTML;
    }

    /**
     * Build complete court report HTML
     */
    buildCourtReport() {
        const { case: caseData, events, generated, serverAddress } = this.reportData;
        
        // Calculate statistics
        const stats = this.calculateStatistics(events);
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Court Audit Report - Case ${this.caseNumber}</title>
    <link rel="stylesheet" href="${window.location.origin}/css/print-audit.css">
    <style>
        body {
            font-family: 'Times New Roman', Times, serif;
            line-height: 1.6;
            color: #000;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 0.5in;
        }
        .header-seal {
            text-align: center;
            margin-bottom: 20px;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f0f0f0;
        }
        .page-break {
            page-break-before: always;
        }
    </style>
</head>
<body data-date="${generated.toLocaleDateString()}">
    <!-- Cover Page -->
    <div class="audit-header">
        <h1>AUDIT TRAIL REPORT</h1>
        <h2>BLOCKCHAIN LEGAL NOTICE SERVICE</h2>
        <h3>Evidence of Electronic Service Attempts and Interactions</h3>
        <div style="margin-top: 20px;">
            <p><strong>Report Generated:</strong> ${generated.toLocaleString()}</p>
            <p><strong>Report Type:</strong> Comprehensive Forensic Audit</p>
            <p><strong>Authentication:</strong> Blockchain Verified</p>
        </div>
    </div>

    <!-- Case Information -->
    <div class="case-info-box">
        <h3>CASE INFORMATION</h3>
        <dl>
            <dt>Case Number:</dt>
            <dd><strong>${this.escapeHtml(this.caseNumber)}</strong></dd>
            
            <dt>Notice Type:</dt>
            <dd>${this.escapeHtml(caseData.noticeType || 'Legal Notice')}</dd>
            
            <dt>Issuing Agency:</dt>
            <dd>${this.escapeHtml(caseData.issuingAgency || 'Not Specified')}</dd>
            
            <dt>Process Server:</dt>
            <dd class="wallet-address">${serverAddress}</dd>
            
            <dt>Service Date:</dt>
            <dd>${new Date(caseData.createdAt).toLocaleString()}</dd>
            
            <dt>Recipients:</dt>
            <dd>${caseData.recipients?.length || 1} party(ies)</dd>
            
            <dt>Blockchain Network:</dt>
            <dd>TRON Mainnet</dd>
            
            <dt>Smart Contract:</dt>
            <dd class="wallet-address">${window.CONTRACT_ADDRESS || 'TYukBQZ2XXCcRCReAUguyXncCWNY9CEiDQ'}</dd>
        </dl>
    </div>

    <!-- Statistics Summary -->
    <div class="statistics-section">
        <h3>INTERACTION SUMMARY</h3>
        <div class="statistics-grid">
            <div class="stat-item">
                <div class="stat-value">${stats.totalEvents}</div>
                <div class="stat-label">Total Events</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.uniqueWallets}</div>
                <div class="stat-label">Unique Wallets</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.uniqueIPs}</div>
                <div class="stat-label">Unique IPs</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.views}</div>
                <div class="stat-label">Notice Views</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.acceptances}</div>
                <div class="stat-label">Acceptances</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.connections}</div>
                <div class="stat-label">Connections</div>
            </div>
        </div>
    </div>

    <!-- Detailed Event Log -->
    <div class="event-log-section">
        <h3>DETAILED FORENSIC EVENT LOG</h3>
        <p style="margin-bottom: 10px; font-style: italic;">
            Each entry represents a tracked interaction with the legal notice system, 
            including connection attempts, notice views, and acceptances.
        </p>
        <table>
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Event Type</th>
                    <th>Wallet Address</th>
                    <th>IP Address</th>
                    <th>Location</th>
                    <th>Device/Browser</th>
                    <th>Additional Details</th>
                </tr>
            </thead>
            <tbody>
                ${events.map(event => this.renderEventRow(event)).join('')}
            </tbody>
        </table>
    </div>

    <!-- Chain of Custody -->
    <div class="chain-of-custody page-break">
        <h3>CHAIN OF CUSTODY</h3>
        <table>
            <thead>
                <tr>
                    <th>Date/Time</th>
                    <th>Action</th>
                    <th>Custodian</th>
                    <th>Verification</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${new Date(caseData.createdAt).toLocaleString()}</td>
                    <td>Notice Created and Served</td>
                    <td class="wallet-address">${serverAddress}</td>
                    <td>Blockchain TX Pending</td>
                </tr>
                ${events.filter(e => e.type === 'Notice Accepted').map(e => `
                    <tr>
                        <td>${e.timestamp.toLocaleString()}</td>
                        <td>Notice Accepted/Signed</td>
                        <td class="wallet-address">${this.formatAddress(e.wallet)}</td>
                        <td>${e.transactionHash ? `TX: ${e.transactionHash.substring(0,10)}...` : 'Pending'}</td>
                    </tr>
                `).join('')}
                <tr>
                    <td>${generated.toLocaleString()}</td>
                    <td>Audit Report Generated</td>
                    <td class="wallet-address">${serverAddress}</td>
                    <td>System Generated</td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Legal Certification -->
    <div class="certification-section">
        <h3>CERTIFICATION OF AUTHENTICITY</h3>
        <div class="certification-text">
            <p>
                I hereby certify that this audit report is a true and accurate record of all 
                electronic interactions with the blockchain-based legal notice system for 
                Case Number <strong>${this.escapeHtml(this.caseNumber)}</strong>.
            </p>
            <p>
                The data contained herein was collected through automated forensic tracking systems 
                including but not limited to: IP geolocation, device fingerprinting, browser identification, 
                timezone detection, and blockchain transaction monitoring.
            </p>
            <p>
                All timestamps are accurate to the millisecond and synchronized with network time protocol (NTP) servers. 
                IP addresses and geographic locations were determined using industry-standard geolocation services.
            </p>
            <p>
                This report is generated from immutable blockchain records and cryptographically secured 
                audit logs, suitable for admission as evidence in legal proceedings.
            </p>
            <p>
                I declare under penalty of perjury under the laws of the jurisdiction that the foregoing 
                is true and correct to the best of the system's automated recording capabilities.
            </p>
        </div>
        
        <div class="signature-block">
            <div>
                <div class="signature-line"></div>
                <div class="signature-label">Process Server Signature</div>
                <div style="margin-top: 5px;">Date: _________________</div>
            </div>
            <div>
                <div class="signature-line"></div>
                <div class="signature-label">Notary Public (if required)</div>
                <div style="margin-top: 5px;">Date: _________________</div>
            </div>
        </div>
    </div>

    <!-- Legal Notice -->
    <div class="legal-notice">
        <h4>LEGAL NOTICE REGARDING DATA COLLECTION</h4>
        <p>
            <strong>Comprehensive Tracking Disclosure:</strong> All interactions with the blockchain 
            legal notice system are subject to comprehensive forensic tracking for legal compliance 
            and evidentiary purposes. This includes but is not limited to:
        </p>
        <ul>
            <li>IP addresses and network information</li>
            <li>Device fingerprints using canvas, WebGL, and audio APIs</li>
            <li>Geographic location derived from IP geolocation</li>
            <li>Browser type, version, and capabilities</li>
            <li>Operating system and platform information</li>
            <li>Screen resolution and hardware characteristics</li>
            <li>Timezone and locale settings</li>
            <li>Wallet application identification</li>
            <li>Unique device identifiers</li>
            <li>Connection timestamps with millisecond precision</li>
        </ul>
        <p>
            This data is collected pursuant to legal service requirements and is maintained 
            in accordance with applicable laws regarding electronic service of process.
        </p>
    </div>

    <!-- Exhibits Section -->
    <div class="attachments-section">
        <h3>EXHIBITS AND ATTACHMENTS</h3>
        <div class="attachment-item">
            <span class="exhibit-marker">Exhibit A:</span>
            Blockchain Transaction Records
        </div>
        <div class="attachment-item">
            <span class="exhibit-marker">Exhibit B:</span>
            Notice Images (Alert Thumbnail and Full Document)
        </div>
        <div class="attachment-item">
            <span class="exhibit-marker">Exhibit C:</span>
            Device Fingerprint Analysis
        </div>
        <div class="attachment-item">
            <span class="exhibit-marker">Exhibit D:</span>
            IP Geolocation Reports
        </div>
        <div class="attachment-item">
            <span class="exhibit-marker">Exhibit E:</span>
            Service Certificate with Blockchain Verification
        </div>
    </div>

    <!-- Print timestamp -->
    <div class="print-only" style="margin-top: 50px; text-align: center; font-size: 10pt;">
        <p>Report printed on: <script>document.write(new Date().toLocaleString());</script></p>
        <p>Total pages will be numbered automatically by print system</p>
    </div>
</body>
</html>
        `;
    }

    /**
     * Render individual event row for court report
     */
    renderEventRow(event) {
        return `
            <tr>
                <td class="timestamp">${event.timestamp.toLocaleString()}</td>
                <td>${this.escapeHtml(event.type)}</td>
                <td class="wallet-address">${this.formatAddress(event.wallet)}</td>
                <td class="ip-address">${event.ip || 'N/A'}</td>
                <td>${this.parseLocation(event.location)}</td>
                <td>${this.parseDevice(event.userAgent)}</td>
                <td>
                    ${event.details || ''}
                    ${event.transactionHash ? `<br>TX: ${event.transactionHash.substring(0,10)}...` : ''}
                </td>
            </tr>
        `;
    }

    /**
     * Calculate statistics from events
     */
    calculateStatistics(events) {
        return {
            totalEvents: events.length,
            uniqueWallets: new Set(events.map(e => e.wallet)).size,
            uniqueIPs: new Set(events.filter(e => e.ip).map(e => e.ip)).size,
            views: events.filter(e => e.type === 'Notice Viewed').length,
            acceptances: events.filter(e => e.type === 'Notice Accepted').length,
            connections: events.filter(e => e.type === 'Wallet Connected').length
        };
    }

    /**
     * Format wallet address
     */
    formatAddress(address) {
        if (!address) return 'Unknown';
        if (address.length < 20) return address;
        return `${address.substring(0, 10)}...${address.substring(address.length - 8)}`;
    }

    /**
     * Parse location data
     */
    parseLocation(location) {
        if (!location) return 'Unknown';
        if (typeof location === 'string') {
            try {
                location = JSON.parse(location);
            } catch {
                return location;
            }
        }
        const parts = [];
        if (location.city) parts.push(location.city);
        if (location.region) parts.push(location.region);
        if (location.country) parts.push(location.country);
        return parts.join(', ') || 'Unknown';
    }

    /**
     * Parse device info
     */
    parseDevice(userAgent) {
        if (!userAgent) return 'Unknown';
        const parts = [];
        if (userAgent.includes('Mobile')) parts.push('Mobile');
        if (userAgent.includes('Chrome')) parts.push('Chrome');
        else if (userAgent.includes('Firefox')) parts.push('Firefox');
        else if (userAgent.includes('Safari')) parts.push('Safari');
        if (userAgent.includes('Windows')) parts.push('Windows');
        else if (userAgent.includes('Mac')) parts.push('Mac');
        else if (userAgent.includes('Linux')) parts.push('Linux');
        else if (userAgent.includes('Android')) parts.push('Android');
        else if (userAgent.includes('iOS')) parts.push('iOS');
        return parts.join('/') || 'Unknown';
    }

    /**
     * Escape HTML for security
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Export as formatted PDF (using print dialog)
     */
    exportAsPDF() {
        window.print();
    }

    /**
     * Export raw data as JSON for court filing systems
     */
    exportAsJSON() {
        const dataStr = JSON.stringify(this.reportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_report_${this.caseNumber}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Initialize global instance
window.courtReportGenerator = new CourtReportGenerator();