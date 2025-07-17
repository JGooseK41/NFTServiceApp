require('dotenv').config();
const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

// Deployment configuration
const config = {
    network: 'nile',
    nile: {
        fullHost: 'https://nile.trongrid.io',
        eventServer: 'https://event.nileex.io',
        faucet: 'https://nileex.io/join/getJoinPage'
    }
};

// Contract bytecode and ABI (you'll need to compile first)
const CONTRACT_NAME = 'LegalServiceNFT';

async function deployContract() {
    // Check for private key
    const privateKey = process.env.TRON_PRIVATE_KEY;
    if (!privateKey) {
        console.error('❌ Please set TRON_PRIVATE_KEY environment variable');
        console.log('\nExample:');
        console.log('export TRON_PRIVATE_KEY=your_private_key_here');
        process.exit(1);
    }

    // Check for fee collector address
    const feeCollector = process.env.FEE_COLLECTOR || 'TNPeeaaFB7K9Gok8iuM1wJLaRRjsQmujse'; // Default test address
    
    console.log('🚀 Deploying Legal Service NFT V2 to TRON Nile Testnet\n');
    
    // Initialize TronWeb
    const tronWeb = new TronWeb({
        fullHost: config.nile.fullHost,
        eventServer: config.nile.eventServer,
        privateKey: privateKey
    });
    
    const deployer = tronWeb.address.fromPrivateKey(privateKey);
    console.log('📍 Deployer Address:', deployer);
    
    // Check balance
    const balance = await tronWeb.trx.getBalance(deployer);
    const balanceInTRX = tronWeb.fromSun(balance);
    console.log('💰 Deployer Balance:', balanceInTRX, 'TRX');
    
    if (balance < 1000000000) { // Less than 1000 TRX
        console.error('❌ Insufficient balance. You need at least 1000 TRX for deployment.');
        console.log(`\n💧 Get test TRX from faucet: ${config.nile.faucet}`);
        process.exit(1);
    }
    
    try {
        // Read compiled contract
        let contractData;
        try {
            // Try to read from TronBox build
            contractData = require('./build/contracts/LegalServiceNFT.json');
        } catch (e) {
            console.log('⚠️  TronBox build not found. Please compile the contract first.');
            console.log('\nRun: tronbox compile');
            console.log('Error:', e.message);
            process.exit(1);
        }
        
        console.log('\n📋 Contract Details:');
        console.log('- Name:', CONTRACT_NAME);
        console.log('- Fee Collector:', feeCollector);
        console.log('- Initial Fee: 10 TRX');
        
        console.log('\n🔨 Deploying contract...');
        
        // Deploy contract
        const contract = await tronWeb.contract().new({
            abi: contractData.abi,
            bytecode: contractData.bytecode,
            feeLimit: 1500000000, // 1500 TRX
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10000000,
            parameters: [feeCollector] // Constructor parameter
        });
        
        const contractAddress = tronWeb.address.fromHex(contract.address);
        
        console.log('\n✅ Contract deployed successfully!');
        console.log('📍 Contract Address:', contractAddress);
        console.log('🔗 View on NileScan:', `https://nile.tronscan.org/#/contract/${contractAddress}`);
        
        // Save deployment info
        const deployment = {
            network: 'nile',
            contractName: CONTRACT_NAME,
            contractAddress: contractAddress,
            contractAddressHex: contract.address,
            deployer: deployer,
            feeCollector: feeCollector,
            deploymentTime: new Date().toISOString(),
            transactionId: contract.transactionHash
        };
        
        // Create deployments directory if it doesn't exist
        const deploymentsDir = path.join(__dirname, 'deployments');
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir);
        }
        
        // Save deployment file
        const deploymentFile = path.join(deploymentsDir, `nile_deployment_${Date.now()}.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
        console.log('\n💾 Deployment info saved to:', deploymentFile);
        
        // Setup initial roles
        console.log('\n⚙️  Setting up initial configuration...');
        await setupContract(contract, tronWeb, deployer);
        
        // Update frontend config
        console.log('\n📝 Update your frontend configuration:');
        console.log(`
        // In index.html, update the CHAIN_CONFIG:
        nile: {
            name: 'TRON Nile Testnet',
            contractAddress: '${contractAddress}',
            explorerUrl: 'https://nile.tronscan.org',
            nativeToken: 'TRX',
            chainId: null
        }
        `);
        
        console.log('\n🎉 Deployment complete!\n');
        
        // Next steps
        console.log('📋 Next steps:');
        console.log('1. Update frontend with new contract address');
        console.log('2. Authorize law enforcement servers:');
        console.log(`   - Use authorizeServer() function`);
        console.log('3. Test with a sample document upload');
        console.log('4. Monitor contract on NileScan');
        
        return contractAddress;
        
    } catch (error) {
        console.error('\n❌ Deployment failed:', error);
        if (error.error) {
            console.error('Error details:', error.error);
        }
        process.exit(1);
    }
}

async function setupContract(contract, tronWeb, deployer) {
    try {
        // Authorize deployer as server (for testing)
        console.log('- Authorizing deployer as server...');
        await contract.authorizeServer(deployer, true).send({
            feeLimit: 100000000,
            shouldPollResponse: true
        });
        console.log('  ✓ Deployer authorized as server');
        
        // Set initial fee exemption for deployer (optional)
        console.log('- Setting fee exemption for deployer...');
        await contract.setFeeExemption(deployer, true).send({
            feeLimit: 100000000,
            shouldPollResponse: true
        });
        console.log('  ✓ Fee exemption set');
        
    } catch (error) {
        console.error('⚠️  Setup warning:', error.message);
    }
}

// Compile instructions
function showCompileInstructions() {
    console.log('\n📚 Compilation Instructions:\n');
    console.log('1. Install TronBox globally:');
    console.log('   npm install -g tronbox\n');
    console.log('2. Create tronbox.js config file:');
    console.log('   (See example below)\n');
    console.log('3. Compile the contract:');
    console.log('   tronbox compile\n');
    
    const tronboxConfig = `
module.exports = {
  networks: {
    nile: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1500000000,
      fullHost: 'https://nile.trongrid.io',
      network_id: '3'
    }
  },
  compilers: {
    solc: {
      version: '0.8.6',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  }
};`;
    
    console.log('Example tronbox.js:');
    console.log('```javascript');
    console.log(tronboxConfig);
    console.log('```\n');
}

// Main execution
if (require.main === module) {
    if (process.argv.includes('--compile-help')) {
        showCompileInstructions();
    } else {
        deployContract()
            .then(() => process.exit(0))
            .catch(error => {
                console.error('Fatal error:', error);
                process.exit(1);
            });
    }
}

module.exports = { deployContract };