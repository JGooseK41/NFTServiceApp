/**
 * Proof of Service Receipt Generator
 * Generates comprehensive receipts with transaction details and document stamps
 */

window.proofOfService = {

    // Get explorer URL for a transaction - chain-aware
    getExplorerUrl(txHash, chainId) {
        // Use the new chain-aware helper if available
        if (window.getExplorerTxUrl) {
            return window.getExplorerTxUrl(txHash, chainId);
        }
        // Fallback to legacy TronScan helper
        if (window.getTronScanUrl) {
            return window.getTronScanUrl(txHash);
        }
        // Final fallback: check current network
        const isNile = window.AppConfig?.network?.current === 'nile' ||
                      window.tronWeb?.fullNode?.host?.includes('nile');
        const baseUrl = isNile
            ? 'https://nile.tronscan.org/#/transaction/'
            : 'https://tronscan.org/#/transaction/';
        return baseUrl + (txHash || '');
    },

    // Get chain display name
    getChainName(chainId) {
        if (window.getChainInfo) {
            const chainInfo = window.getChainInfo(chainId);
            return chainInfo?.name || 'Blockchain';
        }
        // Fallback for legacy
        const current = window.AppConfig?.network?.current;
        return current === 'nile' ? 'TRON Nile Testnet' : 'TRON Mainnet';
    },

    // Legacy alias for backwards compatibility
    getTronScanUrl(txHash) {
        return this.getExplorerUrl(txHash);
    },

    // Get the user's timezone abbreviation (e.g., "EST", "PST", "CET")
    getTimezoneAbbr() {
        try {
            // Try to get short timezone name
            const tzName = Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
                .formatToParts(new Date())
                .find(part => part.type === 'timeZoneName')?.value || '';
            return tzName;
        } catch (e) {
            // Fallback to offset-based name
            const offset = new Date().getTimezoneOffset();
            const hours = Math.abs(Math.floor(offset / 60));
            const sign = offset <= 0 ? '+' : '-';
            return `UTC${sign}${hours}`;
        }
    },

    // Format date/time as UTC with local time and timezone in parentheses
    formatDateTime(dateInput) {
        if (!dateInput) return 'N/A';
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return 'N/A';

        const utcStr = date.toISOString().replace('T', ' ').replace('Z', '') + ' UTC';
        const localStr = date.toLocaleString();
        const tz = this.getTimezoneAbbr();
        return `${utcStr} (${tz}: ${localStr})`;
    },

    // Format date only as UTC with local in parentheses
    formatDate(dateInput) {
        if (!dateInput) return 'N/A';
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return 'N/A';

        const utcDate = date.toISOString().split('T')[0] + ' UTC';
        const localDate = date.toLocaleDateString();
        const tz = this.getTimezoneAbbr();
        return `${utcDate} (${tz}: ${localDate})`;
    },

    // Format time only as UTC with local in parentheses
    formatTime(dateInput) {
        if (!dateInput) return 'N/A';
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return 'N/A';

        const utcTime = date.toISOString().split('T')[1].replace('Z', '') + ' UTC';
        const localTime = date.toLocaleTimeString();
        const tz = this.getTimezoneAbbr();
        return `${utcTime} (${tz}: ${localTime})`;
    },

    // Generate comprehensive proof of service receipt
    async generateServiceReceipt(caseData) {
        // Try to get alert image from various sources
        let alertImage = null;
        
        // Check if we have it in case data
        if (caseData.alertImage || caseData.alertPreview || caseData.alertThumbnail) {
            alertImage = caseData.alertImage || caseData.alertPreview || caseData.alertThumbnail;
        } 
        // Try to get from local storage
        else {
            const localCases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
            const localCase = localCases.find(c => 
                c.caseNumber === caseData.caseNumber || 
                c.id === caseData.caseNumber
            );
            if (localCase && localCase.alertImage) {
                alertImage = localCase.alertImage;
            }
        }
        
        // Generate receipt number based on case number
        const caseNum = caseData.caseNumber || caseData.id;
        const receiptCount = parseInt(sessionStorage.getItem(`receipt_count_${caseNum}`) || '0') + 1;
        sessionStorage.setItem(`receipt_count_${caseNum}`, receiptCount.toString());
        const receiptId = receiptCount > 1 ? `${caseNum}-${receiptCount}` : caseNum;
        
        // Get chain info - from data or current network
        const chainId = caseData.chain || (window.getCurrentChainId ? window.getCurrentChainId() : 'tron-mainnet');
        const chainName = caseData.chainName || this.getChainName(chainId);
        const explorerUrl = caseData.explorerUrl || this.getExplorerUrl(caseData.transactionHash, chainId);

        const receipt = {
            receiptId: receiptId,
            generatedAt: new Date().toISOString(),
            caseNumber: caseData.caseNumber || caseData.id,
            serverAddress: caseData.serverAddress || window.tronWeb?.defaultAddress?.base58,
            servedAt: caseData.servedAt || new Date().toISOString(),
            transactionHash: caseData.transactionHash,
            alertTokenId: caseData.alertTokenId,
            documentTokenId: caseData.documentTokenId,
            recipients: caseData.recipients || [],
            documents: caseData.documents || [],
            agency: caseData.agency || caseData.metadata?.issuingAgency,
            noticeType: caseData.noticeType || caseData.metadata?.noticeType,
            alertImage: alertImage,
            chain: chainId,
            chainName: chainName,
            explorerUrl: explorerUrl,
            // Fee breakdown data (exact costs from transaction)
            serviceFeePerRecipient: caseData.serviceFeePerRecipient || caseData.feeBreakdown?.perRecipient?.serviceFee,
            recipientFundingPerRecipient: caseData.recipientFundingPerRecipient || caseData.feeBreakdown?.perRecipient?.recipientFunding,
            notificationTransferPerRecipient: caseData.notificationTransferPerRecipient || caseData.feeBreakdown?.perRecipient?.notificationTransfer,
            totalServiceFees: caseData.totalServiceFees || caseData.serviceFee || caseData.service_fee || caseData.feeBreakdown?.serviceFee,
            totalRecipientFunding: caseData.totalRecipientFunding || caseData.recipientFunding || caseData.recipient_funding || caseData.feeBreakdown?.recipientFunding,
            totalNotificationTransfers: caseData.totalNotificationTransfers || caseData.feeBreakdown?.notificationTransfer,
            totalPaymentTRX: caseData.totalPaymentTRX || caseData.feeBreakdown?.totalPaymentTRX || caseData.totalTransactionCost || caseData.totalCost,
            recipientCount: caseData.recipientCount || (caseData.recipients ? caseData.recipients.length : 1)
        };

        return receipt;
    },
    
    // Generate printable HTML receipt - optimized for 3-page court filing
    generatePrintableReceipt(receipt) {
        const explorerUrl = receipt.explorerUrl || this.getExplorerUrl(receipt.transactionHash, receipt.chain);

        // Format dates as UTC with local time in parentheses
        const generatedAtFormatted = this.formatDateTime(receipt.generatedAt);
        const servedAtFormatted = this.formatDateTime(receipt.servedAt);
        const servedDateFormatted = this.formatDate(receipt.servedAt);
        const servedTimeFormatted = this.formatTime(receipt.servedAt);

        // Ensure token ID and transaction hash are properly extracted
        const tokenId = receipt.alertTokenId || receipt.alert_token_id || 'N/A';
        const txHash = receipt.transactionHash || receipt.transaction_hash || 'N/A';

        // Check if we have fee data for Page 4
        const hasExpenditure = receipt.totalServiceFees || receipt.totalRecipientFunding || receipt.totalPaymentTRX;
        const totalPages = hasExpenditure ? 4 : 3;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Proof of Service - Case ${receipt.caseNumber}</title>
                <style>
                    @media print {
                        body { margin: 0; padding: 0.5in; }
                        .no-print { display: none; }
                        .page { page-break-after: always; }
                        .page:last-child { page-break-after: avoid; }
                    }
                    @page {
                        size: letter;
                        margin: 0.5in;
                    }
                    * { box-sizing: border-box; }
                    body {
                        font-family: 'Times New Roman', Times, serif;
                        font-size: 11pt;
                        line-height: 1.4;
                        max-width: 8.5in;
                        margin: 0 auto;
                        padding: 0.5in;
                        color: #000;
                    }
                    .page {
                        min-height: 9.5in;
                        position: relative;
                        padding-bottom: 50px; /* Space for footer */
                    }
                    .header {
                        text-align: center;
                        border-bottom: 2px solid #000;
                        padding-bottom: 15px;
                        margin-bottom: 20px;
                    }
                    .header h1 {
                        font-size: 16pt;
                        margin: 0 0 5px 0;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                    .header h2 {
                        font-size: 12pt;
                        margin: 0;
                        font-weight: normal;
                    }
                    .header .case-ref {
                        margin-top: 10px;
                        font-size: 11pt;
                    }
                    .section {
                        margin-bottom: 15px;
                    }
                    .section-title {
                        font-size: 11pt;
                        font-weight: bold;
                        text-transform: uppercase;
                        border-bottom: 1px solid #000;
                        padding-bottom: 3px;
                        margin-bottom: 10px;
                    }
                    .field-row {
                        display: flex;
                        margin: 5px 0;
                        font-size: 10pt;
                    }
                    .field-label {
                        font-weight: bold;
                        width: 160px;
                        flex-shrink: 0;
                    }
                    .field-value {
                        flex: 1;
                    }
                    .mono {
                        font-family: 'Courier New', monospace;
                        font-size: 9pt;
                    }
                    .tx-box {
                        border: 1px solid #000;
                        padding: 8px;
                        margin: 8px 0;
                        font-family: 'Courier New', monospace;
                        font-size: 8pt;
                        word-break: break-all;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 10px 0;
                        font-size: 10pt;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 6px 8px;
                        text-align: left;
                    }
                    th {
                        background: #f0f0f0;
                        font-weight: bold;
                    }
                    .nft-image {
                        text-align: center;
                        margin: 15px 0;
                    }
                    .nft-image img {
                        max-width: 350px;
                        max-height: 350px;
                        border: 1px solid #000;
                    }
                    .verification-list {
                        margin: 10px 0;
                        padding-left: 20px;
                    }
                    .verification-list li {
                        margin: 8px 0;
                    }
                    .affirmation {
                        border: 1px solid #000;
                        padding: 15px;
                        margin: 15px 0;
                    }
                    .affirmation p {
                        margin: 0 0 15px 0;
                        text-align: justify;
                    }
                    .sig-row {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 40px;
                    }
                    .sig-block {
                        width: 45%;
                    }
                    .sig-line {
                        border-bottom: 1px solid #000;
                        height: 30px;
                        margin-bottom: 5px;
                    }
                    .sig-label {
                        font-size: 9pt;
                        text-align: center;
                    }
                    .footer {
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        text-align: center;
                        font-size: 9pt;
                        color: #666;
                        border-top: 1px solid #ccc;
                        padding-top: 10px;
                        background: #fff; /* Ensure footer has solid background */
                    }
                    .section:last-of-type {
                        margin-bottom: 60px; /* Extra space before footer */
                    }
                    .page-num {
                        font-size: 9pt;
                        text-align: center;
                        color: #666;
                    }
                    .seal {
                        text-align: center;
                        font-weight: bold;
                        margin: 20px 0;
                        padding: 10px;
                        border: 2px solid #000;
                    }
                </style>
            </head>
            <body>
                <!-- PAGE 1: Case Info, Blockchain Verification, Recipients -->
                <div class="page">
                    <div class="header">
                        <h1>Proof of Blockchain Service</h1>
                        <h2>Legal Notice Delivery Confirmation</h2>
                        <div class="case-ref">
                            <strong>Case No. ${receipt.caseNumber}</strong><br>
                            Receipt Generated: ${generatedAtFormatted}
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">I. Case Information</div>
                        <div class="field-row">
                            <span class="field-label">Case Number:</span>
                            <span class="field-value">${receipt.caseNumber}</span>
                        </div>
                        <div class="field-row">
                            <span class="field-label">Issuing Agency:</span>
                            <span class="field-value">${receipt.agency || 'via Blockserved.com'}</span>
                        </div>
                        <div class="field-row">
                            <span class="field-label">Notice Type:</span>
                            <span class="field-value">${receipt.noticeType || 'Legal Notice'}</span>
                        </div>
                        <div class="field-row">
                            <span class="field-label">Date/Time of Service:</span>
                            <span class="field-value">${servedAtFormatted}</span>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">II. Blockchain Verification</div>
                        <div class="field-row">
                            <span class="field-label">Blockchain Network:</span>
                            <span class="field-value">${receipt.chainName || 'TRON'}</span>
                        </div>
                        <div class="field-row">
                            <span class="field-label">NFT Token ID:</span>
                            <span class="field-value">${tokenId !== 'N/A' ? '#' + tokenId : 'N/A'}</span>
                        </div>
                        <div class="field-row">
                            <span class="field-label">Server Wallet:</span>
                            <span class="field-value mono">${receipt.serverAddress || 'N/A'}</span>
                        </div>
                        <div class="field-row">
                            <span class="field-label">Transaction Hash:</span>
                        </div>
                        <div class="tx-box">
                            ${txHash !== 'N/A' ? txHash : 'Transaction hash not available - please ensure the case has been served'}
                        </div>
                        <div class="field-row">
                            <span class="field-label">Block Explorer URL:</span>
                            <span class="field-value" style="font-size: 9pt; word-break: break-all;">
                                ${txHash !== 'N/A' ? explorerUrl : 'N/A'}
                            </span>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">III. Service Recipients</div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 60%;">Recipient Wallet Address</th>
                                    <th style="width: 20%;">Token ID</th>
                                    <th style="width: 20%;">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(receipt.recipients || []).map((r, i) => `
                                <tr>
                                    <td class="mono">${typeof r === 'string' ? r : (r.address || 'N/A')}</td>
                                    <td>${tokenId !== 'N/A' ? '#' + (parseInt(tokenId) + i) : 'N/A'}</td>
                                    <td>Delivered</td>
                                </tr>
                                `).join('') || `
                                <tr>
                                    <td colspan="3" style="text-align: center;">No recipient data available</td>
                                </tr>
                                `}
                            </tbody>
                        </table>
                    </div>

                    <div class="footer">
                        BlockServed™ Proof of Service | Case ${receipt.caseNumber} | Page 1 of ${totalPages}
                    </div>
                </div>

                <!-- PAGE 2: NFT Evidence & Verification Instructions -->
                <div class="page">
                    <div class="header">
                        <h1>Proof of Blockchain Service</h1>
                        <div class="case-ref"><strong>Case No. ${receipt.caseNumber}</strong> (continued)</div>
                    </div>

                    ${receipt.alertImage ? `
                    <div class="section">
                        <div class="section-title">IV. NFT Evidence</div>
                        <p style="font-size: 10pt; margin-bottom: 10px;">
                            The following NFT was minted and transferred to the recipient's wallet as immutable proof of service:
                        </p>
                        <div class="nft-image">
                            <img src="${receipt.alertImage}" alt="Legal Notice NFT">
                        </div>
                        <p style="font-size: 9pt; text-align: center; margin-top: 5px;">
                            <em>NFT as displayed in recipient's cryptocurrency wallet</em>
                        </p>
                    </div>
                    ` : ''}

                    <div class="section">
                        <div class="section-title">${receipt.alertImage ? 'V' : 'IV'}. Verification Instructions</div>
                        <p style="font-size: 10pt;">To independently verify this service, follow these steps:</p>
                        <ol class="verification-list">
                            <li><strong>Access Block Explorer:</strong> Navigate to the blockchain explorer at:<br>
                                <span class="mono" style="font-size: 9pt;">${txHash !== 'N/A' ? explorerUrl : 'N/A'}</span>
                            </li>
                            <li><strong>Verify Transaction:</strong> Confirm the transaction hash matches:<br>
                                <span class="mono" style="font-size: 9pt;">${txHash}</span>
                            </li>
                            <li><strong>Confirm Recipient:</strong> Verify the NFT was transferred to the recipient address(es) listed in Section III.</li>
                            <li><strong>Check Timestamp:</strong> Confirm the blockchain timestamp corresponds to the service date/time.</li>
                            <li><strong>View Documents:</strong> Recipients may access full documents at <strong>www.BlockServed.com</strong> by connecting their wallet.</li>
                        </ol>
                    </div>

                    <div class="section">
                        <div class="section-title">${receipt.alertImage ? 'VI' : 'V'}. About Blockchain Service</div>
                        <p style="font-size: 10pt; text-align: justify;">
                            This proof of service utilizes blockchain technology to create an immutable, timestamped record of legal document delivery.
                            The Non-Fungible Token (NFT) transferred to the recipient's wallet serves as cryptographic proof that the notice was delivered
                            to the specified blockchain address. This record cannot be altered, deleted, or disputed, and can be independently verified
                            by any party using the transaction hash and block explorer.
                        </p>
                    </div>

                    <div class="footer">
                        BlockServed™ Proof of Service | Case ${receipt.caseNumber} | Page 2 of ${totalPages}
                    </div>
                </div>

                <!-- PAGE 3: Affirmation & Signature -->
                <div class="page">
                    <div class="header">
                        <h1>Proof of Blockchain Service</h1>
                        <div class="case-ref"><strong>Case No. ${receipt.caseNumber}</strong> (continued)</div>
                    </div>

                    <div class="section">
                        <div class="section-title">${receipt.alertImage ? 'VII' : 'VI'}. Server Affirmation & Witness Acknowledgment</div>
                        <div class="affirmation">
                            <p style="margin-bottom: 10px;">
                                I, the undersigned, hereby declare under penalty of perjury that on <strong>${servedDateFormatted}</strong>
                                at <strong>${servedTimeFormatted}</strong>, I caused the legal documents referenced in Case No. <strong>${receipt.caseNumber}</strong>
                                to be served upon the recipient(s) listed herein via blockchain technology by transferring an NFT to the recipient's
                                wallet address using server wallet <strong class="mono" style="font-size: 8pt;">${receipt.serverAddress || '________________'}</strong>.
                                ${txHash !== 'N/A' ? `Transaction hash: <strong class="mono" style="font-size: 7pt;">${txHash}</strong>.` : ''}
                                I declare the foregoing is true and correct.
                            </p>

                            <div class="sig-row" style="margin-top: 20px;">
                                <div class="sig-block">
                                    <div class="sig-line"></div>
                                    <div class="sig-label">Server Signature</div>
                                </div>
                                <div class="sig-block">
                                    <div class="sig-line"></div>
                                    <div class="sig-label">Date</div>
                                </div>
                            </div>

                            <div class="sig-row" style="margin-top: 15px;">
                                <div class="sig-block">
                                    <div class="sig-line"></div>
                                    <div class="sig-label">Printed Name</div>
                                </div>
                                <div class="sig-block">
                                    <div class="sig-line"></div>
                                    <div class="sig-label">License/Registration No.</div>
                                </div>
                            </div>

                            <div style="border-top: 1px solid #ccc; margin: 20px 0 15px 0; padding-top: 15px;">
                                <p style="margin: 0 0 10px 0; font-size: 9pt;">
                                    Subscribed and sworn to (or affirmed) before me this _______ day of ______________, 20___,
                                    by the above-named server, personally known to me or having produced valid identification.
                                </p>
                            </div>

                            <div class="sig-row" style="margin-top: 15px;">
                                <div class="sig-block">
                                    <div class="sig-line"></div>
                                    <div class="sig-label">Witness/Notary Signature</div>
                                </div>
                                <div class="sig-block">
                                    <div class="sig-line"></div>
                                    <div class="sig-label">Date</div>
                                </div>
                            </div>

                            <div class="sig-row" style="margin-top: 15px;">
                                <div class="sig-block">
                                    <div class="sig-line"></div>
                                    <div class="sig-label">Printed Name / Title</div>
                                </div>
                                <div class="sig-block">
                                    <div style="border: 1px dashed #999; height: 50px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 8pt;">
                                        [SEAL/STAMP]
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="seal" style="margin-top: 20px; padding: 8px;">
                        OFFICIAL BLOCKCHAIN SERVICE RECORD<br>
                        <span style="font-size: 9pt; font-weight: normal;">
                            Legal notice served via ${receipt.chainName || 'blockchain'} on ${servedDateFormatted}
                        </span>
                    </div>

                    <div class="footer">
                        BlockServed™ Proof of Service | Case ${receipt.caseNumber} | Page 3 of ${totalPages}<br>
                        <span style="font-size: 8pt;">Generated: ${generatedAtFormatted} | www.BlockServed.com</span>
                    </div>
                </div>

                ${hasExpenditure ? `
                <!-- PAGE 4: Expenditure Summary & Fee Disclosure -->
                <div class="page">
                    <div class="header">
                        <h1>Proof of Blockchain Service</h1>
                        <h2>Expenditure Summary</h2>
                        <div class="case-ref">
                            <strong>Case No. ${receipt.caseNumber}</strong>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">I. Per-Recipient Fee Breakdown</div>
                        <p style="font-size: 10pt; margin-bottom: 15px;">
                            The following fees were charged for each recipient served:
                        </p>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 40%;">Recipient Address</th>
                                    <th style="width: 20%; text-align: right;">Service Fee</th>
                                    <th style="width: 20%; text-align: right;">Wallet Funding</th>
                                    <th style="width: 20%; text-align: right;">Notification</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(receipt.recipients || []).map((r, i) => {
                                    const addr = typeof r === 'string' ? r : (r.address || 'N/A');
                                    const shortAddr = addr.length > 20 ? addr.substring(0, 10) + '...' + addr.substring(addr.length - 8) : addr;
                                    return `
                                    <tr>
                                        <td class="mono" style="font-size: 9pt;">${shortAddr}</td>
                                        <td style="text-align: right;">${receipt.serviceFeePerRecipient || (receipt.totalServiceFees / receipt.recipientCount) || 'N/A'} TRX</td>
                                        <td style="text-align: right;">${receipt.recipientFundingPerRecipient || (receipt.totalRecipientFunding / receipt.recipientCount) || 'N/A'} TRX</td>
                                        <td style="text-align: right;">${receipt.notificationTransferPerRecipient || (receipt.totalNotificationTransfers / receipt.recipientCount) || 'N/A'} TRX</td>
                                    </tr>
                                    `;
                                }).join('') || `
                                <tr>
                                    <td class="mono" style="font-size: 9pt;">Recipient 1</td>
                                    <td style="text-align: right;">${receipt.serviceFeePerRecipient || receipt.totalServiceFees || 'N/A'} TRX</td>
                                    <td style="text-align: right;">${receipt.recipientFundingPerRecipient || receipt.totalRecipientFunding || 'N/A'} TRX</td>
                                    <td style="text-align: right;">${receipt.notificationTransferPerRecipient || receipt.totalNotificationTransfers || 'N/A'} TRX</td>
                                </tr>
                                `}
                            </tbody>
                        </table>
                    </div>

                    <div class="section">
                        <div class="section-title">II. Total Expenditure Summary</div>
                        <table>
                            <tbody>
                                <tr>
                                    <td style="width: 70%;">Total Service Fees (${receipt.recipientCount} recipient${receipt.recipientCount > 1 ? 's' : ''} × ${receipt.serviceFeePerRecipient || (receipt.totalServiceFees / receipt.recipientCount)} TRX)</td>
                                    <td style="width: 30%; text-align: right;">${receipt.totalServiceFees || 'N/A'} TRX</td>
                                </tr>
                                <tr>
                                    <td>Total Wallet Funding (${receipt.recipientCount} × ${receipt.recipientFundingPerRecipient || (receipt.totalRecipientFunding / receipt.recipientCount)} TRX)</td>
                                    <td style="text-align: right;">${receipt.totalRecipientFunding || 'N/A'} TRX</td>
                                </tr>
                                <tr>
                                    <td>Total Notification Transfers (${receipt.recipientCount} × ${receipt.notificationTransferPerRecipient || (receipt.totalNotificationTransfers / receipt.recipientCount)} TRX)</td>
                                    <td style="text-align: right;">${receipt.totalNotificationTransfers || 'N/A'} TRX</td>
                                </tr>
                                <tr style="border-top: 2px solid #000;">
                                    <td><strong>TOTAL EXPENDITURE</strong></td>
                                    <td style="text-align: right;"><strong>${receipt.totalPaymentTRX || (
                                        (receipt.totalServiceFees && receipt.totalRecipientFunding && receipt.totalNotificationTransfers)
                                            ? (parseFloat(receipt.totalServiceFees) + parseFloat(receipt.totalRecipientFunding) + parseFloat(receipt.totalNotificationTransfers))
                                            : 'N/A'
                                    )} TRX</strong></td>
                                </tr>
                            </tbody>
                        </table>
                        <p style="font-size: 9pt; margin-top: 10px; color: #666;">
                            <em>Note: Additional network fees (energy/bandwidth) may apply based on blockchain resource consumption.
                            These can be verified on the block explorer using the transaction hash.</em>
                        </p>
                    </div>

                    <div class="section">
                        <div class="section-title">III. Fee Explanation</div>
                        <div style="font-size: 10pt;">
                            <p><strong>Service Fee:</strong> Platform fee collected by BlockServed for blockchain service processing, document storage on IPFS, NFT minting, and transaction coordination.</p>
                            <p><strong>Wallet Funding:</strong> TRX sent to each recipient's wallet via the smart contract to ensure they have sufficient resources for blockchain interactions.</p>
                            <p><strong>Notification Transfer:</strong> Direct TRX transfer sent to each recipient with a memo containing the legal notice details. This appears as a visible transaction in the recipient's wallet, alerting them to the served notice.</p>
                            <p><strong>Network Fees:</strong> TRON blockchain charges for energy and bandwidth consumption. These fees are separate from the above and depend on the sender's staked TRX resources. Verify actual network costs on the block explorer.</p>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">IV. Blockchain Transaction Reference</div>
                        <div class="field-row">
                            <span class="field-label">Transaction Hash:</span>
                        </div>
                        <div class="tx-box">
                            ${txHash !== 'N/A' ? txHash : 'Transaction hash not available'}
                        </div>
                        <div class="field-row" style="margin-top: 10px;">
                            <span class="field-label">Verification URL:</span>
                            <span class="field-value" style="font-size: 9pt; word-break: break-all;">
                                ${txHash !== 'N/A' ? explorerUrl : 'N/A'}
                            </span>
                        </div>
                        <p style="font-size: 9pt; margin-top: 10px; color: #666;">
                            <em>All transactions are permanently recorded on the ${receipt.chainName || 'TRON'} blockchain and can be independently verified.</em>
                        </p>
                    </div>

                    <div class="footer">
                        BlockServed™ Proof of Service | Case ${receipt.caseNumber} | Page 4 of ${totalPages}<br>
                        <span style="font-size: 8pt;">Generated: ${generatedAtFormatted} | www.BlockServed.com</span>
                    </div>
                </div>
                ` : ''}
            </body>
            </html>
        `;

        return html;
    },
    
    // Print the receipt
    async printReceipt(caseData) {
        const receipt = await this.generateServiceReceipt(caseData);
        const html = this.generatePrintableReceipt(receipt);
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    },
    
    // Save receipt as PDF (using browser print to PDF)
    async saveReceiptAsPDF(caseData) {
        const receipt = await this.generateServiceReceipt(caseData);
        const html = this.generatePrintableReceipt(receipt);
        
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `proof-of-service-${receipt.caseNumber}.html`;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    // Generate stamped documents with delivery confirmation
    async generateStampedDocuments(caseData, pdfBlob) {
        try {
            // Load the PDF
            const arrayBuffer = await pdfBlob.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            
            // Create alert NFT info page as first page
            const alertPage = pdfDoc.insertPage(0, [612, 792]); // Letter size
            const { width: pageWidth, height: pageHeight } = alertPage.getSize();
            
            // Add title
            alertPage.drawText('LEGAL NOTICE DELIVERY CONFIRMATION', {
                x: 50,
                y: pageHeight - 80,
                size: 18,
                color: PDFLib.rgb(0, 0, 0)
            });
            
            // Add alert NFT thumbnail if available - check multiple possible locations
            const alertImage = caseData.alertImage || 
                             caseData.alertPreview || 
                             caseData.alert_preview || 
                             caseData.alert_image ||
                             caseData.metadata?.alertImage;
            
            console.log('Alert image available:', !!alertImage);
            
            if (alertImage) {
                try {
                    let imageBytes;
                    
                    // Check if it's a data URL or just base64
                    if (alertImage.startsWith('data:image')) {
                        // It's a data URL, extract the base64 part
                        const base64Data = alertImage.split(',')[1];
                        imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                    } else if (alertImage.startsWith('/9j/') || alertImage.startsWith('iVBOR')) {
                        // It's raw base64 (JPEG starts with /9j/, PNG with iVBOR)
                        imageBytes = Uint8Array.from(atob(alertImage), c => c.charCodeAt(0));
                    } else {
                        // Assume it needs to be fetched or is already bytes
                        console.log('Alert image format not recognized, skipping');
                        throw new Error('Unrecognized image format');
                    }
                    
                    // Determine image type and embed
                    let embeddedImage;
                    // Check for PNG magic bytes (89 50 4E 47)
                    if (imageBytes[0] === 0x89 && imageBytes[1] === 0x50) {
                        console.log('Embedding as PNG');
                        embeddedImage = await pdfDoc.embedPng(imageBytes);
                    } else {
                        // Assume JPEG
                        console.log('Embedding as JPEG');
                        embeddedImage = await pdfDoc.embedJpg(imageBytes);
                    }
                    
                    // Calculate dimensions to fit nicely on page
                    const maxWidth = pageWidth - 100; // Leave 50px margins
                    const maxHeight = 250; // Max height for the image
                    
                    let scale = 1;
                    const origWidth = embeddedImage.width;
                    const origHeight = embeddedImage.height;
                    
                    if (origWidth > maxWidth) {
                        scale = maxWidth / origWidth;
                    }
                    if (origHeight * scale > maxHeight) {
                        scale = maxHeight / origHeight;
                    }
                    
                    const imgDims = embeddedImage.scale(scale);
                    
                    // Center the image horizontally, position below title
                    alertPage.drawImage(embeddedImage, {
                        x: pageWidth / 2 - imgDims.width / 2,
                        y: pageHeight - 120 - imgDims.height, // Position below title
                        width: imgDims.width,
                        height: imgDims.height
                    });
                    
                    console.log('Alert NFT image successfully embedded');
                } catch (imgError) {
                    console.error('Failed to embed alert image:', imgError);
                    // Continue without image
                }
            } else {
                console.log('No alert image found in case data');
            }
            
            // Add NFT details - check multiple field name variations
            const txHash = caseData.transactionHash || caseData.transaction_hash || caseData.txHash || caseData.alertTxId || 'Not Available';
            const tokenId = caseData.alertTokenId || caseData.alert_token_id || caseData.tokenId || 'N/A';
            const servedAt = caseData.servedAt || caseData.served_at || caseData.createdAt || new Date().toISOString();
            const caseNum = caseData.caseNumber || caseData.case_number || 'Unknown';
            const agency = caseData.agency || caseData.issuingAgency || caseData.issuing_agency || 'via Blockserved.com';
            const noticeType = caseData.noticeType || caseData.notice_type || 'Legal Notice';

            const detailsY = alertImage ? pageHeight - 450 : pageHeight - 150;
            const servedAtFormatted = this.formatDateTime(servedAt);
            const servedDateFormatted = this.formatDate(servedAt);
            const details = [
                'NFT INFORMATION',
                '---------------------------------------------------',
                '',
                `Token ID: #${tokenId}`,
                `Case Number: ${caseNum}`,
                `Service Date: ${servedAtFormatted}`,
                `Issuing Agency: ${agency}`,
                `Notice Type: ${noticeType}`,
                '',
                'BLOCKCHAIN VERIFICATION',
                '---------------------------------------------------',
                '',
                `Transaction Hash:`,
                `${txHash}`,
                '',
                'INSTRUCTIONS FOR RECIPIENTS',
                '---------------------------------------------------',
                '',
                '1. This NFT serves as proof of delivery for the attached legal documents.',
                '2. The NFT has been permanently recorded on the TRON blockchain.',
                '3. You can verify this transaction on TronScan using the transaction hash above.',
                '4. The following pages contain the served legal documents.',
                '5. If action is required, please refer to the document contents.',
                '',
                'IMPORTANT: This is an official legal notice. The NFT in your wallet',
                'confirms delivery. Please review the attached documents carefully.'
            ];
            
            let yPosition = detailsY;
            for (const line of details) {
                const fontSize = line.includes('---') ? 10 :
                               line.includes('INSTRUCTIONS') || line.includes('BLOCKCHAIN') || line.includes('NFT INFORMATION') ? 12 : 10;
                const fontColor = line.includes('---') ? PDFLib.rgb(0.5, 0.5, 0.5) :
                                 line.includes('INSTRUCTIONS') || line.includes('BLOCKCHAIN') || line.includes('NFT INFORMATION') ? PDFLib.rgb(0, 0, 0.8) :
                                 PDFLib.rgb(0, 0, 0);
                
                alertPage.drawText(line, {
                    x: 50,
                    y: yPosition,
                    size: fontSize,
                    color: fontColor
                });
                yPosition -= fontSize + 6;
            }
            
            // Get all existing pages
            const pages = pdfDoc.getPages();
            
            // Stamp each page (skip the first alert page)
            for (let i = 1; i < pages.length; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();
                
                // Position stamp at bottom center
                const stampWidth = 400; // Wide enough for transaction hash
                const stampHeight = 70;
                const stampX = (width - stampWidth) / 2; // Center horizontally
                const stampY = 30; // 30px from bottom
                
                // Add red stamp box with rounded appearance
                page.drawRectangle({
                    x: stampX,
                    y: stampY,
                    width: stampWidth,
                    height: stampHeight,
                    borderColor: PDFLib.rgb(0.8, 0, 0),
                    borderWidth: 2,
                    color: PDFLib.rgb(1, 0.98, 0.98)
                });
                
                // Add stamp text centered
                const lines = [
                    'DELIVERED via BlockServed™',
                    `Date: ${servedDateFormatted} | Case: ${caseNum}`,
                    `Transaction Hash:`,
                    `${txHash}`
                ];
                
                // Calculate text positioning for centering
                let textY = stampY + stampHeight - 18;
                for (let j = 0; j < lines.length; j++) {
                    const line = lines[j];
                    const fontSize = j === 0 ? 10 : 8; // Larger font for title
                    const isBold = j === 0 || j === 2; // Bold for title and "Transaction Hash:"
                    
                    // Estimate text width for centering (rough approximation)
                    const textWidth = line.length * (fontSize * 0.5);
                    const textX = stampX + (stampWidth - textWidth) / 2;
                    
                    page.drawText(line, {
                        x: textX,
                        y: textY,
                        size: fontSize,
                        color: isBold ? PDFLib.rgb(0.6, 0, 0) : PDFLib.rgb(0.8, 0, 0)
                    });
                    textY -= fontSize + 4;
                }
            }
            
            // Save the stamped PDF
            const stampedPdfBytes = await pdfDoc.save();
            return new Blob([stampedPdfBytes], { type: 'application/pdf' });
            
        } catch (error) {
            console.error('Failed to stamp documents:', error);
            throw error;
        }
    },
    
    // Decrypt AES-256-GCM encrypted PDF data
    async decryptPDF(encryptedBuffer, keyHex) {
        try {
            // The encrypted data format is: IV (16 bytes) + Auth Tag (16 bytes) + Encrypted Data
            const IV_LENGTH = 16;
            const TAG_LENGTH = 16;
            
            const encrypted = new Uint8Array(encryptedBuffer);
            
            // Extract components
            const iv = encrypted.slice(0, IV_LENGTH);
            const authTag = encrypted.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
            const ciphertext = encrypted.slice(IV_LENGTH + TAG_LENGTH);
            
            // Import the key for decryption
            const keyBuffer = this.hexToBuffer(keyHex);
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyBuffer,
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );
            
            // Decrypt the data
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv,
                    tagLength: 128, // 16 bytes * 8 = 128 bits
                    additionalData: new Uint8Array(0)
                },
                cryptoKey,
                new Uint8Array([...ciphertext, ...authTag]) // Combine ciphertext with auth tag
            );
            
            return decrypted;
        } catch (error) {
            console.error('Failed to decrypt PDF:', error);
            return null;
        }
    },
    
    // Helper to convert hex string to buffer
    hexToBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes.buffer;
    },
    
    // Show PDF in modal with print/save options
    showPDFModal(pdfBlob, caseNumber) {
        // Create modal HTML
        const modalHTML = `
            <div id="pdfModal" class="modal fade show" style="display: block; background: rgba(0,0,0,0.5);">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Stamped Legal Documents - Case ${caseNumber}</h5>
                            <button type="button" class="btn-close" onclick="document.getElementById('pdfModal').remove()"></button>
                        </div>
                        <div class="modal-body">
                            <iframe id="pdfFrame" style="width: 100%; height: 500px; border: 1px solid #ddd;"></iframe>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" id="printPdfBtn">
                                <i class="bi bi-printer"></i> Print Document
                            </button>
                            <button type="button" class="btn btn-success" id="savePdfBtn">
                                <i class="bi bi-download"></i> Save to Computer
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="document.getElementById('pdfModal').remove()">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = modalHTML;
        document.body.appendChild(modalDiv.firstElementChild);
        
        // Load PDF in iframe
        const pdfUrl = URL.createObjectURL(pdfBlob);
        document.getElementById('pdfFrame').src = pdfUrl;
        
        // Print button handler
        document.getElementById('printPdfBtn').onclick = () => {
            const printWindow = window.open(pdfUrl, '_blank');
            printWindow.onload = () => {
                printWindow.print();
            };
        };
        
        // Save button handler
        document.getElementById('savePdfBtn').onclick = () => {
            const a = document.createElement('a');
            a.href = pdfUrl;
            a.download = `stamped-${caseNumber}.pdf`;
            a.click();
        };
        
        // Clean up object URL when modal is closed
        const modal = document.getElementById('pdfModal');
        const observer = new MutationObserver(() => {
            if (!document.contains(modal)) {
                URL.revokeObjectURL(pdfUrl);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true });
    },
    
    // Show loading indicator
    showLoading(message = 'Generating stamped documents...') {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'stampedDocLoading';
        loadingDiv.className = 'alert alert-info position-fixed top-50 start-50 translate-middle';
        loadingDiv.style.cssText = 'z-index: 9999; min-width: 300px; text-align: center;';
        loadingDiv.innerHTML = `
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            <span>${message}</span>
        `;
        document.body.appendChild(loadingDiv);
        return loadingDiv;
    },
    
    // Hide loading indicator
    hideLoading() {
        const loadingDiv = document.getElementById('stampedDocLoading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    },
    
    // Export stamped documents
    async exportStampedDocuments(caseData) {
        // Show loading indicator
        this.showLoading('Preparing stamped documents...');
        
        try {
            let pdfBlob = null;
            const caseId = caseData.caseNumber || caseData.case_number || caseData.id;
            const ipfsHash = caseData.ipfsDocument || caseData.ipfsHash || caseData.metadata?.ipfsHash;
            
            // First try IPFS if we have a hash (since IPFS contains the encrypted binary)
            if (ipfsHash) {
                try {
                    this.showLoading('Fetching document from IPFS...');
                    console.log('Fetching encrypted PDF from IPFS:', ipfsHash);
                    const ipfsGateway = 'https://gateway.pinata.cloud/ipfs/';
                    
                    // Try IPFS with timeout to avoid hanging on CORS/rate limit issues
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
                    
                    const ipfsResponse = await fetch(ipfsGateway + ipfsHash, {
                        signal: controller.signal,
                        mode: 'cors'
                    });
                    clearTimeout(timeout);
                    
                    if (ipfsResponse.ok) {
                        const encryptedData = await ipfsResponse.arrayBuffer();
                        
                        // Get the encryption key - it should be stored with the case
                        const encryptionKey = caseData.encryptionKey || caseData.encryption_key || caseData.metadata?.encryptionKey;
                        
                        if (encryptionKey) {
                            // Try decrypting with the stored encryption key
                            const decryptedData = await this.decryptPDF(encryptedData, encryptionKey);
                            
                            if (decryptedData) {
                                // Check if decrypted data is a valid PDF
                                const bytes = new Uint8Array(decryptedData);
                                const pdfHeader = [0x25, 0x50, 0x44, 0x46]; // %PDF
                                const isPDF = bytes[0] === pdfHeader[0] && bytes[1] === pdfHeader[1] && 
                                             bytes[2] === pdfHeader[2] && bytes[3] === pdfHeader[3];
                                
                                if (isPDF) {
                                    console.log('Successfully decrypted PDF from IPFS');
                                    pdfBlob = new Blob([decryptedData], { type: 'application/pdf' });
                                }
                            }
                        }
                        
                        if (!pdfBlob) {
                            // Maybe it's not encrypted, try as raw PDF
                            const rawBytes = new Uint8Array(encryptedData);
                            const pdfHeader = [0x25, 0x50, 0x44, 0x46]; // %PDF
                            const isRawPDF = rawBytes[0] === pdfHeader[0] && rawBytes[1] === pdfHeader[1] && 
                                            rawBytes[2] === pdfHeader[2] && rawBytes[3] === pdfHeader[3];
                            
                            if (isRawPDF) {
                                console.log('IPFS data is already a PDF (not encrypted)');
                                pdfBlob = new Blob([encryptedData], { type: 'application/pdf' });
                            } else {
                                console.log('IPFS data is encrypted but no encryption key found in case data');
                            }
                        }
                    }
                } catch (ipfsError) {
                    console.error('IPFS fetch/decrypt failed:', ipfsError);
                    // Don't worry about IPFS failures, just fallback to backend
                    if (ipfsError.name === 'AbortError') {
                        console.log('IPFS request timed out, falling back to backend');
                    } else if (ipfsError.message.includes('CORS')) {
                        console.log('IPFS CORS issue, falling back to backend');
                    } else {
                        console.log('IPFS error, falling back to backend');
                    }
                }
            }
            
            // If IPFS didn't work, try backend
            if (!pdfBlob) {
                this.showLoading('Fetching document from server...');
                const backendUrl = 'https://nftserviceapp.onrender.com';
                const pdfUrl = `${backendUrl}/api/cases/${caseId}/pdf`;
                
                console.log('Fetching PDF from backend:', pdfUrl);
                
                const response = await fetchWithTimeout(pdfUrl, {
                    headers: {
                        'X-Server-Address': window.wallet?.address || 'TN6RjhuLZmgbpKvNKE8Diz7XqXnAEFWsPq'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch PDF: Backend returned ${response.status}`);
                }
                
                pdfBlob = await response.blob();
                
                // Verify it's actually a PDF
                const arrayBuffer = await pdfBlob.slice(0, 4).arrayBuffer();
                const header = new Uint8Array(arrayBuffer);
                const pdfHeader = [0x25, 0x50, 0x44, 0x46]; // %PDF
                const isPDF = header[0] === pdfHeader[0] && header[1] === pdfHeader[1] && 
                             header[2] === pdfHeader[2] && header[3] === pdfHeader[3];
                
                if (!isPDF) {
                    console.error('Backend data is not a valid PDF');
                    alert('The document is not in PDF format. Downloading original file.');
                    
                    // Just download the original
                    const url = URL.createObjectURL(pdfBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `case-${caseId}-documents`;
                    a.click();
                    URL.revokeObjectURL(url);
                    return;
                }
            }
            
            if (!pdfBlob) {
                throw new Error('No document data available');
            }
            
            // Update loading message
            this.showLoading('Generating stamps and adding delivery confirmation...');
            
            // Generate stamped version
            const stampedBlob = await this.generateStampedDocuments(caseData, pdfBlob);
            
            // Hide loading indicator
            this.hideLoading();
            
            // Show in modal with print/save options
            this.showPDFModal(stampedBlob, caseData.caseNumber);
            
        } catch (error) {
            console.error('Failed to export stamped documents:', error);
            
            // Hide loading indicator if visible
            this.hideLoading();
            
            alert('Failed to export stamped documents. Please ensure the case has valid document data.');
        }
    }
};

// Make available globally
window.proofOfService = window.proofOfService;