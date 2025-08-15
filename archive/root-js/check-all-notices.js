const TronWeb = require('tronweb');

const privateKey = '36466bd27e7c316abef7474c9a6c55081dd099734e376ca36dfba63d0bf521c0';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': '5e775959-bb2f-4b8e-ab77-33577e3f2fc3' },
    privateKey: privateKey
});

const CONTRACT_ADDRESS = 'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh';

async function checkAllNotices() {
    try {
        const userAddress = tronWeb.address.fromPrivateKey(privateKey);
        console.log('Using address:', userAddress);
        console.log('Contract address:', CONTRACT_ADDRESS);
        
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
        
        // Check for any existing notices
        console.log('\n=== Checking for existing notices ===');
        let foundNotices = [];
        
        for (let i = 0; i <= 10; i++) {
            try {
                const notice = await contract.notices(i).call();
                // Check if notice exists (has non-zero recipient)
                if (notice && notice[0] && notice[0] !== '410000000000000000000000000000000000000000') {
                    console.log(`\nNotice ${i} exists:`);
                    console.log('  Recipient:', notice[0]);
                    try {
                        console.log('  Recipient (base58):', tronWeb.address.fromHex(notice[0]));
                    } catch(e) {}
                    console.log('  Server:', notice[1]);
                    if (notice[1] && notice[1] !== '410000000000000000000000000000000000000000') {
                        try {
                            console.log('  Server (base58):', tronWeb.address.fromHex(notice[1]));
                        } catch(e) {}
                    }
                    console.log('  IPFS Hash:', notice[2]);
                    foundNotices.push(i);
                }
            } catch(e) {
                // Notice doesn't exist or error reading it
            }
        }
        
        if (foundNotices.length === 0) {
            console.log('\nNo notices found in contract storage (0-10)');
        } else {
            console.log(`\nFound ${foundNotices.length} notices: IDs ${foundNotices.join(', ')}`);
        }
        
        // Check events
        console.log('\n=== Checking Events ===');
        
        // Try different event queries
        const eventQueries = [
            { eventName: 'LegalNoticeCreated' },
            { eventName: 'NoticeAccepted' },
            { eventName: 'Transfer' }
        ];
        
        for (const query of eventQueries) {
            console.log(`\nQuerying ${query.eventName} events...`);
            try {
                const events = await tronWeb.event.getEventsByContractAddress(
                    CONTRACT_ADDRESS,
                    {
                        ...query,
                        onlyConfirmed: true,
                        orderBy: 'block_timestamp,desc',
                        limit: 50
                    }
                );
                
                if (events && events.data && events.data.length > 0) {
                    console.log(`Found ${events.data.length} ${query.eventName} events`);
                    
                    // Show first event details
                    const firstEvent = events.data[0];
                    console.log('First event:');
                    console.log('  Block:', firstEvent.block);
                    console.log('  Timestamp:', new Date(firstEvent.block_timestamp).toISOString());
                    if (firstEvent.result) {
                        console.log('  Result:', JSON.stringify(firstEvent.result, null, 2));
                    }
                } else {
                    console.log(`No ${query.eventName} events found`);
                }
            } catch(e) {
                console.log(`Error querying ${query.eventName}:`, e.message);
            }
        }
        
        // Try getting all events without filtering by name
        console.log('\n=== All Contract Events ===');
        try {
            const allEvents = await tronWeb.event.getEventsByContractAddress(
                CONTRACT_ADDRESS,
                {
                    onlyConfirmed: true,
                    orderBy: 'block_timestamp,desc',
                    limit: 10
                }
            );
            
            if (allEvents && allEvents.data && allEvents.data.length > 0) {
                console.log(`\nFound ${allEvents.data.length} total events`);
                
                // Group by event name
                const eventTypes = {};
                allEvents.data.forEach(event => {
                    const name = event.event_name || 'Unknown';
                    eventTypes[name] = (eventTypes[name] || 0) + 1;
                });
                
                console.log('\nEvent types:');
                Object.entries(eventTypes).forEach(([name, count]) => {
                    console.log(`  ${name}: ${count}`);
                });
                
                // Show details of most recent event
                const recentEvent = allEvents.data[0];
                console.log('\nMost recent event:');
                console.log('  Event name:', recentEvent.event_name);
                console.log('  Block:', recentEvent.block);
                console.log('  Timestamp:', new Date(recentEvent.block_timestamp).toISOString());
                if (recentEvent.result) {
                    console.log('  Result:', JSON.stringify(recentEvent.result, null, 2));
                }
            } else {
                console.log('No events found for this contract');
            }
        } catch(e) {
            console.log('Error getting all events:', e.message);
        }
        
    } catch (error) {
        console.error('Error:', error.message || error);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
    }
}

checkAllNotices();