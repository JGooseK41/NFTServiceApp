/**
 * MINIMAL FIXES - Lightweight version to prevent page freezing
 */

console.log('Loading minimal fixes...');

// Fix 1: Remove stuck loading screens (aggressive version)
setInterval(() => {
    // Find ALL potential loading elements
    const loaders = document.querySelectorAll(`
        .processing-overlay,
        .transaction-status,
        [class*="processing"],
        [class*="loading"],
        [style*="position: fixed"][style*="bottom"],
        [style*="position:fixed"][style*="bottom"]
    `);
    
    loaders.forEach(loader => {
        const text = loader.textContent || '';
        // Check for transaction/processing text or bottom-right position
        if (text.toLowerCase().includes('processing') || 
            text.toLowerCase().includes('transaction') ||
            text.toLowerCase().includes('loading') ||
            (loader.style.position === 'fixed' && loader.style.bottom && loader.style.right)) {
            
            if (!loader.dataset.startTime) {
                loader.dataset.startTime = Date.now();
            } else if (Date.now() - parseInt(loader.dataset.startTime) > 10000) { // Reduced to 10 seconds
                console.log('Removing stuck loader:', loader);
                loader.remove();
            }
        }
    });
    
    // Specifically target bottom-right fixed elements
    const bottomRightElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.position === 'fixed' && 
               style.bottom !== 'auto' && 
               style.right !== 'auto' &&
               (el.textContent?.includes('transaction') || el.textContent?.includes('Processing'));
    });
    
    bottomRightElements.forEach(el => {
        console.log('Force removing bottom-right loader');
        el.remove();
    });
}, 3000); // Check more frequently

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

console.log('✅ Minimal fixes loaded');