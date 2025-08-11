/**
 * Fix the Edit button to properly show/hide edit forms
 */

console.log('🔧 Fixing Edit button functionality...');

// Override the showInlineEdit function to make it work properly
window.showInlineEdit = function(walletAddress) {
    console.log(`📝 Opening edit form for: ${walletAddress}`);
    
    // Hide all other edit forms first
    document.querySelectorAll('[id^="edit-"][id$="' + walletAddress + '"]').forEach(el => {
        if (el.id === `edit-${walletAddress}`) {
            // This is the main edit container - toggle it
            const isCurrentlyVisible = el.style.display === 'block';
            el.style.display = isCurrentlyVisible ? 'none' : 'block';
            
            if (!isCurrentlyVisible) {
                console.log('✅ Edit form now visible');
                // Scroll to it
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                
                // Focus first input
                const firstInput = el.querySelector('input');
                if (firstInput) {
                    firstInput.focus();
                }
            } else {
                console.log('✅ Edit form hidden');
            }
        }
    });
    
    // Hide all other server edit forms
    document.querySelectorAll('[id^="edit-T"]').forEach(el => {
        if (el.id !== `edit-${walletAddress}` && el.id.includes('-') && el.id.split('-').length === 2) {
            el.style.display = 'none';
        }
    });
};

// Also make sure the cancel button works
window.cancelInlineEdit = function(walletAddress) {
    const editForm = document.getElementById(`edit-${walletAddress}`);
    if (editForm) {
        editForm.style.display = 'none';
        console.log('✅ Edit form cancelled');
    }
};

// Fix any existing Edit buttons
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        // Find all edit buttons and ensure they use the correct function
        document.querySelectorAll('button').forEach(btn => {
            if (btn.textContent.includes('Edit') && btn.onclick) {
                const onclickStr = btn.onclick.toString();
                const walletMatch = onclickStr.match(/showInlineEdit\(['"]([^'"]+)['"]\)/);
                if (walletMatch) {
                    const wallet = walletMatch[1];
                    btn.onclick = () => showInlineEdit(wallet);
                    console.log(`✅ Fixed edit button for ${wallet}`);
                }
            }
        });
    }, 2000);
});

console.log('✅ Edit button fix applied!');