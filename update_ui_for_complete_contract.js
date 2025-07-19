const fs = require('fs');

// This script updates the UI to work with the LegalNoticeNFT_Complete contract

function updateUI(newContractAddress) {
    console.log('Updating UI for new contract address:', newContractAddress);
    
    // Read the current index.html
    let html = fs.readFileSync('index.html', 'utf8');
    
    // Update all instances of the old contract address
    const oldAddress = 'TMv8Xmf6MbeJSQH4av375kq1sL3jDRFwyo';
    html = html.replace(new RegExp(oldAddress, 'g'), newContractAddress);
    
    // Fix the fee exemption calls
    html = html.replace(/legalContract\.feeExemptions\(/g, 'legalContract.serviceFeeExemptions(');
    
    // Update the fee calculation function to support dynamic fees
    const feeCalculationUpdate = `
            // Calculate total fee with dynamic fee support
            async function calculateRequiredFee(sponsorFees = false) {
                try {
                    const userAddress = window.tronWeb.defaultAddress.base58;
                    
                    // Get dynamic fees
                    const serviceFee = await legalContract.serviceFee().call();
                    const creationFee = await legalContract.creationFee ? 
                        await legalContract.creationFee().call() : 
                        window.tronWeb.toBigNumber(0);
                    const sponsorshipFee = window.tronWeb.toBigNumber(2000000); // 2 TRX default
                    
                    // Check exemptions
                    const isServiceExempt = await legalContract.serviceFeeExemptions(userAddress).call();
                    const isFullExempt = await legalContract.fullFeeExemptions(userAddress).call();
                    
                    let totalFee = creationFee;
                    
                    if (isFullExempt) {
                        // Only pay creation fee
                    } else if (isServiceExempt) {
                        totalFee = totalFee.add(serviceFee.div(2)); // 50% discount
                    } else {
                        totalFee = totalFee.add(serviceFee); // Full service fee
                    }
                    
                    if (sponsorFees) {
                        totalFee = totalFee.add(sponsorshipFee);
                    }
                    
                    return totalFee;
                } catch (error) {
                    console.error('Error calculating fee:', error);
                    // Fallback to default fee
                    return window.tronWeb.toBigNumber(22000000); // 22 TRX default
                }
            }`;
    
    // Find and replace the existing fee calculation
    const feeCalcRegex = /\/\/ Calculate total fee[\s\S]*?return totalFee;[\s\S]*?\}/;
    if (feeCalcRegex.test(html)) {
        html = html.replace(feeCalcRegex, feeCalculationUpdate);
    } else {
        // If not found, add it before the first use of fee calculation
        const insertPoint = html.indexOf('async function serveNotice()');
        if (insertPoint !== -1) {
            html = html.substring(0, insertPoint) + feeCalculationUpdate + '\n\n' + html.substring(insertPoint);
        }
    }
    
    // Add support for new events
    const eventListenersUpdate = `
            // Listen for new events from Complete contract
            if (legalContract.LegalNoticeCreated) {
                legalContract.LegalNoticeCreated().watch((err, event) => {
                    if (!err && event.result) {
                        console.log('Legal notice created:', event.result);
                        showNotification('Legal notice created successfully', 'success');
                    }
                });
            }
            
            if (legalContract.FeeUpdated) {
                legalContract.FeeUpdated().watch((err, event) => {
                    if (!err && event.result) {
                        console.log('Fee updated:', event.result);
                        showNotification('Contract fees have been updated', 'info');
                        updateDashboard(); // Refresh fee displays
                    }
                });
            }`;
    
    // Insert event listeners after contract initialization
    const eventInsertPoint = html.indexOf('// Listen for events');
    if (eventInsertPoint !== -1) {
        const endOfEventSection = html.indexOf('\n\n', eventInsertPoint);
        html = html.substring(0, endOfEventSection) + '\n' + eventListenersUpdate + html.substring(endOfEventSection);
    }
    
    // Update the admin panel fee exemption function
    html = html.replace(
        /await legalContract\.setFeeExemption\(address, isExempt\)\.send/g,
        'await legalContract.setFeeExemption(address, isExempt, false).send'
    );
    
    // Fix the alerts() function call to handle the new return format
    const alertsFixRegex = /const alert = await legalContract\.alerts\(alertId\)\.call\(\);/g;
    html = html.replace(alertsFixRegex, `const alertData = await legalContract.alerts(alertId).call();
                const alert = {
                    recipient: alertData.recipient,
                    sender: alertData.sender,
                    documentId: alertData.documentId,
                    timestamp: alertData.timestamp,
                    acknowledged: alertData.acknowledged,
                    issuingAgency: alertData.issuingAgency,
                    noticeType: alertData.noticeType,
                    caseNumber: alertData.caseNumber,
                    caseDetails: alertData.caseDetails,
                    legalRights: alertData.legalRights,
                    responseDeadline: alertData.responseDeadline,
                    previewImage: alertData.previewImage || ''
                };`);
    
    // Write the updated HTML
    fs.writeFileSync('index_updated.html', html);
    console.log('Updated UI saved to index_updated.html');
    
    // Create a backup of the original
    fs.copyFileSync('index.html', 'index_backup_' + Date.now() + '.html');
    console.log('Backup of original saved');
    
    // Instructions
    console.log('\nNext steps:');
    console.log('1. Review index_updated.html');
    console.log('2. Test the updates');
    console.log('3. If everything works, rename index_updated.html to index.html');
    console.log('\nDon\'t forget to update the CONTRACT_ABI with the new ABI from:');
    console.log('contracts/LegalNoticeNFT_Complete_sol_LegalNoticeNFT.abi');
}

// Get the new contract address from command line or use placeholder
const newAddress = process.argv[2] || 'NEW_CONTRACT_ADDRESS_HERE';

if (newAddress === 'NEW_CONTRACT_ADDRESS_HERE') {
    console.log('Usage: node update_ui_for_complete_contract.js <new_contract_address>');
    console.log('Example: node update_ui_for_complete_contract.js TXxxxYourNewContractAddress');
} else {
    updateUI(newAddress);
}