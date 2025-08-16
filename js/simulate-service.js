/**
 * Simulate Service Process
 * Test the entire notice serving workflow without blockchain transactions
 */

window.SimulateService = {
    backend: window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com',
    
    /**
     * Simulate serving a notice with a PDF document
     */
    async simulateFullService(pdfFile, recipientAddress, caseNumber) {
        console.log('🎭 SIMULATION MODE - No blockchain transaction will be executed');
        console.log('================================================');
        
        const results = {
            steps: [],
            images: {},
            errors: []
        };
        
        try {
            // Step 1: Process PDF to images
            console.log('\n📄 Step 1: Processing PDF document...');
            results.steps.push('1. Processing PDF');
            
            const pdfImages = await this.processPDF(pdfFile);
            console.log(`✅ Converted PDF to ${pdfImages.length} page images`);
            results.images.pages = pdfImages;
            
            // Step 2: Generate Alert Thumbnail
            console.log('\n🖼️ Step 2: Generating Alert Thumbnail...');
            results.steps.push('2. Generating Alert Thumbnail');
            
            const alertThumbnail = await this.generateAlertThumbnail(caseNumber, recipientAddress);
            console.log('✅ Alert thumbnail generated');
            results.images.alertThumbnail = alertThumbnail;
            
            // Step 3: Create Document Image (combine all pages)
            console.log('\n📑 Step 3: Creating Document Image...');
            results.steps.push('3. Creating Document Image');
            
            const documentImage = await this.createDocumentImage(pdfImages);
            console.log('✅ Document image created');
            results.images.documentImage = documentImage;
            
            // Step 4: Store in database (simulation)
            console.log('\n💾 Step 4: Storing in database...');
            results.steps.push('4. Storing in database');
            
            const noticeId = 'SIM_' + Date.now();
            const stored = await this.storeImages(noticeId, {
                alertThumbnail,
                documentImage,
                recipientAddress,
                caseNumber
            });
            console.log('✅ Images stored with notice ID:', noticeId);
            results.noticeId = noticeId;
            
            // Step 5: Display preview
            console.log('\n👁️ Step 5: Displaying preview...');
            results.steps.push('5. Displaying preview');
            
            this.displayPreview(results);
            
            // Step 6: Show what would happen in real transaction
            console.log('\n🔗 Step 6: Blockchain simulation...');
            console.log('In a real transaction, this would:');
            console.log('  1. Upload encrypted document to IPFS');
            console.log('  2. Mint Alert NFT (odd ID) with thumbnail');
            console.log('  3. Mint Document NFT (even ID) with full document');
            console.log('  4. Pay gas fees (~25 TRX + energy)');
            console.log('  5. Record on TRON blockchain');
            
            console.log('\n✅ SIMULATION COMPLETE');
            console.log('================================================');
            
            return results;
            
        } catch (error) {
            console.error('❌ Simulation failed:', error);
            results.errors.push(error.message);
            return results;
        }
    },
    
    /**
     * Process PDF to images
     */
    async processPDF(pdfFile) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const pdfData = e.target.result;
                
                // Load PDF.js if not already loaded
                if (!window.pdfjsLib) {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js';
                    document.head.appendChild(script);
                    script.onload = () => {
                        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
                        this.convertPDFToImages(pdfData).then(resolve);
                    };
                } else {
                    const images = await this.convertPDFToImages(pdfData);
                    resolve(images);
                }
            };
            reader.readAsArrayBuffer(pdfFile);
        });
    },
    
    /**
     * Convert PDF to images using PDF.js
     */
    async convertPDFToImages(pdfData) {
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        const images = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            images.push(canvas.toDataURL('image/png'));
            console.log(`  Processed page ${i}/${pdf.numPages}`);
        }
        
        return images;
    },
    
    /**
     * Generate alert thumbnail
     */
    async generateAlertThumbnail(caseNumber, recipientAddress) {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, 600, 400);
        gradient.addColorStop(0, '#1e3a8a');
        gradient.addColorStop(1, '#1e293b');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 600, 400);
        
        // Add sealed document overlay
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(50, 50, 500, 300);
        
        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('⚖️ LEGAL NOTICE', 300, 100);
        
        // Case info
        ctx.font = '20px Arial';
        ctx.fillText(`Case: ${caseNumber}`, 300, 150);
        
        // Status badge
        ctx.fillStyle = '#10b981';
        ctx.fillRect(200, 180, 200, 50);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('DELIVERED', 300, 210);
        
        // Recipient
        ctx.font = '14px Arial';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('To: ' + recipientAddress.substring(0, 20) + '...', 300, 260);
        
        // Blockchain verified
        ctx.fillStyle = '#3b82f6';
        ctx.font = '16px Arial';
        ctx.fillText('🔐 Blockchain Verified - TRON Network', 300, 320);
        
        return canvas.toDataURL('image/png');
    },
    
    /**
     * Create document image (for now just use first page)
     */
    async createDocumentImage(pageImages) {
        // In reality, you'd store all pages
        // For simulation, we'll just show the first page
        return pageImages[0] || this.generatePlaceholderDocument();
    },
    
    /**
     * Generate placeholder if no PDF provided
     */
    generatePlaceholderDocument() {
        const canvas = document.createElement('canvas');
        canvas.width = 816;
        canvas.height = 1056;
        const ctx = canvas.getContext('2d');
        
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 816, 1056);
        
        // Document border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 40, 736, 976);
        
        // Header
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 32px Times New Roman';
        ctx.textAlign = 'center';
        ctx.fillText('LEGAL DOCUMENT', 408, 120);
        
        // Placeholder text
        ctx.font = '16px Times New Roman';
        ctx.fillText('[Full document would appear here]', 408, 200);
        
        return canvas.toDataURL('image/png');
    },
    
    /**
     * Store images in database
     */
    async storeImages(noticeId, data) {
        try {
            const response = await fetch(`${this.backend}/api/images`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58 || 'SIMULATION'
                },
                body: JSON.stringify({
                    notice_id: noticeId,
                    server_address: window.tronWeb?.defaultAddress?.base58 || 'SIMULATION',
                    recipient_address: data.recipientAddress,
                    alert_image: data.alertThumbnail,
                    document_image: data.documentImage,
                    alert_thumbnail: data.alertThumbnail,
                    document_thumbnail: data.documentImage.substring(0, 1000) + '...', // Truncate for thumbnail
                    case_number: data.caseNumber
                })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Storage error:', error);
            return { simulated: true };
        }
    },
    
    /**
     * Display preview modal
     */
    displayPreview(results) {
        // Remove existing modal
        const existing = document.getElementById('simulationModal');
        if (existing) existing.remove();
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'simulationModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 10px; max-width: 90%; max-height: 90%; overflow: auto;">
                <h2>📋 Service Simulation Results</h2>
                <p>Notice ID: <strong>${results.noticeId}</strong></p>
                
                <div style="display: flex; gap: 20px; margin: 20px 0;">
                    <div style="flex: 1;">
                        <h3>Alert Thumbnail</h3>
                        <img src="${results.images.alertThumbnail}" style="width: 100%; max-width: 400px; border: 2px solid #ccc;">
                    </div>
                    <div style="flex: 1;">
                        <h3>Document Preview (Page 1)</h3>
                        <img src="${results.images.documentImage}" style="width: 100%; max-width: 400px; border: 2px solid #ccc;">
                    </div>
                </div>
                
                <p>Total pages: ${results.images.pages?.length || 1}</p>
                
                <button onclick="document.getElementById('simulationModal').remove()" 
                        style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                    Close Preview
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
};

// Add UI for testing
(function() {
    // Create test button
    const button = document.createElement('button');
    button.innerHTML = '🧪 Test Service Simulation';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #8b5cf6;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        z-index: 9999;
        font-size: 16px;
    `;
    
    button.onclick = () => {
        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const recipientAddress = prompt('Enter recipient address:', 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb');
                const caseNumber = prompt('Enter case number:', 'TEST-' + Date.now());
                
                if (recipientAddress && caseNumber) {
                    await window.SimulateService.simulateFullService(file, recipientAddress, caseNumber);
                }
            }
        };
        input.click();
    };
    
    document.body.appendChild(button);
})();

console.log('✅ Service Simulation loaded - click the purple button to test');