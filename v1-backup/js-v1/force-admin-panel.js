// Force admin panel to work
console.log('🔧 Forcing admin panel functionality...');

// Make admin tab visible
const adminButton = document.getElementById('adminTabButton');
if (adminButton) {
    adminButton.style.display = 'block';
    console.log('✅ Admin tab button now visible');
}

// Override isAdmin check
window.isAdmin = true;
window.forceAdminAccess = true;

// Function to switch to admin tab and load servers
window.forceAdminPanel = function() {
    // Switch to admin tab
    if (typeof switchTab === 'function') {
        switchTab('admin');
    }
    
    // Wait a moment then load servers
    setTimeout(() => {
        if (typeof loadProcessServers === 'function') {
            loadProcessServers();
        }
    }, 500);
};

console.log('✅ Admin panel forced. Run forceAdminPanel() to open it.');