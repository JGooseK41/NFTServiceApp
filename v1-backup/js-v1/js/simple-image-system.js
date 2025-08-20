/**
 * Simple Image System
 * Clean, straightforward image storage and retrieval
 */

class SimpleImageSystem {
    constructor() {
        this.backend = 'https://nftserviceapp.onrender.com';
        this.walletAddress = null;
    }

    /**
     * Initialize with wallet
     */
    init() {
        this.walletAddress = window.tronWeb?.defaultAddress?.base58 || 
                           localStorage.getItem('walletAddress');
        
        if (!this.walletAddress) {
            console.warn('No wallet address available');
            return false;
        }
        
        console.log('Simple Image System initialized for:', this.walletAddress);
        return true;
    }

    /**
     * Store images for a notice
     */
    async storeImages(noticeData) {
        if (!this.walletAddress) {
            console.error('No wallet address - cannot store images');
            return null;
        }

        const payload = {
            notice_id: noticeData.noticeId || noticeData.alertId,
            server_address: noticeData.serverAddress || this.walletAddress,
            recipient_address: noticeData.recipientAddress,
            alert_image: noticeData.alertImage,
            document_image: noticeData.documentImage,
            alert_thumbnail: noticeData.alertThumbnail,
            document_thumbnail: noticeData.documentThumbnail,
            transaction_hash: noticeData.transactionHash
        };

        try {
            const response = await fetch(`${this.backend}/api/images`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Wallet-Address': this.walletAddress
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Failed to store images: ${response.status}`);
            }

            const result = await response.json();
            console.log('Images stored successfully:', result);
            return result;
        } catch (error) {
            console.error('Error storing images:', error);
            return null;
        }
    }

    /**
     * Get images for a specific notice
     */
    async getNoticeImages(noticeId) {
        if (!this.walletAddress) {
            console.error('No wallet address - cannot fetch images');
            return null;
        }

        if (!noticeId || noticeId === 'null' || noticeId === 'undefined') {
            console.error('Invalid notice ID:', noticeId);
            return null;
        }

        try {
            const response = await fetch(`${this.backend}/api/images/${noticeId}`, {
                headers: {
                    'X-Wallet-Address': this.walletAddress
                }
            });

            if (response.status === 404) {
                console.log('No images found for notice:', noticeId);
                return null;
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch images: ${response.status}`);
            }

            const images = await response.json();
            console.log('Images retrieved for notice', noticeId, ':', images);
            return images;
        } catch (error) {
            console.error('Error fetching images:', error);
            return null;
        }
    }

    /**
     * Get all images where user is server
     */
    async getMyServedImages() {
        if (!this.walletAddress) {
            console.error('No wallet address - cannot fetch images');
            return [];
        }

        try {
            const response = await fetch(`${this.backend}/api/images?role=server`, {
                headers: {
                    'X-Wallet-Address': this.walletAddress
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch served images: ${response.status}`);
            }

            const images = await response.json();
            console.log(`Found ${images.length} served notices`);
            return images;
        } catch (error) {
            console.error('Error fetching served images:', error);
            return [];
        }
    }

    /**
     * Get all images where user is recipient
     */
    async getMyReceivedImages() {
        if (!this.walletAddress) {
            console.error('No wallet address - cannot fetch images');
            return [];
        }

        try {
            const response = await fetch(`${this.backend}/api/images?role=recipient`, {
                headers: {
                    'X-Wallet-Address': this.walletAddress
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch received images: ${response.status}`);
            }

            const images = await response.json();
            console.log(`Found ${images.length} received notices`);
            return images;
        } catch (error) {
            console.error('Error fetching received images:', error);
            return [];
        }
    }

    /**
     * Get all images (served or received)
     */
    async getAllMyImages() {
        if (!this.walletAddress) {
            console.error('No wallet address - cannot fetch images');
            return [];
        }

        try {
            const response = await fetch(`${this.backend}/api/images`, {
                headers: {
                    'X-Wallet-Address': this.walletAddress
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch images: ${response.status}`);
            }

            const images = await response.json();
            console.log(`Found ${images.length} total notices`);
            return images;
        } catch (error) {
            console.error('Error fetching images:', error);
            return [];
        }
    }

    /**
     * Display image in UI element
     */
    displayImage(imageData, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Container not found:', containerId);
            return;
        }

        if (!imageData) {
            container.innerHTML = '<p>No image available</p>';
            return;
        }

        // Determine which image to show
        const imageUrl = imageData.document_image || 
                        imageData.alert_image || 
                        imageData.document_thumbnail || 
                        imageData.alert_thumbnail;

        if (!imageUrl) {
            container.innerHTML = '<p>No image data found</p>';
            return;
        }

        container.innerHTML = `
            <img src="${imageUrl}" alt="Notice Image" style="max-width: 100%; height: auto;">
            <div style="margin-top: 10px; font-size: 12px; color: #666;">
                Notice ID: ${imageData.notice_id}<br>
                Created: ${new Date(imageData.created_at).toLocaleString()}
                ${imageData.transaction_hash ? `<br>TX: ${imageData.transaction_hash.substring(0, 10)}...` : ''}
            </div>
        `;
    }

    /**
     * Quick viewer for dashboard
     */
    async quickView(noticeId, modalId = 'imageModal') {
        if (!noticeId || noticeId === 'null') {
            alert('Invalid notice ID');
            return;
        }

        // Show loading
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                max-width: 90%;
                max-height: 90%;
                overflow: auto;
            `;
            document.body.appendChild(modal);
        }

        modal.innerHTML = '<p>Loading...</p>';

        // Fetch and display
        const imageData = await this.getNoticeImages(noticeId);
        
        if (!imageData) {
            modal.innerHTML = `
                <p>No images found for Notice #${noticeId}</p>
                <button onclick="document.getElementById('${modalId}').remove()">Close</button>
            `;
            return;
        }

        const imageUrl = imageData.document_image || imageData.alert_image;
        modal.innerHTML = `
            <div style="text-align: center;">
                <h3>Notice #${noticeId}</h3>
                <img src="${imageUrl}" style="max-width: 100%; height: auto;">
                <div style="margin-top: 10px;">
                    <button onclick="document.getElementById('${modalId}').remove()">Close</button>
                </div>
            </div>
        `;
    }
}

// Create global instance
window.simpleImageSystem = new SimpleImageSystem();

// Auto-initialize when wallet connects
window.addEventListener('walletConnected', () => {
    window.simpleImageSystem.init();
});

// Initialize if wallet already connected
if (window.tronWeb?.defaultAddress?.base58) {
    window.simpleImageSystem.init();
}

console.log('Simple Image System loaded - use window.simpleImageSystem');