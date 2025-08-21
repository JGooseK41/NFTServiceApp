const TronWeb = require('tronweb');
const fs = require('fs');
require('dotenv').config();

// Initialize TronWeb for mainnet
const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: process.env.PRIVATE_KEY // Your private key to grant admin
});

async function grantAdminRole() {
    try {
        const contractAddress = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';
        const targetAddress = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY'; // Address to grant admin to
        
        // Load ABI
        const abi = JSON.parse(fs.readFileSync('./v5/LegalNoticeNFT_v5_Enumerable.abi', 'utf-8'));
        
        // Get contract instance
        const contract = await tronWeb.contract(abi, contractAddress);
        
        console.log('=== Granting Admin Role ===\n');
        console.log('Contract:', contractAddress);
        console.log('Granting admin to:', targetAddress);
        console.log('From wallet:', tronWeb.defaultAddress.base58);
        console.log('');
        
        // DEFAULT_ADMIN_ROLE = 0x00...
        const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
        
        // Check current status first
        const hasRoleBefore = await contract.hasRole(DEFAULT_ADMIN_ROLE, targetAddress).call();
        console.log('Has admin role before:', hasRoleBefore);
        
        if (hasRoleBefore) {
            console.log('\n✅ Address already has admin role!');
            return;
        }
        
        // Grant the role
        console.log('\nGranting DEFAULT_ADMIN_ROLE...');
        const tx = await contract.grantRole(DEFAULT_ADMIN_ROLE, targetAddress).send({
            feeLimit: 100_000_000, // 100 TRX
            shouldPollResponse: true
        });
        
        console.log('Transaction ID:', tx);
        console.log('\nWaiting for confirmation...');
        
        // Wait a bit for transaction to be confirmed
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if role was granted
        const hasRoleAfter = await contract.hasRole(DEFAULT_ADMIN_ROLE, targetAddress).call();
        console.log('\nHas admin role after:', hasRoleAfter);
        
        if (hasRoleAfter) {
            console.log('\n✅ Admin role successfully granted!');
        } else {
            console.log('\n❌ Failed to grant admin role');
        }
        
    } catch (error) {
        console.error('Error:', error);
        if (error.error) {
            console.error('Error details:', error.error);
        }
    }
}

// Check if private key is provided
if (!process.env.PRIVATE_KEY) {
    console.error('ERROR: Please provide PRIVATE_KEY in .env file');
    console.error('This should be the private key of the current admin or contract deployer');
    process.exit(1);
}

grantAdminRole();