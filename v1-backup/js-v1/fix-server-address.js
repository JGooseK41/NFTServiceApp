/**
 * FIX SERVER ADDRESS FOR YOUR NOTICES
 * Updates the backend to recognize you as the server
 */

console.log('🔧 FIXING SERVER ADDRESS FOR YOUR NOTICES');
console.log('=' .repeat(70));

window.FixServerAddress = {
    
    // Your correct server address
    YOUR_ADDRESS: 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
    
    async checkYourAccess() {
        console.log('\n📍 Your server address:', this.YOUR_ADDRESS);
        console.log('\n🔍 Checking your access to notices...\n');
        
        // Check served notices
        console.log('1️⃣ Checking served notices...');
        try {
            const response = await fetch('https://nftserviceapp.onrender.com/api/notices/my-served', {
                headers: {
                    'X-Wallet-Address': this.YOUR_ADDRESS,
                    'X-Server-Address': this.YOUR_ADDRESS
                }
            });
            
            const data = await response.json();
            
            if (data.totalNotices > 0) {
                console.log(`✅ You have access to ${data.totalNotices} served notices`);
                data.notices?.forEach(n => {
                    console.log(`  - Notice #${n.alert_id || n.notice_id}`);
                });
            } else if (data.error) {
                console.log('❌ No served notices found with your address');
                console.log('   This means the database doesn\'t have your address recorded as the server');
            }
        } catch (e) {
            console.log('❌ Error:', e.message);
        }
        
        // Test Notice #19 specifically
        console.log('\n2️⃣ Testing Notice #19 access...');
        try {
            const response = await fetch('https://nftserviceapp.onrender.com/api/images/19', {
                headers: {
                    'X-Wallet-Address': this.YOUR_ADDRESS,
                    'X-Server-Address': this.YOUR_ADDRESS
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log('✅ You HAVE access to Notice #19');
                console.log('   Access type:', data.accessType);
            } else if (response.status === 403) {
                console.log('❌ Access DENIED to Notice #19');
                console.log('   The database doesn\'t recognize you as the server');
                console.log('   Server in DB:', data.serverAddress || 'Not set');
            } else if (response.status === 404) {
                console.log('⚠️ Notice #19 not found in database');
            }
        } catch (e) {
            console.log('❌ Error:', e.message);
        }
    },
    
    async requestServerUpdate(noticeId) {
        console.log(`\n🔄 Requesting server address update for Notice #${noticeId}...`);
        
        // This would need a backend endpoint to update the server address
        // For now, we'll document what needs to be done
        
        console.log('\n📝 MANUAL FIX REQUIRED:');
        console.log('The database needs to be updated to set your address as the server.');
        console.log('\nSQL to run on the backend:');
        console.log(`
UPDATE notice_components 
SET server_address = '${this.YOUR_ADDRESS}'
WHERE alert_id = ${noticeId} OR notice_id = ${noticeId};

UPDATE served_notices 
SET server_address = '${this.YOUR_ADDRESS}'
WHERE alert_id = ${noticeId} OR notice_id = ${noticeId};
        `);
    },
    
    async saveServerAddressToStorage() {
        console.log('\n💾 Saving your server address for future notices...');
        
        // Save to localStorage
        localStorage.setItem('currentServerAddress', this.YOUR_ADDRESS);
        
        // Update the global variable
        window.currentServerAddress = this.YOUR_ADDRESS;
        
        // Patch the serveNotice function to always include server address
        if (window.serveNotice) {
            const originalServeNotice = window.serveNotice;
            
            window.serveNotice = async function(...args) {
                console.log('📍 Injecting server address:', FixServerAddress.YOUR_ADDRESS);
                
                // Make sure server address is included in backend calls
                window.currentServerAddress = FixServerAddress.YOUR_ADDRESS;
                localStorage.setItem('currentServerAddress', FixServerAddress.YOUR_ADDRESS);
                
                return originalServeNotice.apply(this, args);
            };
            
            console.log('✅ Patched serveNotice to include your server address');
        }
        
        // Patch saveNoticeToBackend if it exists
        if (window.saveNoticeToBackend) {
            const originalSaveNotice = window.saveNoticeToBackend;
            
            window.saveNoticeToBackend = async function(noticeData) {
                // Ensure server address is included
                noticeData.serverAddress = noticeData.serverAddress || FixServerAddress.YOUR_ADDRESS;
                noticeData.server_address = noticeData.server_address || FixServerAddress.YOUR_ADDRESS;
                
                console.log('📍 Saving notice with server address:', noticeData.serverAddress);
                
                return originalSaveNotice.call(this, noticeData);
            };
            
            console.log('✅ Patched saveNoticeToBackend to include server address');
        }
        
        console.log('✅ Server address saved and functions patched');
    },
    
    async createBackendUpdateEndpoint() {
        console.log('\n📝 Backend endpoint needed to fix existing notices:');
        console.log(`
// Add this to backend/routes/notices.js

router.post('/api/notices/fix-server-address', async (req, res) => {
    const { noticeId, serverAddress } = req.body;
    const adminKey = req.headers['x-admin-key'];
    
    // Verify admin access
    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    try {
        // Update both tables
        await pool.query(
            'UPDATE notice_components SET server_address = $1 WHERE alert_id = $2 OR notice_id = $2',
            [serverAddress, noticeId]
        );
        
        await pool.query(
            'UPDATE served_notices SET server_address = $1 WHERE alert_id = $2 OR notice_id = $2',
            [serverAddress, noticeId]
        );
        
        res.json({ success: true, message: 'Server address updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
        `);
    }
};

// Auto-run checks
console.log('\n🚀 Running automatic checks...');
FixServerAddress.checkYourAccess();
FixServerAddress.saveServerAddressToStorage();

console.log('\n📚 Available commands:');
console.log('  FixServerAddress.checkYourAccess() - Check if you have access');
console.log('  FixServerAddress.requestServerUpdate(19) - Get SQL to fix Notice #19');
console.log('  FixServerAddress.saveServerAddressToStorage() - Save for future notices');

console.log('\n⚠️ IMPORTANT:');
console.log(`Your correct server address is: ${FixServerAddress.YOUR_ADDRESS}`);
console.log('All future notices will now include this address when saved to backend.');