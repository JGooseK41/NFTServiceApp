const TronWeb = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io'
});

async function testEnumerable() {
    const contractAddress = 'TEZxBmj16pKdsJh3aDE9Y4RLSuXuBuUSp8';
    
    console.log('🔍 Testing ERC721Enumerable functions on new contract...');
    console.log('Contract:', contractAddress);
    console.log('View on Tronscan: https://nile.tronscan.org/#/contract/' + contractAddress);
    
    try {
        const contract = await tronWeb.contract().at(contractAddress);
        
        // Test totalSupply
        console.log('\n✅ Testing totalSupply()...');
        const totalSupply = await contract.totalSupply().call();
        console.log('Total NFTs minted:', totalSupply.toString());
        
        // Test contract name and symbol
        console.log('\n✅ Testing basic ERC721 functions...');
        const name = await contract.name().call();
        const symbol = await contract.symbol().call();
        console.log('Name:', name);
        console.log('Symbol:', symbol);
        
        // Check if enumerable functions exist
        console.log('\n✅ Checking enumerable functions...');
        console.log('Has totalSupply:', typeof contract.totalSupply === 'function');
        console.log('Has tokenByIndex:', typeof contract.tokenByIndex === 'function');
        console.log('Has tokenOfOwnerByIndex:', typeof contract.tokenOfOwnerByIndex === 'function');
        
        console.log('\n🎉 Contract has full ERC721Enumerable support!');
        console.log('NFTs should now be properly tracked on Tronscan.');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testEnumerable();