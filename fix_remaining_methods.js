const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing remaining .methods calls...\n');

const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Fix the test call in contract loading
content = content.replace(
    'totalNotices = await legalContract.methods.totalNotices().call();',
    'totalNotices = await legalContract.totalSupply().call();'
);

// Fix EVM contract calls that use .methods
content = content.replace(
    'fee = await legalContract.methods.SERVICE_FEE().call();',
    'fee = await legalContract.serviceFee().call();'
);

content = content.replace(
    'userFee = await legalContract.methods.calculateFee(web3Instance.eth.defaultAccount).call();',
    'userFee = await calculateFeeFromConstants(web3Instance.eth.defaultAccount);'
);

// Fix createLegalNotice calls for EVM
content = content.replace(
    /await legalContract\.methods\.createLegalNotice\(/g,
    'await legalContract.createNotice('
);

// Save the file
fs.writeFileSync(indexPath, content);

console.log('✅ Fixed remaining .methods calls');
console.log('\nThe UI should now be fully compatible with the optimized contract!');