const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY },
    privateKey: process.env.TRON_PRIVATE_KEY
});

async function deployContract() {
    try {
        console.log('📋 Deploying LegalNoticeNFT_Hybrid contract...');
        console.log('🌐 Network: Nile Testnet');
        
        // Load the compiled contract
        const contractPath = path.join(__dirname, 'build', 'contracts', 'LegalNoticeNFT_Hybrid.json');
        if (!fs.existsSync(contractPath)) {
            throw new Error('Compiled contract not found! Run compile_hybrid.js first.');
        }
        
        const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
        
        console.log('📝 Contract loaded successfully');
        console.log(`📊 Contract size: ${contractData.bytecode.length / 2} bytes`);
        
        // Deploy the contract
        console.log('🚀 Deploying contract...');
        console.log('💰 Fee limit: 1500 TRX');
        
        const contract = await tronWeb.contract().new({
            abi: contractData.abi,
            bytecode: contractData.bytecode,
            feeLimit: 1500_000_000,
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000,
            parameters: []
        });
        
        console.log('✅ Contract deployed successfully!');
        console.log('📍 Contract address (Base58):', contract.address);
        console.log('📍 Contract address (Hex):', tronWeb.address.toHex(contract.address));
        console.log('🔗 View on TronScan: https://nile.tronscan.org/#/contract/' + contract.address);
        
        // Save deployment info
        const deploymentInfo = {
            network: 'nile',
            contractAddress: contract.address,
            contractAddressHex: tronWeb.address.toHex(contract.address),
            deployedAt: new Date().toISOString(),
            deployer: tronWeb.defaultAddress.base58,
            contractName: 'LegalNoticeNFT_Hybrid',
            contractSize: contractData.bytecode.length / 2 + ' bytes',
            features: 'ENHANCED METADATA + BATCH OPERATIONS + RESTRICTED ACCESS'
        };
        
        const deploymentPath = path.join(__dirname, 'deployment_hybrid.json');
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        console.log('💾 Deployment info saved to:', deploymentPath);
        
        // Update config.js
        const configPath = path.join(__dirname, 'config.js');
        let configContent = fs.readFileSync(configPath, 'utf8');
        
        // Update the nile contract address
        configContent = configContent.replace(
            /nile:\s*'[^']*'/,
            `nile: '${contract.address}'`
        );
        
        // Add comment about hybrid features
        configContent = configContent.replace(
            /nile:.*\/\/.*$/m,
            `nile: '${contract.address}', // Hybrid contract with enhanced metadata + batch ops`
        );
        
        fs.writeFileSync(configPath, configContent);
        console.log('✅ Updated config.js with new contract address');
        
        // Create ABI file for easy access
        const abiPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Hybrid.abi');
        fs.writeFileSync(abiPath, JSON.stringify(contractData.abi, null, 2));
        console.log('📄 ABI saved to:', abiPath);
        
        console.log('\n🎉 Deployment complete!');
        console.log('\n📋 Next steps:');
        console.log('1. Update index.html with the new contract address');
        console.log('2. Test enhanced metadata visibility in wallets');
        console.log('3. Test batch operations functionality');
        console.log('4. Grant roles to process servers and set fee exemptions as needed');
        
        return contract.address;
        
    } catch (error) {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    }
}

// Run deployment
deployContract().then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
}).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});