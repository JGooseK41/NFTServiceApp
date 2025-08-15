const fs = require('fs');
const path = require('path');

console.log('🔍 Validating UI Compatibility with Optimized Contract...\n');

// Read files
const indexPath = path.join(__dirname, 'index.html');
const content = fs.readFileSync(indexPath, 'utf8');

const abiPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Optimized.abi');
const optimizedABI = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

// Validation results
const issues = [];
const successes = [];

// 1. Check contract address
console.log('1. Checking contract addresses...');
const newAddress = 'TEZxBmj16pKdsJh3aDE9Y4RLSuXuBuUSp8';
const oldAddress = 'TXyXo57jpquJM4cTkVBw6uUJxrxon2gQP8';

if (content.includes(oldAddress)) {
    issues.push(`❌ Found old contract address: ${oldAddress}`);
} else if (content.includes(newAddress)) {
    successes.push(`✅ Contract address correctly updated to: ${newAddress}`);
} else {
    issues.push('⚠️  No contract address found');
}

// 2. Check ABI
console.log('2. Checking CONTRACT_ABI...');
const abiMatch = content.match(/const CONTRACT_ABI = (\[[\s\S]*?\]);/);
if (abiMatch) {
    try {
        const currentABI = eval(abiMatch[1]);
        // Check for key optimized contract functions
        const hasCreateNotice = currentABI.find(f => f.name === 'createNotice');
        const hasGetNotice = currentABI.find(f => f.name === 'getNotice');
        const hasTotalSupply = currentABI.find(f => f.name === 'totalSupply');
        
        if (hasCreateNotice && hasGetNotice && hasTotalSupply) {
            successes.push('✅ CONTRACT_ABI contains optimized contract functions');
        } else {
            issues.push('❌ CONTRACT_ABI missing key optimized functions');
        }
    } catch (e) {
        issues.push('❌ Could not parse CONTRACT_ABI');
    }
}

// 3. Check for outdated function calls
console.log('3. Checking for outdated function calls...');
const outdatedFunctions = [
    'createDocumentNotice',
    'createTextNotice',
    'getNoticeInfo',
    'setProcessServerStatus'
];

outdatedFunctions.forEach(func => {
    const regex = new RegExp(`\\.${func}\\(`, 'g');
    const matches = content.match(regex);
    if (matches) {
        issues.push(`❌ Found ${matches.length} calls to outdated function: ${func}()`);
    }
});

// 4. Check for new function usage
console.log('4. Checking for new function usage...');
const newFunctions = ['createNotice', 'getNotice'];
newFunctions.forEach(func => {
    const regex = new RegExp(`\\.${func}\\(`, 'g');
    const matches = content.match(regex);
    if (matches) {
        successes.push(`✅ Found ${matches.length} calls to new function: ${func}()`);
    } else {
        issues.push(`⚠️  No calls found to new function: ${func}()`);
    }
});

// 5. Check for helper functions
console.log('5. Checking for helper functions...');
const helperFunctions = ['parseMetadata', 'parseDocumentData', 'parsePackedData'];
helperFunctions.forEach(func => {
    if (content.includes(`function ${func}(`)) {
        successes.push(`✅ Helper function found: ${func}()`);
    } else {
        issues.push(`❌ Missing helper function: ${func}()`);
    }
});

// 6. Check batch operations
console.log('6. Checking batch operations...');
if (content.includes('batchRequest')) {
    successes.push('✅ Batch operations updated to use new struct format');
} else if (content.includes('createBatchNotices')) {
    issues.push('⚠️  Batch operations may need updating for new struct format');
}

// 7. Check event parsing
console.log('7. Checking event parsing...');
if (content.includes("event.event === 'NoticeCreated'")) {
    const eventPattern = /const \{ noticeId, recipient, sender \} = event\.result;/;
    if (content.match(eventPattern)) {
        successes.push('✅ NoticeCreated event parsing updated for simplified format');
    } else {
        issues.push('⚠️  NoticeCreated event parsing may need updating');
    }
}

// Print results
console.log('\n' + '='.repeat(60));
console.log('VALIDATION RESULTS');
console.log('='.repeat(60) + '\n');

if (successes.length > 0) {
    console.log('✅ SUCCESSES:');
    successes.forEach(s => console.log('   ' + s));
}

if (issues.length > 0) {
    console.log('\n❌ ISSUES FOUND:');
    issues.forEach(i => console.log('   ' + i));
} else {
    console.log('\n🎉 NO ISSUES FOUND! UI is fully compatible with the optimized contract.');
}

console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`Total Checks: ${successes.length + issues.length}`);
console.log(`Passed: ${successes.length}`);
console.log(`Issues: ${issues.length}`);

if (issues.length === 0) {
    console.log('\n✨ The UI is ready to use with the optimized contract!');
    console.log('\nKey features now available:');
    console.log('- NFTs trackable on Tronscan with totalSupply()');
    console.log('- No Via IR compilation needed');
    console.log('- Lower gas costs');
    console.log('- Simplified contract structure');
} else {
    console.log('\n⚠️  Please fix the issues above before testing.');
}