const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing all UI functions for optimized contract...\n');

const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Add createLegalNotice function before the closing script tag
const createLegalNoticeFunction = `
        // Create Legal Notice - Main function for minting NFTs
        async function createLegalNotice() {
            if (\!legalContract || \!tronWeb.defaultAddress) {
                uiManager.showNotification('error', 'Please connect wallet and contract first');
                return;
            }
            
            // Get form values
            const recipient = document.getElementById('recipientAddress').value.trim();
            const publicText = document.getElementById('noticeText').value.trim();
            const noticeType = document.getElementById('noticeType').value;
            const customType = document.getElementById('customNoticeType').value.trim();
            const caseNumber = document.getElementById('caseNumber').value.trim();
            const issuingAgency = document.getElementById('issuingAgency').value.trim();
            const tokenName = document.getElementById('tokenName').value.trim();
            const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked').value;
            
            // Validation
            if (\!recipient) {
                uiManager.showNotification('error', 'Please enter recipient address');
                return;
            }
            
            if (\!tronWeb.isAddress(recipient)) {
                uiManager.showNotification('error', 'Invalid recipient address');
                return;
            }
            
            if (\!publicText && deliveryMethod === 'text') {
                uiManager.showNotification('error', 'Please enter notice text');
                return;
            }
            
            if (deliveryMethod === 'document' && \!uploadedImage) {
                uiManager.showNotification('error', 'Please upload a document');
                return;
            }
            
            try {
                showProcessing('Creating legal notice...');
                
                // Calculate fee
                const fee = await calculateFeeFromConstants(tronWeb.defaultAddress.base58);
                
                // Build notice request
                const noticeRequest = {
                    recipient: recipient,
                    publicText: publicText || '',
                    noticeType: noticeType === 'Custom' ? customType : noticeType,
                    caseNumber: caseNumber || '',
                    issuingAgency: issuingAgency || '',
                    baseTokenName: tokenName || 'Legal Notice',
                    hasDocument: deliveryMethod === 'document',
                    encryptedIPFS: uploadedImage ? uploadedImage.ipfsHash : '',
                    encryptedKey: uploadedImage ? uploadedImage.encryptedKey : ''
                };
                
                // Send transaction
                const result = await legalContract.createNotice(noticeRequest).send({
                    feeLimit: 100_000_000,
                    callValue: fee,
                    shouldPollResponse: true
                });
                
                console.log('Transaction result:', result);
                
                // Get notice ID from event
                let noticeId = null;
                if (result && result.length > 0) {
                    const eventData = result[0];
                    noticeId = eventData.noticeId || eventData._noticeId || eventData[0];
                }
                
                hideProcessing();
                
                // Show success
                showTransactionResult({
                    success: true,
                    txHash: result.txid || result,
                    noticeId: noticeId,
                    recipient: recipient,
                    ipfsData: uploadedImage
                });
                
                // Clear form
                clearNoticeForm();
                
            } catch (error) {
                hideProcessing();
                console.error('Error creating notice:', error);
                uiManager.showNotification('error', 'Failed to create notice: ' + getErrorMessage(error));
            }
        }
        
        // Clear notice form
        function clearNoticeForm() {
            document.getElementById('recipientAddress').value = '';
            document.getElementById('noticeText').value = '';
            document.getElementById('caseNumber').value = '';
            document.getElementById('issuingAgency').value = '';
            document.getElementById('tokenName').value = '';
            uploadedImage = null;
            
            // Reset file upload
            const uploadResult = document.getElementById('uploadResult');
            if (uploadResult) {
                uploadResult.style.display = 'none';
            }
        }
        
        // Show transaction result
        function showTransactionResult(result) {
            const modal = document.getElementById('transactionResultModal');
            const txDetails = document.getElementById('txDetails');
            const txLink = document.getElementById('txLink');
            const txHash = document.getElementById('txHash');
            
            if (result.success) {
                let details = \`
                    <div class="token-detail">
                        <span>Status:</span>
                        <span class="success-text">✓ Success</span>
                    </div>
                \`;
                
                if (result.noticeId) {
                    details += \`
                        <div class="token-detail">
                            <span>Notice ID:</span>
                            <span>#\${result.noticeId}</span>
                        </div>
                    \`;
                }
                
                if (result.recipient) {
                    details += \`
                        <div class="token-detail">
                            <span>Recipient:</span>
                            <span>\${result.recipient.substring(0, 10)}...\${result.recipient.substring(result.recipient.length - 8)}</span>
                        </div>
                    \`;
                }
                
                if (result.ipfsData) {
                    details += \`
                        <div class="token-detail">
                            <span>Document:</span>
                            <span>Encrypted on IPFS</span>
                        </div>
                    \`;
                }
                
                txDetails.innerHTML = details;
                txHash.textContent = result.txHash;
                
                // Set TronScan link
                const network = document.getElementById('networkName').textContent;
                let tronscanUrl = 'https://tronscan.org/#/transaction/';
                if (network.includes('Nile')) {
                    tronscanUrl = 'https://nile.tronscan.org/#/transaction/';
                }
                txLink.href = tronscanUrl + result.txHash;
                
                modal.style.display = 'block';
            }
        }`;

// Insert the functions before the last closing script tag
const scriptEndIndex = content.lastIndexOf('</script>');
content = content.slice(0, scriptEndIndex) + createLegalNoticeFunction + '\n' + content.slice(scriptEndIndex);

// Write the updated content
fs.writeFileSync(indexPath, content);

console.log('✅ Added createLegalNotice and related functions');

// Now let's fix other contract method calls
const fixes = [
    // Fix fee calculations
    {
        old: 'await legalContract.calculateFee(',
        new: 'await calculateFeeFromConstants('
    },
    // Fix notice info retrieval
    {
        old: 'await legalContract.getNoticeInfo(',
        new: 'await legalContract.getNotice('
    },
    // Fix total notices
    {
        old: 'await legalContract.totalNotices()',
        new: 'await legalContract.totalSupply()'
    },
    // Fix recipient notices
    {
        old: 'await legalContract.getRecipientNotices(',
        new: 'await getRecipientNoticeIds('
    }
];

// Apply fixes
fixes.forEach(fix => {
    const regex = new RegExp(fix.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const count = (content.match(regex) || []).length;
    if (count > 0) {
        content = content.replace(regex, fix.new);
        console.log(`✅ Fixed ${count} instances of ${fix.old}`);
    }
});

// Write the final content
fs.writeFileSync(indexPath, content);

console.log('\n✅ All UI functions updated for optimized contract\!');

