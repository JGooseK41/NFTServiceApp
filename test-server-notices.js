const TronWeb = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io'
});

const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';
const USER_ADDRESS = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';

async function testServerNotices() {
    try {
        console.log('Contract address:', CONTRACT_ADDRESS);
        console.log('User address:', USER_ADDRESS);
        console.log('Network: MAINNET\n');
        
        const contractInfo = await tronWeb.trx.getContract(CONTRACT_ADDRESS);
        const contract = await tronWeb.contract(contractInfo.abi.entrys, CONTRACT_ADDRESS);
        
        // Try the serverNotices mapping
        console.log('=== Testing serverNotices Mapping ===');
        try {
            // serverNotices(address server, uint256 index) returns (uint256)
            // Try to get the first notice for this server
            for (let i = 0; i < 5; i++) {
                try {
                    const noticeId = await contract.serverNotices(USER_ADDRESS, i).call();
                    console.log(`serverNotices[${USER_ADDRESS}][${i}]:`, noticeId.toString());
                } catch(e) {
                    if (!e.message.includes('REVERT')) {
                        console.log(`Error at index ${i}:`, e.message);
                    }
                    break;
                }
            }
        } catch(e) {
            console.log('Error calling serverNotices:', e.message);
        }
        
        // Try getServerNotices function
        console.log('\n=== Testing getServerNotices Function ===');
        try {
            const serverNoticeIds = await contract.getServerNotices(USER_ADDRESS).call();
            console.log('getServerNotices result:', serverNoticeIds);
            if (serverNoticeIds && serverNoticeIds.length > 0) {
                console.log(`Found ${serverNoticeIds.length} notices served by user`);
                for (const noticeId of serverNoticeIds) {
                    console.log('  Notice ID:', noticeId.toString());
                }
            }
        } catch(e) {
            console.log('Error calling getServerNotices:', e.message);
        }
        
        // Get details for notice 0
        console.log('\n=== Getting Details for Notice ID 0 ===');
        try {
            // Get notice details
            const notice = await contract.notices(0).call();
            console.log('Notice 0 details:');
            console.log('  Recipient:', tronWeb.address.fromHex(notice[0]));
            console.log('  Server:', notice[1] === '410000000000000000000000000000000000000000' ? 
                'NULL (need to get from events)' : tronWeb.address.fromHex(notice[1]));
            console.log('  IPFS Hash:', notice[2]);
            console.log('  Content Hash:', notice[3]);
            console.log('  Timestamp:', new Date(Number(notice[4]) * 1000).toISOString());
            console.log('  Status:', notice[9]);
            
            // Get alert details
            const alertNotice = await contract.alertNotices(0).call();
            console.log('\nAlert Notice 0 details:');
            console.log('  Server:', tronWeb.address.fromHex(alertNotice[0]));
            console.log('  Document Notice ID:', alertNotice[1].toString());
            console.log('  Preview Image:', alertNotice[2]);
            console.log('  Timestamp:', new Date(Number(alertNotice[3]) * 1000).toISOString());
            
        } catch(e) {
            console.log('Error getting notice details:', e.message);
        }
        
        // Check recipientAlerts for the recipient
        console.log('\n=== Checking Recipient Alerts ===');
        const RECIPIENT_ADDRESS = 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH';
        try {
            for (let i = 0; i < 3; i++) {
                try {
                    const alertId = await contract.recipientAlerts(RECIPIENT_ADDRESS, i).call();
                    console.log(`recipientAlerts[${RECIPIENT_ADDRESS}][${i}]:`, alertId.toString());
                } catch(e) {
                    break;
                }
            }
        } catch(e) {
            console.log('Error checking recipientAlerts:', e.message);
        }
        
    } catch (error) {
        console.error('Error:', error.message || error);
    }
}

testServerNotices();