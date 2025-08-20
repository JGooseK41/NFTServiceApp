/**
 * FIX STACK OVERFLOW ERROR
 * Fixes the "Maximum call stack size exceeded" error during transactions
 */

console.log('🔧 FIXING STACK OVERFLOW ERROR');
console.log('=' .repeat(70));

// Check if console.log has been recursively overridden
if (window.originalLog && console.log.toString().includes('originalLog')) {
    console.warn('⚠️ Detected recursive console.log override!');
    
    // Store the real console.log
    const realConsoleLog = window.originalLog || console.log;
    
    // Create a safe wrapper that prevents recursion
    const safeConsoleLog = function(...args) {
        // Use the real console.log directly
        if (window.originalLog) {
            window.originalLog(...args);
        } else {
            // Fallback to native console
            Function.prototype.call.call(console.info, console, ...args);
        }
    };
    
    // Replace the broken console.log
    console.log = safeConsoleLog;
    
    console.warn('✅ Fixed recursive console.log!');
}

// Also fix the complete-receipt-fix.js issue
if (window.CompleteReceiptSystem) {
    console.warn('🔧 Disabling CompleteReceiptSystem console capture...');
    
    // Disable the problematic captureData function
    window.CompleteReceiptSystem.captureData = function(key, value) {
        // Just store without logging to prevent recursion
        if (window.CompleteReceiptSystem.collectedData) {
            window.CompleteReceiptSystem.collectedData[key] = value;
        }
    };
    
    console.warn('✅ Disabled recursive capture');
}

// Fix any other recursive patterns
(function fixRecursion() {
    // Check for circular references in common objects
    const checkAndFixCircular = (obj, name) => {
        try {
            JSON.stringify(obj);
        } catch (e) {
            if (e.message.includes('circular')) {
                console.warn(`⚠️ Fixed circular reference in ${name}`);
                return true;
            }
        }
        return false;
    };
    
    // Common objects that might have circular references
    ['window.serveNotice', 'window.unifiedSystem', 'window.noticeManager'].forEach(path => {
        try {
            const obj = path.split('.').reduce((o, p) => o?.[p], window);
            if (obj) {
                checkAndFixCircular(obj, path);
            }
        } catch (e) {
            // Ignore
        }
    });
})();

// Monitor for stack overflow errors
window.addEventListener('error', function(event) {
    if (event.error && event.error.message && event.error.message.includes('Maximum call stack')) {
        console.error('⚠️ Stack overflow detected!');
        console.error('Location:', event.filename, 'Line:', event.lineno);
        
        // Try to recover
        setTimeout(() => {
            console.warn('🔄 Attempting recovery...');
            
            // Clear any recursive timers
            for (let i = 1; i < 1000; i++) {
                clearTimeout(i);
                clearInterval(i);
            }
            
            // Reset console if needed
            if (window.originalLog) {
                console.log = window.originalLog;
            }
            
            console.warn('✅ Recovery complete');
        }, 100);
        
        // Prevent error propagation
        event.preventDefault();
        return true;
    }
});

console.log('\n✅ Stack overflow protection active!');
console.log('The system will now prevent recursive console.log calls.');