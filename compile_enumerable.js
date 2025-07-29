const fs = require('fs');
const path = require('path');
const solc = require('solc');

// Read the enumerable contract
const contractPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Hybrid_Enumerable.sol');
const source = fs.readFileSync(contractPath, 'utf8');

// Same compiler settings as original
const input = {
    language: 'Solidity',
    sources: {
        'LegalNoticeNFT_Hybrid_Enumerable.sol': {
            content: source
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
    
    try {
        const absolutePath = path.resolve(path.dirname(contractPath), relativePath);
        const source = fs.readFileSync(absolutePath, 'utf8');
        return { contents: source };
    } catch (error) {
        return { error: 'File not found' };
    }
}

console.log('Compiling LegalNoticeNFT_Hybrid_Enumerable...');
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors) {
    console.log('\nCompilation warnings/errors:');
    output.errors.forEach(err => {
        if (err.severity === 'error') {
            console.log(`❌ ${err.severity}: ${err.message}`);
        }
    });
}

// Get contract info
const contract = output.contracts['LegalNoticeNFT_Hybrid_Enumerable.sol']['LegalNoticeNFT_Hybrid_Enumerable'];
if (contract && contract.evm && contract.evm.bytecode) {
    const bytecode = contract.evm.bytecode.object;
    const sizeInBytes = bytecode.length / 2;
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);
    const limit = 24576; // 24KB
    
    console.log('\n=== Contract Size Analysis ===');
    console.log(`Current Hybrid (without Enumerable): 24,499 bytes (23.92 KB)`);
    console.log(`With Enumerable: ${sizeInBytes} bytes (${sizeInKB} KB)`);
    console.log(`Size increase: ${sizeInBytes - 24499} bytes`);
    console.log(`24KB limit: ${limit} bytes`);
    console.log(`Within limit: ${sizeInBytes <= limit ? 'YES ✅' : 'NO ❌'}`);
    
    if (sizeInBytes > limit) {
        console.log(`\nOver limit by: ${sizeInBytes - limit} bytes`);
        console.log('\n🚨 Adding ERC721Enumerable would exceed the 24KB limit!');
        console.log('\nOptions:');
        console.log('1. Remove some features to make room');
        console.log('2. Implement minimal tracking functions manually');
        console.log('3. Deploy as-is without Tronscan NFT tracking');
    } else {
        console.log(`\n✅ Room remaining: ${limit - sizeInBytes} bytes`);
        console.log('\nEnumerable adds:');
        console.log('- totalSupply() - tracks total NFT count');
        console.log('- tokenByIndex() - get token ID by index');
        console.log('- tokenOfOwnerByIndex() - get user\'s token by index');
        console.log('- Automatic tracking in mint/burn/transfer');
    }
    
    // Save size info
    const sizeInfo = {
        contractName: 'LegalNoticeNFT_Hybrid_Enumerable',
        currentSize: 24499,
        withEnumerable: sizeInBytes,
        sizeIncrease: sizeInBytes - 24499,
        sizeInKB: sizeInKB,
        limit: limit,
        withinLimit: sizeInBytes <= limit,
        enumerableFunctions: [
            'totalSupply()',
            'tokenByIndex(uint256)',
            'tokenOfOwnerByIndex(address, uint256)'
        ]
    };
    
    fs.writeFileSync(
        path.join(__dirname, 'contracts', 'enumerable_size_analysis.json'),
        JSON.stringify(sizeInfo, null, 2)
    );
}