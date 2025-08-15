const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io'
});

async function testEnumerable() {
    const contractAddress = 'TEZxBmj16pKdsJh3aDE9Y4RLSuXuBuUSp8';
    
    console.log('🔍 Testing ERC721Enumerable functions on new contract...');
    console.log('Contract:', contractAddress);
    console.log('View on Tronscan: https://nile.tronscan.org/#/contract/' + contractAddress);
    
    try {
        // Load the ABI
        const abi = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts', 'LegalNoticeNFT_Optimized.abi'), 'utf8'));
        
        // Get contract instance with ABI
        const contract = await tronWeb.contract(abi, contractAddress);
        
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
        const hasTS = abi.find(f => f.name === 'totalSupply');
        const hasTBI = abi.find(f => f.name === 'tokenByIndex');
        const hasTOOBI = abi.find(f => f.name === 'tokenOfOwnerByIndex');
        
        console.log('Has totalSupply:', !!hasTS);
        console.log('Has tokenByIndex:', !!hasTBI);
        console.log('Has tokenOfOwnerByIndex:', !!hasTOOBI);
        
        if (hasTS && hasTBI && hasTOOBI) {
            console.log('\n🎉 Contract has full ERC721Enumerable support!');
            console.log('NFTs should now be properly tracked on Tronscan.');
            
            // Show Tronscan links
            console.log('\n📊 Check these on Tronscan:');
            console.log('Contract Info: https://nile.tronscan.org/#/contract/' + contractAddress + '/code');
            console.log('Token Tracker: https://nile.tronscan.org/#/token721/' + contractAddress);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testEnumerable();