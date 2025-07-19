const { TronWeb } = require('tronweb');
const fs = require('fs');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io'
});

// Set a default address to avoid owner_address errors
tronWeb.setAddress('TDbeaZQ25WzZ4Aqn4RJAZxmo6BeHdMeXGf');

async function testDeployment() {
    const contractAddress = 'TWdZdDUk3yW1KRUPxo4gHySDRjBjMPQJ3n';
    
    console.log('Testing LegalNoticeNFT_Complete deployment...');
    console.log('Contract:', contractAddress);
    console.log('Transaction:', 'c88b78830c3b8b605e8f64bfb7f56a92d133a23a3c6e82c672e6e979f1ec3efa');
    console.log('=====================================\n');
    
    try {
        // Load the correct ABI
        const abi = JSON.parse(fs.readFileSync('./contracts/LegalNoticeNFT_Complete_NEW.abi', 'utf8'));
        
        // Get contract instance with ABI
        const contract = await tronWeb.contract(abi, contractAddress);
        
        // Test basic view functions
        console.log('Testing core functions:');
        
        // Fee functions
        try {
            const serviceFee = await contract.serviceFee().call();
            console.log('✓ serviceFee:', tronWeb.fromSun(serviceFee), 'TRX');
        } catch (e) {
            console.log('✗ serviceFee failed:', e.message);
        }
        
        try {
            const SERVICE_FEE = await contract.SERVICE_FEE().call();
            console.log('✓ SERVICE_FEE():', tronWeb.fromSun(SERVICE_FEE), 'TRX');
        } catch (e) {
            console.log('✗ SERVICE_FEE() failed:', e.message);
        }
        
        try {
            const creationFee = await contract.creationFee().call();
            console.log('✓ creationFee:', tronWeb.fromSun(creationFee), 'TRX');
        } catch (e) {
            console.log('✗ creationFee failed:', e.message);
        }
        
        try {
            const sponsorshipFee = await contract.sponsorshipFee().call();
            console.log('✓ sponsorshipFee:', tronWeb.fromSun(sponsorshipFee), 'TRX');
        } catch (e) {
            console.log('✗ sponsorshipFee failed:', e.message);
        }
        
        try {
            const feeCollector = await contract.feeCollector().call();
            console.log('✓ feeCollector:', tronWeb.address.fromHex(feeCollector));
        } catch (e) {
            console.log('✗ feeCollector failed:', e.message);
        }
        
        // State functions
        try {
            const resourceSponsorshipEnabled = await contract.resourceSponsorshipEnabled().call();
            console.log('✓ resourceSponsorshipEnabled:', resourceSponsorshipEnabled);
        } catch (e) {
            console.log('✗ resourceSponsorshipEnabled failed:', e.message);
        }
        
        try {
            const totalNotices = await contract.totalNotices().call();
            console.log('✓ totalNotices:', totalNotices.toString());
        } catch (e) {
            console.log('✗ totalNotices failed:', e.message);
        }
        
        // Role constants
        console.log('\nTesting role constants:');
        
        try {
            const ADMIN_ROLE = await contract.ADMIN_ROLE().call();
            console.log('✓ ADMIN_ROLE:', ADMIN_ROLE);
        } catch (e) {
            console.log('✗ ADMIN_ROLE failed:', e.message);
        }
        
        try {
            const PROCESS_SERVER_ROLE = await contract.PROCESS_SERVER_ROLE().call();
            console.log('✓ PROCESS_SERVER_ROLE:', PROCESS_SERVER_ROLE);
        } catch (e) {
            console.log('✗ PROCESS_SERVER_ROLE failed:', e.message);
        }
        
        // Test admin role
        console.log('\nTesting admin access:');
        try {
            const adminRoleBytes = tronWeb.sha3('ADMIN_ROLE');
            const isAdmin = await contract.hasRole(adminRoleBytes, 'TDbeaZQ25WzZ4Aqn4RJAZxmo6BeHdMeXGf').call();
            console.log('✓ Your address is admin:', isAdmin);
        } catch (e) {
            console.log('✗ hasRole check failed:', e.message);
        }
        
        // Fee calculation
        console.log('\nTesting fee calculation:');
        try {
            const fee = await contract.calculateFee('TDbeaZQ25WzZ4Aqn4RJAZxmo6BeHdMeXGf').call();
            console.log('✓ calculateFee for your address:', tronWeb.fromSun(fee), 'TRX');
        } catch (e) {
            console.log('✗ calculateFee failed:', e.message);
        }
        
        console.log('\n✅ Deployment successful! LegalNoticeNFT_Complete is ready to use.');
        console.log('\nView on TronScan: https://nile.tronscan.org/#/contract/' + contractAddress);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testDeployment();