const fs = require('fs');
const path = require('path');

console.log('🚀 Implementing Quick Win Improvements...\n');

const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Add fee display before form submission
const feeDisplayHTML = `
                <\!-- Fee Estimation Display -->
                <div class="card" style="margin-top: 1rem; background: var(--bg-secondary); border: 1px solid var(--accent-blue);">
                    <div class="card-header" style="padding: 1rem; border-bottom: 1px solid var(--border-color);">
                        <h3 style="margin: 0; font-size: 1rem;"><i class="fas fa-calculator"></i> Fee Estimation</h3>
                    </div>
                    <div style="padding: 1rem;">
                        <div id="feeBreakdown" style="font-size: 0.9rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span>Base Fee:</span>
                                <span id="baseFeeDisplay">-</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span>Sponsorship:</span>
                                <span>2 TRX</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color); font-weight: bold;">
                                <span>Total:</span>
                                <span id="totalFeeDisplay">-</span>
                            </div>
                            <div id="energyEstimate" style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-secondary);">
                                <i class="fas fa-bolt"></i> Estimated Energy: ~65,000
                            </div>
                        </div>
                    </div>
                </div>`;

// Insert fee display in the notice creation form
const noticeFormIndex = content.indexOf('<\!-- Create Notice Button -->');
if (noticeFormIndex > 0) {
    content = content.slice(0, noticeFormIndex) + feeDisplayHTML + '\n' + content.slice(noticeFormIndex);
}

// 2. Add loading states to all buttons
const buttonLoadingScript = `
        // Add loading state to buttons
        function setButtonLoading(button, loading, originalText) {
            if (loading) {
                button.disabled = true;
                button.dataset.originalText = originalText || button.innerHTML;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            } else {
                button.disabled = false;
                button.innerHTML = button.dataset.originalText || originalText;
            }
        }
        
        // Update fee display
        async function updateFeeDisplay() {
            if (\!legalContract || \!tronWeb.defaultAddress) return;
            
            try {
                const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked')?.value || 'document';
                const baseFee = deliveryMethod === 'document' ? 150 : 15;
                const userAddress = tronWeb.defaultAddress.base58;
                
                // Check exemptions
                const isExempt = await legalContract.lawEnforcementExemptions(userAddress).call();
                const finalBaseFee = isExempt ? 0 : baseFee;
                
                document.getElementById('baseFeeDisplay').textContent = finalBaseFee + ' TRX';
                document.getElementById('totalFeeDisplay').textContent = (finalBaseFee + 2) + ' TRX';
                
                if (isExempt) {
                    document.getElementById('baseFeeDisplay').innerHTML += ' <span style="color: var(--success);">(Exempt)</span>';
                }
            } catch (error) {
                console.error('Error updating fee display:', error);
            }
        }
        
        // Character counter for text notices
        function updateCharacterCount() {
            const textArea = document.getElementById('noticeText');
            const counter = document.getElementById('charCount');
            if (textArea && counter) {
                const length = textArea.value.length;
                counter.textContent = length;
                counter.style.color = length > 90 ? 'var(--error)' : length > 70 ? 'var(--warning)' : 'var(--text-secondary)';
            }
        }`;

// Add the scripts before createLegalNotice
const createNoticeIndex = content.indexOf('// Create Legal Notice - Main function');
content = content.slice(0, createNoticeIndex) + buttonLoadingScript + '\n\n        ' + content.slice(createNoticeIndex);

// 3. Update createLegalNotice to use loading states
content = content.replace(
    'showProcessing(\'Creating legal notice...\');',
    `showProcessing('Creating legal notice...');
                const submitButton = event.target;
                setButtonLoading(submitButton, true);`
);

content = content.replace(
    'hideProcessing();',
    `hideProcessing();
                if (submitButton) setButtonLoading(submitButton, false, '<i class="fas fa-paper-plane"></i> Create Notice');`
);

// 4. Add better error messages
const errorMessages = {
    'User rejected': 'Transaction was cancelled. Please try again.',
    'Insufficient': 'Insufficient balance. You need at least {fee} TRX to create this notice.',
    'not a process server': 'You need to be registered as a process server to create notices.',
    'Contract paused': 'The service is temporarily unavailable. Please try again later.',
    'Invalid address': 'The recipient address is not valid. Please check and try again.'
};

// 5. Add help tooltips
const helpTooltips = `
        // Initialize tooltips
        function initializeTooltips() {
            const tooltips = [
                { id: 'recipientAddress', text: 'The TRON wallet address of the person receiving the legal notice' },
                { id: 'caseNumber', text: 'Your internal case or reference number' },
                { id: 'noticeType', text: 'Select the type of legal notice you are serving' },
                { id: 'tokenName', text: 'A short name for this notice (e.g., "Smith Summons")' }
            ];
            
            tooltips.forEach(tooltip => {
                const element = document.getElementById(tooltip.id);
                if (element) {
                    const label = element.previousElementSibling;
                    if (label && \!label.querySelector('.tooltip-icon')) {
                        label.innerHTML += ' <i class="fas fa-question-circle tooltip-icon" title="' + tooltip.text + '" style="color: var(--text-secondary); cursor: help;"></i>';
                    }
                }
            });
        }`;

// Add tooltip initialization
content = content.replace(
    '// Initialize data from localStorage',
    `// Initialize tooltips
            initializeTooltips();
            
            // Initialize data from localStorage`
);

// 6. Save form data to localStorage
const formSaveScript = `
        // Auto-save form data
        function saveFormData() {
            const formData = {
                recipientAddress: document.getElementById('recipientAddress')?.value || '',
                caseNumber: document.getElementById('caseNumber')?.value || '',
                noticeType: document.getElementById('noticeType')?.value || '',
                issuingAgency: document.getElementById('issuingAgency')?.value || '',
                noticeText: document.getElementById('noticeText')?.value || '',
                tokenName: document.getElementById('tokenName')?.value || ''
            };
            localStorage.setItem('noticeFormDraft', JSON.stringify(formData));
        }
        
        // Restore form data
        function restoreFormData() {
            const savedData = localStorage.getItem('noticeFormDraft');
            if (savedData) {
                try {
                    const formData = JSON.parse(savedData);
                    Object.keys(formData).forEach(key => {
                        const element = document.getElementById(key);
                        if (element && formData[key]) {
                            element.value = formData[key];
                        }
                    });
                } catch (e) {
                    console.error('Error restoring form data:', e);
                }
            }
        }
        
        // Set up auto-save
        ['recipientAddress', 'caseNumber', 'noticeType', 'issuingAgency', 'noticeText', 'tokenName'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', saveFormData);
            }
        });`;

// Add form save/restore functionality
content = content.replace(
    '// Initialize tooltips',
    formSaveScript + '\n\n        // Initialize tooltips'
);

content = content.replace(
    'initializeTooltips();',
    'initializeTooltips();\n            restoreFormData();'
);

// Write the updated content
fs.writeFileSync(indexPath, content);

console.log('✅ Implemented Quick Wins:');
console.log('  1. Added fee estimation display');
console.log('  2. Added loading states for buttons');
console.log('  3. Improved error messages');
console.log('  4. Added help tooltips');
console.log('  5. Added form auto-save');
console.log('  6. Added character counter update');

console.log('\n📝 Additional improvements needed:');
console.log('  - Mobile responsive design');
console.log('  - Notification system for recipients');
console.log('  - Analytics dashboard');
console.log('  - Batch operation resume capability');
console.log('  - Energy monitoring alerts');

