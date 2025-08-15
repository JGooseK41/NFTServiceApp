/**
 * Integrate Simple Image Storage into Notice Creation
 * This adds image storage to the notice creation process
 */

console.log('🔧 Integrating simple image storage into notice creation...');

(function() {
    // Wait for dependencies
    if (!window.tronWeb || !window.simpleImageSystem) {
        console.log('⏳ Waiting for dependencies...');
        setTimeout(arguments.callee, 500);
        return;
    }

    // Store original serveNotice if exists
    const originalServeNotice = window.serveNotice;

    /**
     * Enhanced serveNotice that stores images after successful creation
     */
    window.serveNotice = async function(noticeData) {
        console.log('📝 Enhanced serveNotice with image storage');
        
        try {
            // Call original serveNotice (from whatever override is active)
            let result;
            if (originalServeNotice) {
                result = await originalServeNotice.call(this, noticeData);
            } else if (window.OptimizedTransactionManager) {
                result = await window.OptimizedTransactionManager.executeNotice(noticeData);
            } else {
                throw new Error('No serveNotice implementation found');
            }

            // If successful, store images
            if (result && (result.success || result.txId || result)) {
                console.log('✅ Notice created, storing images...');
                
                // Extract transaction hash
                const txHash = result.txId || result.transactionHash || result;
                
                // Get notice IDs from result or generate them
                let alertId, documentId;
                if (result.alertId && result.documentId) {
                    alertId = result.alertId;
                    documentId = result.documentId;
                } else if (result.noticeId) {
                    // If only one ID, assume alert is odd, document is even
                    const baseId = parseInt(result.noticeId);
                    alertId = baseId % 2 === 1 ? baseId : baseId - 1;
                    documentId = baseId % 2 === 0 ? baseId : baseId + 1;
                } else {
                    // Try to extract from transaction events or generate
                    alertId = Date.now().toString();
                    documentId = (Date.now() + 1).toString();
                }

                // Prepare image data
                const imageData = {
                    notice_id: alertId.toString(),
                    server_address: window.tronWeb.defaultAddress.base58,
                    recipient_address: noticeData.recipient || noticeData.recipientAddress,
                    transaction_hash: txHash,
                    case_number: noticeData.caseNumber,
                    alert_image: null,
                    document_image: null,
                    alert_thumbnail: null,
                    document_thumbnail: null
                };

                // Get alert image from localStorage or generation
                const alertThumbnail = localStorage.getItem('lastAlertThumbnail');
                const documentImage = localStorage.getItem('lastDocumentImage');
                
                if (alertThumbnail) {
                    imageData.alert_image = alertThumbnail;
                    imageData.alert_thumbnail = alertThumbnail;
                }
                
                if (documentImage) {
                    imageData.document_image = documentImage;
                    imageData.document_thumbnail = documentImage;
                }

                // Also check for images in noticeData
                if (noticeData.alertImage) {
                    imageData.alert_image = noticeData.alertImage;
                    imageData.alert_thumbnail = noticeData.alertImage;
                }
                
                if (noticeData.documentImage) {
                    imageData.document_image = noticeData.documentImage;
                    imageData.document_thumbnail = noticeData.documentImage;
                }

                // Store in simple images table
                try {
                    await window.simpleImageSystem.storeImages(imageData);
                    console.log('✅ Images stored in simple table');
                } catch (error) {
                    console.error('Failed to store images:', error);
                    // Don't fail the transaction, just log the error
                }
            }

            return result;
            
        } catch (error) {
            console.error('Error in enhanced serveNotice:', error);
            throw error;
        }
    };

    /**
     * Also override executeBatch for batch operations
     */
    if (window.OptimizedTransactionManager) {
        const originalExecuteBatch = window.OptimizedTransactionManager.executeBatch;
        
        window.OptimizedTransactionManager.executeBatch = async function(recipients, sharedDocuments, caseData) {
            console.log('📦 Enhanced executeBatch with image storage');
            
            try {
                // Call original
                const result = await originalExecuteBatch.call(this, recipients, sharedDocuments, caseData);
                
                // If successful, store images for each recipient
                if (result && result.success) {
                    const alertImage = localStorage.getItem('lastAlertThumbnail');
                    const documentImage = localStorage.getItem('lastDocumentImage');
                    
                    // Store image for each recipient
                    for (let i = 0; i < recipients.length; i++) {
                        const recipient = recipients[i];
                        const noticeId = result.noticeIds?.[i] || Date.now() + i;
                        
                        const imageData = {
                            notice_id: noticeId.toString(),
                            server_address: window.tronWeb.defaultAddress.base58,
                            recipient_address: recipient.address || recipient,
                            transaction_hash: result.txId,
                            case_number: caseData.caseNumber,
                            alert_image: alertImage,
                            document_image: documentImage,
                            alert_thumbnail: alertImage,
                            document_thumbnail: documentImage
                        };
                        
                        try {
                            await window.simpleImageSystem.storeImages(imageData);
                            console.log(`✅ Images stored for recipient ${i + 1}`);
                        } catch (error) {
                            console.error(`Failed to store images for recipient ${i + 1}:`, error);
                        }
                    }
                }
                
                return result;
                
            } catch (error) {
                console.error('Error in enhanced executeBatch:', error);
                throw error;
            }
        };
    }

    /**
     * Hook into image generation to capture images
     */
    const captureGeneratedImages = () => {
        // Override alert thumbnail generation
        const originalGenerateAlertThumbnail = window.generateAlertThumbnail;
        if (originalGenerateAlertThumbnail) {
            window.generateAlertThumbnail = async function(...args) {
                const result = await originalGenerateAlertThumbnail.apply(this, args);
                if (result) {
                    localStorage.setItem('lastAlertThumbnail', result);
                }
                return result;
            };
        }

        // Override document image generation
        const originalGenerateDocumentImage = window.generateDocumentImage;
        if (originalGenerateDocumentImage) {
            window.generateDocumentImage = async function(...args) {
                const result = await originalGenerateDocumentImage.apply(this, args);
                if (result) {
                    localStorage.setItem('lastDocumentImage', result);
                }
                return result;
            };
        }

        // Also capture from canvas operations
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(...args) {
            const result = originalToDataURL.apply(this, args);
            
            // Check if this is an alert or document canvas
            if (this.id === 'alertCanvas' || this.classList.contains('alert-canvas')) {
                localStorage.setItem('lastAlertThumbnail', result);
            } else if (this.id === 'documentCanvas' || this.classList.contains('document-canvas')) {
                localStorage.setItem('lastDocumentImage', result);
            }
            
            return result;
        };
    };

    // Capture generated images
    captureGeneratedImages();

    // Also hook into the form submission to capture notice data
    const enhanceFormSubmission = () => {
        const forms = document.querySelectorAll('#noticeForm, .notice-form, form[name="noticeForm"]');
        forms.forEach(form => {
            if (!form.dataset.enhanced) {
                form.dataset.enhanced = 'true';
                
                form.addEventListener('submit', async (e) => {
                    // Capture any canvas images before submission
                    const alertCanvas = document.querySelector('#alertCanvas, .alert-canvas, canvas[data-type="alert"]');
                    if (alertCanvas && alertCanvas.toDataURL) {
                        localStorage.setItem('lastAlertThumbnail', alertCanvas.toDataURL());
                    }
                    
                    const docCanvas = document.querySelector('#documentCanvas, .document-canvas, canvas[data-type="document"]');
                    if (docCanvas && docCanvas.toDataURL) {
                        localStorage.setItem('lastDocumentImage', docCanvas.toDataURL());
                    }
                });
            }
        });
    };

    // Enhance forms
    enhanceFormSubmission();
    
    // Re-run on DOM changes
    const observer = new MutationObserver(() => {
        enhanceFormSubmission();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('✅ Simple image storage integrated into notice creation');
    
})();