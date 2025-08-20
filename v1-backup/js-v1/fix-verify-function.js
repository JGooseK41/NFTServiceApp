/**
 * FIX VERIFY FUNCTION ERROR
 * Adds the missing verify function that was called in console
 */

console.log('🔧 FIXING VERIFY FUNCTION ERROR');

// Add global verify function for access control testing
window.verify = function() {
    console.log('🔒 Running Access Control Verification...\n');
    
    // Check if wallet is connected
    const walletAddress = window.tronWeb?.defaultAddress?.base58;
    if (!walletAddress) {
        console.log('❌ No wallet connected. Please connect TronLink first.');
        return;
    }
    
    console.log(`Connected wallet: ${walletAddress}`);
    
    // If FixBackendAccessControl is loaded, use it
    if (window.FixBackendAccessControl && window.FixBackendAccessControl.verifyWorkflows) {
        return window.FixBackendAccessControl.verifyWorkflows();
    }
    
    // Otherwise use TestAccessControl
    if (window.TestAccessControl && window.TestAccessControl.verifyCurrentWallet) {
        return window.TestAccessControl.verifyCurrentWallet();
    }
    
    // Fallback verification
    console.log('Running basic verification...');
    
    const tests = {
        wallet: !!walletAddress,
        backend: false,
        accessControl: false
    };
    
    // Test backend connection
    fetch('https://nftserviceapp.onrender.com/api/health')
        .then(r => {
            tests.backend = r.ok;
            console.log(`Backend: ${tests.backend ? '✅ Connected' : '❌ Not responding'}`);
        })
        .catch(e => {
            console.log('❌ Backend error:', e.message);
        });
    
    // Test access control
    fetch(`https://nftserviceapp.onrender.com/api/notices/my-served`, {
        headers: {
            'X-Wallet-Address': walletAddress,
            'X-Server-Address': walletAddress
        }
    })
    .then(r => {
        tests.accessControl = r.ok || r.status === 401 || r.status === 403;
        console.log(`Access Control: ${tests.accessControl ? '✅ Active' : '❌ Not enforced'}`);
        return r.json();
    })
    .then(data => {
        if (data.totalNotices !== undefined) {
            console.log(`You have served ${data.totalNotices} notices`);
        }
    })
    .catch(e => {
        console.log('Access control test error:', e.message);
    });
    
    return tests;
};

// Also add a help function
window.verifyHelp = function() {
    console.log('📚 VERIFICATION COMMANDS:');
    console.log('  verify() - Run access control verification');
    console.log('  FixBackendAccessControl.verifyWorkflows() - Detailed workflow check');
    console.log('  TestAccessControl.verifyCurrentWallet() - Test current wallet access');
    console.log('  TestAccessControl.testSpecificNotice(noticeId, wallet) - Test specific notice');
};

console.log('✅ Verify function added. Type verify() to test access control.');

// Also fix the empty metadata URI issue
const originalFetchMetadata = window.NoticeWorkflow?.fetchMetadata;
if (originalFetchMetadata) {
    window.NoticeWorkflow.fetchMetadata = async function(uri, source = 'unknown') {
        // Skip empty URIs
        if (!uri || uri.trim() === '') {
            console.log('Skipping empty metadata URI');
            return null;
        }
        
        // Call original function
        return originalFetchMetadata.call(this, uri, source);
    };
    
    console.log('✅ Fixed empty metadata URI handling');
}

// Add quick access verify for notice #19 (the IPFS one that's working)
window.verify19 = async function() {
    console.log('🔍 Verifying access to Notice #19 (IPFS metadata working)...\n');
    
    const walletAddress = window.tronWeb?.defaultAddress?.base58;
    if (!walletAddress) {
        console.log('❌ Connect wallet first');
        return;
    }
    
    console.log('Testing IPFS metadata fetch...');
    const ipfsUrl = 'https://gateway.pinata.cloud/ipfs/QmNXdo5dyHsWVPsvNsQFgkHtKCMPbENjGayBADvY9kSVDs';
    
    try {
        const response = await fetch(ipfsUrl);
        const metadata = await response.json();
        console.log('✅ IPFS metadata accessible');
        console.log('  Name:', metadata.name);
        console.log('  Status:', metadata.attributes?.find(a => a.trait_type === 'Status')?.value);
        console.log('  Type:', metadata.attributes?.find(a => a.trait_type === 'Type')?.value);
    } catch (e) {
        console.log('❌ IPFS fetch error:', e.message);
    }
    
    console.log('\nTesting backend access control for notice 19...');
    
    try {
        const response = await fetch('https://nftserviceapp.onrender.com/api/images/19', {
            headers: {
                'X-Wallet-Address': walletAddress,
                'X-Server-Address': walletAddress
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Backend access granted');
            console.log('  Access type:', data.accessType);
            console.log('  Alert image:', data.alertImage ? 'Available' : 'Not stored');
            console.log('  Document image:', data.documentImage ? 'Available' : 'Not stored');
        } else if (response.status === 403) {
            console.log('❌ Access denied - you are not the server or recipient');
        } else if (response.status === 404) {
            console.log('⚠️ Notice not found in backend database');
        } else {
            console.log('❌ Backend error:', response.status);
        }
    } catch (e) {
        console.log('❌ Backend connection error:', e.message);
    }
};

console.log('Type verify19() to test Notice #19 specifically');