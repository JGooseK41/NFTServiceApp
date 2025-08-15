const TronWeb = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { "TRON-PRO-API-KEY": '9fc4cbb6-de76-486f-a8a3-bbf827c7d905' },
});

async function verifyContract() {
    const address = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';
    
    console.log('Checking contract at:', address);
    
    try {
        // Get account info
        const account = await tronWeb.trx.getAccount(address);
        console.log('Account type:', account.type || 'Normal account (not a contract)');
        
        // Try to get contract
        const contractInfo = await tronWeb.trx.getContract(address);
        if (contractInfo && contractInfo.abi) {
            console.log('\nContract ABI found\!');
            console.log('Functions:');
            contractInfo.abi.entrys.forEach(entry => {
                if (entry.type === 'Function') {
                    console.log('- ' + entry.name);
                }
            });
            
            // Try to call totalNotices
            const contract = await tronWeb.contract(contractInfo.abi, address);
            try {
                const total = await contract.totalNotices().call();
                console.log('\nTotal notices:', total.toString());
            } catch (e) {
                console.log('\nCould not call totalNotices:', e.message);
            }
        } else {
            console.log('No contract found at this address');
        }
    } catch (error) {
        console.error('Error:', error.message || error);
    }
}

verifyContract();
