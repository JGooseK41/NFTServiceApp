const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

/**
 * Get unencrypted notice images for process server
 * Only the process server who sent the notice can access the unencrypted images
 */
router.get('/api/notices/:noticeId/images', async (req, res) => {
    let client;
    
    try {
        const { noticeId } = req.params;
        const serverAddress = req.headers['x-server-address']; // Pass server address in header for auth
        
        client = await pool.connect();
        
        // Query for notice images
        // First try active_notices table
        let query = `
            SELECT 
                alert_thumbnail_url,
                document_unencrypted_url,
                server_address,
                case_number,
                recipient_address
            FROM active_notices
            WHERE (alert_id = $1 OR document_id = $1 OR notice_id = $1)
            LIMIT 1
        `;
        
        let result = await client.query(query, [noticeId]);
        
        // If not found in active_notices, try served_notices
        if (result.rows.length === 0) {
            query = `
                SELECT 
                    alert_thumbnail_url,
                    document_unencrypted_url,
                    server_address,
                    case_number,
                    recipient_address
                FROM served_notices
                WHERE (alert_id = $1 OR document_id = $1 OR notice_id = $1)
                LIMIT 1
            `;
            result = await client.query(query, [noticeId]);
        }
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Notice not found',
                success: false 
            });
        }
        
        const notice = result.rows[0];
        
        // Optional: Check if requester is the process server who sent the notice
        // Uncomment this for production to enforce access control
        /*
        if (serverAddress && notice.server_address.toLowerCase() !== serverAddress.toLowerCase()) {
            return res.status(403).json({ 
                error: 'Access denied - you can only view notices you served',
                success: false 
            });
        }
        */
        
        // Return the image URLs
        res.json({
            success: true,
            alertThumbnailUrl: notice.alert_thumbnail_url,
            documentUnencryptedUrl: notice.document_unencrypted_url,
            caseNumber: notice.case_number,
            recipientAddress: notice.recipient_address
        });
        
    } catch (error) {
        console.error('Error fetching notice images:', error);
        res.status(500).json({ 
            error: 'Database error', 
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
            success: false
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

/**
 * Get transaction hash for a notice
 */
router.get('/api/notices/:noticeId/transaction', async (req, res) => {
    let client;
    
    try {
        const { noticeId } = req.params;
        
        client = await pool.connect();
        
        // Query for transaction hash
        const query = `
            SELECT 
                transaction_hash,
                block_number,
                created_at
            FROM served_notices
            WHERE (alert_id = $1 OR document_id = $1 OR notice_id = $1)
            LIMIT 1
        `;
        
        const result = await client.query(query, [noticeId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Notice not found',
                success: false 
            });
        }
        
        const notice = result.rows[0];
        
        res.json({
            success: true,
            transactionHash: notice.transaction_hash || 'PENDING',
            blockNumber: notice.block_number,
            timestamp: notice.created_at
        });
        
    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ 
            error: 'Database error',
            success: false
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

module.exports = router;