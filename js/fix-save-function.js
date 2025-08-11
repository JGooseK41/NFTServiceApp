/**
 * Fix the save function for process server edits
 */

console.log('🔧 Fixing save function for process server edits...');

// Override the saveProcessServer function
window.saveProcessServer = async function(walletAddress) {
    console.log('💾 Saving process server:', walletAddress);
    
    try {
        // Collect the values from the edit form
        const updates = {
            wallet_address: walletAddress
        };
        
        // Get values from inputs (some might be empty, that's OK)
        const fields = ['name', 'agency', 'email', 'phone', 'license', 'jurisdiction'];
        
        fields.forEach(field => {
            const inputId = `edit-${field}-${walletAddress}`;
            const input = document.getElementById(inputId);
            
            if (input) {
                // Get the value, even if empty
                updates[field === 'license' ? 'license_number' : field] = input.value || '';
                console.log(`  ${field}: "${input.value}"`);
            } else {
                console.log(`  ${field}: input not found`);
            }
        });
        
        console.log('Sending updates:', updates);
        
        // Send to backend - allow empty fields
        const response = await fetch(`https://nftserviceapp.onrender.com/api/process-servers/${walletAddress}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Process server updated successfully!', 'success');
            
            // Hide the edit form
            const editForm = document.getElementById(`edit-${walletAddress}`);
            if (editForm) {
                editForm.style.display = 'none';
            }
            
            // Reload the process servers list
            if (typeof loadProcessServers === 'function') {
                await loadProcessServers();
            }
        } else {
            console.error('Save failed:', result);
            showNotification(`Failed to save: ${result.error || 'Unknown error'}`, 'error');
        }
        
    } catch (error) {
        console.error('Error saving process server:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
};

// Also create an alternative save function that skips validation
window.forceSaveProcessServer = async function(walletAddress) {
    console.log('⚡ Force saving process server (no validation):', walletAddress);
    
    const updates = { wallet_address: walletAddress };
    
    // Just get whatever values are there
    ['name', 'agency', 'email', 'phone', 'license', 'jurisdiction'].forEach(field => {
        const input = document.getElementById(`edit-${field}-${walletAddress}`);
        if (input) {
            const fieldName = field === 'license' ? 'license_number' : field;
            updates[fieldName] = input.value;
        }
    });
    
    try {
        const response = await fetch(`https://nftserviceapp.onrender.com/api/process-servers`, {
            method: 'POST', // Use POST which creates or updates
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Saved successfully!');
            loadProcessServers();
        } else {
            alert('Error: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Helper function to test what values we're getting
window.debugSaveValues = function(walletAddress) {
    console.log('🔍 Debug - checking input values for:', walletAddress);
    
    const fields = ['name', 'agency', 'email', 'phone', 'license', 'jurisdiction'];
    const values = {};
    
    fields.forEach(field => {
        const inputId = `edit-${field}-${walletAddress}`;
        const input = document.getElementById(inputId);
        
        if (input) {
            values[field] = {
                id: inputId,
                value: input.value,
                type: input.type,
                required: input.required,
                visible: input.offsetParent !== null
            };
        } else {
            values[field] = { error: 'Input not found' };
        }
    });
    
    console.table(values);
    return values;
};

console.log('✅ Save function fixed!');
console.log('   - Use saveProcessServer() for normal save');
console.log('   - Use forceSaveProcessServer() to skip validation');
console.log('   - Use debugSaveValues() to see what values are being collected');