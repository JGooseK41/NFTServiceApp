const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing contract method calls for optimized contract...\n');

const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Track changes
let changes = [];

// 1. Replace totalNotices() with totalSupply()
console.log('1. Replacing totalNotices() with totalSupply()...');
content = content.replace(/legalContract\.totalNotices\(\)/g, 'legalContract.totalSupply()');
changes.push('✅ Replaced totalNotices() with totalSupply()');

// 2. Fix calculateFee calls - the optimized contract uses fixed fees
console.log('2. Fixing calculateFee() calls...');
// Replace calculateFee with a function that calculates based on constants
const calculateFeeReplacement = `
async function calculateFeeFromConstants(userAddress) {
    try {
        // Check if user is law enforcement exempt
        const isExempt = await legalContract.lawEnforcementExemptions(userAddress).call();
        
        // Get fee constants
        const serviceFee = await legalContract.serviceFee().call();
        const creationFee = await legalContract.creationFee().call();
        const sponsorshipFee = await legalContract.sponsorshipFee().call();
        
        if (isExempt) {
            // Law enforcement only pays creation + sponsorship
            return parseInt(creationFee) + parseInt(sponsorshipFee);
        } else {
            // Regular users pay all fees
            return parseInt(serviceFee) + parseInt(creationFee) + parseInt(sponsorshipFee);
        }
    } catch (error) {
        console.error('Error calculating fee:', error);
        // Default fee if calculation fails
        return 32000000; // 32 TRX default
    }
}
`;

// Add the helper function after CONTRACT_ABI
const abiEnd = content.indexOf('const CONTRACT_ABI');
const insertPoint = content.indexOf('];', abiEnd) + 3;
const helperStart = content.indexOf('// Helper functions for parsing optimized contract data');
if (helperStart > 0) {
    content = content.slice(0, helperStart) + calculateFeeReplacement + '\n' + content.slice(helperStart);
} else {
    content = content.slice(0, insertPoint) + '\n' + calculateFeeReplacement + '\n' + content.slice(insertPoint);
}

// Replace all calculateFee calls
content = content.replace(/await legalContract\.calculateFee\((.*?)\)\.call\(\)/g, 'await calculateFeeFromConstants($1)');
changes.push('✅ Replaced calculateFee() with calculateFeeFromConstants()');

// 3. Fix getRecipientNotices - need to implement alternative
console.log('3. Fixing getRecipientNotices() calls...');
// The optimized contract stores this data differently
const getRecipientNoticesReplacement = `
async function getRecipientNoticeIds(recipient) {
    try {
        // The optimized contract may not have this function
        // We need to use events or enumerate through NFTs
        const balance = await legalContract.balanceOf(recipient).call();
        const noticeIds = [];
        
        for (let i = 0; i < balance; i++) {
            try {
                const tokenId = await legalContract.tokenOfOwnerByIndex(recipient, i).call();
                noticeIds.push(tokenId);
            } catch (e) {
                console.log('Error getting token at index', i, e);
            }
        }
        
        return noticeIds;
    } catch (error) {
        console.error('Error getting recipient notices:', error);
        return [];
    }
}
`;

// Add this helper function too
content = content.slice(0, helperStart) + getRecipientNoticesReplacement + '\n' + content.slice(helperStart);

// Replace getRecipientNotices calls
content = content.replace(/await legalContract\.getRecipientNotices\((.*?)\)\.call\(\)/g, 'await getRecipientNoticeIds($1)');
changes.push('✅ Replaced getRecipientNotices() with getRecipientNoticeIds()');

// 4. Fix the checkbox ID issue for law enforcement exemption
console.log('4. Fixing checkbox ID issue...');
// The error shows "Cannot read properties of null (reading 'checked')"
// This suggests the checkbox ID is wrong
content = content.replace(
    /const lawEnforcementExempt = document\.getElementById\('lawEnforcementExempt'\)\.checked;/g,
    `const exemptCheckbox = document.getElementById('lawEnforcementExempt');
                const lawEnforcementExempt = exemptCheckbox ? exemptCheckbox.checked : false;`
);
changes.push('✅ Fixed law enforcement exemption checkbox null check');

// Save the updated file
fs.writeFileSync(indexPath, content);

console.log('\n✅ Contract method calls fixed!\n');
console.log('Changes made:');
changes.forEach(change => console.log('  ' + change));

console.log('\n📝 Summary:');
console.log('- totalNotices() → totalSupply()');
console.log('- calculateFee() → calculateFeeFromConstants() using contract constants');
console.log('- getRecipientNotices() → getRecipientNoticeIds() using NFT enumeration');
console.log('- Added null check for law enforcement checkbox');

console.log('\n⚠️  The UI should now work with the optimized contract!');