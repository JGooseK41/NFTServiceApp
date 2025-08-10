// Hybrid Data Service - Combines backend and blockchain data
// Fetches from backend for speed, verifies with blockchain once per session

class HybridDataService {
    constructor() {
        // Defer reading backend URL until needed since it's set later
        this.verificationQueue = [];
        this.isVerifying = false;
        this.pendingRequests = new Map(); // Prevent duplicate concurrent requests
        this.requestTimeout = 10000; // 10 second timeout for requests
    }
    
    // Getter for backend URL that reads it when needed
    get backendUrl() {
        return window.BACKEND_API_URL || '';
    }

    // Fetch notices with hybrid approach
    async fetchNoticesHybrid(serverAddress, forceBlockchain = false) {
        console.log('=== HYBRID FETCH START ===');
        console.log('Server address:', serverAddress);
        console.log('Force blockchain:', forceBlockchain);
        console.log('Backend URL configured:', this.backendUrl);
        
        // If forcing blockchain, skip backend entirely
        if (forceBlockchain) {
            console.log('Force blockchain enabled, skipping backend');
            const blockchainData = await this.fetchFromBlockchain(serverAddress);
            console.log('Blockchain data result:', blockchainData ? `${blockchainData.length} notices` : 'null/empty');
            return {
                notices: blockchainData,
                source: 'blockchain',
                verified: true
            };
        }
        
        // Check if we've already verified blockchain this session
        const hasVerified = window.sessionCache.hasVerifiedBlockchain(serverAddress);
        console.log('Has verified this session:', hasVerified);
        
        // First, always try to get data from backend for speed
        let backendData = await this.fetchFromBackend(serverAddress);
        console.log('Backend data result:', backendData ? `${backendData.length} notices` : 'null/empty');
        
        // If no backend data, get from blockchain
        if (!backendData || backendData.length === 0) {
            console.log('No backend data, falling back to blockchain fetch...');
            const blockchainData = await this.fetchFromBlockchain(serverAddress);
            console.log('Blockchain data result:', blockchainData ? `${blockchainData.length} notices` : 'null/empty');
            return {
                notices: blockchainData,
                source: 'blockchain',
                verified: true
            };
        }
        
        // If we haven't verified this session, queue verification
        if (!hasVerified && !forceBlockchain) {
            this.queueBlockchainVerification(serverAddress, backendData);
        }
        
        // Return backend data immediately for fast display
        return {
            notices: backendData,
            source: 'backend',
            verified: hasVerified
        };
    }

    // Fetch from backend API with deduplication
    async fetchFromBackend(serverAddress) {
        if (!this.backendUrl) {
            console.log('No backend URL configured');
            return null;
        }
        
        // Check if we already have a pending request for this address
        const requestKey = `backend-${serverAddress}`;
        if (this.pendingRequests.has(requestKey)) {
            console.log('Reusing pending backend request for:', serverAddress);
            return this.pendingRequests.get(requestKey);
        }

        // Create new request promise
        const requestPromise = this.doBackendFetch(serverAddress);
        this.pendingRequests.set(requestKey, requestPromise);
        
        try {
            const result = await requestPromise;
            return result;
        } finally {
            // Clean up pending request
            this.pendingRequests.delete(requestKey);
        }
    }
    
    async doBackendFetch(serverAddress) {
        try {
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
            // Use the simple-cases endpoint for grouped cases
            const url = `${this.backendUrl}/api/servers/${serverAddress}/simple-cases`;
            console.log('Fetching from backend URL:', url);
            
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                console.log('Backend fetch failed - Status:', response.status, 'StatusText:', response.statusText);
                // Try to get error details
                try {
                    const errorText = await response.text();
                    console.log('Backend error response:', errorText);
                } catch (e) {}
                return null;
            }

            const data = await response.json();
            console.log('=== BACKEND DATA RECEIVED ===');
            console.log('Full response:', JSON.stringify(data, null, 2));
            
            // Handle the response structure from simple-cases endpoint
            const cases = data.cases || [];
            
            if (!Array.isArray(cases)) {
                console.log('Backend response is not an array, returning empty array');
                return [];
            }
            
            console.log('Processing', cases.length, 'cases from backend');
            
            // Transform cases into individual notices for compatibility
            // But track that they are paired for counting
            const notices = [];
            
            cases.forEach(caseData => {
                // Each case can have multiple recipients
                if (caseData.recipients && caseData.recipients.length > 0) {
                    caseData.recipients.forEach(recipient => {
                        // For paired Alert+Document, create a single notice entry
                        if (recipient.alertId && recipient.documentId) {
                            notices.push({
                                noticeId: `${caseData.caseNumber}_paired`,
                                alertId: String(recipient.alertId || ''),
                                documentId: String(recipient.documentId || ''),
                                recipient: String(recipient.recipientAddress || ''),
                                timestamp: new Date(caseData.createdAt).getTime(),
                                caseNumber: String(caseData.caseNumber || 'Unknown'),
                                noticeType: String(caseData.noticeType || 'Legal Notice'),
                                status: recipient.documentStatus === 'SIGNED' ? 'acknowledged' : 'pending',
                                acknowledged: recipient.documentStatus === 'SIGNED',
                                isPaired: true, // Mark as paired for counting
                                isBackendData: true,
                                lastVerified: null
                            });
                        } else {
                            // Single notice (not paired)
                            notices.push({
                                noticeId: recipient.alertId || recipient.documentId || `${caseData.caseNumber}_single`,
                                alertId: String(recipient.alertId || ''),
                                documentId: String(recipient.documentId || ''),
                                recipient: String(recipient.recipientAddress || ''),
                                timestamp: new Date(caseData.createdAt).getTime(),
                                caseNumber: String(caseData.caseNumber || 'Unknown'),
                                noticeType: String(caseData.noticeType || 'Legal Notice'),
                                status: recipient.documentStatus === 'SIGNED' ? 'acknowledged' : 'pending',
                                acknowledged: recipient.documentStatus === 'SIGNED',
                                isPaired: false,
                                isBackendData: true,
                                lastVerified: null
                            });
                        }
                    });
                }
            });
            
            console.log('Converted to', notices.length, 'service events (paired notices count as 1)');
            return notices;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('Backend fetch timeout after', this.requestTimeout, 'ms');
            } else {
                console.error('Backend fetch error:', error);
            }
            return null;
        }
    }

    // Fetch from blockchain (with caching and deduplication)
    async fetchFromBlockchain(serverAddress) {
        // Check cache first
        const cachedStats = window.sessionCache?.getCachedServerStats(serverAddress);
        if (cachedStats && cachedStats.notices) {
            console.log('Using cached blockchain data');
            return cachedStats.notices;
        }
        
        // Check for pending blockchain request
        const requestKey = `blockchain-${serverAddress}`;
        if (this.pendingRequests.has(requestKey)) {
            console.log('Reusing pending blockchain request for:', serverAddress);
            return this.pendingRequests.get(requestKey);
        }
        
        // Create new request
        const requestPromise = this.doBlockchainFetch(serverAddress);
        this.pendingRequests.set(requestKey, requestPromise);
        
        try {
            const result = await requestPromise;
            return result;
        } finally {
            this.pendingRequests.delete(requestKey);
        }
    }
    
    async doBlockchainFetch(serverAddress) {

        console.log('=== BLOCKCHAIN FETCH START ===');
        console.log('Fetching from blockchain for:', serverAddress);
        console.log('Contract available:', !!window.legalContract);
        console.log('TronWeb available:', !!window.tronWeb);
        const notices = [];
        
        try {
            // Direct contract query approach with batching to reduce calls
            console.log('Checking first 20 alert IDs...');
            const batchSize = 3; // Reduced batch size to avoid rate limiting
            const batches = [];
            const delayBetweenBatches = 1000; // 1 second delay between batches
            
            for (let i = 1; i <= 20; i += batchSize) {
                const batch = [];
                for (let j = i; j < Math.min(i + batchSize, 21); j++) {
                    batch.push(j);
                }
                batches.push(batch);
            }
            
            // Process batches sequentially with delays to avoid rate limiting
            for (const batch of batches) {
                const batchPromises = batch.map(async (i) => {
                    try {
                        const alertData = await window.legalContract.alertNotices(i).call();
                        
                        if (alertData && alertData[1]) {
                            const alertServer = window.tronWeb.address.fromHex(alertData[1]);
                            
                            if (alertServer === serverAddress) {
                                const notice = this.parseAlertData(alertData, i);
                                
                                // Cache individual notice status
                                if (window.sessionCache) {
                                    window.sessionCache.cacheNoticeStatus(i, {
                                        acknowledged: notice.acknowledged,
                                        timestamp: notice.timestamp
                                    });
                                }
                                
                                return notice;
                            }
                        }
                    } catch (e) {
                        // Alert doesn't exist
                        return null;
                    }
                });
                
                const batchResults = await Promise.all(batchPromises);
                const validNotices = batchResults.filter(n => n !== null);
                notices.push(...validNotices);
                
                // Add delay between batches to avoid rate limiting
                if (batches.indexOf(batch) < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
                }
                
                // If we got fewer results than batch size, we've reached the end
                if (validNotices.length < batch.length) {
                    break;
                }
            }

            // Cache the results
            if (window.sessionCache) {
                window.sessionCache.cacheServerStats(serverAddress, {
                notices: notices,
                totalServed: notices.length,
                timestamp: Date.now()
            });
            }

            // Mark blockchain as verified for this session
            if (window.sessionCache) {
                window.sessionCache.setBlockchainVerified(serverAddress);
            }

            console.log('Blockchain data fetched:', notices.length, 'notices');
            return notices;

        } catch (error) {
            console.error('Blockchain fetch error:', error);
            return [];
        }
    }

    // Parse alert data from contract
    parseAlertData(alertData, alertId) {
        return {
            noticeId: alertId.toString(),
            alertId: alertId.toString(),
            documentId: alertData[2] ? alertData[2].toString() : '',
            recipient: window.tronWeb.address.fromHex(alertData[0]),
            timestamp: Number(alertData[3]) * 1000,
            acknowledged: alertData[4] || false,
            noticeType: alertData[6] || 'Legal Notice',
            caseNumber: alertData[7] || 'Unknown',
            status: alertData[4] ? 'acknowledged' : 'pending',
            isBlockchainData: true,
            lastVerified: Date.now()
        };
    }

    // Queue blockchain verification in background
    queueBlockchainVerification(serverAddress, backendNotices) {
        console.log('Queueing blockchain verification in background...');
        
        // Add to queue
        this.verificationQueue.push({
            serverAddress,
            backendNotices,
            timestamp: Date.now()
        });

        // Process queue if not already processing
        if (!this.isVerifying) {
            this.processVerificationQueue();
        }
    }

    // Process verification queue in background
    async processVerificationQueue() {
        if (this.verificationQueue.length === 0) {
            this.isVerifying = false;
            return;
        }

        this.isVerifying = true;
        const item = this.verificationQueue.shift();
        
        console.log('Processing background verification for:', item.serverAddress);
        
        try {
            // Fetch blockchain data
            const blockchainNotices = await this.fetchFromBlockchain(item.serverAddress);
            
            // Compare and update UI if needed
            this.reconcileData(item.backendNotices, blockchainNotices);
            
            // Dispatch event to update UI
            window.dispatchEvent(new CustomEvent('blockchainVerified', {
                detail: {
                    serverAddress: item.serverAddress,
                    notices: blockchainNotices
                }
            }));
            
        } catch (error) {
            console.error('Verification error:', error);
        }

        // Continue processing queue
        setTimeout(() => this.processVerificationQueue(), 2000);
    }

    // Reconcile backend and blockchain data
    reconcileData(backendNotices, blockchainNotices) {
        console.log('Reconciling data - Backend:', backendNotices.length, 'Blockchain:', blockchainNotices.length);
        
        // Create a map of blockchain notices by ID
        const blockchainMap = new Map();
        blockchainNotices.forEach(notice => {
            blockchainMap.set(notice.noticeId, notice);
        });

        // Check each backend notice against blockchain
        backendNotices.forEach(backendNotice => {
            const blockchainNotice = blockchainMap.get(backendNotice.noticeId);
            
            if (blockchainNotice) {
                // Update status if different
                if (backendNotice.acknowledged !== blockchainNotice.acknowledged) {
                    console.log(`Notice ${backendNotice.noticeId} status mismatch - Backend: ${backendNotice.acknowledged}, Blockchain: ${blockchainNotice.acknowledged}`);
                    backendNotice.acknowledged = blockchainNotice.acknowledged;
                    backendNotice.status = blockchainNotice.status;
                    backendNotice.verified = true;
                }
            } else {
                console.log(`Notice ${backendNotice.noticeId} not found on blockchain`);
                backendNotice.verified = false;
            }
        });

        return backendNotices;
    }

    // Get server stats with caching
    async getServerStats(serverAddress, forceRefresh = false) {
        // Check cache first
        if (!forceRefresh) {
            const cached = window.sessionCache.getCachedServerStats(serverAddress);
            if (cached) {
                console.log('Using cached server stats');
                return cached;
            }
        }

        // Fetch fresh data
        const data = await this.fetchNoticesHybrid(serverAddress, forceRefresh);
        const notices = data.notices;

        // Group notices by case or pair Alert+Document as single service events
        // Notices with isPaired flag are counted as single service events
        const serviceEvents = new Map();
        
        for (const notice of notices) {
            // If this notice has a case number, group by case
            if (notice.caseNumber) {
                if (!serviceEvents.has(notice.caseNumber)) {
                    serviceEvents.set(notice.caseNumber, {
                        caseNumber: notice.caseNumber,
                        acknowledged: notice.acknowledged || false,
                        notices: []
                    });
                }
                serviceEvents.get(notice.caseNumber).notices.push(notice);
                // Case is acknowledged if any notice in it is acknowledged
                if (notice.acknowledged) {
                    serviceEvents.get(notice.caseNumber).acknowledged = true;
                }
            } else if (notice.isPaired || (notice.alertId && notice.documentId)) {
                // This is a paired Alert+Document, count as one service event
                const eventKey = `paired_${notice.alertId || notice.noticeId}`;
                if (!serviceEvents.has(eventKey)) {
                    serviceEvents.set(eventKey, {
                        acknowledged: notice.acknowledged || false,
                        notices: [notice]
                    });
                }
            } else {
                // Standalone notice, count individually
                const eventKey = `notice_${notice.id || notice.noticeId}`;
                serviceEvents.set(eventKey, {
                    acknowledged: notice.acknowledged || false,
                    notices: [notice]
                });
            }
        }

        // Count service events instead of individual notices
        const totalServiceEvents = serviceEvents.size;
        const acknowledgedEvents = Array.from(serviceEvents.values()).filter(e => e.acknowledged).length;
        const pendingEvents = totalServiceEvents - acknowledgedEvents;

        const stats = {
            totalServed: totalServiceEvents,  // Count service events, not individual notices
            acknowledged: acknowledgedEvents,
            pending: pendingEvents,
            source: data.source,
            verified: data.verified,
            timestamp: Date.now(),
            // Also include raw notice count for reference
            totalNotices: notices.length
        };

        // Cache the stats
        window.sessionCache.cacheServerStats(serverAddress, stats);

        return stats;
    }
}

// Initialize global service instance
window.hybridDataService = new HybridDataService();