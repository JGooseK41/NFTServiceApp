// Deploy script for LegalNoticeNFT_Complete_WithIPFS
const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    // IMPORTANT: Update these for your deployment
    NETWORK: process.env.TRON_NETWORK || 'nile', // 'mainnet', 'nile', 'shasta'
    PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY || '',
    
    // Network configurations
    NETWORKS: {
        mainnet: {
            fullHost: 'https://api.trongrid.io',
            eventServer: 'https://api.trongrid.io',
            solidityNode: 'https://api.trongrid.io'
        },
        nile: {
            fullHost: 'https://nile.trongrid.io',
            eventServer: 'https://event.nileex.io',
            solidityNode: 'https://nile.trongrid.io'
        },
        shasta: {
            fullHost: 'https://api.shasta.trongrid.io',
            eventServer: 'https://api.shasta.trongrid.io',
            solidityNode: 'https://api.shasta.trongrid.io'
        }
    }
};

async function deployContract() {
    // Validate configuration
    if (!CONFIG.PRIVATE_KEY) {
        console.error('❌ Error: DEPLOYER_PRIVATE_KEY environment variable not set');
        console.log('Set it with: export DEPLOYER_PRIVATE_KEY=your_private_key_here');
        process.exit(1);
    }

    // Initialize TronWeb
    const networkConfig = CONFIG.NETWORKS[CONFIG.NETWORK];
    if (!networkConfig) {
        console.error(`❌ Error: Invalid network "${CONFIG.NETWORK}"`);
        console.log('Valid networks:', Object.keys(CONFIG.NETWORKS).join(', '));
        process.exit(1);
    }

    console.log(`🌐 Deploying to ${CONFIG.NETWORK}...`);
    console.log(`📡 Network: ${networkConfig.fullHost}`);

    const tronWeb = new TronWeb({
        fullHost: networkConfig.fullHost,
        headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY || '' },
        privateKey: CONFIG.PRIVATE_KEY
    });

    try {
        // Get deployer address
        const deployerAddress = tronWeb.address.fromPrivateKey(CONFIG.PRIVATE_KEY);
        console.log(`👤 Deployer: ${deployerAddress}`);

        // Check balance
        const balance = await tronWeb.trx.getBalance(deployerAddress);
        console.log(`💰 Balance: ${tronWeb.fromSun(balance)} TRX`);

        if (balance < 500e6) { // 500 TRX minimum recommended
            console.error('❌ Error: Insufficient balance. Need at least 500 TRX for deployment');
            process.exit(1);
        }

        // Read contract files
        console.log('\n📄 Reading contract files...');
        const contractPath = path.join(__dirname, '../contracts/LegalNoticeNFT_Complete_WithIPFS.sol');
        const contractSource = fs.readFileSync(contractPath, 'utf8');

        // Read compiled contract (you'll need to compile first)
        const compiledPath = path.join(__dirname, '../build/contracts/LegalNoticeNFT_Complete_WithIPFS.json');
        
        if (!fs.existsSync(compiledPath)) {
            console.error('❌ Error: Compiled contract not found');
            console.log('Please compile the contract first using:');
            console.log('  npx truffle compile');
            console.log('or');
            console.log('  tronbox compile');
            process.exit(1);
        }

        const compiled = JSON.parse(fs.readFileSync(compiledPath, 'utf8'));
        const abi = compiled.abi;
        const bytecode = compiled.bytecode;

        console.log('✅ Contract loaded successfully');
        console.log(`📏 Bytecode size: ${bytecode.length / 2} bytes`);

        // Deploy contract
        console.log('\n🚀 Deploying contract...');
        const contractInstance = await tronWeb.contract().new({
            abi: abi,
            bytecode: bytecode,
            feeLimit: 3000e6, // 3000 TRX max
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000,
            parameters: [] // Constructor takes no parameters
        });

        const contractAddress = tronWeb.address.fromHex(contractInstance.address);
        console.log('\n✅ Contract deployed successfully!');
        console.log(`📍 Contract Address: ${contractAddress}`);
        console.log(`🔍 View on TronScan: ${getTronscanUrl(CONFIG.NETWORK)}contract/${contractAddress}`);

        // Save deployment info
        const deploymentInfo = {
            network: CONFIG.NETWORK,
            contractAddress: contractAddress,
            deployerAddress: deployerAddress,
            deploymentTime: new Date().toISOString(),
            abi: abi,
            transactionId: contractInstance.transactionId
        };

        const deploymentPath = path.join(__dirname, `../deployments/${CONFIG.NETWORK}_deployment.json`);
        fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);

        // Verify deployment
        console.log('\n🔍 Verifying deployment...');
        const deployedCode = await tronWeb.trx.getContract(contractAddress);
        if (deployedCode.bytecode) {
            console.log('✅ Contract code verified on blockchain');
            
            // Test basic functions
            const contract = await tronWeb.contract(abi, contractAddress);
            
            console.log('\n📊 Contract Info:');
            console.log(`  Name: ${await contract.name().call()}`);
            console.log(`  Symbol: ${await contract.symbol().call()}`);
            console.log(`  Service Fee: ${tronWeb.fromSun(await contract.serviceFee().call())} TRX`);
            console.log(`  Creation Fee: ${tronWeb.fromSun(await contract.creationFee().call())} TRX`);
        }

        // Create UI configuration file
        const uiConfig = `// Auto-generated contract configuration
// Generated: ${new Date().toISOString()}
// Network: ${CONFIG.NETWORK}

const CONTRACT_CONFIG = {
    address: '${contractAddress}',
    network: '${CONFIG.NETWORK}',
    abi: ${JSON.stringify(abi, null, 2)}
};

// Export for use in browser
if (typeof window !== 'undefined') {
    window.CONTRACT_CONFIG = CONTRACT_CONFIG;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONTRACT_CONFIG;
}
`;

        const configPath = path.join(__dirname, '../js/contract-config.js');
        fs.writeFileSync(configPath, uiConfig);
        console.log(`\n📝 UI configuration saved to: ${configPath}`);

        console.log('\n🎉 Deployment complete!');
        console.log('\nNext steps:');
        console.log('1. Update index.html to use the new contract address');
        console.log('2. Grant yourself ADMIN_ROLE if needed');
        console.log('3. Set fee collector address');
        console.log('4. Configure law enforcement exemptions');

    } catch (error) {
        console.error('\n❌ Deployment failed:', error);
        if (error.message && error.message.includes('Contract validate error')) {
            console.log('\n💡 Common issues:');
            console.log('- Insufficient TRX balance');
            console.log('- Contract too large (try optimization)');
            console.log('- Network connectivity issues');
        }
        process.exit(1);
    }
}

function getTronscanUrl(network) {
    const urls = {
        mainnet: 'https://tronscan.org/#/',
        nile: 'https://nile.tronscan.org/#/',
        shasta: 'https://shasta.tronscan.org/#/'
    };
    return urls[network] || urls.mainnet;
}

// Run deployment
deployContract().catch(console.error);