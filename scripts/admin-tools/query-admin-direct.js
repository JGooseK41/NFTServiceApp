const TronWeb = require('tronweb');
const fs = require('fs');

// Initialize TronWeb for mainnet
const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: '01' // Dummy key for read-only operations
});

async function queryAdmin() {
    try {
        const contractAddress = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';
        const userAddress = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';
        
        // Load ABI
        const abi = JSON.parse(fs.readFileSync('./v5/LegalNoticeNFT_v5_Enumerable.abi', 'utf-8'));
        
        // Get contract instance
        const contract = await tronWeb.contract(abi, contractAddress);
        
        console.log('=== Checking Admin Status ===\n');
        console.log('Contract:', contractAddress);
        console.log('Your Wallet:', userAddress);
        console.log('');
        
        // Check DEFAULT_ADMIN_ROLE
        const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
        
        // Query role membership
        console.log('Querying admin role membership...\n');
        
        // Get member count
        try {
            const memberCount = await contract.getRoleMemberCount(DEFAULT_ADMIN_ROLE).call();
            console.log('Total admins:', memberCount.toString());
            
            // List all admins
            if (memberCount > 0) {
                console.log('\nCurrent admin addresses:');
                for (let i = 0; i < memberCount; i++) {
                    const admin = await contract.getRoleMember(DEFAULT_ADMIN_ROLE, i).call();
                    console.log(`  ${i + 1}. ${admin}`);
                    
                    if (admin.toLowerCase() === userAddress.toLowerCase()) {
                        console.log('     ^^^ This is YOUR wallet!');
                    }
                }
            }
        } catch (e) {
            console.log('Error getting role members:', e.message);
        }
        
        // Direct role check
        try {
            const hasRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, userAddress).call();
            console.log('\nDirect role check for your wallet:', hasRole);
        } catch (e) {
            console.log('Error checking role:', e.message);
        }
        
        // Check if there's an owner function
        try {
            const owner = await contract.owner().call();
            console.log('\nContract owner:', owner);
        } catch (e) {
            // No owner function
        }
        
        // Check fees to verify contract is working
        try {
            const creationFee = await contract.creationFee().call();
            console.log('\nCurrent creation fee:', tronWeb.fromSun(creationFee), 'TRX');
        } catch (e) {
            console.log('Error reading fee:', e.message);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

queryAdmin();