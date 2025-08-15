const fs = require('fs');
const path = require('path');

console.log('🔧 Creating clean flattened contract...\n');

// Read the current flattened file
const flatPath = path.join(__dirname, 'out', 'LegalNoticeNFT_Optimized_NoViaIR_flat.sol');
let content = fs.readFileSync(flatPath, 'utf8');

// Clean up the file
// 1. Remove duplicate pragma statements
content = content.replace(/pragma solidity.*\n/g, (match, offset) => {
    // Keep only the first pragma
    return offset === content.indexOf(match) ? match : '';
});

// 2. Remove duplicate SPDX license identifiers (keep only the first)
let firstSPDX = true;
content = content.replace(/\/\/ SPDX-License-Identifier:.*\n/g, (match) => {
    if (firstSPDX) {
        firstSPDX = false;
        return match;
    }
    return '';
});

// 3. Remove excessive blank lines
content = content.replace(/\n\n\n+/g, '\n\n');

// 4. Ensure contract starts properly
if (!content.startsWith('// SPDX-License-Identifier:')) {
    content = '// SPDX-License-Identifier: MIT\n' + content;
}

// Save clean version
const cleanPath = path.join(__dirname, 'LegalNoticeNFT_Optimized_Clean.sol');
fs.writeFileSync(cleanPath, content);

console.log('✅ Created clean flattened file:', cleanPath);
console.log('\nVerification Settings for Tronscan:');
console.log('================================');
console.log('Contract Address: TEZxBmj16pKdsJh3aDE9Y4RLSuXuBuUSp8');
console.log('Contract Name: LegalNoticeNFT_Optimized');
console.log('Compiler: v0.8.20+commit.a1b79de6');
console.log('License: MIT');
console.log('Optimization: Yes');
console.log('Runs: 200');
console.log('\nIMPORTANT: If verification still fails, try:');
console.log('1. Compiler v0.8.19 or v0.8.21');
console.log('2. EVM Version: "petersburg" or "istanbul"');
console.log('3. Make sure no library addresses are specified');