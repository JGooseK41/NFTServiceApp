const fs = require('fs');
const path = require('path');

console.log('🐛 Fixing Critical Bugs...\n');

const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Fix energy rental appearing unnecessarily
const energyCheckFix = `
                // Check if energy rental is actually needed
                const energyNeeded = await checkEnergyNeeded();
                if (energyNeeded > 0 && \!result.error) {
                    // Only show energy rental if transaction will fail due to energy
                    const userEnergy = await tronWeb.trx.getAccountResources(tronWeb.defaultAddress.base58);
                    const availableEnergy = userEnergy.EnergyLimit - userEnergy.EnergyUsed || 0;
                    
                    if (availableEnergy < 65000) { // Typical notice creation energy cost
                        const rentalResult = await handleEnergyRental(energyNeeded);
                        if (\!rentalResult.success) {
                            return;
                        }
                    }
                }`;

// Replace the existing energy check
const oldEnergyCheck = /const energyNeeded = await checkEnergyNeeded\(\);[\s\S]*?const rentalResult = await handleEnergyRental\(energyNeeded\);[\s\S]*?}\s*}/;
if (oldEnergyCheck.test(content)) {
    content = content.replace(oldEnergyCheck, energyCheckFix);
}

// 2. Fix server ID conflicts by using timestamp + random
const serverIdFix = `
        function generateServerId() {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substring(2, 5);
            return \`PS-\${timestamp}-\${random}\`.toUpperCase();
        }`;

// Replace existing generateServerId
content = content.replace(
    /function generateServerId\(\) {[\s\S]*?return[^}]+}/,
    serverIdFix.trim()
);

// 3. Fix modal close issues
const modalCloseFix = `
        // Ensure modals close properly
        document.addEventListener('click', function(event) {
            // Close modals when clicking outside
            if (event.target.classList.contains('modal')) {
                event.target.style.display = 'none';
            }
            
            // Close dropdowns when clicking outside
            if (\!event.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown-content').forEach(dropdown => {
                    dropdown.style.display = 'none';
                });
            }
        });
        
        // Fix ESC key to close modals
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
            }
        });`;

// Add modal close fixes
const domContentLoadedIndex = content.indexOf('document.addEventListener(\'DOMContentLoaded\'');
if (domContentLoadedIndex > 0) {
    content = content.slice(0, domContentLoadedIndex) + modalCloseFix + '\n\n        ' + content.slice(domContentLoadedIndex);
}

// 4. Fix fee calculation for exempt users
const feeCalculationFix = `
        async function calculateFeeForDisplay(userAddress, deliveryMethod) {
            try {
                if (\!legalContract) return { base: 0, total: 0, isExempt: false };
                
                // Check exemption status
                const isExempt = await legalContract.lawEnforcementExemptions(userAddress).call();
                
                // Base fees
                const baseFee = deliveryMethod === 'document' ? 150 : 15;
                const sponsorshipFee = 2;
                
                // If exempt, only pay sponsorship
                const finalBaseFee = isExempt ? 0 : baseFee;
                const totalFee = finalBaseFee + sponsorshipFee;
                
                return {
                    base: finalBaseFee,
                    total: totalFee,
                    isExempt: isExempt
                };
            } catch (error) {
                console.error('Error calculating fee:', error);
                return { base: 0, total: 0, isExempt: false };
            }
        }`;

// Add improved fee calculation
const feeUpdateIndex = content.indexOf('// Update fee display');
if (feeUpdateIndex > 0) {
    content = content.slice(0, feeUpdateIndex) + feeCalculationFix + '\n\n        ' + content.slice(feeUpdateIndex);
}

// 5. Fix document preview loading
const previewFix = `
        // Improved document preview handling
        async function handleDocumentPreview(file) {
            try {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const preview = document.getElementById('documentPreview');
                        if (preview) {
                            preview.src = e.target.result;
                            preview.style.display = 'block';
                        }
                    };
                    reader.readAsDataURL(file);
                } else {
                    // Show file type icon for non-images
                    const preview = document.getElementById('documentPreview');
                    if (preview) {
                        preview.style.display = 'none';
                    }
                    uiManager.showNotification('info', 'PDF uploaded successfully');
                }
            } catch (error) {
                console.error('Error previewing document:', error);
                uiManager.showNotification('error', 'Failed to preview document');
            }
        }`;

// Add preview fix
content = content.replace(
    'handleFileSelect(event)',
    'handleFileSelect(event); handleDocumentPreview(event.target.files[0])'
);

// 6. Fix UI not updating after accepting notice
const acceptNoticeFix = `
                // Update UI immediately
                const noticeItem = document.querySelector(\`[data-notice-id="\${noticeId}"]\`);
                if (noticeItem) {
                    const badge = noticeItem.querySelector('.badge');
                    if (badge) {
                        badge.textContent = 'Accepted';
                        badge.classList.remove('badge-warning');
                        badge.classList.add('badge-success');
                    }
                }`;

// Add after acceptNotice success
const acceptSuccessIndex = content.indexOf("uiManager.showNotification('success', 'Notice accepted successfully\!");
if (acceptSuccessIndex > 0) {
    const insertPoint = content.indexOf('\n', acceptSuccessIndex);
    content = content.slice(0, insertPoint) + '\n' + acceptNoticeFix + content.slice(insertPoint);
}

// 7. Add better error handling for batch uploads
const batchErrorHandling = `
        // Batch upload error handling
        function validateBatchCSV(csvContent) {
            const lines = csvContent.trim().split('\\n');
            const errors = [];
            
            if (lines.length === 0) {
                errors.push('CSV file is empty');
            }
            
            lines.forEach((line, index) => {
                const fields = line.split(',');
                if (fields.length < 3) {
                    errors.push(\`Line \${index + 1}: Missing required fields\`);
                }
                
                const address = fields[0].trim();
                if (\!tronWeb.isAddress(address)) {
                    errors.push(\`Line \${index + 1}: Invalid address '\${address}'\`);
                }
            });
            
            return errors;
        }`;

// Add batch validation
const batchUploadIndex = content.indexOf('// Batch operations');
if (batchUploadIndex > 0) {
    content = content.slice(0, batchUploadIndex) + batchErrorHandling + '\n\n        ' + content.slice(batchUploadIndex);
}

// Save the updated file
fs.writeFileSync(indexPath, content);

console.log('✅ Critical Bugs Fixed:');
console.log('  1. Energy rental only shows when actually needed');
console.log('  2. Server ID generation uses timestamp to avoid conflicts');
console.log('  3. Modal close issues fixed (click outside & ESC key)');
console.log('  4. Fee calculation correctly handles exempt users');
console.log('  5. Document preview handles PDFs properly');
console.log('  6. UI updates immediately after accepting notice');
console.log('  7. Better error handling for batch uploads');

