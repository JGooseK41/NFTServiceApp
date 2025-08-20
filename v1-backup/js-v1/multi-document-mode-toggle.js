/**
 * Multi-Document Mode Toggle
 * Allows users to switch between single and multi-document upload modes
 */

(function() {
    // Add toggle to document upload section
    function addMultiDocToggle() {
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;
        
        // Check if toggle already exists
        if (document.getElementById('multiDocToggle')) return;
        
        // Get current mode
        const isMultiDoc = localStorage.getItem('multiDocumentMode') === 'true';
        
        // Create toggle container
        const toggleContainer = document.createElement('div');
        toggleContainer.id = 'multiDocToggleContainer';
        toggleContainer.style.cssText = `
            margin-bottom: 15px;
            padding: 10px;
            background: var(--bg-secondary);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        `;
        
        toggleContainer.innerHTML = `
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="multiDocToggle" ${isMultiDoc ? 'checked' : ''}>
                <span style="font-weight: 500;">
                    <i class="fas fa-layer-group"></i> 
                    Multi-Document Mode
                </span>
            </label>
            <small style="color: var(--text-muted);">
                (Combine multiple PDFs into one notice)
            </small>
        `;
        
        // Insert before upload area
        uploadArea.parentNode.insertBefore(toggleContainer, uploadArea);
        
        // Add event listener
        document.getElementById('multiDocToggle').addEventListener('change', function(e) {
            const enabled = e.target.checked;
            localStorage.setItem('multiDocumentMode', enabled ? 'true' : 'false');
            
            // Update UI
            updateUploadAreaText(enabled);
            
            // Clear any existing queue if switching modes
            if (!enabled && window.multiDocHandler && window.multiDocHandler.documents.length > 0) {
                if (confirm('Switching to single document mode will clear the current queue. Continue?')) {
                    window.multiDocHandler.documents = [];
                    window.multiDocHandler.updateUI();
                } else {
                    // Revert toggle
                    e.target.checked = true;
                    localStorage.setItem('multiDocumentMode', 'true');
                }
            }
            
            // Show notification
            if (window.uiManager && window.uiManager.showNotification) {
                window.uiManager.showNotification('info', 
                    enabled ? 'Multi-document mode enabled' : 'Single document mode enabled'
                );
            }
        });
        
        // Update initial text
        updateUploadAreaText(isMultiDoc);
    }
    
    function updateUploadAreaText(multiMode) {
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;
        
        const p = uploadArea.querySelector('p');
        const pSmall = uploadArea.querySelectorAll('p')[1];
        
        if (multiMode) {
            if (p) p.textContent = 'Add documents to combine (you can select multiple files)';
            if (pSmall) pSmall.textContent = 'Supported: Multiple PDFs, JPEG, PNG - will be merged into one document';
        } else {
            if (p) p.textContent = 'Drag & drop your document here or click to browse';
            if (pSmall) pSmall.textContent = 'Supported formats: JPEG, PNG, PDF';
        }
        
        // Update button text
        const btn = uploadArea.querySelector('button');
        if (btn) {
            btn.innerHTML = multiMode 
                ? '<i class="fas fa-folder-plus"></i> Add Documents' 
                : '<i class="fas fa-folder-open"></i> Select File';
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addMultiDocToggle);
    } else {
        addMultiDocToggle();
    }
    
    // Re-initialize when modal opens
    document.addEventListener('click', function(e) {
        if (e.target && e.target.matches('[onclick*="openCreateNotice"]')) {
            setTimeout(addMultiDocToggle, 100);
        }
    });
})();

console.log('✅ Multi-document mode toggle loaded');