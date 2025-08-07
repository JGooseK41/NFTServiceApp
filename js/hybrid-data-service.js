// Hybrid Data Service - Combines backend and blockchain data
// Fetches from backend for speed, verifies with blockchain once per session

class HybridDataService {
    constructor() {
        // Defer reading backend URL until needed since it's set later
        this.verificationQueue = [];
        this.isVerifying = false;
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
        
        // Check if we've already verified blockchain this session
        const hasVerified = window.sessionCache.hasVerifiedBlockchain(serverAddress);
        console.log('Has verified this session:', hasVerified);
        
        // First, always try to get data from backend for speed
        let backendData = await this.fetchFromBackend(serverAddress);
        console.log('Backend data result:', backendData ? `${backendData.length} notices` : 'null/empty');
        
        // If no backend data or force blockchain, get from blockchain
        if (!backendData || backendData.length === 0 || forceBlockchain) {
            console.log('Falling back to blockchain fetch...');
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

    // Fetch from backend API
    async fetchFromBackend(serverAddress) {
        if (!this.backendUrl) {
            console.log('No backend URL configured');
            return null;
        }

        try {
            const url = `${this.backendUrl}/api/documents/server/${serverAddress}/notices`;
            console.log('Fetching from backend URL:', url);
            const response = await fetch(url);
            
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
            console.log('Backend data received:', data.length, 'notices');
            
            // Transform backend data to match our format
            return data.map(notice => ({
                noticeId: notice.id || notice.alertId,
                alertId: notice.alertId,
                documentId: notice.documentId,
                recipient: notice.recipient,
                timestamp: notice.timestamp || notice.served_at,
                caseNumber: notice.caseNumber || notice.case_number,
                noticeType: notice.noticeType || notice.notice_type,
                status: notice.status || 'pending',
                acknowledged: notice.acknowledged || false,
                isBackendData: true,
                lastVerified: null
            }));
        } catch (error) {
            console.error('Backend fetch error:', error);
            return null;
        }
    }

    // Fetch from blockchain (with caching)
    async fetchFromBlockchain(serverAddress) {
        // Check cache first
        const cachedStats = window.sessionCache.getCachedServerStats(serverAddress);
        if (cachedStats && cachedStats.notices) {
            console.log('Using cached blockchain data');
            return cachedStats.notices;
        }

        console.log('=== BLOCKCHAIN FETCH START ===');
        console.log('Fetching from blockchain for:', serverAddress);
        console.log('Contract available:', !!window.legalContract);
        console.log('TronWeb available:', !!window.tronWeb);
        const notices = [];
        
        try {
            // Direct contract query approach (avoids rate limiting)
            console.log('Checking first 20 alert IDs directly...');
            for (let i = 1; i <= 20; i++) {
                try {
                    const alertData = await window.legalContract.alertNotices(i).call();
                    console.log(`Alert ${i} raw data:`, alertData);
                    
                    if (alertData && alertData[1]) {
                        const alertServer = window.tronWeb.address.fromHex(alertData[1]);
                        console.log(`Alert ${i} server:`, alertServer, 'Looking for:', serverAddress);
                        
                        if (alertServer === serverAddress) {
                            console.log(`Alert ${i} belongs to this server!`);
                            const notice = this.parseAlertData(alertData, i);
                            notices.push(notice);
                            console.log(`Added notice:`, notice);
                            
                            // Cache individual notice status
                            window.sessionCache.cacheNoticeStatus(i, {
                                acknowledged: notice.acknowledged,
                                timestamp: notice.timestamp
                            });
                        }
                    }
                } catch (e) {
                    // No more notices, break
                    break;
                }
            }

            // Cache the results
            window.sessionCache.cacheServerStats(serverAddress, {
                notices: notices,
                totalServed: notices.length,
                timestamp: Date.now()
            });

            // Mark blockchain as verified for this session
            window.sessionCache.setBlockchainVerified(serverAddress);

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

        const stats = {
            totalServed: notices.length,
            acknowledged: notices.filter(n => n.acknowledged).length,
            pending: notices.filter(n => !n.acknowledged).length,
            source: data.source,
            verified: data.verified,
            timestamp: Date.now()
        };

        // Cache the stats
        window.sessionCache.cacheServerStats(serverAddress, stats);

        return stats;
    }
}

// Initialize global service instance
window.hybridDataService = new HybridDataService();