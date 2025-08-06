const TronWeb = require('tronweb');

const privateKey = '0000000000000000000000000000000000000000000000000000000000000001'; // dummy key for read-only

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: privateKey
});

const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';
const USER_ADDRESS = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';

async function testDocumentNotices() {
    try {
        console.log('Contract address:', CONTRACT_ADDRESS);
        console.log('User address (server):', USER_ADDRESS);
        console.log('Network: MAINNET\n');
        
        const contractInfo = await tronWeb.trx.getContract(CONTRACT_ADDRESS);
        const contract = await tronWeb.contract(contractInfo.abi.entrys, CONTRACT_ADDRESS);
        
        // The notice structure from our test showed:
        // Notice 0: alertId=1, documentId=2, server=TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY
        
        console.log('=== Checking Document Notice ID 2 (from Notice 0) ===');
        try {
            // documentNotices should give us the actual document data
            const docNotice = await contract.documentNotices(2).call();
            console.log('Document Notice 2 raw result:', docNotice);
            
            if (docNotice) {
                console.log('\nDocument Notice 2 parsed:');
                console.log('  Recipient:', docNotice[0] || docNotice.recipient);
                if (docNotice[0] && docNotice[0] !== '410000000000000000000000000000000000000000') {
                    try {
                        console.log('  Recipient (base58):', tronWeb.address.fromHex(docNotice[0] || docNotice.recipient));
                    } catch(e) {}
                }
                
                console.log('  Server:', docNotice[1] || docNotice.server);
                if (docNotice[1] && docNotice[1] !== '410000000000000000000000000000000000000000') {
                    try {
                        console.log('  Server (base58):', tronWeb.address.fromHex(docNotice[1] || docNotice.server));
                    } catch(e) {}
                }
                
                console.log('  IPFS Hash:', docNotice[2] || docNotice.ipfsHash);
                console.log('  Content Hash:', docNotice[3] || docNotice.contentHash);
                console.log('  Timestamp:', docNotice[4] || docNotice.timestamp);
                console.log('  Status:', docNotice[9] || docNotice.status);
            }
        } catch(e) {
            console.log('Error calling documentNotices(2):', e.message);
        }
        
        // Also check serverNotices to see what document IDs the server has
        console.log('\n=== Checking Server Document Notices ===');
        try {
            // serverNotices maps server address to notice IDs
            // We know from earlier that serverNotices[USER_ADDRESS][0] = 0
            // But notice 0 has documentId = 2, so let's check if there's a way to get document IDs directly
            
            const noticeIds = await contract.getServerNotices(USER_ADDRESS).call();
            console.log('Server has notices:', noticeIds);
            
            for (const noticeId of noticeIds) {
                const id = noticeId.toString();
                const notice = await contract.notices(id).call();
                if (notice) {
                    const docId = notice.documentId || notice[1];
                    console.log(`\nNotice ${id} -> Document ID: ${docId}`);
                    
                    // Get the document details
                    if (docId && docId.toString() !== '0') {
                        try {
                            const docData = await contract.documentNotices(docId).call();
                            console.log(`  Document ${docId} details:`);
                            console.log('    Recipient:', tronWeb.address.fromHex(docData[0] || docData.recipient));
                            console.log('    Server:', tronWeb.address.fromHex(docData[1] || docData.server));
                            console.log('    IPFS:', docData[2] || docData.ipfsHash);
                            console.log('    Timestamp:', new Date(Number(docData[4] || docData.timestamp) * 1000).toISOString());
                        } catch(e) {
                            console.log(`  Error getting document ${docId}:`, e.message);
                        }
                    }
                }
            }
        } catch(e) {
            console.log('Error checking server document notices:', e.message);
        }
        
        // Try to find events for document notices
        console.log('\n=== Checking NoticeServed Events (for documents) ===');
        try {
            const response = await fetch(
                `https://api.trongrid.io/v1/contracts/${CONTRACT_ADDRESS}/events?limit=50`
            );
            const eventData = await response.json();
            
            if (eventData && eventData.data) {
                const noticeServedEvents = eventData.data.filter(e => e.event_name === 'NoticeServed');
                
                if (noticeServedEvents.length > 0) {
                    console.log(`Found ${noticeServedEvents.length} NoticeServed events`);
                    
                    noticeServedEvents.forEach((event, idx) => {
                        if (event.result) {
                            console.log(`\nNoticeServed Event ${idx + 1}:`);
                            console.log('  Document ID:', event.result.documentId);
                            console.log('  Server:', event.result.server);
                            if (event.result.server) {
                                try {
                                    const serverAddr = tronWeb.address.fromHex(event.result.server);
                                    console.log('  Server (base58):', serverAddr);
                                    if (serverAddr === USER_ADDRESS) {
                                        console.log('  *** THIS DOCUMENT WAS SERVED BY USER ***');
                                    }
                                } catch(e) {}
                            }
                            console.log('  Timestamp:', new Date(event.block_timestamp).toISOString());
                        }
                    });
                }
            }
        } catch(e) {
            console.log('Error fetching NoticeServed events:', e.message);
        }
        
    } catch (error) {
        console.error('Main error:', error.message || error);
    }
}

testDocumentNotices();