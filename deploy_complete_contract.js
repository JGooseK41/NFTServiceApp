const TronWeb = require('tronweb').TronWeb;
const fs = require('fs');

// Use the private key from your wallet
const privateKey = process.env.PRIVATE_KEY || 'YOUR_PRIVATE_KEY_HERE';

if (privateKey === 'YOUR_PRIVATE_KEY_HERE') {
    console.error('Please set your private key!');
    console.error('Either:');
    console.error('1. Set PRIVATE_KEY environment variable: PRIVATE_KEY=your_key_here node deploy_complete_contract.js');
    console.error('2. Edit this file and replace YOUR_PRIVATE_KEY_HERE with your actual private key');
    process.exit(1);
}

// TronWeb v6 initialization
const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: privateKey
});

async function deployContract() {
    try {
        // Read the compiled contract
        const abi = JSON.parse(fs.readFileSync('./contracts/LegalNoticeNFT_Complete_sol_LegalNoticeNFT.abi', 'utf8'));
        const bytecode = fs.readFileSync('./contracts/LegalNoticeNFT_Complete_sol_LegalNoticeNFT.bin', 'utf8');
        
        console.log('Deploying LegalNoticeNFT_Complete...');
        
        const contract = await tronWeb.contract().new({
            abi: abi,
            bytecode: bytecode,
            feeLimit: 1500000000,
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10000000,
            parameters: []
        });
        
        console.log('Contract deployed successfully!');
        console.log('Contract address:', contract.address);
        console.log('Base58 address:', tronWeb.address.fromHex(contract.address));
        
        // Save deployment info
        const deploymentInfo = {
            contractName: 'LegalNoticeNFT_Complete',
            address: contract.address,
            base58Address: tronWeb.address.fromHex(contract.address),
            timestamp: new Date().toISOString(),
            network: 'nile'
        };
        
        fs.writeFileSync('./deployment_complete.json', JSON.stringify(deploymentInfo, null, 2));
        console.log('Deployment info saved to deployment_complete.json');
        
    } catch (error) {
        console.error('Deployment failed:', error);
    }
}

deployContract();