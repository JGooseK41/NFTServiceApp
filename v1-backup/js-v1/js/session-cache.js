// Session-based caching system for blockchain data
// Reduces API calls by caching verification status per session

class SessionCache {
    constructor() {
        this.cacheKey = 'blockchainCache';
        this.sessionKey = 'sessionId';
        this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
        this.initSession();
    }

    initSession() {
        // Check if we have an existing session
        const existingSession = sessionStorage.getItem(this.sessionKey);
        if (!existingSession) {
            // Create new session
            const sessionId = this.generateSessionId();
            sessionStorage.setItem(this.sessionKey, sessionId);
            sessionStorage.setItem('sessionStart', Date.now().toString());
            console.log('New session created:', sessionId);
        } else {
            console.log('Existing session:', existingSession);
        }
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Get cached data for current session
    getCachedData(key) {
        try {
            const cacheData = sessionStorage.getItem(this.cacheKey);
            if (!cacheData) return null;

            const cache = JSON.parse(cacheData);
            const item = cache[key];
            
            if (!item) return null;

            // Check if cache is expired
            if (Date.now() - item.timestamp > this.cacheExpiry) {
                console.log(`Cache expired for ${key}`);
                delete cache[key];
                sessionStorage.setItem(this.cacheKey, JSON.stringify(cache));
                return null;
            }

            console.log(`Cache hit for ${key}`);
            return item.data;
        } catch (e) {
            console.error('Error reading cache:', e);
            return null;
        }
    }

    // Set cached data for current session
    setCachedData(key, data) {
        try {
            let cache = {};
            const existingCache = sessionStorage.getItem(this.cacheKey);
            
            if (existingCache) {
                cache = JSON.parse(existingCache);
            }

            cache[key] = {
                data: data,
                timestamp: Date.now()
            };

            sessionStorage.setItem(this.cacheKey, JSON.stringify(cache));
            console.log(`Cache set for ${key}`);
        } catch (e) {
            console.error('Error setting cache:', e);
        }
    }

    // Check if blockchain verification happened this session
    hasVerifiedBlockchain(address) {
        const verificationKey = `blockchain_verified_${address}`;
        return this.getCachedData(verificationKey) === true;
    }

    // Mark blockchain as verified for this session
    setBlockchainVerified(address) {
        const verificationKey = `blockchain_verified_${address}`;
        this.setCachedData(verificationKey, true);
    }

    // Cache notice status from blockchain
    cacheNoticeStatus(noticeId, status) {
        const key = `notice_status_${noticeId}`;
        this.setCachedData(key, status);
    }

    // Get cached notice status
    getCachedNoticeStatus(noticeId) {
        const key = `notice_status_${noticeId}`;
        return this.getCachedData(key);
    }

    // Cache server stats
    cacheServerStats(address, stats) {
        const key = `server_stats_${address}`;
        this.setCachedData(key, stats);
    }

    // Get cached server stats
    getCachedServerStats(address) {
        const key = `server_stats_${address}`;
        return this.getCachedData(key);
    }

    // Clear all cache
    clearCache() {
        sessionStorage.removeItem(this.cacheKey);
        console.log('Cache cleared');
    }

    // Get session age in minutes
    getSessionAge() {
        const sessionStart = sessionStorage.getItem('sessionStart');
        if (!sessionStart) return 0;
        
        const age = Date.now() - parseInt(sessionStart);
        return Math.floor(age / 60000); // Convert to minutes
    }
}

// Initialize global cache instance
window.sessionCache = new SessionCache();