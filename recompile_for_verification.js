const fs = require('fs');
const path = require('path');
const solc = require('solc');

console.log('🔧 Recompiling with different settings for Tronscan verification\n');

const contractPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Optimized_NoViaIR.sol');
const source = fs.readFileSync(contractPath, 'utf8');

// Try multiple compiler configurations
const configurations = [
    {
        name: 'Config 1: Standard optimization',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            evmVersion: 'petersburg'
        }
    },
    {
        name: 'Config 2: High optimization',
        settings: {
            optimizer: {
                enabled: true,
                runs: 999999
            },
            evmVersion: 'istanbul'
        }
    },
    {
        name: 'Config 3: Default EVM',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
            // No evmVersion specified
        }
    },
    {
        name: 'Config 4: Minimal optimization',
        settings: {
            optimizer: {
                enabled: true,
                runs: 1
            },
            evmVersion: 'berlin'
        }
    }
];

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

configurations.forEach((config, index) => {
    console.log(`\n${config.name}:`);
    console.log('='.repeat(50));
    
    const input = {
        language: 'Solidity',
        sources: {
            'LegalNoticeNFT_Optimized_NoViaIR.sol': {
                content: source
            }
        },
        settings: {
            ...config.settings,
            outputSelection: {
                '*': {
                    '*': ['*']
                }
            }
        }
    };
    
    try {
        const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
        
        if (output.contracts && output.contracts['LegalNoticeNFT_Optimized_NoViaIR.sol']) {
            const contract = output.contracts['LegalNoticeNFT_Optimized_NoViaIR.sol']['LegalNoticeNFT_Optimized'];
            const bytecode = contract.evm.bytecode.object;
            
            console.log('✅ Compilation successful');
            console.log(`   Bytecode starts with: ${bytecode.substring(0, 20)}`);
            console.log(`   Size: ${bytecode.length / 2} bytes`);
            console.log('\nTry these settings on Tronscan:');
            console.log(`   Contract Name: LegalNoticeNFT_Optimized`);
            console.log(`   Optimization: ${config.settings.optimizer.enabled ? 'Yes' : 'No'}`);
            console.log(`   Runs: ${config.settings.optimizer.runs}`);
            if (config.settings.evmVersion) {
                console.log(`   EVM Version: ${config.settings.evmVersion}`);
            }
        }
    } catch (error) {
        console.log('❌ Compilation failed:', error.message);
    }
});

console.log('\n\n📝 IMPORTANT FOR RECIPIENT TRUST:\n');
console.log('If Tronscan verification continues to fail, you can still build trust by:');
console.log('\n1. Adding contract info to your website/app:');
console.log('   - Display "Source Code Available on GitHub"');
console.log('   - Link to the contract source');
console.log('   - Show deployment transaction');
console.log('\n2. Include verification info in NFT metadata:');
console.log('   - Add GitHub link in token description');
console.log('   - Reference your official website');
console.log('\n3. Create a verification page:');
console.log('   - Host a page explaining the contract');
console.log('   - Include audit information if available');
console.log('   - Provide contact information');

// Also check if we're using the right contract name in the source
console.log('\n\n🔍 Double-checking contract declaration:');
const contractNameMatch = source.match(/contract\s+(\w+)\s+is/);
if (contractNameMatch) {
    console.log(`   Contract name in source: ${contractNameMatch[1]}`);
    console.log(`   ✅ Use this EXACT name in Tronscan: ${contractNameMatch[1]}`);
}