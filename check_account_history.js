const TronWeb = require('tronweb');
const axios = require('axios');

async function checkAccountHistory(address) {
    try {
        const tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io'
        });
        
        console.log(`\n🔍 Checking account history for: ${address}\n`);
        
        // Get account info
        const account = await tronWeb.trx.getAccount(address);
        console.log('Account created:', new Date(account.create_time).toLocaleString());
        
        // Check transaction history via TronGrid API
        const response = await axios.get(
            `https://api.trongrid.io/v1/accounts/${address}/transactions?limit=200`
        );
        
        const transactions = response.data.data;
        
        console.log(`\nFound ${transactions.length} transactions\n`);
        
        // Look for permission update transactions
        const permissionUpdates = transactions.filter(tx => 
            tx.raw_data && 
            tx.raw_data.contract && 
            tx.raw_data.contract[0] && 
            tx.raw_data.contract[0].type === 'AccountPermissionUpdateContract'
        );
        
        if (permissionUpdates.length > 0) {
            console.log('⚠️  PERMISSION CHANGES FOUND:\n');
            
            permissionUpdates.forEach(tx => {
                console.log(`Transaction ID: ${tx.txID}`);
                console.log(`Date: ${new Date(tx.block_timestamp).toLocaleString()}`);
                console.log(`From: ${tronWeb.address.fromHex(tx.raw_data.contract[0].parameter.value.owner_address)}`);
                console.log(`Link: https://tronscan.org/#/transaction/${tx.txID}`);
                console.log('---');
            });
        } else {
            console.log('✅ No permission update transactions found');
        }
        
        // Check for suspicious patterns
        const suspiciousPatterns = transactions.filter(tx => {
            const contract = tx.raw_data?.contract?.[0];
            if (!contract) return false;
            
            // Check for common scam patterns
            return (
                // Large TRX transfers out
                (contract.type === 'TransferContract' && 
                 contract.parameter.value.amount > 1000000000) || // > 1000 TRX
                
                // Token approvals
                contract.type === 'TriggerSmartContract' &&
                tx.raw_data.contract[0].parameter.value.function_selector?.includes('approve')
            );
        });
        
        if (suspiciousPatterns.length > 0) {
            console.log('\n⚠️  SUSPICIOUS TRANSACTIONS FOUND:');
            console.log(`Found ${suspiciousPatterns.length} potentially suspicious transactions`);
            console.log('Review them at: https://tronscan.org/#/address/' + address);
        }
        
        // Get current permissions
        console.log('\n📋 CURRENT PERMISSIONS:');
        if (account.owner_permission) {
            console.log('Owner Permission:', account.owner_permission.keys[0].address);
        }
        if (account.active_permission) {
            account.active_permission.forEach((perm, i) => {
                console.log(`Active Permission ${i + 1}:`, perm.keys[0].address);
            });
        }
        
    } catch (error) {
        console.error('Error checking account:', error.message);
    }
}

// Usage
const address = process.argv[2];
if (!address) {
    console.log('Usage: node check_account_history.js YOUR_TRON_ADDRESS');
    process.exit(1);
}

checkAccountHistory(address);