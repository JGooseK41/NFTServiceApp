const fs = require('fs');
const path = require('path');
const solc = require('solc');
const TronWeb = require('tronweb');

async function compileForMainnet() {
    console.log('=== Compiling LegalNoticeNFT v5 for Mainnet ===\n');
    
    try {
        // Read the main contract
        const contractPath = path.join(__dirname, 'v5', 'LegalNoticeNFT_v5_Enumerable.sol');
        const contractSource = fs.readFileSync(contractPath, 'utf8');
        
        // Prepare input for compiler
        const input = {
            language: 'Solidity',
            sources: {
                'LegalNoticeNFT_v5_Enumerable.sol': {
                    content: contractSource
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
        
        // Import callback for OpenZeppelin contracts
        function findImports(importPath) {
            try {
                // Try node_modules first
                const nodeModulesPath = path.join(__dirname, 'node_modules', importPath);
                if (fs.existsSync(nodeModulesPath)) {
                    return {
                        contents: fs.readFileSync(nodeModulesPath, 'utf8')
                    };
                }
                
                // Try relative path
                const relativePath = path.join(path.dirname(contractPath), importPath);
                if (fs.existsSync(relativePath)) {
                    return {
                        contents: fs.readFileSync(relativePath, 'utf8')
                    };
                }
                
                return { error: 'File not found: ' + importPath };
            } catch (error) {
                return { error: error.message };
            }
        }
        
        console.log('🔨 Compiling contract...');
        const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
        
        // Check for errors
        if (output.errors) {
            const errors = output.errors.filter(e => e.severity === 'error');
            if (errors.length > 0) {
                console.error('❌ Compilation errors:');
                errors.forEach(err => console.error(err.formattedMessage));
                process.exit(1);
            }
            
            // Show warnings
            const warnings = output.errors.filter(e => e.severity === 'warning');
            if (warnings.length > 0) {
                console.log('⚠️  Warnings:');
                warnings.forEach(warn => console.log(warn.formattedMessage));
            }
        }
        
        // Extract contract data
        const contract = output.contracts['LegalNoticeNFT_v5_Enumerable.sol']['LegalNoticeNFT_v5_Enumerable'];
        
        if (!contract) {
            throw new Error('Contract not found in compilation output');
        }
        
        const bytecode = contract.evm.bytecode.object;
        const abi = contract.abi;
        
        // Calculate contract size
        const contractSize = bytecode.length / 2; // hex string to bytes
        const contractSizeKB = (contractSize / 1024).toFixed(2);
        
        console.log('\n✅ Compilation successful!');
        console.log(`📏 Contract size: ${contractSizeKB} KB`);
        
        if (contractSize > 24576) { // 24KB limit
            console.error('❌ ERROR: Contract too large! Maximum is 24KB');
            console.error(`   Current size: ${contractSizeKB} KB`);
            process.exit(1);
        }
        
        // Save outputs
        const outputDir = path.join(__dirname, 'v5');
        
        // Save bytecode
        const bytecodePath = path.join(outputDir, 'LegalNoticeNFT_v5_Enumerable.bin');
        fs.writeFileSync(bytecodePath, bytecode);
        console.log('📁 Bytecode saved to:', bytecodePath);
        
        // Save ABI (formatted)
        const abiPath = path.join(outputDir, 'LegalNoticeNFT_v5_Enumerable.abi');
        fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
        console.log('📁 ABI saved to:', abiPath);
        
        // Save compilation info
        const infoPath = path.join(outputDir, 'compilation_info.json');
        fs.writeFileSync(infoPath, JSON.stringify({
            compiler: solc.version(),
            optimization: {
                enabled: true,
                runs: 200
            },
            contractSize: contractSizeKB + ' KB',
            compiledAt: new Date().toISOString()
        }, null, 2));
        console.log('📁 Compilation info saved to:', infoPath);
        
        console.log('\n✅ Ready for mainnet deployment!');
        console.log('   Run: node deploy_v5_mainnet.js');
        
    } catch (error) {
        console.error('❌ Compilation failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Run compilation
compileForMainnet().catch(console.error);