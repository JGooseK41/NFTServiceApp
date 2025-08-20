/**
 * Force all admin panel inputs to be visible
 */

console.log('🔧 Forcing input visibility...');

// Function to make inputs visible
window.forceInputsVisible = function() {
    // Find all inputs in the process servers list
    const inputs = document.querySelectorAll('#processServersList input');
    
    console.log(`Found ${inputs.length} inputs, making them visible...`);
    
    inputs.forEach((input, index) => {
        // Force visibility with important styles
        input.style.cssText = `
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            width: 100% !important;
            max-width: 300px !important;
            height: 35px !important;
            padding: 8px !important;
            background: #1f2937 !important;
            color: #f3f4f6 !important;
            border: 1px solid #4b5563 !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            position: relative !important;
            z-index: 1000 !important;
        `;
        
        // Also ensure parent is visible
        if (input.parentElement) {
            input.parentElement.style.display = 'block';
            input.parentElement.style.visibility = 'visible';
            input.parentElement.style.opacity = '1';
        }
        
        console.log(`✓ Input ${index}: ${input.id} forced visible`);
    });
    
    // Also make sure edit forms are visible
    document.querySelectorAll('[id^="edit-T"]').forEach(form => {
        if (form.id.match(/^edit-T[A-Za-z0-9]+$/)) {
            form.style.display = 'block';
            form.style.visibility = 'visible';
            form.style.opacity = '1';
            console.log(`✓ Form ${form.id} made visible`);
        }
    });
};

// Override showInlineEdit to always force visibility
const originalShowInlineEdit = window.showInlineEdit;
window.showInlineEdit = function(walletAddress) {
    console.log(`📝 Opening edit form with forced visibility for: ${walletAddress}`);
    
    // First hide all edit forms
    document.querySelectorAll('[id^="edit-T"]').forEach(form => {
        if (form.id.match(/^edit-T[A-Za-z0-9]+$/)) {
            form.style.display = 'none';
        }
    });
    
    // Show the requested form
    const editForm = document.getElementById(`edit-${walletAddress}`);
    if (editForm) {
        editForm.style.display = 'block';
        editForm.style.visibility = 'visible';
        editForm.style.opacity = '1';
        
        // Force all inputs in this form to be visible
        const inputs = editForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.style.cssText = `
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                width: 100% !important;
                max-width: 300px !important;
                height: 35px !important;
                padding: 8px !important;
                background: #1f2937 !important;
                color: #f3f4f6 !important;
                border: 1px solid #4b5563 !important;
                border-radius: 4px !important;
                font-size: 14px !important;
            `;
        });
        
        console.log(`✅ Edit form shown with ${inputs.length} visible inputs`);
        
        // Scroll to form
        editForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Focus first input
        if (inputs.length > 0) {
            inputs[0].focus();
        }
    }
};

// Auto-fix visibility when page loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const adminTab = document.getElementById('adminTab');
        if (adminTab && adminTab.style.display !== 'none') {
            console.log('🔄 Auto-fixing input visibility...');
            forceInputsVisible();
        }
    }, 2000);
});

// Also run when clicking on Admin tab
const originalSwitchTab = window.switchTab;
if (originalSwitchTab) {
    window.switchTab = function(tabName) {
        const result = originalSwitchTab.apply(this, arguments);
        
        if (tabName === 'admin') {
            setTimeout(() => {
                console.log('🔄 Fixing inputs after tab switch...');
                forceInputsVisible();
            }, 500);
        }
        
        return result;
    };
}

console.log('✅ Input visibility fix loaded!');
console.log('   Run forceInputsVisible() to manually fix inputs');
console.log('   Inputs will auto-fix when clicking Edit buttons');