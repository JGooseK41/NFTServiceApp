/**
 * Force modal edit to override inline function
 */

console.log('🔧 Forcing modal edit functionality...');

// Wait for page to load then override
setTimeout(() => {
    console.log('📝 Overriding showInlineEdit with modal version...');
    
    // First ensure modal HTML exists
    if (!document.getElementById('editModal')) {
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
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        console.log('✅ Modal HTML added');
    }
    
    // Override the showInlineEdit function
    window.showInlineEdit = function(walletAddress) {
        console.log('🚀 Opening MODAL for:', walletAddress);
        
        const modal = document.getElementById('editModal');
        const content = document.getElementById('modalContent');
        
        // Find server data
        const server = window.allProcessServers?.find(s => 
            s.wallet_address === walletAddress || 
            s.wallet_address === walletAddress.toLowerCase()
        ) || {};
        
        console.log('Server data:', server);
        
        // Create form
        content.innerHTML = `
            <form onsubmit="return false;" style="color: #e5e7eb;">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #9ca3af; font-weight: bold;">Wallet Address</label>
                    <div style="padding: 10px; background: #111827; border: 1px solid #374151; border-radius: 4px; font-family: monospace; font-size: 12px;">
                        ${walletAddress}
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #9ca3af; font-weight: bold;">Name</label>
                    <input type="text" id="modal_name" value="${server.name || ''}" 
                           style="width: 100%; padding: 10px; background: #111827; color: #f3f4f6; 
                                  border: 2px solid #374151; border-radius: 4px; font-size: 14px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #9ca3af; font-weight: bold;">Agency</label>
                    <input type="text" id="modal_agency" value="${server.agency || ''}"
                           style="width: 100%; padding: 10px; background: #111827; color: #f3f4f6; 
                                  border: 2px solid #374151; border-radius: 4px; font-size: 14px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #9ca3af; font-weight: bold;">Email</label>
                    <input type="email" id="modal_email" value="${server.email || ''}"
                           style="width: 100%; padding: 10px; background: #111827; color: #f3f4f6; 
                                  border: 2px solid #374151; border-radius: 4px; font-size: 14px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #9ca3af; font-weight: bold;">Phone</label>
                    <input type="text" id="modal_phone" value="${server.phone || ''}"
                           style="width: 100%; padding: 10px; background: #111827; color: #f3f4f6; 
                                  border: 2px solid #374151; border-radius: 4px; font-size: 14px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #9ca3af; font-weight: bold;">License Number</label>
                    <input type="text" id="modal_license" value="${server.license_number || ''}"
                           style="width: 100%; padding: 10px; background: #111827; color: #f3f4f6; 
                                  border: 2px solid #374151; border-radius: 4px; font-size: 14px;">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; color: #9ca3af; font-weight: bold;">Jurisdiction</label>
                    <input type="text" id="modal_jurisdiction" value="${server.jurisdiction || ''}"
                           style="width: 100%; padding: 10px; background: #111827; color: #f3f4f6; 
                                  border: 2px solid #374151; border-radius: 4px; font-size: 14px;">
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button type="button" onclick="saveModalData('${walletAddress}')"
                            style="flex: 1; padding: 12px; background: #10b981; color: white; 
                                   border: none; border-radius: 6px; cursor: pointer; font-weight: bold;
                                   font-size: 16px; transition: background 0.2s;"
                            onmouseover="this.style.background='#059669'"
                            onmouseout="this.style.background='#10b981'">
                        💾 Save Changes
                    </button>
                    <button type="button" onclick="closeModal()"
                            style="flex: 1; padding: 12px; background: #6b7280; color: white; 
                                   border: none; border-radius: 6px; cursor: pointer; font-weight: bold;
                                   font-size: 16px; transition: background 0.2s;"
                            onmouseover="this.style.background='#4b5563'"
                            onmouseout="this.style.background='#6b7280'">
                        ❌ Cancel
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
    
    // Close modal function
    window.closeModal = function() {
        const modal = document.getElementById('editModal');
        if (modal) {
            modal.style.display = 'none';
        }
    };
    
    // Save function
    window.saveModalData = async function(walletAddress) {
        console.log('💾 Saving from modal:', walletAddress);
        
        const updates = {
            wallet_address: walletAddress,
            name: document.getElementById('modal_name').value || '',
            agency: document.getElementById('modal_agency').value || '',
            email: document.getElementById('modal_email').value || '',
            phone: document.getElementById('modal_phone').value || '',
            license_number: document.getElementById('modal_license').value || '',
            jurisdiction: document.getElementById('modal_jurisdiction').value || ''
        };
        
        console.log('Updates to save:', updates);
        
        try {
            const response = await fetch(`https://nftserviceapp.onrender.com/api/process-servers/${walletAddress}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert('✅ Process server updated successfully!');
                closeModal();
                
                // Reload process servers
                if (typeof loadProcessServers === 'function') {
                    loadProcessServers();
                } else if (typeof displayProcessServers === 'function') {
                    // Try to refresh the display
                    location.reload();
                }
            } else {
                alert('❌ Error: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('❌ Error: ' + error.message);
        }
    };
    
    // Click outside to close
    document.addEventListener('click', function(e) {
        const modal = document.getElementById('editModal');
        if (e.target === modal) {
            closeModal();
        }
    });
    
    console.log('✅ Modal edit override complete!');
    console.log('   All Edit buttons will now open the modal');
    
}, 2000); // Wait for page to fully load

console.log('⏳ Waiting to override edit functionality...');