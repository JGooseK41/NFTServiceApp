/**
 * Disable Case Auto-loading
 * Ensures Create Legal Notice always starts fresh
 */

console.log('🚫 Disabling all case auto-loading...');

// Clear any existing case data on page load
window.currentCaseId = null;
window.currentCaseData = null;
window.currentSelectedCase = null;
window.uploadedDocumentsList = [];

// Disable case integration auto-create
window.AUTO_CREATE_CASE = false;

// CRITICAL: Disable case integration's auto-attachment to document upload
if (window.caseIntegration) {
    console.log('🔒 Disabling case integration auto-attachment...');
    // Override the init to prevent auto-attachment
    const originalInit = window.caseIntegration.init;
    window.caseIntegration.init = async function() {
        console.log('⚠️ Case integration init called but auto-attachment disabled');
        // Do NOT call attachToDocumentUpload
        this.initialized = true;
        if (window.caseManager) {
            this.caseManager = window.caseManager;
        }
        return true;
    };
    
    // Disable the attachment function completely
    window.caseIntegration.attachToDocumentUpload = function() {
        console.log('🚫 Case integration document attachment BLOCKED');
    };
    
    // Disable auto case creation
    window.caseIntegration.createCaseFromDocuments = async function() {
        console.log('🚫 Auto case creation from documents BLOCKED');
        return null;
    };
}

// Store original functions
const originalOpenMintModal = window.openMintModal;
const originalShowDocumentUpload = window.showDocumentUpload;
const originalResumeCase = window.resumeCase;

// Override openMintModal to ALWAYS start fresh
window.openMintModal = async function() {
    console.log('🆕 FORCING NEW CASE CREATION - NO AUTO-LOAD');
    
    // CLEAR EVERYTHING
    window.currentCaseId = null;
    window.currentCaseData = null;
    window.currentSelectedCase = null;
    window.uploadedDocumentsList = [];
    window.currentRecipients = [];
    
    // Clear any case workflow state
    if (window.caseWorkflowState) {
        window.caseWorkflowState = {
            mode: 'new',
            caseId: null,
            caseData: null
        };
    }
    
    // Clear case preparation system
    if (window.CasePreparationSystem) {
        window.CasePreparationSystem.currentCase = null;
    }
    
    // Clear case integration
    if (window.caseIntegration) {
        window.caseIntegration.currentCaseId = null;
        window.caseIntegration.caseData = null;
    }
    
    // Check permissions
    if (!window.legalContract) {
        if (window.uiManager) {
            window.uiManager.showNotification('error', 'Please connect to contract first');
        }
        return;
    }
    
    // Show the modal
    const modal = document.getElementById('mintModal');
    if (modal) {
        modal.style.display = 'block';
    }
    
    // RESET ALL FORM FIELDS
    const fieldsToReset = [
        'mintCaseNumber',
        'mintCaseTitle', 
        'mintNoticeType',
        'issuingAgency',
        'documentUpload',
        'recipientAddress',
        'noticeText',
        'noticeType',
        'agencyName',
        'caseNumber',
        'specificDetails',
        'rightsStatement',
        'mintRecipient'
    ];
    
    fieldsToReset.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            if (field.type === 'file') {
                field.value = '';
            } else if (field.tagName === 'SELECT') {
                field.selectedIndex = 0;
            } else {
                field.value = '';
            }
        }
    });
    
    // Clear upload area
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
        uploadArea.innerHTML = `
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
            <p>Drag & drop documents here or click to browse</p>
            <input type="file" id="documentUpload" accept=".pdf,image/*" multiple style="display: none;">
        `;
    }
    
    // Clear any status indicators
    const statusIndicator = document.getElementById('caseStatusIndicator');
    if (statusIndicator) {
        statusIndicator.innerHTML = '';
    }
    
    // Show Step 1 ONLY
    document.getElementById('mintStep1').style.display = 'block';
    document.getElementById('mintStep2').style.display = 'none';
    document.getElementById('mintStep3').style.display = 'none';
    
    // Update token prefix if needed
    if (typeof updateTokenPrefix === 'function') {
        await updateTokenPrefix();
    }
    
    // Set issuing agency if available
    if (typeof setIssuingAgency === 'function') {
        setIssuingAgency();
    }
    
    // Focus on case number field
    setTimeout(() => {
        const caseNumberField = document.getElementById('mintCaseNumber');
        if (caseNumberField) {
            caseNumberField.value = '';
            caseNumberField.focus();
            caseNumberField.placeholder = 'Enter case number (e.g., 34-2501-1234)';
        }
    }, 100);
    
    console.log('✅ Mint modal opened - COMPLETELY FRESH STATE');
};

// Override resumeCase to be explicit
window.resumeCase = async function(caseId) {
    console.log(`📂 EXPLICITLY resuming case #${caseId}...`);
    
    if (!caseId) {
        console.error('No case ID provided to resume');
        return;
    }
    
    // Mark that we're resuming
    if (window.caseWorkflowState) {
        window.caseWorkflowState = {
            mode: 'resume',
            caseId: caseId,
            caseData: null
        };
    }
    
    // Only load case data if explicitly resuming
    try {
        const apiUrl = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        const serverAddress = window.tronWeb?.defaultAddress?.base58 || '';
        
        const response = await fetch(`${apiUrl}/api/cases/${caseId}`, {
            headers: {
                'X-Server-Address': serverAddress
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch case: ${response.status}`);
        }
        
        const caseData = await response.json();
        
        // Store the loaded data
        window.currentCaseId = caseId;
        window.currentCaseData = caseData;
        
        // Switch to user tab
        if (window.switchTab) {
            window.switchTab('user');
        }
        
        // Open mint modal
        const modal = document.getElementById('mintModal');
        if (modal) {
            modal.style.display = 'block';
        }
        
        // Fill the form with case data
        setTimeout(() => {
            const caseNumberInput = document.getElementById('mintCaseNumber');
            if (caseNumberInput) {
                caseNumberInput.value = caseData.case?.case_number || caseId;
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
                        <strong>📂 Resuming Case #${caseId}</strong>
                    </div>
                `;
            }
        }, 100);
        
        if (window.uiManager) {
            window.uiManager.showNotification('info', `Resumed case #${caseId}`);
        }
        
    } catch (error) {
        console.error('Failed to resume case:', error);
        if (window.uiManager) {
            window.uiManager.showNotification('error', `Failed to resume case: ${error.message}`);
        }
    }
};

// Disable auto-case creation on document upload
if (window.caseIntegration) {
    const original = window.caseIntegration.attachToDocumentUpload;
    window.caseIntegration.attachToDocumentUpload = function() {
        console.log('📌 Case integration document hook DISABLED for auto-create');
        // Don't attach the auto-create functionality
    };
}

// Override showDocumentUpload to not auto-load cases
window.showDocumentUpload = function() {
    console.log('📄 Showing document upload step (no auto-load)');
    
    // Validate case details first
    const caseNumber = document.getElementById('mintCaseNumber')?.value;
    if (!caseNumber || caseNumber.trim() === '') {
        if (window.uiManager) {
            window.uiManager.showNotification('warning', 'Please enter a case number');
        }
        return;
    }
    
    // Just show the document upload step
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

// Override case preparation system to prevent auto-loading
if (window.CasePreparationSystem) {
    // Store the original mintCase for explicit use
    const originalMintCase = window.CasePreparationSystem.mintCase;
    window.CasePreparationSystem.mintCase = async function(caseId) {
        console.log(`📋 Minting from prepared case ${caseId} - EXPLICIT ACTION ONLY`);
        // This should only be called when explicitly clicking mint from prepared cases
        // NOT when clicking "Create Legal Notice"
        if (originalMintCase) {
            return originalMintCase.call(this, caseId);
        }
    };
    
    // Disable auto-loading of current case
    window.CasePreparationSystem.currentCase = null;
}

// Clear on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🧹 Clearing all case data on page load');
    window.currentCaseId = null;
    window.currentCaseData = null;
    window.currentSelectedCase = null;
    window.uploadedDocumentsList = [];
    window.AUTO_CREATE_CASE = false;
    
    // Clear any stored case data from localStorage/sessionStorage
    const keysToRemove = ['currentCase', 'resumeCase', 'selectedCase', 'lastCase', 'activeCase'];
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    });
    
    // Clear case preparation system stored images
    localStorage.removeItem('lastAlertThumbnail');
    localStorage.removeItem('lastDocumentImage');
});

console.log('✅ Case auto-loading COMPLETELY DISABLED');
console.log('   - Create Legal Notice will ALWAYS start fresh');
console.log('   - Cases can only be resumed explicitly');
console.log('   - No automatic case creation on document upload');
console.log('   - No automatic case loading on modal open');