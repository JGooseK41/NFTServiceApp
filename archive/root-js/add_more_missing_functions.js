const fs = require('fs');
const path = require('path');

console.log('🔧 Adding more missing UI functions...\n');

const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Functions to add
const functionsToAdd = `
        // Notice acceptance function
        async function acceptNotice() {
            const noticeId = document.getElementById('acceptNoticeId').textContent;
            const acceptanceText = document.getElementById('acceptanceText').value.trim();
            
            if (\!acceptanceText) {
                uiManager.showNotification('error', 'Please enter your acceptance text');
                return;
            }
            
            try {
                showProcessing('Accepting notice...');
                
                await legalContract.acceptNotice(noticeId).send({
                    feeLimit: 100_000_000,
                    shouldPollResponse: true
                });
                
                hideProcessing();
                uiManager.showNotification('success', 'Notice accepted successfully\!');
                
                // Close modal and refresh
                closeAcceptModal();
                setTimeout(() => {
                    refreshMyAlerts();
                }, 2000);
                
            } catch (error) {
                hideProcessing();
                console.error('Error accepting notice:', error);
                uiManager.showNotification('error', 'Failed to accept: ' + getErrorMessage(error));
            }
        }
        
        // Refresh my alerts
        async function refreshMyAlerts() {
            if (\!legalContract || \!tronWeb.defaultAddress) {
                uiManager.showNotification('error', 'Please connect wallet first');
                return;
            }
            
            try {
                const myAddress = tronWeb.defaultAddress.base58;
                const noticeIds = await getRecipientNoticeIds(myAddress);
                
                const alertsContent = document.getElementById('myAlertsContent');
                if (noticeIds.length === 0) {
                    alertsContent.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><h3>No notices received</h3></div>';
                    return;
                }
                
                let html = '<div class="notice-list">';
                for (const noticeId of noticeIds) {
                    try {
                        const notice = await legalContract.getNotice(noticeId).call();
                        const { timestamp, serverId, hasDocument, accepted } = parsePackedData(notice.packedData);
                        
                        html += \`
                            <div class="notice-item">
                                <div class="notice-header">
                                    <h4>Notice #\${noticeId}</h4>
                                    <span class="badge \${accepted ? 'badge-success' : 'badge-warning'}">
                                        \${accepted ? 'Accepted' : 'Pending'}
                                    </span>
                                </div>
                                <div class="notice-details">
                                    <p><strong>From:</strong> \${notice.sender}</p>
                                    <p><strong>Date:</strong> \${new Date(timestamp * 1000).toLocaleString()}</p>
                                    <p><strong>Type:</strong> \${notice.noticeType || 'Legal Notice'}</p>
                                    \${\!accepted ? \`
                                        <button class="btn btn-primary btn-small" onclick="showAcceptModal(\${noticeId})">
                                            <i class="fas fa-check"></i> Accept Notice
                                        </button>
                                    \` : ''}
                                </div>
                            </div>
                        \`;
                    } catch (e) {
                        console.error('Error loading notice', noticeId, e);
                    }
                }
                html += '</div>';
                
                alertsContent.innerHTML = html;
                
            } catch (error) {
                console.error('Error refreshing alerts:', error);
                uiManager.showNotification('error', 'Failed to refresh alerts');
            }
        }
        
        // Show accept modal
        function showAcceptModal(noticeId) {
            document.getElementById('acceptNoticeId').textContent = noticeId;
            document.getElementById('acceptModal').style.display = 'block';
        }
        
        // Contract resource check
        async function checkContractResources() {
            if (\!legalContract) {
                uiManager.showNotification('error', 'Contract not connected');
                return;
            }
            
            try {
                const contractAddress = document.getElementById('contractAddress').value;
                const accountInfo = await tronWeb.trx.getAccount(contractAddress);
                
                const energyLimit = accountInfo.energy_limit || 0;
                const energy = accountInfo.energy || 0;
                const bandwidth = accountInfo.bandwidth || 0;
                
                const html = \`
                    <div class="resource-info">
                        <h4>Contract Resources</h4>
                        <p>Energy: \${energy} / \${energyLimit}</p>
                        <p>Bandwidth: \${bandwidth}</p>
                    </div>
                \`;
                
                showAlert('resourceStatus', 'info', html);
                
            } catch (error) {
                console.error('Error checking resources:', error);
                showAlert('resourceStatus', 'error', 'Failed to check resources');
            }
        }
        
        // Fee update functions
        async function updateServiceFee() {
            const newFee = document.getElementById('newServiceFee').value;
            if (\!newFee || newFee <= 0) {
                uiManager.showNotification('error', 'Please enter a valid fee amount');
                return;
            }
            
            try {
                showProcessing('Updating service fee...');
                const feeInSun = tronWeb.toSun(newFee);
                
                await legalContract.updateServiceFee(feeInSun).send({
                    feeLimit: 50_000_000,
                    shouldPollResponse: true
                });
                
                hideProcessing();
                uiManager.showNotification('success', 'Service fee updated successfully');
                
            } catch (error) {
                hideProcessing();
                console.error('Error updating fee:', error);
                uiManager.showNotification('error', 'Failed: ' + getErrorMessage(error));
            }
        }
        
        // Withdraw from contract
        async function withdrawFromContract() {
            const amount = document.getElementById('withdrawAmount').value;
            if (\!amount || amount <= 0) {
                uiManager.showNotification('error', 'Please enter a valid amount');
                return;
            }
            
            try {
                showProcessing('Withdrawing funds...');
                const amountInSun = tronWeb.toSun(amount);
                
                await legalContract.withdrawFees(amountInSun).send({
                    feeLimit: 50_000_000,
                    shouldPollResponse: true
                });
                
                hideProcessing();
                uiManager.showNotification('success', \`Successfully withdrew \${amount} TRX\`);
                document.getElementById('withdrawAmount').value = '';
                
            } catch (error) {
                hideProcessing();
                console.error('Withdrawal error:', error);
                uiManager.showNotification('error', 'Failed: ' + getErrorMessage(error));
            }
        }
        
        // Export registrations
        function exportRegistrations() {
            const registrations = JSON.parse(localStorage.getItem('serverRegistrations') || '{}');
            const dataStr = JSON.stringify(registrations, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = \`registrations_\${new Date().toISOString().split('T')[0]}.json\`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        }
        
        // Toggle FAQ
        function toggleFAQ(element) {
            const content = element.nextElementSibling;
            const icon = element.querySelector('.faq-icon');
            
            if (content.style.display === 'block') {
                content.style.display = 'none';
                icon.textContent = '+';
            } else {
                content.style.display = 'block';
                icon.textContent = '-';
            }
        }
        
        // Open registration for user
        function openRegistrationForUser() {
            if (\!isProcessServer) {
                openRegistrationModal();
            } else {
                uiManager.showNotification('info', 'You are already registered as a process server');
            }
        }`;

// Find a good place to insert the functions (before the last createLegalNotice function)
const insertIndex = content.lastIndexOf('// Create Legal Notice - Main function');
if (insertIndex > 0) {
    content = content.slice(0, insertIndex) + functionsToAdd + '\n\n        ' + content.slice(insertIndex);
} else {
    // Fallback: insert before the last closing script tag
    const scriptEndIndex = content.lastIndexOf('</script>');
    content = content.slice(0, scriptEndIndex) + functionsToAdd + '\n' + content.slice(scriptEndIndex);
}

fs.writeFileSync(indexPath, content);

console.log('✅ Added all missing UI functions\!');

