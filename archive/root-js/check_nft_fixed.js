const TronWeb = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: '0000000000000000000000000000000000000000000000000000000000000001' // Dummy key for read-only
});

async function checkNFT() {
    const contractAddress = 'TXyXo57jpquJM4cTkVBw6uUJxrxon2gQP8';
    const tokenId = 3;
    
    console.log('Checking NFT on Nile Testnet...');
    console.log('Contract:', contractAddress);
    console.log('Token ID:', tokenId);
    
    try {
        const contract = await tronWeb.contract().at(contractAddress);
        
        // Get contract name
        const name = await contract.name().call();
        console.log('\nContract name:', name);
        
        // Check total notices
        const totalNotices = await contract.totalNotices().call();
        console.log('Total notices created:', totalNotices.toString());
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkNFT();
