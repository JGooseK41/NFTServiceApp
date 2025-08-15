/**
 * TEST SUITE OVERVIEW
 * Complete list of available tests and verification tools
 */

console.log('🧪 NFT SERVICE TEST SUITE');
console.log('=' .repeat(70));

window.TestSuite = {
    
    showAvailableTests() {
        console.log('\n📋 AVAILABLE TEST COMMANDS:\n');
        
        const tests = [
            {
                category: '🔍 METADATA CHECKS',
                commands: [
                    'CheckAlert27.runFullCheck() - Check Alert #27 structure',
                    'CheckMetadataStructure.checkAlert(ID) - Check any alert metadata',
                    'CheckMetadataFields.verifyAlert(ID) - Verify metadata fields',
                    'DirectBlockchainCheck.getTokenURI(ID) - Get raw token URI'
                ]
            },
            {
                category: '📡 BLOCKCHAIN VERIFICATION',
                commands: [
                    'CheckWalletNFTs.listAll() - List all NFTs in wallet',
                    'CheckBlockchainTransaction.verify(txHash) - Verify transaction',
                    'VerifyWorkingAlerts.checkAll() - Check all alerts status',
                    'CheckAlertStatus.quick(ID) - Quick status check'
                ]
            },
            {
                category: '💾 BACKEND CHECKS',
                commands: [
                    'VerifyBackendImageStorage.checkNotice(ID) - Check backend images',
                    'TestAccessControl.checkAccess(noticeId, wallet) - Test access control',
                    'VerifyServerStatus.check() - Verify server registration',
                    'DebugAccessDenial.diagnose(noticeId) - Debug access issues'
                ]
            },
            {
                category: '🚀 PRE-FLIGHT TESTS',
                commands: [
                    'TestRunPreflight.run() - Complete pre-transaction check',
                    'TransactionPreflightCheck.verify() - Verify transaction readiness',
                    'MandatoryEnergyCheck.verify() - Check energy requirements',
                    'FixVerifyFunction.test() - Test verification functions'
                ]
            },
            {
                category: '🧹 CLEANUP & DEBUG',
                commands: [
                    'CleanupTestCases.remove() - Remove test cases',
                    'ClearTestData.run() - Clear all test data',
                    'DebugAlertNFTs.analyze() - Debug alert NFT issues',
                    'DebugNFTMetadata.check(ID) - Debug specific NFT metadata'
                ]
            },
            {
                category: '🔧 FIXES & PATCHES',
                commands: [
                    'FixNoticeIdGeneration.testNextNotice() - Test ID generation',
                    'FixImageLoading.loadNoticeImages(ID) - Fix image loading',
                    'FixRecipientAccess.viewDocument(noticeId, docId) - Test recipient view',
                    'EnergyMonitor.getCurrentEnergy() - Check current energy'
                ]
            }
        ];
        
        tests.forEach(category => {
            console.log(category.category);
            console.log('─'.repeat(50));
            category.commands.forEach(cmd => {
                console.log('  ' + cmd);
            });
            console.log('');
        });
    },
    
    async quickHealthCheck() {
        console.log('\n🏥 RUNNING QUICK HEALTH CHECK...\n');
        
        const results = {
            wallet: false,
            contract: false,
            backend: false,
            energy: false,
            lastAlert: null
        };
        
        // Check wallet
        try {
            if (window.tronWeb && window.tronWeb.defaultAddress.base58) {
                results.wallet = true;
                console.log('✅ Wallet connected:', window.tronWeb.defaultAddress.base58);
            } else {
                console.log('❌ Wallet not connected');
            }
        } catch (e) {
            console.log('❌ Wallet error:', e.message);
        }
        
        // Check contract
        try {
            const contract = await window.tronWeb.contract().at('TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb');
            const supply = await contract.totalSupply().call();
            results.contract = true;
            results.lastAlert = Number(supply.toString());
            console.log('✅ Contract connected. Total tokens:', results.lastAlert);
        } catch (e) {
            console.log('❌ Contract error:', e.message);
        }
        
        // Check backend
        try {
            const response = await fetch('https://nftserviceapp.onrender.com/api/health');
            results.backend = response.ok;
            console.log(results.backend ? '✅ Backend online' : '❌ Backend offline');
        } catch (e) {
            console.log('❌ Backend error:', e.message);
        }
        
        // Check energy
        try {
            const account = await window.tronWeb.trx.getAccount();
            results.energy = account.energy || 0;
            console.log('⚡ Current energy:', results.energy);
        } catch (e) {
            console.log('❌ Energy check error:', e.message);
        }
        
        return results;
    },
    
    async checkSpecificAlert(alertId) {
        console.log(`\n🔍 CHECKING ALERT #${alertId}\n`);
        console.log('─'.repeat(50));
        
        try {
            const contract = await window.tronWeb.contract().at('TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb');
            
            // Get token URI
            const tokenURI = await contract.tokenURI(alertId).call();
            
            // Determine type
            if (tokenURI.startsWith('data:application/json;base64,')) {
                console.log('✅ Format: BASE64 DATA URI');
                console.log('✅ Self-contained, will display in wallets');
                
                // Decode and show first 200 chars
                const base64 = tokenURI.split(',')[1];
                const decoded = atob(base64);
                const metadata = JSON.parse(decoded);
                
                console.log('\nMetadata Preview:');
                console.log('  Name:', metadata.name);
                console.log('  Image type:', metadata.image?.substring(0, 30) + '...');
                
                if (metadata.image?.startsWith('data:image')) {
                    console.log('  ✅ Image is also base64 encoded');
                } else if (metadata.image?.includes('ipfs')) {
                    console.log('  ⚠️ Image uses IPFS');
                }
                
            } else if (tokenURI.includes('ipfs')) {
                console.log('⚠️ Format: IPFS URI');
                console.log('⚠️ Requires gateway, may not display');
                console.log('URI:', tokenURI);
            } else {
                console.log('❓ Format: Unknown');
                console.log('URI:', tokenURI);
            }
            
            // Check owner
            try {
                const owner = await contract.ownerOf(alertId).call();
                console.log('\nOwner:', owner);
            } catch (e) {
                console.log('\n❌ Could not get owner (may not exist)');
            }
            
        } catch (error) {
            console.error('❌ Error checking alert:', error.message);
        }
    },
    
    listRecentAlerts() {
        console.log('\n📜 CHECKING RECENT ALERTS...\n');
        
        // Recent alert IDs to check
        const recentIds = [23, 24, 25, 26, 27, 28, 29, 30];
        
        console.log('Checking alerts:', recentIds.join(', '));
        console.log('─'.repeat(50));
        
        recentIds.forEach(async (id, index) => {
            setTimeout(async () => {
                try {
                    const contract = await window.tronWeb.contract().at('TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb');
                    const tokenURI = await contract.tokenURI(id).call();
                    
                    const isBase64 = tokenURI.startsWith('data:application/json;base64,');
                    const isIPFS = tokenURI.includes('ipfs');
                    
                    console.log(`Alert #${id}: ${isBase64 ? '✅ BASE64' : isIPFS ? '⚠️ IPFS' : '❓ Unknown'}`);
                } catch (e) {
                    console.log(`Alert #${id}: ❌ Error or doesn't exist`);
                }
            }, index * 500); // Stagger requests
        });
    }
};

// Show menu
TestSuite.showAvailableTests();

// Run quick check
TestSuite.quickHealthCheck();

console.log('\n💡 TIP: To check Alert #27 specifically, run:');
console.log('    CheckAlert27.runFullCheck()');
console.log('\n💡 Or check any alert with:');
console.log('    TestSuite.checkSpecificAlert(27)');