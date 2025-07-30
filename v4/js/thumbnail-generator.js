// Thumbnail generator for legal notice documents
// Creates sealed/confidential preview images for NFT metadata

const ThumbnailGenerator = {
    // Generate thumbnail with confidential overlay
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
            
            // Add confidential overlay
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
    
    // Add confidential overlay and branding
    addConfidentialOverlay(ctx, width, height) {
        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, width, height);
        
        // Add red seal/stamp effect
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.35;
        
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
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = '#dc2626';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SEALED', centerX, centerY - 20);
        
        // "LEGAL NOTICE" text
        ctx.font = 'bold 18px Arial';
        ctx.fillText('LEGAL NOTICE', centerX, centerY + 20);
        
        // Top banner
        ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
        ctx.fillRect(0, 0, width, 50);
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText('CONFIDENTIAL', centerX, 25);
        
        // Bottom banner with call to action
        ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
        ctx.fillRect(0, height - 60, width, 60);
        ctx.font = '16px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText('Action Required', centerX, height - 35);
        ctx.font = '12px Arial';
        ctx.fillText('View in wallet to access', centerX, height - 15);
        
        // Add lock icon
        this.drawLockIcon(ctx, centerX, centerY + 60);
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
        
        // Add overlay
        this.addConfidentialOverlay(ctx, canvas.width, canvas.height);
        
        return canvas.toDataURL('image/png');
    },
    
    // Generate metadata JSON for IPFS
    generateNFTMetadata(noticeId, thumbnailIPFSHash, noticeDetails) {
        // Use HTTPS gateway for better wallet compatibility
        const imageUrl = `https://gateway.pinata.cloud/ipfs/${thumbnailIPFSHash}`;
        
        const metadata = {
            name: `Legal Notice #${noticeId}`,
            description: "SEALED LEGAL DOCUMENT - This is an official legal notice requiring your immediate attention. Visit the link to view and acknowledge receipt.",
            image: imageUrl,  // Use HTTPS URL for better wallet support
            external_url: `https://nftserviceapp.netlify.app/#notice-${noticeId}`,
            attributes: [
                {
                    trait_type: "Status",
                    value: "Sealed"
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
                    trait_type: "Requires Action",
                    value: "Yes"
                }
            ],
            properties: {
                category: "legal_document",
                files: [{
                    uri: `https://nftserviceapp.netlify.app/#notice-${noticeId}`,
                    type: "text/html"
                }]
            }
        };
        
        return metadata;
    },
    
    // Process document and generate all required assets
    async processDocumentForNFT(documentData, noticeDetails, noticeId) {
        try {
            console.log('Generating sealed thumbnail...');
            
            // Determine document type
            let documentType = 'document';
            if (documentData && documentData.startsWith('data:image')) {
                documentType = 'image';
            } else if (documentData && documentData.startsWith('data:application/pdf')) {
                documentType = 'pdf';
            }
            
            // Generate sealed thumbnail
            const thumbnailData = await this.generateSealedThumbnail(documentData || '', documentType);
            
            // For mock IPFS, create a simple base64 metadata directly
            // This ensures NFT visibility even without real IPFS
            const simpleMetadata = {
                name: `Legal Notice #${noticeId}`,
                description: "SEALED LEGAL DOCUMENT - This is an official legal notice requiring your immediate attention.",
                image: thumbnailData,  // Use base64 image directly
                attributes: [
                    {
                        trait_type: "Type",
                        value: noticeDetails.noticeType || "Legal Notice"
                    },
                    {
                        trait_type: "Case Number",  
                        value: noticeDetails.caseNumber || "Confidential"
                    }
                ]
            };
            
            // Convert metadata to base64 data URI
            const metadataBase64 = btoa(JSON.stringify(simpleMetadata));
            const metadataURI = `data:application/json;base64,${metadataBase64}`;
            
            console.log('Generated metadata URI:', metadataURI.substring(0, 100) + '...');
            
            return {
                thumbnailData,
                metadata: simpleMetadata,
                metadataURI: metadataURI,  // Use data URI instead of IPFS for immediate availability
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