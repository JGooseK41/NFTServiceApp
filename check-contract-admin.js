const TronWeb = require('tronweb');

// Initialize TronWeb
const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io'
});

async function checkContractInfo() {
    try {
        // Contract address on mainnet
        const contractAddress = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';
        
        // Your wallet address
        const userAddress = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';
        
        console.log('Contract:', contractAddress);
        console.log('Your wallet:', userAddress);
        console.log('');
        
        // Get contract info from blockchain
        const contractInfo = await tronWeb.trx.getContract(contractAddress);
        
        if (contractInfo && contractInfo.owner_address) {
            console.log('Contract owner (deployer hex):', contractInfo.owner_address);
            console.log('Contract owner (base58):', tronWeb.address.fromHex(contractInfo.owner_address));
        } else {
            // Try alternative method - get transaction info
            const transactions = await tronWeb.trx.getTransactionsRelated(contractAddress, 'from', 1, 0);
            if (transactions && transactions.data && transactions.data.length > 0) {
                const deployTx = transactions.data[0];
                console.log('Deploy transaction from:', deployTx.raw_data.contract[0].parameter.value.owner_address);
                console.log('Deploy transaction from (base58):', tronWeb.address.fromHex(deployTx.raw_data.contract[0].parameter.value.owner_address));
            }
        }
        
        // Check if your wallet matches the owner
        if (contractInfo && contractInfo.owner_address) {
            const ownerBase58 = tronWeb.address.fromHex(contractInfo.owner_address);
            if (ownerBase58 === userAddress) {
                console.log('\n✅ Your wallet IS the contract owner/deployer!');
            } else {
                console.log('\n❌ Your wallet is NOT the contract owner');
                console.log('   Owner is:', ownerBase58);
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkContractInfo();