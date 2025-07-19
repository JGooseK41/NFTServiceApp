#!/bin/bash

echo "Finalizing UI update for LegalNoticeNFT_Complete contract..."
echo "New contract address: TXtSpuVBTnsvCwuqDYXtiZXTpgSXZSb2Bd"

# Create a backup of the current index.html
cp index.html index_backup_before_complete_$(date +%Y%m%d_%H%M%S).html
echo "✓ Backup created"

# Replace index.html with the updated version
cp index_updated.html index.html
echo "✓ Updated index.html with new contract address"

# Now we need to update the ABI in index.html
# First, let's create a temporary file with the escaped ABI
node -e "
const fs = require('fs');
const abi = fs.readFileSync('./contracts/LegalNoticeNFT_Complete_sol_LegalNoticeNFT.abi', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

// Find and replace the CONTRACT_ABI
const abiRegex = /const CONTRACT_ABI = \[[^\]]*\];/s;
const newAbiLine = 'const CONTRACT_ABI = ' + abi + ';';
const updatedHtml = html.replace(abiRegex, newAbiLine);

fs.writeFileSync('index.html', updatedHtml);
console.log('✓ Updated CONTRACT_ABI');
"

echo ""
echo "✅ Update complete!"
echo ""
echo "Next steps:"
echo "1. Open your browser and test the application"
echo "2. View the contract on TronScan: https://nile.tronscan.org/#/contract/TXtSpuVBTnsvCwuqDYXtiZXTpgSXZSb2Bd"
echo "3. Test all functionality:"
echo "   - Create a notice"
echo "   - Check fee calculations" 
echo "   - Test admin functions"
echo "   - Verify events are working"
echo ""
echo "If you need to revert, your backup is saved with timestamp."