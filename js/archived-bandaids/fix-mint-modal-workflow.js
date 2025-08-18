/**
 * Fix Mint Modal Workflow - Show case details form first, not document upload
 */

console.log('🔧 Fixing mint modal workflow...');

// Override openMintModal to show case details first
const originalOpenMintModal = window.openMintModal;
window.openMintModal = async function() {
    console.log('📋 Opening mint modal with case details first');
    
    if (!window.legalContract) {
        window.uiManager.showNotification('error', 'Please connect to contract first');
        return;
    }
    
    if (!window.isProcessServer && !window.isAdmin) {
        window.uiManager.showNotification('error', 'You need Process Server role to create notices');
        return;
    }
    
    const modal = document.getElementById('mintModal');
    modal.style.display = 'block';
    
    // IMPORTANT: Show case details (Step 2) first, not document upload (Step 1)
    document.getElementById('mintStep1').style.display = 'none';
    document.getElementById('mintStep2').style.display = 'block';
    
    // Reset form
    if (window.resetMintForm) {
        window.resetMintForm();
    }
    
    // Update token prefix
    if (window.updateTokenPrefix) {
        await window.updateTokenPrefix();
    }
    
    // Set issuing agency
    if (typeof window.setIssuingAgency === 'function') {
        window.setIssuingAgency();
    }
    
    // Focus on case number field
    setTimeout(() => {
        const caseNumberField = document.getElementById('mintCaseNumber');
        if (caseNumberField) {
            caseNumberField.focus();
            
            // Trigger case check if value exists
            if (caseNumberField.value && window.caseWorkflowManager) {
                window.caseWorkflowManager.checkForExistingCase(caseNumberField.value);
            }
        }
    }, 100);
    
    console.log('✅ Mint modal opened with case details form');
};

// Add "Back to Upload" button to Step 2 if not present
function addBackToUploadButton() {
    const step2 = document.getElementById('mintStep2');
    if (!step2) return;
    
    // Check if button already exists
    if (document.getElementById('backToUploadBtn')) return;
    
    // Find the button container at bottom of form
    const buttonContainers = step2.querySelectorAll('.button-group, .form-actions, .modal-footer');
    let targetContainer = buttonContainers[buttonContainers.length - 1];
    
    // If no container found, look for the submit button and add before it
    if (!targetContainer) {
        const submitBtn = step2.querySelector('button[onclick*="createLegalNotice"]');
        if (submitBtn && submitBtn.parentElement) {
            targetContainer = submitBtn.parentElement;
        }
    }
    
    if (targetContainer) {
        // Create back button
        const backBtn = document.createElement('button');
        backBtn.id = 'backToUploadBtn';
        backBtn.className = 'btn btn-secondary';
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Back to Documents';
        backBtn.style.marginRight = '10px';
        backBtn.onclick = function() {
            // Go back to document upload
            document.getElementById('mintStep2').style.display = 'none';
            document.getElementById('mintStep1').style.display = 'block';
            
            // Setup upload area
            if (window.setupUploadAreaForModal) {
                setTimeout(() => {
                    window.setupUploadAreaForModal();
                }, 100);
            }
        };
        
        // Insert at beginning of container
        targetContainer.insertBefore(backBtn, targetContainer.firstChild);
        console.log('✅ Added "Back to Documents" button');
    }
}

// Override showMintStep2 to ensure we have documents first
const originalShowMintStep2 = window.showMintStep2;
window.showMintStep2 = async function() {
    console.log('📋 Proceeding to recipient details');
    
    // Check if we have documents
    if (!window.uploadedDocumentsList || window.uploadedDocumentsList.length === 0) {
        window.uiManager.showNotification('warning', 'Please upload documents first');
        
        // Show document upload step
        document.getElementById('mintStep2').style.display = 'none';
        document.getElementById('mintStep1').style.display = 'block';
        
        // Setup upload area
        if (window.setupUploadAreaForModal) {
            setTimeout(() => {
                window.setupUploadAreaForModal();
            }, 100);
        }
        
        return;
    }
    
    // Call original function
    if (originalShowMintStep2) {
        await originalShowMintStep2();
    } else {
        // Manual implementation if original doesn't exist
        document.getElementById('mintStep1').style.display = 'none';
        document.getElementById('mintStep2').style.display = 'block';
        
        // Set issuing agency
        if (typeof window.setIssuingAgency === 'function') {
            window.setIssuingAgency();
        }
    }
};

// Add "Upload Documents" button to Step 2
function addUploadDocumentsButton() {
    const step2 = document.getElementById('mintStep2');
    if (!step2) return;
    
    // Check if button already exists
    if (document.getElementById('uploadDocsBtn')) return;
    
    // Find case number field area
    const caseNumberField = document.getElementById('mintCaseNumber');
    if (!caseNumberField) return;
    
    const formGroup = caseNumberField.closest('.form-group');
    if (!formGroup) return;
    
    // Create upload documents button
    const uploadBtn = document.createElement('button');
    uploadBtn.id = 'uploadDocsBtn';
    uploadBtn.className = 'btn btn-primary';
    uploadBtn.innerHTML = '<i class="fas fa-file-upload"></i> Upload Documents';
    uploadBtn.style.cssText = 'margin-top: 20px; width: 100%;';
    uploadBtn.onclick = function() {
        // Save current form values
        const caseNumber = document.getElementById('mintCaseNumber').value;
        const noticeType = document.getElementById('noticeType').value;
        const issuingAgency = document.getElementById('issuingAgency').value;
        
        // Store in session
        sessionStorage.setItem('pendingCaseNumber', caseNumber);
        sessionStorage.setItem('pendingNoticeType', noticeType);
        sessionStorage.setItem('pendingIssuingAgency', issuingAgency);
        
        // Go to document upload
        document.getElementById('mintStep2').style.display = 'none';
        document.getElementById('mintStep1').style.display = 'block';
        
        // Setup upload area
        if (window.setupUploadAreaForModal) {
            setTimeout(() => {
                window.setupUploadAreaForModal();
            }, 100);
        }
    };
    
    // Add after the form group
    formGroup.parentNode.insertBefore(uploadBtn, formGroup.nextSibling);
    console.log('✅ Added "Upload Documents" button');
}

// Restore case details when returning from upload
function restoreCaseDetails() {
    const caseNumber = sessionStorage.getItem('pendingCaseNumber');
    const noticeType = sessionStorage.getItem('pendingNoticeType');
    const issuingAgency = sessionStorage.getItem('pendingIssuingAgency');
    
    if (caseNumber) {
        const field = document.getElementById('mintCaseNumber');
        if (field) field.value = caseNumber;
    }
    
    if (noticeType) {
        const field = document.getElementById('noticeType');
        if (field) field.value = noticeType;
    }
    
    if (issuingAgency) {
        const field = document.getElementById('issuingAgency');
        if (field) field.value = issuingAgency;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        addBackToUploadButton();
        addUploadDocumentsButton();
        restoreCaseDetails();
    });
} else {
    addBackToUploadButton();
    addUploadDocumentsButton();
    restoreCaseDetails();
}

console.log('✅ Mint modal workflow fixed - case details shown first');
console.log('📋 Workflow: Enter case details → Upload documents → Add recipients → Send');