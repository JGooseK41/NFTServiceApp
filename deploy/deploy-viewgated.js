const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

// Configuration
const PRIVATE_KEY = process.env.TRON_PRIVATE_KEY || 'your_private_key_here';
const NETWORK = process.env.TRON_NETWORK || 'nile'; // 'mainnet' or 'nile'

const NETWORKS = {
    mainnet: {
        fullHost: 'https://api.trongrid.io',
        eventServer: 'https://api.trongrid.io',
    },
    nile: {
        fullHost: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io',
    }
};

async function deploy() {
    // Initialize TronWeb
    const tronWeb = new TronWeb({
        fullHost: NETWORKS[NETWORK].fullHost,
        eventServer: NETWORKS[NETWORK].eventServer,
        privateKey: PRIVATE_KEY,
    });

    console.log(`Deploying to ${NETWORK}...`);
    console.log(`Deployer address: ${tronWeb.address.fromPrivateKey(PRIVATE_KEY)}`);

    try {
        // Read contract source
        const contractPath = path.join(__dirname, '../contracts/LegalNoticeNFT_ViewGated.sol');
        const contractSource = fs.readFileSync(contractPath, 'utf8');

        // Compile contract
        console.log('Compiling contract...');
        const compiled = await tronWeb.contract().compile(contractSource);
        
        if (compiled.errors && compiled.errors.length > 0) {
            console.error('Compilation errors:', compiled.errors);
            process.exit(1);
        }

        const contract = compiled.contracts['LegalNoticeNFT_ViewGated.sol:LegalNoticeNFT'];
        
        // Deploy contract
        console.log('Deploying contract...');
        const deployed = await tronWeb.contract().deploy({
            abi: JSON.parse(contract.abi),
            bytecode: contract.bytecode,
            feeLimit: 1500_000_000, // 1500 TRX
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000,
            parameters: []
        });

        const contractAddress = tronWeb.address.fromHex(deployed.address);
        console.log('✅ Contract deployed successfully!');
        console.log(`Contract address: ${contractAddress}`);
        console.log(`Hex address: ${deployed.address}`);
        console.log(`Transaction ID: ${deployed.txID}`);

        // Save deployment info
        const deploymentInfo = {
            network: NETWORK,
            contractAddress: contractAddress,
            hexAddress: deployed.address,
            txID: deployed.txID,
            deployedAt: new Date().toISOString(),
            abi: JSON.parse(contract.abi)
        };

        const outputPath = path.join(__dirname, `../deployments/viewgated-${NETWORK}.json`);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
        
        console.log(`\nDeployment info saved to: ${outputPath}`);
        
        // Instructions
        console.log('\n📝 Next steps:');
        console.log(`1. Update CONTRACT_ADDRESS in index.html to: ${contractAddress}`);
        console.log('2. Send TRX to contract for sponsorship pool (optional)');
        console.log('3. Test the deployment with a small transaction');
        
        // For mainnet deployment
        if (NETWORK === 'mainnet') {
            console.log('\n⚠️  MAINNET DEPLOYMENT - Important:');
            console.log('1. Verify contract on TronScan');
            console.log('2. Update DNS records if using custom domain');
            console.log('3. Enable HTTPS for production');
        }

    } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
    }
}

// Run deployment
deploy().catch(console.error);