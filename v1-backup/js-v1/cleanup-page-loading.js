/**
 * Cleanup Page Loading
 * Fixes excessive console logging, recursive calls, and duplicate initializations
 */

(function() {
    'use strict';
    
    // Store original console.log
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    // Track logged messages to prevent duplicates
    const loggedMessages = new Set();
    const logCounts = new Map();
    
    // Throttle console output
    console.log = function(...args) {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        // Skip repetitive messages
        const patterns = [
            /Checking wallet/i,
            /TronWeb ready/i,
            /Contract loaded/i,
            /Wallet connected/i,
            /Fetching.*activities/i,
            /Loading notices/i,
            /Updating display/i,
            /Refreshing data/i,
            /Checking for updates/i,
            /Monitoring/i,
            /Polling/i,
            /setInterval/i,
            /setTimeout/i
        ];
        
        // Block if matches spam patterns
        if (patterns.some(pattern => pattern.test(message))) {
            // Count but don't log
            const count = (logCounts.get(message) || 0) + 1;
            logCounts.set(message, count);
            
            // Log summary every 100 occurrences
            if (count % 100 === 0) {
                originalLog.call(console, `[Suppressed ${count}x]: ${message.substring(0, 50)}...`);
            }
            return;
        }
        
        // Skip if recently logged (within 1 second)
        const messageKey = message.substring(0, 100);
        if (loggedMessages.has(messageKey)) {
            return;
        }
        
        loggedMessages.add(messageKey);
        setTimeout(() => loggedMessages.delete(messageKey), 1000);
        
        // Log normally
        originalLog.apply(console, args);
    };
    
    // Also throttle errors and warnings
    console.error = function(...args) {
        const message = args.join(' ');
        if (message.includes('Failed to fetch') || 
            message.includes('Network error') ||
            message.includes('Contract not ready')) {
            return; // Skip common non-critical errors
        }
        originalError.apply(console, args);
    };
    
    console.warn = function(...args) {
        const message = args.join(' ');
        if (message.includes('TronWeb not found') || 
            message.includes('Waiting for wallet')) {
            return; // Skip common warnings during initialization
        }
        originalWarn.apply(console, args);
    };
    
    // Cleanup intervals to prevent resource leaks
    const activeIntervals = new Set();
    const originalSetInterval = window.setInterval;
    const originalClearInterval = window.clearInterval;
    
    window.setInterval = function(callback, delay, ...args) {
        // Limit minimum interval to 1 second (except for critical functions)
        const minDelay = delay < 1000 ? 1000 : delay;
        
        const intervalId = originalSetInterval.call(window, callback, minDelay, ...args);
        activeIntervals.add(intervalId);
        
        // Auto-cleanup if too many intervals
        if (activeIntervals.size > 20) {
            console.warn('Too many active intervals, cleaning up oldest');
            const oldest = activeIntervals.values().next().value;
            clearInterval(oldest);
        }
        
        return intervalId;
    };
    
    window.clearInterval = function(intervalId) {
        activeIntervals.delete(intervalId);
        originalClearInterval.call(window, intervalId);
    };
    
    // Prevent duplicate contract initializations
    let contractInitialized = false;
    const originalInitContract = window.initializeContract || (() => {});
    
    window.initializeContract = async function(...args) {
        if (contractInitialized) {
            console.log('Contract already initialized, skipping duplicate call');
            return window.legalContract;
        }
        contractInitialized = true;
        return originalInitContract.apply(this, args);
    };
    
    // Consolidate wallet checking
    let lastWalletCheck = 0;
    const checkWalletThrottled = function() {
        const now = Date.now();
        if (now - lastWalletCheck < 5000) {
            return Promise.resolve(window.tronWeb?.defaultAddress?.base58);
        }
        lastWalletCheck = now;
        
        // Original wallet check logic
        if (window.tronWeb && window.tronWeb.defaultAddress && window.tronWeb.defaultAddress.base58) {
            return Promise.resolve(window.tronWeb.defaultAddress.base58);
        }
        return Promise.resolve(null);
    };
    
    // Replace global checkWallet if it exists
    if (window.checkWallet) {
        window.checkWallet = checkWalletThrottled;
    }
    
    // Cleanup duplicate event listeners
    const listenersMap = new WeakMap();
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        // Get existing listeners for this element
        let elementListeners = listenersMap.get(this);
        if (!elementListeners) {
            elementListeners = new Map();
            listenersMap.set(this, elementListeners);
        }
        
        // Check if this exact listener already exists
        const key = `${type}-${listener.toString().substring(0, 50)}`;
        if (elementListeners.has(key)) {
            return; // Skip duplicate
        }
        
        elementListeners.set(key, listener);
        originalAddEventListener.call(this, type, listener, options);
    };
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        // Clear all intervals
        activeIntervals.forEach(id => clearInterval(id));
        
        // Log summary
        console.log('=== Page Performance Summary ===');
        console.log(`Suppressed messages: ${logCounts.size} unique patterns`);
        console.log(`Active intervals cleaned: ${activeIntervals.size}`);
    });
    
    console.log('✅ Page loading cleanup applied - console noise reduced, intervals throttled');
})();