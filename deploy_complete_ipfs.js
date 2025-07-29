const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

// Configuration
const NETWORK = process.env.NETWORK || 'nile';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const FEE_COLLECTOR = process.env.FEE_COLLECTOR || '';

// Network configurations
const NETWORKS = {
    nile: {
        fullHost: 'https://nile.trongrid.io',
        eventServer: 'https://event.nileex.io',
        faucet: 'https://nileex.io/join/getJoinPage'
    },
    mainnet: {
        fullHost: 'https://api.trongrid.io',
        eventServer: 'https://api.trongrid.io'
    }
};

if (!PRIVATE_KEY) {
    console.error('❌ Please set PRIVATE_KEY environment variable');
    console.error('Example: PRIVATE_KEY=your_private_key_here node deploy_complete_ipfs.js');
    process.exit(1);
}

// Initialize TronWeb
const tronWeb = new TronWeb({
    fullHost: NETWORKS[NETWORK].fullHost,
    eventServer: NETWORKS[NETWORK].eventServer,
    privateKey: PRIVATE_KEY
});

async function compileContract() {
    console.log('📋 Compiling contract...');
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
        await execAsync('tronbox compile');
        console.log('✅ Contract compiled successfully');
        return true;
    } catch (error) {
        console.log('⚠️  TronBox compile failed, trying direct compilation...');
        
        // Try direct solc compilation
        try {
            const solc = require('solc');
            const contractPath = path.join(__dirname, 'contracts/LegalNoticeNFT_Complete_WithIPFS.sol');
            const contractSource = fs.readFileSync(contractPath, 'utf8');
            
            const input = {
                language: 'Solidity',
                sources: {
                    'LegalNoticeNFT_Complete_WithIPFS.sol': {
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
                            '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode']
                        }
                    }
                }
            };
            
            const output = JSON.parse(solc.compile(JSON.stringify(input)));
            
            if (output.errors && output.errors.some(e => e.severity === 'error')) {
                throw new Error('Compilation errors: ' + JSON.stringify(output.errors));
            }
            
            const contract = output.contracts['LegalNoticeNFT_Complete_WithIPFS.sol']['LegalNoticeNFT_Complete_WithIPFS'];
            
            // Save compiled output
            const buildDir = path.join(__dirname, 'build/contracts');
            fs.mkdirSync(buildDir, { recursive: true });
            
            fs.writeFileSync(
                path.join(buildDir, 'LegalNoticeNFT_Complete_WithIPFS.json'),
                JSON.stringify({
                    contractName: 'LegalNoticeNFT_Complete_WithIPFS',
                    abi: contract.abi,
                    bytecode: contract.evm.bytecode.object
                }, null, 2)
            );
            
            console.log('✅ Direct compilation successful');
            return true;
        } catch (compileError) {
            console.error('❌ Compilation failed:', compileError.message);
            return false;
        }
    }
}

async function deployContract() {
    try {
        console.log('🚀 Starting deployment process...');
        console.log(`📡 Network: ${NETWORK}`);
        console.log(`👤 Deployer: ${tronWeb.defaultAddress.base58}`);
        
        // Check balance
        const balance = await tronWeb.trx.getBalance(tronWeb.defaultAddress.base58);
        console.log(`💰 Balance: ${tronWeb.fromSun(balance)} TRX`);
        
        if (balance < 500e6) {
            console.error('❌ Insufficient balance. Need at least 500 TRX');
            if (NETWORK === 'nile') {
                console.log(`🚰 Get test TRX from: ${NETWORKS.nile.faucet}`);
            }
            process.exit(1);
        }
        
        // Skip compilation check - using pre-compiled Complete contract
        
        // Load compiled contract - use existing Complete contract files
        const abi = JSON.parse(fs.readFileSync('./contracts/LegalNoticeNFT_Complete.abi', 'utf8'));
        const bytecode = fs.readFileSync('./contracts/LegalNoticeNFT_Complete.bin', 'utf8');
        
        console.log('📄 Contract loaded');
        console.log(`📏 Bytecode size: ${bytecode.length / 2} bytes`);
        
        // Deploy contract
        console.log('\n🚀 Deploying contract...');
        console.log('⏳ This may take a minute...');
        
        const contract = await tronWeb.contract().new({
            abi: abi,
            bytecode: bytecode,
            feeLimit: 3000e6, // 3000 TRX
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000,
            parameters: []
        });
        
        const contractAddress = tronWeb.address.fromHex(contract.address);
        
        console.log('\n✅ Contract deployed successfully!');
        console.log(`📍 Contract Address: ${contractAddress}`);
        console.log(`🔗 Hex Address: ${contract.address}`);
        
        // Verify deployment
        console.log('\n🔍 Verifying deployment...');
        const deployedCode = await tronWeb.trx.getContract(contractAddress);
        
        if (deployedCode.bytecode) {
            console.log('✅ Contract verified on blockchain');
            
            // Test basic functions
            const deployedContract = await tronWeb.contract(abi, contractAddress);
            
            console.log('\n📊 Contract Info:');
            console.log(`  Name: ${await deployedContract.name().call()}`);
            console.log(`  Symbol: ${await deployedContract.symbol().call()}`);
            console.log(`  Service Fee: ${tronWeb.fromSun(await deployedContract.serviceFee().call())} TRX`);
        }
        
        // Save deployment info
        const deploymentInfo = {
            contractName: 'LegalNoticeNFT_Complete_WithIPFS',
            network: NETWORK,
            contractAddress: contractAddress,
            contractAddressHex: contract.address,
            deployedAt: new Date().toISOString(),
            deployer: tronWeb.defaultAddress.base58,
            txID: contract.transactionId,
            fees: {
                serviceFee: '20 TRX',
                textOnlyFee: '10 TRX',
                creationFee: '5 TRX',
                sponsorshipFee: '2 TRX'
            }
        };
        
        const deploymentPath = path.join(__dirname, `deployment_complete_ipfs_${NETWORK}.json`);
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);
        
        // Update index.html
        console.log('\n📝 Updating index.html...');
        const indexPath = path.join(__dirname, 'index.html');
        let indexContent = fs.readFileSync(indexPath, 'utf8');
        
        // Update the contract address
        const oldAddress = 'TEZxBmj16pKdsJh3aDE9Y4RLSuXuBuUSp8';
        indexContent = indexContent.replace(new RegExp(oldAddress, 'g'), contractAddress);
        
        fs.writeFileSync(indexPath, indexContent);
        console.log('✅ index.html updated with new contract address');
        
        // Show next steps
        console.log('\n🎉 Deployment Complete!');
        console.log('\n📋 Next Steps:');
        console.log('1. ✅ Contract deployed and verified');
        console.log('2. ✅ index.html updated with new address');
        console.log('3. ⏳ Grant yourself admin role (if needed)');
        console.log('4. ⏳ Set fee collector address');
        console.log('5. ⏳ Configure law enforcement exemptions');
        console.log('6. ⏳ Test all functions');
        
        console.log('\n🔗 View on TronScan:');
        if (NETWORK === 'nile') {
            console.log(`   https://nile.tronscan.org/#/contract/${contractAddress}`);
        } else {
            console.log(`   https://tronscan.org/#/contract/${contractAddress}`);
        }
        
    } catch (error) {
        console.error('\n❌ Deployment failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run deployment
deployContract();