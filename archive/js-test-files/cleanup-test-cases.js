/**
 * Cleanup Test Cases
 * Identifies and removes test data from display
 */

// Test case patterns to identify test data
const TEST_PATTERNS = [
    /^TEST-/i,           // TEST-001, TEST-002, etc.
    /^CASE-\d+$/,        // CASE-1, CASE-2, etc. (generic numbered cases)
    /^DEMO-/i,           // DEMO-1, DEMO-2, etc.
    /^SAMPLE-/i,         // SAMPLE-1, etc.
    /test/i              // Any case containing "test"
];

/**
 * Check if a case number is test data
 */
function isTestCase(caseNumber) {
    if (!caseNumber) return false;
    
    // Check each pattern
    return TEST_PATTERNS.some(pattern => pattern.test(caseNumber));
}

/**
 * Filter out test cases from an array
 */
function filterOutTestCases(cases) {
    return cases.filter(caseData => {
        // Keep real cases (non-test)
        return !isTestCase(caseData.caseNumber);
    });
}

/**
 * Hide test cases from the UI without deleting them
 */
function hideTestCases() {
    console.log('🙈 Hiding test cases from display...');
    
    // If using unified system
    if (window.unifiedSystem && window.unifiedSystem.cases) {
        const allCases = Array.from(window.unifiedSystem.cases.values());
        const testCases = allCases.filter(c => isTestCase(c.caseNumber));
        const realCases = allCases.filter(c => !isTestCase(c.caseNumber));
        
        console.log(`Found ${testCases.length} test cases to hide:`, 
            testCases.map(c => c.caseNumber));
        console.log(`Keeping ${realCases.length} real cases:`, 
            realCases.map(c => c.caseNumber));
        
        // Remove test cases from the map
        testCases.forEach(testCase => {
            window.unifiedSystem.cases.delete(testCase.caseNumber);
        });
        
        // Re-render
        if (window.unifiedSystem.renderCases) {
            window.unifiedSystem.renderCases('unifiedCasesContainer');
        }
        
        return {
            hidden: testCases.length,
            remaining: realCases.length
        };
    }
    
    return { hidden: 0, remaining: 0 };
}

/**
 * Show all cases including test cases
 */
function showAllCases() {
    console.log('👁️ Showing all cases including test data...');
    
    // Reload to show all cases
    if (window.unifiedSystem && window.unifiedSystem.refreshData) {
        window.unifiedSystem.refreshData();
    }
}

/**
 * Permanently delete test cases from backend (use with caution!)
 */
async function deleteTestCasesFromBackend() {
    if (!confirm('⚠️ This will permanently delete test cases from the backend. Continue?')) {
        return;
    }
    
    console.log('🗑️ Deleting test cases from backend...');
    
    // Get test cases
    if (window.unifiedSystem && window.unifiedSystem.cases) {
        const allCases = Array.from(window.unifiedSystem.cases.values());
        const testCases = allCases.filter(c => isTestCase(c.caseNumber));
        
        if (testCases.length === 0) {
            console.log('No test cases to delete');
            return;
        }
        
        // Call backend to delete each test case
        for (const testCase of testCases) {
            try {
                // Note: This endpoint would need to be created on the backend
                const response = await fetch(`${window.BACKEND_API_URL}/api/cases/${testCase.caseNumber}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Server-Address': window.tronWeb?.defaultAddress?.base58
                    }
                });
                
                if (response.ok) {
                    console.log(`✅ Deleted test case: ${testCase.caseNumber}`);
                } else {
                    console.error(`Failed to delete: ${testCase.caseNumber}`);
                }
            } catch (error) {
                console.error(`Error deleting ${testCase.caseNumber}:`, error);
            }
        }
        
        // Refresh display
        hideTestCases();
    }
}

/**
 * Initialize automatic test case filtering
 */
function initTestCaseFilter() {
    // Override the renderCases function to filter test cases
    if (window.unifiedSystem) {
        const originalRender = window.unifiedSystem.renderCases;
        
        window.unifiedSystem.renderCases = function(containerId) {
            // Filter test cases before rendering
            const filtered = new Map();
            for (const [key, value] of this.cases) {
                if (!isTestCase(value.caseNumber)) {
                    filtered.set(key, value);
                }
            }
            
            // Temporarily replace cases with filtered
            const original = this.cases;
            this.cases = filtered;
            
            // Call original render
            originalRender.call(this, containerId);
            
            // Restore original cases
            this.cases = original;
        };
        
        console.log('✅ Test case filter initialized');
    }
}

// Auto-initialize when document loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initTestCaseFilter, 1000); // Wait for unified system to load
    });
} else {
    setTimeout(initTestCaseFilter, 1000);
}

// Make functions globally available
window.isTestCase = isTestCase;
window.hideTestCases = hideTestCases;
window.showAllCases = showAllCases;
window.deleteTestCasesFromBackend = deleteTestCasesFromBackend;
window.initTestCaseFilter = initTestCaseFilter;

console.log('✅ Test case cleanup functions loaded. Use hideTestCases() to hide test data.');