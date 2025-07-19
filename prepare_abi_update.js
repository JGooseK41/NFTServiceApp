const fs = require('fs');

// Read the new ABI
const newABI = fs.readFileSync('./contracts/LegalNoticeNFT_Complete_sol_LegalNoticeNFT.abi', 'utf8');

// Format it for JavaScript
const formattedABI = 'const CONTRACT_ABI = ' + newABI + ';';

// Save to a file
fs.writeFileSync('new_contract_abi.js', formattedABI);

console.log('New ABI prepared in new_contract_abi.js');
console.log('To update the UI:');
console.log('1. Open index.html');
console.log('2. Find the line starting with "const CONTRACT_ABI"');
console.log('3. Replace it with the contents of new_contract_abi.js');
console.log('\nAlternatively, you can use this one-liner after deploying:');
console.log('sed -i "s/const CONTRACT_ABI = \\[.*\\];/$(cat new_contract_abi.js | sed \'s/[[\\/]/\\\\&/g\')/g" index.html');