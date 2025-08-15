const TronWeb = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { "TRON-PRO-API-KEY": '9fc4cbb6-de76-486f-a8a3-bbf827c7d905' },
});

const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

async function debugContract() {
    console.log('=== V5 Contract Debug ===\n');
    
    try {
        // First, let's check if we can access the contract
        console.log('1. Getting contract info...');
        const contractInfo = await tronWeb.trx.getContract(CONTRACT_ADDRESS);
        
        if (!contractInfo) {
            console.log('Contract not found at address:', CONTRACT_ADDRESS);
            return;
        }
        
        console.log('Contract name:', contractInfo.name || 'Unknown');
        
        // Get contract instance
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
        
        // Check totalNotices
        console.log('\n2. Checking total notices...');
        try {
            const total = await contract.totalNotices().call();
            console.log('Total notices:', total.toString());
        } catch (e) {
            console.log('totalNotices() failed:', e.message);
        }
        
        // Check notices 0 and 1
        console.log('\n3. Checking individual notices...');
        for (let i = 0; i < 2; i++) {
            console.log(`\n--- Notice ${i} ---`);
            
            // Try alertNotices
            try {
                const alert = await contract.alertNotices(i).call();
                console.log('Alert notice:', alert);
            } catch (e) {
                console.log('alertNotices error:', e.message);
            }
            
            // Try documentNotices
            try {
                const doc = await contract.documentNotices(i).call();
                console.log('Document notice:', doc);
            } catch (e) {
                console.log('documentNotices error:', e.message);
            }
            
            // Try notices
            try {
                const notice = await contract.notices(i).call();
                console.log('Notice:', notice);
            } catch (e) {
                console.log('notices error:', e.message);
            }
        }
        
        // Check events
        console.log('\n4. Checking recent events...');
        const events = await tronWeb.event.getEventsByContractAddress(
            CONTRACT_ADDRESS,
            {
                onlyConfirmed: true,
                orderBy: 'block_timestamp,desc',
                limit: 10
            }
        );
        
        console.log(`Found ${events.data?.length || 0} events`);
        events.data?.forEach(event => {
            console.log(`- ${event.event_name}:`, event.result);
        });
        
    } catch (error) {
        console.error('Error:', error.message || error);
    }
}

debugContract();
