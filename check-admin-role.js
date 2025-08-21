const TronWeb = require('tronweb');
const fs = require('fs');

// Initialize TronWeb
const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io'
});

async function checkAdminRole() {
    try {
        // Contract address on mainnet
        const contractAddress = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';
        
        // Read the ABI
        const abi = JSON.parse(fs.readFileSync('./v5/LegalNoticeNFT_v5_Enumerable.abi', 'utf-8'));
        
        // Initialize contract
        const contract = await tronWeb.contract(abi, contractAddress);
        
        // Admin role (0x00...)
        const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
        
        // Your wallet address
        const userAddress = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';
        
        console.log('Checking admin role for contract:', contractAddress);
        console.log('User address:', userAddress);
        console.log('');
        
        // Check if user has admin role
        const hasAdminRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, userAddress).call();
        console.log('User has DEFAULT_ADMIN_ROLE:', hasAdminRole);
        
        // Get role member count to find actual admins
        const adminCount = await contract.getRoleMemberCount(DEFAULT_ADMIN_ROLE).call();
        console.log('\nTotal admins:', adminCount.toString());
        
        // List all admins
        if (adminCount > 0) {
            console.log('\nCurrent admin addresses:');
            for (let i = 0; i < adminCount; i++) {
                const admin = await contract.getRoleMember(DEFAULT_ADMIN_ROLE, i).call();
                console.log(`  ${i + 1}. ${admin}`);
            }
        }
        
        // Also check the contract owner
        try {
            const owner = await contract.owner().call();
            console.log('\nContract owner:', owner);
        } catch (e) {
            // Contract might not have owner() function
            console.log('\nNo owner() function found');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkAdminRole();