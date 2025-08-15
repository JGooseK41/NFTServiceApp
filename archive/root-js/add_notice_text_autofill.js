const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Add auto-fill functionality based on notice type selection
const noticeTypeChangeHandler = `                                    </select>
                                    <input type="text" class="form-input" id="customNoticeType" placeholder="Enter custom notice type" style="display: none; margin-top: 0.5rem;">
                                </div>`;

const newNoticeTypeChangeHandler = `                                    </select>
                                    <input type="text" class="form-input" id="customNoticeType" placeholder="Enter custom notice type" style="display: none; margin-top: 0.5rem;">
                                </div>
                                
                                <script>
                                    // Auto-fill notice text based on notice type
                                    document.getElementById('noticeType').addEventListener('change', function() {
                                        const noticeText = document.getElementById('noticeText');
                                        const caseNumber = document.getElementById('caseNumber').value || '[CASE NUMBER]';
                                        const noticeType = this.value;
                                        
                                        if (noticeText && !noticeText.value) {
                                            let suggestedText = '';
                                            switch(noticeType) {
                                                case 'Summons':
                                                    suggestedText = 'Legal Summons: Case #' + caseNumber + ' - Response Required';
                                                    break;
                                                case 'Subpoena':
                                                    suggestedText = 'Subpoena: Case #' + caseNumber + ' - Appearance Required';
                                                    break;
                                                case 'Complaint':
                                                    suggestedText = 'Legal Complaint Filed: Case #' + caseNumber;
                                                    break;
                                                case 'Motion':
                                                    suggestedText = 'Motion Filed: Case #' + caseNumber + ' - Court Action Pending';
                                                    break;
                                                case 'Order':
                                                    suggestedText = 'Court Order: Case #' + caseNumber + ' - Compliance Required';
                                                    break;
                                                case 'Notice':
                                                    suggestedText = 'Legal Notice: Case #' + caseNumber + ' - Action Required';
                                                    break;
                                                default:
                                                    suggestedText = 'Legal Notice: ' + noticeType + ' - Case #' + caseNumber;
                                            }
                                            noticeText.value = suggestedText;
                                            // Trigger input event to update character count
                                            noticeText.dispatchEvent(new Event('input'));
                                        }
                                    });
                                    
                                    // Also update when case number changes
                                    document.getElementById('caseNumber').addEventListener('input', function() {
                                        const noticeText = document.getElementById('noticeText');
                                        const noticeType = document.getElementById('noticeType').value;
                                        const caseNumber = this.value;
                                        
                                        if (noticeText && noticeText.value && caseNumber) {
                                            // Update case number in existing text
                                            noticeText.value = noticeText.value.replace(/Case #[^\\s-]*/g, 'Case #' + caseNumber);
                                            noticeText.dispatchEvent(new Event('input'));
                                        }
                                    });
                                </script>`;

// Find the right place to insert (after the notice type field)
const insertPosition = content.indexOf('                                    </select>\n                                    <input type="text" class="form-input" id="customNoticeType" placeholder="Enter custom notice type" style="display: none; margin-top: 0.5rem;">\n                                </div>');

if (insertPosition !== -1) {
    // Replace just this section
    content = content.replace(noticeTypeChangeHandler, newNoticeTypeChangeHandler);
} else {
    console.log('⚠️  Could not find notice type field to add auto-fill handler');
}

// Write the updated content
fs.writeFileSync(indexPath, content);

console.log('✅ Added notice text auto-fill functionality:');
console.log('  - Auto-generates appropriate text based on notice type');
console.log('  - Updates when case number is entered');
console.log('  - Only fills if field is empty (respects user input)');