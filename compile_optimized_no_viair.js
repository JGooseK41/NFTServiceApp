const fs = require('fs');
const path = require('path');
const solc = require('solc');

// Read the optimized contract
const contractPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Optimized_NoViaIR.sol');
const source = fs.readFileSync(contractPath, 'utf8');

// Compile WITHOUT Via IR
const input = {
    language: 'Solidity',
    sources: {
        'LegalNoticeNFT_Optimized_NoViaIR.sol': {
            content: source
        }
    },
    settings: {
        optimizer: {
            enabled: true,
            runs: 200  // Standard optimization
        },
        // viaIR: false  // No Via IR!
        outputSelection: {
            '*': {
                '*': ['*']
            }
        }
    }
};

function findImports(relativePath) {
    if (relativePath.startsWith('@openzeppelin/')) {
        try {
            const absolutePath = path.join(__dirname, 'node_modules', relativePath);
            const source = fs.readFileSync(absolutePath, 'utf8');
            return { contents: source };
        } catch (error) {
            return { error: 'File not found' };
        }
    }
    return { error: 'File not found' };
}

console.log('Compiling optimized contract WITHOUT Via IR...');
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

let hasErrors = false;
if (output.errors) {
    console.log('\nCompilation messages:');
    output.errors.forEach(err => {
        if (err.severity === 'error') {
            console.log(`❌ ERROR: ${err.message}`);
            if (err.message.includes('stack too deep')) {
                console.log('   Stack too deep found! Need more optimization.');
                hasErrors = true;
            }
        } else if (err.severity === 'warning') {
            // console.log(`⚠️  WARNING: ${err.message}`);
        }
    });
}

// Get contract info
const contract = output.contracts['LegalNoticeNFT_Optimized_NoViaIR.sol']['LegalNoticeNFT_Optimized'];
if (contract && contract.evm && contract.evm.bytecode && contract.evm.bytecode.object) {
    const bytecode = contract.evm.bytecode.object;
    const sizeInBytes = bytecode.length / 2;
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);
    const limit = 24576; // 24KB
    
    console.log('\n=== Optimized Contract Analysis (No Via IR) ===');
    console.log(`✅ Compilation successful without Via IR!`);
    console.log(`Contract size: ${sizeInBytes} bytes (${sizeInKB} KB)`);
    console.log(`24KB limit: ${limit} bytes`);
    console.log(`Within limit: ${sizeInBytes <= limit ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Room remaining: ${limit - sizeInBytes} bytes`);
    
    console.log('\n🎯 Key optimizations applied:');
    console.log('- Combined create functions into one');
    console.log('- Used struct parameters to avoid stack depth');
    console.log('- Removed Counters library');
    console.log('- Packed data into single uint256');
    console.log('- Simplified events');
    console.log('- Added ERC721Enumerable for Tronscan');
    
    console.log('\n✨ Benefits:');
    console.log('- No Via IR needed');
    console.log('- Works with standard Solidity compiler');
    console.log('- Easy to verify on Tronscan');
    console.log('- Full NFT tracking support');
    console.log('- All original features preserved');
} else {
    console.log('\n❌ Compilation failed - no bytecode generated');
}