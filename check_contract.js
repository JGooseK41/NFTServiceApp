const { TronWeb } = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io'
});

async function checkContract() {
    const contractAddress = 'TFVXBcEobgRvRj9PWqQNWJTeqN5GkLyAuW';
    
    console.log('Checking contract at:', contractAddress);
    
    try {
        // Get contract info
        const contract = await tronWeb.trx.getContract(contractAddress);
        
        if (contract && contract.bytecode) {
            console.log('✓ Contract exists on chain');
            console.log('Contract name:', contract.name);
            console.log('Origin address:', contract.origin_address);
            console.log('Bytecode length:', contract.bytecode.length);
            
            // Check if it has an ABI
            if (contract.abi && contract.abi.entrys) {
                console.log('\nContract ABI functions:');
                contract.abi.entrys.forEach(entry => {
                    if (entry.type === 'Function') {
                        console.log(`- ${entry.name}()`);
                    }
                });
            }
        } else {
            console.log('✗ No contract found at this address');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkContract();