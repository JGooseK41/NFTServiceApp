const fs = require('fs');
const path = require('path');

// Read the current hybrid contract
const contractPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Hybrid.sol');
let content = fs.readFileSync(contractPath, 'utf8');

// Check if totalSupply already exists
if (content.includes('function totalSupply()')) {
    console.log('✅ totalSupply() function already exists!');
    process.exit(0);
}

// Find where to add totalSupply (after totalNotices function)
const totalNoticesMatch = content.match(/function totalNotices\(\) external view returns \(uint256\) \{[^}]+\}/);
if (!totalNoticesMatch) {
    console.error('❌ Could not find totalNotices function');
    process.exit(1);
}

const insertPosition = totalNoticesMatch.index + totalNoticesMatch[0].length;

// Add totalSupply as an alias to totalNotices
const totalSupplyFunction = `
    
    // Added for Tronscan NFT tracking compatibility
    function totalSupply() public view returns (uint256) {
        return _noticeIdCounter.current() > 0 ? _noticeIdCounter.current() - 1 : 0;
    }`;

// Insert the function
content = content.slice(0, insertPosition) + totalSupplyFunction + content.slice(insertPosition);

// Save to a new file first to test
const newPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Hybrid_WithTotalSupply.sol');
fs.writeFileSync(newPath, content);

console.log('✅ Created contract with totalSupply() function');
console.log('📍 Saved to:', newPath);
console.log('\nThis minimal change adds only the totalSupply() function that Tronscan needs.');
console.log('It returns the same value as totalNotices().');
console.log('\nNext step: Compile to check size impact...');