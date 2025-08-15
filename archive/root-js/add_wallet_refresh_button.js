const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Add refresh button to wallet status header
const oldWalletHeader = `                <div class="card-header" id="walletStatusHeader" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 1.25rem;">
                    <h2 style="margin: 0;"><i class="fas fa-wallet"></i> Wallet Status</h2>
                    <i id="walletToggleIcon" class="fas fa-chevron-down"></i>
                </div>`;

const newWalletHeader = `                <div class="card-header" id="walletStatusHeader" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 1.25rem;">
                    <h2 style="margin: 0;"><i class="fas fa-wallet"></i> Wallet Status</h2>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <button class="btn btn-secondary btn-small" onclick="refreshWalletStatus(event)" style="padding: 0.25rem 0.75rem;" title="Refresh wallet status">
                            <i class="fas fa-sync"></i>
                        </button>
                        <i id="walletToggleIcon" class="fas fa-chevron-down"></i>
                    </div>
                </div>`;

content = content.replace(oldWalletHeader, newWalletHeader);

// 2. Create a refresh wallet status function
const refreshFunction = `
        // Refresh wallet status
        async function refreshWalletStatus(event) {
            if (event) {
                event.stopPropagation(); // Prevent card from toggling
            }
            
            const refreshBtn = event ? event.currentTarget : null;
            if (refreshBtn) {
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i>';
            }
            
            try {
                await updateWalletStatus();
                
                // Flash success color
                const walletCard = document.getElementById('walletStatusCard');
                if (walletCard) {
                    walletCard.style.borderColor = '#10b981';
                    setTimeout(() => {
                        walletCard.style.borderColor = '';
                    }, 1000);
                }
            } catch (error) {
                console.error('Error refreshing wallet status:', error);
            } finally {
                if (refreshBtn) {
                    refreshBtn.disabled = false;
                    refreshBtn.innerHTML = '<i class="fas fa-sync"></i>';
                }
            }
        }`;

// Find a good place to add the function (after updateWalletStatus)
const updateWalletStatusEnd = 'console.error(\'Error checking user status:\', error);\n            }\n        }';
const insertPosition = content.indexOf(updateWalletStatusEnd);

if (insertPosition !== -1) {
    const endPosition = insertPosition + updateWalletStatusEnd.length;
    content = content.substring(0, endPosition) + '\n' + refreshFunction + content.substring(endPosition);
} else {
    console.log('⚠️  Could not find updateWalletStatus function end');
}

// 3. Make sure the wallet status content is visible when refreshing
const oldUpdateWalletStatus = 'async function updateWalletStatus() {';
const newUpdateWalletStatus = `async function updateWalletStatus() {
            // Ensure wallet status content is visible
            const walletStatusContent = document.getElementById('walletStatusContent');
            if (walletStatusContent && walletStatusContent.style.display === 'none') {
                walletStatusContent.style.display = 'block';
                const walletToggleIcon = document.getElementById('walletToggleIcon');
                if (walletToggleIcon) {
                    walletToggleIcon.className = 'fas fa-chevron-up';
                }
            }`;

content = content.replace(oldUpdateWalletStatus, newUpdateWalletStatus);

// Write the updated content
fs.writeFileSync(indexPath, content);

console.log('✅ Added refresh button to wallet status card');
console.log('✅ Button will update all wallet information including roles and exemptions');
console.log('✅ Visual feedback shows when refresh is complete');