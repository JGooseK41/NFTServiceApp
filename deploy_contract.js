const TronWeb = require('tronweb');
const fs = require('fs');

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY || 'your_private_key_here';
const NETWORK = process.env.NETWORK || 'shasta'; // 'shasta' for testnet, 'mainnet' for mainnet

const networks = {
    shasta: {
        fullHost: 'https://api.shasta.trongrid.io',
        solidityNode: 'https://api.shasta.trongrid.io',
        eventServer: 'https://api.shasta.trongrid.io'
    },
    mainnet: {
        fullHost: 'https://api.trongrid.io',
        solidityNode: 'https://api.trongrid.io',
        eventServer: 'https://api.trongrid.io'
    }
};

async function deployContract() {
    try {
        // Initialize TronWeb
        const tronWeb = new TronWeb({
            fullHost: networks[NETWORK].fullHost,
            privateKey: PRIVATE_KEY
        });

        console.log('Deploying to:', NETWORK);
        console.log('Deployer address:', tronWeb.defaultAddress.base58);

        // Read contract files
        const bytecode = fs.readFileSync('./contracts/LegalNoticeNFT_Complete_sol_LegalNoticeNFT.bin', 'utf8');
        const abi = JSON.parse(fs.readFileSync('./contracts/LegalNoticeNFT_Complete_sol_LegalNoticeNFT.abi', 'utf8'));

        // Check balance
        const balance = await tronWeb.trx.getBalance(tronWeb.defaultAddress.base58);
        console.log('Balance:', balance / 1e6, 'TRX');

        if (balance < 100 * 1e6) {
            console.error('Insufficient balance. Need at least 100 TRX for deployment.');
            return;
        }

        // Deploy contract
        console.log('Deploying contract...');
        const contract = await tronWeb.contract().new({
            abi: abi,
            bytecode: bytecode,
            feeLimit: 1500 * 1e6, // 1500 TRX max fee
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10000000,
            parameters: [] // No constructor parameters
        });

        console.log('\n✅ Contract deployed successfully!');
        console.log('Contract address:', contract.address);
        console.log('Transaction ID:', contract.transactionId);
        
        // Save deployment info
        const deploymentInfo = {
            network: NETWORK,
            contractAddress: contract.address,
            transactionId: contract.transactionId,
            deployedAt: new Date().toISOString(),
            deployer: tronWeb.defaultAddress.base58
        };
        
        fs.writeFileSync(
            `./deployment_${NETWORK}.json`,
            JSON.stringify(deploymentInfo, null, 2)
        );
        
        console.log('\nDeployment info saved to deployment_' + NETWORK + '.json');
        
        // Verify deployment
        console.log('\nVerifying deployment...');
        const contractInstance = await tronWeb.contract(abi, contract.address);
        const admin = await contractInstance.admin().call();
        console.log('Contract admin:', admin);
        
    } catch (error) {
        console.error('Deployment failed:', error);
    }
}

// Run deployment
deployContract();