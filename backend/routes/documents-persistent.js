/**
 * Persistent Document Storage Routes
 * Uses PostgreSQL to store documents instead of filesystem
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { 
    storeDocument, 
    getDocument, 
    createDocumentStorageTable,
    getStorageStats 
} = require('../document-storage');

// Configure multer to store in memory instead of disk
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Ensure storage table exists on startup
(async () => {
    await createDocumentStorageTable();
})();

/**
 * Upload documents for a notice
 */
router.post('/notice/:noticeId/components', 
    upload.fields([
        { name: 'thumbnail', maxCount: 1 },
        { name: 'unencryptedDocument', maxCount: 1 },
        { name: 'document', maxCount: 1 }
    ]), 
    async (req, res) => {
        try {
            const { noticeId } = req.params;
            const { serverAddress, recipientAddress, caseNumber } = req.body;
            
            console.log(`Storing documents for notice ${noticeId} in database...`);
            
            const results = {
                noticeId,
                stored: []
            };
            
            // Store thumbnail if provided
            if (req.files['thumbnail']) {
                const thumbnailFile = req.files['thumbnail'][0];
                await storeDocument(
                    noticeId,
                    'thumbnail',
                    thumbnailFile.buffer,
                    thumbnailFile.originalname,
                    thumbnailFile.mimetype,
                    serverAddress || 'unknown'
                );
                results.stored.push('thumbnail');
                console.log(`✅ Stored thumbnail for ${noticeId} in database`);
            }
            
            // Store document if provided
            const documentFile = req.files['unencryptedDocument']?.[0] || req.files['document']?.[0];
            if (documentFile) {
                await storeDocument(
                    noticeId,
                    'document',
                    documentFile.buffer,
                    documentFile.originalname,
                    documentFile.mimetype,
                    serverAddress || 'unknown'
                );
                results.stored.push('document');
                console.log(`✅ Stored document for ${noticeId} in database`);
            }
            
            // Also update the notices table if it exists
            const pool = req.app.locals.pool;
            if (pool) {
                try {
                    await pool.query(`
                        UPDATE notices 
                        SET 
                            has_thumbnail = $1,
                            has_document = $2,
                            storage_type = 'database',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE notice_id = $3
                    `, [
                        results.stored.includes('thumbnail'),
                        results.stored.includes('document'),
                        noticeId
                    ]);
                } catch (error) {
                    console.log('Notices table update skipped:', error.message);
                }
            }
            
            res.json({
                success: true,
                message: `Stored ${results.stored.length} documents in database`,
                ...results
            });
            
        } catch (error) {
            console.error('Error storing documents:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * Retrieve document images for a notice
 */
router.get('/:noticeId/images', async (req, res) => {
    try {
        const { noticeId } = req.params;
        
        console.log(`Retrieving images for notice ${noticeId} from database...`);
        
        // Try to get documents from database
        const thumbnail = await getDocument(noticeId, 'thumbnail');
        const document = await getDocument(noticeId, 'document');
        
        const response = {
            noticeId,
            alertThumbnailUrl: null,
            documentUnencryptedUrl: null
        };
        
        // For database-stored documents, we'll return them as data URLs
        // This avoids the need for separate file serving endpoints
        if (thumbnail) {
            response.alertThumbnailUrl = `data:${thumbnail.mimeType};base64,${thumbnail.buffer.toString('base64')}`;
            console.log(`✅ Found thumbnail for ${noticeId} in database (${thumbnail.size} bytes)`);
        }
        
        if (document) {
            response.documentUnencryptedUrl = `data:${document.mimeType};base64,${document.buffer.toString('base64')}`;
            console.log(`✅ Found document for ${noticeId} in database (${document.size} bytes)`);
        }
        
        if (!thumbnail && !document) {
            console.log(`⚠️ No documents found for notice ${noticeId} in database`);
            return res.status(404).json({
                error: 'No documents found for this notice'
            });
        }
        
        res.json(response);
        
    } catch (error) {
        console.error('Error retrieving documents:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

/**
 * Serve a specific document (backward compatibility)
 */
router.get('/:noticeId/:documentType', async (req, res) => {
    try {
        const { noticeId, documentType } = req.params;
        
        const doc = await getDocument(noticeId, documentType);
        
        if (!doc) {
            return res.status(404).json({
                error: `${documentType} not found for notice ${noticeId}`
            });
        }
        
        // Set appropriate headers
        res.set({
            'Content-Type': doc.mimeType,
            'Content-Length': doc.size,
            'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
            'Content-Disposition': `inline; filename="${doc.fileName}"`
        });
        
        // Send the file buffer
        res.send(doc.buffer);
        
    } catch (error) {
        console.error('Error serving document:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

/**
 * Get storage statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await getStorageStats();
        res.json(stats);
    } catch (error) {
        console.error('Error getting storage stats:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

/**
 * Health check for document storage
 */
router.get('/health', async (req, res) => {
    try {
        const stats = await getStorageStats();
        res.json({
            status: 'healthy',
            storage: 'database',
            ...stats
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

module.exports = router;