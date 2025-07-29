const fs = require('fs');
const path = require('path');
const solc = require('solc');

console.log('📋 Contract Verification Information\n');

// Get exact solc version
console.log('Compiler Version:', solc.version());

// Read contract to check pragma
const contractPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Optimized_NoViaIR.sol');
const source = fs.readFileSync(contractPath, 'utf8');

// Extract pragma version
const pragmaMatch = source.match(/pragma solidity ([\^~>=<]*)(\d+\.\d+\.\d+);/);
if (pragmaMatch) {
    console.log('Pragma Version:', pragmaMatch[0]);
}

console.log('\n✅ Verification Parameters:');
console.log('1. Contract Address: TEZxBmj16pKdsJh3aDE9Y4RLSuXuBuUSp8');
console.log('2. Contract Name: LegalNoticeNFT_Optimized');
console.log('3. Compiler Type: Solidity (Single file)');
console.log('4. Compiler Version: Use the exact version from Tronscan dropdown that matches', solc.version());
console.log('5. Open Source License Type: MIT');
console.log('6. Optimization Enabled: Yes');
console.log('7. Optimization Runs: 200');
console.log('8. Constructor Arguments ABI-encoded: (empty - no constructor args)');

console.log('\n📄 Files:');
console.log('- Flattened contract: ./out/LegalNoticeNFT_Optimized_NoViaIR_flat.sol');

console.log('\n⚠️  Important:');
console.log('- Make sure "EVM Version" is set to default or "petersburg"');
console.log('- Do NOT enable "Via IR"');
console.log('- The contract name must be exactly: LegalNoticeNFT_Optimized');
console.log('- If the exact compiler version is not available, try the closest one');

// Try to read any deployment logs
try {
    const deploymentInfo = JSON.parse(fs.readFileSync('./deployment_optimized_enumerable.json', 'utf8'));
    console.log('\n📊 Deployment Info:');
    console.log('- Deployed at:', deploymentInfo.deployedAt);
    console.log('- Contract size:', deploymentInfo.contractSize);
} catch (e) {
    // Ignore if not found
}