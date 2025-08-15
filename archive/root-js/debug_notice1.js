// Debug script to check notice #1
const TronWeb = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { "TRON-PRO-API-KEY": '9fc4cbb6-de76-486f-a8a3-bbf827c7d905' },
});

const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

async function debugNotice1() {
    console.log('=== DEBUGGING NOTICE #1 ===\n');
    
    try {
        console.log('Contract address:', CONTRACT_ADDRESS);
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
        console.log('Contract loaded successfully\n');
        
        // Check documentNotices[1]
        console.log('1. Checking documentNotices[1]:');
        let docData;
        try {
            docData = await contract.documentNotices(1).call();
        } catch (e) {
            console.log('Error calling documentNotices:', e.message || e);
            docData = null;
        }
        console.log('Raw document data:', docData);
        
        if (docData && Array.isArray(docData)) {
            console.log('- documentId:', docData[0]);
            console.log('- server:', docData[1]);
            if (docData[1] && docData[1].startsWith('41')) {
                console.log('  - server (base58):', tronWeb.address.fromHex(docData[1]));
            }
            console.log('- recipient:', docData[2]);
            if (docData[2] && docData[2].startsWith('41')) {
                console.log('  - recipient (base58):', tronWeb.address.fromHex(docData[2]));
            }
            console.log('- ipfsHash:', docData[3]);
            console.log('- accepted:', docData[4]);
        }
        
        // Check alertNotices[1]
        console.log('\n2. Checking alertNotices[1]:');
        const alertData = await contract.alertNotices(1).call();
        console.log('Raw alert data:', alertData);
        
        if (alertData && Array.isArray(alertData)) {
            console.log('- recipient:', alertData[0]);
            if (alertData[0] && alertData[0].startsWith('41')) {
                console.log('  - recipient (base58):', tronWeb.address.fromHex(alertData[0]));
            }
            console.log('- server:', alertData[1]);
            if (alertData[1] && alertData[1].startsWith('41')) {
                console.log('  - server (base58):', tronWeb.address.fromHex(alertData[1]));
            }
            console.log('- documentId:', alertData[2]);
            console.log('- timestamp:', alertData[3]);
            console.log('- acknowledged:', alertData[4]);
        }
        
        // Check total notices
        console.log('\n3. Checking total notices:');
        const totalNotices = await contract.totalNotices().call();
        console.log('Total notices:', totalNotices.toString());
        
        // Check events
        console.log('\n4. Checking events for notice #1:');
        const events = await tronWeb.event.getEventsByContractAddress(
            CONTRACT_ADDRESS,
            {
                onlyConfirmed: true,
                orderBy: 'block_timestamp,desc',
                limit: 200
            }
        );
        
        const notice1Events = events.data?.filter(e => 
            e.result?.noticeId === '1' || 
            e.result?.documentId === '1' || 
            e.result?.alertId === '1'
        );
        
        console.log('Events for notice #1:', notice1Events.length);
        notice1Events.forEach(e => {
            console.log('- Event:', e.event_name, 'Result:', e.result);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugNotice1();
