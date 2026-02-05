/**
 * Query detailed token data from blockchain events
 */

const axios = require('axios');

const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';
const TRONGRID_API = 'https://api.trongrid.io';

async function getAllEvents() {
    try {
        // Get all events without filtering by name
        const response = await axios.get(
            `${TRONGRID_API}/v1/contracts/${CONTRACT_ADDRESS}/events`,
            { params: { limit: 200, only_confirmed: true } }
        );
        return response.data;
    } catch (e) {
        console.error('Error:', e.message);
        return null;
    }
}

async function main() {
    console.log('Fetching all contract events...\n');

    const events = await getAllEvents();

    if (!events || !events.data) {
        console.log('No events found');
        return;
    }

    // Group events by type
    const eventsByType = {};
    events.data.forEach(evt => {
        const name = evt.event_name;
        if (!eventsByType[name]) {
            eventsByType[name] = [];
        }
        eventsByType[name].push(evt);
    });

    console.log('Event types found:');
    Object.keys(eventsByType).forEach(name => {
        console.log(`  ${name}: ${eventsByType[name].length} events`);
    });

    // Show details for NoticeCreated events if they exist
    if (eventsByType['NoticeCreated']) {
        console.log('\n=== NOTICE CREATED EVENTS ===\n');
        eventsByType['NoticeCreated'].forEach(evt => {
            console.log(`Alert #${evt.result?.alertId || evt.result?._alertId}`);
            console.log(`  Document #${evt.result?.documentId || evt.result?._documentId}`);
            console.log(`  Server: ${evt.result?.server || evt.result?._server}`);
            console.log(`  Recipient: ${evt.result?.recipient || evt.result?._recipient}`);
            console.log(`  Time: ${new Date(evt.block_timestamp).toISOString()}`);
            console.log(`  TX: ${evt.transaction_id}`);
            console.log('');
        });
    }

    // Show Transfer events for tokens 1, 17, 29, 37
    if (eventsByType['Transfer']) {
        console.log('\n=== TRANSFER EVENTS FOR TOKENS 1, 17, 29, 37 ===\n');
        const targetTokens = ['1', '2', '17', '18', '29', '30', '37', '38'];
        eventsByType['Transfer']
            .filter(evt => {
                const tokenId = evt.result?.tokenId?.toString() || evt.result?._tokenId?.toString();
                return targetTokens.includes(tokenId);
            })
            .forEach(evt => {
                const tokenId = evt.result?.tokenId || evt.result?._tokenId;
                console.log(`Token #${tokenId}:`);
                console.log(`  From: ${evt.result?.from || evt.result?._from}`);
                console.log(`  To: ${evt.result?.to || evt.result?._to}`);
                console.log(`  Time: ${new Date(evt.block_timestamp).toISOString()}`);
                console.log(`  TX: ${evt.transaction_id}`);
                console.log('');
            });
    }

    // Show any AlertAcknowledged or DocumentAccepted events
    ['AlertAcknowledged', 'DocumentAccepted', 'NoticeServed', 'AlertNoticeCreated', 'DocumentNoticeCreated'].forEach(eventName => {
        if (eventsByType[eventName]) {
            console.log(`\n=== ${eventName.toUpperCase()} EVENTS ===\n`);
            eventsByType[eventName].slice(0, 5).forEach(evt => {
                console.log(JSON.stringify(evt.result, null, 2));
            });
        }
    });
}

main().catch(console.error);
