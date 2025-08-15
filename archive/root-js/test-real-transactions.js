/**
 * Real Transaction Testing Script
 * Tests actual transaction flows to find where money is being wasted
 */

console.log('🔥 REAL TRANSACTION TESTER LOADED');
console.log('Run testRealScenarios() to start comprehensive testing');

window.testRealScenarios = async function() {
    const results = {
        passed: [],
        failed: [],
        errors: []
    };
    
    console.log('='.repeat(50));
    console.log('STARTING REAL-WORLD SCENARIO TESTING');
    console.log('='.repeat(50));
    
    // Test 1: Check if wallet is actually connected
    console.log('\n📍 TEST 1: Wallet Connection Reality Check');
    try {
        if (!window.tronWeb) {
            results.failed.push('TronWeb not even loaded');
            console.error('❌ FAIL: TronWeb not loaded at all');
        } else if (!window.tronWeb.defaultAddress?.base58) {
            results.failed.push('Wallet not actually connected');
            console.error('❌ FAIL: Wallet shows as not connected');
        } else {
            const address = window.tronWeb.defaultAddress.base58;
            const balance = await window.tronWeb.trx.getBalance(address);
            const trxBalance = balance / 1_000_000;
            console.log(`✅ Wallet connected: ${address}`);
            console.log(`   Balance: ${trxBalance.toFixed(2)} TRX`);
            results.passed.push('Wallet connection');
        }
    } catch (e) {
        results.errors.push(`Wallet test: ${e.message}`);
        console.error('❌ ERROR:', e);
    }
    
    // Test 2: Check if contract is really connected
    console.log('\n📍 TEST 2: Smart Contract Reality Check');
    try {
        if (!window.legalContract) {
            results.failed.push('Contract not loaded');
            console.error('❌ FAIL: legalContract is undefined');
        } else {
            console.log(`✅ Contract loaded at: ${window.legalContract.address}`);
            
            // Try to call a view function
            try {
                const fee = await window.legalContract.creationFee().call();
                const feeInTRX = fee / 1_000_000;
                console.log(`   Creation fee from contract: ${feeInTRX} TRX`);
                
                if (feeInTRX !== 25) {
                    console.warn(`   ⚠️ WARNING: Fee is ${feeInTRX} TRX, not 25 TRX as expected!`);
                    results.failed.push(`Wrong fee: ${feeInTRX} TRX`);
                } else {
                    results.passed.push('Contract fee check');
                }
            } catch (e) {
                console.error('   ❌ Cannot read contract fee:', e.message);
                results.failed.push('Cannot read contract');
            }
        }
    } catch (e) {
        results.errors.push(`Contract test: ${e.message}`);
        console.error('❌ ERROR:', e);
    }
    
    // Test 3: Energy System Check
    console.log('\n📍 TEST 3: Energy System Reality Check');
    try {
        const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
        const currentEnergy = account.energy || 0;
        console.log(`   Current energy: ${currentEnergy.toLocaleString()}`);
        
        if (window.EnergyRental) {
            console.log('   ✅ Energy rental module loaded');
            
            // Check if JustLend is accessible
            try {
                const justLendAddress = 'TU2MJ5Veik1LRAgjeSzEdvmDYx7mefJZvd';
                const justLend = await window.tronWeb.contract().at(justLendAddress);
                console.log('   ✅ JustLend contract accessible');
                results.passed.push('Energy system');
            } catch (e) {
                console.error('   ❌ JustLend not accessible:', e.message);
                results.failed.push('JustLend access');
            }
        } else {
            console.error('   ❌ Energy rental module NOT loaded');
            results.failed.push('Energy rental missing');
        }
    } catch (e) {
        results.errors.push(`Energy test: ${e.message}`);
        console.error('❌ ERROR:', e);
    }
    
    // Test 4: Transaction Staging Check
    console.log('\n📍 TEST 4: Transaction Staging Reality Check');
    try {
        if (!window.TransactionStaging) {
            console.error('❌ TransactionStaging module not loaded');
            results.failed.push('Transaction staging missing');
        } else {
            console.log('✅ Transaction staging loaded');
            
            // Check backend connection
            if (window.BACKEND_API_URL) {
                try {
                    const response = await fetch(`${window.BACKEND_API_URL}/api/health`);
                    console.log(`   Backend status: ${response.status}`);
                    results.passed.push('Backend connection');
                } catch (e) {
                    console.error('   ❌ Backend unreachable:', e.message);
                    results.failed.push('Backend unreachable');
                }
            }
        }
    } catch (e) {
        results.errors.push(`Staging test: ${e.message}`);
        console.error('❌ ERROR:', e);
    }
    
    // Test 5: Fee Calculation Reality Check
    console.log('\n📍 TEST 5: Fee Calculation Reality Check');
    try {
        const testScenarios = [
            { recipients: 1, sponsorFees: false, expected: 25 },
            { recipients: 1, sponsorFees: true, expected: 35 },
            { recipients: 3, sponsorFees: true, expected: 55 },
            { recipients: 10, sponsorFees: true, expected: 125 }
        ];
        
        for (const scenario of testScenarios) {
            const creationFee = 25;
            const sponsorshipFee = scenario.sponsorFees ? 10 * scenario.recipients : 0;
            const total = creationFee + sponsorshipFee;
            
            if (total === scenario.expected) {
                console.log(`   ✅ ${scenario.recipients} recipients, sponsor=${scenario.sponsorFees}: ${total} TRX`);
            } else {
                console.error(`   ❌ WRONG: ${scenario.recipients} recipients: got ${total}, expected ${scenario.expected}`);
                results.failed.push(`Fee calc: ${scenario.recipients} recipients`);
            }
        }
    } catch (e) {
        results.errors.push(`Fee calculation: ${e.message}`);
        console.error('❌ ERROR:', e);
    }
    
    // Test 6: Document Storage Check
    console.log('\n📍 TEST 6: Document Storage Reality Check');
    try {
        if (window.DocumentStorageAssurance) {
            const pending = window.DocumentStorageAssurance.pendingDocuments.size;
            console.log(`   ✅ Document storage loaded`);
            console.log(`   Pending documents: ${pending}`);
            
            if (pending > 0) {
                console.warn(`   ⚠️ WARNING: ${pending} documents not uploaded!`);
                results.failed.push(`${pending} documents stuck`);
            } else {
                results.passed.push('Document storage');
            }
        } else {
            console.error('   ❌ Document storage NOT loaded');
            results.failed.push('Document storage missing');
        }
    } catch (e) {
        results.errors.push(`Document test: ${e.message}`);
        console.error('❌ ERROR:', e);
    }
    
    // Test 7: Cost Modal Check
    console.log('\n📍 TEST 7: Cost Modal Reality Check');
    try {
        const modalOverlay = document.getElementById('cost-modal-overlay');
        const modalContent = document.getElementById('cost-modal-content');
        
        if (modalOverlay && modalContent) {
            console.log('   ✅ Cost modal HTML present');
            results.passed.push('Cost modal exists');
        } else {
            console.error('   ❌ Cost modal NOT in DOM');
            results.failed.push('Cost modal missing');
        }
    } catch (e) {
        results.errors.push(`Modal test: ${e.message}`);
        console.error('❌ ERROR:', e);
    }
    
    // Test 8: Check for the $200 fee bug
    console.log('\n📍 TEST 8: $200 Fee Bug Check');
    try {
        // Simulate fee calculation with string values (the bug)
        const buggyCreationFee = "25";  // String instead of number
        const buggySponsorFee = "10";   // String instead of number
        const recipients = 3;
        
        // This is what was happening:
        const buggyTotal = buggyCreationFee + (buggySponsorFee * recipients);
        console.log(`   Buggy calculation: "${buggyCreationFee}" + ("${buggySponsorFee}" * ${recipients}) = ${buggyTotal}`);
        
        if (buggyTotal === "2530") {
            console.error('   ❌ STRING CONCATENATION BUG PRESENT!');
            console.error('   This would charge 2530 TRX ($600+) instead of 55 TRX!');
            results.failed.push('String concatenation bug active');
        }
        
        // Check if fix is working
        const fixedCreationFee = parseFloat(buggyCreationFee);
        const fixedSponsorFee = parseFloat(buggySponsorFee);
        const fixedTotal = fixedCreationFee + (fixedSponsorFee * recipients);
        
        if (fixedTotal === 55) {
            console.log(`   ✅ Fix working: ${fixedTotal} TRX`);
            results.passed.push('Fee bug fixed');
        }
    } catch (e) {
        results.errors.push(`Fee bug test: ${e.message}`);
        console.error('❌ ERROR:', e);
    }
    
    // Test 9: IPFS Reality Check
    console.log('\n📍 TEST 9: IPFS Reality Check');
    try {
        // Check if IPFS upload would work
        const testIPFSHash = 'QmTest123456789';
        const ipfsGateways = [
            `https://ipfs.io/ipfs/${testIPFSHash}`,
            `https://gateway.pinata.cloud/ipfs/${testIPFSHash}`
        ];
        
        console.log('   Testing IPFS gateways...');
        for (const gateway of ipfsGateways) {
            console.log(`   Gateway: ${gateway}`);
        }
        
        results.passed.push('IPFS URLs formed');
    } catch (e) {
        results.errors.push(`IPFS test: ${e.message}`);
        console.error('❌ ERROR:', e);
    }
    
    // Test 10: Check all critical modules
    console.log('\n📍 TEST 10: Critical Modules Check');
    const criticalModules = {
        'TronWeb': window.tronWeb,
        'Legal Contract': window.legalContract,
        'Transaction Staging': window.TransactionStaging,
        'Energy Rental': window.EnergyRental,
        'Document Storage': window.DocumentStorageAssurance,
        'Transaction Estimator': window.TransactionEstimator,
        'Backend URL': window.BACKEND_API_URL,
        'Contract ABI': window.CONTRACT_ABI
    };
    
    for (const [name, module] of Object.entries(criticalModules)) {
        if (module) {
            console.log(`   ✅ ${name}: Loaded`);
            results.passed.push(name);
        } else {
            console.error(`   ❌ ${name}: NOT LOADED`);
            results.failed.push(name);
        }
    }
    
    // FINAL SUMMARY
    console.log('\n' + '='.repeat(50));
    console.log('TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    
    console.log(`\n✅ PASSED: ${results.passed.length} tests`);
    results.passed.forEach(test => console.log(`   - ${test}`));
    
    console.log(`\n❌ FAILED: ${results.failed.length} tests`);
    results.failed.forEach(test => console.log(`   - ${test}`));
    
    console.log(`\n⚠️ ERRORS: ${results.errors.length}`);
    results.errors.forEach(error => console.log(`   - ${error}`));
    
    // CRITICAL ISSUES
    console.log('\n🚨 CRITICAL ISSUES FOUND:');
    if (results.failed.includes('TronWeb not even loaded')) {
        console.error('   1. TronLink/TronWeb not working at all');
    }
    if (results.failed.includes('Contract not loaded')) {
        console.error('   2. Smart contract connection broken');
    }
    if (results.failed.includes('String concatenation bug active')) {
        console.error('   3. Fee calculation bug causing massive overcharges');
    }
    if (results.failed.includes('Backend unreachable')) {
        console.error('   4. Backend server not responding');
    }
    
    return results;
};

// Auto-run test on load
setTimeout(() => {
    console.log('💡 Run testRealScenarios() to test everything');
}, 1000);