/**
 * Direct fix for admin panel edit forms
 * This completely replaces the displayProcessServers function with a working version
 */

console.log('🔧 Applying admin panel edit form fixes...');

// Add required styles
if (!document.getElementById('admin-panel-styles')) {
    const styles = document.createElement('style');
    styles.id = 'admin-panel-styles';
    styles.innerHTML = `
        .process-server-card {
            background: var(--card-bg, #1f2937);
            border: 1px solid var(--border-color, #374151);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            max-height: 700px;
            overflow-y: auto;
        }
        
        .process-server-card::-webkit-scrollbar {
            width: 10px;
        }
        
        .process-server-card::-webkit-scrollbar-track {
            background: #1f2937;
            border-radius: 5px;
        }
        
        .process-server-card::-webkit-scrollbar-thumb {
            background: #4b5563;
            border-radius: 5px;
        }
        
        .server-info-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #374151;
        }
        
        .server-info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-bottom: 1rem;
        }
        
        .info-item {
            font-size: 0.9rem;
        }
        
        .info-label {
            font-weight: 600;
            color: #9ca3af;
        }
        
        .info-value {
            color: #e5e7eb;
        }
        
        .edit-panel {
            background: #111827;
            border: 1px solid #374151;
            border-radius: 8px;
            padding: 1.5rem;
            margin-top: 1rem;
        }
        
        .edit-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.5rem;
            margin-bottom: 1.5rem;
        }
        
        .form-group {
            display: flex;
            flex-direction: column;
        }
        
        .form-label {
            font-size: 0.875rem;
            font-weight: 500;
            color: #9ca3af;
            margin-bottom: 0.5rem;
        }
        
        .form-input-edit {
            padding: 0.75rem;
            background: #1f2937;
            border: 1px solid #374151;
            border-radius: 6px;
            color: #f3f4f6;
            font-size: 1rem;
            transition: all 0.2s;
        }
        
        .form-input-edit:focus {
            outline: none;
            border-color: #3b82f6;
            background: #111827;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .form-input-edit::placeholder {
            color: #6b7280;
        }
        
        .button-group {
            display: flex;
            gap: 1rem;
            padding-top: 1rem;
            border-top: 1px solid #374151;
        }
        
        .btn {
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
            font-size: 0.95rem;
        }
        
        .btn-primary {
            background: #3b82f6;
            color: white;
        }
        
        .btn-primary:hover {
            background: #2563eb;
        }
        
        .btn-success {
            background: #10b981;
            color: white;
        }
        
        .btn-success:hover {
            background: #059669;
        }
        
        .btn-secondary {
            background: #6b7280;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #4b5563;
        }
        
        .btn-danger {
            background: #ef4444;
            color: white;
        }
        
        .btn-danger:hover {
            background: #dc2626;
        }
        
        .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 500;
        }
        
        .status-badge.approved {
            background: rgba(16, 185, 129, 0.2);
            color: #10b981;
        }
        
        .status-badge.pending {
            background: rgba(251, 191, 36, 0.2);
            color: #fbbf24;
        }
        
        .status-badge.deactivated {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
        }
    `;
    document.head.appendChild(styles);
}

// Replace the displayProcessServers function
window.displayProcessServers = function(servers) {
    console.log('📋 Displaying process servers with fixed edit forms...', servers);
    
    const container = document.getElementById('processServersList');
    if (!container) {
        console.error('Process servers list container not found');
        return;
    }
    
    if (!servers || servers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users" style="font-size: 3rem; color: #6b7280; margin-bottom: 1rem;"></i>
                <h3>No process servers registered</h3>
                <p>Add servers using the "Add Server" button</p>
            </div>
        `;
        return;
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Create cards for each server
    servers.forEach(server => {
        // Create card container
        const card = document.createElement('div');
        card.className = 'process-server-card';
        
        // Create header with server name and status
        const header = document.createElement('div');
        header.className = 'server-info-header';
        header.innerHTML = `
            <div>
                <h3 style="margin: 0; color: #f3f4f6;">${server.name || 'Unnamed Server'}</h3>
                <p style="margin: 0.25rem 0 0 0; color: #9ca3af; font-size: 0.875rem;">
                    ${server.wallet_address}
                </p>
            </div>
            <span class="status-badge ${server.status || 'pending'}">
                ${server.status || 'pending'}
            </span>
        `;
        card.appendChild(header);
        
        // Create info grid
        const infoGrid = document.createElement('div');
        infoGrid.className = 'server-info-grid';
        
        const infoItems = [
            { label: 'Server ID', value: server.server_id || server.display_server_id || 'Pending' },
            { label: 'Agency', value: server.agency || 'Not set' },
            { label: 'Email', value: server.email || 'Not set' },
            { label: 'Phone', value: server.phone || 'Not set' },
            { label: 'License #', value: server.license_number || 'Not set' },
            { label: 'Jurisdiction', value: server.jurisdiction || 'Not set' },
            { label: 'Total Notices', value: server.total_notices_served || '0' },
            { label: 'Last 30 Days', value: server.notices_last_30_days || '0' }
        ];
        
        infoItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'info-item';
            div.innerHTML = `
                <span class="info-label">${item.label}:</span>
                <span class="info-value">${item.value}</span>
            `;
            infoGrid.appendChild(div);
        });
        
        card.appendChild(infoGrid);
        
        // Create action buttons
        const actions = document.createElement('div');
        actions.style.marginTop = '1rem';
        actions.innerHTML = `
            <button class="btn btn-primary" onclick="toggleEditForm('${server.wallet_address}')">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-danger" onclick="deleteProcessServer('${server.wallet_address}')" style="margin-left: 0.5rem;">
                <i class="fas fa-trash"></i> Delete
            </button>
        `;
        card.appendChild(actions);
        
        // Create edit form (hidden by default)
        const editPanel = document.createElement('div');
        editPanel.id = `edit-form-${server.wallet_address}`;
        editPanel.className = 'edit-panel';
        editPanel.style.display = 'none';
        
        const editTitle = document.createElement('h4');
        editTitle.style.margin = '0 0 1.5rem 0';
        editTitle.style.color = '#f3f4f6';
        editTitle.textContent = 'Edit Process Server Information';
        editPanel.appendChild(editTitle);
        
        // Create edit form grid
        const editGrid = document.createElement('div');
        editGrid.className = 'edit-grid';
        
        // Create form fields
        const fields = [
            { id: 'name', label: 'Name', value: server.name || '', placeholder: 'Enter server name' },
            { id: 'agency', label: 'Agency', value: server.agency || '', placeholder: 'Enter agency name' },
            { id: 'email', label: 'Email', value: server.email || '', placeholder: 'email@example.com' },
            { id: 'phone', label: 'Phone', value: server.phone || '', placeholder: '(555) 123-4567' },
            { id: 'license_number', label: 'License Number', value: server.license_number || '', placeholder: 'LIC-12345' },
            { id: 'jurisdiction', label: 'Jurisdiction', value: server.jurisdiction || '', placeholder: 'City, State' }
        ];
        
        fields.forEach(field => {
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';
            
            const label = document.createElement('label');
            label.className = 'form-label';
            label.textContent = field.label;
            label.setAttribute('for', `edit-${field.id}-${server.wallet_address}`);
            formGroup.appendChild(label);
            
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `edit-${field.id}-${server.wallet_address}`;
            input.className = 'form-input-edit';
            input.value = field.value;
            input.placeholder = field.placeholder;
            formGroup.appendChild(input);
            
            editGrid.appendChild(formGroup);
        });
        
        editPanel.appendChild(editGrid);
        
        // Create save/cancel buttons
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'button-group';
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-success';
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        saveBtn.onclick = () => saveServerEdit(server.wallet_address);
        buttonGroup.appendChild(saveBtn);
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
        cancelBtn.onclick = () => toggleEditForm(server.wallet_address);
        buttonGroup.appendChild(cancelBtn);
        
        editPanel.appendChild(buttonGroup);
        card.appendChild(editPanel);
        
        // Add card to container
        container.appendChild(card);
    });
};

// Toggle edit form visibility
window.toggleEditForm = function(walletAddress) {
    const editForm = document.getElementById(`edit-form-${walletAddress}`);
    if (editForm) {
        const isVisible = editForm.style.display === 'block';
        
        // Hide all other edit forms
        document.querySelectorAll('[id^="edit-form-"]').forEach(form => {
            form.style.display = 'none';
        });
        
        // Toggle this form
        editForm.style.display = isVisible ? 'none' : 'block';
        
        // Focus first input if opening
        if (!isVisible) {
            const firstInput = editForm.querySelector('input');
            if (firstInput) {
                firstInput.focus();
            }
        }
    }
};

// Save edited server data
window.saveServerEdit = async function(walletAddress) {
    console.log('💾 Saving process server edits for:', walletAddress);
    
    try {
        // Collect edited values
        const updates = {
            wallet_address: walletAddress,
            name: document.getElementById(`edit-name-${walletAddress}`).value,
            agency: document.getElementById(`edit-agency-${walletAddress}`).value,
            email: document.getElementById(`edit-email-${walletAddress}`).value,
            phone: document.getElementById(`edit-phone-${walletAddress}`).value,
            license_number: document.getElementById(`edit-license_number-${walletAddress}`).value,
            jurisdiction: document.getElementById(`edit-jurisdiction-${walletAddress}`).value
        };
        
        console.log('Sending updates:', updates);
        
        // Send update to backend
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
            toggleEditForm(walletAddress);
            // Reload the list
            if (typeof loadProcessServers === 'function') {
                loadProcessServers();
            }
        } else {
            showNotification('Failed to update: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error saving process server:', error);
        showNotification('Error saving changes: ' + error.message, 'error');
    }
};

// Auto-reload process servers when on admin tab
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const adminTab = document.getElementById('adminTab');
        if (adminTab && adminTab.style.display !== 'none') {
            if (typeof loadProcessServers === 'function') {
                console.log('🔄 Loading process servers with fixed display...');
                loadProcessServers();
            }
        }
    }, 1500);
});

console.log('✅ Admin panel edit form fixes applied!');