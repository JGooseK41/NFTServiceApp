const fs = require('fs');
const path = require('path');
const solc = require('solc');

// Read the contract
const contractPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Simplified.sol');
const source = fs.readFileSync(contractPath, 'utf8');

// Prepare input for solc
const input = {
    language: 'Solidity',
    sources: {
        'LegalNoticeNFT_Simplified.sol': {
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

// Function to find imports
function findImports(relativePath) {
    // Handle OpenZeppelin imports
    if (relativePath.startsWith('@openzeppelin/')) {
        try {
            const absolutePath = path.join(__dirname, 'node_modules', relativePath);
            const source = fs.readFileSync(absolutePath, 'utf8');
            return { contents: source };
        } catch (error) {
            return { error: 'File not found' };
        }
    }
    
    // Handle local imports
    try {
        const absolutePath = path.resolve(path.dirname(contractPath), relativePath);
        const source = fs.readFileSync(absolutePath, 'utf8');
        return { contents: source };
    } catch (error) {
        return { error: 'File not found' };
    }
}

// Compile
console.log('Compiling contract...');
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

// Check for errors
if (output.errors) {
    output.errors.forEach((err) => {
        if (err.severity === 'error') {
            console.error('Error:', err.formattedMessage);
        } else {
            console.warn('Warning:', err.formattedMessage);
        }
    });
    
    if (output.errors.some(err => err.severity === 'error')) {
        console.error('Compilation failed!');
        process.exit(1);
    }
}

// Extract the contract
const contract = output.contracts['LegalNoticeNFT_Simplified.sol']['LegalNoticeNFT_Simplified'];

// Save the output
const outputDir = path.join(__dirname, 'build', 'contracts');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const artifact = {
    contractName: 'LegalNoticeNFT_Simplified',
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object,
    deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
    compiler: {
        name: 'solc',
        version: solc.version()
    },
    networks: {}
};

fs.writeFileSync(
    path.join(outputDir, 'LegalNoticeNFT_Simplified.json'),
    JSON.stringify(artifact, null, 2)
);

console.log('✅ Compilation successful!');
console.log(`📄 Output saved to: ${path.join(outputDir, 'LegalNoticeNFT_Simplified.json')}`);
console.log(`📊 Contract size: ${contract.evm.bytecode.object.length / 2} bytes`);