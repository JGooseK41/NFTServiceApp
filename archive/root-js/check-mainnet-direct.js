const TronWeb = require('tronweb');

// Use MAINNET 
const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',  // Mainnet URL
});

// Mainnet contract address provided by user
const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

// The user's address who served notices
const USER_ADDRESS = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';

async function checkMainnetDirect() {
    try {
        console.log('Contract address:', CONTRACT_ADDRESS);
        console.log('User address:', USER_ADDRESS);
        console.log('Network: MAINNET\n');
        
        // First, let's check if we can get contract info directly
        console.log('=== Checking Contract Info ===');
        try {
            const contractInfo = await tronWeb.trx.getContract(CONTRACT_ADDRESS);
            console.log('Contract found!');
            console.log('  Name:', contractInfo.name);
            console.log('  Origin address:', contractInfo.origin_address);
            console.log('  Contract exists on blockchain\n');
            
            // Get ABI to understand the contract
            if (contractInfo.abi && contractInfo.abi.entrys) {
                console.log('Contract has', contractInfo.abi.entrys.length, 'functions');
                
                // Look for notice-related functions
                const noticeFunctions = contractInfo.abi.entrys.filter(f => 
                    f.name && (f.name.includes('notice') || f.name.includes('Notice') || 
                               f.name.includes('alert') || f.name.includes('Alert'))
                );
                
                console.log('\nNotice-related functions:');
                noticeFunctions.forEach(f => {
                    console.log(`  - ${f.name}`);
                });
            }
            
            // Initialize contract
            const contract = await tronWeb.contract(contractInfo.abi.entrys, CONTRACT_ADDRESS);
            console.log('\nContract initialized successfully');
            
            // Try to get user's alerts
            console.log('\n=== Checking User Alerts ===');
            try {
                if (contract.getUserAlerts) {
                    const userAlerts = await contract.getUserAlerts(USER_ADDRESS).call();
                    console.log(`User has ${userAlerts ? userAlerts.length : 0} alerts:`, userAlerts);
                }
            } catch(e) {
                console.log('Error getting user alerts:', e.message);
            }
            
            // Try to get user's notices
            console.log('\n=== Checking User Notices ===');
            try {
                if (contract.getUserNotices) {
                    const userNotices = await contract.getUserNotices(USER_ADDRESS).call();
                    console.log(`User has ${userNotices ? userNotices.length : 0} notices:`, userNotices);
                }
            } catch(e) {
                console.log('Error getting user notices:', e.message);
            }
            
        } catch(e) {
            console.log('Error getting contract:', e.message);
            console.log('This might mean the contract is not verified or does not exist at this address');
        }
        
        // Check for transactions to/from this contract
        console.log('\n=== Checking Recent Transactions ===');
        try {
            const response = await fetch(`https://api.trongrid.io/v1/contracts/${CONTRACT_ADDRESS}/transactions?limit=10`);
            const data = await response.json();
            
            if (data && data.data) {
                console.log(`Found ${data.data.length} recent transactions`);
                
                // Look for transactions involving our user
                const userTxs = data.data.filter(tx => {
                    return tx.from === USER_ADDRESS || tx.to === USER_ADDRESS ||
                           (tx.contract_data && tx.contract_data.includes(USER_ADDRESS.substring(2).toLowerCase()));
                });
                
                if (userTxs.length > 0) {
                    console.log(`\nFound ${userTxs.length} transactions involving user ${USER_ADDRESS}`);
                    userTxs.forEach((tx, idx) => {
                        console.log(`\nTransaction ${idx + 1}:`);
                        console.log('  TxID:', tx.transaction_id);
                        console.log('  From:', tx.from);
                        console.log('  Timestamp:', new Date(tx.block_timestamp).toISOString());
                    });
                } else {
                    console.log('No transactions found involving the user');
                    
                    // Show some recent transactions
                    if (data.data.length > 0) {
                        console.log('\nShowing 3 most recent transactions:');
                        data.data.slice(0, 3).forEach((tx, idx) => {
                            console.log(`\nTransaction ${idx + 1}:`);
                            console.log('  From:', tx.from);
                            console.log('  Timestamp:', new Date(tx.block_timestamp).toISOString());
                        });
                    }
                }
            } else {
                console.log('No transactions found for this contract');
            }
        } catch(e) {
            console.log('Error fetching transactions:', e.message);
        }
        
        // Try to get events directly via API
        console.log('\n=== Checking Events via API ===');
        try {
            // Try TronGrid events endpoint
            const eventResponse = await fetch(
                `https://api.trongrid.io/v1/contracts/${CONTRACT_ADDRESS}/events?limit=50`
            );
            const eventData = await eventResponse.json();
            
            if (eventData && eventData.data) {
                console.log(`Found ${eventData.data.length} events`);
                
                // Group by event name
                const eventTypes = {};
                eventData.data.forEach(event => {
                    const name = event.event_name || 'Unknown';
                    eventTypes[name] = (eventTypes[name] || 0) + 1;
                });
                
                console.log('\nEvent types:');
                Object.entries(eventTypes).forEach(([name, count]) => {
                    console.log(`  ${name}: ${count}`);
                });
                
                // Look for LegalNoticeCreated events
                const noticeEvents = eventData.data.filter(e => 
                    e.event_name === 'LegalNoticeCreated'
                );
                
                if (noticeEvents.length > 0) {
                    console.log(`\nFound ${noticeEvents.length} LegalNoticeCreated events`);
                    
                    // Check for user's events
                    const userNoticeEvents = noticeEvents.filter(event => {
                        if (event.result && event.result.server) {
                            try {
                                const serverAddr = tronWeb.address.fromHex(event.result.server);
                                return serverAddr === USER_ADDRESS;
                            } catch(e) {}
                        }
                        return false;
                    });
                    
                    if (userNoticeEvents.length > 0) {
                        console.log(`\n*** Found ${userNoticeEvents.length} notices served by ${USER_ADDRESS} ***`);
                        userNoticeEvents.forEach((event, idx) => {
                            console.log(`\nNotice ${idx + 1}:`);
                            if (event.result) {
                                console.log('  Notice ID:', event.result.noticeId);
                                console.log('  Server:', tronWeb.address.fromHex(event.result.server));
                                console.log('  Recipient:', tronWeb.address.fromHex(event.result.recipient));
                                console.log('  Timestamp:', new Date(event.block_timestamp).toISOString());
                            }
                        });
                    }
                }
            } else {
                console.log('No events found via API');
            }
        } catch(e) {
            console.log('Error fetching events:', e.message);
        }
        
    } catch (error) {
        console.error('Error:', error.message || error);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
    }
}

checkMainnetDirect();