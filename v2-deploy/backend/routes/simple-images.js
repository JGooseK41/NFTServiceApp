/**
 * Simple Images API
 * Straightforward endpoints for storing and retrieving notice images
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Use the same database configuration as other routes
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

/**
 * Store images for a notice
 * POST /api/images
 */
router.post('/', async (req, res) => {
    const {
        notice_id,
        server_address,
        recipient_address,
        alert_image,
        document_image,
        alert_thumbnail,
        document_thumbnail,
        transaction_hash,
        case_number
    } = req.body;

    let client;
    try {
        client = await pool.connect();
        
        // Try to use images table first
        try {
            const query = `
                INSERT INTO images (
                    notice_id, server_address, recipient_address,
                    alert_image, document_image, alert_thumbnail, document_thumbnail,
                    transaction_hash, case_number
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (notice_id) 
                DO UPDATE SET
                    alert_image = COALESCE(EXCLUDED.alert_image, images.alert_image),
                    document_image = COALESCE(EXCLUDED.document_image, images.document_image),
                    alert_thumbnail = COALESCE(EXCLUDED.alert_thumbnail, images.alert_thumbnail),
                    document_thumbnail = COALESCE(EXCLUDED.document_thumbnail, images.document_thumbnail),
                    transaction_hash = COALESCE(EXCLUDED.transaction_hash, images.transaction_hash),
                    case_number = COALESCE(EXCLUDED.case_number, images.case_number),
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *;
            `;

            const result = await client.query(query, [
                notice_id,
                server_address,
                recipient_address,
                alert_image,
                document_image,
                alert_thumbnail,
                document_thumbnail,
                transaction_hash,
                case_number || ''
            ]);

            return res.json({
                success: true,
                image: result.rows[0],
                storage: 'images_table'
            });
        } catch (e) {
            // If images table doesn't exist, fallback to notice_components
            console.log('Images table not available, using notice_components fallback');
            
            // Check if record exists first
            const checkQuery = `
                SELECT notice_id FROM notice_components 
                WHERE notice_id = $1 OR alert_id = $1 OR document_id = $1
                LIMIT 1
            `;
            const checkResult = await client.query(checkQuery, [notice_id]);
            
            if (checkResult.rows.length > 0) {
                // Update existing record
                const updateQuery = `
                    UPDATE notice_components 
                    SET alert_thumbnail_url = COALESCE($2, alert_thumbnail_url),
                        document_unencrypted_url = COALESCE($3, document_unencrypted_url),
                        case_number = COALESCE($4, case_number)
                    WHERE notice_id = $1 OR alert_id = $1 OR document_id = $1
                    RETURNING *;
                `;
                
                const result = await client.query(updateQuery, [
                    notice_id,
                    alert_thumbnail || alert_image,
                    document_thumbnail || document_image,
                    case_number || ''
                ]);
                
                return res.json({
                    success: true,
                    image: {
                        notice_id: result.rows[0].notice_id || result.rows[0].alert_id,
                        server_address: result.rows[0].server_address,
                        recipient_address: result.rows[0].recipient_address,
                        alert_image: result.rows[0].alert_thumbnail_url,
                        document_image: result.rows[0].document_unencrypted_url,
                        case_number: result.rows[0].case_number
                    },
                    storage: 'notice_components_update'
                });
            } else {
                // Insert new record
                const insertQuery = `
                    INSERT INTO notice_components (
                        notice_id, alert_id, document_id,
                        server_address, recipient_address,
                        alert_thumbnail_url, document_unencrypted_url,
                        case_number, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                    RETURNING *;
                `;
                
                const result = await client.query(insertQuery, [
                    notice_id,
                    notice_id, // Use same ID for alert_id
                    parseInt(notice_id) + 1, // Document ID is typically alert + 1
                    server_address,
                    recipient_address,
                    alert_thumbnail || alert_image,
                    document_thumbnail || document_image,
                    case_number || ''
                ]);
                
                return res.json({
                    success: true,
                    image: {
                        notice_id: result.rows[0].notice_id,
                        server_address: result.rows[0].server_address,
                        recipient_address: result.rows[0].recipient_address,
                        alert_image: result.rows[0].alert_thumbnail_url,
                        document_image: result.rows[0].document_unencrypted_url,
                        case_number: result.rows[0].case_number
                    },
                    storage: 'notice_components_insert'
                });
            }
        }
    } catch (error) {
        console.error('Error storing images:', error);
        res.status(500).json({ 
            error: 'Failed to store images',
            details: error.message 
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * Get images for a specific notice
 * GET /api/images/:noticeId
 */
router.get('/:noticeId', async (req, res) => {
    const { noticeId } = req.params;
    const walletAddress = req.headers['x-wallet-address'] || req.headers['x-server-address'];

    if (!walletAddress) {
        return res.status(401).json({ error: 'Wallet address required' });
    }

    let client;
    try {
        client = await pool.connect();
        
        // First try the new images table (if it exists)
        try {
            const query = `
                SELECT * FROM images 
                WHERE notice_id = $1 
                AND (server_address = $2 OR recipient_address = $2)
                LIMIT 1;
            `;
            const result = await client.query(query, [noticeId, walletAddress]);
            
            if (result.rows.length > 0) {
                return res.json(result.rows[0]);
            }
        } catch (e) {
            // Table doesn't exist yet, fall through to legacy tables
            console.log('Images table not found, using legacy tables');
        }

        // Fallback to notice_components table
        let query = `
            SELECT 
                nc.alert_id as notice_id,
                nc.server_address,
                nc.recipient_address,
                nc.alert_thumbnail_url as alert_image,
                nc.document_unencrypted_url as document_image,
                nc.alert_thumbnail_url as alert_thumbnail,
                nc.document_unencrypted_url as document_thumbnail,
                nc.case_number,
                nc.created_at
            FROM notice_components nc
            WHERE (nc.alert_id = $1 OR nc.document_id = $1 OR nc.notice_id = $1)
            AND (nc.server_address = $2 OR nc.recipient_address = $2)
            LIMIT 1
        `;
        
        let result = await client.query(query, [noticeId, walletAddress]);
        
        if (result.rows.length === 0) {
            // Try served_notices table
            query = `
                SELECT 
                    sn.alert_id as notice_id,
                    sn.server_address,
                    sn.recipient_address,
                    sn.case_number,
                    sn.created_at
                FROM served_notices sn
                WHERE (sn.alert_id = $1 OR sn.document_id = $1 OR sn.notice_id = $1)
                AND (sn.server_address = $2 OR sn.recipient_address = $2)
                LIMIT 1
            `;
            result = await client.query(query, [noticeId, walletAddress]);
        }

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Image not found or access denied' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching image:', error);
        res.status(500).json({ error: 'Failed to fetch image' });
    } finally {
        if (client) client.release();
    }
});

/**
 * Get all images for a wallet (as server or recipient)
 * GET /api/images
 */
router.get('/', async (req, res) => {
    const walletAddress = req.headers['x-wallet-address'] || req.headers['x-server-address'];
    const role = req.query.role; // 'server', 'recipient', or 'all'

    if (!walletAddress) {
        return res.status(401).json({ error: 'Wallet address required' });
    }

    let client;
    try {
        client = await pool.connect();
        let query;
        let params = [walletAddress];
        
        // Try new images table first
        try {
            if (role === 'server') {
                query = `
                    SELECT * FROM images 
                    WHERE server_address = $1
                    ORDER BY created_at DESC;
                `;
            } else if (role === 'recipient') {
                query = `
                    SELECT * FROM images 
                    WHERE recipient_address = $1
                    ORDER BY created_at DESC;
                `;
            } else {
                query = `
                    SELECT * FROM images 
                    WHERE server_address = $1 OR recipient_address = $1
                    ORDER BY created_at DESC;
                `;
            }
            
            const result = await client.query(query, params);
            if (result.rows.length > 0) {
                return res.json(result.rows);
            }
        } catch (e) {
            // Table doesn't exist, use fallback
            console.log('Images table not found, using legacy tables');
        }
        
        // Fallback to notice_components
        if (role === 'server') {
            query = `
                SELECT 
                    nc.alert_id as notice_id,
                    nc.server_address,
                    nc.recipient_address,
                    nc.alert_thumbnail_url as alert_image,
                    nc.document_unencrypted_url as document_image,
                    nc.case_number,
                    nc.created_at
                FROM notice_components nc
                WHERE nc.server_address = $1
                ORDER BY nc.created_at DESC;
            `;
        } else if (role === 'recipient') {
            query = `
                SELECT 
                    nc.alert_id as notice_id,
                    nc.server_address,
                    nc.recipient_address,
                    nc.alert_thumbnail_url as alert_image,
                    nc.document_unencrypted_url as document_image,
                    nc.case_number,
                    nc.created_at
                FROM notice_components nc
                WHERE nc.recipient_address = $1
                ORDER BY nc.created_at DESC;
            `;
        } else {
            query = `
                SELECT 
                    nc.alert_id as notice_id,
                    nc.server_address,
                    nc.recipient_address,
                    nc.alert_thumbnail_url as alert_image,
                    nc.document_unencrypted_url as document_image,
                    nc.case_number,
                    nc.created_at
                FROM notice_components nc
                WHERE nc.server_address = $1 OR nc.recipient_address = $1
                ORDER BY nc.created_at DESC;
            `;
        }

        const result = await client.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching images:', error);
        res.status(500).json({ error: 'Failed to fetch images' });
    } finally {
        if (client) client.release();
    }
});

/**
 * Get images by transaction hash
 * GET /api/images/tx/:txHash
 */
router.get('/tx/:txHash', async (req, res) => {
    const { txHash } = req.params;
    const walletAddress = req.headers['x-wallet-address'];

    if (!walletAddress) {
        return res.status(401).json({ error: 'Wallet address required' });
    }

    try {
        const query = `
            SELECT * FROM images 
            WHERE transaction_hash = $1
            AND (server_address = $2 OR recipient_address = $2);
        `;

        const result = await pool.query(query, [txHash, walletAddress]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching images by tx:', error);
        res.status(500).json({ error: 'Failed to fetch images' });
    }
});

/**
 * Delete images for a notice (server only)
 * DELETE /api/images/:noticeId
 */
router.delete('/:noticeId', async (req, res) => {
    const { noticeId } = req.params;
    const walletAddress = req.headers['x-wallet-address'];

    if (!walletAddress) {
        return res.status(401).json({ error: 'Wallet address required' });
    }

    try {
        // Only server can delete
        const query = `
            DELETE FROM images 
            WHERE notice_id = $1 AND server_address = $2
            RETURNING *;
        `;

        const result = await pool.query(query, [noticeId, walletAddress]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Image not found or access denied' });
        }

        res.json({
            success: true,
            deleted: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

module.exports = router;