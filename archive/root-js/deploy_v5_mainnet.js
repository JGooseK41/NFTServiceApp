const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// IMPORTANT: Update these values before running!
const MAINNET_CONFIG = {
    fullHost: 'https://api.trongrid.io',
    feeLimit: 1500_000_000,  // 1500 TRX - high limit for safety
    userFeePercentage: 10,   // Energy delegation
    originEnergyLimit: 10_000_000,
    deployerPrivateKey: process.env.PRIVATE_KEY || 'YOUR_PRIVATE_KEY_HERE'
};

// IMPORTANT: Set your production fee collector address!
const FEE_COLLECTOR_ADDRESS = process.env.FEE_COLLECTOR || 'YOUR_FEE_COLLECTOR_ADDRESS_HERE';

async function deployToMainnet() {
    console.log('=== TRON MAINNET DEPLOYMENT - LegalNoticeNFT v5 ===\n');
    
    // Safety check
    if (MAINNET_CONFIG.deployerPrivateKey === 'YOUR_PRIVATE_KEY_HERE') {
        console.error('❌ ERROR: Please set your private key in .env file or update the script!');
        console.error('   Add to .env: PRIVATE_KEY=your_actual_private_key');
        process.exit(1);
    }
    
    if (FEE_COLLECTOR_ADDRESS === 'YOUR_FEE_COLLECTOR_ADDRESS_HERE') {
        console.error('❌ ERROR: Please set your fee collector address!');
        console.error('   Add to .env: FEE_COLLECTOR=your_fee_collector_address');
        process.exit(1);
    }
    
    // Confirmation prompt
    console.log('⚠️  WARNING: You are about to deploy to MAINNET!');
    console.log('   This will cost real TRX (~1050 TRX)');
    console.log('   Fee Collector:', FEE_COLLECTOR_ADDRESS);
    console.log('\n   Press Ctrl+C to cancel, or wait 10 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    try {
        // Initialize TronWeb for mainnet
        const tronWeb = new TronWeb({
            fullHost: MAINNET_CONFIG.fullHost,
            privateKey: MAINNET_CONFIG.deployerPrivateKey
        });
        
        const deployerAddress = tronWeb.address.fromPrivateKey(MAINNET_CONFIG.deployerPrivateKey);
        console.log('Deployer Address:', deployerAddress);
        
        // Check balance
        const balance = await tronWeb.trx.getBalance(deployerAddress);
        const balanceTRX = balance / 1_000_000;
        console.log('Deployer Balance:', balanceTRX, 'TRX');
        
        if (balanceTRX < 1100) {
            console.error('❌ ERROR: Insufficient balance! Need at least 1100 TRX for deployment');
            process.exit(1);
        }
        
        // Read contract files
        const contractPath = path.join(__dirname, 'v5', 'LegalNoticeNFT_v5_Enumerable.sol');
        const abiPath = path.join(__dirname, 'v5', 'LegalNoticeNFT_v5_Enumerable.abi');
        
        if (!fs.existsSync(contractPath) || !fs.existsSync(abiPath)) {
            console.error('❌ ERROR: Contract files not found in v5 directory!');
            console.error('   Expected:', contractPath);
            console.error('   Expected:', abiPath);
            process.exit(1);
        }
        
        const contractCode = fs.readFileSync(contractPath, 'utf8');
        const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        
        console.log('\n📄 Compiling contract...');
        
        // For mainnet, we'll use the pre-compiled bytecode
        // You should compile the contract with the exact same settings as testnet
        const bytecodePath = path.join(__dirname, 'v5', 'LegalNoticeNFT_v5_Enumerable.bin');
        let bytecode;
        
        if (fs.existsSync(bytecodePath)) {
            bytecode = fs.readFileSync(bytecodePath, 'utf8').trim();
            console.log('✅ Using pre-compiled bytecode');
        } else {
            console.error('❌ ERROR: Compiled bytecode not found!');
            console.error('   Please compile the contract first with:');
            console.error('   solc --optimize --optimize-runs 200 --bin v5/LegalNoticeNFT_v5_Enumerable.sol');
            process.exit(1);
        }
        
        console.log('\n🚀 Deploying to TRON Mainnet...');
        console.log('   This may take a few minutes...\n');
        
        // Deploy with constructor parameter
        const options = {
            feeLimit: MAINNET_CONFIG.feeLimit,
            userFeePercentage: MAINNET_CONFIG.userFeePercentage,
            originEnergyLimit: MAINNET_CONFIG.originEnergyLimit,
            abi: JSON.stringify(abi),
            bytecode: bytecode,
            parameters: [FEE_COLLECTOR_ADDRESS],  // Constructor parameter
            name: 'LegalNoticeNFT_v5_Enumerable'
        };
        
        const result = await tronWeb.contract().new(options);
        
        if (!result.address) {
            throw new Error('Deployment failed - no contract address returned');
        }
        
        const contractAddress = tronWeb.address.fromHex(result.address);
        console.log('✅ Contract deployed successfully!');
        console.log('📍 Contract Address:', contractAddress);
        console.log('📍 Contract Hex:', result.address);
        console.log('🔗 Transaction Hash:', result.txID);
        
        // Calculate deployment cost
        const deploymentCost = result.energy_used * 420 / 1_000_000; // Approximate TRX cost
        console.log('💰 Deployment Cost: ~', deploymentCost.toFixed(2), 'TRX');
        
        // Save deployment info
        const deploymentInfo = {
            network: 'mainnet',
            contractName: 'LegalNoticeNFT_v5_Enumerable',
            contractAddress: contractAddress,
            contractHex: result.address,
            transactionHash: result.txID,
            deploymentDate: new Date().toISOString(),
            deployer: deployerAddress,
            feeCollector: FEE_COLLECTOR_ADDRESS,
            energyUsed: result.energy_used,
            deploymentCost: deploymentCost + ' TRX (estimated)'
        };
        
        const outputPath = path.join(__dirname, 'deployment_v5_mainnet.json');
        fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
        console.log('\n📁 Deployment info saved to:', outputPath);
        
        // Next steps
        console.log('\n📋 NEXT STEPS:');
        console.log('1. Update index.html line 34:');
        console.log(`   mainnet: '${contractAddress}',`);
        console.log('\n2. Verify contract on TronScan:');
        console.log(`   https://tronscan.org/#/contract/${contractAddress}/code`);
        console.log('\n3. Grant roles (using TronLink or script):');
        console.log('   - Admin roles to team members');
        console.log('   - Process server roles to verified servers');
        console.log('\n4. Test with a small transaction first!');
        
        console.log('\n✅ MAINNET DEPLOYMENT COMPLETE!');
        
    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Run deployment
deployToMainnet().catch(console.error);