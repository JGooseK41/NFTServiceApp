const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

console.log('🔍 Legal Service NFT Deployment Checker\n');

// Check environment variables
console.log('1️⃣  Checking Environment Variables...');
const privateKey = process.env.TRON_PRIVATE_KEY;
const feeCollector = process.env.FEE_COLLECTOR;

if (!privateKey) {
    console.log('❌ TRON_PRIVATE_KEY not set');
    console.log('\n📝 HOW TO SET YOUR PRIVATE KEY:');
    console.log('────────────────────────────────────────');
    console.log('Option 1: In your terminal, run:');
    console.log('export TRON_PRIVATE_KEY="your_private_key_here"');
    console.log('\nOption 2: Create a .env file (see instructions below)');
} else {
    console.log('✅ TRON_PRIVATE_KEY is set');
    // Show partial key for verification
    console.log(`   Key starts with: ${privateKey.substring(0, 6)}...`);
}

if (!feeCollector) {
    console.log('⚠️  FEE_COLLECTOR not set (will use your deployer address)');
} else {
    console.log('✅ FEE_COLLECTOR is set:', feeCollector);
}

// Check TronBox installation
console.log('\n2️⃣  Checking TronBox Installation...');
try {
    const { execSync } = require('child_process');
    const tronboxVersion = execSync('tronbox --version', { encoding: 'utf8' });
    console.log('✅ TronBox installed:', tronboxVersion.trim());
} catch (error) {
    console.log('❌ TronBox not found. Install with: npm install -g tronbox');
}

// Check contract file
console.log('\n3️⃣  Checking Contract File...');
const contractPath = path.join(__dirname, 'contracts', 'LegalServiceNFT.sol');
if (fs.existsSync(contractPath)) {
    console.log('✅ Contract file found');
} else {
    console.log('❌ Contract file not found at:', contractPath);
}

// Check compilation
console.log('\n4️⃣  Checking Contract Compilation...');
const buildPath = path.join(__dirname, 'build', 'contracts', 'LegalServiceNFT.json');
if (fs.existsSync(buildPath)) {
    console.log('✅ Contract compiled');
} else {
    console.log('❌ Contract not compiled. Run: tronbox compile');
}

// If private key is set, check wallet balance
if (privateKey) {
    console.log('\n5️⃣  Checking Wallet Balance...');
    checkBalance(privateKey).then(balance => {
        if (balance < 1000) {
            console.log(`❌ Insufficient balance: ${balance} TRX (need 1000+ TRX)`);
            console.log('   Get test TRX from: https://nileex.io/join/getJoinPage');
        } else {
            console.log(`✅ Sufficient balance: ${balance} TRX`);
        }
        
        // Final summary
        showSummary();
    }).catch(error => {
        console.log('❌ Error checking balance:', error.message);
        showSummary();
    });
} else {
    showSummary();
}

async function checkBalance(privateKey) {
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: privateKey
    });
    
    const address = tronWeb.address.fromPrivateKey(privateKey);
    const balance = await tronWeb.trx.getBalance(address);
    return parseFloat(tronWeb.fromSun(balance));
}

function showSummary() {
    console.log('\n' + '═'.repeat(50));
    console.log('📋 DEPLOYMENT READINESS SUMMARY');
    console.log('═'.repeat(50));
    
    const ready = privateKey && fs.existsSync(buildPath);
    
    if (ready) {
        console.log('\n✅ Ready to deploy! Run:');
        console.log('   node deploy_legal_service_v2.js');
    } else {
        console.log('\n❌ Not ready to deploy. Complete the steps above.');
    }
    
    console.log('\n💡 QUICK SETUP GUIDE:');
    console.log('────────────────────────────────────────');
    console.log('1. Get your private key from TronLink');
    console.log('2. Set environment variables (see below)');
    console.log('3. Get test TRX from faucet');
    console.log('4. Run: tronbox compile');
    console.log('5. Run: node deploy_legal_service_v2.js');
    console.log('\n');
}