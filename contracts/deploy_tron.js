const TronWeb = require('tronweb');
const fs = require('fs');
require('dotenv').config();

// Configuration
const config = {
    // Network endpoints
    networks: {
        nile: {
            fullHost: 'https://nile.trongrid.io',
            privateKey: process.env.PRIVATE_KEY || process.env.TRON_PRIVATE_KEY,
            feeCollector: process.env.FEE_COLLECTOR || 'TDbeaZQ25WzZ4Aqn4RJAZxmo6BeHdMeXGf'
        },
        shasta: {
            fullHost: 'https://api.shasta.trongrid.io',
            privateKey: process.env.PRIVATE_KEY,
            feeCollector: process.env.FEE_COLLECTOR || 'YOUR_FEE_COLLECTOR_ADDRESS'
        },
        mainnet: {
            fullHost: 'https://api.trongrid.io',
            privateKey: process.env.PRIVATE_KEY,
            feeCollector: process.env.FEE_COLLECTOR || 'YOUR_FEE_COLLECTOR_ADDRESS'
        }
    }
};

async function deployContract(network = 'nile') {
    const networkConfig = config.networks[network];
    
    if (!networkConfig.privateKey) {
        throw new Error('Please set PRIVATE_KEY environment variable');
    }
    
    // Initialize TronWeb
    const tronWeb = new TronWeb({
        fullHost: networkConfig.fullHost,
        privateKey: networkConfig.privateKey
    });
    
    // Read contract files
    const contractSource = fs.readFileSync('./LegalNoticeNFT_TRON.sol', 'utf8');
    
    console.log(`Deploying to ${network}...`);
    console.log(`Fee Collector: ${networkConfig.feeCollector}`);
    
    try {
        // Compile contract (you need to compile it first with tronbox or solc)
        const compiledContract = require('./build/LegalNoticeNFT_TRON.json');
        
        // Deploy contract
        const contract = await tronWeb.contract().new({
            abi: compiledContract.abi,
            bytecode: compiledContract.bytecode,
            feeLimit: 1500_000_000, // 1,500 TRX
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000,
            parameters: [networkConfig.feeCollector]
        });
        
        console.log('Contract deployed successfully!');
        console.log('Contract Address:', contract.address);
        console.log('Transaction ID:', contract.transactionId);
        
        // Save deployment info
        const deployment = {
            network: network,
            address: contract.address,
            transactionId: contract.transactionId,
            deployer: tronWeb.defaultAddress.base58,
            timestamp: new Date().toISOString(),
            feeCollector: networkConfig.feeCollector
        };
        
        fs.writeFileSync(
            `./deployments/${network}_deployment.json`,
            JSON.stringify(deployment, null, 2)
        );
        
        // Verify contract on TronScan (if mainnet)
        if (network === 'mainnet') {
            console.log('\nTo verify on TronScan:');
            console.log(`1. Visit: https://tronscan.org/#/contract/${contract.address}/code`);
            console.log('2. Click "Verify and Publish"');
            console.log('3. Submit source code and constructor parameters');
        }
        
        // Set up initial configuration
        await setupContract(contract, tronWeb);
        
        return contract.address;
        
    } catch (error) {
        console.error('Deployment failed:', error);
        throw error;
    }
}

async function setupContract(contract, tronWeb) {
    console.log('\nSetting up contract...');
    
    try {
        // Grant SERVER_ROLE to deployer (optional)
        const serverRole = tronWeb.sha3('SERVER_ROLE');
        await contract.grantRole(serverRole, tronWeb.defaultAddress.base58).send({
            feeLimit: 100_000_000
        });
        console.log('✓ SERVER_ROLE granted to deployer');
        
        // Set initial fee (10 TRX)
        await contract.updateFee(10_000_000).send({ // 10 TRX in SUN
            feeLimit: 100_000_000
        });
        console.log('✓ Creation fee set to 10 TRX');
        
        // Enable resource sponsorship (optional)
        await contract.setResourceSponsorship(true).send({
            feeLimit: 100_000_000
        });
        console.log('✓ Resource sponsorship enabled');
        
        // Deposit some TRX for sponsorship (optional)
        if (process.env.SPONSOR_AMOUNT) {
            await contract.depositForFees().send({
                feeLimit: 100_000_000,
                callValue: tronWeb.toSun(process.env.SPONSOR_AMOUNT)
            });
            console.log(`✓ Deposited ${process.env.SPONSOR_AMOUNT} TRX for sponsorship`);
        }
        
    } catch (error) {
        console.error('Setup error:', error);
    }
}

// Estimate deployment costs
async function estimateDeploymentCost() {
    console.log('\nEstimated Deployment Costs:');
    console.log('- Contract Deployment: ~800-1200 TRX');
    console.log('- Initial Setup: ~50-100 TRX');
    console.log('- Total: ~850-1300 TRX');
    console.log('\nPer Transaction Estimates:');
    console.log('- Create Notice: ~30-50 TRX (energy)');
    console.log('- Accept Notice: ~10-15 TRX (energy)');
    console.log('- With Sponsorship: 0 TRX for users');
}

// Main execution
if (require.main === module) {
    const network = process.argv[2] || 'nile';
    
    if (process.argv.includes('--estimate')) {
        estimateDeploymentCost();
    } else {
        deployContract(network)
            .then(address => {
                console.log('\n✅ Deployment Complete!');
                console.log('Contract Address:', address);
                process.exit(0);
            })
            .catch(error => {
                console.error('\n❌ Deployment Failed:', error);
                process.exit(1);
            });
    }
}

module.exports = { deployContract };