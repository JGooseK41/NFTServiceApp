/**
 * Proper Case Click Handler
 * ONLY attaches to actual case elements in the Case Management tab
 * Does NOT intercept global clicks
 */

console.log('📋 Setting up proper case click handlers...');

// Function to attach click handlers ONLY to case elements
function attachCaseClickHandlers() {
    // ONLY look for case elements in the cases tab/container
    const casesContainer = document.getElementById('caseList') || 
                          document.getElementById('casesTab') || 
                          document.querySelector('.cases-container');
    
    if (!casesContainer) {
        console.log('Cases container not found yet');
        return;
    }
    
    // Find case items ONLY within the cases container
    const caseItems = casesContainer.querySelectorAll('.case-item, .case-item-enhanced, .case-header');
    
    console.log(`Found ${caseItems.length} case items to attach handlers to`);
    
    caseItems.forEach(item => {
        // Remove any existing onclick to avoid duplicates
        item.onclick = null;
        
        // Extract case ID from the element
        let caseId = item.getAttribute('data-case-id');
        
        if (!caseId) {
            // Try to extract from text
            const text = item.textContent;
            const match = text.match(/Case #(\S+)/);
            if (match) {
                caseId = match[1];
                item.setAttribute('data-case-id', caseId);
            }
        }
        
        if (caseId) {
            // Add click handler ONLY to this specific element
            item.style.cursor = 'pointer';
            item.onclick = function(e) {
                // Don't trigger if clicking a button inside
                if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                
                console.log(`Opening case modal for: ${caseId}`);
                
                // Use the backend API version if available
                if (window.viewCaseDetails) {
                    window.viewCaseDetails(caseId);
                } else {
                    console.error('viewCaseDetails function not found');
                }
            };
        }
    });
}

// Override refreshCaseList to reattach handlers after refresh
const originalRefreshCaseList = window.refreshCaseList;
window.refreshCaseList = async function() {
    if (originalRefreshCaseList) {
        await originalRefreshCaseList();
    }
    
    // Reattach handlers after list refreshes
    setTimeout(attachCaseClickHandlers, 100);
};

// Initial attachment when page loads
document.addEventListener('DOMContentLoaded', attachCaseClickHandlers);

// Also attach when switching to cases tab
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabName) {
    if (originalSwitchTab) {
        originalSwitchTab(tabName);
    }
    
    if (tabName === 'cases') {
        setTimeout(attachCaseClickHandlers, 100);
    }
};

console.log('✅ Proper case click handler ready');
console.log('   - ONLY attaches to case elements in Case Management');
console.log('   - Does NOT intercept other clicks');
console.log('   - Respects button clicks inside cases');