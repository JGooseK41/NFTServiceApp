// Contract Module - Optimized for Lite Contract
// Single NFT per serve, simplified fee structure

window.contract = {
    instance: null,
    tronWeb: null,
    address: null,
    abi: null,
    contractType: 'lite', // Always Lite contract

    // Initialize contract module
    async init() {
        console.log('Initializing Lite contract module...');
        await this.loadABI();
    },

    // Load Lite contract ABI (v2 with recipient funding)
    async loadABI() {
        try {
            // Determine base path based on current location
            const pathname = window.location.pathname;
            let basePath = '';
            if (pathname.includes('/js-v2/') || pathname.endsWith('/js-v2')) {
                basePath = ''; // Already in js-v2 directory
            } else if (pathname.includes('/v2/')) {
                basePath = ''; // In v2 subdirectory
            } else {
                basePath = 'js-v2/'; // Accessed from root
            }

            // Try v2 ABI first (with recipient funding support)
            let response = await fetch(basePath + 'lite-contract-abi-v2.json');

            if (response.ok) {
                this.abi = await response.json();
                this.contractVersion = 2;
                console.log('Lite Contract ABI v2 loaded (with recipient funding)');
            } else {
                // Fall back to v1 ABI
                response = await fetch(basePath + 'lite-contract-abi.json');
                if (response.ok) {
                    this.abi = await response.json();
                    this.contractVersion = 1;
                    console.log('Lite Contract ABI v1 loaded (legacy)');
                } else {
                    throw new Error('Failed to fetch Lite contract ABI');
                }
            }
        } catch (error) {
            console.error('Failed to load ABI:', error);
            throw error;
        }
    },

    // Always returns true - we only use Lite contract now
    isLiteContract() {
        return true;
    },

    // Initialize contract with wallet
    async initialize(tronWeb) {
        if (!tronWeb) {
            throw new Error('TronWeb not provided');
        }

        this.tronWeb = tronWeb;
        this.address = getCurrentNetwork().contractAddress;

        if (!this.abi) {
            await this.loadABI();
        }

        try {
            window.CONTRACT_ABI = this.abi;
            this.instance = await this.tronWeb.contract(this.abi, this.address);
            window.legalContract = this.instance;

            console.log('Lite Contract initialized at:', this.address);

            // Verify serveNoticeBatch is available
            if (this.instance.serveNoticeBatch) {
                console.log('✓ serveNoticeBatch method found');
            } else {
                console.error('✗ serveNoticeBatch method NOT found');
            }

            await this.checkAdminRole();
            return true;
        } catch (error) {
            console.error('Failed to initialize contract:', error);
            throw error;
        }
    },

    // Check if current user has admin role
    async checkAdminRole() {
        try {
            const userAddress = this.tronWeb.defaultAddress.base58;

            // Check owner wallet
            const ownerWallets = [
                'TN6RjhuLZmgbpKvNKE8Diz7XqXnAEFWsPq',
                'tn6rjhulzmgbpkvnke8diz7xqxnaefwspq'
            ];

            if (ownerWallets.includes(userAddress) || ownerWallets.includes(userAddress.toLowerCase())) {
                console.log('Owner wallet detected - admin access granted');
                return true;
            }

            // Lite contract uses isAdmin() or admins() mapping
            try {
                const isAdmin = await this.instance.admins(userAddress).call();
                console.log('Is admin:', isAdmin);
                return isAdmin;
            } catch (e) {
                console.log('Admin check not available:', e.message);
                return false;
            }
        } catch (error) {
            console.error('Failed to check admin role:', error);
            return false;
        }
    },

    // ====================
    // ADMIN FUNCTIONS (Lite contract style)
    // ====================

    // Update service fee (platform fee)
    async updateServiceFee(newFee) {
        try {
            const feeInSun = this.tronWeb.toSun(newFee);
            const tx = await this.instance.setFee(feeInSun).send();
            console.log('Service fee updated:', tx);
            return { success: true, txId: tx };
        } catch (error) {
            console.error('Failed to update service fee:', error);
            throw error;
        }
    },

    // Update recipient funding (TRX sent to recipient for gas)
    async updateRecipientFunding(newAmount) {
        try {
            const amountInSun = this.tronWeb.toSun(newAmount);
            const tx = await this.instance.setRecipientFunding(amountInSun).send();
            console.log('Recipient funding updated:', tx);
            return { success: true, txId: tx };
        } catch (error) {
            console.error('Failed to update recipient funding:', error);
            throw error;
        }
    },

    // Get fee configuration from contract
    async getFeeConfig() {
        try {
            // Try v2 getFeeConfig first
            if (this.instance.getFeeConfig) {
                try {
                    const config = await this.instance.getFeeConfig().call();
                    return {
                        serviceFee: parseInt(config._serviceFee || config[0]),
                        recipientFunding: parseInt(config._recipientFunding || config[1]),
                        totalPerNotice: parseInt(config._totalPerNotice || config[2]),
                        serviceFeeInTRX: parseInt(config._serviceFee || config[0]) / 1000000,
                        recipientFundingInTRX: parseInt(config._recipientFunding || config[1]) / 1000000,
                        totalPerNoticeInTRX: parseInt(config._totalPerNotice || config[2]) / 1000000
                    };
                } catch (v2Error) {
                    console.warn('v2 getFeeConfig failed, trying v1 fallback:', v2Error.message);
                }
            }

            // Fallback for v1 contract (no recipient funding)
            const serviceFee = parseInt(await this.instance.serviceFee().call());
            return {
                serviceFee: serviceFee,
                recipientFunding: 0,
                totalPerNotice: serviceFee,
                serviceFeeInTRX: serviceFee / 1000000,
                recipientFundingInTRX: 0,
                totalPerNoticeInTRX: serviceFee / 1000000
            };
        } catch (error) {
            console.error('Failed to get fee config:', error);
            throw error;
        }
    },

    // Get required payment for single notice
    async getRequiredPayment() {
        try {
            if (this.instance.getRequiredPayment) {
                return parseInt(await this.instance.getRequiredPayment().call());
            }
            // Fallback: get fee config and calculate
            const config = await this.getFeeConfig();
            return config.totalPerNotice;
        } catch (error) {
            console.error('Failed to get required payment:', error);
            throw error;
        }
    },

    // Get required payment for batch notices
    async getRequiredPaymentBatch(count) {
        try {
            if (this.instance.getRequiredPaymentBatch) {
                return parseInt(await this.instance.getRequiredPaymentBatch(count).call());
            }
            // Fallback: get fee config and calculate
            const config = await this.getFeeConfig();
            return config.totalPerNotice * count;
        } catch (error) {
            console.error('Failed to get required batch payment:', error);
            throw error;
        }
    },

    // Authorize server (process server role)
    async grantRole(role, address) {
        try {
            if (role === 'PROCESS_SERVER' || role === getConfig('contract.roles.PROCESS_SERVER_ROLE')) {
                const tx = await this.instance.setServer(address, true).send();
                console.log('Server authorized:', tx);
                return { success: true, txId: tx };
            } else if (role === 'ADMIN') {
                const tx = await this.instance.setAdmin(address, true).send();
                console.log('Admin added:', tx);
                return { success: true, txId: tx };
            } else {
                throw new Error('Lite contract only supports PROCESS_SERVER and ADMIN roles');
            }
        } catch (error) {
            console.error('Failed to grant role:', error);
            throw error;
        }
    },

    // Revoke role
    async revokeRole(role, address) {
        try {
            if (role === 'PROCESS_SERVER' || role === getConfig('contract.roles.PROCESS_SERVER_ROLE')) {
                const tx = await this.instance.setServer(address, false).send();
                console.log('Server revoked:', tx);
                return { success: true, txId: tx };
            } else if (role === 'ADMIN') {
                const tx = await this.instance.setAdmin(address, false).send();
                console.log('Admin removed:', tx);
                return { success: true, txId: tx };
            } else {
                throw new Error('Lite contract only supports PROCESS_SERVER and ADMIN roles');
            }
        } catch (error) {
            console.error('Failed to revoke role:', error);
            throw error;
        }
    },

    // ====================
    // NOTICE FUNCTIONS (Lite contract - single NFT per serve)
    // ====================

    // Create single NFT for one recipient
    async createAlertNFT(data) {
        try {
            // Build TRC-721 compliant metadata
            const metadata = {
                name: `Legal Notice - Case #${data.caseNumber}`,
                description: this._buildNoticeDescription(data),
                image: this._toGatewayUrl(data.thumbnailUrl || data.thumbnail),
                external_url: `https://blockserved.com?case=${encodeURIComponent(data.caseNumber)}`,
                background_color: "1a1a2e",
                attributes: [
                    { trait_type: "Notice Type", value: "Legal Service" },
                    { trait_type: "Case Number", value: data.caseNumber },
                    { trait_type: "Status", value: "Delivered" },
                    { trait_type: "Service Date", display_type: "date", value: new Date().toLocaleDateString() },
                    { trait_type: "Agency", value: data.agency || "via Blockserved.com" },
                    { trait_type: "Portal", value: "blockserved.com" }
                ]
            };

            // Try uploading metadata to IPFS for wallet compatibility
            let metadataUri = '';
            if (window.documents?.uploadToIPFS) {
                try {
                    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
                    const ipfsHash = await window.documents.uploadToIPFS(metadataBlob, {
                        caseNumber: data.caseNumber,
                        type: 'nft_metadata',
                        encrypt: false
                    });
                    if (ipfsHash) {
                        metadataUri = `ipfs://${ipfsHash}`;
                        console.log('Metadata uploaded to IPFS:', metadataUri);
                    }
                } catch (e) {
                    console.log('IPFS metadata upload failed, using inline fallback');
                }
            }

            // Fallback to base64 data URI
            if (!metadataUri) {
                metadataUri = 'data:application/json;base64,' +
                    btoa(unescape(encodeURIComponent(JSON.stringify(metadata))));
            }

            // Validate recipient
            if (!data.recipient) {
                throw new Error('Recipient address is required');
            }

            const recipientAddress = typeof data.recipient === 'object' ?
                data.recipient.address : data.recipient;

            console.log('Creating NFT for recipient:', recipientAddress);

            if (!this.instance || !this.instance.serveNotice) {
                throw new Error('Contract not initialized or serveNotice method not found');
            }

            // Get fee configuration (service fee + recipient funding)
            const feeConfig = await this.getFeeConfig();
            console.log('Fee config:', {
                serviceFee: feeConfig.serviceFeeInTRX + ' TRX',
                recipientFunding: feeConfig.recipientFundingInTRX + ' TRX',
                total: feeConfig.totalPerNoticeInTRX + ' TRX'
            });

            // Check if wallet is fee exempt (still pays recipient funding)
            const walletAddress = this.tronWeb.defaultAddress.base58;
            let totalPayment = feeConfig.totalPerNotice;

            try {
                const isExempt = await this.instance.feeExempt(walletAddress).call();
                if (isExempt) {
                    totalPayment = feeConfig.recipientFunding; // Only pay recipient funding
                    console.log('Wallet is fee exempt - only paying recipient funding');
                }
            } catch (e) {
                // Fee exempt check not available, pay full amount
            }

            console.log('Total payment:', totalPayment / 1000000, 'TRX');

            // Call Lite contract serveNotice(recipient, metadataUri)
            const txHash = await this.instance.serveNotice(
                recipientAddress,
                metadataUri
            ).send({
                feeLimit: 150000000,
                callValue: totalPayment
            });

            console.log('NFT created, txHash:', txHash);

            // Wait for token ID extraction (up to ~15s) before returning
            // Mainnet indexing can take 3-6 seconds
            let tokenId = null;
            try {
                tokenId = await this._extractTokenId(txHash, 5);
                if (tokenId) {
                    console.log('✅ Token ID extracted:', tokenId);
                    this._lastTokenId = tokenId;
                    this._tokenIdCache = this._tokenIdCache || {};
                    this._tokenIdCache[txHash] = tokenId;
                }
            } catch (e) {
                console.warn('Token ID extraction failed, will show as N/A:', e.message);
            }

            return {
                success: true,
                txId: txHash,
                alertTx: txHash,
                tokenId: tokenId,
                // Exact fee breakdown for receipt documentation
                paymentDetails: {
                    serviceFee: feeConfig.serviceFeeInTRX,
                    recipientFunding: feeConfig.recipientFundingInTRX,
                    totalPaymentTRX: totalPayment / 1000000,
                    recipientCount: 1
                }
            };

        } catch (error) {
            console.error('Failed to create NFT:', error);
            throw error;
        }
    },

    // Create batch NFTs for multiple recipients
    async createBatchNotices(data) {
        try {
            console.log('Creating batch notices for', data.recipients.length, 'recipients');

            // Build shared metadata
            const metadata = {
                name: `${data.agency || 'Legal Notice'} - Case #${data.caseNumber}`,
                description: this._buildNoticeDescription(data),
                image: this._toGatewayUrl(data.thumbnailUrl) || 'https://blockserved.com/images/legal-notice-thumb.png',
                external_url: `https://blockserved.com?case=${encodeURIComponent(data.caseNumber)}`,
                background_color: "1a1a2e",
                attributes: [
                    { trait_type: "Case Number", value: data.caseNumber },
                    { trait_type: "Recipients", value: String(data.recipients.length) },
                    { trait_type: "Notice Type", value: data.noticeType || "Legal Notice" },
                    { trait_type: "Status", value: "Delivered" },
                    { trait_type: "Agency", value: data.agency || "via Blockserved.com" },
                    { trait_type: "Service Date", display_type: "date", value: new Date().toLocaleDateString() },
                    { trait_type: "Portal", value: "blockserved.com" }
                ],
                properties: {
                    ipfs_document: data.ipfsHash || null,
                    encrypted: !!data.encryptionKey
                }
            };

            // Try to upload metadata to IPFS for efficiency
            let metadataUri = '';
            if (data.useIPFS !== false && window.documents?.uploadToIPFS) {
                try {
                    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
                    const ipfsHash = await window.documents.uploadToIPFS(metadataBlob, { encrypt: false });
                    if (ipfsHash) {
                        metadataUri = `ipfs://${ipfsHash}`;
                        console.log('Metadata uploaded to IPFS:', metadataUri);
                    }
                } catch (e) {
                    console.log('IPFS upload failed, using inline metadata');
                }
            }

            // Fallback to inline metadata
            if (!metadataUri) {
                metadataUri = 'data:application/json;base64,' +
                    btoa(unescape(encodeURIComponent(JSON.stringify(metadata))));
            }

            // Prepare arrays for batch call
            const recipients = data.recipients.map(r =>
                typeof r === 'object' ? r.address : r
            );
            const metadataURIs = recipients.map(() => metadataUri);

            // Get fee configuration (service fee + recipient funding)
            const feeConfig = await this.getFeeConfig();
            console.log('Fee config per recipient:', {
                serviceFee: feeConfig.serviceFeeInTRX + ' TRX',
                recipientFunding: feeConfig.recipientFundingInTRX + ' TRX',
                total: feeConfig.totalPerNoticeInTRX + ' TRX'
            });

            // Check fee exemption
            const walletAddress = this.tronWeb.defaultAddress.base58;
            let paymentPerRecipient = feeConfig.totalPerNotice;

            try {
                const isExempt = await this.instance.feeExempt(walletAddress).call();
                if (isExempt) {
                    paymentPerRecipient = feeConfig.recipientFunding; // Only pay recipient funding
                    console.log('Wallet is fee exempt - only paying recipient funding');
                }
            } catch (e) {
                // Fee exempt check not available, pay full amount
            }

            const totalFee = paymentPerRecipient * recipients.length;
            console.log('Total payment:', totalFee / 1000000, 'TRX for', recipients.length, 'recipients');
            console.log('Breakdown:', {
                serviceFees: (feeConfig.serviceFee * recipients.length) / 1000000 + ' TRX',
                recipientFunding: (feeConfig.recipientFunding * recipients.length) / 1000000 + ' TRX'
            });

            // Call batch function
            const txHash = await this.instance.serveNoticeBatch(
                recipients,
                metadataURIs
            ).send({
                feeLimit: 500000000,
                callValue: totalFee
            });

            console.log('Batch transaction successful:', txHash);

            // Extract token IDs in background (don't block success modal)
            this._extractBatchTokenIds(txHash, recipients.length).then(tokenIds => {
                if (tokenIds && tokenIds.length > 0) {
                    console.log('Token IDs extracted in background:', tokenIds);
                    this._tokenIdCache = this._tokenIdCache || {};
                    this._tokenIdCache[txHash] = tokenIds;
                }
            });

            // Return immediately - token IDs will be available later
            return {
                success: true,
                txId: txHash,
                alertTx: txHash,
                tokenIds: null, // Will be populated async
                recipientCount: recipients.length,
                // Exact fee breakdown for receipt documentation
                paymentDetails: {
                    serviceFeePerRecipient: feeConfig.serviceFeeInTRX,
                    recipientFundingPerRecipient: feeConfig.recipientFundingInTRX,
                    totalServiceFees: feeConfig.serviceFeeInTRX * recipients.length,
                    totalRecipientFunding: feeConfig.recipientFundingInTRX * recipients.length,
                    totalPaymentTRX: totalFee / 1000000,
                    recipientCount: recipients.length
                }
            };

        } catch (error) {
            console.error('Failed to create batch notices:', error);
            throw error;
        }
    },

    // Mint to selected recipients (fallback for failed batch)
    async mintToSelectedRecipients(recipients, originalData) {
        console.log('Minting individually to', recipients.length, 'recipients');
        const results = [];

        // Get fee configuration for logging
        const feeConfig = await this.getFeeConfig();
        console.log('Fee config per recipient:', feeConfig.totalPerNoticeInTRX, 'TRX');

        for (const recipient of recipients) {
            try {
                const recipientAddress = typeof recipient === 'object' ? recipient.address : recipient;
                console.log(`Minting for ${recipientAddress}...`);

                const result = await this.createAlertNFT({
                    ...originalData,
                    recipient: recipientAddress
                });

                results.push({
                    recipient: recipientAddress,
                    txId: result.txId,
                    tokenId: result.tokenId,
                    success: true
                });

                console.log(`✅ Minted for ${recipientAddress}`);

            } catch (error) {
                console.error(`Failed for ${recipient}:`, error);
                results.push({
                    recipient: typeof recipient === 'object' ? recipient.address : recipient,
                    error: error.message,
                    success: false
                });
            }
        }

        return {
            success: results.some(r => r.success),
            results,
            successCount: results.filter(r => r.success).length,
            failedCount: results.filter(r => !r.success).length
        };
    },

    // ====================
    // QUERY FUNCTIONS
    // ====================

    // Get current service fee
    async getCurrentFees() {
        try {
            const serviceFee = await this.instance.serviceFee().call();
            return {
                service: this.tronWeb.fromSun(serviceFee),
                creation: this.tronWeb.fromSun(serviceFee), // Alias for compatibility
            };
        } catch (error) {
            console.error('Failed to get fees:', error);
            throw error;
        }
    },

    // Get token URI
    async getTokenURI(tokenId) {
        try {
            return await this.instance.tokenURI(tokenId).call();
        } catch (error) {
            console.error('Failed to get token URI:', error);
            throw error;
        }
    },

    // Check if address is authorized server
    async hasRole(role, address) {
        try {
            if (role === 'PROCESS_SERVER' || role === getConfig('contract.roles.PROCESS_SERVER_ROLE')) {
                return await this.instance.servers(address).call();
            } else if (role === 'ADMIN') {
                return await this.instance.admins(address).call();
            }
            return false;
        } catch (error) {
            console.error('Failed to check role:', error);
            return false;
        }
    },

    // Get total supply
    async getTotalSupply() {
        try {
            const supply = await this.instance.totalSupply().call();
            return supply.toString();
        } catch (error) {
            console.error('Failed to get total supply:', error);
            throw error;
        }
    },

    // ====================
    // HELPER FUNCTIONS
    // ====================

    // Convert ipfs:// URL to HTTPS gateway URL for wallet compatibility
    _toGatewayUrl(url) {
        if (url && url.startsWith('ipfs://')) {
            return 'https://gateway.pinata.cloud/ipfs/' + url.slice(7);
        }
        return url;
    },

    // Build notice description for metadata
    _buildNoticeDescription(data) {
        return `⚖️ OFFICIAL LEGAL NOTICE ⚖️\n\n` +
            `You have been served a legal document for Case #${data.caseNumber}.\n\n` +
            `📋 ACCESS YOUR DOCUMENT AT:\n` +
            `👉 https://www.blockserved.com\n\n` +
            `HOW TO CONNECT:\n` +
            `• Desktop: Visit https://www.blockserved.com and connect your wallet\n` +
            `• Mobile: Open the browser inside your wallet app and go to https://www.blockserved.com\n\n` +
            `Your document will be available immediately after connecting.\n\n` +
            `💡 FREE TO SIGN: The sender has covered your transaction fees.\n` +
            `⏰ Legal notices may have deadlines — please review promptly.\n\n` +
            `🏛️ ISSUING AGENCY: ${data.agency || 'via Blockserved.com'}\n` +
            (data.noticeEmail ? `📧 CONTACT: ${data.noticeEmail}\n` : '') +
            (data.noticePhone ? `📞 PHONE: ${data.noticePhone}\n` : '') +
            `\n✅ This NFT is your proof of service on the blockchain.`;
    },

    // Async wrapper for token ID extraction (non-blocking)
    async _extractTokenIdAsync(txHash) {
        // Small initial delay to let transaction propagate
        await new Promise(r => setTimeout(r, 3000));
        return this._extractTokenId(txHash, 3); // Fewer retries for background
    },

    // Extract token ID from single transaction
    async _extractTokenId(txHash, maxRetries = 5) {
        console.log('🔍 Extracting token ID from tx:', txHash);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Wait with exponential backoff
                await new Promise(r => setTimeout(r, 2000 * attempt));

                const txInfo = await window.tronWeb.trx.getTransactionInfo(txHash);
                console.log(`  Attempt ${attempt}: txInfo received, logs:`, txInfo?.log?.length || 0);

                if (txInfo && txInfo.log && txInfo.log.length > 0) {
                    for (let i = 0; i < txInfo.log.length; i++) {
                        const log = txInfo.log[i];
                        // Transfer event: topics[3] is tokenId
                        if (log.topics && log.topics.length >= 4) {
                            const tokenIdHex = log.topics[3];
                            if (tokenIdHex) {
                                const tokenId = parseInt(tokenIdHex, 16);
                                console.log('✅ Extracted token ID:', tokenId);
                                return tokenId;
                            }
                        }
                    }
                    console.log('  Logs found but no Transfer event with tokenId');
                } else if (txInfo && !txInfo.log) {
                    console.log('  Transaction confirmed but no logs yet');
                }

                if (attempt < maxRetries) {
                    console.log(`  Token ID not found yet, retry ${attempt}/${maxRetries}...`);
                }
            } catch (e) {
                console.log(`  Token extraction attempt ${attempt} failed:`, e.message);
            }
        }

        // Fallback: Try TronGrid events API directly
        console.log('  Trying TronGrid events API fallback...');
        const tokenId = await this._extractTokenIdFromEvents(txHash);
        if (tokenId) {
            return tokenId;
        }

        console.log('❌ Could not extract token ID after', maxRetries, 'retries');
        return null;
    },

    // Fallback: Query TronGrid events API directly
    async _extractTokenIdFromEvents(txHash) {
        try {
            const network = window.getCurrentNetwork ? window.getCurrentNetwork() : { fullHost: 'https://api.trongrid.io' };
            const baseUrl = network.fullHost.replace('trongrid.io', 'trongrid.io');
            const contractAddress = this.address;

            // Query events for this transaction
            const eventsUrl = `${baseUrl}/v1/contracts/${contractAddress}/events?transaction_id=${txHash}`;
            console.log('  Querying events API:', eventsUrl);

            const response = await fetch(eventsUrl, {
                headers: {
                    'TRON-PRO-API-KEY': window.TRONGRID_API_KEY || ''
                }
            });

            if (!response.ok) {
                console.log('  Events API returned:', response.status);
                return null;
            }

            const data = await response.json();
            console.log('  Events API response:', data?.data?.length || 0, 'events');

            if (data && data.data && data.data.length > 0) {
                for (const event of data.data) {
                    // Look for Transfer event
                    if (event.event_name === 'Transfer' && event.result) {
                        const tokenId = event.result.tokenId || event.result['2'];
                        if (tokenId) {
                            console.log('✅ Extracted token ID from events API:', tokenId);
                            return parseInt(tokenId);
                        }
                    }
                }
            }

            return null;
        } catch (e) {
            console.log('  Events API fallback failed:', e.message);
            return null;
        }
    },

    // Extract token IDs from batch transaction
    async _extractBatchTokenIds(txHash, expectedCount, maxRetries = 5) {
        const tokenIds = [];

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await new Promise(r => setTimeout(r, 2000 * attempt));

                const txInfo = await window.tronWeb.trx.getTransactionInfo(txHash);

                if (txInfo && txInfo.log) {
                    for (const log of txInfo.log) {
                        if (log.topics && log.topics.length >= 4) {
                            const tokenIdHex = log.topics[3];
                            if (tokenIdHex) {
                                const tokenId = parseInt(tokenIdHex, 16);
                                if (!tokenIds.includes(tokenId)) {
                                    tokenIds.push(tokenId);
                                }
                            }
                        }
                    }

                    if (tokenIds.length >= expectedCount) {
                        console.log('Extracted', tokenIds.length, 'token IDs:', tokenIds);
                        return tokenIds;
                    }
                }

                if (attempt < maxRetries && tokenIds.length < expectedCount) {
                    console.log(`Found ${tokenIds.length}/${expectedCount} token IDs, retry ${attempt}...`);
                }
            } catch (e) {
                console.log(`Batch token extraction attempt ${attempt} failed:`, e.message);
            }
        }

        console.log('Extracted', tokenIds.length, 'of', expectedCount, 'expected token IDs');
        return tokenIds.length > 0 ? tokenIds : null;
    },

    // Estimate energy for transaction
    estimateEnergy(functionName) {
        const estimates = {
            serveNotice: 65000,
            serveNoticeBatch: 150000,
            setServer: 40000,
            setAdmin: 40000
        };
        return estimates[functionName] || 100000;
    },

    // Wait for transaction confirmation
    async waitForConfirmation(txId, maxAttempts = 30) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const tx = await this.tronWeb.trx.getTransactionInfo(txId);
                if (tx && tx.blockNumber) {
                    return tx;
                }
            } catch (error) {
                // Transaction not found yet
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        throw new Error('Transaction confirmation timeout');
    },

    // Send a small TRX transfer with memo to notify recipient
    // This shows up in TronLink's main transaction feed so they know they've been served
    async sendNotificationTransfer(recipientAddress, memo) {
        try {
            const from = this.tronWeb.defaultAddress.base58;
            // Build a 1 SUN (0.000001 TRX) transfer
            let tx = await this.tronWeb.transactionBuilder.sendTrx(recipientAddress, 1, from);
            // Attach the memo
            tx = await this.tronWeb.transactionBuilder.addUpdateData(tx, memo, 'utf8');
            const signedTx = await this.tronWeb.trx.sign(tx);
            const result = await this.tronWeb.trx.sendRawTransaction(signedTx);
            const txId = result.txid || result.transaction?.txID;
            console.log('Notification transfer sent:', txId);
            return { success: true, txId };
        } catch (error) {
            console.warn('Notification transfer failed:', error.message || error);
            return { success: false, error: error.message || String(error) };
        }
    }
};

console.log('Lite Contract module loaded');
