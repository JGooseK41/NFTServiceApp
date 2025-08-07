const TronWeb = require('tronweb');

const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: privateKey
});

const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';
const USER_ADDRESS = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';
const RECIPIENT = 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH';

async function checkAllData() {
    try {
        console.log('=== COMPREHENSIVE DATA CHECK ===');
        console.log('Contract:', CONTRACT_ADDRESS);
        console.log('Server:', USER_ADDRESS);
        console.log('Recipient:', RECIPIENT);
        console.log('');
        
        const contractInfo = await tronWeb.trx.getContract(CONTRACT_ADDRESS);
        const contract = await tronWeb.contract(contractInfo.abi.entrys, CONTRACT_ADDRESS);
        
        // Check what the server has
        console.log('=== SERVER\'S NOTICES ===');
        const serverNotices = await contract.getServerNotices(USER_ADDRESS).call();
        console.log('Server has notice IDs:', serverNotices.map(n => n.toString()));
        
        // Check each notice
        for (const noticeId of serverNotices) {
            const id = noticeId.toString();
            console.log(`\n--- Notice ${id} ---`);
            
            const notice = await contract.notices(id).call();
            console.log('Notice data:');
            console.log('  Alert ID:', notice.alertId ? notice.alertId.toString() : notice[0].toString());
            console.log('  Document ID:', notice.documentId ? notice.documentId.toString() : notice[1].toString());
            console.log('  Server:', tronWeb.address.fromHex(notice.server || notice[2]));
            console.log('  Recipient:', tronWeb.address.fromHex(notice.recipient || notice[3]));
            console.log('  Timestamp:', new Date(Number(notice.timestamp || notice[4]) * 1000).toISOString());
            console.log('  Acknowledged:', notice.acknowledged || notice[5]);
            console.log('  Notice Type:', notice.noticeType || notice[6]);
            console.log('  Case Number:', notice.caseNumber || notice[7]);
        }
        
        // Check all alert notices (0-5)
        console.log('\n=== ALL ALERT NOTICES (0-5) ===');
        for (let i = 0; i <= 5; i++) {
            try {
                const alert = await contract.alertNotices(i).call();
                // Check if alert exists (non-zero recipient)
                if (alert && alert[0] && alert[0] !== '410000000000000000000000000000000000000000') {
                    console.log(`\nAlert ${i}:`);
                    console.log('  Recipient:', tronWeb.address.fromHex(alert.recipient || alert[0]));
                    console.log('  Sender:', tronWeb.address.fromHex(alert.sender || alert[1]));
                    console.log('  Document ID:', alert.documentId ? alert.documentId.toString() : alert[2].toString());
                    console.log('  Timestamp:', new Date(Number(alert.timestamp || alert[3]) * 1000).toISOString());
                    console.log('  Acknowledged:', alert.acknowledged || alert[4]);
                    console.log('  Preview Image:', alert.previewImage || alert[11]);
                }
            } catch(e) {
                // Alert doesn't exist
            }
        }
        
        // Check all document notices (0-5)
        console.log('\n=== ALL DOCUMENT NOTICES (0-5) ===');
        for (let i = 0; i <= 5; i++) {
            try {
                const doc = await contract.documentNotices(i).call();
                // Check if document exists
                if (doc && (doc[0] || doc.encryptedIPFS)) {
                    console.log(`\nDocument ${i}:`);
                    console.log('  IPFS Hash:', doc.encryptedIPFS || doc[0]);
                    console.log('  Decryption Key:', doc.decryptionKey || doc[1]);
                    console.log('  Authorized Viewer:', tronWeb.address.fromHex(doc.authorizedViewer || doc[2]));
                    console.log('  Alert ID:', doc.alertId ? doc.alertId.toString() : doc[3].toString());
                    console.log('  Is Restricted:', doc.isRestricted || doc[4]);
                }
            } catch(e) {
                // Document doesn't exist
            }
        }
        
        // Check recipient's alerts
        console.log('\n=== RECIPIENT\'S ALERTS ===');
        try {
            const recipientAlerts = await contract.getRecipientAlerts(RECIPIENT).call();
            console.log('Recipient has alert IDs:', recipientAlerts.map(a => a.toString()));
        } catch(e) {
            console.log('Error getting recipient alerts:', e.message);
        }
        
        // Check events
        console.log('\n=== EVENTS ===');
        const response = await fetch(
            `https://api.trongrid.io/v1/contracts/${CONTRACT_ADDRESS}/events?limit=50`
        );
        const eventData = await response.json();
        
        if (eventData && eventData.data) {
            // Group events by type
            const eventsByType = {};
            eventData.data.forEach(event => {
                const type = event.event_name;
                if (!eventsByType[type]) eventsByType[type] = [];
                eventsByType[type].push(event);
            });
            
            // Show LegalNoticeCreated events
            if (eventsByType['LegalNoticeCreated']) {
                console.log('\nLegalNoticeCreated events:');
                eventsByType['LegalNoticeCreated'].forEach(event => {
                    if (event.result) {
                        console.log(`  Notice ${event.result.noticeId}, Alert ${event.result.alertId}, Server: ${tronWeb.address.fromHex(event.result.server)}`);
                    }
                });
            }
            
            // Show NoticeServed events
            if (eventsByType['NoticeServed']) {
                console.log('\nNoticeServed events:');
                eventsByType['NoticeServed'].forEach(event => {
                    if (event.result) {
                        console.log(`  Document ${event.result.documentId}, Alert ${event.result.alertId}`);
                    }
                });
            }
            
            // Show NoticeAcknowledged events
            if (eventsByType['NoticeAcknowledged']) {
                console.log('\nNoticeAcknowledged events:');
                eventsByType['NoticeAcknowledged'].forEach(event => {
                    if (event.result) {
                        console.log(`  Alert ${event.result.alertId} acknowledged by ${tronWeb.address.fromHex(event.result.recipient)}`);
                    }
                });
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message || error);
    }
}

checkAllData();