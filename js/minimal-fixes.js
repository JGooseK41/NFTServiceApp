/**
 * MINIMAL FIXES - Lightweight version to prevent page freezing
 */

console.log('Loading minimal fixes...');

// Fix 1: Remove stuck loading screens (lightweight version)
setInterval(() => {
    const loaders = document.querySelectorAll('.processing-overlay, .transaction-status');
    loaders.forEach(loader => {
        if (loader.textContent && loader.textContent.includes('Processing')) {
            if (!loader.dataset.startTime) {
                loader.dataset.startTime = Date.now();
            } else if (Date.now() - parseInt(loader.dataset.startTime) > 30000) {
                loader.remove();
            }
        }
    });
}, 5000);

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