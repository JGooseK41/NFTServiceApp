#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 LegalNoticeNFT ViewGated Contract - Deployment Instructions\n');

// Read the contract source
const contractPath = path.join(__dirname, 'contracts/LegalNoticeNFT_ViewGated.sol');
if (!fs.existsSync(contractPath)) {
    console.error('❌ Contract file not found:', contractPath);
    process.exit(1);
}

const contractSource = fs.readFileSync(contractPath, 'utf8');

console.log('📋 Contract Information:');
console.log('- Name: LegalNoticeNFT ViewGated');
console.log('- Features: Two-tier NFT system with view-gated documents');
console.log('- Network: TRON (compatible with Nile testnet and mainnet)');
console.log('- File:', contractPath);
console.log('- Size:', Math.round(contractSource.length / 1024), 'KB');

console.log('\n🌐 Deployment Options:\n');

console.log('Option 1: TronScan Web Compiler (Recommended)');
console.log('==========================================');
console.log('1. Go to: https://nile.tronscan.org/#/contracts/contract-compiler');
console.log('2. Copy contract source from:', contractPath);
console.log('3. Compiler settings:');
console.log('   - Solidity version: 0.8.6');
console.log('   - Optimization: Enabled (200 runs)');
console.log('   - Fee limit: 1500 TRX');
console.log('4. Deploy with TronLink wallet');

console.log('\nOption 2: TronLink Pro Desktop');
console.log('==============================');
console.log('1. Open TronLink Pro');
console.log('2. Go to DApp Browser → Developer Tools');
console.log('3. Upload contract file');
console.log('4. Configure and deploy');

console.log('\nOption 3: Command Line (Advanced)');
console.log('==================================');
console.log('1. Install TronBox: npm install -g tronbox');
console.log('2. Configure tronbox.js with your private key');
console.log('3. Run: tronbox migrate --network nile');

console.log('\n📋 Post-Deployment Steps:');
console.log('========================');
console.log('1. Save contract address');
console.log('2. Update index.html with new address');
console.log('3. Test with small transaction');
console.log('4. Fund contract for fee sponsorship (optional)');

console.log('\n⚠️  Important Notes:');
console.log('===================');
console.log('- Use Nile testnet first for testing');
console.log('- Keep deployment transaction ID for records');
console.log('- Contract address will be needed in frontend');
console.log('- Ensure sufficient TRX balance (minimum 500 TRX recommended)');

console.log('\n📄 Contract Source Preview:');
console.log('============================');
console.log(contractSource.substring(0, 500) + '...\n');

console.log('💡 Tip: Copy the entire contract source from the file and paste into TronScan compiler!');
console.log('\n🎯 Ready to deploy! Choose your preferred method above.');

// Also create a simple deployment record template
const deploymentTemplate = {
    contractType: 'LegalNoticeNFT_ViewGated',
    network: 'nile', // or 'mainnet'
    contractAddress: 'UPDATE_WITH_DEPLOYED_ADDRESS',
    deployer: 'UPDATE_WITH_YOUR_ADDRESS',
    deploymentDate: new Date().toISOString(),
    features: [
        'View-gated document access',
        'Two-tier NFT system (Alert + Document)',
        'Comprehensive metadata with agency/case details',
        'Fee sponsorship for recipients',
        'Certified delivery tracking',
        'IPFS encrypted document storage'
    ],
    nextSteps: [
        'Update index.html with contract address',
        'Test with small transaction',
        'Fund contract for sponsorship pool',
        'Deploy to production'
    ]
};

// Create deployments directory
const deploymentsDir = path.join(__dirname, 'deployments');
if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
}

// Save template
const templatePath = path.join(deploymentsDir, 'deployment_template.json');
fs.writeFileSync(templatePath, JSON.stringify(deploymentTemplate, null, 2));

console.log('\n📁 Deployment template saved to:', templatePath);
console.log('   (Update this file after deployment with actual values)');