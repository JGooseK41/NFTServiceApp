const fs = require('fs');
const path = require('path');
const solc = require('solc');
const TronWeb = require('tronweb');
const CONFIG = require('./config');

async function deployOptimizedContract() {
    console.log('🚀 Deploying Optimized Legal Notice NFT Contract...');
    console.log('   Features: Enhanced Metadata + Batch Operations + ERC721Enumerable');
    console.log('   No Via IR Required!\n');

    // Initialize TronWeb
    const tronWeb = new TronWeb({
        fullHost: CONFIG.networks[CONFIG.network].url,
        privateKey: CONFIG.deployerPrivateKey
    });

    // Compile the optimized contract
    console.log('📦 Compiling optimized contract...');
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

    if (output.errors && output.errors.some(err => err.severity === 'error')) {
        console.error('❌ Compilation failed!');
        output.errors.forEach(err => {
            if (err.severity === 'error') {
                console.error(err.formattedMessage);
            }
        });
        return;
    }

    const contract = output.contracts['LegalNoticeNFT_Optimized_NoViaIR.sol']['LegalNoticeNFT_Optimized'];
    const bytecode = contract.evm.bytecode.object;
    const abi = contract.abi;

    // Check size
    const sizeInBytes = bytecode.length / 2;
    console.log(`✅ Contract size: ${sizeInBytes} bytes (${(sizeInBytes/1024).toFixed(2)} KB)`);
    console.log(`   Well under 24KB limit!\n`);

    // Save ABI
    const abiPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Optimized.abi');
    fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
    console.log('💾 ABI saved to:', abiPath);

    // Deploy
    console.log('\n🔄 Deploying to', CONFIG.network, 'network...');
    console.log('   From address:', tronWeb.address.fromPrivateKey(CONFIG.deployerPrivateKey));

    try {
        const deployOptions = {
            abi: abi,
            bytecode: bytecode,
            feeLimit: 1500000000, // 1500 TRX
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10000000,
            parameters: []
        };

        const contractInstance = await tronWeb.contract().new(deployOptions);
        const contractAddress = tronWeb.address.fromHex(contractInstance.address);

        console.log('\n✅ Contract deployed successfully!');
        console.log('   Address:', contractAddress);
        console.log('   Hex Address:', contractInstance.address);

        // Save deployment info
        const deploymentInfo = {
            network: CONFIG.network,
            contractAddress: contractAddress,
            contractAddressHex: contractInstance.address,
            deployedAt: new Date().toISOString(),
            deployer: tronWeb.address.fromPrivateKey(CONFIG.deployerPrivateKey),
            contractName: 'LegalNoticeNFT_Optimized',
            contractSize: sizeInBytes + ' bytes',
            features: [
                'Enhanced metadata for wallet visibility',
                'Batch operations (up to 20 recipients)',
                'ERC721Enumerable for Tronscan tracking',
                'Access control (onlyAuthorized)',
                'Process server auto-assignment',
                'Law enforcement fee exemptions',
                'No Via IR required',
                'Optimized storage layout',
                'Combined create functions',
                'Struct parameters'
            ]
        };

        fs.writeFileSync(
            path.join(__dirname, 'deployment_optimized_enumerable.json'),
            JSON.stringify(deploymentInfo, null, 2)
        );

        console.log('\n📋 Next Steps:');
        console.log('1. Update config.js with new contract address');
        console.log('2. Update UI to use new ABI and contract structure');
        console.log('3. Verify on Tronscan (no Via IR complications!)');
        console.log(`\n🔍 View on Tronscan: ${CONFIG.networks[CONFIG.network].explorer}/contract/${contractAddress}`);

    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        if (error.message.includes('Invalid contract')) {
            console.error('   Contract may be too large or have other issues');
        }
    }
}

deployOptimizedContract();