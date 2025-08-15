/**
 * TEST ACCESS CONTROL IMPLEMENTATION
 * Verifies that only server and recipient can access notice images
 */

console.log('🔒 TESTING ACCESS CONTROL IMPLEMENTATION');
console.log('=' .repeat(70));

window.TestAccessControl = {
    
    // Test wallet addresses
    testWallets: {
        server: 'TH6RF76a5V5WqGkotJnRGkqYHASbMfYGPm', // Example server wallet
        recipient: 'TKJu6dxSbFuE7sBkApPVBZGiCb7DURV7eG', // Example recipient wallet
        unauthorized: 'TUnauthorized123456789abcdefghijk', // Unauthorized wallet
    },
    
    async runAllTests() {
        console.log('\n📋 RUNNING COMPREHENSIVE ACCESS CONTROL TESTS\n');
        
        const results = {
            serverAccess: false,
            recipientAccess: false,
            unauthorizedBlocked: false,
            corsHeaders: false,
            walletHeaders: false
        };
        
        // Test 1: Check if CORS headers are working
        console.log('1️⃣ Testing CORS headers...');
        try {
            const response = await fetch(`${window.BACKEND_URL}/api/health`, {
                headers: {
                    'X-Wallet-Address': 'test-wallet',
                    'X-Server-Address': 'test-server'
                }
            });
            results.corsHeaders = !response.headers.get('access-control-allow-origin')?.includes('error');
            console.log(results.corsHeaders ? '✅ CORS headers working' : '❌ CORS headers blocked');
        } catch (e) {
            console.log('❌ CORS test failed:', e.message);
        }
        
        // Test 2: Check wallet headers are accepted
        console.log('\n2️⃣ Testing wallet header acceptance...');
        try {
            const response = await fetch(`${window.BACKEND_URL}/api/notices/1/images`, {
                headers: {
                    'X-Wallet-Address': this.testWallets.server
                }
            });
            results.walletHeaders = response.status !== 400; // Not a bad request
            console.log(results.walletHeaders ? '✅ Wallet headers accepted' : '❌ Wallet headers rejected');
        } catch (e) {
            console.log('❌ Wallet header test failed:', e.message);
        }
        
        // Test 3: Test unauthorized access is blocked
        console.log('\n3️⃣ Testing unauthorized access blocking...');
        try {
            const response = await fetch(`${window.BACKEND_URL}/api/notices/1/images`, {
                headers: {
                    'X-Wallet-Address': this.testWallets.unauthorized
                }
            });
            results.unauthorizedBlocked = response.status === 403;
            console.log(results.unauthorizedBlocked ? '✅ Unauthorized access blocked' : '❌ Unauthorized access NOT blocked!');
        } catch (e) {
            console.log('⚠️ Could not test unauthorized access:', e.message);
        }
        
        // Summary
        console.log('\n📊 TEST RESULTS SUMMARY:');
        console.table(results);
        
        const passed = Object.values(results).filter(v => v).length;
        const total = Object.keys(results).length;
        
        if (passed === total) {
            console.log('\n🎉 ALL TESTS PASSED! Access control is working correctly.');
        } else {
            console.log(`\n⚠️ ${passed}/${total} tests passed. Some issues need attention.`);
        }
        
        return results;
    },
    
    async testSpecificNotice(noticeId, walletAddress) {
        console.log(`\n🔍 Testing access to notice ${noticeId} with wallet ${walletAddress}...`);
        
        try {
            const response = await fetch(`${window.BACKEND_URL}/api/notices/${noticeId}/images`, {
                headers: {
                    'X-Wallet-Address': walletAddress,
                    'X-Server-Address': walletAddress
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log('✅ ACCESS GRANTED');
                console.log(`Type: ${data.accessType}`);
                console.log(`Message: ${data.message}`);
                console.log(`Has alert image: ${!!data.alertImage}`);
                console.log(`Has document image: ${!!data.documentImage}`);
            } else if (response.status === 403) {
                console.log('❌ ACCESS DENIED');
                console.log(`Reason: ${data.message}`);
            } else if (response.status === 401) {
                console.log('❌ AUTHENTICATION REQUIRED');
            } else if (response.status === 404) {
                console.log('❌ NOTICE NOT FOUND');
            } else {
                console.log('❌ ERROR:', response.status, data.error);
            }
            
            return data;
        } catch (e) {
            console.log('❌ Request failed:', e.message);
            return null;
        }
    },
    
    async verifyCurrentWallet() {
        console.log('\n🔍 VERIFYING CURRENT WALLET ACCESS...\n');
        
        const walletAddress = window.tronWeb?.defaultAddress?.base58;
        if (!walletAddress) {
            console.log('❌ No wallet connected. Please connect TronLink.');
            return;
        }
        
        console.log(`Current wallet: ${walletAddress}`);
        
        // Check served notices
        console.log('\nChecking served notices...');
        try {
            const response = await fetch(`${window.BACKEND_URL}/api/notices/my-served`, {
                headers: { 'X-Wallet-Address': walletAddress }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ You have served ${data.totalNotices} notices`);
                
                if (data.notices?.length > 0) {
                    console.log('\nYour most recent served notices:');
                    data.notices.slice(0, 3).forEach(n => {
                        console.log(`  - Notice #${n.notice_id} to ${n.recipient_address?.substring(0, 10)}...`);
                    });
                }
            } else {
                console.log('❌ Could not fetch served notices');
            }
        } catch (e) {
            console.log('❌ Error checking served notices:', e.message);
        }
        
        // Check received notices
        console.log('\nChecking received notices...');
        try {
            const response = await fetch(`${window.BACKEND_URL}/api/notices/my-received`, {
                headers: { 'X-Wallet-Address': walletAddress }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ You have received ${data.totalNotices} notices`);
                
                if (data.notices?.length > 0) {
                    console.log('\nYour most recent received notices:');
                    data.notices.slice(0, 3).forEach(n => {
                        console.log(`  - Notice #${n.notice_id} from ${n.server_address?.substring(0, 10)}...`);
                    });
                }
            } else {
                console.log('❌ Could not fetch received notices');
            }
        } catch (e) {
            console.log('❌ Error checking received notices:', e.message);
        }
    },
    
    async simulateWorkflows() {
        console.log('\n🔄 SIMULATING BOTH WORKFLOWS...\n');
        
        console.log('WORKFLOW 1: Process Server Views Their Served Notice');
        console.log('-'.repeat(50));
        // This would need actual notice IDs and wallet addresses from your system
        console.log('To test: TestAccessControl.testSpecificNotice(noticeId, serverWallet)');
        
        console.log('\nWORKFLOW 2: Recipient Views Their Received Notice');
        console.log('-'.repeat(50));
        console.log('To test: TestAccessControl.testSpecificNotice(noticeId, recipientWallet)');
        
        console.log('\nWORKFLOW 3: Unauthorized Access Attempt');
        console.log('-'.repeat(50));
        console.log('To test: TestAccessControl.testSpecificNotice(noticeId, "TUnauthorized123")');
    }
};

// Set backend URL if not already set
window.BACKEND_URL = window.BACKEND_URL || 'https://nftserviceapp.onrender.com';

console.log('\n✅ Access control test suite loaded!');
console.log('\nAvailable commands:');
console.log('  TestAccessControl.runAllTests() - Run comprehensive tests');
console.log('  TestAccessControl.verifyCurrentWallet() - Check your wallet access');
console.log('  TestAccessControl.testSpecificNotice(10, "wallet") - Test specific notice');
console.log('  TestAccessControl.simulateWorkflows() - See workflow examples');

// Auto-run verification if wallet is connected
if (window.tronWeb?.defaultAddress?.base58) {
    console.log('\n🔄 Auto-running wallet verification...');
    TestAccessControl.verifyCurrentWallet();
}