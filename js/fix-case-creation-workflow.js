/**
 * Fix Case Creation Workflow
 * Ensures proper new case creation vs resuming existing cases
 */

console.log('🔧 Fixing case creation workflow...');

// Store original openMintModal
const originalOpenMintModal = window.openMintModal;

// Override openMintModal to ensure clean slate
window.openMintModal = async function() {
    console.log('📋 Opening mint modal with proper workflow');
    
    if (!legalContract) {
        uiManager.showNotification('error', 'Please connect to contract first');
        return;
    }
    
    if (!isProcessServer && !isAdmin) {
        uiManager.showNotification('error', 'You need Process Server role to create notices');
        return;
    }
    
    // Clear any existing case data FIRST
    window.currentCaseData = null;
    window.uploadedDocumentsList = [];
    window.currentRecipients = [];
    
    // Reset the form completely
    resetMintForm();
    
    // Clear case number field
    const caseNumberField = document.getElementById('mintCaseNumber');
    if (caseNumberField) {
        caseNumberField.value = '';
    }
    
    // Clear any case status indicators
    const statusIndicator = document.getElementById('caseStatusIndicator');
    if (statusIndicator) {
        statusIndicator.innerHTML = '';
    }
    
    // Show the modal
    const modal = document.getElementById('mintModal');
    modal.style.display = 'block';
    
    // Update token prefix
    if (typeof updateTokenPrefix === 'function') {
        await updateTokenPrefix();
    }
    
    // Show Step 1 (Case Details) - NOT resuming anything
    showCaseDetails();
    
    // Set issuing agency
    if (typeof setIssuingAgency === 'function') {
        setIssuingAgency();
    }
    
    // Focus on case number field for NEW entry
    setTimeout(() => {
        if (caseNumberField) {
            caseNumberField.focus();
            caseNumberField.placeholder = 'Enter new case number (e.g., 34-2501-1234)';
        }
    }, 100);
};

// Override the case checking function to be smarter
window.checkForExistingCase = async function(caseNumber) {
    const indicator = document.getElementById('caseStatusIndicator');
    if (!indicator) return;
    
    if (!caseNumber || caseNumber.trim() === '') {
        indicator.innerHTML = '';
        return;
    }
    
    try {
        // Check backend for existing cases with this number
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
            
            // Look for matching case number
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
                            <button class="btn btn-warning btn-small" onclick="resumeExistingCase('${existingCase.id}')">
                                <i class="fas fa-folder-open"></i> Resume
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
                        New case - ready to create
                    </div>
                `;
            }
        }
    } catch (error) {
        console.log('Could not check for existing cases:', error);
        // If backend is down, just proceed as new case
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

// Function to resume an existing case
window.resumeExistingCase = async function(caseId) {
    console.log('📂 Resuming existing case:', caseId);
    
    try {
        // Load case data from backend
        const apiUrl = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
        const serverAddress = window.tronWeb?.defaultAddress?.base58 || '';
        
        const response = await fetch(`${apiUrl}/api/cases/${caseId}`, {
            headers: {
                'X-Server-Address': serverAddress,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load case');
        }
        
        const caseData = await response.json();
        console.log('Loaded case data:', caseData);
        
        // Store the case data
        window.currentCaseData = caseData.case || caseData;
        
        // Load any documents
        if (caseData.documents && caseData.documents.length > 0) {
            window.uploadedDocumentsList = caseData.documents;
            
            // Update UI to show documents
            const uploadArea = document.getElementById('uploadArea');
            if (uploadArea) {
                uploadArea.innerHTML = `
                    <div style="padding: 20px; background: #e3f2fd; border-radius: 8px;">
                        <h4 style="margin: 0 0 10px 0; color: #1565c0;">
                            <i class="fas fa-file-pdf"></i> Documents Loaded
                        </h4>
                        <p style="margin: 0;">
                            ${caseData.documents.length} document(s) from case #${caseData.case_number || caseId}
                        </p>
                        <button class="btn btn-secondary btn-small" style="margin-top: 10px;" onclick="changeDocuments()">
                            <i class="fas fa-sync"></i> Change Documents
                        </button>
                    </div>
                `;
            }
        }
        
        // Move to document upload step
        showDocumentUpload();
        
        uiManager.showNotification('success', `Resumed case #${caseData.case_number || caseId}`);
        
    } catch (error) {
        console.error('Failed to resume case:', error);
        uiManager.showNotification('error', 'Failed to load case. Starting fresh.');
    }
};

// Function to change documents (clear and re-upload)
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

// Override showDocumentUpload to check case number
const originalShowDocumentUpload = window.showDocumentUpload;
window.showDocumentUpload = function() {
    console.log('📄 Moving to document upload step');
    
    // Get case number
    const caseNumber = document.getElementById('mintCaseNumber').value;
    if (!caseNumber || caseNumber.trim() === '') {
        uiManager.showNotification('warning', 'Please enter a case number');
        return;
    }
    
    // Store case info in memory (NOT backend yet)
    if (!window.currentCaseData) {
        window.currentCaseData = {
            case_number: caseNumber,
            case_title: document.getElementById('mintCaseTitle')?.value || '',
            notice_type: document.getElementById('mintNoticeType')?.value || 'summons',
            issuing_agency: document.getElementById('issuingAgency')?.value || 'The Block Service',
            created_at: new Date().toISOString(),
            status: 'draft',
            // NOT saved to backend yet
            is_draft: true
        };
        
        console.log('📝 Created draft case (not saved):', window.currentCaseData);
    }
    
    // Call original function
    if (originalShowDocumentUpload) {
        originalShowDocumentUpload();
    } else {
        // Fallback implementation
        document.getElementById('mintStep1').style.display = 'none';
        document.getElementById('mintStep2').style.display = 'block';
        document.getElementById('mintStep3').style.display = 'none';
    }
};

// Add listener for case number field
document.addEventListener('DOMContentLoaded', function() {
    const caseNumberField = document.getElementById('mintCaseNumber');
    if (caseNumberField) {
        // Debounced check for existing case
        let checkTimeout;
        caseNumberField.addEventListener('input', function(e) {
            clearTimeout(checkTimeout);
            checkTimeout = setTimeout(() => {
                checkForExistingCase(e.target.value);
            }, 500);
        });
    }
});

console.log('✅ Case creation workflow fixed!');
console.log('   - Clean slate when opening Create Legal Notice');
console.log('   - Checks for existing cases after entering case number');
console.log('   - Offers to resume existing cases');
console.log('   - Drafts stay in memory until explicitly saved');