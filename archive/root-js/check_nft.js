const TronWeb = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io'
});

async function checkNFT() {
    const contractAddress = 'TXyXo57jpquJM4cTkVBw6uUJxrxon2gQP8';
    const tokenId = 3;
    
    try {
        // Check who owns token ID 3
        const contract = await tronWeb.contract().at(contractAddress);
        const owner = await contract.ownerOf(tokenId).call();
        console.log('Token #3 owner:', owner);
        
        // Check your balance
        const yourAddress = 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH';
        const balance = await contract.balanceOf(yourAddress).call();
        console.log('Your NFT balance:', balance.toString());
        
        // Get token URI
        const uri = await contract.tokenURI(tokenId).call();
        console.log('Token URI:', uri.substring(0, 100) + '...');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkNFT();
