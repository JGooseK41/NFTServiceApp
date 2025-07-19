const { TronWeb } = require('tronweb');
const fs = require('fs');
const path = require('path');

// Test private key for TRON Nile testnet (this is a public test key - do not use for mainnet!)
const TEST_PRIVATE_KEY = 'da146374a75310b9666e834ee4ad0866d6f4035967bfc76217c5a495fff9f0d0';

async function deployViewGatedContract() {
    console.log('🚀 Deploying LegalNoticeNFT ViewGated Contract to TRON Nile Testnet\n');
    
    // Initialize TronWeb for Nile testnet
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io',
        privateKey: TEST_PRIVATE_KEY
    });
    
    const deployer = tronWeb.address.fromPrivateKey(TEST_PRIVATE_KEY);
    console.log('📍 Deployer Address:', deployer);
    
    // Check balance
    const balance = await tronWeb.trx.getBalance(deployer);
    const balanceInTRX = tronWeb.fromSun(balance);
    console.log('💰 Deployer Balance:', balanceInTRX, 'TRX');
    
    if (balance < 200000000) { // Less than 200 TRX
        console.error('❌ Insufficient balance. Need at least 200 TRX for deployment.');
        console.log('💧 Get test TRX from: https://nileex.io/join/getJoinPage');
        process.exit(1);
    }
    
    try {
        // Read contract source
        const contractPath = path.join(__dirname, 'contracts/LegalNoticeNFT_ViewGated.sol');
        const contractSource = fs.readFileSync(contractPath, 'utf8');
        
        console.log('📋 Compiling ViewGated contract...');
        
        // Compile contract
        const compiled = await tronWeb.contract().compile(contractSource);
        
        if (compiled.errors && compiled.errors.length > 0) {
            console.error('❌ Compilation errors:');
            compiled.errors.forEach(error => console.error('  -', error));
            process.exit(1);
        }
        
        const contractName = 'LegalNoticeNFT_ViewGated.sol:LegalNoticeNFT';
        const contract = compiled.contracts[contractName];
        
        if (!contract) {
            console.error('❌ Contract not found in compilation output');
            console.log('Available contracts:', Object.keys(compiled.contracts));
            process.exit(1);
        }
        
        console.log('🔨 Deploying contract...');
        
        // Deploy the contract
        const deployed = await tronWeb.contract().deploy({
            abi: JSON.parse(contract.abi),
            bytecode: contract.bytecode,
            feeLimit: 1500_000_000, // 1500 TRX fee limit
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000,
            parameters: [] // Constructor parameters (none for this contract)
        });
        
        const contractAddress = tronWeb.address.fromHex(deployed.address);
        
        console.log('\n✅ Contract deployed successfully!');
        console.log('📍 Contract Address:', contractAddress);
        console.log('🔗 Hex Address:', deployed.address);
        console.log('🆔 Transaction ID:', deployed.txID);
        console.log('🔍 View on NileScan:', `https://nile.tronscan.org/#/contract/${contractAddress}`);
        
        // Save deployment info
        const deploymentInfo = {
            contractType: 'LegalNoticeNFT_ViewGated',
            network: 'nile',
            hexAddress: deployed.address,
            base58Address: contractAddress,
            deployer: deployer,
            txID: deployed.txID,
            timestamp: new Date().toISOString(),
            features: [
                'View-gated document access',
                'Two-tier NFT system (Alert + Document)',
                'Comprehensive metadata with agency/case details',
                'Fee sponsorship for recipients',
                'Certified delivery tracking',
                'IPFS encrypted document storage'
            ]
        };
        
        // Create deployments directory if it doesn't exist
        const deploymentsDir = path.join(__dirname, 'deployments');
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir);
        }
        
        // Save deployment file
        const deploymentFile = path.join(deploymentsDir, `viewgated_deployment_${Date.now()}.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        console.log('\n💾 Deployment info saved to:', deploymentFile);
        
        // Update instructions
        console.log('\n📝 Next Steps:');
        console.log('1. Update CONTRACT_ADDRESS in index.html:');
        console.log(`   Replace current address with: ${contractAddress}`);
        console.log('2. Test the deployment with a small transaction');
        console.log('3. Send TRX to contract for sponsorship pool (optional)');
        console.log('4. Update app and push to production');
        
        return contractAddress;
        
    } catch (error) {
        console.error('\n❌ Deployment failed:', error);
        if (error.message) {
            console.error('Error message:', error.message);
        }
        process.exit(1);
    }
}

// Run deployment
if (require.main === module) {
    deployViewGatedContract()
        .then(address => {
            console.log(`\n🎉 Deployment complete! Contract address: ${address}`);
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { deployViewGatedContract };