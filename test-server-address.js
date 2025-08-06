const TronWeb = require('tronweb');

// Set the default address
const privateKey = '36466bd27e7c316abef7474c9a6c55081dd099734e376ca36dfba63d0bf521c0';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': '5e775959-bb2f-4b8e-ab77-33577e3f2fc3' },
    privateKey: privateKey
});

const CONTRACT_ADDRESS = 'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh';

async function testServerAddressRetrieval() {
    try {
        const userAddress = tronWeb.address.fromPrivateKey(privateKey);
        console.log('Using address:', userAddress);
        console.log('Connecting to contract:', CONTRACT_ADDRESS);
        
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
        console.log('Contract loaded successfully');
        
        // Now try to call the contract methods
        console.log('\n=== Testing Contract Calls ===');
        try {
            console.log('Calling alerts(1)...');
            const alert1 = await contract.alerts(1).call();
            console.log('Alert 1 raw result:', alert1);
            
            // Parse the result
            if (alert1) {
                console.log('Alert 1 parsed:');
                console.log('  Server:', alert1[0] || alert1.server);
                if (alert1[0] || alert1.server) {
                    const serverAddr = alert1[0] || alert1.server;
                    if (serverAddr !== '410000000000000000000000000000000000000000') {
                        try {
                            console.log('  Server (base58):', tronWeb.address.fromHex(serverAddr));
                        } catch(e) {
                            console.log('  Could not convert to base58');
                        }
                    } else {
                        console.log('  Server is null address');
                    }
                }
                console.log('  Notice ID:', alert1[1] ? alert1[1].toString() : 'null');
                console.log('  IPFS Hash:', alert1[2]);
            }
        } catch(e) {
            console.log('Error calling alerts(1):', e.message || e);
        }
        
        try {
            console.log('\nCalling notices(1)...');
            const notice1 = await contract.notices(1).call();
            console.log('Notice 1 raw result:', notice1);
            
            if (notice1) {
                console.log('Notice 1 parsed:');
                console.log('  Recipient:', notice1[0] || notice1.recipient);
                console.log('  Server:', notice1[1] || notice1.server);
                if (notice1[1] || notice1.server) {
                    const serverAddr = notice1[1] || notice1.server;
                    if (serverAddr !== '410000000000000000000000000000000000000000') {
                        try {
                            console.log('  Server (base58):', tronWeb.address.fromHex(serverAddr));
                        } catch(e) {
                            console.log('  Could not convert to base58');
                        }
                    } else {
                        console.log('  Server is null address');
                    }
                }
                console.log('  IPFS Hash:', notice1[2]);
            }
        } catch(e) {
            console.log('Error calling notices(1):', e.message || e);
        }
        
        // Check the events
        console.log('\n=== Checking Events ===');
        const events = await tronWeb.event.getEventsByContractAddress(
            CONTRACT_ADDRESS,
            {
                eventName: 'LegalNoticeCreated',
                onlyConfirmed: true,
                orderBy: 'block_timestamp,desc',
                limit: 200
            }
        );
        
        if (events && events.data && events.data.length > 0) {
            console.log(`Found ${events.data.length} LegalNoticeCreated events`);
            
            // Find event for notice 1
            const notice1Event = events.data.find(e => 
                e.result && e.result.noticeId && e.result.noticeId.toString() === '1'
            );
            
            if (notice1Event) {
                console.log('\nLegalNoticeCreated Event for Notice 1:');
                console.log('  Notice ID:', notice1Event.result.noticeId.toString());
                console.log('  Alert ID:', notice1Event.result.alertId ? notice1Event.result.alertId.toString() : 'null');
                console.log('  Server (hex):', notice1Event.result.server);
                console.log('  Server (base58):', tronWeb.address.fromHex(notice1Event.result.server));
                console.log('  Recipient (hex):', notice1Event.result.recipient);
                console.log('  Recipient (base58):', tronWeb.address.fromHex(notice1Event.result.recipient));
                console.log('  Timestamp:', new Date(notice1Event.block_timestamp).toISOString());
            } else {
                // Show first few events to debug
                console.log('\nShowing first 3 events:');
                events.data.slice(0, 3).forEach((event, idx) => {
                    if (event.result) {
                        console.log(`\nEvent ${idx + 1}:`);
                        console.log('  Notice ID:', event.result.noticeId ? event.result.noticeId.toString() : 'null');
                        console.log('  Server:', event.result.server);
                        if (event.result.server) {
                            try {
                                console.log('  Server (base58):', tronWeb.address.fromHex(event.result.server));
                            } catch(e) {}
                        }
                    }
                });
            }
        } else {
            console.log('No events found');
        }
        
    } catch (error) {
        console.error('Error:', error.message || error);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
    }
}

testServerAddressRetrieval();