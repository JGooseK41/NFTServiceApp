const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Compile the FINAL contract
async function compileFinal() {
    console.log('Compiling LegalNoticeNFT_Final.sol...');
    
    const contractPath = './LegalNoticeNFT_Final.sol';
    const source = fs.readFileSync(contractPath, 'utf8');
    
    const input = {
        language: 'Solidity',
        sources: {
            'LegalNoticeNFT_Final.sol': {
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
    
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
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
    
    const contract = output.contracts['LegalNoticeNFT_Final.sol']['LegalNoticeNFT'];
    
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
        contractName: 'LegalNoticeNFT_Final'
    };
    
    fs.writeFileSync(
        path.join(buildDir, 'LegalNoticeNFT_Final.json'),
        JSON.stringify(contractData, null, 2)
    );
    
    console.log('✅ Compilation successful!');
    console.log('✅ Contract saved to: ./build/LegalNoticeNFT_Final.json');
    console.log(`✅ Contract size: ${Math.round(contract.evm.bytecode.object.length / 2)} bytes`);
    
    return contractData;
}

compileFinal().catch(console.error);