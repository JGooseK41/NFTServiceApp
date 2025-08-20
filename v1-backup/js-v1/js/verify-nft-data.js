/**
 * Verify NFT Data System
 * Ensures NFT creation has all required document data
 */

(function() {
    console.log('🔍 Loading NFT data verification system...');
    
    // Hook into the serve notice function to verify data
    const originalServeNotice = window.serveNotice;
    
    window.serveNotice = async function(
        recipient,
        encryptedIPFS,
        encryptionKey,
        issuingAgency,
        noticeType,
        caseNumber,
        caseDetails,
        legalRights,
        sponsorFees,
        metadataURI
    ) {
        console.log('🎯 Verifying NFT data before creation...');
        
        // Verify we have document data
        const hasDocuments = window.uploadedDocumentsList && window.uploadedDocumentsList.length > 0;
        
        if (!hasDocuments) {
            console.warn('⚠️ No documents uploaded for NFT creation');
            
            // Check if we should block or allow text-only notices
            const isTextOnly = !encryptedIPFS || encryptedIPFS === '';
            if (!isTextOnly) {
                console.error('❌ Document NFT requires uploaded documents');
                if (window.uiManager?.showNotification) {
                    window.uiManager.showNotification('error', 'Please upload documents before creating NFT');
                }
                return null;
            }
        }
        
        // Verify document data integrity
        if (hasDocuments) {
            console.log(`📋 Verifying ${window.uploadedDocumentsList.length} documents...`);
            
            for (const doc of window.uploadedDocumentsList) {
                const validation = validateDocumentData(doc);
                if (!validation.valid) {
                    console.warn(`⚠️ Document validation failed: ${doc.fileName}`, validation.issues);
                    
                    // Try to fix common issues
                    if (validation.fixable) {
                        console.log('🔧 Attempting to fix document data...');
                        await fixDocumentData(doc);
                    }
                }
            }
        }
        
        // Ensure IPFS data if documents exist
        if (hasDocuments && (!encryptedIPFS || encryptedIPFS === '')) {
            console.log('📦 Preparing document data for IPFS...');
            
            try {
                // Get the primary document
                const primaryDoc = window.uploadedDocumentsList[0];
                
                // Prepare for IPFS upload
                if (window.SimpleEncryption) {
                    const encrypted = await window.SimpleEncryption.encryptDocument(
                        primaryDoc.data || primaryDoc.fullDocument || primaryDoc.preview
                    );
                    
                    // Update the arguments
                    encryptedIPFS = encrypted.encryptedData;
                    encryptionKey = encrypted.key;
                    
                    console.log('✅ Document encrypted for IPFS storage');
                }
            } catch (error) {
                console.error('Failed to prepare document for IPFS:', error);
            }
        }
        
        // Log the final data being sent
        console.log('📊 NFT Creation Data:', {
            recipient,
            hasIPFS: !!encryptedIPFS,
            hasKey: !!encryptionKey,
            issuingAgency,
            noticeType,
            caseNumber,
            hasMetadata: !!metadataURI,
            documentCount: window.uploadedDocumentsList?.length || 0
        });
        
        // Call original function with potentially updated data
        if (originalServeNotice) {
            return await originalServeNotice.call(
                this,
                recipient,
                encryptedIPFS,
                encryptionKey,
                issuingAgency,
                noticeType,
                caseNumber,
                caseDetails,
                legalRights,
                sponsorFees,
                metadataURI
            );
        }
    };
    
    /**
     * Validate document data structure
     */
    function validateDocumentData(doc) {
        const issues = [];
        let fixable = false;
        
        // Check required fields
        if (!doc.fileName) {
            issues.push('Missing fileName');
        }
        
        if (!doc.data && !doc.fullDocument && !doc.preview) {
            issues.push('No document data (data, fullDocument, or preview)');
        }
        
        if (!doc.fileType) {
            issues.push('Missing fileType');
            fixable = true; // Can infer from fileName
        }
        
        if (!doc.preview && (doc.data || doc.fullDocument)) {
            issues.push('Missing preview');
            fixable = true; // Can generate from data
        }
        
        return {
            valid: issues.length === 0,
            issues,
            fixable
        };
    }
    
    /**
     * Fix common document data issues
     */
    async function fixDocumentData(doc) {
        // Fix missing fileType
        if (!doc.fileType && doc.fileName) {
            const ext = doc.fileName.split('.').pop().toLowerCase();
            const typeMap = {
                'pdf': 'application/pdf',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'doc': 'application/msword',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            };
            doc.fileType = typeMap[ext] || 'application/octet-stream';
            console.log(`✅ Fixed fileType: ${doc.fileType}`);
        }
        
        // Fix missing preview
        if (!doc.preview && (doc.data || doc.fullDocument)) {
            const sourceData = doc.data || doc.fullDocument;
            
            // If it's already an image, use it as preview
            if (doc.fileType?.startsWith('image/')) {
                doc.preview = sourceData;
                console.log('✅ Used image data as preview');
            } else {
                // Generate a placeholder preview
                doc.preview = await generatePlaceholderPreview(doc.fileName, doc.fileType);
                console.log('✅ Generated placeholder preview');
            }
        }
        
        // Ensure we have a primary data field
        if (!doc.data && doc.fullDocument) {
            doc.data = doc.fullDocument;
            console.log('✅ Copied fullDocument to data field');
        }
        
        // Add timestamp if missing
        if (!doc.timestamp) {
            doc.timestamp = Date.now();
            console.log('✅ Added timestamp');
        }
        
        // Mark as verified
        doc.dataVerified = true;
    }
    
    /**
     * Generate a placeholder preview for documents
     */
    async function generatePlaceholderPreview(fileName, fileType) {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(0, 0, 400, 600);
        
        // Border
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 398, 598);
        
        // Icon based on file type
        ctx.font = '64px Arial';
        ctx.textAlign = 'center';
        const icon = fileType?.includes('pdf') ? '📄' : '📋';
        ctx.fillText(icon, 200, 200);
        
        // File name
        ctx.fillStyle = '#374151';
        ctx.font = '20px Arial';
        const shortName = fileName.length > 25 ? 
            fileName.substring(0, 22) + '...' : fileName;
        ctx.fillText(shortName, 200, 300);
        
        // Status
        ctx.fillStyle = '#059669';
        ctx.font = '16px Arial';
        ctx.fillText('✓ Ready for NFT', 200, 350);
        
        return canvas.toDataURL('image/jpeg', 0.8);
    }
    
    /**
     * Verify document after NFT creation
     */
    window.verifyNFTDocument = async function(alertId, documentId) {
        console.log(`🔍 Verifying NFT documents - Alert: ${alertId}, Document: ${documentId}`);
        
        const verification = {
            alertId,
            documentId,
            hasDocuments: window.uploadedDocumentsList?.length > 0,
            documentsStored: false,
            ipfsStored: false,
            metadataValid: false
        };
        
        // Check if documents were stored
        if (window.uploadedDocumentsList) {
            verification.documentsStored = window.uploadedDocumentsList.every(d => 
                d.storedToBackend || d.backendImageId
            );
        }
        
        // Check localStorage for metadata
        const storedMetadata = localStorage.getItem(`nft_metadata_${alertId}`);
        if (storedMetadata) {
            verification.metadataValid = true;
            const metadata = JSON.parse(storedMetadata);
            verification.ipfsStored = !!metadata.image || !!metadata.document;
        }
        
        console.log('📊 NFT Verification Results:', verification);
        
        return verification;
    };
    
    console.log('✅ NFT data verification system loaded');
    console.log('   - Pre-creation data validation');
    console.log('   - Automatic issue fixing');
    console.log('   - Document integrity checking');
    console.log('   - Post-creation verification');
    
})();