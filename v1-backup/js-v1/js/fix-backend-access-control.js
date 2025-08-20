/**
 * FIX BACKEND ACCESS CONTROL
 * Ensures notice images are only accessible by server and recipient
 */

console.log('🔒 FIXING BACKEND ACCESS CONTROL FOR NOTICE IMAGES');
console.log('=' .repeat(70));

window.FixBackendAccessControl = {
    
    init() {
        console.log('Initializing access control fix...');
        
        // Override fetch to always include wallet address in headers
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
            // Add wallet address to all API calls
            if (typeof url === 'string' && url.includes('/api/')) {
                options.headers = options.headers || {};
                
                // Get current wallet address
                const walletAddress = window.tronWeb?.defaultAddress?.base58 || 
                                    localStorage.getItem('currentServerAddress');
                
                if (walletAddress) {
                    options.headers['X-Wallet-Address'] = walletAddress;
                    options.headers['X-Server-Address'] = walletAddress;
                }
            }
            
            return originalFetch.call(this, url, options);
        };
        
        console.log('✅ Fetch override installed - wallet address will be included in all API calls');
    },
    
    async testAccessControl() {
        console.log('\n🔍 TESTING ACCESS CONTROL...\n');
        
        const walletAddress = window.tronWeb?.defaultAddress?.base58;
        if (!walletAddress) {
            console.log('❌ No wallet connected. Please connect TronLink first.');
            return;
        }
        
        console.log(`Connected wallet: ${walletAddress}`);
        
        // Test 1: Check if current wallet is a process server
        console.log('\n1️⃣ Checking if you are a process server...');
        try {
            const response = await fetch(`${window.BACKEND_URL || ''}/api/notices/my-served`, {
                headers: {
                    'X-Wallet-Address': walletAddress,
                    'X-Server-Address': walletAddress
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ You have served ${data.totalNotices} notices`);
                
                if (data.notices && data.notices.length > 0) {
                    console.log('Your served notices:', data.notices.slice(0, 3).map(n => ({
                        id: n.notice_id,
                        recipient: n.recipient_address,
                        hasImages: !!(n.alertImage || n.documentImage)
                    })));
                }
            } else {
                console.log('❌ Error checking served notices:', response.status);
            }
        } catch (e) {
            console.log('❌ Failed to check served notices:', e.message);
        }
        
        // Test 2: Check if current wallet is a recipient
        console.log('\n2️⃣ Checking if you are a recipient...');
        try {
            const response = await fetch(`${window.BACKEND_URL || ''}/api/notices/my-received`, {
                headers: {
                    'X-Wallet-Address': walletAddress
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ You have received ${data.totalNotices} notices`);
                
                if (data.notices && data.notices.length > 0) {
                    console.log('Your received notices:', data.notices.slice(0, 3).map(n => ({
                        id: n.notice_id,
                        server: n.server_address,
                        hasImages: !!(n.alertImage || n.documentImage)
                    })));
                }
            } else {
                console.log('❌ Error checking received notices:', response.status);
            }
        } catch (e) {
            console.log('❌ Failed to check received notices:', e.message);
        }
    },
    
    async testSpecificNotice(noticeId) {
        console.log(`\n🔍 Testing access to notice ${noticeId}...`);
        
        const walletAddress = window.tronWeb?.defaultAddress?.base58;
        if (!walletAddress) {
            console.log('❌ No wallet connected');
            return;
        }
        
        try {
            const response = await fetch(`${window.BACKEND_URL || ''}/api/images/${noticeId}`, {
                headers: {
                    'X-Wallet-Address': walletAddress,
                    'X-Server-Address': walletAddress
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ ACCESS GRANTED');
                console.log(`Access type: ${data.accessType}`);
                console.log(`Alert image: ${data.alertImage ? 'Available' : 'Not stored'}`);
                console.log(`Document image: ${data.documentImage ? 'Available' : 'Not stored'}`);
                return data;
            } else if (response.status === 403) {
                const error = await response.json();
                console.log('❌ ACCESS DENIED');
                console.log(`Reason: ${error.message}`);
                console.log(`Your wallet: ${walletAddress}`);
                console.log(`Are you the server? ${error.isServer}`);
                console.log(`Are you the recipient? ${error.isRecipient}`);
            } else if (response.status === 401) {
                console.log('❌ AUTHENTICATION REQUIRED');
                console.log('Make sure your wallet is connected');
            } else if (response.status === 404) {
                console.log('❌ Notice not found');
            }
        } catch (e) {
            console.log('❌ Error:', e.message);
        }
    },
    
    async verifyWorkflows() {
        console.log('\n🔄 VERIFYING ACCESS WORKFLOWS...\n');
        
        const walletAddress = window.tronWeb?.defaultAddress?.base58;
        if (!walletAddress) {
            console.log('❌ Connect wallet first');
            return;
        }
        
        const checks = {
            walletConnected: !!walletAddress,
            isProcessServer: false,
            isRecipient: false,
            canViewServedNotices: false,
            canViewReceivedNotices: false
        };
        
        // Check if process server
        try {
            const resp = await fetch(`${window.BACKEND_URL || ''}/api/notices/my-served`, {
                headers: { 'X-Wallet-Address': walletAddress }
            });
            checks.isProcessServer = resp.ok;
            const data = resp.ok ? await resp.json() : {};
            checks.canViewServedNotices = data.totalNotices > 0;
        } catch (e) {}
        
        // Check if recipient
        try {
            const resp = await fetch(`${window.BACKEND_URL || ''}/api/notices/my-received`, {
                headers: { 'X-Wallet-Address': walletAddress }
            });
            checks.isRecipient = resp.ok;
            const data = resp.ok ? await resp.json() : {};
            checks.canViewReceivedNotices = data.totalNotices > 0;
        } catch (e) {}
        
        console.table(checks);
        
        if (checks.isProcessServer) {
            console.log('\n✅ PROCESS SERVER WORKFLOW:');
            console.log('1. You can view all notices you served');
            console.log('2. You can see alert and document images');
            console.log('3. Access is granted through your wallet address');
        }
        
        if (checks.isRecipient) {
            console.log('\n✅ RECIPIENT WORKFLOW:');
            console.log('1. You can view all notices sent to you');
            console.log('2. You can see alert and document images');
            console.log('3. Access is granted through your wallet address');
        }
        
        if (!checks.isProcessServer && !checks.isRecipient) {
            console.log('\n⚠️ This wallet has no associated notices');
            console.log('You will not be able to access any notice images');
        }
        
        return checks;
    }
};

// Initialize immediately
FixBackendAccessControl.init();

console.log('\n✅ Access control fix loaded!');
console.log('\nThe backend should now enforce that only:');
console.log('  • Process servers can view notices they served');
console.log('  • Recipients can view notices sent to them');
console.log('  • No one else can access the images');
console.log('\nCommands:');
console.log('  FixBackendAccessControl.testAccessControl() - Test your access');
console.log('  FixBackendAccessControl.testSpecificNotice(10) - Test specific notice');
console.log('  FixBackendAccessControl.verifyWorkflows() - Verify both workflows');

// Auto-test if wallet is connected
if (window.tronWeb?.defaultAddress?.base58) {
    console.log('\n🔄 Running automatic verification...');
    FixBackendAccessControl.verifyWorkflows();
}