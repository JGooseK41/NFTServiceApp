/**
 * MINIMAL FIXES - Lightweight version to prevent page freezing
 */

console.log('Loading minimal fixes...');

// Fix 1: Remove ALL loading screens immediately and permanently
function removeAllLoadingScreens() {
    // Find ALL potential loading elements
    const loaders = document.querySelectorAll(`
        .processing-overlay,
        .transaction-status,
        .transaction-status-modal,
        [class*="processing"],
        [class*="loading"],
        [class*="transaction"],
        [style*="position: fixed"][style*="bottom"],
        [style*="position:fixed"][style*="bottom"]
    `);
    
    loaders.forEach(loader => {
        const text = loader.textContent || '';
        const style = window.getComputedStyle(loader);
        
        // Remove if it's a loading/processing element or bottom-right positioned
        if (text.toLowerCase().includes('processing') || 
            text.toLowerCase().includes('transaction') ||
            text.toLowerCase().includes('loading') ||
            text.toLowerCase().includes('acquiring energy') ||
            text.toLowerCase().includes('confirming') ||
            (style.position === 'fixed' && style.bottom !== 'auto' && style.right !== 'auto')) {
            
            console.log('Removing loading element:', loader.className || loader.id || 'unnamed');
            loader.remove();
        }
    });
    
    // Also remove any elements with inline styles for bottom-right positioning
    const allElements = document.querySelectorAll('[style*="position"]');
    allElements.forEach(el => {
        const style = el.getAttribute('style');
        if (style && style.includes('fixed') && style.includes('bottom') && style.includes('right')) {
            const text = el.textContent || '';
            if (text.includes('Processing') || text.includes('Transaction') || text.includes('Loading')) {
                console.log('Removing inline-styled loader');
                el.remove();
            }
        }
    });
}

// Run immediately and then periodically
removeAllLoadingScreens();
setInterval(removeAllLoadingScreens, 500); // Check every 500ms to catch any new ones

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