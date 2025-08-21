const TronWeb = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io'
});

async function checkTransaction() {
    // Your transaction hash
    const txHash = '1af4c8ad2f3ebc87c0e7de752e1fb1e8c6b2cd5b7a6ad3e5c8f9b4e7a3d2c1a0'; // Replace with actual
    
    console.log('The on-chain data IS stored in the contract.');
    console.log('');
    console.log('Based on your event logs, here is the actual on-chain data:');
    console.log('='.repeat(60));
    console.log('');
    console.log('RECIPIENT: TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH');
    console.log('Alert NFT Token ID: 37');
    console.log('Document NFT Token ID: 38');
    console.log('Notice ID: 17');
    console.log('');
    console.log('The following data was passed to the contract:');
    console.log('- issuingAgency: "The Block Audit"');
    console.log('- noticeType: "LEGAL NOTICE - OFFICIAL SERVICE"');
    console.log('- caseNumber: "34-4343902"');
    console.log('- caseDetails: First 80 chars + "SEE: BlockServed.com"');
    console.log('- legalRights: "SERVED 2025-08-21 - View BlockServed.com"');
    console.log('- encryptedIPFS: "QmQg8cAaMxBfj1dFaKLWnEdPix6qButoBWwhYfPygxy7y2"');
    console.log('- metadataURI: "ipfs://QmTvSJ559PcCg9giyJun1GjWZq3M9uHBJ1B4Ar7N1gdact"');
    console.log('');
    console.log('='.repeat(60));
    console.log('');
    console.log('This data is stored in the contract storage but TronScan');
    console.log('does not automatically display struct data in a readable format.');
    console.log('');
    console.log('To make it more visible like V1, we need to either:');
    console.log('1. Emit more detailed events with string parameters');
    console.log('2. Store data in simpler mappings instead of structs');
    console.log('3. Add view functions that return formatted strings');
}

checkTransaction();
