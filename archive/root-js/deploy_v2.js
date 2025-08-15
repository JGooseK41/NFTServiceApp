const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

// Configuration
const NETWORK = process.env.NETWORK || 'nile';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

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
    console.error('Example: PRIVATE_KEY=your_private_key_here node deploy_v2.js');
    process.exit(1);
}

// Initialize TronWeb
const tronWeb = new TronWeb({
    fullHost: NETWORKS[NETWORK].fullHost,
    eventServer: NETWORKS[NETWORK].eventServer,
    privateKey: PRIVATE_KEY
});

async function deployContract() {
    try {
        console.log('🚀 Starting deployment process for v2...');
        console.log(`📡 Network: ${NETWORK}`);
        console.log(`👤 Deployer: ${tronWeb.defaultAddress.base58}`);
        
        // Check balance
        const balance = await tronWeb.trx.getBalance(tronWeb.defaultAddress.base58);
        console.log(`💰 Balance: ${tronWeb.fromSun(balance)} TRX`);
        
        if (balance < 900e6) {
            console.error('❌ Insufficient balance. Need at least 900 TRX for v2 deployment');
            if (NETWORK === 'nile') {
                console.log(`🚰 Get test TRX from: ${NETWORKS.nile.faucet}`);
            }
            process.exit(1);
        }
        
        // Load compiled contract
        const abi = JSON.parse(fs.readFileSync('./contracts/LegalNoticeNFT_Complete.abi', 'utf8'));
        const bytecode = fs.readFileSync('./contracts/LegalNoticeNFT_Complete.bin', 'utf8');
        
        console.log('📄 Contract loaded: LegalNoticeNFT_Complete v2');
        console.log(`📏 Bytecode size: ${bytecode.length / 2} bytes`);
        
        // Deploy contract
        console.log('\n🚀 Deploying contract...');
        console.log('⏳ This may take a minute...');
        
        const contract = await tronWeb.contract().new({
            abi: abi,
            bytecode: bytecode,
            feeLimit: 1000e6, // 1000 TRX
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
            contractName: 'LegalNoticeNFT_Complete',
            version: 'v2',
            network: NETWORK,
            contractAddress: contractAddress,
            contractAddressHex: contract.address,
            deployedAt: new Date().toISOString(),
            deployer: tronWeb.defaultAddress.base58,
            fees: {
                serviceFee: '20 TRX',
                textOnlyFee: '10 TRX',
                creationFee: '5 TRX',
                sponsorshipFee: '2 TRX'
            },
            features: [
                'Verifiable on TronScan',
                'NFT metadata support',
                'Complete ERC721 implementation',
                'Legal notice functionality'
            ]
        };
        
        fs.writeFileSync(
            `deployment_v2_${NETWORK}.json`,
            JSON.stringify(deploymentInfo, null, 2)
        );
        
        console.log('\n📝 Deployment info saved to:', `deployment_v2_${NETWORK}.json`);
        
        // Update index.html automatically
        console.log('\n🔄 Updating index.html...');
        const indexPath = path.join(__dirname, 'index.html');
        let indexContent = fs.readFileSync(indexPath, 'utf8');
        
        // Update contract address in multiple places
        const oldAddress = /T[A-Za-z0-9]{33}/g; // Match Tron addresses
        let updateCount = 0;
        
        indexContent = indexContent.replace(oldAddress, (match) => {
            if (match.length === 34 && match.startsWith('T')) {
                updateCount++;
                return contractAddress;
            }
            return match;
        });
        
        if (updateCount > 0) {
            fs.writeFileSync(indexPath, indexContent);
            console.log(`✅ Updated ${updateCount} contract addresses in index.html`);
        }
        
        console.log('\n🎉 Deployment complete!');
        console.log('\n📋 Next steps:');
        console.log('1. Verify contract on TronScan:');
        console.log(`   https://${NETWORK === 'mainnet' ? '' : NETWORK + '.'}tronscan.org/#/contract/${contractAddress}/code`);
        console.log('2. Test all functionality');
        console.log('3. Update any external references');
        
    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Run deployment
deployContract();