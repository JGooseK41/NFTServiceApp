const TronWeb = require('tronweb');
const fs = require('fs');
require('dotenv').config();

// Deploy the STANDARD contract with real resource sponsorship
async function deployStandardContract() {
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.TRON_PRIVATE_KEY
    });
    
    console.log('Compiling LegalNoticeNFT.sol (standard version with real sponsorship)...');
    
    // First compile the standard contract
    const solc = require('solc');
    const contractSource = fs.readFileSync('./LegalNoticeNFT.sol', 'utf8');
    
    const input = {
        language: 'Solidity',
        sources: {
            'LegalNoticeNFT.sol': {
                content: contractSource
            }
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*']
                }
            },
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    };
    
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
    if (output.errors) {
        output.errors.forEach(error => {
            console.log(`${error.severity}: ${error.message}`);
        });
    }
    
    const contract = output.contracts['LegalNoticeNFT.sol']['LegalNoticeNFT'];
    
    console.log('Deploying to Nile testnet...');
    console.log('Fee Collector:', process.env.FEE_COLLECTOR);
    
    try {
        const deployedContract = await tronWeb.contract().new({
            abi: contract.abi,
            bytecode: contract.evm.bytecode.object,
            feeLimit: 1500_000_000,
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000,
            parameters: [process.env.FEE_COLLECTOR]
        });
        
        console.log('\n✅ Contract deployed successfully!');
        console.log('Contract Address:', deployedContract.address);
        
        // Convert to base58
        const base58Address = TronWeb.address.fromHex(deployedContract.address);
        console.log('Base58 Address:', base58Address);
        console.log('Explorer URL:', `https://nile.tronscan.org/#/contract/${base58Address}`);
        
        // Save deployment info
        const deployment = {
            contractType: 'LegalNoticeNFT (Standard with Resource Sponsorship)',
            network: 'nile',
            hexAddress: deployedContract.address,
            base58Address: base58Address,
            deployer: tronWeb.defaultAddress.base58,
            timestamp: new Date().toISOString(),
            feeCollector: process.env.FEE_COLLECTOR,
            features: [
                'Real resource sponsorship',
                'OpenZeppelin AccessControl',
                'Fee exemptions',
                'Withdrawable balance'
            ]
        };
        
        fs.writeFileSync(
            './deployments/standard_deployment.json',
            JSON.stringify(deployment, null, 2)
        );
        
        // Initial setup
        console.log('\nSetting up contract...');
        
        // Grant yourself process server role
        const serverRole = tronWeb.sha3('SERVER_ROLE');
        await deployedContract.grantRole(serverRole, tronWeb.defaultAddress.base58).send({
            feeLimit: 100_000_000
        });
        console.log('✓ SERVER_ROLE granted');
        
        // Set initial fee (10 TRX)
        await deployedContract.updateFee(10_000_000).send({
            feeLimit: 100_000_000
        });
        console.log('✓ Creation fee set to 10 TRX');
        
        // Enable resource sponsorship
        await deployedContract.setResourceSponsorship(true).send({
            feeLimit: 100_000_000
        });
        console.log('✓ Resource sponsorship ENABLED');
        
        console.log('\n🎉 Deployment complete! Use this address in your app:', base58Address);
        
    } catch (error) {
        console.error('Deployment failed:', error);
    }
}

deployStandardContract();