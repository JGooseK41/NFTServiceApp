const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Read the contract
const contractPath = path.join(__dirname, 'LegalNoticeNFT_Complete.sol');
const source = fs.readFileSync(contractPath, 'utf8');

// Compile settings
const input = {
    language: 'Solidity',
    sources: {
        'LegalNoticeNFT_Complete.sol': {
            content: source
        }
    },
    settings: {
        optimizer: {
            enabled: true,
            runs: 200
        },
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode.object']
            }
        }
    }
};

console.log('Compiling LegalNoticeNFT_Complete.sol...');

const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Check for errors
if (output.errors) {
    output.errors.forEach(error => {
        console.error(error.formattedMessage);
    });
    if (output.errors.some(error => error.severity === 'error')) {
        process.exit(1);
    }
}

// Extract contract data
const contract = output.contracts['LegalNoticeNFT_Complete.sol']['LegalNoticeNFT_Complete'];
const abi = contract.abi;
const bytecode = contract.evm.bytecode.object;

// Save ABI and bytecode
fs.writeFileSync('LegalNoticeNFT_Complete.abi', JSON.stringify(abi, null, 2));
fs.writeFileSync('LegalNoticeNFT_Complete.bin', bytecode);

console.log('Compilation successful!');
console.log('ABI saved to: LegalNoticeNFT_Complete.abi');
console.log('Bytecode saved to: LegalNoticeNFT_Complete.bin');