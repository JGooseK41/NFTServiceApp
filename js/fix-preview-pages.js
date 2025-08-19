/**
 * Fix Preview Pages - Show actual PDF instead of placeholders
 */

(function() {
    console.log('🔧 Fixing preview to show all actual pages...');
    
    // Override the preview function to show the ACTUAL merged PDF
    const originalPreviewMerged = window.previewMergedDocument;
    
    window.previewMergedDocument = async function() {
        console.log('📄 Preview Merged - Loading actual document...');
        
        if (!window.uploadedDocumentsList || window.uploadedDocumentsList.length === 0) {
            if (window.uiManager) {
                window.uiManager.showNotification('warning', 'No documents uploaded');
            }
            return;
        }
        
        // Show loading modal
        const loadingModal = document.createElement('div');
        loadingModal.className = 'modal';
        loadingModal.style.cssText = 'display: block; z-index: 10000;';
        loadingModal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; text-align: center; padding: 40px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #2196f3; margin-bottom: 20px;"></i>
                <h3>Merging Documents...</h3>
                <p>${window.uploadedDocumentsList.length} document(s) being combined</p>
            </div>
        `;
        document.body.appendChild(loadingModal);
        
        try {
            // Force compile if not done
            if (window.multiDocHandler && !window.uploadedImage?.data) {
                console.log('📦 Compiling documents...');
                await window.multiDocHandler.compileDocuments();
            }
            
            // Remove loading modal
            loadingModal.remove();
            
            // Get the actual page count from documents
            let totalPages = 0;
            let documentInfo = [];
            
            // Calculate real page counts
            for (let doc of window.uploadedDocumentsList) {
                const pageCount = doc.pageCount || 1; // Use actual page count if available
                totalPages += pageCount;
                documentInfo.push({
                    name: doc.fileName,
                    pages: pageCount
                });
            }
            
            // Add separator pages (one between each document, so n-1 for n documents)
            const separatorPages = window.uploadedDocumentsList.length > 1 ? 
                                  window.uploadedDocumentsList.length - 1 : 0;
            const grandTotal = totalPages + separatorPages;
            
            console.log(`📊 Document totals: ${totalPages} content pages + ${separatorPages} separator pages = ${grandTotal} total`);
            
            // Create preview modal
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.cssText = 'display: block; z-index: 10001;';
            
            // Check if we have the merged PDF data
            const hasPDFData = window.uploadedImage?.data && 
                              window.uploadedImage.data.startsWith('data:application/pdf');
            
            modal.innerHTML = `
                <div class="modal-content" style="
                    max-width: 95%;
                    width: 1200px;
                    height: 95vh;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                ">
                    <!-- Header -->
                    <div style="
                        background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
                        color: white;
                        padding: 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <div>
                            <h2 style="margin: 0;">
                                <i class="fas fa-file-pdf"></i> Merged Document Preview
                            </h2>
                            <p style="margin: 5px 0 0 0; opacity: 0.9;">
                                ${documentInfo.length} document(s) • 
                                ${totalPages} pages of content
                                ${separatorPages > 0 ? ` • Plus ${separatorPages} separator page(s)` : ''}
                                • Total: ${grandTotal} pages
                            </p>
                        </div>
                        <button onclick="this.closest('.modal').remove()" style="
                            background: rgba(255,255,255,0.2);
                            border: none;
                            color: white;
                            width: 40px;
                            height: 40px;
                            border-radius: 50%;
                            font-size: 24px;
                            cursor: pointer;
                        ">×</button>
                    </div>
                    
                    <!-- Document breakdown -->
                    <div style="
                        background: #f8f9fa;
                        padding: 15px 20px;
                        border-bottom: 1px solid #dee2e6;
                    ">
                        <div style="display: flex; gap: 20px; align-items: center;">
                            <strong>Documents included:</strong>
                            ${documentInfo.map((doc, i) => `
                                <span style="
                                    background: white;
                                    padding: 5px 10px;
                                    border-radius: 4px;
                                    border: 1px solid #dee2e6;
                                    font-size: 13px;
                                ">
                                    ${i + 1}. ${doc.name} (${doc.pages} pages)
                                </span>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- Main content area -->
                    <div style="flex: 1; overflow: hidden; background: #333;">
                        ${hasPDFData ? `
                            <!-- Show actual PDF -->
                            <embed 
                                src="${window.uploadedImage.data}" 
                                type="application/pdf" 
                                style="width: 100%; height: 100%;"
                            />
                        ` : `
                            <!-- No PDF data yet -->
                            <div style="
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                height: 100%;
                                color: white;
                                text-align: center;
                                padding: 40px;
                            ">
                                <i class="fas fa-exclamation-triangle" style="
                                    font-size: 64px;
                                    color: #ffc107;
                                    margin-bottom: 20px;
                                "></i>
                                <h3>Documents Not Yet Merged</h3>
                                <p style="max-width: 600px; margin: 20px auto;">
                                    The ${documentInfo.length} documents (${totalPages} pages) haven't been merged yet.
                                    This will happen automatically when you proceed to create the NFT.
                                </p>
                                <button onclick="
                                    this.closest('.modal').remove();
                                    if (window.multiDocHandler?.compileDocuments) {
                                        window.multiDocHandler.compileDocuments().then(() => {
                                            window.previewMergedDocument();
                                        });
                                    }
                                " style="
                                    background: #28a745;
                                    color: white;
                                    border: none;
                                    padding: 12px 30px;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 16px;
                                    margin-top: 20px;
                                ">
                                    <i class="fas fa-compress"></i> Compile & Preview Now
                                </button>
                            </div>
                        `}
                    </div>
                    
                    <!-- Footer -->
                    <div style="
                        background: #f8f9fa;
                        padding: 15px 20px;
                        border-top: 1px solid #dee2e6;
                        text-align: center;
                        color: #6c757d;
                    ">
                        ${hasPDFData ? 
                            `<i class="fas fa-check-circle" style="color: #28a745;"></i> 
                             This is your complete ${grandTotal}-page document as it will be sent` :
                            `<i class="fas fa-info-circle"></i> 
                             Documents will be merged into a single ${grandTotal}-page PDF when you proceed`
                        }
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
        } catch (error) {
            console.error('Preview error:', error);
            loadingModal.remove();
            if (window.uiManager) {
                window.uiManager.showNotification('error', 'Failed to generate preview: ' + error.message);
            }
        }
    };
    
    // Also fix the page count detection
    if (window.multiDocHandler) {
        const originalAddDocument = window.multiDocHandler.addDocument;
        
        window.multiDocHandler.addDocument = async function(file) {
            console.log(`📄 Adding document: ${file.name}`);
            
            // Try to detect page count for PDFs
            if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                try {
                    // Read the file
                    const arrayBuffer = await file.arrayBuffer();
                    const bytes = new Uint8Array(arrayBuffer);
                    
                    // Simple page count detection from PDF structure
                    const pdfText = new TextDecoder('latin1').decode(bytes);
                    const pageMatches = pdfText.match(/\/Type\s*\/Page[^s]/g);
                    const pageCount = pageMatches ? pageMatches.length : 1;
                    
                    console.log(`📊 Detected ${pageCount} pages in ${file.name}`);
                    
                    // Store page count
                    file.pageCount = pageCount;
                } catch (e) {
                    console.log('Could not detect page count, assuming 1');
                    file.pageCount = 1;
                }
            }
            
            // Call original function
            if (originalAddDocument) {
                return await originalAddDocument.call(this, file);
            }
        };
    }
    
    console.log('✅ Preview pages fix loaded');
    console.log('   - Will show actual merged PDF with all pages');
    console.log('   - Displays correct page counts');
    console.log('   - No more placeholders');
})();