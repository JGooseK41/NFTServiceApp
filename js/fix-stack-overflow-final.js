/**
 * Final Stack Overflow Fix
 * Prevents all recursive console.log calls from multiple scripts
 */

(function() {
    'use strict';
    
    // Only run once
    if (window._stackOverflowFixed) {
        return;
    }
    window._stackOverflowFixed = true;
    
    // Store the REAL original console methods
    const realConsole = {
        log: console.log.bind(console),
        error: console.error.bind(console),
        warn: console.warn.bind(console),
        info: console.info.bind(console)
    };
    
    // Store globally for other scripts
    window.originalConsoleLog = realConsole.log;
    window.originalConsoleError = realConsole.error;
    window.originalConsoleWarn = realConsole.warn;
    
    // Track recursion depth
    let recursionDepth = 0;
    const MAX_DEPTH = 3;
    
    // Create safe console wrapper
    const safeConsoleWrapper = (method) => {
        return function(...args) {
            // Prevent deep recursion
            if (recursionDepth >= MAX_DEPTH) {
                return;
            }
            
            recursionDepth++;
            try {
                // Check for specific patterns that cause recursion
                const message = args.map(arg => {
                    try {
                        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                    } catch (e) {
                        return '[Object]';
                    }
                }).join(' ');
                
                // Skip if it's a captured message (prevents receipt-fix recursion)
                if (message.includes('📝 Captured') || 
                    message.includes('Captured alertId') ||
                    message.includes('Captured documentId')) {
                    realConsole[method](...args);
                    return;
                }
                
                // Call the real console method
                realConsole[method](...args);
                
            } finally {
                recursionDepth--;
            }
        };
    };
    
    // Apply safe wrapper to all console methods
    console.log = safeConsoleWrapper('log');
    console.error = safeConsoleWrapper('error');
    console.warn = safeConsoleWrapper('warn');
    console.info = safeConsoleWrapper('info');
    
    realConsole.log('✅ Stack overflow protection applied (final fix)');
})();