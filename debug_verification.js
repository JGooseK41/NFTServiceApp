const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io'
});

async function debugVerification() {
    console.log('🔍 Debugging Contract Verification\n');
    
    const contractAddress = 'TEZxBmj16pKdsJh3aDE9Y4RLSuXuBuUSp8';
    
    // Get deployed bytecode from blockchain
    console.log('1. Getting deployed bytecode from blockchain...');
    try {
        const deployedCode = await tronWeb.trx.getContract(contractAddress);
        console.log('✅ Contract found on blockchain');
        console.log('   Bytecode length:', deployedCode.bytecode ? deployedCode.bytecode.length : 'unknown');
        
        // Try to recompile with exact same settings
        console.log('\n2. Recompiling contract with same settings...');
        const contractPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Optimized_NoViaIR.sol');
        const source = fs.readFileSync(contractPath, 'utf8');
        
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
                    runs: 200
                },
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
        
        const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
        
        if (output.contracts && output.contracts['LegalNoticeNFT_Optimized_NoViaIR.sol']) {
            const contract = output.contracts['LegalNoticeNFT_Optimized_NoViaIR.sol']['LegalNoticeNFT_Optimized'];
            console.log('✅ Recompilation successful');
            console.log('   Bytecode length:', contract.evm.bytecode.object.length);
            
            // Compare first few bytes
            if (deployedCode.bytecode) {
                const deployedStart = deployedCode.bytecode.substring(0, 20);
                const compiledStart = contract.evm.bytecode.object.substring(0, 20);
                console.log('\n3. Bytecode comparison:');
                console.log('   Deployed starts with:', deployedStart);
                console.log('   Compiled starts with:', compiledStart);
                console.log('   Match:', deployedStart === compiledStart ? 'YES ✅' : 'NO ❌');
            }
        }
        
        console.log('\n4. Verification checklist:');
        console.log('   ✓ Contract name: LegalNoticeNFT_Optimized');
        console.log('   ✓ Compiler: v0.8.20+commit.a1b79de6');
        console.log('   ✓ Optimization: Enabled');
        console.log('   ✓ Runs: 200');
        console.log('   ✓ EVM Version: default');
        console.log('   ✓ License: MIT');
        
        console.log('\n5. Alternative approaches:');
        console.log('   - Try compiler v0.8.19 or v0.8.21');
        console.log('   - Try optimization runs: 999999 (if UI was configured differently)');
        console.log('   - Check if "evmVersion" needs to be set to "istanbul" or "berlin"');
        console.log('   - Try with libraries section empty');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugVerification();