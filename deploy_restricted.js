const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');
const solc = require('solc');
require('dotenv').config();

// Network configuration for Nile testnet
const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: process.env.TRON_PRIVATE_KEY
});

async function deployRestrictedContract() {
    try {
        // Validate environment
        if (!process.env.TRON_PRIVATE_KEY) {
            console.error('❌ TRON_PRIVATE_KEY not found in .env file');
            process.exit(1);
        }

        console.log('🌐 Deploying Restricted Contract to Nile Testnet...');
        const address = tronWeb.address.fromPrivateKey(process.env.TRON_PRIVATE_KEY);
        console.log('📍 Deploying from:', address);
        
        // Check balance
        const balance = await tronWeb.trx.getBalance(address);
        console.log('💰 Balance:', tronWeb.fromSun(balance), 'TRX\n');

        // Read and compile contract
        console.log('📚 Compiling contract...');
        const contractPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Simplified_Restricted.sol');
        const source = fs.readFileSync(contractPath, 'utf8');

        // Function to handle imports
        function findImports(importPath) {
            if (importPath.startsWith('@openzeppelin/')) {
                const filePath = path.join(__dirname, 'node_modules', importPath);
                return { contents: fs.readFileSync(filePath, 'utf8') };
            }
            return { error: 'File not found' };
        }

        // Compile configuration
        const input = {
            language: 'Solidity',
            sources: {
                'LegalNoticeNFT_Simplified_Restricted.sol': {
                    content: source
                }
            },
            settings: {
                outputSelection: {
                    '*': {
                        '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode']
                    }
                },
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        };

        // Compile
        const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
        
        if (output.errors) {
            const errors = output.errors.filter(e => e.severity === 'error');
            if (errors.length > 0) {
                console.error('❌ Compilation errors:');
                errors.forEach(err => console.error(err.formattedMessage));
                process.exit(1);
            }
        }

        const contractData = output.contracts['LegalNoticeNFT_Simplified_Restricted.sol']['LegalNoticeNFT_Simplified'];
        const bytecode = contractData.evm.bytecode.object;
        const abi = contractData.abi;
        
        // Check size
        const deployedSize = contractData.evm.deployedBytecode.object.length / 2;
        console.log(`📏 Contract size: ${deployedSize} bytes (${(deployedSize/1024).toFixed(2)} KB)`);
        console.log(`   ${deployedSize <= 24576 ? '✅' : '❌'} Size limit: 24KB (24,576 bytes)\n`);
        
        if (deployedSize > 24576) {
            console.error('❌ Contract too large for deployment!');
            console.error(`   Current: ${deployedSize} bytes`);
            console.error(`   Limit: 24,576 bytes`);
            console.error(`   Over by: ${deployedSize - 24576} bytes`);
            process.exit(1);
        }

        // Deploy
        console.log('🚀 Deploying contract...\n');
        const contract = await tronWeb.contract().new({
            abi: abi,
            bytecode: bytecode,
            feeLimit: 1500_000_000, // 1500 TRX
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000,
            parameters: []
        });

        const contractAddress = contract.address;
        console.log('✅ Contract deployed successfully!');
        console.log('📋 Contract Address:', contractAddress);
        
        // Update config
        console.log('\n📝 Updating config.js...');
        const configPath = path.join(__dirname, 'config.js');
        let config = fs.readFileSync(configPath, 'utf8');
        config = config.replace(
            /nile: '[^']*'/,
            `nile: '${contractAddress}'`
        );
        fs.writeFileSync(configPath, config);
        
        // Save deployment info
        const deploymentInfo = {
            network: 'nile',
            contractAddress: contractAddress,
            deployedAt: new Date().toISOString(),
            deployer: address,
            contractName: 'LegalNoticeNFT_Simplified_Restricted',
            contractSize: deployedSize + ' bytes',
            accessControl: 'RESTRICTED - Process Servers and Law Enforcement only'
        };
        
        fs.writeFileSync(
            path.join(__dirname, 'deployment_restricted.json'),
            JSON.stringify(deploymentInfo, null, 2)
        );

        console.log('\n🎉 Deployment complete!');
        console.log('\n📄 Contract Details:');
        console.log('   Network: Nile Testnet');
        console.log('   Address:', contractAddress);
        console.log('   Size:', deployedSize, 'bytes');
        console.log('   Access: RESTRICTED to approved users only');
        console.log('\n⚠️  IMPORTANT: This contract restricts access to:');
        console.log('   - Process Servers (PROCESS_SERVER_ROLE)');
        console.log('   - Law Enforcement (via exemptions)');
        console.log('   - Admins (ADMIN_ROLE)');
        console.log('\n💡 Next steps:');
        console.log('   1. Update index.html with the new contract address');
        console.log('   2. Grant roles to authorized users');
        console.log('   3. Test restricted access');

    } catch (error) {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    }
}

deployRestrictedContract();