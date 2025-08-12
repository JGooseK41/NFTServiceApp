/**
 * Unified Document Storage Routes
 * Uses notice_components table as the single source of truth for documents
 * This provides proper architecture for scalable document management
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Ensure notice_components table has document storage columns
 */
async function ensureTableStructure() {
    try {
        const alterQueries = [
            `ALTER TABLE notice_components ADD COLUMN IF NOT EXISTS alert_thumbnail_data TEXT`,
            `ALTER TABLE notice_components ADD COLUMN IF NOT EXISTS alert_thumbnail_mime_type VARCHAR(100)`,
            `ALTER TABLE notice_components ADD COLUMN IF NOT EXISTS document_data TEXT`,
            `ALTER TABLE notice_components ADD COLUMN IF NOT EXISTS document_mime_type VARCHAR(100)`,
            `ALTER TABLE notice_components ADD COLUMN IF NOT EXISTS documents_stored_at TIMESTAMP`,
            `ALTER TABLE notice_components ADD COLUMN IF NOT EXISTS storage_source VARCHAR(50)`
        ];
        
        for (const query of alterQueries) {
            try {
                await pool.query(query);
            } catch (error) {
                // Ignore if column already exists
                if (error.code !== '42701') {
                    console.error('Error adding column:', error.message);
                }
            }
        }
    } catch (error) {
        console.error('Error ensuring table structure:', error);
    }
}

// Ensure table structure on startup
ensureTableStructure();

/**
 * Upload documents for a notice
 * This is called during notice creation to store documents
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
            
            console.log(`Storing documents for notice ${noticeId}...`);
            
            // Check if notice_components entry exists
            let componentEntry = await pool.query(
                'SELECT notice_id FROM notice_components WHERE notice_id = $1',
                [noticeId]
            );
            
            // Create entry if it doesn't exist
            if (componentEntry.rows.length === 0) {
                await pool.query(`
                    INSERT INTO notice_components (
                        notice_id, 
                        server_address,
                        recipient_address,
                        case_number,
                        created_at
                    ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                `, [noticeId, serverAddress, recipientAddress, caseNumber]);
                
                console.log(`Created notice_components entry for ${noticeId}`);
            }
            
            const updates = [];
            const values = [];
            let paramCount = 1;
            
            // Process thumbnail
            if (req.files['thumbnail']) {
                const thumbnailFile = req.files['thumbnail'][0];
                const base64Data = thumbnailFile.buffer.toString('base64');
                
                updates.push(`alert_thumbnail_data = $${paramCount++}`);
                updates.push(`alert_thumbnail_mime_type = $${paramCount++}`);
                values.push(base64Data, thumbnailFile.mimetype);
                
                console.log(`Processing thumbnail (${thumbnailFile.buffer.length} bytes)`);
            }
            
            // Process document
            const documentFile = req.files['unencryptedDocument']?.[0] || req.files['document']?.[0];
            if (documentFile) {
                const base64Data = documentFile.buffer.toString('base64');
                
                updates.push(`document_data = $${paramCount++}`);
                updates.push(`document_mime_type = $${paramCount++}`);
                values.push(base64Data, documentFile.mimetype);
                
                console.log(`Processing document (${documentFile.buffer.length} bytes)`);
            }
            
            // Add metadata
            updates.push(`documents_stored_at = CURRENT_TIMESTAMP`);
            updates.push(`storage_source = 'upload'`);
            
            // Update the notice_components entry
            if (updates.length > 0) {
                values.push(noticeId);
                const updateQuery = `
                    UPDATE notice_components 
                    SET ${updates.join(', ')}
                    WHERE notice_id = $${paramCount}
                `;
                
                await pool.query(updateQuery, values);
                console.log(`✅ Stored documents for notice ${noticeId}`);
            }
            
            res.json({
                success: true,
                message: 'Documents stored successfully',
                noticeId
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
 * This is the main endpoint the frontend uses to display documents
 */
router.get('/:noticeId/images', async (req, res) => {
    try {
        const { noticeId } = req.params;
        
        console.log(`Retrieving images for notice ${noticeId}...`);
        
        // Query notice_components for documents
        // Explicitly select only the base64 data columns, not the old URL columns
        const query = `
            SELECT 
                alert_thumbnail_data,
                alert_thumbnail_mime_type,
                document_data,
                document_mime_type,
                storage_source,
                alert_thumbnail_url,
                document_unencrypted_url
            FROM notice_components
            WHERE notice_id = $1
        `;
        
        const result = await pool.query(query, [noticeId]);
        
        if (result.rows.length === 0) {
            // Fallback: Check document_storage table (for backwards compatibility)
            const fallbackQuery = `
                SELECT 
                    file_data,
                    mime_type,
                    document_type
                FROM document_storage
                WHERE notice_id = $1
            `;
            
            const fallbackResult = await pool.query(fallbackQuery, [noticeId]);
            
            if (fallbackResult.rows.length > 0) {
                console.log(`Found documents in document_storage (legacy)`);
                
                const response = {
                    noticeId,
                    alertThumbnailUrl: null,
                    documentUnencryptedUrl: null
                };
                
                fallbackResult.rows.forEach(row => {
                    const dataUrl = `data:${row.mime_type};base64,${row.file_data}`;
                    if (row.document_type === 'thumbnail') {
                        response.alertThumbnailUrl = dataUrl;
                    } else if (row.document_type === 'document') {
                        response.documentUnencryptedUrl = dataUrl;
                    }
                });
                
                return res.json(response);
            }
            
            console.log(`No documents found for notice ${noticeId}`);
            return res.status(404).json({
                error: 'No documents found for this notice'
            });
        }
        
        const data = result.rows[0];
        const response = {
            noticeId,
            alertThumbnailUrl: null,
            documentUnencryptedUrl: null
        };
        
        // IMPORTANT: Prioritize base64 data over old file URLs
        // The old URLs point to temporary storage that no longer exists
        
        // Convert to data URLs - always use base64 data if available
        if (data.alert_thumbnail_data) {
            response.alertThumbnailUrl = `data:${data.alert_thumbnail_mime_type || 'image/png'};base64,${data.alert_thumbnail_data}`;
            console.log(`✅ Found thumbnail data (base64, source: ${data.storage_source})`);
        } else if (data.alert_thumbnail_url) {
            // Log warning about legacy URL
            console.log(`⚠️ Notice ${noticeId} has legacy thumbnail URL but no base64 data: ${data.alert_thumbnail_url}`);
            console.log('This file no longer exists in temporary storage. Need to recover from IPFS or re-upload.');
            // Don't return the broken URL
        }
        
        if (data.document_data) {
            response.documentUnencryptedUrl = `data:${data.document_mime_type || 'image/png'};base64,${data.document_data}`;
            console.log(`✅ Found document data (base64, source: ${data.storage_source})`);
        } else if (data.document_unencrypted_url) {
            // Log warning about legacy URL
            console.log(`⚠️ Notice ${noticeId} has legacy document URL but no base64 data: ${data.document_unencrypted_url}`);
            console.log('This file no longer exists in temporary storage. Need to recover from IPFS or re-upload.');
            // Don't return the broken URL
        }
        
        // If we have legacy URLs but no base64 data, log it
        if (!data.alert_thumbnail_data && !data.document_data) {
            console.log(`❌ Notice ${noticeId} has no base64 image data available`);
            if (data.alert_thumbnail_url || data.document_unencrypted_url) {
                console.log('Legacy file URLs exist but files are gone from temporary storage');
            }
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
 * Get receipt data for a notice (includes documents)
 */
router.get('/notice/:noticeId/receipt-data', async (req, res) => {
    try {
        const { noticeId } = req.params;
        const { serverAddress } = req.query;
        
        const query = `
            SELECT 
                nc.*,
                sn.case_number,
                sn.created_at,
                sn.ipfs_hash,
                sn.transaction_hash
            FROM notice_components nc
            LEFT JOIN served_notices sn ON sn.notice_id = nc.notice_id
            WHERE nc.notice_id = $1
        `;
        
        const result = await pool.query(query, [noticeId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Notice not found'
            });
        }
        
        const notice = result.rows[0];
        
        // Build response with document URLs
        const response = {
            notice: {
                ...notice,
                alert_thumbnail_full_url: notice.alert_thumbnail_data ? 
                    `data:${notice.alert_thumbnail_mime_type || 'image/png'};base64,${notice.alert_thumbnail_data}` : null,
                document_unencrypted_full_url: notice.document_data ?
                    `data:${notice.document_mime_type || 'image/png'};base64,${notice.document_data}` : null
            }
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('Error getting receipt data:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

/**
 * Get all cases for a server (with document counts)
 */
router.get('/server/:serverAddress/cases', async (req, res) => {
    try {
        const { serverAddress } = req.params;
        
        const query = `
            SELECT 
                sn.case_number,
                sn.created_at,
                COUNT(DISTINCT sn.notice_id) as notice_count,
                COUNT(DISTINCT CASE WHEN nc.alert_thumbnail_data IS NOT NULL THEN nc.notice_id END) as with_thumbnails,
                COUNT(DISTINCT CASE WHEN nc.document_data IS NOT NULL THEN nc.notice_id END) as with_documents
            FROM served_notices sn
            LEFT JOIN notice_components nc ON nc.notice_id = sn.notice_id
            WHERE sn.server_address = $1
            GROUP BY sn.case_number, sn.created_at
            ORDER BY sn.created_at DESC
        `;
        
        const result = await pool.query(query, [serverAddress]);
        
        res.json({
            cases: result.rows,
            total: result.rows.length
        });
        
    } catch (error) {
        console.error('Error getting cases:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_notices,
                COUNT(alert_thumbnail_data) as with_thumbnails,
                COUNT(document_data) as with_documents
            FROM notice_components
        `);
        
        res.json({
            status: 'healthy',
            storage: 'notice_components',
            stats: stats.rows[0]
        });
        
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

module.exports = router;