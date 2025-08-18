/**
 * Case Workflow Fix - Proper case management workflow
 * 1. Enter case details first (case number, notice type, etc.)
 * 2. Create or retrieve existing case
 * 3. Add documents to that case
 * 4. Prevent duplicate cases for same case number
 */

class CaseWorkflowManager {
    constructor() {
        this.currentCase = null;
        this.existingCases = new Map(); // Cache of case number -> case data
    }

    /**
     * Initialize the workflow manager
     */
    init() {
        console.log('📋 Case Workflow Manager initializing...');
        
        // Disable auto-creation of cases
        window.AUTO_CREATE_CASE = false;
        
        // Hook into the mint modal opening to check for existing case
        this.hookIntoModalFlow();
        
        // Load existing cases from localStorage
        this.loadExistingCases();
        
        console.log('✅ Case Workflow Manager ready');
    }

    /**
     * Load existing cases from localStorage
     */
    loadExistingCases() {
        try {
            const stored = localStorage.getItem('caseWorkflowCases');
            if (stored) {
                const cases = JSON.parse(stored);
                Object.entries(cases).forEach(([caseNumber, caseData]) => {
                    this.existingCases.set(caseNumber, caseData);
                });
                console.log(`📂 Loaded ${this.existingCases.size} existing cases from storage`);
            }
        } catch (error) {
            console.error('Error loading existing cases:', error);
        }
    }

    /**
     * Save cases to localStorage
     */
    saveExistingCases() {
        try {
            const cases = {};
            this.existingCases.forEach((value, key) => {
                cases[key] = value;
            });
            localStorage.setItem('caseWorkflowCases', JSON.stringify(cases));
        } catch (error) {
            console.error('Error saving cases:', error);
        }
    }

    /**
     * Hook into the modal flow
     */
    hookIntoModalFlow() {
        // Override showMintStep2 to check for existing case first
        const originalShowStep2 = window.showMintStep2;
        window.showMintStep2 = () => {
            // First ensure we have a case
            this.ensureCaseExists();
            
            // Then continue with original flow
            if (originalShowStep2) {
                originalShowStep2();
            }
        };

        // Hook into case number field changes
        document.addEventListener('DOMContentLoaded', () => {
            const caseNumberField = document.getElementById('mintCaseNumber');
            if (caseNumberField) {
                // Add blur event to check for existing case
                caseNumberField.addEventListener('blur', () => {
                    this.checkForExistingCase(caseNumberField.value);
                });

                // Add indicator next to field
                const indicator = document.createElement('div');
                indicator.id = 'caseStatusIndicator';
                indicator.style.cssText = 'margin-top: 5px; font-size: 0.9em;';
                caseNumberField.parentNode.appendChild(indicator);
            }
        });
    }

    /**
     * Check if a case already exists
     */
    async checkForExistingCase(caseNumber) {
        if (!caseNumber || caseNumber.trim() === '') {
            this.updateCaseIndicator('');
            return null;
        }

        caseNumber = caseNumber.trim();

        // Check local cache first
        if (this.existingCases.has(caseNumber)) {
            const caseData = this.existingCases.get(caseNumber);
            this.currentCase = caseData;
            this.updateCaseIndicator('existing', caseData);
            console.log(`📂 Found existing case: ${caseNumber}`, caseData);
            return caseData;
        }

        // Check backend for existing case
        try {
            const serverAddress = window.tronWeb?.defaultAddress?.base58 || 'VIEW';
            const response = await fetch(
                `${window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com'}/api/cases/by-number/${encodeURIComponent(caseNumber)}?serverAddress=${serverAddress}`
            );

            if (response.ok) {
                const data = await response.json();
                if (data.case) {
                    this.currentCase = data.case;
                    this.existingCases.set(caseNumber, data.case);
                    this.saveExistingCases();
                    this.updateCaseIndicator('existing', data.case);
                    console.log(`📂 Found existing case in backend: ${caseNumber}`, data.case);
                    return data.case;
                }
            }
        } catch (error) {
            console.error('Error checking for existing case:', error);
        }

        // No existing case found
        this.updateCaseIndicator('new');
        return null;
    }

    /**
     * Update the case status indicator
     */
    updateCaseIndicator(status, caseData = null) {
        const indicator = document.getElementById('caseStatusIndicator');
        if (!indicator) return;

        switch (status) {
            case 'existing':
                indicator.innerHTML = `
                    <span style="color: #10b981;">
                        <i class="fas fa-folder-open"></i> 
                        Existing case found - ${caseData?.metadata?.documentCount || 0} document(s) already uploaded
                    </span>
                `;
                
                // Also show option to view case
                if (caseData?.id) {
                    indicator.innerHTML += `
                        <button onclick="window.caseWorkflowManager.viewExistingCase('${caseData.id}')" 
                                class="btn btn-sm" style="margin-left: 10px; padding: 2px 8px; font-size: 0.85em;">
                            <i class="fas fa-eye"></i> View Case
                        </button>
                    `;
                }
                break;

            case 'new':
                indicator.innerHTML = `
                    <span style="color: #3b82f6;">
                        <i class="fas fa-plus-circle"></i> 
                        New case will be created
                    </span>
                `;
                break;

            default:
                indicator.innerHTML = '';
        }
    }

    /**
     * Ensure a case exists before proceeding
     */
    async ensureCaseExists() {
        // Get case details from form
        const caseNumber = document.getElementById('mintCaseNumber')?.value || '';
        const noticeType = document.getElementById('noticeType')?.value || 'Legal Notice';
        const issuingAgency = document.getElementById('issuingAgency')?.value || '';

        if (!caseNumber) {
            // Generate a case number if not provided
            const generatedNumber = this.generateCaseNumber();
            document.getElementById('mintCaseNumber').value = generatedNumber;
            console.log(`📋 Generated case number: ${generatedNumber}`);
        }

        // Check if case already exists
        const existingCase = await this.checkForExistingCase(caseNumber || generatedNumber);

        if (existingCase) {
            // Use existing case
            this.currentCase = existingCase;
            window.currentCaseId = existingCase.id;
            console.log(`✅ Using existing case: ${existingCase.id}`);
            
            // Update any uploaded documents to be associated with this case
            if (window.uploadedDocumentsList && window.uploadedDocumentsList.length > 0) {
                await this.addDocumentsToCase(existingCase.id);
            }
        } else {
            // Create new case only when we have documents
            if (window.uploadedDocumentsList && window.uploadedDocumentsList.length > 0) {
                await this.createNewCase(caseNumber, noticeType, issuingAgency);
            }
        }
    }

    /**
     * Create a new case
     */
    async createNewCase(caseNumber, noticeType, issuingAgency) {
        if (!window.caseIntegration) {
            console.error('Case integration not available');
            return;
        }

        console.log(`📋 Creating new case: ${caseNumber}`);
        
        // Create the case through case integration
        const result = await window.caseIntegration.createCaseFromDocuments();
        
        if (result && result.success) {
            this.currentCase = result;
            window.currentCaseId = result.caseId;
            
            // Store in cache
            this.existingCases.set(caseNumber, result);
            this.saveExistingCases();
            
            console.log(`✅ New case created: ${result.caseId}`);
        }
        
        return result;
    }

    /**
     * Add documents to existing case
     */
    async addDocumentsToCase(caseId) {
        console.log(`📎 Adding ${window.uploadedDocumentsList.length} documents to case ${caseId}`);
        
        // TODO: Implement backend endpoint to add documents to existing case
        // For now, just associate them
        window.currentCaseId = caseId;
        
        return true;
    }

    /**
     * Generate a case number
     */
    generateCaseNumber() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const time = String(date.getHours()).padStart(2, '0') + String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}-${time}`;
    }

    /**
     * View existing case details
     */
    viewExistingCase(caseId) {
        const serverAddress = window.tronWeb?.defaultAddress?.base58 || 'VIEW';
        const url = `${window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com'}/api/cases/${caseId}/pdf?serverAddress=${encodeURIComponent(serverAddress)}`;
        window.open(url, '_blank');
    }

    /**
     * Clear current case (start fresh)
     */
    clearCurrentCase() {
        this.currentCase = null;
        window.currentCaseId = null;
        const indicator = document.getElementById('caseStatusIndicator');
        if (indicator) {
            indicator.innerHTML = '';
        }
    }
}

// Initialize the workflow manager
window.caseWorkflowManager = new CaseWorkflowManager();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.caseWorkflowManager.init();
    });
} else {
    window.caseWorkflowManager.init();
}

console.log('📋 Case Workflow Fix loaded - proper case management workflow enabled');