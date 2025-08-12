/**
 * Notice View Tracking Routes
 * Tracks when recipients view documents without signing
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Log a view-only access (no signature)
 */
router.post('/log-view', async (req, res) => {
    try {
        const { noticeId, documentId, viewerAddress, viewType, timestamp } = req.body;
        
        // Verify the viewer is actually the recipient
        const verifyQuery = `
            SELECT recipient_address 
            FROM notice_components 
            WHERE notice_id = $1 AND document_id = $2
        `;
        
        const verification = await pool.query(verifyQuery, [noticeId, documentId]);
        
        if (verification.rows.length === 0) {
            return res.status(404).json({
                error: 'Notice not found'
            });
        }
        
        const actualRecipient = verification.rows[0].recipient_address;
        
        // Check if viewer matches recipient (case-insensitive)
        if (actualRecipient.toLowerCase() !== viewerAddress.toLowerCase()) {
            return res.status(403).json({
                error: 'Viewer is not the recipient of this notice'
            });
        }
        
        // Log the view
        const insertQuery = `
            INSERT INTO notice_views (
                notice_id,
                document_id,
                viewer_address,
                view_type,
                viewed_at,
                ip_address,
                user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `;
        
        const values = [
            noticeId,
            documentId,
            viewerAddress,
            viewType || 'view_only_no_signature',
            timestamp || new Date().toISOString(),
            req.ip,
            req.get('user-agent')
        ];
        
        const result = await pool.query(insertQuery, values);
        
        // Update notice_components to track that it was viewed
        await pool.query(`
            UPDATE notice_components
            SET 
                last_viewed_at = CURRENT_TIMESTAMP,
                view_count = COALESCE(view_count, 0) + 1
            WHERE notice_id = $1 AND document_id = $2
        `, [noticeId, documentId]);
        
        res.json({
            success: true,
            viewId: result.rows[0].id,
            message: 'View logged successfully'
        });
        
    } catch (error) {
        console.error('Error logging view:', error);
        
        // If table doesn't exist, try to create it
        if (error.code === '42P01') {
            try {
                await createViewsTable();
                // Retry the request
                return router.handle(req, res);
            } catch (createError) {
                console.error('Error creating table:', createError);
            }
        }
        
        res.status(500).json({
            error: error.message
        });
    }
});

/**
 * Get view history for a notice
 */
router.get('/notice/:noticeId/views', async (req, res) => {
    try {
        const { noticeId } = req.params;
        const { includeSignatures } = req.query;
        
        let query = `
            SELECT 
                nv.*,
                nc.recipient_address,
                nc.document_accepted,
                nc.document_accepted_at
            FROM notice_views nv
            LEFT JOIN notice_components nc ON nc.notice_id = nv.notice_id
            WHERE nv.notice_id = $1
        `;
        
        if (!includeSignatures) {
            query += ` AND nv.view_type = 'view_only_no_signature'`;
        }
        
        query += ` ORDER BY nv.viewed_at DESC`;
        
        const result = await pool.query(query, [noticeId]);
        
        res.json({
            noticeId,
            views: result.rows,
            totalViews: result.rows.length,
            viewsWithoutSignature: result.rows.filter(v => v.view_type === 'view_only_no_signature').length,
            documentSigned: result.rows[0]?.document_accepted || false
        });
        
    } catch (error) {
        console.error('Error fetching views:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

/**
 * Check if a recipient can view a document
 */
router.post('/check-access', async (req, res) => {
    try {
        const { noticeId, documentId, walletAddress } = req.body;
        
        const query = `
            SELECT 
                nc.*,
                sn.ipfs_hash,
                sn.transaction_hash
            FROM notice_components nc
            LEFT JOIN served_notices sn ON sn.notice_id = nc.notice_id
            WHERE nc.notice_id = $1 
            AND (nc.document_id = $2 OR $2 IS NULL)
        `;
        
        const result = await pool.query(query, [noticeId, documentId]);
        
        if (result.rows.length === 0) {
            return res.json({
                hasAccess: false,
                reason: 'Notice not found'
            });
        }
        
        const notice = result.rows[0];
        const isRecipient = notice.recipient_address.toLowerCase() === walletAddress.toLowerCase();
        const isServer = notice.server_address.toLowerCase() === walletAddress.toLowerCase();
        
        res.json({
            hasAccess: isRecipient || isServer,
            isRecipient,
            isServer,
            isSigned: notice.document_accepted || false,
            signedAt: notice.document_accepted_at,
            canViewOnly: isRecipient && !notice.document_accepted,
            notice: {
                noticeId: notice.notice_id,
                documentId: notice.document_id,
                caseNumber: notice.case_number,
                ipfsHash: notice.ipfs_hash,
                encryptionKey: notice.document_encryption_key
            }
        });
        
    } catch (error) {
        console.error('Error checking access:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

/**
 * Create notice_views table if it doesn't exist
 */
async function createViewsTable() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS notice_views (
            id SERIAL PRIMARY KEY,
            notice_id VARCHAR(255) NOT NULL,
            document_id VARCHAR(255),
            viewer_address VARCHAR(255) NOT NULL,
            view_type VARCHAR(50) NOT NULL,
            viewed_at TIMESTAMP NOT NULL,
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_notice_views_notice_id (notice_id),
            INDEX idx_notice_views_viewer (viewer_address)
        );
        
        -- Add view tracking columns to notice_components if they don't exist
        ALTER TABLE notice_components 
        ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
    `;
    
    await pool.query(createTableQuery);
}

// Ensure table exists on startup
createViewsTable().catch(console.error);

module.exports = router;