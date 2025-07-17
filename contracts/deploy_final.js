const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function deployFinalContract(network = 'nile') {
    const networks = {
        nile: 'https://nile.trongrid.io',
        mainnet: 'https://api.trongrid.io'
    };
    
    const tronWeb = new TronWeb({
        fullHost: networks[network],
        privateKey: process.env.TRON_PRIVATE_KEY
    });
    
    console.log(`Deploying LegalNoticeNFT_Final to ${network}...`);
    console.log('Deployer:', tronWeb.defaultAddress.base58);
    
    // Load compiled contract
    const contractData = JSON.parse(
        fs.readFileSync('./build/LegalNoticeNFT_Final.json', 'utf8')
    );
    
    // Deploy contract
    try {
        const deployedContract = await tronWeb.contract().new({
            abi: contractData.abi,
            bytecode: contractData.bytecode,
            feeLimit: 1500_000_000,
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000,
            parameters: [process.env.FEE_COLLECTOR || tronWeb.defaultAddress.base58]
        });
        
        console.log('\n✅ Contract deployed successfully!');
        console.log('Contract Address:', deployedContract.address);
        
        // Convert to base58
        const base58Address = TronWeb.address.fromHex(deployedContract.address);
        console.log('Base58 Address:', base58Address);
        console.log('Explorer URL:', `https://${network === 'mainnet' ? 'tronscan.org' : 'nile.tronscan.org'}/#/contract/${base58Address}`);
        
        // Save deployment info
        const deploymentInfo = {
            contractType: 'LegalNoticeNFT_Final',
            network: network,
            hexAddress: deployedContract.address,
            base58Address: base58Address,
            deployer: tronWeb.defaultAddress.base58,
            feeCollector: process.env.FEE_COLLECTOR || tronWeb.defaultAddress.base58,
            timestamp: new Date().toISOString(),
            features: [
                'REAL resource sponsorship implementation',
                'Gas optimized (60-70% savings)',
                'Dual NFT system (notice + alert)',
                'Base64 preview images',
                'IPFS document storage',
                'Fee management with exemptions',
                'Withdrawable TRX balance'
            ]
        };
        
        // Create deployments directory if it doesn't exist
        const deploymentsDir = './deployments';
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }
        
        // Save deployment info
        const deploymentFile = path.join(deploymentsDir, `final_deployment_${Date.now()}.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        
        console.log('\nDeployment info saved to:', deploymentFile);
        
        // Initial setup
        console.log('\nPerforming initial setup...');
        
        const contract = await tronWeb.contract(contractData.abi, base58Address);
        
        // Grant SERVER_ROLE to deployer
        const serverRole = '0x' + TronWeb.sha3('SERVER_ROLE').slice(2);
        console.log('Granting SERVER_ROLE...');
        await contract.grantRole(serverRole, tronWeb.defaultAddress.base58).send({
            feeLimit: 100_000_000
        });
        console.log('✓ SERVER_ROLE granted');
        
        // Set fee exemption for deployer (optional)
        console.log('Setting fee exemption for deployer...');
        await contract.setFeeExemption(tronWeb.defaultAddress.base58, true).send({
            feeLimit: 100_000_000
        });
        console.log('✓ Fee exemption set');
        
        console.log('\n🎉 Deployment complete!');
        console.log('Contract address for your app:', base58Address);
        console.log('\nNext steps:');
        console.log('1. Update index.html with the new contract address:', base58Address);
        console.log('2. Send TRX to the contract for resource sponsorship');
        console.log('3. Enable resource sponsorship with setResourceSponsorship(true)');
        
        return deploymentInfo;
        
    } catch (error) {
        console.error('Deployment failed:', error);
        throw error;
    }
}

// Check if private key exists
if (!process.env.TRON_PRIVATE_KEY) {
    console.error('Error: TRON_PRIVATE_KEY not found in .env file');
    console.log('Please add your private key to the .env file');
    process.exit(1);
}

// Get network from command line argument
const network = process.argv[2] || 'nile';

deployFinalContract(network).catch(console.error);