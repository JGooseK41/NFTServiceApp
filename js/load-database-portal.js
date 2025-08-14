/**
 * LOAD DATABASE PORTAL
 * Quick loader for the enhanced database management portal
 */

console.log('📦 Loading Enhanced Database Portal...');

// Load the enhanced portal
const script = document.createElement('script');
script.src = '/js/enhanced-database-portal.js';
script.onload = () => {
    console.log('✅ Portal loaded successfully');
    
    // Auto-open if on admin tab
    const adminTab = document.getElementById('adminTab');
    if (adminTab && adminTab.style.display !== 'none') {
        console.log('Admin tab detected - opening portal...');
        setTimeout(() => {
            if (window.EnhancedDatabasePortal) {
                window.EnhancedDatabasePortal.openPortal();
            }
        }, 500);
    } else {
        console.log('Switch to Admin tab and click "Open Database Manager"');
    }
};

document.head.appendChild(script);