/**
 * Alert Thumbnail Generator - Creates proper Alert NFT thumbnails
 */

class AlertThumbnailGenerator {
    constructor() {
        this.backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
    }
    
    /**
     * Generate Alert NFT thumbnail from first page of first document
     */
    async generateAlertThumbnail() {
        console.log('🖼️ Generating Alert NFT thumbnail...');
        
        try {
            // Get the first document
            const firstDoc = window.uploadedDocumentsList?.[0];
            if (!firstDoc) {
                throw new Error('No documents uploaded');
            }
            
            let thumbnail;
            
            // If we already have a preview, use it
            if (firstDoc.preview && firstDoc.preview.startsWith('data:image')) {
                console.log('Using existing preview as base');
                thumbnail = await this.addLegalNoticeOverlay(firstDoc.preview);
            } 
            // If it's a PDF, extract first page
            else if (firstDoc.fileType === 'application/pdf' || firstDoc.fileName?.endsWith('.pdf')) {
                console.log('Extracting first page from PDF');
                thumbnail = await this.extractPDFFirstPage(firstDoc);
            }
            // For images, use directly
            else if (firstDoc.fileType?.startsWith('image/')) {
                console.log('Using image directly');
                thumbnail = await this.addLegalNoticeOverlay(firstDoc.data);
            }
            // Fallback: create a proper placeholder
            else {
                console.log('Creating placeholder thumbnail');
                thumbnail = await this.createAlertPlaceholder(firstDoc);
            }
            
            // Store the thumbnail
            if (!window.uploadedImage) {
                window.uploadedImage = {};
            }
            window.uploadedImage.alertThumbnail = thumbnail;
            window.uploadedImage.preview = thumbnail;
            
            console.log('✅ Alert thumbnail generated successfully');
            return thumbnail;
            
        } catch (error) {
            console.error('Failed to generate Alert thumbnail:', error);
            // Create fallback thumbnail
            return this.createFallbackThumbnail();
        }
    }
    
    /**
     * Extract first page from PDF as image
     */
    async extractPDFFirstPage(document) {
        try {
            // Try using PDF.js if available
            if (typeof pdfjsLib !== 'undefined') {
                console.log('Using PDF.js to extract first page');
                
                // Get PDF data
                const pdfData = document.data || document.preview;
                if (!pdfData) throw new Error('No PDF data available');
                
                // Convert to array buffer
                const base64 = pdfData.split(',')[1];
                const pdfBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                
                // Load PDF
                const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
                const page = await pdf.getPage(1);
                
                // Render to canvas
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                await page.render({
                    canvasContext: ctx,
                    viewport: viewport
                }).promise;
                
                // Convert to image and add overlay
                const imageData = canvas.toDataURL('image/jpeg', 0.9);
                return await this.addLegalNoticeOverlay(imageData);
            }
        } catch (error) {
            console.warn('PDF.js extraction failed:', error);
        }
        
        // Fallback: Create a nice placeholder
        return this.createAlertPlaceholder(document);
    }
    
    /**
     * Add legal notice overlay to image
     */
    async addLegalNoticeOverlay(imageData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Set canvas size (standard NFT dimensions)
                canvas.width = 800;
                canvas.height = 800;
                
                // Calculate image scaling to fit
                const scale = Math.min(
                    canvas.width / img.width,
                    canvas.height / img.height
                );
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                const x = (canvas.width - scaledWidth) / 2;
                const y = (canvas.height - scaledHeight) / 2;
                
                // White background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw image centered
                ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
                
                // Add red gradient overlay at top
                const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                gradient.addColorStop(0, 'rgba(220, 38, 38, 0.95)');
                gradient.addColorStop(1, 'rgba(220, 38, 38, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, 200);
                
                // Add text overlay
                ctx.fillStyle = 'white';
                ctx.font = 'bold 48px Arial';
                ctx.textAlign = 'center';
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 8;
                ctx.fillText('LEGAL NOTICE', canvas.width / 2, 80);
                
                ctx.font = '24px Arial';
                ctx.fillText('OFFICIAL SERVICE DOCUMENT', canvas.width / 2, 120);
                
                // Add bottom banner
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
                
                ctx.fillStyle = 'white';
                ctx.font = '20px Arial';
                ctx.fillText('Click to View Full Document', canvas.width / 2, canvas.height - 45);
                ctx.font = '16px Arial';
                ctx.fillText('Recipient Action Required', canvas.width / 2, canvas.height - 20);
                
                // Convert to base64
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            
            img.onerror = () => {
                console.error('Failed to load image for overlay');
                resolve(this.createFallbackThumbnail());
            };
            
            img.src = imageData;
        });
    }
    
    /**
     * Create a nice placeholder for Alert NFT
     */
    createAlertPlaceholder(document) {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, 800, 800);
        gradient.addColorStop(0, '#dc2626');
        gradient.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 800, 800);
        
        // White card in center
        ctx.fillStyle = 'white';
        ctx.fillRect(100, 200, 600, 400);
        
        // Document icon
        ctx.fillStyle = '#dc2626';
        ctx.font = '120px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('📋', 400, 350);
        
        // Title
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 32px Arial';
        ctx.fillText('LEGAL NOTICE', 400, 420);
        
        // File name
        ctx.font = '20px Arial';
        ctx.fillStyle = '#6b7280';
        const fileName = document?.fileName || 'Document';
        const displayName = fileName.length > 30 ? 
            fileName.substring(0, 27) + '...' : fileName;
        ctx.fillText(displayName, 400, 460);
        
        // Status
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('AWAITING DELIVERY', 400, 520);
        
        // Top banner
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(0, 0, 800, 120);
        
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 48px Arial';
        ctx.fillText('LEGAL SERVICE', 400, 75);
        
        // Bottom instruction
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 720, 800, 80);
        
        ctx.fillStyle = 'white';
        ctx.font = '22px Arial';
        ctx.fillText('Tap to View & Accept', 400, 765);
        
        return canvas.toDataURL('image/jpeg', 0.95);
    }
    
    /**
     * Create fallback thumbnail
     */
    createFallbackThumbnail() {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        
        // Simple red background
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, 0, 800, 800);
        
        // White text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 72px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LEGAL', 400, 350);
        ctx.fillText('NOTICE', 400, 450);
        
        return canvas.toDataURL('image/jpeg', 0.95);
    }
    
    /**
     * Preview the Alert thumbnail
     */
    showAlertPreview() {
        const thumbnail = window.uploadedImage?.alertThumbnail;
        if (!thumbnail) {
            console.log('No Alert thumbnail available');
            return;
        }
        
        // Create preview modal
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
            background-color: rgba(0,0,0,0.7);
        `;
        
        modal.innerHTML = `
            <div style="
                position: relative;
                background-color: white;
                margin: 5% auto;
                padding: 20px;
                width: 600px;
                max-width: 90%;
                border-radius: 12px;
            ">
                <button onclick="this.closest('.modal').remove()" style="
                    position: absolute;
                    right: 15px;
                    top: 15px;
                    background: none;
                    border: none;
                    font-size: 28px;
                    cursor: pointer;
                    color: #999;
                ">&times;</button>
                
                <h3 style="margin: 0 0 20px 0; color: #1565c0;">
                    <i class="fas fa-wallet"></i> Alert NFT Preview
                </h3>
                
                <div style="text-align: center;">
                    <img src="${thumbnail}" style="
                        max-width: 100%;
                        max-height: 400px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    ">
                </div>
                
                <div style="
                    margin-top: 20px;
                    padding: 15px;
                    background: #e3f2fd;
                    border-radius: 8px;
                    color: #1565c0;
                ">
                    <strong>This is what recipients will see in their wallet</strong>
                    <ul style="margin: 10px 0 0 20px; padding: 0;">
                        <li>Appears as the NFT thumbnail in TronLink</li>
                        <li>Recipients tap this to view the full document</li>
                        <li>Generated from the first page of your first document</li>
                    </ul>
                </div>
                
                <div style="
                    margin-top: 15px;
                    text-align: center;
                ">
                    <button onclick="this.closest('.modal').remove()" style="
                        padding: 10px 30px;
                        background: #2196f3;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 16px;
                    ">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close on clicking outside
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
}

// Initialize
window.alertThumbnailGenerator = new AlertThumbnailGenerator();

// Hook into document upload to generate thumbnail
const originalHandleDocumentUpload = window.handleDocumentUpload;
window.handleDocumentUpload = async function(event) {
    // Call original handler
    if (originalHandleDocumentUpload) {
        await originalHandleDocumentUpload.call(this, event);
    }
    
    // Generate Alert thumbnail after upload
    setTimeout(async () => {
        if (window.uploadedDocumentsList?.length > 0) {
            await window.alertThumbnailGenerator.generateAlertThumbnail();
            console.log('✅ Alert thumbnail ready for preview');
        }
    }, 500);
};

// Add command to preview Alert thumbnail
window.previewAlertThumbnail = () => window.alertThumbnailGenerator.showAlertPreview();

console.log('✅ Alert Thumbnail Generator loaded');
console.log('   Use previewAlertThumbnail() to see the Alert NFT preview');