const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Read the contract source code
const contractPath = './LegalNoticeNFT_TRON.sol';
const source = fs.readFileSync(contractPath, 'utf8');

// Compile input format
const input = {
    language: 'Solidity',
    sources: {
        'LegalNoticeNFT_TRON.sol': {
            content: source
        }
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['*']
            }
        },
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
};

console.log('Compiling LegalNoticeNFT_TRON.sol...');

try {
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
    if (output.errors) {
        console.log('Compilation warnings/errors:');
        output.errors.forEach(error => {
            console.log(`${error.severity}: ${error.message}`);
        });
    }
    
    if (output.contracts && output.contracts['LegalNoticeNFT_TRON.sol']) {
        const contract = output.contracts['LegalNoticeNFT_TRON.sol']['LegalNoticeNFT'];
        
        // Create build directory
        const buildDir = './build';
        if (!fs.existsSync(buildDir)) {
            fs.mkdirSync(buildDir, { recursive: true });
        }
        
        // Save compilation output
        const contractData = {
            abi: contract.abi,
            bytecode: contract.evm.bytecode.object,
            deployedBytecode: contract.evm.deployedBytecode.object,
            sourcePath: contractPath,
            contractName: 'LegalNoticeNFT'
        };
        
        fs.writeFileSync(
            path.join(buildDir, 'LegalNoticeNFT_TRON.json'),
            JSON.stringify(contractData, null, 2)
        );
        
        console.log('✅ Compilation successful!');
        console.log('✅ Contract saved to: ./build/LegalNoticeNFT_TRON.json');
        console.log(`✅ Contract size: ${Math.round(contract.evm.bytecode.object.length / 2)} bytes`);
        
    } else {
        console.error('❌ No contract output generated');
        console.log('Available contracts:', Object.keys(output.contracts || {}));
    }
    
} catch (error) {
    console.error('❌ Compilation failed:', error.message);
}