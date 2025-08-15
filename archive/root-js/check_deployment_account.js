const TronWeb = require('tronweb');
require('dotenv').config();

async function checkAccount() {
    const privateKey = process.env.PRIVATE_KEY;
    
    if (!privateKey || privateKey === 'YOUR_PRIVATE_KEY_HERE') {
        console.error('❌ Please set PRIVATE_KEY in .env file');
        return;
    }
    
    try {
        const tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io',
            privateKey: privateKey
        });
        
        const address = tronWeb.address.fromPrivateKey(privateKey);
        console.log('🔍 Checking account:', address);
        
        // Get account info
        const account = await tronWeb.trx.getAccount(address);
        
        if (!account.address) {
            console.log('❌ Account not activated!');
            console.log('   Send at least 0.1 TRX to activate it.');
            return;
        }
        
        // Check balance
        const balance = await tronWeb.trx.getBalance(address);
        const balanceTRX = balance / 1_000_000;
        console.log('💰 Balance:', balanceTRX, 'TRX');
        
        if (balanceTRX < 1100) {
            console.log('⚠️  Low balance! Need at least 1,100 TRX for deployment');
        }
        
        // Check bandwidth
        const bandwidth = await tronWeb.trx.getBandwidth(address);
        console.log('📊 Bandwidth:', bandwidth);
        
        // Check account resources
        const resources = await tronWeb.trx.getAccountResources(address);
        console.log('⚡ Energy:', resources.EnergyUsed || 0, '/', resources.EnergyLimit || 0);
        
        // Check permissions
        console.log('\n📋 Account Permissions:');
        if (account.owner_permission) {
            console.log('Owner Permission:', account.owner_permission);
        }
        if (account.active_permission) {
            console.log('Active Permissions:', account.active_permission);
        }
        
        console.log('\n✅ Account check complete!');
        
        if (balanceTRX >= 1100 && account.address) {
            console.log('✅ Account is ready for deployment!');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkAccount();