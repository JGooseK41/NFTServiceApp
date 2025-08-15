const fs = require('fs');
const path = require('path');
const solc = require('solc');

// Compile test contract with enumerable
const testSource = fs.readFileSync(path.join(__dirname, 'contracts', 'LegalNoticeNFT_Enumerable_Test.sol'), 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'LegalNoticeNFT_Enumerable_Test.sol': {
            content: testSource
        }
    },
    settings: {
        optimizer: {
            enabled: true,
            runs: 10
        },
        viaIR: true,
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

console.log('Compiling test contract with ERC721Enumerable...');
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors) {
    console.log('\nCompilation warnings/errors:');
    output.errors.forEach(err => {
        console.log(`- ${err.severity}: ${err.message}`);
    });
}

// Check size
const contract = output.contracts['LegalNoticeNFT_Enumerable_Test.sol']['LegalNoticeNFT_Enumerable_Test'];
if (contract && contract.evm && contract.evm.bytecode) {
    const bytecode = contract.evm.bytecode.object;
    const sizeInBytes = bytecode.length / 2;
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);
    const limit = 24576; // 24KB
    
    console.log('\n=== Size Analysis with ERC721Enumerable ===');
    console.log(`Test contract size: ${sizeInBytes} bytes (${sizeInKB} KB)`);
    console.log(`Current hybrid size: 24,499 bytes (23.92 KB)`);
    console.log(`Size increase: ~${Math.round(sizeInBytes - 24499)} bytes`);
    console.log(`24KB limit: ${limit} bytes`);
    console.log(`Would exceed limit: ${sizeInBytes > limit ? 'YES ❌' : 'NO ✅'}`);
    
    if (sizeInBytes > limit) {
        console.log(`\nOver limit by: ${sizeInBytes - limit} bytes`);
        console.log('\nERC721Enumerable adds approximately:');
        console.log('- totalSupply() function');
        console.log('- tokenByIndex() function');
        console.log('- tokenOfOwnerByIndex() function');
        console.log('- Additional storage mappings for enumeration');
        console.log('- Extra logic in _beforeTokenTransfer');
    }
}