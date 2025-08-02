// Enhanced thumbnail generator with document preview and instruction banner
// Creates document thumbnails with clear acceptance instructions

const ThumbnailGenerator = {
    // Generate thumbnail with document preview and instruction banner
    async generateSealedThumbnail(documentData, documentType, documentPreview) {
        try {
            console.log('ThumbnailGenerator.generateSealedThumbnail called with:', {
                hasDocumentData: !!documentData,
                documentDataType: typeof documentData === 'string' ? documentData.substring(0, 30) : typeof documentData,
                hasDocumentPreview: !!documentPreview,
                documentPreviewType: typeof documentPreview === 'string' ? documentPreview.substring(0, 30) : typeof documentPreview,
                documentType
            });
            
            // Create canvas for thumbnail
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set thumbnail dimensions (OpenSea recommends 350x350 minimum)
            canvas.width = 400;
            canvas.height = 400;
            
            // Fill background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Check if we have a valid image to use
            let imageToUse = null;
            
            // Handle preview first (it's usually the best option)
            if (documentPreview) {
                if (typeof documentPreview === 'string' && documentPreview.startsWith('data:image')) {
                    console.log('Using document preview image');
                    imageToUse = documentPreview;
                } else if (documentPreview.data && typeof documentPreview.data === 'string' && documentPreview.data.startsWith('data:image')) {
                    console.log('Using document preview.data image');
                    imageToUse = documentPreview.data;
                }
            }
            
            // If no preview, try document data
            if (!imageToUse && documentData) {
                if (typeof documentData === 'string' && documentData.startsWith('data:image')) {
                    console.log('Using document data image');
                    imageToUse = documentData;
                } else if (documentData.data && typeof documentData.data === 'string' && documentData.data.startsWith('data:image')) {
                    console.log('Using document data.data image');
                    imageToUse = documentData.data;
                }
            }
            
            if (imageToUse) {
                // For image documents, show actual document as thumbnail
                await this.drawDocumentThumbnail(ctx, imageToUse, canvas.width, canvas.height);
            } else {
                // For other cases, create generic document preview
                console.log('No valid image found, using generic preview');
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
        const gradient = ctx.createLinearGradient(0, 0, 0, 50);
        gradient.addColorStop(0, '#dc2626');
        gradient.addColorStop(1, '#b91c1c');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, 50);
        
        // Banner text - two lines for clarity
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('🔒 DOCUMENT PREVIEW ONLY', width/2, 18);
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Visit URL Below for Full Document', width/2, 36);
        
        // Add bottom instruction bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, height - 40, width, 40);
        
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('See Description for Access Instructions ↓', width/2, height - 20);
        
        // Add subtle watermark
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = '#dc2626';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(width/2, height/2);
        ctx.rotate(-Math.PI / 8);
        ctx.fillText('PREVIEW', 0, 0);
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
            description: `📄 OFFICIAL DOCUMENT REQUIRING YOUR SIGNATURE 📄\n\n` +
                        `Document Type: ${noticeDetails.noticeType || 'Legal Document'}\n` +
                        `Case #: ${noticeDetails.caseNumber || 'Pending'}\n` +
                        `From: ${noticeDetails.issuingAgency || 'Legal Department'}\n` +
                        `Date: ${noticeDetails.dateIssued || new Date().toLocaleDateString()}\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `🔓 HOW TO ACCESS FULL DOCUMENT:\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                        `🌐 CLICK HERE TO ACCEPT:\n` +
                        `${shortUrl}\n\n` +
                        `If link doesn't work, copy this URL:\n` +
                        `👉 ${shortUrl} 👈\n\n` +
                        `STEP 2: Connect this wallet when prompted\n\n` +
                        `STEP 3: Click "Accept & Download"\n\n` +
                        `STEP 4: Your document will decrypt automatically\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `❓ WHAT YOU'RE SEEING:\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                        `The image above shows a PREVIEW of your document.\n` +
                        `The full document is encrypted for your privacy.\n` +
                        `Only you can decrypt it with your wallet signature.\n\n` +
                        `This is like signing for certified mail:\n` +
                        `• ✅ Proves you received the document\n` +
                        `• ✅ Creates a legal record of delivery\n` +
                        `• ✅ Does NOT mean you agree with contents\n` +
                        `• ✅ Protects your privacy with encryption\n\n` +
                        `⚠️ IMPORTANT: Not responding to legal notices\n` +
                        `may have consequences. We recommend viewing\n` +
                        `the document to understand any deadlines.\n\n` +
                        `💡 FREE TO ACCEPT: The sender included 2 TRX\n` +
                        `to cover your transaction fees.\n\n` +
                        `📧 Questions? support@blockserved.com\n` +
                        `🔗 Direct Access: ${shortUrl}`,
            image: imageUrl,
            external_url: shortUrl, // Use short URL for better display
            animation_url: shortUrl, // Some wallets show this as clickable
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
                },
                {
                    trait_type: "Accept Notice URL",
                    value: shortUrl
                }
            ],
            properties: {
                category: "legal_document",
                website: shortUrl,
                accept_notice_url: shortUrl,
                files: [{
                    uri: shortUrl,
                    type: "text/html",
                    name: "Accept Notice"
                }],
                links: {
                    accept: shortUrl,
                    website: websiteUrl
                }
            }
        };
        
        return metadata;
    },
    
    // Process document and generate all required assets
    async processDocumentForNFT(documentData, noticeDetails, noticeId) {
        try {
            console.log('Generating document preview thumbnail with instructions...');
            
            // Determine document type and preview
            let documentType = 'document';
            let documentPreview = null;
            
            // First check if we have a preview from document conversion
            if (window.uploadedImage && window.uploadedImage.preview) {
                console.log('Using preview from uploadedImage');
                documentPreview = window.uploadedImage.preview;
            }
            
            // Handle document data that might be an object
            let dataToCheck = documentData;
            if (documentData && typeof documentData === 'object' && documentData.data) {
                dataToCheck = documentData.data;
            }
            
            if (dataToCheck && typeof dataToCheck === 'string' && dataToCheck.startsWith('data:image')) {
                documentType = 'image';
                // If no preview, use the image itself
                if (!documentPreview) {
                    documentPreview = dataToCheck;
                }
            } else if (dataToCheck && typeof dataToCheck === 'string' && dataToCheck.startsWith('data:application/pdf')) {
                documentType = 'pdf';
            }
            
            // Generate sealed thumbnail with instructions
            const thumbnailData = await this.generateSealedThumbnail(
                documentData || '', 
                documentType,
                documentPreview
            );
            
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