/**
 * SECURE Notice Images API
 * Enforces strict access control - only process server and recipient can view
 */

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
 * GET /api/notices/:noticeId/images
 * Get notice images with strict access control
 * Only the process server who sent OR the recipient can access
 */
router.get('/api/notices/:noticeId/images', async (req, res) => {
    let client;
    
    try {
        const { noticeId } = req.params;
        const walletAddress = req.headers['x-wallet-address'] || req.headers['x-server-address'];
        
        if (!walletAddress) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Please connect your wallet to view images',
                success: false 
            });
        }
        
        client = await pool.connect();
        
        // First, get the notice details to check access
        let query = `
            SELECT 
                nc.alert_thumbnail_url,
                nc.document_unencrypted_url,
                nc.server_address,
                nc.recipient_address,
                nc.case_number,
                nc.alert_id,
                nc.document_id,
                nc.document_ipfs_hash as ipfs_hash,
                nc.page_count,
                nc.is_compiled,
                nc.document_count
            FROM notice_components nc
            WHERE (nc.alert_id = $1 OR nc.document_id = $1 OR nc.notice_id = $1)
            LIMIT 1
        `;
        
        let result = await client.query(query, [noticeId]);
        
        // If not found in notice_components, check served_notices
        if (result.rows.length === 0) {
            query = `
                SELECT 
                    server_address,
                    recipient_address,
                    case_number,
                    alert_id,
                    document_id,
                    ipfs_hash,
                    NULL as alert_thumbnail_url,
                    NULL as document_unencrypted_url
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
        
        // STRICT ACCESS CONTROL - Check if requester is authorized
        const normalizedWallet = walletAddress.toLowerCase();
        const isServer = notice.server_address && 
                        notice.server_address.toLowerCase() === normalizedWallet;
        const isRecipient = notice.recipient_address && 
                           notice.recipient_address.toLowerCase() === normalizedWallet;
        
        if (!isServer && !isRecipient) {
            // Log unauthorized access attempt
            console.log(`Unauthorized access attempt for notice ${noticeId} by ${walletAddress}`);
            
            // Log to database if you have an access_logs table
            try {
                await client.query(`
                    INSERT INTO access_logs (notice_id, wallet_address, access_type, granted, ip_address, timestamp)
                    VALUES ($1, $2, $3, $4, $5, NOW())
                `, [noticeId, walletAddress, 'images', false, req.clientIp || req.ip]);
            } catch (e) {
                // Ignore if table doesn't exist
            }
            
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'You are not authorized to view this notice. Only the process server and recipient can access.',
                yourWallet: walletAddress,
                isServer: false,
                isRecipient: false,
                success: false 
            });
        }
        
        // Log successful access
        try {
            await client.query(`
                INSERT INTO access_logs (notice_id, wallet_address, access_type, granted, ip_address, timestamp)
                VALUES ($1, $2, $3, $4, $5, NOW())
            `, [noticeId, walletAddress, isServer ? 'server_access' : 'recipient_access', true, req.clientIp || req.ip]);
        } catch (e) {
            // Ignore if table doesn't exist
        }
        
        // Build response with proper base URL
        const baseUrl = process.env.BACKEND_URL || `https://${req.get('host')}`;
        
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
            accessGranted: true,
            accessType: isServer ? 'process_server' : 'recipient',
            alertImage: alertThumbnailUrl,
            documentImage: documentUnencryptedUrl,
            caseNumber: notice.case_number,
            recipientAddress: notice.recipient_address,
            serverAddress: notice.server_address,
            alertId: notice.alert_id,
            documentId: notice.document_id,
            ipfsHash: notice.ipfs_hash,
            pageCount: notice.page_count,
            message: isServer ? 
                'Access granted - you are the process server who sent this notice' : 
                'Access granted - you are the recipient of this notice'
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
 * GET /api/notices/my-served
 * Get all notices served by the current process server
 */
router.get('/api/notices/my-served', async (req, res) => {
    let client;
    
    try {
        const serverAddress = req.headers['x-server-address'] || req.headers['x-wallet-address'];
        
        if (!serverAddress) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Please connect your wallet',
                success: false 
            });
        }
        
        client = await pool.connect();
        
        // Get all notices served by this server
        const query = `
            SELECT 
                nc.notice_id,
                nc.alert_id,
                nc.document_id,
                nc.case_number,
                nc.recipient_address,
                nc.recipient_name,
                nc.alert_thumbnail_url,
                nc.document_unencrypted_url,
                nc.created_at,
                nc.document_accepted,
                nc.page_count
            FROM notice_components nc
            WHERE LOWER(nc.server_address) = LOWER($1)
            ORDER BY nc.created_at DESC
        `;
        
        const result = await client.query(query, [serverAddress]);
        
        // Add base URL to relative paths
        const baseUrl = process.env.BACKEND_URL || `https://${req.get('host')}`;
        
        const notices = result.rows.map(notice => ({
            ...notice,
            alertImage: notice.alert_thumbnail_url ? 
                (notice.alert_thumbnail_url.startsWith('http') ? 
                    notice.alert_thumbnail_url : 
                    `${baseUrl}${notice.alert_thumbnail_url}`) : null,
            documentImage: notice.document_unencrypted_url ? 
                (notice.document_unencrypted_url.startsWith('http') ? 
                    notice.document_unencrypted_url : 
                    `${baseUrl}${notice.document_unencrypted_url}`) : null,
            canView: true,
            accessType: 'process_server'
        }));
        
        res.json({
            success: true,
            serverAddress,
            totalNotices: notices.length,
            notices
        });
        
    } catch (error) {
        console.error('Error fetching served notices:', error);
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

/**
 * GET /api/notices/my-received
 * Get all notices received by the current recipient
 */
router.get('/api/notices/my-received', async (req, res) => {
    let client;
    
    try {
        const recipientAddress = req.headers['x-wallet-address'];
        
        if (!recipientAddress) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Please connect your wallet',
                success: false 
            });
        }
        
        client = await pool.connect();
        
        // Get all notices received by this recipient
        const query = `
            SELECT 
                nc.notice_id,
                nc.alert_id,
                nc.document_id,
                nc.case_number,
                nc.server_address,
                nc.issuing_agency,
                nc.alert_thumbnail_url,
                nc.document_unencrypted_url,
                nc.created_at,
                nc.document_accepted,
                nc.page_count
            FROM notice_components nc
            WHERE LOWER(nc.recipient_address) = LOWER($1)
            ORDER BY nc.created_at DESC
        `;
        
        const result = await client.query(query, [recipientAddress]);
        
        // Add base URL to relative paths
        const baseUrl = process.env.BACKEND_URL || `https://${req.get('host')}`;
        
        const notices = result.rows.map(notice => ({
            ...notice,
            alertImage: notice.alert_thumbnail_url ? 
                (notice.alert_thumbnail_url.startsWith('http') ? 
                    notice.alert_thumbnail_url : 
                    `${baseUrl}${notice.alert_thumbnail_url}`) : null,
            documentImage: notice.document_unencrypted_url ? 
                (notice.document_unencrypted_url.startsWith('http') ? 
                    notice.document_unencrypted_url : 
                    `${baseUrl}${notice.document_unencrypted_url}`) : null,
            canView: true,
            accessType: 'recipient'
        }));
        
        res.json({
            success: true,
            recipientAddress,
            totalNotices: notices.length,
            notices
        });
        
    } catch (error) {
        console.error('Error fetching received notices:', error);
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