/**
 * Fix Critical Issues - Case numbers and preview
 */

(function() {
    console.log('🔧 Fixing critical issues...');
    
    // FIX 1: Ensure case number from form is used
    function fixCaseNumberUsage() {
        // Hook into case creation to use the actual form input
        if (window.CaseIntegration) {
            const originalPrepareFromNotice = window.CaseIntegration.prototype.prepareFromNotice;
            
            window.CaseIntegration.prototype.prepareFromNotice = async function(files) {
                console.log('📋 Preparing case from notice form...');
                
                // Get the ACTUAL case number from the form
                const caseNumberInput = document.getElementById('mintCaseNumber') || 
                                       document.getElementById('caseNumber') ||
                                       document.getElementById('batchCaseNumber');
                
                const actualCaseNumber = caseNumberInput?.value?.trim();
                
                if (actualCaseNumber) {
                    console.log(`✅ Using case number from form: ${actualCaseNumber}`);
                    
                    // Store it where it needs to be
                    window.currentCaseNumber = actualCaseNumber;
                    
                    // If calling original function, make sure to pass the case number
                    if (originalPrepareFromNotice) {
                        // Inject the case number into the process
                        const result = await originalPrepareFromNotice.call(this, files);
                        if (result && result.metadata) {
                            result.metadata.caseNumber = actualCaseNumber;
                        }
                        return result;
                    }
                } else {
                    console.warn('⚠️ No case number found in form');
                }
                
                return originalPrepareFromNotice ? 
                    await originalPrepareFromNotice.call(this, files) : null;
            };
        }
        
        // Also override createCase to ensure case number is used
        if (window.caseManager?.createCase) {
            const originalCreateCase = window.caseManager.createCase;
            
            window.caseManager.createCase = async function(files, metadata) {
                // Get case number from form if not in metadata
                if (!metadata.caseNumber || metadata.caseNumber.includes('CASE-')) {
                    const caseNumberInput = document.getElementById('mintCaseNumber') || 
                                           document.getElementById('caseNumber');
                    const formCaseNumber = caseNumberInput?.value?.trim();
                    
                    if (formCaseNumber) {
                        console.log(`✅ Overriding with form case number: ${formCaseNumber}`);
                        metadata.caseNumber = formCaseNumber;
                    }
                }
                
                return await originalCreateCase.call(this, files, metadata);
            };
        }
    }
    
    // FIX 2: Make Preview Merged actually work with real PDFs
    function fixPreviewMerged() {
        const originalPreviewMerged = window.previewMergedDocument;
        
        window.previewMergedDocument = async function() {
            console.log('📄 Preview Merged clicked - showing actual documents');
            
            // Check if we have documents
            if (!window.uploadedDocumentsList || window.uploadedDocumentsList.length === 0) {
                if (window.uiManager) {
                    window.uiManager.showNotification('warning', 'No documents uploaded');
                }
                return;
            }
            
            // First try to compile if needed
            if (!window.uploadedImage?.data && window.multiDocHandler?.compileDocuments) {
                console.log('📦 Compiling documents first...');
                try {
                    await window.multiDocHandler.compileDocuments();
                } catch (error) {
                    console.error('Compile failed:', error);
                }
            }
            
            // Create preview modal showing ACTUAL PDF
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.cssText = `
                display: block;
                position: fixed;
                z-index: 10000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
            `;
            
            // Try to get PDF data from various sources
            let pdfContent = '';
            let hasActualPDF = false;
            
            // Try compiled document first
            if (window.uploadedImage?.data && window.uploadedImage.data.startsWith('data:')) {
                console.log('✅ Using compiled document data');
                pdfContent = `<embed src="${window.uploadedImage.data}" type="application/pdf" style="width: 100%; height: 100%;" />`;
                hasActualPDF = true;
            }
            // Try first document if it's a PDF
            else if (window.uploadedDocumentsList[0]?.data) {
                const firstDoc = window.uploadedDocumentsList[0];
                if (firstDoc.data.startsWith('data:application/pdf') || firstDoc.fileType === 'application/pdf') {
                    console.log('✅ Using first document PDF');
                    pdfContent = `<embed src="${firstDoc.data}" type="application/pdf" style="width: 100%; height: 100%;" />`;
                    hasActualPDF = true;
                }
            }
            
            // If no PDF data, show document list
            if (!hasActualPDF) {
                console.log('⚠️ No PDF data available, showing document list');
                pdfContent = `
                    <div style="padding: 40px; background: white; height: 100%; overflow: auto;">
                        <h3>Documents Ready (${window.uploadedDocumentsList.length} files)</h3>
                        <p style="color: #dc3545; font-weight: bold;">
                            ⚠️ PDF preview not available. Documents will be compiled when you proceed.
                        </p>
                        <ul style="list-style: none; padding: 0; margin-top: 20px;">
                            ${window.uploadedDocumentsList.map((doc, i) => `
                                <li style="padding: 15px; background: #f8f9fa; margin-bottom: 10px; border-radius: 8px;">
                                    <i class="fas fa-file-pdf" style="color: #dc3545; margin-right: 10px;"></i>
                                    <strong>${i + 1}.</strong> ${doc.fileName}
                                    <span style="color: #6c757d; margin-left: 10px;">
                                        (${((doc.fileSize || 0) / 1024).toFixed(1)} KB)
                                    </span>
                                    ${doc.data ? '<span style="color: #28a745; margin-left: 10px;">✓ Loaded</span>' : ''}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }
            
            modal.innerHTML = `
                <div style="
                    background: white;
                    margin: 2% auto;
                    width: 90%;
                    max-width: 1200px;
                    height: 90vh;
                    border-radius: 8px;
                    display: flex;
                    flex-direction: column;
                ">
                    <div style="
                        padding: 15px 20px;
                        background: #f8f9fa;
                        border-bottom: 1px solid #dee2e6;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <h3 style="margin: 0;">
                            <i class="fas fa-file-pdf" style="color: #dc3545;"></i>
                            ${hasActualPDF ? 'Merged Document Preview' : 'Documents to be Merged'}
                        </h3>
                        <button onclick="this.closest('.modal').remove()" style="
                            background: none;
                            border: none;
                            font-size: 28px;
                            cursor: pointer;
                            color: #999;
                        ">&times;</button>
                    </div>
                    <div style="flex: 1; overflow: hidden;">
                        ${pdfContent}
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Close on escape
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    modal.remove();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        };
    }
    
    // FIX 3: Ensure case number is captured when moving to recipient selection
    function fixCaseNumberCapture() {
        const originalShowMintStep3 = window.showMintStep3;
        
        window.showMintStep3 = function() {
            // Capture case number before moving to step 3
            const caseNumberInput = document.getElementById('mintCaseNumber');
            const caseNumber = caseNumberInput?.value?.trim();
            
            if (caseNumber) {
                console.log(`📋 Captured case number for Step 3: ${caseNumber}`);
                window.currentCaseNumber = caseNumber;
                
                // Store in various places it might be needed
                if (window.caseIntegration) {
                    window.caseIntegration.currentCaseNumber = caseNumber;
                }
                if (window.caseManager) {
                    window.caseManager.currentCaseNumber = caseNumber;
                }
                
                // Also store in session storage
                sessionStorage.setItem('currentCaseNumber', caseNumber);
            }
            
            // Call original function
            if (originalShowMintStep3) {
                return originalShowMintStep3.apply(this, arguments);
            }
        };
    }
    
    // Apply all fixes
    fixCaseNumberUsage();
    fixPreviewMerged();
    fixCaseNumberCapture();
    
    // Also run fixes after page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            fixCaseNumberUsage();
            fixCaseNumberCapture();
        });
    }
    
    console.log('✅ Critical fixes applied:');
    console.log('   - Case numbers from form will be used (not generated)');
    console.log('   - Preview Merged will show actual PDFs');
    console.log('   - Case number captured when moving between steps');
})();