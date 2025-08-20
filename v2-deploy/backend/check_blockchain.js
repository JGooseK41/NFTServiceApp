const TronWeb = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': 'your-api-key' },
    privateKey: '0000000000000000000000000000000000000000000000000000000000000001'
});

const CONTRACT_ADDRESS = 'TLkmbRvmyR3DmUNJXHh2pgTqiyqzPcDXRn';

async function checkNoticeData() {
    try {
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
        
        console.log('Checking Notice #2 data from blockchain...\n');
        
        // Check alertNotices
        try {
            const alertData = await contract.alertNotices(2).call();
            console.log('AlertNotices[2] raw data:');
            console.log('Full array:', alertData);
            console.log('Length:', alertData.length);
            
            if (alertData && Array.isArray(alertData)) {
                console.log('\nParsed fields:');
                console.log('[0] recipient:', alertData[0]);
                console.log('[1] server/sender:', alertData[1]);
                
                // Try to decode server address
                if (alertData[1]) {
                    console.log('\nServer field analysis:');
                    console.log('Raw value:', alertData[1]);
                    console.log('Type:', typeof alertData[1]);
                    
                    // Check if it's the zero address
                    const serverHex = alertData[1].toString();
                    if (serverHex === '0x0000000000000000000000000000000000000000' || 
                        serverHex === '410000000000000000000000000000000000000000') {
                        console.log('This is the null/zero address');
                        const decoded = tronWeb.address.fromHex('410000000000000000000000000000000000000000');
                        console.log('Decoded null address:', decoded);
                    } else {
                        console.log('Not a null address, trying to decode...');
                        try {
                            const decoded = tronWeb.address.fromHex(serverHex);
                            console.log('Decoded address:', decoded);
                        } catch (e) {
                            console.log('Could not decode:', e.message);
                        }
                    }
                }
            }
        } catch (e) {
            console.log('Error reading alertNotices:', e.message);
        }
        
        // Check who created the transaction
        console.log('\n\nChecking transaction history...');
        const events = await tronWeb.event.getEventsByContractAddress(
            CONTRACT_ADDRESS,
            {
                onlyConfirmed: true,
                limit: 50
            }
        );
        
        if (events && events.length > 0) {
            console.log('Found', events.length, 'events');
            
            // Look for notice 2 events
            const notice2Events = events.filter(e => 
                (e.result && (e.result.noticeId == '2' || e.result.alertId == '2' || e.result.documentId == '2'))
            );
            
            console.log('\nEvents for notice 2:', notice2Events.length);
            
            if (notice2Events.length > 0) {
                const event = notice2Events[0];
                console.log('\nFirst event for notice 2:');
                console.log('Event name:', event.name);
                console.log('Event result:', event.result);
                
                // Get transaction details
                if (event.transaction) {
                    console.log('\nTransaction ID:', event.transaction);
                    
                    try {
                        const tx = await tronWeb.trx.getTransaction(event.transaction);
                        if (tx && tx.raw_data && tx.raw_data.contract && tx.raw_data.contract[0]) {
                            const contractData = tx.raw_data.contract[0];
                            
                            if (contractData.parameter && contractData.parameter.value) {
                                const ownerAddress = contractData.parameter.value.owner_address;
                                if (ownerAddress) {
                                    const txSender = tronWeb.address.fromHex('41' + ownerAddress);
                                    console.log('\nTransaction sender (actual server):', txSender);
                                }
                            }
                        }
                    } catch (e) {
                        console.log('Could not get transaction details:', e.message);
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkNoticeData();
