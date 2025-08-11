/**
 * Direct fix that completely rebuilds the admin panel
 */

console.log('🔧 Applying direct admin panel fix...');

// Override loadProcessServers completely
window.loadProcessServers = async function() {
    console.log('📋 Loading process servers with WORKING edit forms...');
    
    try {
        const response = await fetch('https://nftserviceapp.onrender.com/api/process-servers');
        const data = await response.json();
        
        if (!data.success) {
            console.error('Failed to load servers:', data.error);
            return;
        }
        
        const container = document.getElementById('processServersList');
        if (!container) {
            console.error('Container not found!');
            return;
        }
        
        // Clear and rebuild
        container.innerHTML = '';
        
        if (!data.servers || data.servers.length === 0) {
            container.innerHTML = '<div class="empty-state">No process servers registered</div>';
            return;
        }
        
        // Create a simple table with inline editing
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.innerHTML = `
            <thead>
                <tr style="background: #374151;">
                    <th style="padding: 10px; text-align: left; color: #e5e7eb;">Field</th>
                    <th style="padding: 10px; text-align: left; color: #e5e7eb;">Current Value</th>
                    <th style="padding: 10px; text-align: left; color: #e5e7eb;">Edit</th>
                </tr>
            </thead>
            <tbody id="serverTableBody"></tbody>
        `;
        
        const tbody = table.querySelector('#serverTableBody');
        
        data.servers.forEach(server => {
            // Add server header row
            const headerRow = document.createElement('tr');
            headerRow.style.background = '#1f2937';
            headerRow.innerHTML = `
                <td colspan="3" style="padding: 15px; font-weight: bold; color: #3b82f6;">
                    ${server.name || 'Unnamed Server'} - ${server.wallet_address}
                </td>
            `;
            tbody.appendChild(headerRow);
            
            // Add editable fields
            const fields = [
                { key: 'name', label: 'Name', value: server.name || '' },
                { key: 'agency', label: 'Agency', value: server.agency || '' },
                { key: 'email', label: 'Email', value: server.email || '' },
                { key: 'phone', label: 'Phone', value: server.phone || '' },
                { key: 'license_number', label: 'License', value: server.license_number || '' },
                { key: 'jurisdiction', label: 'Jurisdiction', value: server.jurisdiction || '' }
            ];
            
            fields.forEach(field => {
                const row = document.createElement('tr');
                row.style.borderBottom = '1px solid #374151';
                
                // Create input with unique ID
                const inputId = `input_${server.wallet_address}_${field.key}`;
                
                row.innerHTML = `
                    <td style="padding: 10px; color: #9ca3af;">${field.label}</td>
                    <td style="padding: 10px; color: #e5e7eb;">${field.value || 'Not set'}</td>
                    <td style="padding: 10px;">
                        <input type="text" 
                               id="${inputId}"
                               value="${field.value}"
                               placeholder="Enter ${field.label.toLowerCase()}"
                               style="padding: 8px; background: #111827; border: 1px solid #374151; 
                                      border-radius: 4px; color: #f3f4f6; width: 200px;">
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            // Add save button row
            const actionRow = document.createElement('tr');
            actionRow.innerHTML = `
                <td colspan="3" style="padding: 10px; text-align: right; border-bottom: 2px solid #374151;">
                    <button onclick="saveDirectEdit('${server.wallet_address}')" 
                            style="padding: 8px 16px; background: #10b981; color: white; 
                                   border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                        Save Changes
                    </button>
                    <button onclick="testInput('${server.wallet_address}')" 
                            style="padding: 8px 16px; background: #3b82f6; color: white; 
                                   border: none; border-radius: 4px; cursor: pointer;">
                        Test Inputs
                    </button>
                </td>
            `;
            tbody.appendChild(actionRow);
        });
        
        container.appendChild(table);
        console.log('✅ Process servers table created with', data.servers.length, 'servers');
        
    } catch (error) {
        console.error('Error loading servers:', error);
    }
};

// Save function
window.saveDirectEdit = async function(walletAddress) {
    console.log('💾 Saving edits for:', walletAddress);
    
    const fields = ['name', 'agency', 'email', 'phone', 'license_number', 'jurisdiction'];
    const updates = { wallet_address: walletAddress };
    
    fields.forEach(field => {
        const input = document.getElementById(`input_${walletAddress}_${field}`);
        if (input) {
            updates[field] = input.value;
            console.log(`  ${field}: ${input.value}`);
        }
    });
    
    try {
        const response = await fetch(`https://nftserviceapp.onrender.com/api/process-servers/${walletAddress}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        
        const result = await response.json();
        if (result.success) {
            alert('✅ Server updated successfully!');
            loadProcessServers(); // Reload
        } else {
            alert('❌ Error: ' + result.error);
        }
    } catch (error) {
        alert('❌ Error saving: ' + error.message);
    }
};

// Test function to verify inputs work
window.testInput = function(walletAddress) {
    console.log('🧪 Testing inputs for:', walletAddress);
    
    const fields = ['name', 'agency', 'email', 'phone', 'license_number', 'jurisdiction'];
    
    fields.forEach(field => {
        const input = document.getElementById(`input_${walletAddress}_${field}`);
        if (input) {
            console.log(`✅ ${field} input exists and has value: "${input.value}"`);
            // Flash the input to show it works
            input.style.background = '#059669';
            setTimeout(() => {
                input.style.background = '#111827';
            }, 500);
        } else {
            console.log(`❌ ${field} input NOT FOUND`);
        }
    });
};

// Auto-load if on admin tab
setTimeout(() => {
    const adminTab = document.getElementById('adminTab');
    if (adminTab && adminTab.style.display !== 'none') {
        console.log('🔄 Auto-loading process servers...');
        loadProcessServers();
    }
}, 1000);

console.log('✅ Direct admin fix applied! The edit forms should work now.');