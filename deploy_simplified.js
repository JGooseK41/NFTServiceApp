const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    network: process.env.NETWORK || 'nile', // 'nile' or 'mainnet'
    privateKey: process.env.PRIVATE_KEY || 'your_private_key_here',
    feeLimit: 1500_000_000, // 1500 TRX for deployment
    userFeePercent: 100,
};

// Network configurations
const NETWORKS = {
    nile: {
        fullHost: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io',
    },
    mainnet: {
        fullHost: 'https://api.trongrid.io',
        eventServer: 'https://api.trongrid.io',
    }
};

async function deployContract() {
    try {
        console.log(`\n🚀 Deploying Simplified Legal Notice NFT to ${CONFIG.network}...`);
        
        // Initialize TronWeb
        const tronWeb = new TronWeb({
            fullHost: NETWORKS[CONFIG.network].fullHost,
            eventServer: NETWORKS[CONFIG.network].eventServer,
            privateKey: CONFIG.privateKey,
        });
        
        // Read contract files
        const contractPath = path.join(__dirname, 'LegalNoticeNFT_Simplified.sol');
        const contractSource = fs.readFileSync(contractPath, 'utf8');
        
        console.log('\n📄 Contract: LegalNoticeNFT_Simplified.sol');
        console.log(`🌐 Network: ${CONFIG.network}`);
        console.log(`👛 Deployer: ${tronWeb.defaultAddress.base58}`);
        
        // Get account balance
        const balance = await tronWeb.trx.getBalance(tronWeb.defaultAddress.base58);
        console.log(`💰 Balance: ${tronWeb.fromSun(balance)} TRX`);
        
        if (balance < 1500_000_000) {
            throw new Error('Insufficient TRX balance. Need at least 1500 TRX for deployment.');
        }
        
        // Compile contract (you need to compile first using TronBox or Remix)
        console.log('\n⚠️  Please compile the contract first using one of these methods:');
        console.log('\n1. Using TronBox:');
        console.log('   - Install TronBox: npm install -g tronbox');
        console.log('   - Run: tronbox compile');
        
        console.log('\n2. Using Remix:');
        console.log('   - Open https://remix.ethereum.org');
        console.log('   - Create new file and paste contract code');
        console.log('   - Compile with Solidity 0.8.0+');
        console.log('   - Copy the ABI and Bytecode');
        
        console.log('\n3. Using TronScan:');
        console.log(`   - Go to ${CONFIG.network === 'nile' ? 'https://nile.tronscan.org' : 'https://tronscan.org'}/#/contracts/contract-compiler`);
        console.log('   - Upload LegalNoticeNFT_Simplified.sol');
        console.log('   - Set compiler version to 0.8.0');
        console.log('   - Enable optimization');
        console.log('   - Compile and deploy');
        
        // After compilation, you would have ABI and bytecode
        // For now, showing the structure
        console.log('\n📋 After compilation, update this script with:');
        console.log('const ABI = <paste ABI here>;');
        console.log('const BYTECODE = <paste bytecode here>;');
        
        // Example deployment code (uncomment after adding ABI and bytecode)
        /*
        const contract = await tronWeb.contract().new({
            abi: ABI,
            bytecode: BYTECODE,
            feeLimit: CONFIG.feeLimit,
            callValue: 0,
            userFeePercentage: CONFIG.userFeePercent,
            originEnergyLimit: 10_000_000,
            parameters: [] // Constructor parameters if any
        });
        
        console.log('\n✅ Contract deployed successfully!');
        console.log(`📍 Contract Address: ${contract.address}`);
        console.log(`🔗 View on TronScan: ${getTronScanUrl(contract.address)}`);
        
        // Save deployment info
        const deploymentInfo = {
            network: CONFIG.network,
            address: contract.address,
            deployer: tronWeb.defaultAddress.base58,
            deploymentDate: new Date().toISOString(),
            contractName: 'LegalNoticeNFT_Simplified'
        };
        
        fs.writeFileSync(
            path.join(__dirname, `deployment_${CONFIG.network}.json`),
            JSON.stringify(deploymentInfo, null, 2)
        );
        
        console.log('\n💾 Deployment info saved to deployment_${CONFIG.network}.json');
        console.log('\n🎯 Next steps:');
        console.log('1. Update CONTRACT_ADDRESS in index.html');
        console.log('2. Grant roles if needed');
        console.log('3. Test the deployment');
        */
        
    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        process.exit(1);
    }
}

function getTronScanUrl(address) {
    const baseUrl = CONFIG.network === 'nile' 
        ? 'https://nile.tronscan.org' 
        : 'https://tronscan.org';
    return `${baseUrl}/#/contract/${address}`;
}

// Run deployment
if (require.main === module) {
    if (CONFIG.privateKey === 'your_private_key_here') {
        console.error('❌ Please set your private key in the PRIVATE_KEY environment variable');
        console.log('\nExample:');
        console.log('PRIVATE_KEY=your_key_here NETWORK=nile node deploy_simplified.js');
        process.exit(1);
    }
    
    deployContract();
}

module.exports = { deployContract };