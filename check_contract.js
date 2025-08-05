const TronWeb = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { "TRON-PRO-API-KEY": '9fc4cbb6-de76-486f-a8a3-bbf827c7d905' },
});

async function checkContract() {
    const address = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';
    
    try {
        // Check if contract exists
        const contract = await tronWeb.trx.getContract(address);
        console.log('Contract found:', contract.name);
        console.log('Contract ABI methods:');
        contract.abi.entrys.forEach(entry => {
            if (entry.type === 'Function') {
                console.log('-', entry.name);
            }
        });
    } catch (error) {
        console.error('Error checking contract:', error.message);
        
        // Try the other address you mentioned
        console.log('\nTrying TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh...');
        try {
            const contract2 = await tronWeb.trx.getContract('TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh');
            console.log('Contract found:', contract2.name);
        } catch (e) {
            console.error('Also failed:', e.message);
        }
    }
}

checkContract();
