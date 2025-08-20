/**
 * Create a modal popup for editing that WILL work
 */

console.log('🔧 Creating modal edit form solution...');

// Create modal HTML
const modalHTML = `
<div id="editModal" style="
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 99999;
">
    <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1f2937;
        padding: 30px;
        border-radius: 10px;
        width: 500px;
        max-width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        border: 2px solid #3b82f6;
    ">
        <h2 style="color: #f3f4f6; margin: 0 0 20px 0;">Edit Process Server</h2>
        <div id="modalContent"></div>
    </div>
</div>
`;

// Add modal to page
if (!document.getElementById('editModal')) {
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to open edit modal
window.openEditModal = function(walletAddress) {
    console.log('📝 Opening modal for:', walletAddress);
    
    const modal = document.getElementById('editModal');
    const content = document.getElementById('modalContent');
    
    // Find the server data
    const server = window.allProcessServers?.find(s => 
        s.wallet_address === walletAddress || 
        s.wallet_address === walletAddress.toLowerCase()
    ) || {};
    
    // Create form HTML
    content.innerHTML = `
        <form id="editServerForm" onsubmit="return false;" style="color: #e5e7eb;">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: #9ca3af;">Wallet Address</label>
                <div style="padding: 8px; background: #111827; border: 1px solid #374151; border-radius: 4px;">
                    ${walletAddress}
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: #9ca3af;">Name</label>
                <input type="text" id="modal_name" value="${server.name || ''}" 
                       style="width: 100%; padding: 8px; background: #111827; color: #f3f4f6; 
                              border: 1px solid #374151; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: #9ca3af;">Agency</label>
                <input type="text" id="modal_agency" value="${server.agency || ''}"
                       style="width: 100%; padding: 8px; background: #111827; color: #f3f4f6; 
                              border: 1px solid #374151; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: #9ca3af;">Email</label>
                <input type="email" id="modal_email" value="${server.email || ''}"
                       style="width: 100%; padding: 8px; background: #111827; color: #f3f4f6; 
                              border: 1px solid #374151; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: #9ca3af;">Phone</label>
                <input type="text" id="modal_phone" value="${server.phone || ''}"
                       style="width: 100%; padding: 8px; background: #111827; color: #f3f4f6; 
                              border: 1px solid #374151; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: #9ca3af;">License Number</label>
                <input type="text" id="modal_license" value="${server.license_number || ''}"
                       style="width: 100%; padding: 8px; background: #111827; color: #f3f4f6; 
                              border: 1px solid #374151; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; color: #9ca3af;">Jurisdiction</label>
                <input type="text" id="modal_jurisdiction" value="${server.jurisdiction || ''}"
                       style="width: 100%; padding: 8px; background: #111827; color: #f3f4f6; 
                              border: 1px solid #374151; border-radius: 4px;">
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button type="button" onclick="saveModalEdit('${walletAddress}')"
                        style="flex: 1; padding: 10px; background: #10b981; color: white; 
                               border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    Save Changes
                </button>
                <button type="button" onclick="closeEditModal()"
                        style="flex: 1; padding: 10px; background: #6b7280; color: white; 
                               border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    Cancel
                </button>
            </div>
        </form>
    `;
    
    // Show modal
    modal.style.display = 'block';
    
    // Focus first input
    setTimeout(() => {
        document.getElementById('modal_name')?.focus();
    }, 100);
};

// Function to close modal
window.closeEditModal = function() {
    document.getElementById('editModal').style.display = 'none';
};

// Function to save from modal
window.saveModalEdit = async function(walletAddress) {
    console.log('💾 Saving from modal:', walletAddress);
    
    const updates = {
        wallet_address: walletAddress,
        name: document.getElementById('modal_name').value,
        agency: document.getElementById('modal_agency').value,
        email: document.getElementById('modal_email').value,
        phone: document.getElementById('modal_phone').value,
        license_number: document.getElementById('modal_license').value,
        jurisdiction: document.getElementById('modal_jurisdiction').value
    };
    
    console.log('Updates:', updates);
    
    try {
        const response = await fetch(`https://nftserviceapp.onrender.com/api/process-servers/${walletAddress}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Process server updated successfully!');
            closeEditModal();
            if (typeof loadProcessServers === 'function') {
                loadProcessServers();
            }
        } else {
            alert('❌ Error: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
};

// Override the edit button to use modal
window.showInlineEdit = function(walletAddress) {
    openEditModal(walletAddress);
};

// Close modal on outside click
document.addEventListener('click', function(e) {
    const modal = document.getElementById('editModal');
    if (e.target === modal) {
        closeEditModal();
    }
});

console.log('✅ Modal edit form ready!');
console.log('   Click any Edit button to open the modal');
console.log('   Or run: openEditModal("TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY")');