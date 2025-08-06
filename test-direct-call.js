const TronWeb = require('tronweb');

// Need to provide a private key for the tronWeb instance to work properly
const privateKey = '0000000000000000000000000000000000000000000000000000000000000001'; // dummy key for read-only

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: privateKey
});

const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';
const USER_ADDRESS = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';

async function testDirectCall() {
    try {
        console.log('Contract address:', CONTRACT_ADDRESS);
        console.log('User address:', USER_ADDRESS);
        console.log('Network: MAINNET\n');
        
        const contractInfo = await tronWeb.trx.getContract(CONTRACT_ADDRESS);
        const contract = await tronWeb.contract(contractInfo.abi.entrys, CONTRACT_ADDRESS);
        
        // Test notice 0
        console.log('=== Testing Notice ID 0 ===');
        try {
            const notice0 = await contract.methods.notices(0).call();
            console.log('Notice 0 raw result:', notice0);
            
            if (notice0) {
                console.log('\nNotice 0 parsed:');
                console.log('  Recipient (hex):', notice0.recipient || notice0[0]);
                console.log('  Server (hex):', notice0.server || notice0[1]);
                
                // Convert addresses
                try {
                    const recipient = notice0.recipient || notice0[0];
                    if (recipient && recipient !== '410000000000000000000000000000000000000000') {
                        console.log('  Recipient (base58):', tronWeb.address.fromHex(recipient));
                    }
                    
                    const server = notice0.server || notice0[1];
                    if (server && server !== '410000000000000000000000000000000000000000') {
                        console.log('  Server (base58):', tronWeb.address.fromHex(server));
                    } else {
                        console.log('  Server is NULL - need to get from events');
                    }
                } catch(e) {
                    console.log('Error converting addresses:', e.message);
                }
                
                console.log('  IPFS Hash:', notice0.ipfsHash || notice0[2]);
            }
        } catch(e) {
            console.log('Error calling notices(0):', e.message);
        }
        
        // Test alertNotices
        console.log('\n=== Testing Alert Notice 0 ===');
        try {
            const alert0 = await contract.methods.alertNotices(0).call();
            console.log('Alert 0 raw result:', alert0);
            
            if (alert0) {
                console.log('\nAlert 0 parsed:');
                const server = alert0.server || alert0[0];
                console.log('  Server (hex):', server);
                if (server && server !== '410000000000000000000000000000000000000000') {
                    try {
                        console.log('  Server (base58):', tronWeb.address.fromHex(server));
                    } catch(e) {}
                }
                console.log('  Document Notice ID:', alert0.documentNoticeId || alert0[1]);
                console.log('  Preview Image:', alert0.previewImage || alert0[2]);
            }
        } catch(e) {
            console.log('Error calling alertNotices(0):', e.message);
        }
        
        // Try serverNotices with explicit parameters
        console.log('\n=== Testing serverNotices Mapping ===');
        try {
            const result = await contract.methods.serverNotices(USER_ADDRESS, 0).call();
            console.log('serverNotices[USER_ADDRESS][0]:', result);
            if (result) {
                console.log('  Notice ID:', result.toString());
            }
        } catch(e) {
            console.log('Error:', e.message);
        }
        
        // Try getServerNotices
        console.log('\n=== Testing getServerNotices ===');
        try {
            const result = await contract.methods.getServerNotices(USER_ADDRESS).call();
            console.log('getServerNotices result:', result);
            if (result && Array.isArray(result)) {
                console.log(`Found ${result.length} notices`);
                result.forEach((id, idx) => {
                    console.log(`  [${idx}]: Notice ID ${id.toString()}`);
                });
            }
        } catch(e) {
            console.log('Error:', e.message);
        }
        
    } catch (error) {
        console.error('Main error:', error.message || error);
    }
}

testDirectCall();