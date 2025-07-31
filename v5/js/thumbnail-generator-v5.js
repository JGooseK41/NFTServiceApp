// Enhanced thumbnail generator with clear instructions for recipients
// Creates sealed/confidential preview images with acceptance instructions

const ThumbnailGenerator = {
    // Generate thumbnail with confidential overlay and instructions
    async generateSealedThumbnail(documentData, documentType) {
        try {
            // Create canvas for thumbnail
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set thumbnail dimensions (OpenSea recommends 350x350 minimum)
            canvas.width = 400;
            canvas.height = 400;
            
            // Fill background
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (documentType === 'image' && documentData.startsWith('data:image')) {
                // For image documents, create blurred background
                await this.drawBlurredImage(ctx, documentData, canvas.width, canvas.height);
            } else {
                // For PDFs and text, create document icon
                this.drawDocumentIcon(ctx, canvas.width, canvas.height);
            }
            
            // Add confidential overlay with instructions
            this.addConfidentialOverlay(ctx, canvas.width, canvas.height);
            
            // Convert to data URL
            return canvas.toDataURL('image/png');
            
        } catch (error) {
            console.error('Error generating thumbnail:', error);
            // Return default sealed document image
            return this.generateDefaultSealedImage();
        }
    },
    
    // Draw blurred document preview
    async drawBlurredImage(ctx, imageData, width, height) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // Save context state
                ctx.save();
                
                // Draw blurred version
                ctx.filter = 'blur(15px) brightness(0.3)';
                
                // Calculate scaling to cover canvas
                const scale = Math.max(width / img.width, height / img.height);
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                const x = (width - scaledWidth) / 2;
                const y = (height - scaledHeight) / 2;
                
                ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
                
                // Restore context
                ctx.restore();
                resolve();
            };
            img.src = imageData;
        });
    },
    
    // Draw document icon for PDFs
    drawDocumentIcon(ctx, width, height) {
        const iconSize = width * 0.4;
        const x = (width - iconSize) / 2;
        const y = (height - iconSize) / 2;
        
        // Draw document shape
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x, y, iconSize * 0.7, iconSize);
        
        // Draw folded corner
        ctx.beginPath();
        ctx.moveTo(x + iconSize * 0.7, y);
        ctx.lineTo(x + iconSize * 0.7, y + iconSize * 0.2);
        ctx.lineTo(x + iconSize * 0.5, y + iconSize * 0.2);
        ctx.closePath();
        ctx.fillStyle = '#3a3a3a';
        ctx.fill();
        
        // Add document lines
        ctx.strokeStyle = '#4a4a4a';
        ctx.lineWidth = 2;
        const lineY = y + iconSize * 0.4;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(x + 20, lineY + i * 20);
            ctx.lineTo(x + iconSize * 0.5, lineY + i * 20);
            ctx.stroke();
        }
    },
    
    // Add confidential overlay with clear instructions
    addConfidentialOverlay(ctx, width, height) {
        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, width, height);
        
        // Add red seal/stamp effect
        const centerX = width / 2;
        const centerY = height / 2 - 20; // Move up to make room for instructions
        const radius = Math.min(width, height) * 0.3;
        
        // Outer red circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 8;
        ctx.stroke();
        
        // Inner red circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 15, 0, Math.PI * 2);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // "SEALED" text in center
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = '#dc2626';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SEALED', centerX, centerY - 15);
        
        // "LEGAL NOTICE" text
        ctx.font = 'bold 16px Arial';
        ctx.fillText('LEGAL NOTICE', centerX, centerY + 15);
        
        // Top banner
        ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
        ctx.fillRect(0, 0, width, 40);
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText('ACTION REQUIRED', centerX, 20);
        
        // Bottom instruction area with step-by-step guide
        ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
        ctx.fillRect(0, height - 100, width, 100);
        
        // Instructions
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText('TO VIEW DOCUMENT:', centerX, height - 80);
        
        ctx.font = '11px Arial';
        ctx.fillText('1. Click "View on Website" link', centerX, height - 60);
        ctx.fillText('2. Connect this wallet', centerX, height - 45);
        ctx.fillText('3. Click "Accept Notice" to sign', centerX, height - 30);
        ctx.fillText('⚠️ Signature = Receipt Only', centerX, height - 15);
        
        // Add lock icon
        this.drawLockIcon(ctx, centerX, centerY + 50);
    },
    
    // Draw lock icon
    drawLockIcon(ctx, x, y) {
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3;
        
        // Lock body
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(x - 15, y, 30, 25);
        
        // Lock shackle
        ctx.beginPath();
        ctx.arc(x, y - 5, 12, Math.PI, 0, false);
        ctx.stroke();
    },
    
    // Generate default sealed image if thumbnail generation fails
    generateDefaultSealedImage() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 400;
        canvas.height = 400;
        
        // Dark background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add overlay with instructions
        this.addConfidentialOverlay(ctx, canvas.width, canvas.height);
        
        return canvas.toDataURL('image/png');
    },
    
    // Generate metadata JSON with enhanced description
    generateNFTMetadata(noticeId, thumbnailIPFSHash, noticeDetails) {
        // Use HTTPS gateway for better wallet compatibility
        const imageUrl = `https://gateway.pinata.cloud/ipfs/${thumbnailIPFSHash}`;
        const websiteUrl = `https://nftserviceapp.netlify.app/#notice-${noticeId}`;
        
        const metadata = {
            name: `Legal Notice #${noticeId}`,
            description: "⚖️ OFFICIAL LEGAL NOTICE - ACTION REQUIRED ⚖️\n\n" +
                        "This NFT contains a sealed legal document requiring your immediate attention.\n\n" +
                        "📋 TO ACCESS YOUR DOCUMENT:\n" +
                        "1. Click 'View on Website' below (or visit: " + websiteUrl + ")\n" +
                        "2. Connect this wallet to the website\n" +
                        "3. Click 'Accept Notice' and sign the transaction\n" +
                        "4. The document will decrypt and display\n\n" +
                        "⚠️ IMPORTANT:\n" +
                        "• Your signature confirms RECEIPT ONLY (not agreement)\n" +
                        "• This is equivalent to signing for certified mail\n" +
                        "• Failure to respond by the deadline may result in DEFAULT JUDGMENT\n" +
                        "• You received 2 TRX to cover transaction fees\n\n" +
                        "🔒 Your document remains encrypted until you sign for it.",
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