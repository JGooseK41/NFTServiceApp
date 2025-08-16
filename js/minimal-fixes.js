/**
 * MINIMAL FIXES - Lightweight version to prevent page freezing
 */

console.log('Loading minimal fixes...');

// Fix 1: Remove ALL loading screens immediately and permanently
function removeAllLoadingScreens() {
    // Remove ANYTHING that looks like a loading screen
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const text = (el.textContent || '').toLowerCase();
        const className = (el.className || '').toLowerCase();
        const id = (el.id || '').toLowerCase();
        
        // Check if it's positioned in bottom-right
        const isBottomRight = style.position === 'fixed' && 
                             style.bottom !== 'auto' && 
                             style.right !== 'auto';
        
        // Check if it contains loading-related text
        const hasLoadingText = text.includes('processing') || 
                              text.includes('transaction') ||
                              text.includes('loading') ||
                              text.includes('acquiring') ||
                              text.includes('confirming') ||
                              text.includes('waiting') ||
                              text.includes('please wait') ||
                              text.includes('blockchain confirmation');
        
        // Check class/id for loading indicators
        const hasLoadingClass = className.includes('process') || 
                               className.includes('load') ||
                               className.includes('transaction') ||
                               className.includes('status') ||
                               id.includes('process') ||
                               id.includes('load') ||
                               id.includes('transaction');
        
        // Remove if it matches any criteria
        if ((isBottomRight && hasLoadingText) || 
            (hasLoadingClass && hasLoadingText) ||
            (isBottomRight && text.length > 0 && text.length < 200)) { // Short text in bottom-right
            console.log('REMOVING:', el.tagName, className || id || text.substring(0, 50));
            el.remove();
        }
    });
    
    // Also check for divs with inline styles
    document.querySelectorAll('div[style*="fixed"]').forEach(div => {
        const style = div.getAttribute('style') || '';
        if (style.includes('bottom') && style.includes('right')) {
            console.log('REMOVING bottom-right div:', div.textContent?.substring(0, 50));
            div.remove();
        }
    });
}

// Run immediately and then periodically
removeAllLoadingScreens();
setInterval(removeAllLoadingScreens, 100); // Check every 100ms to catch any new ones

// Extra aggressive removal for the specific blockchain confirmation message
setInterval(() => {
    // Target the exact "please wait for blockchain confirmation" message
    document.querySelectorAll('*').forEach(el => {
        if (el.textContent && el.textContent.includes('Please wait for blockchain confirmation')) {
            console.log('FOUND AND REMOVING blockchain confirmation message');
            // Remove the parent container too
            if (el.parentElement) el.parentElement.remove();
            else el.remove();
        }
    });
    
    // Also remove any transaction-loading class elements
    document.querySelectorAll('.transaction-loading').forEach(el => {
        console.log('REMOVING transaction-loading element');
        el.remove();
    });
}, 100);

// Prevent any new loading screens from being created
const originalCreateElement = document.createElement;
document.createElement = function(tagName) {
    const element = originalCreateElement.call(document, tagName);
    
    // Monitor for loading screen characteristics
    const originalSetAttribute = element.setAttribute;
    element.setAttribute = function(name, value) {
        if (name === 'class' && (value.includes('processing') || value.includes('loading') || value.includes('transaction-status'))) {
            console.log('Blocked loading screen creation via class');
            return;
        }
        return originalSetAttribute.call(this, name, value);
    };
    
    return element;
}

// Fix 2: Keep wallet connected on tab switch (simplified)
const originalShowTab = window.showTab;
if (originalShowTab) {
    window.showTab = function(tabName) {
        const wasConnected = window.tronWeb && window.tronWeb.ready;
        originalShowTab.call(this, tabName);
        
        // If wallet was connected, ensure UI shows it
        if (wasConnected) {
            const connectBtn = document.getElementById('connectBtn');
            if (connectBtn && connectBtn.textContent.includes('Connect')) {
                connectBtn.innerHTML = '<i class="fas fa-check-circle"></i> Connected';
                connectBtn.classList.add('btn-success');
            }
        }
    };
}

// Fix 3: Add working dismiss functionality for cases
window.dismissedCases = JSON.parse(localStorage.getItem('dismissedCases') || '[]');

window.dismissCase = function(caseNumber) {
    console.log('Dismissing case:', caseNumber);
    
    // Add to dismissed list
    if (!window.dismissedCases.includes(caseNumber)) {
        window.dismissedCases.push(caseNumber);
        localStorage.setItem('dismissedCases', JSON.stringify(window.dismissedCases));
    }
    
    // Find and hide the case element
    const caseElements = document.querySelectorAll('.case-card, .notice-card, [data-case-number]');
    caseElements.forEach(el => {
        if (el.textContent.includes(caseNumber) || el.dataset.caseNumber === caseNumber) {
            el.style.transition = 'opacity 0.3s';
            el.style.opacity = '0';
            setTimeout(() => {
                el.remove();
            }, 300);
        }
    });
    
    // Show confirmation
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #10b981;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        font-weight: 500;
    `;
    toast.textContent = `Case ${caseNumber} dismissed`;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
};

// Hook dismiss buttons to actually work
setInterval(() => {
    const dismissButtons = document.querySelectorAll('[onclick*="dismiss"], .dismiss-btn, [style*="background: #dc2626"], [style*="background: red"]');
    dismissButtons.forEach(btn => {
        if (!btn.dataset.dismissHooked) {
            btn.dataset.dismissHooked = 'true';
            
            // Extract case number from nearby text or parent element
            const parent = btn.closest('.case-card, .notice-card, [data-case-number]');
            if (parent) {
                const caseText = parent.textContent;
                const caseMatch = caseText.match(/Case[:\s#]*([A-Z0-9-]+)/i);
                if (caseMatch) {
                    const caseNumber = caseMatch[1];
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        window.dismissCase(caseNumber);
                    };
                }
            }
        }
    });
}, 1000);

// Hide previously dismissed cases on page load
function hideDismissedCases() {
    window.dismissedCases.forEach(caseNumber => {
        const caseElements = document.querySelectorAll('.case-card, .notice-card, [data-case-number]');
        caseElements.forEach(el => {
            if (el.textContent.includes(caseNumber) || el.dataset.caseNumber === caseNumber) {
                el.remove();
            }
        });
    });
}

// Run on page load and periodically
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideDismissedCases);
} else {
    hideDismissedCases();
}
setInterval(hideDismissedCases, 5000);

console.log('✅ Minimal fixes loaded with dismiss functionality');