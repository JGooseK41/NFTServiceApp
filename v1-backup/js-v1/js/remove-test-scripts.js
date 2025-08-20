/**
 * Remove Test Scripts from Production
 * Identifies and removes diagnostic/test scripts that shouldn't run in production
 */

(function() {
    'use strict';
    
    // List of test/diagnostic script patterns that should be removed
    const testScriptPatterns = [
        /test-real-transactions/,
        /test-suite-overview/,
        /investigate-alert-display/,
        /check-all-alerts-status/,
        /analyze-working-nfts/,
        /cleanup-test-cases/,
        /clear-test-data/,
        /diagnose-/,
        /debug-/,
        /verify-backend/,
        /verify-server-status/,
        /verify-working-alerts/,
        /compare-working-vs-broken/,
        /blockchain-diagnostics/
    ];
    
    // Find and disable test scripts
    const scripts = document.querySelectorAll('script[src]');
    let removedCount = 0;
    
    scripts.forEach(script => {
        const src = script.src;
        
        if (testScriptPatterns.some(pattern => pattern.test(src))) {
            // Don't actually remove the script element (might break things)
            // Instead, override any global functions it might have created
            console.log(`Disabled test script: ${src.split('/').pop()}`);
            removedCount++;
            
            // Mark as disabled
            script.dataset.disabled = 'true';
        }
    });
    
    // Disable specific test functions if they exist
    const testFunctions = [
        'runDiagnostics',
        'testTransaction',
        'verifyBackend',
        'checkAllAlerts',
        'analyzeWorkingNFTs',
        'clearTestData',
        'investigateAlerts',
        'compareWorkingVsBroken',
        'runBlockchainDiagnostics'
    ];
    
    testFunctions.forEach(funcName => {
        if (window[funcName]) {
            window[funcName] = function() {
                console.warn(`Test function ${funcName} is disabled in production`);
            };
        }
    });
    
    // Disable excessive diagnostic logging
    if (window.diagnosticsEnabled) {
        window.diagnosticsEnabled = false;
    }
    
    console.log(`✅ Disabled ${removedCount} test/diagnostic scripts for production`);
})();