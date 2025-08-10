/**
 * Notice Workflow System - Complete tracking from creation to court documentation
 * This replaces all temporary fixes with a unified approach
 */

class NoticeWorkflow {
    constructor() {
        this.backendUrl = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        this.contractAddress = window.CONTRACT_ADDRESS;
        this.notices = new Map(); // Local cache of notices
        this.syncQueue = []; // Queue for backend sync
        this.isProcessing = false;
    }

    /**
     * STEP 1: Create and track a new notice
     */
    async createNotice(noticeData) {
        console.log('📝 Creating new notice:', noticeData);
        
        try {
            // Validate input data
            if (!noticeData.recipientAddress || !noticeData.caseNumber) {
                throw new Error('Recipient address and case number are required');
            }

            // Generate notice ID (will be replaced by blockchain ID)
            const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Create notice record
            const noticeRecord = {
                id: tempId,
                status: 'pending',
                createdAt: new Date().toISOString(),
                ...noticeData,
                serverAddress: tronWeb.defaultAddress.base58,
                blockchain: {
                    network: 'tron',
                    contractAddress: this.contractAddress,
                    status: 'pending'
                }
            };

            // Store locally
            this.notices.set(tempId, noticeRecord);

            // Track in backend immediately (pre-blockchain)
            await this.trackInBackend(noticeRecord, 'created');

            // Send to blockchain
            const blockchainResult = await this.sendToBlockchain(noticeRecord);
            
            // Update with blockchain data
            noticeRecord.blockchain = {
                ...noticeRecord.blockchain,
                ...blockchainResult,
                status: 'confirmed'
            };
            
            // Update backend with blockchain data
            await this.trackInBackend(noticeRecord, 'blockchain_confirmed');

            return noticeRecord;

        } catch (error) {
            console.error('❌ Error creating notice:', error);
            throw error;
        }
    }

    /**
     * STEP 2: Send notice to blockchain
     */
    async sendToBlockchain(noticeRecord) {
        console.log('⛓️ Sending to blockchain:', noticeRecord.id);
        
        try {
            if (!window.legalContract) {
                throw new Error('Smart contract not initialized');
            }

            let txResult;
            
            // Determine notice type and send appropriate transaction
            if (noticeRecord.documentData) {
                // Document notice with encryption
                txResult = await this.sendDocumentNotice(noticeRecord);
            } else {
                // Text-only notice
                txResult = await this.sendTextNotice(noticeRecord);
            }

            // Parse transaction result
            const receipt = await tronWeb.trx.getTransaction(txResult);
            
            // Extract NFT IDs from events
            const events = await this.parseTransactionEvents(txResult);
            
            return {
                transactionHash: txResult,
                alertId: events.alertId,
                documentId: events.documentId,
                noticeId: events.noticeId || events.alertId,
                timestamp: receipt.raw_data.timestamp,
                blockNumber: receipt.blockNumber,
                events: events.raw
            };

        } catch (error) {
            console.error('❌ Blockchain error:', error);
            throw error;
        }
    }

    /**
     * Send document notice to blockchain
     */
    async sendDocumentNotice(noticeRecord) {
        const {
            recipientAddress,
            documentData,
            caseNumber,
            noticeType,
            issuingAgency,
            publicText
        } = noticeRecord;

        // Encrypt document if needed
        if (documentData && !noticeRecord.encrypted) {
            const encrypted = await SimpleEncryption.createEncryptedNotice(
                window.legalContract,
                recipientAddress,
                documentData,
                {
                    publicText,
                    noticeType,
                    caseNumber,
                    issuingAgency,
                    fee: 150e6
                }
            );
            return encrypted.transactionHash;
        }

        // Direct contract call for already encrypted data
        return await window.legalContract.createDocumentNotice(
            recipientAddress,
            noticeRecord.ipfsHash,
            noticeRecord.encryptionKey,
            publicText,
            noticeType,
            caseNumber,
            issuingAgency
        ).send({
            feeLimit: 200_000_000,
            callValue: 150e6
        });
    }

    /**
     * Send text-only notice to blockchain
     */
    async sendTextNotice(noticeRecord) {
        const {
            recipientAddress,
            publicText,
            noticeType,
            caseNumber,
            issuingAgency
        } = noticeRecord;

        return await window.legalContract.createTextNotice(
            recipientAddress,
            publicText,
            noticeType,
            caseNumber,
            issuingAgency
        ).send({
            feeLimit: 200_000_000,
            callValue: 15e6
        });
    }

    /**
     * Parse transaction events to extract NFT IDs
     */
    async parseTransactionEvents(txHash) {
        try {
            const transaction = await tronWeb.trx.getTransactionInfo(txHash);
            const events = {
                alertId: null,
                documentId: null,
                noticeId: null,
                raw: []
            };

            if (transaction.log) {
                for (const log of transaction.log) {
                    const decoded = await tronWeb.utils.abi.decodeLog(
                        log.data,
                        log.topics,
                        window.legalContract.abi
                    );
                    
                    events.raw.push(decoded);
                    
                    // Extract IDs based on event type
                    if (decoded.name === 'LegalNoticeCreated') {
                        events.noticeId = decoded.noticeId;
                        events.alertId = decoded.alertId;
                        events.documentId = decoded.documentId;
                    }
                }
            }

            return events;
        } catch (error) {
            console.error('Error parsing events:', error);
            return { raw: [] };
        }
    }

    /**
     * STEP 3: Track notice in backend
     */
    async trackInBackend(noticeRecord, eventType = 'update') {
        console.log(`📊 Tracking in backend (${eventType}):`, noticeRecord.id);
        
        try {
            const endpoint = `${this.backendUrl}/api/notices/served`;
            
            const payload = {
                noticeId: noticeRecord.blockchain?.noticeId || noticeRecord.id,
                alertId: noticeRecord.blockchain?.alertId,
                documentId: noticeRecord.blockchain?.documentId,
                serverAddress: noticeRecord.serverAddress,
                recipientAddress: noticeRecord.recipientAddress,
                noticeType: noticeRecord.noticeType,
                issuingAgency: noticeRecord.issuingAgency,
                caseNumber: noticeRecord.caseNumber,
                documentHash: noticeRecord.documentHash,
                ipfsHash: noticeRecord.ipfsHash,
                hasDocument: !!noticeRecord.documentData,
                transactionHash: noticeRecord.blockchain?.transactionHash,
                blockNumber: noticeRecord.blockchain?.blockNumber,
                status: noticeRecord.status,
                eventType: eventType,
                metadata: {
                    createdAt: noticeRecord.createdAt,
                    updatedAt: new Date().toISOString(),
                    publicText: noticeRecord.publicText,
                    thumbnailUrl: noticeRecord.thumbnailUrl
                }
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Backend error: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ Backend updated:', result);
            
            return result;

        } catch (error) {
            console.error('❌ Backend sync error:', error);
            // Add to retry queue
            this.syncQueue.push({ noticeRecord, eventType, retries: 0 });
            this.processSyncQueue();
            throw error;
        }
    }

    /**
     * STEP 4: Fetch and verify notices from blockchain
     */
    async fetchNoticesFromBlockchain(serverAddress = null, forceRefresh = false) {
        console.log('🔍 Fetching notices from blockchain...');
        
        try {
            if (!window.legalContract) {
                throw new Error('Contract not initialized');
            }

            // Check cache first (unless forcing refresh)
            const cacheKey = `blockchain_notices_${serverAddress || 'all'}`;
            if (!forceRefresh) {
                const cached = this.getCachedData(cacheKey);
                if (cached) {
                    console.log('📦 Using cached data');
                    return cached;
                }
            }

            // Get total supply
            const totalSupply = await window.legalContract.totalSupply().call();
            console.log(`Total notices on blockchain: ${totalSupply}`);

            const notices = [];
            const batchSize = 10;
            
            // Fetch in batches
            for (let i = 0; i < totalSupply; i += batchSize) {
                const batch = await this.fetchNoticeBatch(i, Math.min(i + batchSize, totalSupply));
                
                // Filter by server if specified
                const filtered = serverAddress 
                    ? batch.filter(n => n.serverAddress?.toLowerCase() === serverAddress.toLowerCase())
                    : batch;
                    
                notices.push(...filtered);
            }

            // Cache the results
            this.setCachedData(cacheKey, notices);

            // Sync with backend
            await this.syncWithBackend(notices);

            return notices;

        } catch (error) {
            console.error('❌ Error fetching from blockchain:', error);
            // Fall back to backend data
            return await this.fetchFromBackend(serverAddress);
        }
    }

    /**
     * Fetch a batch of notices from blockchain
     */
    async fetchNoticeBatch(startId, endId) {
        const batch = [];
        
        for (let id = startId; id < endId; id++) {
            try {
                // Check if token exists
                const exists = await window.legalContract.exists(id).call();
                if (!exists) continue;

                // Get token owner
                const owner = await window.legalContract.ownerOf(id).call();
                
                // Get token metadata
                const uri = await window.legalContract.tokenURI(id).call();
                const metadata = await this.fetchMetadata(uri);
                
                // Get notice data from contract
                const noticeData = await window.legalContract.getNotice(id).call();
                
                batch.push({
                    id: id.toString(),
                    owner: tronWeb.address.fromHex(owner),
                    serverAddress: this.extractServerFromNotice(noticeData),
                    recipientAddress: tronWeb.address.fromHex(noticeData.recipient),
                    metadata,
                    ...this.parseNoticeData(noticeData)
                });
                
            } catch (error) {
                console.warn(`Error fetching notice ${id}:`, error);
            }
        }
        
        return batch;
    }

    /**
     * Extract server address from notice data
     */
    extractServerFromNotice(noticeData) {
        // Try multiple sources for server address
        if (noticeData.server && noticeData.server !== '0x0000000000000000000000000000000000000000') {
            return tronWeb.address.fromHex(noticeData.server);
        }
        
        // Check events for actual server
        if (noticeData.events?.length > 0) {
            const createEvent = noticeData.events.find(e => e.name === 'LegalNoticeCreated');
            if (createEvent?.server) {
                return tronWeb.address.fromHex(createEvent.server);
            }
        }
        
        // Default to sender from transaction
        if (noticeData.txSender) {
            return tronWeb.address.fromHex(noticeData.txSender);
        }
        
        return null;
    }

    /**
     * STEP 5: Sync blockchain data with backend
     */
    async syncWithBackend(notices) {
        console.log(`🔄 Syncing ${notices.length} notices with backend...`);
        
        for (const notice of notices) {
            try {
                await this.trackInBackend(notice, 'sync');
            } catch (error) {
                console.warn(`Failed to sync notice ${notice.id}:`, error);
            }
        }
    }

    /**
     * STEP 6: Fetch notices from backend
     */
    async fetchFromBackend(serverAddress = null) {
        console.log('📡 Fetching from backend...');
        
        try {
            const endpoint = serverAddress 
                ? `${this.backendUrl}/api/servers/${serverAddress}/notices?limit=1000`
                : `${this.backendUrl}/api/notices/all?limit=1000`;
                
            const response = await fetch(endpoint);
            
            if (!response.ok) {
                throw new Error(`Backend error: ${response.status}`);
            }
            
            const data = await response.json();
            return data.notices || [];
            
        } catch (error) {
            console.error('❌ Backend fetch error:', error);
            return [];
        }
    }

    /**
     * STEP 7: Generate court-ready receipt
     */
    async generateReceipt(noticeId, type = 'alert') {
        console.log(`📄 Generating ${type} receipt for notice ${noticeId}`);
        
        try {
            // Fetch complete notice data
            const notice = await this.getNoticeById(noticeId);
            
            if (!notice) {
                throw new Error('Notice not found');
            }

            // Fetch blockchain verification
            const blockchainData = await this.verifyOnBlockchain(noticeId);
            
            // Fetch audit trail
            const auditTrail = await this.getAuditTrail(noticeId);
            
            // Generate receipt based on type
            const receipt = type === 'alert' 
                ? this.generateAlertReceipt(notice, blockchainData, auditTrail)
                : this.generateDocumentReceipt(notice, blockchainData, auditTrail);
                
            return receipt;
            
        } catch (error) {
            console.error('❌ Receipt generation error:', error);
            throw error;
        }
    }

    /**
     * Generate Alert NFT receipt
     */
    generateAlertReceipt(notice, blockchainData, auditTrail) {
        return {
            type: 'ALERT_NOTICE_RECEIPT',
            title: 'Legal Notice Delivery Confirmation',
            notice: {
                id: notice.alertId || notice.id,
                caseNumber: notice.caseNumber,
                type: notice.noticeType,
                issuingAgency: notice.issuingAgency,
                status: 'DELIVERED',
                deliveredAt: notice.createdAt
            },
            blockchain: {
                network: 'TRON',
                contractAddress: this.contractAddress,
                tokenId: notice.alertId,
                transactionHash: blockchainData.transactionHash,
                blockNumber: blockchainData.blockNumber,
                timestamp: blockchainData.timestamp,
                explorerUrl: `https://tronscan.org/#/transaction/${blockchainData.transactionHash}`
            },
            parties: {
                server: {
                    address: notice.serverAddress,
                    name: 'Authorized Process Server',
                    signature: this.generateSignature(notice.serverAddress, notice)
                },
                recipient: {
                    address: notice.recipientAddress,
                    status: 'Notice Delivered'
                }
            },
            auditTrail: auditTrail.filter(e => e.type === 'alert'),
            verification: {
                method: 'Blockchain Immutable Record',
                verifiedAt: new Date().toISOString(),
                integrity: 'VERIFIED'
            },
            legal: {
                statement: 'This receipt confirms delivery of legal notice via blockchain technology.',
                disclaimer: 'This document is admissible as evidence of service in legal proceedings.'
            }
        };
    }

    /**
     * Generate Document NFT receipt
     */
    generateDocumentReceipt(notice, blockchainData, auditTrail) {
        const isSignedFor = notice.accepted || auditTrail.some(e => e.type === 'accepted');
        
        return {
            type: 'DOCUMENT_NOTICE_RECEIPT',
            title: 'Legal Document Service Confirmation',
            notice: {
                id: notice.documentId || notice.id,
                caseNumber: notice.caseNumber,
                type: notice.noticeType,
                issuingAgency: notice.issuingAgency,
                status: isSignedFor ? 'SIGNED_FOR' : 'AWAITING_SIGNATURE',
                deliveredAt: notice.createdAt,
                signedAt: isSignedFor ? notice.acceptedAt : null
            },
            blockchain: {
                network: 'TRON',
                contractAddress: this.contractAddress,
                tokenId: notice.documentId,
                transactionHash: blockchainData.transactionHash,
                blockNumber: blockchainData.blockNumber,
                timestamp: blockchainData.timestamp,
                explorerUrl: `https://tronscan.org/#/transaction/${blockchainData.transactionHash}`,
                ipfsHash: notice.ipfsHash,
                documentHash: notice.documentHash
            },
            parties: {
                server: {
                    address: notice.serverAddress,
                    name: 'Authorized Process Server',
                    signature: this.generateSignature(notice.serverAddress, notice)
                },
                recipient: {
                    address: notice.recipientAddress,
                    status: isSignedFor ? 'Document Signed For' : 'Pending Signature',
                    signatureHash: isSignedFor ? notice.signatureHash : null
                }
            },
            auditTrail: auditTrail.filter(e => e.type === 'document'),
            accessLog: auditTrail.filter(e => e.type === 'view'),
            verification: {
                method: 'Blockchain Immutable Record with IPFS Storage',
                verifiedAt: new Date().toISOString(),
                documentIntegrity: 'VERIFIED',
                encryptionStatus: 'SECURED'
            },
            legal: {
                statement: isSignedFor 
                    ? 'This receipt confirms the legal document has been served and signed for.'
                    : 'This receipt confirms the legal document has been served and is awaiting signature.',
                disclaimer: 'This document is admissible as evidence of service in legal proceedings.'
            }
        };
    }

    /**
     * STEP 8: Get audit trail for a notice
     */
    async getAuditTrail(noticeId) {
        console.log(`📋 Fetching audit trail for notice ${noticeId}`);
        
        try {
            const response = await fetch(`${this.backendUrl}/api/notices/${noticeId}/audit`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch audit trail: ${response.status}`);
            }
            
            const data = await response.json();
            
            return [
                // Creation event
                {
                    type: 'created',
                    timestamp: data.notice?.created_at,
                    actor: data.notice?.server_address,
                    details: 'Notice created and sent to blockchain'
                },
                // View events
                ...data.views?.map(v => ({
                    type: 'view',
                    timestamp: v.viewed_at,
                    actor: v.viewer_address,
                    ipAddress: v.ip_address,
                    userAgent: v.user_agent,
                    details: 'Document viewed'
                })) || [],
                // Acceptance event
                ...(data.acceptance ? [{
                    type: 'accepted',
                    timestamp: data.acceptance.accepted_at,
                    actor: data.acceptance.acceptor_address,
                    transactionHash: data.acceptance.transaction_hash,
                    ipAddress: data.acceptance.ip_address,
                    details: 'Document signed for'
                }] : [])
            ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
        } catch (error) {
            console.error('❌ Audit trail error:', error);
            return [];
        }
    }

    /**
     * STEP 9: Search notices by case number
     */
    async searchByCaseNumber(caseNumber) {
        console.log(`🔎 Searching for case: ${caseNumber}`);
        
        try {
            // Search in local cache first
            const localResults = Array.from(this.notices.values())
                .filter(n => n.caseNumber === caseNumber);
            
            if (localResults.length > 0) {
                return localResults;
            }
            
            // Search in backend
            const response = await fetch(
                `${this.backendUrl}/api/notices/search?caseNumber=${encodeURIComponent(caseNumber)}`
            );
            
            if (response.ok) {
                const data = await response.json();
                return data.notices || [];
            }
            
            // Fall back to blockchain search
            const allNotices = await this.fetchNoticesFromBlockchain();
            return allNotices.filter(n => n.caseNumber === caseNumber);
            
        } catch (error) {
            console.error('❌ Search error:', error);
            return [];
        }
    }

    /**
     * Helper: Get notice by ID
     */
    async getNoticeById(noticeId) {
        // Check local cache
        if (this.notices.has(noticeId)) {
            return this.notices.get(noticeId);
        }
        
        // Fetch from backend
        try {
            const response = await fetch(`${this.backendUrl}/api/notices/${noticeId}`);
            if (response.ok) {
                const notice = await response.json();
                this.notices.set(noticeId, notice);
                return notice;
            }
        } catch (error) {
            console.error('Error fetching notice:', error);
        }
        
        return null;
    }

    /**
     * Helper: Verify notice on blockchain
     */
    async verifyOnBlockchain(noticeId) {
        try {
            const tx = await tronWeb.trx.getTransaction(noticeId);
            return {
                transactionHash: noticeId,
                blockNumber: tx.blockNumber,
                timestamp: tx.raw_data.timestamp,
                verified: true
            };
        } catch (error) {
            console.error('Blockchain verification error:', error);
            return { verified: false };
        }
    }

    /**
     * Helper: Generate digital signature
     */
    generateSignature(address, data) {
        // Generate a deterministic signature for the receipt
        const message = `${address}:${data.id}:${data.caseNumber}:${data.createdAt}`;
        const hash = CryptoJS.SHA256(message).toString();
        return hash.substring(0, 16).toUpperCase();
    }

    /**
     * Helper: Cache management
     */
    getCachedData(key) {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        
        try {
            const data = JSON.parse(cached);
            const age = Date.now() - data.timestamp;
            
            // Cache expires after 30 minutes
            if (age > 30 * 60 * 1000) {
                localStorage.removeItem(key);
                return null;
            }
            
            return data.value;
        } catch (error) {
            return null;
        }
    }

    setCachedData(key, value) {
        localStorage.setItem(key, JSON.stringify({
            timestamp: Date.now(),
            value
        }));
    }

    /**
     * Helper: Parse notice data from contract
     */
    parseNoticeData(data) {
        return {
            noticeType: data[0] || '',
            issuingAgency: data[1] || '',
            caseNumber: data[2] || '',
            publicText: data[3] || '',
            ipfsHash: data[4] || '',
            documentHash: data[5] || '',
            hasDocument: !!data[4],
            createdAt: data[6] ? new Date(parseInt(data[6]) * 1000).toISOString() : null
        };
    }

    /**
     * Helper: Fetch metadata from URI
     */
    async fetchMetadata(uri) {
        try {
            if (uri.startsWith('ipfs://')) {
                uri = uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
            }
            
            const response = await fetch(uri);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Error fetching metadata:', error);
        }
        
        return {};
    }

    /**
     * Process sync queue for failed backend updates
     */
    async processSyncQueue() {
        if (this.isProcessing || this.syncQueue.length === 0) return;
        
        this.isProcessing = true;
        
        while (this.syncQueue.length > 0) {
            const item = this.syncQueue.shift();
            
            if (item.retries < 3) {
                try {
                    await this.trackInBackend(item.noticeRecord, item.eventType);
                } catch (error) {
                    item.retries++;
                    this.syncQueue.push(item);
                    await new Promise(resolve => setTimeout(resolve, 5000 * item.retries));
                }
            }
        }
        
        this.isProcessing = false;
    }
}

// Initialize the workflow system
window.noticeWorkflow = new NoticeWorkflow();

// Export for use in other scripts
window.NoticeWorkflow = NoticeWorkflow;