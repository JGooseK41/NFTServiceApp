const { TronWeb } = require('tronweb');
const fs = require('fs');

const privateKey = '36466bd27e7c316abef7474c9a6c55081dd099734e376ca36dfba63d0bf521c0';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: privateKey
});

async function testGrantRole() {
    try {
        const contractAddress = 'TXtSpuVBTnsvCwuqDYXtiZXTpgSXZSb2Bd';
        const walletAddress = tronWeb.address.fromPrivateKey(privateKey);
        
        console.log('Testing role granting...');
        console.log('Admin wallet:', walletAddress);
        console.log('Contract:', contractAddress);
        
        // Load the contract
        const abi = JSON.parse(fs.readFileSync('./contracts/LegalNoticeNFT_Complete_sol_LegalNoticeNFT.abi', 'utf8'));
        const legalContract = await tronWeb.contract(abi, contractAddress);
        
        // Check if we're admin
        const adminRoleBytes = tronWeb.sha3('ADMIN_ROLE');
        const isAdmin = await legalContract.hasRole(adminRoleBytes, walletAddress).call();
        console.log('Is admin?', isAdmin);
        
        if (!isAdmin) {
            console.log('Not admin, cannot proceed');
            return;
        }
        
        // Try to grant PROCESS_SERVER_ROLE to a different address
        const testAddress = 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8'; // Random test address
        console.log('\nAttempting to grant PROCESS_SERVER_ROLE to:', testAddress);
        const processServerRoleBytes = tronWeb.sha3('PROCESS_SERVER_ROLE');
        
        try {
            // First check if they already have the role
            const hasRole = await legalContract.hasRole(processServerRoleBytes, testAddress).call();
            console.log('Already has PROCESS_SERVER_ROLE?', hasRole);
            
            console.log('Granting role...');
            const tx = await legalContract.grantRole(processServerRoleBytes, testAddress).send({
                feeLimit: 100_000_000,
                callValue: 0,
                shouldPollResponse: true
            });
            console.log('Success! Transaction:', tx);
        } catch (error) {
            console.error('Error granting role:', error.message);
            
            // Try to decode the error
            if (error.output) {
                console.log('Error output:', error.output);
            }
            if (error.error) {
                console.log('Error details:', error.error);
            }
        }
        
        // Also test fee exemption function
        console.log('\nTesting fee exemption function...');
        try {
            const tx = await legalContract.setFeeExemption(walletAddress, true, false).send({
                feeLimit: 100_000_000,
                callValue: 0,
                shouldPollResponse: true
            });
            console.log('Fee exemption set successfully');
        } catch (error) {
            console.error('Error setting fee exemption:', error.message);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testGrantRole();