const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Network configurations
const networks = {
    nile: {
        fullNode: 'https://nile.trongrid.io',
        solidityNode: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io',
        networkName: 'Nile Testnet'
    },
    shasta: {
        fullNode: 'https://api.shasta.trongrid.io',
        solidityNode: 'https://api.shasta.trongrid.io',
        eventServer: 'https://api.shasta.trongrid.io',
        networkName: 'Shasta Testnet'
    },
    mainnet: {
        fullNode: 'https://api.trongrid.io',
        solidityNode: 'https://api.trongrid.io',
        eventServer: 'https://api.trongrid.io',
        networkName: 'Mainnet'
    }
};

async function deployContract() {
    try {
        // Validate environment
        if (!process.env.TRON_PRIVATE_KEY) {
            throw new Error('Please set TRON_PRIVATE_KEY in .env file');
        }
        
        if (!process.env.FEE_COLLECTOR) {
            throw new Error('Please set FEE_COLLECTOR address in .env file');
        }

        // Get network
        const network = process.env.NETWORK || 'nile';
        const networkConfig = networks[network];
        
        if (!networkConfig) {
            throw new Error(`Invalid network: ${network}. Options: nile, shasta, mainnet`);
        }

        console.log(`\n🌐 Deploying to ${networkConfig.networkName}...`);

        // Initialize TronWeb
        const tronWeb = new TronWeb({
            fullNode: networkConfig.fullNode,
            solidityNode: networkConfig.solidityNode,
            eventServer: networkConfig.eventServer,
            privateKey: process.env.TRON_PRIVATE_KEY
        });

        // Load compiled contract
        const contractPath = path.join(__dirname, 'build', 'contracts', 'LegalNoticeNFT_Simplified.json');
        if (!fs.existsSync(contractPath)) {
            throw new Error('Contract not compiled. Run: node compile_contract.js');
        }
        
        const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
        
        // Check account balance
        const address = tronWeb.address.fromPrivateKey(process.env.TRON_PRIVATE_KEY);
        const balance = await tronWeb.trx.getBalance(address);
        const balanceInTRX = tronWeb.fromSun(balance);
        
        console.log(`📍 Deploying from: ${address}`);
        console.log(`💰 Balance: ${balanceInTRX} TRX`);
        
        if (parseFloat(balanceInTRX) < 100) {
            console.log(`⚠️  Warning: Low balance. Deployment may fail.`);
        }

        // Deploy contract
        console.log('\n🚀 Deploying contract...');
        const contract = await tronWeb.contract().new({
            abi: contractData.abi,
            bytecode: contractData.bytecode,
            feeLimit: 1500000000, // 1500 TRX
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10000000,
            parameters: []
        });

        console.log('\n✅ Contract deployed successfully!');
        console.log(`📋 Contract Address: ${contract.address}`);
        
        // Set fee collector
        console.log('\n⚙️  Setting fee collector...');
        const result = await contract.updateFeeCollector(process.env.FEE_COLLECTOR).send({
            feeLimit: 100000000
        });
        
        if (result) {
            console.log('✅ Fee collector set successfully!');
        }

        // Save deployment info
        const deploymentInfo = {
            network: network,
            contractAddress: contract.address,
            deployedAt: new Date().toISOString(),
            deployer: address,
            feeCollector: process.env.FEE_COLLECTOR,
            contractName: 'LegalNoticeNFT_Simplified'
        };

        const deploymentsFile = path.join(__dirname, 'deployments.json');
        let deployments = {};
        
        if (fs.existsSync(deploymentsFile)) {
            deployments = JSON.parse(fs.readFileSync(deploymentsFile, 'utf8'));
        }
        
        deployments[network] = deploymentInfo;
        fs.writeFileSync(deploymentsFile, JSON.stringify(deployments, null, 2));

        // Update config.js
        console.log('\n📝 Updating config.js...');
        const configPath = path.join(__dirname, 'config.js');
        let configContent = fs.readFileSync(configPath, 'utf8');
        
        const networkKey = network === 'mainnet' ? 'mainnet' : network;
        configContent = configContent.replace(
            new RegExp(`${networkKey}: '[^']*'`),
            `${networkKey}: '${contract.address}'`
        );
        
        fs.writeFileSync(configPath, configContent);

        console.log('\n🎉 Deployment complete!');
        console.log('\n📄 Contract Details:');
        console.log(`   Network: ${networkConfig.networkName}`);
        console.log(`   Address: ${contract.address}`);
        console.log(`   Fee Collector: ${process.env.FEE_COLLECTOR}`);
        console.log('\n💡 Next steps:');
        console.log('   1. Update index.html with the contract address');
        console.log('   2. Grant process server roles as needed');
        console.log('   3. Test the deployment');

    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        process.exit(1);
    }
}

// Run deployment
deployContract();