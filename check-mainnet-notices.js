const TronWeb = require('tronweb');

// Use MAINNET 
const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',  // Mainnet URL
    // No API key for now, will use public endpoint
});

// Mainnet contract address from index.html
const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

// The user's address who served notices
const USER_ADDRESS = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';

async function checkMainnetNotices() {
    try {
        console.log('Contract address:', CONTRACT_ADDRESS);
        console.log('User address:', USER_ADDRESS);
        console.log('Network: MAINNET');
        
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
        console.log('Contract loaded successfully');
        
        // Check for any existing notices
        console.log('\n=== Checking for existing notices on MAINNET ===');
        let foundNotices = [];
        
        for (let i = 1; i <= 10; i++) {
            try {
                const notice = await contract.notices(i).call();
                // Check if notice exists (has non-zero recipient)
                if (notice && notice[0] && notice[0] !== '410000000000000000000000000000000000000000') {
                    console.log(`\nNotice ${i} exists:`);
                    console.log('  Recipient (hex):', notice[0]);
                    try {
                        const recipientBase58 = tronWeb.address.fromHex(notice[0]);
                        console.log('  Recipient (base58):', recipientBase58);
                    } catch(e) {}
                    
                    console.log('  Server (hex):', notice[1]);
                    if (notice[1] && notice[1] !== '410000000000000000000000000000000000000000') {
                        try {
                            const serverBase58 = tronWeb.address.fromHex(notice[1]);
                            console.log('  Server (base58):', serverBase58);
                            
                            // Check if this is served by our user
                            if (serverBase58 === USER_ADDRESS) {
                                console.log('  *** THIS NOTICE WAS SERVED BY USER ***');
                            }
                        } catch(e) {}
                    } else {
                        console.log('  Server is null address (need to get from events)');
                    }
                    
                    console.log('  IPFS Hash:', notice[2]);
                    console.log('  Timestamp:', notice[4] ? new Date(Number(notice[4]) * 1000).toISOString() : 'null');
                    
                    foundNotices.push(i);
                }
            } catch(e) {
                // Notice doesn't exist or error reading it
                if (e.message && !e.message.includes('REVERT')) {
                    console.log(`Error reading notice ${i}:`, e.message);
                }
            }
        }
        
        if (foundNotices.length === 0) {
            console.log('\nNo notices found in contract storage (1-10)');
        } else {
            console.log(`\nFound ${foundNotices.length} notices: IDs ${foundNotices.join(', ')}`);
        }
        
        // Check events
        console.log('\n=== Checking Events on MAINNET ===');
        
        // Get LegalNoticeCreated events
        console.log('\nQuerying LegalNoticeCreated events...');
        try {
            const events = await tronWeb.event.getEventsByContractAddress(
                CONTRACT_ADDRESS,
                {
                    eventName: 'LegalNoticeCreated',
                    onlyConfirmed: true,
                    orderBy: 'block_timestamp,desc',
                    limit: 50
                }
            );
            
            if (events && events.data && events.data.length > 0) {
                console.log(`Found ${events.data.length} LegalNoticeCreated events`);
                
                // Filter events for our user
                const userEvents = events.data.filter(event => {
                    if (event.result && event.result.server) {
                        try {
                            const serverBase58 = tronWeb.address.fromHex(event.result.server);
                            return serverBase58 === USER_ADDRESS;
                        } catch(e) {}
                    }
                    return false;
                });
                
                if (userEvents.length > 0) {
                    console.log(`\n*** Found ${userEvents.length} notices served by ${USER_ADDRESS} ***`);
                    userEvents.forEach((event, idx) => {
                        console.log(`\nNotice ${idx + 1}:`);
                        console.log('  Notice ID:', event.result.noticeId ? event.result.noticeId.toString() : 'null');
                        console.log('  Alert ID:', event.result.alertId ? event.result.alertId.toString() : 'null');
                        console.log('  Server:', tronWeb.address.fromHex(event.result.server));
                        console.log('  Recipient:', tronWeb.address.fromHex(event.result.recipient));
                        console.log('  IPFS Hash:', event.result.ipfsHash);
                        console.log('  Timestamp:', new Date(event.block_timestamp).toISOString());
                        console.log('  Block:', event.block);
                        console.log('  Transaction:', event.transaction_id);
                    });
                } else {
                    console.log('\nNo events found for user address');
                    
                    // Show first few events to see what's there
                    console.log('\nShowing first 3 events (any server):');
                    events.data.slice(0, 3).forEach((event, idx) => {
                        if (event.result) {
                            console.log(`\nEvent ${idx + 1}:`);
                            console.log('  Notice ID:', event.result.noticeId ? event.result.noticeId.toString() : 'null');
                            console.log('  Server (hex):', event.result.server);
                            if (event.result.server) {
                                try {
                                    console.log('  Server (base58):', tronWeb.address.fromHex(event.result.server));
                                } catch(e) {}
                            }
                            console.log('  Timestamp:', new Date(event.block_timestamp).toISOString());
                        }
                    });
                }
            } else {
                console.log('No LegalNoticeCreated events found');
            }
        } catch(e) {
            console.log('Error querying LegalNoticeCreated:', e.message);
        }
        
        // Also check alerts
        console.log('\n=== Checking Alert Storage ===');
        for (let i = 1; i <= 5; i++) {
            try {
                const alert = await contract.alerts(i).call();
                if (alert && alert[0] && alert[0] !== '410000000000000000000000000000000000000000') {
                    console.log(`\nAlert ${i}:`);
                    console.log('  Server (hex):', alert[0]);
                    try {
                        const serverBase58 = tronWeb.address.fromHex(alert[0]);
                        console.log('  Server (base58):', serverBase58);
                        if (serverBase58 === USER_ADDRESS) {
                            console.log('  *** THIS ALERT WAS CREATED BY USER ***');
                        }
                    } catch(e) {}
                    console.log('  Notice ID:', alert[1] ? alert[1].toString() : 'null');
                    console.log('  IPFS Hash:', alert[2]);
                }
            } catch(e) {
                // Alert doesn't exist
                if (e.message && !e.message.includes('REVERT')) {
                    console.log(`Error reading alert ${i}:`, e.message);
                }
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message || error);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
    }
}

checkMainnetNotices();