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
        
        // First try notice_components table which has the uploaded images
        let query = `
            SELECT 
                alert_thumbnail_url,
                document_unencrypted_url,
                server_address,
                case_number,
                recipient_address,
                alert_id,
                document_id,
                document_ipfs_hash as ipfs_hash
            FROM notice_components
            WHERE (alert_id = $1 OR document_id = $1 OR notice_id = $1)
            LIMIT 1
        `;
        
        let result = await client.query(query, [noticeId]);
        
        // If not found in notice_components, try served_notices table
        if (result.rows.length === 0) {
            // Check if columns exist in served_notices
            const columnCheckQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'served_notices' 
                AND column_name IN ('alert_thumbnail_url', 'document_unencrypted_url')
            `;
            
            const columnCheck = await client.query(columnCheckQuery);
            const hasImageColumns = columnCheck.rows.length === 2;
            
            if (hasImageColumns) {
                query = `
                    SELECT 
                        alert_thumbnail_url,
                        document_unencrypted_url,
                        server_address,
                        case_number,
                        recipient_address,
                        alert_id,
                        document_id,
                        ipfs_hash
                    FROM served_notices
                    WHERE (alert_id = $1 OR document_id = $1 OR notice_id = $1)
                    LIMIT 1
                `;
            } else {
                // Fallback query without image columns
                query = `
                    SELECT 
                        server_address,
                        case_number,
                        recipient_address,
                        alert_id,
                        document_id,
                        ipfs_hash,
                        NULL as alert_thumbnail_url,
                        NULL as document_unencrypted_url
                    FROM served_notices
                    WHERE (alert_id = $1 OR document_id = $1 OR notice_id = $1)
                    LIMIT 1
                `;
            }
            
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
        
        // Return the image URLs with proper base URL if needed
        const baseUrl = process.env.BACKEND_URL || `https://${req.get('host')}`;
        
        // Add base URL if paths are relative
        const alertThumbnailUrl = notice.alert_thumbnail_url ? 
            (notice.alert_thumbnail_url.startsWith('http') ? 
                notice.alert_thumbnail_url : 
                `${baseUrl}${notice.alert_thumbnail_url}`) : null;
                
        const documentUnencryptedUrl = notice.document_unencrypted_url ? 
            (notice.document_unencrypted_url.startsWith('http') ? 
                notice.document_unencrypted_url : 
                `${baseUrl}${notice.document_unencrypted_url}`) : null;
        
        res.json({
            success: true,
            alertThumbnailUrl: alertThumbnailUrl,
            documentUnencryptedUrl: documentUnencryptedUrl,
            caseNumber: notice.case_number,
            recipientAddress: notice.recipient_address,
            alertId: notice.alert_id,
            documentId: notice.document_id,
            ipfsHash: notice.ipfs_hash,
            message: (!alertThumbnailUrl && !documentUnencryptedUrl) 
                ? 'Notice found but images not yet uploaded. Documents may need to be re-uploaded.' 
                : null
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