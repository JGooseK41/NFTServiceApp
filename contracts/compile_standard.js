const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Read contract and dependencies
function findImports(importPath) {
    try {
        // Handle OpenZeppelin imports
        if (importPath.startsWith('@openzeppelin/')) {
            const ozPath = path.join(__dirname, 'node_modules', importPath);
            const content = fs.readFileSync(ozPath, 'utf8');
            return { contents: content };
        }
        // Handle local imports
        const contractPath = path.join(__dirname, importPath);
        const content = fs.readFileSync(contractPath, 'utf8');
        return { contents: content };
    } catch (e) {
        return { error: 'File not found' };
    }
}

// Compile the standard contract
async function compileStandard() {
    console.log('Compiling LegalNoticeNFT.sol with OpenZeppelin dependencies...');
    
    const contractPath = './LegalNoticeNFT.sol';
    const source = fs.readFileSync(contractPath, 'utf8');
    
    const input = {
        language: 'Solidity',
        sources: {
            'LegalNoticeNFT.sol': {
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
    
    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
    
    if (output.errors) {
        let hasErrors = false;
        output.errors.forEach(error => {
            console.log(`${error.severity}: ${error.message}`);
            if (error.severity === 'error') hasErrors = true;
        });
        if (hasErrors) {
            throw new Error('Compilation failed');
        }
    }
    
    const contract = output.contracts['LegalNoticeNFT.sol']['LegalNoticeNFT'];
    
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
        path.join(buildDir, 'LegalNoticeNFT_Standard.json'),
        JSON.stringify(contractData, null, 2)
    );
    
    console.log('✅ Compilation successful!');
    console.log('✅ Contract saved to: ./build/LegalNoticeNFT_Standard.json');
    console.log(`✅ Contract size: ${Math.round(contract.evm.bytecode.object.length / 2)} bytes`);
    
    return contractData;
}

compileStandard().catch(console.error);