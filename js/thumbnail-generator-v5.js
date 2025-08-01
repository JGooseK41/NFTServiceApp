// Enhanced thumbnail generator with document preview and instruction banner
// Creates document thumbnails with clear acceptance instructions

const ThumbnailGenerator = {
    // Generate thumbnail with document preview and instruction banner
    async generateSealedThumbnail(documentData, documentType) {
        try {
            // Create canvas for thumbnail
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set thumbnail dimensions (OpenSea recommends 350x350 minimum)
            canvas.width = 400;
            canvas.height = 400;
            
            // Fill background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (documentType === 'image' && documentData.startsWith('data:image')) {
                // For image documents, show actual document as thumbnail
                await this.drawDocumentThumbnail(ctx, documentData, canvas.width, canvas.height);
            } else {
                // For PDFs and text, create document preview
                this.drawDocumentPreview(ctx, canvas.width, canvas.height);
            }
            
            // Add instruction banner overlay
            this.addInstructionBanner(ctx, canvas.width, canvas.height);
            
            // Convert to data URL
            return canvas.toDataURL('image/png');
            
        } catch (error) {
            console.error('Error generating thumbnail:', error);
            // Return default sealed document image
            return this.generateDefaultSealedImage();
        }
    },
    
    // Draw document as thumbnail (no blur)
    async drawDocumentThumbnail(ctx, imageData, width, height) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // Save context state
                ctx.save();
                
                // Calculate scaling to fit within canvas with padding
                const padding = 50; // Leave room for banner
                const availableHeight = height - padding;
                const scale = Math.min((width - 20) / img.width, availableHeight / img.height);
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                const x = (width - scaledWidth) / 2;
                const y = padding + (availableHeight - scaledHeight) / 2;
                
                // Add slight shadow for document effect
                ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
                
                // Draw white background for document
                ctx.fillStyle = 'white';
                ctx.fillRect(x - 5, y - 5, scaledWidth + 10, scaledHeight + 10);
                
                // Draw document
                ctx.shadowColor = 'transparent';
                ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
                
                // Restore context
                ctx.restore();
                resolve();
            };
            img.src = imageData;
        });
    },
    
    // Draw document preview for PDFs
    drawDocumentPreview(ctx, width, height) {
        const padding = 50; // Leave room for banner
        const docWidth = width * 0.7;
        const docHeight = height * 0.7;
        const x = (width - docWidth) / 2;
        const y = padding + ((height - padding) - docHeight) / 2;
        
        // Add shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Draw document background
        ctx.fillStyle = 'white';
        ctx.fillRect(x, y, docWidth, docHeight);
        
        // Draw folded corner
        ctx.beginPath();
        ctx.moveTo(x + docWidth - 30, y);
        ctx.lineTo(x + docWidth, y + 30);
        ctx.lineTo(x + docWidth - 30, y + 30);
        ctx.closePath();
        ctx.fillStyle = '#f0f0f0';
        ctx.fill();
        
        ctx.shadowColor = 'transparent';
        
        // Add "LEGAL DOCUMENT" header
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, y, docWidth, 40);
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('LEGAL DOCUMENT', x + docWidth/2, y + 25);
        
        // Add document lines
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        const lineY = y + 60;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(x + 20, lineY + i * 25);
            ctx.lineTo(x + docWidth - 20, lineY + i * 25);
            ctx.stroke();
        }
        
        // Add "PDF" text
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#dc2626';
        ctx.textAlign = 'center';
        ctx.fillText('PDF', x + docWidth/2, y + docHeight/2);
    },
    
    // Add instruction banner overlay
    addInstructionBanner(ctx, width, height) {
        // Top banner with gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 45);
        gradient.addColorStop(0, '#dc2626');
        gradient.addColorStop(1, '#b91c1c');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, 45);
        
        // Banner text
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔒 CLICK TO ACCEPT & DOWNLOAD', width/2, 23);
        
        // Add subtle watermark
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#dc2626';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(width/2, height/2 + 30);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText('LEGAL NOTICE', 0, 0);
        ctx.restore();
    },
    
    // Generate default sealed image if thumbnail generation fails
    generateDefaultSealedImage() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 400;
        canvas.height = 400;
        
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw default document preview
        this.drawDocumentPreview(ctx, canvas.width, canvas.height);
        
        // Add instruction banner
        this.addInstructionBanner(ctx, canvas.width, canvas.height);
        
        return canvas.toDataURL('image/png');
    },
    
    // Generate metadata JSON with enhanced description
    generateNFTMetadata(noticeId, thumbnailIPFSHash, noticeDetails) {
        // Use HTTPS gateway for better wallet compatibility
        const imageUrl = `https://gateway.pinata.cloud/ipfs/${thumbnailIPFSHash}`;
        
        // Determine the domain based on environment
        const domain = window.location.hostname === 'localhost' 
            ? 'https://nftserviceapp.netlify.app' 
            : window.location.hostname === 'theblockservice.com'
            ? 'https://blockserved.com'
            : 'https://nftserviceapp.netlify.app';
            
        // Create short URL format
        const shortUrl = `${domain}/n/${noticeId}`;
        const websiteUrl = `${domain}/#notice-${noticeId}`;
        
        const metadata = {
            name: `Legal Notice #${noticeId}`,
            description: `⚖️ OFFICIAL LEGAL NOTICE - ${noticeDetails.noticeType || 'Legal Document'} ⚖️

` +
                        `Case #: ${noticeDetails.caseNumber || 'Pending'}\n` +
                        `Issued: ${noticeDetails.dateIssued || new Date().toLocaleDateString()}\n` +
                        `Agency: ${noticeDetails.issuingAgency || 'Legal Department'}\n\n` +
                        `⚠️ IMMEDIATE ACTION REQUIRED ⚠️\n` +
                        `This NFT represents an official legal notice requiring your acknowledgment.\n\n` +
                        `📋 TO VIEW & ACCEPT YOUR DOCUMENT:\n` +
                        `1. Visit: ${shortUrl}\n` +
                        `2. Connect this wallet to verify ownership\n` +
                        `3. Click "Accept Notice" to acknowledge receipt\n` +
                        `4. Download the complete document\n\n` +
                        `✅ WHAT YOUR SIGNATURE MEANS:\n` +
                        `• Confirms receipt only (NOT agreement with contents)\n` +
                        `• Equivalent to signing for certified mail\n` +
                        `• Creates timestamped proof of service\n` +
                        `• Unlocks the document for viewing\n\n` +
                        `⚠️ IMPORTANT LEGAL INFORMATION:\n` +
                        `• Failure to respond may result in DEFAULT JUDGMENT\n` +
                        `• You received 2 TRX to cover transaction fees\n` +
                        `• Keep this NFT as permanent proof of service\n` +
                        `• Document remains encrypted until accepted\n\n` +
                        `📧 Support: support@blockserved.com\n` +
                        `🔗 Direct Link: ${shortUrl}`,
            image: imageUrl,
            external_url: websiteUrl,
            attributes: [
                {
                    trait_type: "Status",
                    value: "Sealed - Signature Required"
                },
                {
                    trait_type: "Type",
                    value: noticeDetails.noticeType || "Legal Notice"
                },
                {
                    trait_type: "Case Number",
                    value: noticeDetails.caseNumber || "Confidential"
                },
                {
                    trait_type: "Issuing Agency",
                    value: noticeDetails.issuingAgency || "Law Enforcement"
                },
                {
                    trait_type: "Date Issued",
                    value: new Date().toISOString().split('T')[0]
                },
                {
                    trait_type: "Action Required",
                    value: "Sign to View Document"
                },
                {
                    trait_type: "Fee Sponsored",
                    value: "Yes (2 TRX included)"
                }
            ],
            properties: {
                category: "legal_document",
                files: [{
                    uri: websiteUrl,
                    type: "text/html"
                }]
            }
        };
        
        return metadata;
    },
    
    // Process document and generate all required assets
    async processDocumentForNFT(documentData, noticeDetails, noticeId) {
        try {
            console.log('Generating sealed thumbnail with instructions...');
            
            // Determine document type
            let documentType = 'document';
            if (documentData && documentData.startsWith('data:image')) {
                documentType = 'image';
            } else if (documentData && documentData.startsWith('data:application/pdf')) {
                documentType = 'pdf';
            }
            
            // Generate sealed thumbnail with instructions
            const thumbnailData = await this.generateSealedThumbnail(documentData || '', documentType);
            
            // Upload thumbnail to IPFS
            console.log('Uploading thumbnail to IPFS...');
            const thumbnailHash = await SimpleEncryption.uploadToIPFS(thumbnailData);
            
            // Generate metadata with detailed instructions
            const metadata = this.generateNFTMetadata(noticeId, thumbnailHash, noticeDetails);
            
            // Upload metadata to IPFS
            console.log('Uploading metadata to IPFS...');
            const metadataHash = await SimpleEncryption.uploadToIPFS(JSON.stringify(metadata));
            
            return {
                thumbnailHash,
                metadataHash,
                metadataURI: `ipfs://${metadataHash}`,
                success: true
            };
            
        } catch (error) {
            console.error('Error processing document for NFT:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};

// Export for use
window.ThumbnailGenerator = ThumbnailGenerator;