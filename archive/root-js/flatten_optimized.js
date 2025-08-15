const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Flattening optimized contract for Tronscan verification...\n');

const contractPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Optimized_NoViaIR.sol');
const outputPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Optimized_Flattened.sol');

// Use the installed flattener
const command = `npx @poanet/solidity-flattener ${contractPath} > ${outputPath}`;

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Error flattening contract:', error.message);
        return;
    }
    
    if (stderr) {
        console.error('Warnings:', stderr);
    }
    
    console.log('✅ Contract flattened successfully!');
    console.log('📄 Flattened file:', outputPath);
    
    // Read and display verification instructions
    console.log('\n📋 Verification Instructions for Tronscan:\n');
    console.log('1. Go to: https://nile.tronscan.org/#/contract/TEZxBmj16pKdsJh3aDE9Y4RLSuXuBuUSp8/code');
    console.log('2. Click "Verify and Publish"');
    console.log('3. Enter these settings:');
    console.log('   - Contract Address: TEZxBmj16pKdsJh3aDE9Y4RLSuXuBuUSp8');
    console.log('   - Contract Name: LegalNoticeNFT_Optimized');
    console.log('   - Compiler Type: Solidity (Single file)');
    console.log('   - Compiler Version: v0.8.20+commit.a1b79de6 (or closest)');
    console.log('   - Open Source License: MIT');
    console.log('   - Optimization: Yes');
    console.log('   - Optimization Runs: 200');
    console.log('4. Upload file:', outputPath);
    console.log('\n✨ No Via IR setting needed!');
    console.log('\n📊 Once verified, NFTs will show properly on Tronscan with:');
    console.log('   - Total Supply tracking');
    console.log('   - Token enumeration');
    console.log('   - Full NFT visibility');
});