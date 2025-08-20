/**
 * Notice Dismissal Routes
 * Manages dismissed status for notices while keeping them permanently accessible
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * POST /api/notices/dismiss
 * Mark a notice as dismissed (hidden from recent view)
 */
router.post('/api/notices/dismiss', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { noticeId, serverAddress } = req.body;
        
        if (!noticeId || !serverAddress) {
            return res.status(400).json({ 
                error: 'Notice ID and server address required' 
            });
        }
        
        // Verify the server owns this notice
        const verifyQuery = `
            SELECT notice_id 
            FROM notice_components 
            WHERE (notice_id = $1 OR alert_id = $1) 
            AND LOWER(server_address) = LOWER($2)
        `;
        
        const verifyResult = await client.query(verifyQuery, [noticeId, serverAddress]);
        
        if (verifyResult.rows.length === 0) {
            return res.status(403).json({ 
                error: 'You can only dismiss notices you served' 
            });
        }
        
        // Update dismissed status
        const updateQuery = `
            UPDATE notice_components 
            SET dismissed = true, 
                dismissed_at = NOW() 
            WHERE (notice_id = $1 OR alert_id = $1) 
            AND LOWER(server_address) = LOWER($2)
        `;
        
        await client.query(updateQuery, [noticeId, serverAddress]);
        
        res.json({ 
            success: true, 
            message: `Notice #${noticeId} dismissed from recent view` 
        });
        
    } catch (error) {
        console.error('Error dismissing notice:', error);
        res.status(500).json({ error: 'Failed to dismiss notice' });
    } finally {
        client.release();
    }
});

/**
 * POST /api/notices/restore
 * Restore a dismissed notice to recent view
 */
router.post('/api/notices/restore', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { noticeId, serverAddress } = req.body;
        
        if (!noticeId || !serverAddress) {
            return res.status(400).json({ 
                error: 'Notice ID and server address required' 
            });
        }
        
        // Update dismissed status
        const updateQuery = `
            UPDATE notice_components 
            SET dismissed = false, 
                dismissed_at = NULL 
            WHERE (notice_id = $1 OR alert_id = $1) 
            AND LOWER(server_address) = LOWER($2)
        `;
        
        const result = await client.query(updateQuery, [noticeId, serverAddress]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ 
                error: 'Notice not found or not owned by you' 
            });
        }
        
        res.json({ 
            success: true, 
            message: `Notice #${noticeId} restored to recent view` 
        });
        
    } catch (error) {
        console.error('Error restoring notice:', error);
        res.status(500).json({ error: 'Failed to restore notice' });
    } finally {
        client.release();
    }
});

/**
 * GET /api/notices/recent
 * Get recent (non-dismissed) notices for a server
 */
router.get('/api/notices/recent', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const serverAddress = req.headers['x-server-address'];
        
        if (!serverAddress) {
            return res.status(400).json({ 
                error: 'Server address required' 
            });
        }
        
        const query = `
            SELECT 
                notice_id,
                alert_id,
                document_id,
                recipient_address,
                recipient_name,
                case_number,
                issuing_agency,
                created_at,
                document_accepted,
                dismissed
            FROM notice_components
            WHERE LOWER(server_address) = LOWER($1)
            AND (dismissed = false OR dismissed IS NULL)
            ORDER BY created_at DESC
            LIMIT 20
        `;
        
        const result = await client.query(query, [serverAddress]);
        
        res.json({
            success: true,
            notices: result.rows,
            totalActive: result.rows.length
        });
        
    } catch (error) {
        console.error('Error fetching recent notices:', error);
        res.status(500).json({ error: 'Failed to fetch recent notices' });
    } finally {
        client.release();
    }
});

/**
 * GET /api/notices/all-served
 * Get ALL served notices (including dismissed) - permanent record
 */
router.get('/api/notices/all-served', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const serverAddress = req.headers['x-server-address'];
        
        if (!serverAddress) {
            return res.status(400).json({ 
                error: 'Server address required' 
            });
        }
        
        const query = `
            SELECT 
                notice_id,
                alert_id,
                document_id,
                recipient_address,
                recipient_name,
                case_number,
                issuing_agency,
                created_at,
                document_accepted,
                dismissed,
                dismissed_at,
                CASE 
                    WHEN dismissed = true THEN 'Archived'
                    WHEN document_accepted = true THEN 'Accepted'
                    ELSE 'Pending'
                END as status
            FROM notice_components
            WHERE LOWER(server_address) = LOWER($1)
            ORDER BY created_at DESC
        `;
        
        const result = await client.query(query, [serverAddress]);
        
        // Count statistics
        const stats = {
            total: result.rows.length,
            active: result.rows.filter(n => !n.dismissed).length,
            dismissed: result.rows.filter(n => n.dismissed).length,
            accepted: result.rows.filter(n => n.document_accepted).length,
            pending: result.rows.filter(n => !n.document_accepted && !n.dismissed).length
        };
        
        res.json({
            success: true,
            notices: result.rows,
            stats
        });
        
    } catch (error) {
        console.error('Error fetching all served notices:', error);
        res.status(500).json({ error: 'Failed to fetch served notices' });
    } finally {
        client.release();
    }
});

module.exports = router;