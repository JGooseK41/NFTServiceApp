const { TronWeb } = require('tronweb');

const privateKey = '36466bd27e7c316abef7474c9a6c55081dd099734e376ca36dfba63d0bf521c0';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: privateKey
});

async function testContract() {
    try {
        const contractAddress = 'TXtSpuVBTnsvCwuqDYXtiZXTpgSXZSb2Bd';
        const walletAddress = tronWeb.address.fromPrivateKey(privateKey);
        
        console.log('Testing with wallet:', walletAddress);
        console.log('Contract address:', contractAddress);
        
        // Load the contract with Complete ABI
        console.log('\nLoading contract with LegalNoticeNFT_Complete ABI...');
        
        // Load the contract with ABI
        const abi = JSON.parse(require('fs').readFileSync('./contracts/LegalNoticeNFT_Complete_sol_LegalNoticeNFT.abi', 'utf8'));
        const legalContract = await tronWeb.contract(abi, contractAddress);
        
        // Check if we're admin
        const adminRoleBytes = tronWeb.sha3('ADMIN_ROLE');
        console.log('\nADMIN_ROLE hash:', adminRoleBytes);
        
        const isAdmin = await legalContract.hasRole(adminRoleBytes, walletAddress).call();
        console.log('Is wallet admin?', isAdmin);
        
        // Try to check SERVICE_FEE
        try {
            const fee = await legalContract.SERVICE_FEE().call();
            console.log('SERVICE_FEE:', tronWeb.fromSun(fee), 'TRX');
        } catch (e) {
            console.log('Error getting SERVICE_FEE:', e.message);
        }
        
        // Try to check serviceFee (dynamic)
        try {
            const fee = await legalContract.serviceFee().call();
            console.log('serviceFee:', tronWeb.fromSun(fee), 'TRX');
        } catch (e) {
            console.log('Error getting serviceFee:', e.message);
        }
        
        // Check which ABI we should be using
        console.log('\nChecking contract functions...');
        
        // Test LegalNoticeNFT_Deploy ABI
        try {
            const deployAbi = JSON.parse(require('fs').readFileSync('./LegalNoticeNFT_Deploy_ABI.json', 'utf8'));
            const deployContract = await tronWeb.contract(deployAbi, contractAddress);
            const deployFee = await deployContract.SERVICE_FEE().call();
            console.log('Works with Deploy ABI - SERVICE_FEE:', tronWeb.fromSun(deployFee), 'TRX');
            console.log('>>> This is LegalNoticeNFT_Deploy contract! <<<');
        } catch (e) {
            console.log('Not Deploy contract');
        }
        
        // Test LegalNoticeNFT_Final ABI
        try {
            const finalAbi = JSON.parse(require('fs').readFileSync('./contracts/LegalNoticeNFT_Final_sol_LegalNoticeNFT.abi', 'utf8'));
            const finalContract = await tronWeb.contract(finalAbi, contractAddress);
            const finalFee = await finalContract.serviceFee().call();
            console.log('Works with Final ABI - serviceFee:', tronWeb.fromSun(finalFee), 'TRX');
            console.log('>>> This is LegalNoticeNFT_Final contract! <<<');
        } catch (e) {
            console.log('Not Final contract');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testContract();