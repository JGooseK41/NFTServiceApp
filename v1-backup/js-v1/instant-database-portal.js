/**
 * INSTANT DATABASE PORTAL
 * Works immediately without requiring admin tab
 */

console.log('🚀 INSTANT DATABASE PORTAL LOADING');

// Load the fixed portal
const script = document.createElement('script');
script.src = '/js/database-portal-fixed.js';
script.onload = () => {
    console.log('✅ Fixed portal loaded');
    
    // Auto-open the portal after a brief delay
    setTimeout(() => {
        if (window.DatabasePortalFixed) {
            window.DatabasePortalFixed.openPortal();
            console.log('✅ Database portal opened');
        }
    }, 100);
};

document.head.appendChild(script);