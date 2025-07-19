#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the ViewGated contract
const contractPath = path.join(__dirname, 'contracts/LegalNoticeNFT_ViewGated.sol');
const contractSource = fs.readFileSync(contractPath, 'utf8');

console.log('📋 ViewGated Contract Source (ready to copy):');
console.log('='.repeat(80));
console.log(contractSource);
console.log('='.repeat(80));
console.log('\n🚀 Quick Deployment Steps:');
console.log('1. Select all the contract source above');
console.log('2. Copy it (Ctrl+C)');
console.log('3. Open: https://nile.tronscan.org/#/contracts/contract-compiler');
console.log('4. Paste the contract source');
console.log('5. Set compiler to 0.8.6 with optimization enabled');
console.log('6. Deploy with 1500 TRX fee limit');
console.log('7. Save the contract address when deployment completes');

console.log('\n📝 After deployment:');
console.log('Update index.html with the new contract address in the chain config.');