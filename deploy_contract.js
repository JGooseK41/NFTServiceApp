const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration
const NETWORK = process.env.NETWORK || 'nile'; // Default to testnet
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const FEE_COLLECTOR = process.env.FEE_COLLECTOR_ADDRESS || '';

// Network configurations
const networks = {
    mainnet: {
        fullHost: 'https://api.trongrid.io',
        eventServer: 'https://api.trongrid.io',
        solidityNode: 'https://api.trongrid.io'
    },
    shasta: {
        fullHost: 'https://api.shasta.trongrid.io',
        eventServer: 'https://api.shasta.trongrid.io',
        solidityNode: 'https://api.shasta.trongrid.io'
    },
    nile: {
        fullHost: 'https://nile.trongrid.io',
        eventServer: 'https://event.nileex.io',
        solidityNode: 'https://nile.trongrid.io'
    }
};

async function deployContract() {
    try {
        // Validate inputs
        if (!PRIVATE_KEY) {
            console.error('❌ Please set PRIVATE_KEY environment variable');
            process.exit(1);
        }

        if (!FEE_COLLECTOR && NETWORK === 'mainnet') {
            console.error('❌ Please set FEE_COLLECTOR_ADDRESS for mainnet deployment');
            process.exit(1);
        }

        // Initialize TronWeb
        const tronWeb = new TronWeb({
            fullHost: networks[NETWORK].fullHost,
            privateKey: PRIVATE_KEY
        });

        console.log(`🚀 Deploying to ${NETWORK}...`);
        console.log(`📍 Deployer address: ${tronWeb.defaultAddress.base58}`);

        // Read contract files
        const contractPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Simplified.sol');
        const contractSource = fs.readFileSync(contractPath, 'utf8');

        // Read compiled contract (you'll need to compile first)
        // For now, we'll show how to compile with tronbox
        console.log('📄 Contract: LegalNoticeNFT_Simplified.sol');
        
        // If using tronbox, you would compile first:
        // tronbox compile
        
        // Then read the compiled artifact:
        const compiledPath = path.join(__dirname, 'build', 'contracts', 'LegalNoticeNFT_Simplified.json');
        
        if (!fs.existsSync(compiledPath)) {
            console.error('❌ Contract not compiled. Please run: tronbox compile');
            console.log('💡 Or compile manually and place the bytecode and ABI in the build folder');
            process.exit(1);
        }

        const compiled = JSON.parse(fs.readFileSync(compiledPath, 'utf8'));
        const abi = compiled.abi;
        const bytecode = compiled.bytecode;

        // Deploy contract
        console.log('📤 Deploying contract...');
        
        const contract = await tronWeb.contract().new({
            abi: abi,
            bytecode: bytecode,
            feeLimit: 1500000000, // 1500 TRX
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10000000,
            parameters: [] // Constructor takes no parameters
        });

        console.log('✅ Contract deployed successfully!');
        console.log(`📍 Contract address: ${contract.address}`);
        console.log(`🔗 View on explorer: ${getExplorerUrl(NETWORK, contract.address)}`);

        // Post-deployment setup
        if (FEE_COLLECTOR && FEE_COLLECTOR !== tronWeb.defaultAddress.base58) {
            console.log('🔧 Setting fee collector...');
            await contract.updateFeeCollector(FEE_COLLECTOR).send({
                feeLimit: 100000000
            });
            console.log(`✅ Fee collector set to: ${FEE_COLLECTOR}`);
        }

        // Save deployment info
        const deploymentInfo = {
            network: NETWORK,
            contractAddress: contract.address,
            deployer: tronWeb.defaultAddress.base58,
            feeCollector: FEE_COLLECTOR || tronWeb.defaultAddress.base58,
            deploymentDate: new Date().toISOString(),
            abi: abi
        };

        const deploymentPath = path.join(__dirname, `deployment_${NETWORK}.json`);
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        console.log(`📄 Deployment info saved to: ${deploymentPath}`);

        // Update config.js
        updateConfig(NETWORK, contract.address);

        console.log('🎉 Deployment complete!');
        console.log('\n📋 Next steps:');
        console.log('1. Verify the contract on TronScan');
        console.log('2. Grant PROCESS_SERVER_ROLE to process servers');
        console.log('3. Set law enforcement exemptions if needed');
        console.log('4. Test all functions before going live');

    } catch (error) {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    }
}

function getExplorerUrl(network, address) {
    const explorers = {
        mainnet: 'https://tronscan.org/#/contract/',
        shasta: 'https://shasta.tronscan.org/#/contract/',
        nile: 'https://nile.tronscan.org/#/contract/'
    };
    return explorers[network] + address;
}

function updateConfig(network, contractAddress) {
    const configPath = path.join(__dirname, 'config.js');
    if (fs.existsSync(configPath)) {
        let config = fs.readFileSync(configPath, 'utf8');
        
        // Update the contract address for the deployed network
        const searchKey = `${network}: '`;
        const startIndex = config.indexOf(searchKey);
        if (startIndex !== -1) {
            const valueStart = startIndex + searchKey.length;
            const valueEnd = config.indexOf("'", valueStart);
            config = config.substring(0, valueStart) + contractAddress + config.substring(valueEnd);
            fs.writeFileSync(configPath, config);
            console.log('✅ Updated config.js with new contract address');
        }
    }
}

// Run deployment
deployContract();