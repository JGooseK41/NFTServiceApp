/**
 * Complete Case Workflow Fix
 * Properly handles new case creation vs resuming existing cases
 */

console.log('🔧 Implementing complete case workflow fix...');

// Store the original functions
const originalOpenMintModal = window.openMintModal;
const originalResumeCase = window.resumeCase;
const originalShowDocumentUpload = window.showDocumentUpload;

// Track if we're creating new or resuming
window.caseWorkflowState = {
    mode: null, // 'new' | 'resume' | null
    caseId: null,
    caseData: null
};

/**
 * Override openMintModal to ensure clean slate for NEW cases
 */
window.openMintModal = async function() {
    console.log('📋 Opening mint modal for NEW case creation');
    
    // Check permissions
    if (!legalContract) {
        uiManager.showNotification('error', 'Please connect to contract first');
        return;
    }
    
    if (!isProcessServer && !isAdmin) {
        uiManager.showNotification('error', 'You need Process Server role to create notices');
        return;
    }
    
    // IMPORTANT: Set mode to NEW
    window.caseWorkflowState = {
        mode: 'new',
        caseId: null,
        caseData: null
    };
    
    // Clear ALL previous data
    window.currentCaseData = null;
    window.uploadedDocumentsList = [];
    window.currentRecipients = [];
    window.currentCaseId = null;
    
    // Reset the form
    if (typeof resetMintForm === 'function') {
        resetMintForm();
    }
    
    // Show the modal
    const modal = document.getElementById('mintModal');
    if (modal) {
        modal.style.display = 'block';
    }
    
    // Update token prefix
    if (typeof updateTokenPrefix === 'function') {
        await updateTokenPrefix();
    }
    
    // Show Step 1 (Case Details)
    document.getElementById('mintStep1').style.display = 'block';
    document.getElementById('mintStep2').style.display = 'none';
    document.getElementById('mintStep3').style.display = 'none';
    
    // Clear and focus case number field for NEW entry
    const caseNumberField = document.getElementById('mintCaseNumber');
    if (caseNumberField) {
        caseNumberField.value = '';
        caseNumberField.placeholder = 'Enter case number (e.g., 34-2501-1234)';
        setTimeout(() => caseNumberField.focus(), 100);
    }
    
    // Clear other fields
    const fieldsToClear = ['mintCaseTitle', 'mintNoticeType', 'issuingAgency'];
    fieldsToClear.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) field.value = field.tagName === 'SELECT' ? field.options[0].value : '';
    });
    
    // Clear status indicator
    const statusIndicator = document.getElementById('caseStatusIndicator');
    if (statusIndicator) {
        statusIndicator.innerHTML = `
            <div style="
                padding: 10px;
                background: #e3f2fd;
                border: 1px solid #2196f3;
                border-radius: 8px;
                margin-top: 10px;
                color: #1565c0;
            ">
                <i class="fas fa-plus-circle" style="margin-right: 8px;"></i>
                Creating new case - enter details below
            </div>
        `;
    }
    
    // Set issuing agency if function exists
    if (typeof setIssuingAgency === 'function') {
        setIssuingAgency();
    }
    
    console.log('✅ Mint modal opened for NEW case creation');
};

/**
 * Override resumeCase to properly handle resuming
 */
window.resumeCase = async function(caseId) {
    console.log(`📂 Resuming case #${caseId}...`);
    
    // Set mode to RESUME
    window.caseWorkflowState = {
        mode: 'resume',
        caseId: caseId,
        caseData: null
    };
    
    try {
        // Fetch case details
        const apiUrl = window.caseManager?.apiUrl || window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        const serverAddress = window.caseManager?.serverAddress || window.tronWeb?.defaultAddress?.base58 || '';
        
        const response = await fetch(`${apiUrl}/api/cases/${caseId}`, {
            headers: {
                'X-Server-Address': serverAddress
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch case: ${response.status}`);
        }
        
        const caseData = await response.json();
        window.caseWorkflowState.caseData = caseData;
        
        console.log('Loaded case data:', caseData);
        
        // Switch to user tab
        if (window.switchTab) {
            window.switchTab('user');
        }
        
        // Open mint modal
        const modal = document.getElementById('mintModal');
        if (modal) {
            modal.style.display = 'block';
        }
        
        // Pre-fill form with case data
        setTimeout(() => {
            // Fill case details
            const caseNumberInput = document.getElementById('mintCaseNumber');
            if (caseNumberInput) {
                caseNumberInput.value = caseData.case?.case_number || caseData.metadata?.caseNumber || caseId;
            }
            
            const caseTitleInput = document.getElementById('mintCaseTitle');
            if (caseTitleInput && caseData.case?.case_title) {
                caseTitleInput.value = caseData.case.case_title;
            }
            
            const noticeTypeInput = document.getElementById('mintNoticeType');
            if (noticeTypeInput && caseData.case?.notice_type) {
                noticeTypeInput.value = caseData.case.notice_type;
            }
            
            const agencyInput = document.getElementById('issuingAgency');
            if (agencyInput && caseData.case?.issuing_agency) {
                agencyInput.value = caseData.case.issuing_agency;
            }
            
            // Show resume indicator
            const statusIndicator = document.getElementById('caseStatusIndicator');
            if (statusIndicator) {
                statusIndicator.innerHTML = `
                    <div style="
                        padding: 15px;
                        background: #fff3cd;
                        border: 1px solid #ffc107;
                        border-radius: 8px;
                        margin-top: 10px;
                    ">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-folder-open" style="color: #856404;"></i>
                            <div style="flex: 1;">
                                <strong>Resuming Case #${caseId}</strong><br>
                                <small>Created: ${new Date(caseData.created_at).toLocaleDateString()}</small>
                                ${caseData.case?.documents ? `<br><small>${caseData.case.documents.length} document(s) loaded</small>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Load documents if available
            if (caseData.case?.documents && caseData.case.documents.length > 0) {
                window.uploadedDocumentsList = caseData.case.documents;
                
                // Move to document step
                showDocumentUpload();
                
                // Update document display
                const uploadArea = document.getElementById('uploadArea');
                if (uploadArea) {
                    uploadArea.innerHTML = `
                        <div style="padding: 20px; background: #e3f2fd; border-radius: 8px;">
                            <h4 style="margin: 0 0 10px 0; color: #1565c0;">
                                <i class="fas fa-file-pdf"></i> Documents from Case
                            </h4>
                            <p style="margin: 0;">
                                ${caseData.case.documents.length} document(s) loaded
                            </p>
                            <button class="btn btn-secondary btn-small" style="margin-top: 10px;" onclick="changeDocuments()">
                                <i class="fas fa-sync"></i> Change Documents
                            </button>
                        </div>
                    `;
                }
            } else {
                // Stay on case details step
                showCaseDetails();
            }
            
        }, 100);
        
        if (window.uiManager) {
            window.uiManager.showNotification('success', `Resumed case #${caseId}`);
        }
        
    } catch (error) {
        console.error('Failed to resume case:', error);
        if (window.uiManager) {
            window.uiManager.showNotification('error', `Failed to resume case: ${error.message}`);
        }
        // Fall back to new case creation
        window.openMintModal();
    }
};

/**
 * Check for existing case when user types case number
 */
window.checkForExistingCase = async function(caseNumber) {
    // Only check if we're in NEW mode
    if (window.caseWorkflowState.mode !== 'new') {
        return;
    }
    
    const indicator = document.getElementById('caseStatusIndicator');
    if (!indicator) return;
    
    if (!caseNumber || caseNumber.trim() === '') {
        indicator.innerHTML = '';
        return;
    }
    
    try {
        // Check backend for existing cases
        const apiUrl = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        const serverAddress = window.tronWeb?.defaultAddress?.base58 || '';
        
        const response = await fetch(`${apiUrl}/api/cases`, {
            headers: {
                'X-Server-Address': serverAddress,
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const cases = data.cases || [];
            
            // Find matching case
            const existingCase = cases.find(c => 
                c.case_number === caseNumber || 
                c.metadata?.caseNumber === caseNumber
            );
            
            if (existingCase) {
                // Found existing case - offer to resume
                indicator.innerHTML = `
                    <div style="
                        padding: 15px;
                        background: #fff3cd;
                        border: 1px solid #ffc107;
                        border-radius: 8px;
                        margin-top: 10px;
                    ">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-exclamation-triangle" style="color: #856404;"></i>
                            <div style="flex: 1;">
                                <strong>Case Already Exists</strong><br>
                                <small>Case #${caseNumber} was created on ${new Date(existingCase.created_at).toLocaleDateString()}</small>
                            </div>
                            <button class="btn btn-warning btn-small" onclick="closeMintModal(); resumeCase('${existingCase.id}')">
                                <i class="fas fa-folder-open"></i> Resume This Case
                            </button>
                        </div>
                    </div>
                `;
            } else {
                // New case - show green indicator
                indicator.innerHTML = `
                    <div style="
                        padding: 10px;
                        background: #d4edda;
                        border: 1px solid #c3e6cb;
                        border-radius: 8px;
                        margin-top: 10px;
                        color: #155724;
                    ">
                        <i class="fas fa-check-circle" style="margin-right: 8px;"></i>
                        New case number - ready to create
                    </div>
                `;
            }
        }
    } catch (error) {
        console.log('Could not check for existing cases:', error);
        // Default to new case
        indicator.innerHTML = `
            <div style="
                padding: 10px;
                background: #d4edda;
                border: 1px solid #c3e6cb;
                border-radius: 8px;
                margin-top: 10px;
                color: #155724;
            ">
                <i class="fas fa-plus-circle" style="margin-right: 8px;"></i>
                Creating new case
            </div>
        `;
    }
};

/**
 * Function to change documents (clear and re-upload)
 */
window.changeDocuments = function() {
    window.uploadedDocumentsList = [];
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
        uploadArea.innerHTML = `
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
            <p>Drag & drop documents here or click to browse</p>
            <input type="file" id="documentUpload" accept=".pdf,image/*" multiple style="display: none;">
        `;
        
        // Re-setup upload handlers
        if (window.setupUploadAreaForModal) {
            window.setupUploadAreaForModal();
        }
    }
};

/**
 * Override showDocumentUpload to handle workflow state
 */
window.showDocumentUpload = function() {
    console.log('📄 Showing document upload step');
    
    // Validate case details first
    const caseNumber = document.getElementById('mintCaseNumber').value;
    if (!caseNumber || caseNumber.trim() === '') {
        uiManager.showNotification('warning', 'Please enter a case number');
        return;
    }
    
    // Store case info if NEW mode
    if (window.caseWorkflowState.mode === 'new' && !window.currentCaseData) {
        window.currentCaseData = {
            case_number: caseNumber,
            case_title: document.getElementById('mintCaseTitle')?.value || '',
            notice_type: document.getElementById('mintNoticeType')?.value || 'summons',
            issuing_agency: document.getElementById('issuingAgency')?.value || 'The Block Service',
            created_at: new Date().toISOString(),
            status: 'draft',
            is_draft: true // NOT saved to backend yet
        };
        
        console.log('📝 Created draft case (not saved):', window.currentCaseData);
    }
    
    // Show document upload step
    document.getElementById('mintStep1').style.display = 'none';
    document.getElementById('mintStep2').style.display = 'block';
    document.getElementById('mintStep3').style.display = 'none';
    
    // Setup upload area if needed
    if (window.setupUploadAreaForModal) {
        setTimeout(() => {
            window.setupUploadAreaForModal();
        }, 100);
    }
};

/**
 * Add event listener for case number field
 */
document.addEventListener('DOMContentLoaded', function() {
    const caseNumberField = document.getElementById('mintCaseNumber');
    if (caseNumberField) {
        // Debounced check for existing case
        let checkTimeout;
        caseNumberField.addEventListener('input', function(e) {
            // Only check in NEW mode
            if (window.caseWorkflowState.mode === 'new') {
                clearTimeout(checkTimeout);
                checkTimeout = setTimeout(() => {
                    checkForExistingCase(e.target.value);
                }, 500);
            }
        });
    }
});

// Make functions globally available
window.checkForExistingCase = checkForExistingCase;
window.changeDocuments = changeDocuments;
window.showCaseDetails = function() {
    console.log('📋 Showing case details step');
    document.getElementById('mintStep1').style.display = 'block';
    document.getElementById('mintStep2').style.display = 'none';
    document.getElementById('mintStep3').style.display = 'none';
};

console.log('✅ Complete case workflow fix applied!');
console.log('   - NEW cases start fresh with empty form');
console.log('   - Existing cases can be resumed with data');
console.log('   - Case number checking only in NEW mode');
console.log('   - Proper state management throughout workflow');