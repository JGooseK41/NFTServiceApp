/**
 * INTEGRATE DISMISS SYSTEM
 * Adds the dismiss notice system to the main application
 */

console.log('🔧 INTEGRATING DISMISS SYSTEM');
console.log('=' .repeat(70));

// Load the dismiss notice system script
const script = document.createElement('script');
script.src = 'js/dismiss-notice-system.js';
script.onload = () => {
    console.log('✅ Dismiss system loaded');
    
    // Initialize after a short delay to ensure DOM is ready
    setTimeout(() => {
        if (window.DismissNoticeSystem) {
            window.DismissNoticeSystem.init();
            console.log('✅ Dismiss system initialized');
        }
    }, 1000);
};

document.head.appendChild(script);

// Also update the tab name immediately
setTimeout(() => {
    const tabs = document.querySelectorAll('.tab-button, .nav-link, button');
    tabs.forEach(tab => {
        if (tab.textContent.includes('Delivery Status')) {
            tab.innerHTML = tab.innerHTML.replace('Delivery Status', '📂 Served Notices');
            console.log('✅ Renamed "Delivery Status" to "Served Notices"');
        }
    });
}, 500);

console.log('\n✅ Dismiss system integration complete!');
console.log('The system will:');
console.log('  • Add dismiss buttons to all notice cards');
console.log('  • Hide dismissed notices from recent view');
console.log('  • Keep all notices accessible in "Served Notices" tab');
console.log('  • Store dismissed state in localStorage');