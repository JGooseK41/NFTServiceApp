const fs = require('fs');
const path = require('path');

// Read the hybrid contract ABI
const abiPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Hybrid.abi');
const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

// Read the current index.html
const indexPath = path.join(__dirname, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');

// Find the CONTRACT_ABI line and replace it
const abiString = JSON.stringify(abi);
const abiRegex = /const CONTRACT_ABI = \[.*?\];/s;

if (abiRegex.test(indexContent)) {
    indexContent = indexContent.replace(abiRegex, `const CONTRACT_ABI = ${abiString};`);
    
    // Write the updated content
    fs.writeFileSync(indexPath, indexContent);
    console.log('✅ Updated CONTRACT_ABI in index.html');
    
    // Also check for any UI elements that reference removed functions
    console.log('\n🔍 Checking for removed function references...');
    
    const removedFunctions = ['registerProcessServer', 'setProcessServerStatus'];
    const foundIssues = [];
    
    removedFunctions.forEach(func => {
        if (indexContent.includes(func)) {
            const regex = new RegExp(func, 'g');
            const matches = indexContent.match(regex);
            if (matches) {
                foundIssues.push(`Found ${matches.length} reference(s) to ${func}`);
            }
        }
    });
    
    if (foundIssues.length > 0) {
        console.log('\n⚠️  Found references to removed functions:');
        foundIssues.forEach(issue => console.log('  - ' + issue));
        console.log('\nThese UI elements may need to be updated or removed.');
    } else {
        console.log('✅ No references to removed functions found');
    }
    
    // Check for pause/unpause vs setPaused
    if (indexContent.includes('.pause(') || indexContent.includes('.unpause(')) {
        console.log('\n⚠️  Found references to pause()/unpause() - these should be updated to use setPaused(bool)');
    }
    
} else {
    console.error('❌ Could not find CONTRACT_ABI in index.html');
}