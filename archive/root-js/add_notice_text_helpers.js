const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Add helper functions for notice text after the existing event listeners
const insertPoint = `// Setup case number auto-generation
document.getElementById('noticeType').addEventListener('change', function() {`;

const helperFunctions = `// Helper function to generate notice text
function generateNoticeText(noticeType, caseNumber) {
    const actualCaseNumber = caseNumber || '[CASE NUMBER]';
    switch(noticeType) {
        case 'Summons':
            return 'Legal Summons: Case #' + actualCaseNumber + ' - Response Required';
        case 'Subpoena':
            return 'Subpoena: Case #' + actualCaseNumber + ' - Appearance Required';
        case 'Complaint':
            return 'Legal Complaint Filed: Case #' + actualCaseNumber;
        case 'Motion':
            return 'Motion Filed: Case #' + actualCaseNumber + ' - Court Action Pending';
        case 'Order':
            return 'Court Order: Case #' + actualCaseNumber + ' - Compliance Required';
        case 'Notice':
            return 'Legal Notice: Case #' + actualCaseNumber + ' - Action Required';
        default:
            return 'Legal Notice: ' + noticeType + ' - Case #' + actualCaseNumber;
    }
}

// Auto-fill notice text when notice type or case number changes
function updateNoticeTextSuggestion() {
    const noticeText = document.getElementById('noticeText');
    const noticeType = document.getElementById('noticeType').value;
    const caseNumber = document.getElementById('caseNumber').value;
    
    // Only update if the field is empty or contains a previous suggestion
    if (noticeText && (!noticeText.value || noticeText.value.startsWith('Legal') || noticeText.value.startsWith('Subpoena') || noticeText.value.startsWith('Court'))) {
        noticeText.value = generateNoticeText(noticeType, caseNumber);
        noticeText.dispatchEvent(new Event('input'));
    }
}

// Setup case number auto-generation
document.getElementById('noticeType').addEventListener('change', function() {`;

content = content.replace(insertPoint, helperFunctions);

// Add event listeners to both noticeType and caseNumber fields
const caseNumberListener = `document.getElementById('caseNumber').addEventListener('blur', function() {
    if (!this.value && document.getElementById('mintCaseNumber')) {
        document.getElementById('mintCaseNumber').value = this.value;
    }
});`;

const updatedCaseNumberListener = `document.getElementById('caseNumber').addEventListener('blur', function() {
    if (!this.value && document.getElementById('mintCaseNumber')) {
        document.getElementById('mintCaseNumber').value = this.value;
    }
});

// Also update notice text when case number changes
document.getElementById('caseNumber').addEventListener('input', updateNoticeTextSuggestion);`;

content = content.replace(caseNumberListener, updatedCaseNumberListener);

// Also call updateNoticeTextSuggestion when notice type changes
const noticeTypeChange = `    updateCustomNoticeTypeVisibility();
});`;

const updatedNoticeTypeChange = `    updateCustomNoticeTypeVisibility();
    updateNoticeTextSuggestion();
});`;

content = content.replace(noticeTypeChange, updatedNoticeTypeChange);

// Write the updated content
fs.writeFileSync(indexPath, content);

console.log('✅ Added notice text helper functionality:');
console.log('  - generateNoticeText function creates appropriate text based on type');
console.log('  - Auto-updates when notice type or case number changes');
console.log('  - Only updates if field is empty or contains default text');