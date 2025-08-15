const TronWeb = require('tronweb');
const fs = require('fs');

// Use a dummy private key for reading contract data
const PRIVATE_KEY = '0000000000000000000000000000000000000000000000000000000000000001';

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io', // Mainnet
    privateKey: PRIVATE_KEY
});

// Contract address from the app
const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

// Load the v5 ABI
const v5ABI = JSON.parse(fs.readFileSync('./v5/LegalNoticeNFT_v5_Enumerable.abi', 'utf8'));

async function debugV5Contract() {
    console.log('=== V5 Contract Structure Debug ===\n');
    console.log('Contract Address:', CONTRACT_ADDRESS);
    console.log('Network: TRON Mainnet\n');
    
    try {
        // Create contract instance
        const contract = await tronWeb.contract(v5ABI, CONTRACT_ADDRESS);
        
        // Get total notices
        console.log('1. Checking total notices...');
        const totalNotices = await contract.totalNotices().call();
        console.log('Total notices:', totalNotices.toString());
        
        // Get current token ID
        console.log('\n2. Getting token ID counter...');
        try {
            const currentTokenId = await contract._currentTokenId().call();
            console.log('Current token ID:', currentTokenId.toString());
        } catch (e) {
            console.log('Cannot access _currentTokenId (private)');
        }
        
        // Check first few notices
        console.log('\n3. Examining notice structure...\n');
        
        for (let i = 0; i < Math.min(3, totalNotices); i++) {
            console.log(`=== Notice Index ${i} ===`);
            
            try {
                // Get notice data
                const notice = await contract.notices(i).call();
                console.log('Notice data:', notice);
                
                // Extract IDs
                let alertId, documentId;
                if (Array.isArray(notice)) {
                    alertId = notice[0];
                    documentId = notice[1];
                } else {
                    alertId = notice.alertId;
                    documentId = notice.documentId;
                }
                
                console.log(`- Alert ID: ${alertId}`);
                console.log(`- Document ID: ${documentId}`);
                
                // Get alert notice data
                if (alertId) {
                    try {
                        const alertData = await contract.alertNotices(alertId).call();
                        console.log(`\nAlert Notice ${alertId}:`);
                        if (Array.isArray(alertData) && alertData.length >= 12) {
                            console.log('  - Recipient:', alertData[0]);
                            console.log('  - Sender:', alertData[1]);
                            console.log('  - Document ID:', alertData[2]);
                            console.log('  - Timestamp:', new Date(parseInt(alertData[3]) * 1000).toLocaleString());
                            console.log('  - Acknowledged:', alertData[4]);
                            console.log('  - Issuing Agency:', alertData[5]);
                            console.log('  - Notice Type:', alertData[6]);
                            console.log('  - Case Number:', alertData[7]);
                        } else {
                            console.log('  Alert data:', alertData);
                        }
                    } catch (e) {
                        console.log('  Error getting alert data:', e.message);
                    }
                }
                
                // Get document notice data
                if (documentId) {
                    try {
                        const docData = await contract.documentNotices(documentId).call();
                        console.log(`\nDocument Notice ${documentId}:`);
                        if (Array.isArray(docData) && docData.length >= 5) {
                            console.log('  - Encrypted IPFS:', docData[0] ? docData[0].substring(0, 20) + '...' : 'None');
                            console.log('  - Decryption Key:', docData[1] ? 'Present' : 'None');
                            console.log('  - Authorized Viewer:', docData[2]);
                            console.log('  - Linked Alert ID:', docData[3]);
                            console.log('  - Is Restricted:', docData[4]);
                        } else {
                            console.log('  Document data:', docData);
                        }
                    } catch (e) {
                        console.log('  Error getting document data:', e.message);
                    }
                }
                
                console.log('\n' + '='.repeat(50) + '\n');
                
            } catch (e) {
                console.log(`Error reading notice ${i}:`, e.message);
            }
        }
        
        // Check a specific recipient
        console.log('4. Checking specific recipient...');
        const testRecipient = 'TC8sVhGohQSJQqp96SgJZ5EUyFGfFnVQWy';
        console.log('Test recipient:', testRecipient);
        
        try {
            // Check if there's a function to get recipient alerts
            const recipientAlerts = await contract.recipientAlerts(testRecipient).call();
            console.log('Recipient alerts:', recipientAlerts);
        } catch (e) {
            console.log('Cannot directly access recipientAlerts mapping');
        }
        
        // Count notices for recipient
        let recipientNoticeCount = 0;
        for (let i = 0; i < totalNotices; i++) {
            try {
                const notice = await contract.notices(i).call();
                let recipient;
                if (Array.isArray(notice)) {
                    recipient = notice[3]; // Index 3 is recipient
                } else {
                    recipient = notice.recipient;
                }
                
                // Convert hex to base58 if needed
                if (recipient && recipient.startsWith('41')) {
                    recipient = tronWeb.address.fromHex(recipient);
                }
                
                if (recipient && recipient.toLowerCase() === testRecipient.toLowerCase()) {
                    recipientNoticeCount++;
                    console.log(`  - Found notice ${i} for recipient`);
                }
            } catch (e) {
                // Skip
            }
        }
        console.log(`Total notices for ${testRecipient}: ${recipientNoticeCount}`);
        
    } catch (error) {
        console.error('Error:', error.message || error);
    }
}

debugV5Contract();