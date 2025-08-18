/**
 * Re-upload Missing Images to Backend
 * This script helps re-upload document images that are returning 404 errors
 */

class ImageReuploader {
    constructor() {
        this.backend = 'https://nftserviceapp.onrender.com';
        this.init();
    }

    async init() {
        // Add a button to the UI for re-uploading
        this.addReuploadButton();
    }

    addReuploadButton() {
        // Check if unified system exists
        if (!window.unifiedSystem) {
            setTimeout(() => this.addReuploadButton(), 1000);
            return;
        }

        // Add method to unified system (check if methods exist first)
        if (typeof this.reuploadAllMissingImages === 'function') {
            window.unifiedSystem.reuploadAllMissingImages = this.reuploadAllMissingImages.bind(this);
        }
        if (typeof this.checkAndReuploadImage === 'function') {
            window.unifiedSystem.checkAndReuploadImage = this.checkAndReuploadImage.bind(this);
        }
        
        console.log('Image re-upload functions added to unifiedSystem');
    }

    /**
     * Check if an image URL is accessible
     */
    async isImageAccessible(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Re-upload all missing images for all cases
     */
    async reuploadAllMissingImages() {
        if (!window.unifiedSystem || !window.unifiedSystem.cases) {
            console.error('Unified system not ready');
            return;
        }

        console.log('Starting re-upload of missing images...');
        const cases = window.unifiedSystem.cases;
        let reuploadCount = 0;
        let errorCount = 0;

        for (const [caseNumber, caseData] of cases) {
            console.log(`Checking case ${caseNumber}...`);
            
            for (const recipient of (caseData.recipients || [])) {
                const noticeId = recipient.alertId || recipient.documentId;
                if (!noticeId) continue;

                try {
                    // Check if images exist in backend
                    const response = await fetch(`${this.backend}/api/images/${noticeId}`);
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        // Check if the returned URLs are actually accessible
                        let needsReupload = false;
                        
                        if (data.alertThumbnailUrl) {
                            const accessible = await this.isImageAccessible(data.alertThumbnailUrl);
                            if (!accessible) {
                                console.log(`Alert thumbnail not accessible for notice ${noticeId}: ${data.alertThumbnailUrl}`);
                                needsReupload = true;
                            }
                        }
                        
                        if (data.documentUnencryptedUrl) {
                            const accessible = await this.isImageAccessible(data.documentUnencryptedUrl);
                            if (!accessible) {
                                console.log(`Document not accessible for notice ${noticeId}: ${data.documentUnencryptedUrl}`);
                                needsReupload = true;
                            }
                        }
                        
                        if (needsReupload) {
                            const result = await this.attemptReupload(caseNumber, noticeId, caseData, recipient);
                            if (result) {
                                reuploadCount++;
                            } else {
                                errorCount++;
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error checking notice ${noticeId}:`, error);
                    errorCount++;
                }
            }
        }

        console.log(`Re-upload complete. Success: ${reuploadCount}, Errors: ${errorCount}`);
        
        // Show summary to user
        this.showReuploadSummary(reuploadCount, errorCount);
    }

    /**
     * Attempt to re-upload images for a specific notice
     */
    async attemptReupload(caseNumber, noticeId, caseData, recipient) {
        console.log(`Attempting to re-upload images for notice ${noticeId}...`);
        
        // Check if we have the original images in localStorage or sessionStorage
        const storageKey = `notice_images_${noticeId}`;
        const storedImages = localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
        
        if (storedImages) {
            try {
                const images = JSON.parse(storedImages);
                return await this.uploadImages(noticeId, images, caseData);
            } catch (error) {
                console.error('Error parsing stored images:', error);
            }
        }

        // Check if we have the uploaded image in window
        if (window.uploadedImage && window.uploadedImage.thumbnail) {
            console.log('Found uploaded image in window object');
            return await this.uploadImages(noticeId, {
                thumbnail: window.uploadedImage.thumbnail,
                document: window.uploadedImage.fullDocument
            }, caseData);
        }

        // Try to get from IndexedDB if available
        const dbImages = await this.getFromIndexedDB(noticeId);
        if (dbImages) {
            return await this.uploadImages(noticeId, dbImages, caseData);
        }

        console.log(`No local images found for notice ${noticeId}`);
        return false;
    }

    /**
     * Upload images to backend
     */
    async uploadImages(noticeId, images, caseData) {
        const formData = new FormData();
        
        // Add metadata
        formData.append('caseNumber', caseData.caseNumber || '');
        formData.append('serverAddress', window.tronWeb?.defaultAddress?.base58 || '');
        formData.append('recipientAddress', caseData.recipients?.[0]?.recipientAddress || '');
        formData.append('alertId', noticeId);
        formData.append('documentId', noticeId);
        formData.append('nftDescription', 'Re-uploaded Legal Notice');
        formData.append('noticeType', caseData.noticeType || 'Legal Notice');
        formData.append('issuingAgency', caseData.issuingAgency || '');

        // Convert data URLs to blobs if needed
        if (images.thumbnail) {
            const thumbnailBlob = await this.dataURLtoBlob(images.thumbnail);
            if (thumbnailBlob) {
                formData.append('thumbnail', thumbnailBlob, 'thumbnail.png');
            }
        }

        if (images.document) {
            const documentBlob = await this.dataURLtoBlob(images.document);
            if (documentBlob) {
                formData.append('unencryptedDocument', documentBlob, 'document.png');
            }
        }

        try {
            const response = await fetch(
                `${this.backend}/api/documents/notice/${noticeId}/components`,
                {
                    method: 'POST',
                    body: formData
                }
            );

            if (response.ok) {
                console.log(`Successfully re-uploaded images for notice ${noticeId}`);
                return true;
            } else {
                console.error(`Failed to re-upload images for notice ${noticeId}:`, await response.text());
                return false;
            }
        } catch (error) {
            console.error(`Error re-uploading images for notice ${noticeId}:`, error);
            return false;
        }
    }

    /**
     * Convert data URL to Blob
     */
    async dataURLtoBlob(dataURL) {
        if (!dataURL || typeof dataURL !== 'string') return null;
        
        try {
            const response = await fetch(dataURL);
            return await response.blob();
        } catch (error) {
            console.error('Error converting data URL to blob:', error);
            return null;
        }
    }

    /**
     * Try to get images from IndexedDB
     */
    async getFromIndexedDB(noticeId) {
        if (!window.indexedDB) return null;

        return new Promise((resolve) => {
            const request = indexedDB.open('NFTServiceDB', 1);
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('notices')) {
                    resolve(null);
                    return;
                }

                const transaction = db.transaction(['notices'], 'readonly');
                const store = transaction.objectStore('notices');
                const getRequest = store.get(noticeId);
                
                getRequest.onsuccess = () => {
                    resolve(getRequest.result?.images || null);
                };
                
                getRequest.onerror = () => {
                    resolve(null);
                };
            };
            
            request.onerror = () => {
                resolve(null);
            };
        });
    }

    /**
     * Show re-upload summary to user
     */
    showReuploadSummary(successCount, errorCount) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>Image Re-upload Complete</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; padding: 2rem;">
                        ${successCount > 0 ? `
                            <div style="color: #28a745; margin-bottom: 1rem;">
                                <i class="fas fa-check-circle" style="font-size: 3rem;"></i>
                                <p style="font-size: 1.2rem; margin-top: 1rem;">
                                    Successfully re-uploaded ${successCount} image${successCount !== 1 ? 's' : ''}
                                </p>
                            </div>
                        ` : ''}
                        ${errorCount > 0 ? `
                            <div style="color: #dc3545;">
                                <i class="fas fa-exclamation-triangle" style="font-size: 2rem;"></i>
                                <p style="margin-top: 1rem;">
                                    ${errorCount} image${errorCount !== 1 ? 's' : ''} could not be re-uploaded
                                </p>
                                <p style="font-size: 0.9rem; color: #666;">
                                    These images may need to be manually uploaded
                                </p>
                            </div>
                        ` : ''}
                        ${successCount === 0 && errorCount === 0 ? `
                            <div style="color: #6c757d;">
                                <i class="fas fa-info-circle" style="font-size: 3rem;"></i>
                                <p style="margin-top: 1rem;">
                                    No missing images found or all images are already accessible
                                </p>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-primary">
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

// Initialize the re-uploader
window.imageReuploader = new ImageReuploader();

// Add console command for manual trigger
console.log('%c Image Re-uploader Loaded! ', 'background: #4CAF50; color: white; padding: 5px 10px; border-radius: 3px;');
console.log('To re-upload all missing images, run: unifiedSystem.reuploadAllMissingImages()');