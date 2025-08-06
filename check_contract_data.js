const TronWeb = require('tronweb');

// Use a dummy private key for reading contract data
const PRIVATE_KEY = '0000000000000000000000000000000000000000000000000000000000000001';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { "TRON-PRO-API-KEY": '9fc4cbb6-de76-486f-a8a3-bbf827c7d905' },
    privateKey: PRIVATE_KEY
});

const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

// Import the v5 ABI
const fs = require('fs');
const v5ABI = JSON.parse(fs.readFileSync('./v5/LegalNoticeNFT_v5_Enumerable.abi', 'utf8'));

async function checkContractData() {
    console.log('=== Checking V5 Contract Data Structure ===\n');
    
    try {
        // Create contract instance with ABI
        const contract = await tronWeb.contract(v5ABI, CONTRACT_ADDRESS);
        
        // Check total notices
        console.log('1. Getting total notices...');
        const total = await contract.totalNotices().call();
        console.log('Total notices:', total.toString());
        
        if (total > 0) {
            console.log('\n2. Examining notice structures...\n');
            
            // Check different arrays to understand structure
            for (let i = 0; i < Math.min(3, total); i++) {
                console.log(`--- Notice ID: ${i} ---`);
                
                // Try different getter methods
                try {
                    // Check if we have the old structure with documentNotices array
                    const docNotice = await contract.documentNotices(i).call();
                    console.log('documentNotices result:', docNotice);
                } catch (e) {
                    console.log('documentNotices error:', e.message);
                }
                
                try {
                    // Check alertNotices
                    const alertNotice = await contract.alertNotices(i).call();
                    console.log('alertNotices result:', alertNotice);
                } catch (e) {
                    console.log('alertNotices error:', e.message);
                }
                
                try {
                    // Check notices array
                    const notice = await contract.notices(i).call();
                    console.log('notices result:', notice);
                } catch (e) {
                    console.log('notices error:', e.message);
                }
                
                console.log('');
            }
        }
        
        // Check if we have any recipient data
        console.log('3. Checking recipient data...');
        const testAddress = 'TC8sVhGohQSJQqp96SgJZ5EUyFGfFnVQWy';
        
        try {
            // Check recipientAlerts
            const alertsCount = await contract.getRecipientAlertCount(testAddress).call();
            console.log(`Recipient ${testAddress} has ${alertsCount} alerts`);
            
            if (alertsCount > 0) {
                const firstAlert = await contract.getRecipientAlert(testAddress, 0).call();
                console.log('First alert ID:', firstAlert.toString());
            }
        } catch (e) {
            console.log('Could not get recipient alerts:', e.message);
        }
        
    } catch (error) {
        console.error('Error:', error.message || error);
    }
}

checkContractData();