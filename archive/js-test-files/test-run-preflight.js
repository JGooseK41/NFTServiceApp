/**
 * TEST RUN PREFLIGHT CHECK
 * Ensure everything is ready for testing new base64 Alert NFTs
 */

console.log('✈️ PREFLIGHT CHECK FOR BASE64 ALERT NFT TEST');
console.log('=' .repeat(70));

window.TestRunPreflight = {
    
    async runAllChecks() {
        console.log('\n🔍 Running comprehensive preflight checks...\n');
        
        const checks = {
            nextAlertId: null,
            base64FixInstalled: false,
            overlayUpdated: false,
            contractReady: false,
            backendReady: false,
            estimatedGas: null,
            ready: false
        };
        
        // Check 1: What's the next Alert ID?
        console.log('1️⃣ CHECKING NEXT ALERT ID...');
        try {
            const totalNotices = await window.legalContract.totalNotices().call();
            const nextNoticeId = parseInt(totalNotices) + 1;
            checks.nextAlertId = nextNoticeId * 2 - 1; // Alert IDs are odd
            console.log(`   ✅ Next Alert will be #${checks.nextAlertId}`);
            console.log(`   ✅ Next Document will be #${checks.nextAlertId + 1}`);
        } catch (e) {
            console.log('   ⚠️ Could not determine next ID:', e.message);
            checks.nextAlertId = 23; // Best guess
        }
        
        // Check 2: Is base64 fix installed?
        console.log('\n2️⃣ CHECKING BASE64 FIX...');
        if (window.FixFutureAlertMinting && window.FixFutureAlertMinting.generateBase64URI) {
            checks.base64FixInstalled = true;
            console.log('   ✅ Base64 generation fix is installed');
            
            // Test generation
            const testURI = window.FixFutureAlertMinting.generateBase64URI(checks.nextAlertId, {
                caseNumber: 'TEST-123',
                recipientName: 'Test Recipient'
            });
            console.log(`   ✅ Test generation successful`);
            console.log(`   Size: ${(testURI.length / 1024).toFixed(2)} KB`);
        } else {
            console.log('   ❌ Base64 fix NOT installed!');
            console.log('   Run: fix-future-alert-minting.js');
        }
        
        // Check 3: Is BlockServed overlay installed?
        console.log('\n3️⃣ CHECKING BLOCKSERVED OVERLAY...');
        if (window.AlertOverlayBlockServed) {
            checks.overlayUpdated = true;
            console.log('   ✅ BlockServed.com overlay is installed');
        } else {
            console.log('   ⚠️ BlockServed overlay not loaded');
            console.log('   Run: alert-overlay-blockserved.js');
        }
        
        // Check 4: Contract connection
        console.log('\n4️⃣ CHECKING CONTRACT CONNECTION...');
        try {
            if (window.legalContract && window.legalContract.serveNotice) {
                checks.contractReady = true;
                console.log('   ✅ Contract is connected');
                console.log(`   Address: ${window.CONTRACT_ADDRESS}`);
                
                // Check if serveNotice is wrapped
                if (window.originalServeNotice) {
                    console.log('   ✅ serveNotice is wrapped for base64');
                } else {
                    console.log('   ⚠️ serveNotice not wrapped yet');
                }
            }
        } catch (e) {
            console.log('   ❌ Contract issue:', e.message);
        }
        
        // Check 5: Current wallet
        console.log('\n5️⃣ CHECKING WALLET...');
        if (window.tronWeb && window.tronWeb.defaultAddress.base58) {
            console.log(`   ✅ Connected: ${window.tronWeb.defaultAddress.base58}`);
            
            // Check balance
            try {
                const balance = await window.tronWeb.trx.getBalance(window.tronWeb.defaultAddress.base58);
                console.log(`   Balance: ${(balance / 1000000).toFixed(2)} TRX`);
            } catch (e) {
                console.log('   Could not check balance');
            }
        } else {
            console.log('   ❌ No wallet connected');
        }
        
        // Check 6: Test metadata generation
        console.log('\n6️⃣ TESTING METADATA GENERATION...');
        const testMetadata = {
            name: `Legal Notice Alert #${checks.nextAlertId}`,
            description: `OFFICIAL LEGAL NOTICE - View and accept at BlockServed.com\n\nCase: TEST-CASE\nRecipient: Test User\n\nThis NFT represents an official legal notice requiring acknowledgment at www.BlockServed.com`,
            image: "data:image/svg+xml;base64,PHN2Zw==", // Shortened for test
            external_url: "https://www.blockserved.com",
            attributes: [
                { trait_type: "Type", value: "Alert NFT" },
                { trait_type: "Case Number", value: "TEST-CASE" },
                { trait_type: "View At", value: "BlockServed.com" }
            ]
        };
        
        const testDataURI = 'data:application/json;base64,' + btoa(JSON.stringify(testMetadata));
        console.log(`   ✅ Metadata generation works`);
        console.log(`   Size: ${(testDataURI.length / 1024).toFixed(2)} KB`);
        
        // Final status
        checks.ready = checks.base64FixInstalled && checks.contractReady;
        
        console.log('\n' + '=' .repeat(70));
        console.log('📊 PREFLIGHT SUMMARY:');
        console.log('=' .repeat(70));
        console.table(checks);
        
        if (checks.ready) {
            console.log('\n✅ READY FOR TEST RUN!');
            console.log(`\nAlert #${checks.nextAlertId} will:`);
            console.log('  • Use base64 data URI (no IPFS for alert)');
            console.log('  • Include BlockServed.com message');
            console.log('  • Display reliably in all wallets');
            console.log('  • Have embedded description');
        } else {
            console.log('\n⚠️ NOT READY - Fix issues above first');
        }
        
        return checks;
    },
    
    // Quick function to load all necessary scripts
    async loadRequiredScripts() {
        console.log('\n📦 Loading required scripts...\n');
        
        const scripts = [
            '/js/fix-future-alert-minting.js',
            '/js/alert-overlay-blockserved.js'
        ];
        
        for (const src of scripts) {
            const script = document.createElement('script');
            script.src = src;
            document.head.appendChild(script);
            console.log(`Loaded: ${src}`);
            
            // Wait a bit for script to initialize
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('\n✅ All scripts loaded');
        console.log('Run TestRunPreflight.runAllChecks() to verify');
    },
    
    // Monitor the next transaction
    monitorNextServe() {
        console.log('\n👁️ MONITORING FOR NEXT SERVE NOTICE...');
        
        if (!window.originalServeNotice) {
            console.log('Installing monitor on serveNotice...');
            
            const original = window.legalContract.serveNotice;
            window.legalContract.serveNotice = function(...args) {
                console.log('\n🚨 SERVE NOTICE CALLED!');
                console.log('Arguments:', args);
                
                const alertTokenURI = args[5];
                console.log('\nAlert Token URI:');
                
                if (alertTokenURI.startsWith('data:application/json;base64,')) {
                    console.log('✅ Using BASE64 data URI!');
                    
                    // Decode to verify
                    try {
                        const base64Part = alertTokenURI.replace('data:application/json;base64,', '');
                        const metadata = JSON.parse(atob(base64Part));
                        console.log('Metadata name:', metadata.name);
                        console.log('Has description:', !!metadata.description);
                        console.log('Has BlockServed image:', metadata.image?.includes('BlockServed'));
                    } catch (e) {
                        console.log('Could not decode metadata');
                    }
                } else if (alertTokenURI.startsWith('ipfs://')) {
                    console.log('⚠️ Still using IPFS - fix not applied');
                } else {
                    console.log('❓ Unknown URI format');
                }
                
                // Call original
                return original.call(this, ...args);
            };
            
            console.log('✅ Monitor installed - will log next serve attempt');
        } else {
            console.log('✅ Monitor already installed');
        }
    }
};

// Auto-run preflight check
console.log('Starting preflight check...\n');
TestRunPreflight.runAllChecks().then(results => {
    console.log('\n' + '=' .repeat(70));
    
    if (results.ready) {
        console.log('🎯 READY FOR TEST!');
        console.log('\nNext steps:');
        console.log('1. Create a new notice as normal');
        console.log('2. Alert #' + results.nextAlertId + ' will use base64 automatically');
        console.log('3. Check wallet to verify it displays properly');
    } else {
        console.log('⚠️ Load required scripts first:');
        console.log('  TestRunPreflight.loadRequiredScripts()');
    }
    
    console.log('\nTo monitor the transaction:');
    console.log('  TestRunPreflight.monitorNextServe()');
});