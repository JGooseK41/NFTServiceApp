const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Update the notice text field to make it clearer it's required
const oldNoticeTextField = `                                    <input type="text" class="form-input" id="noticeText" 
                                           placeholder="Legal Notice: Case #CV-2024-001234"
                                           maxlength="100"
                                           style="border: 2px solid #f59e0b;">`;

const newNoticeTextField = `                                    <input type="text" class="form-input" id="noticeText" 
                                           placeholder="Legal Notice: Case #CV-2024-001234"
                                           maxlength="100"
                                           required
                                           style="border: 2px solid #f59e0b;">`;

content = content.replace(oldNoticeTextField, newNoticeTextField);

// 2. Update the error message to be more specific
const oldErrorMessage = `                    if (!noticeText) {
                        uiManager.showNotification('error', 'Notice text is required');
                        createBtn.disabled = false;
                        return;
                    }`;

const newErrorMessage = `                    if (!noticeText) {
                        uiManager.showNotification('error', 'Public notice text is required. This text will appear in the NFT visible to the recipient.');
                        // Highlight the field
                        const noticeTextElement = document.getElementById('noticeText');
                        if (noticeTextElement) {
                            noticeTextElement.focus();
                            noticeTextElement.style.borderColor = '#ef4444';
                            setTimeout(() => {
                                noticeTextElement.style.borderColor = '#f59e0b';
                            }, 3000);
                        }
                        createBtn.disabled = false;
                        return;
                    }`;

content = content.replace(oldErrorMessage, newErrorMessage);

// 3. Add a visual indicator that the field is required
const oldNoticeLabel = `                                    <label for="noticeText" id="noticeTextLabel">
                                        <i class="fas fa-globe" style="color: #f59e0b;"></i> Public Notice Text
                                    </label>`;

const newNoticeLabel = `                                    <label for="noticeText" id="noticeTextLabel">
                                        <i class="fas fa-globe" style="color: #f59e0b;"></i> Public Notice Text <span style="color: #ef4444;">*</span>
                                    </label>`;

content = content.replace(oldNoticeLabel, newNoticeLabel);

// 4. Add placeholder text that's more helpful
const placeholderUpdate = content.replace(
    'placeholder="Legal Notice: Case #CV-2024-001234"',
    'placeholder="e.g., Legal Notice: Summons for Case #CV-2024-001234"'
);
content = placeholderUpdate;

// Write the updated content
fs.writeFileSync(indexPath, content);

console.log('✅ Fixed notice text requirement issues:');
console.log('  - Made field explicitly required');
console.log('  - Added red asterisk to label');
console.log('  - Improved error message with visual feedback');
console.log('  - Updated placeholder to be more helpful');