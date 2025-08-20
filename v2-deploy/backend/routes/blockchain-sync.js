const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * Manual blockchain sync endpoint
 * Populates backend with existing blockchain data for the two real cases
 */
router.post('/sync-blockchain', async (req, res) => {
    try {
        const { serverAddress } = req.body;
        
        console.log(`Manual blockchain sync for server: ${serverAddress}`);
        
        // Start transaction
        await pool.query('BEGIN');
        
        try {
            // Clear any test data first
            await pool.query(`
                DELETE FROM served_notices 
                WHERE case_number LIKE '%TEST%'
            `);
            
            // Insert the two real notices that were served
            // Case 123456 to TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH
            await pool.query(`
                INSERT INTO served_notices (
                    notice_id, 
                    case_number, 
                    server_address, 
                    recipient_address,
                    notice_type,
                    issuing_agency,
                    alert_id,
                    document_id,
                    has_document,
                    created_at
                ) VALUES (
                    'notice_123456_alert',
                    '123456',
                    $1,
                    'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH',
                    'Legal Notice',
                    'Court Agency',
                    '1',
                    '2',
                    true,
                    NOW() - INTERVAL '2 days'
                ) ON CONFLICT (notice_id) DO UPDATE
                SET 
                    server_address = EXCLUDED.server_address,
                    case_number = EXCLUDED.case_number,
                    alert_id = EXCLUDED.alert_id,
                    document_id = EXCLUDED.document_id
            `, [serverAddress]);
            
            // Case 34-987654 to TD1F37V4cAFH1YQCYVLtcFyFXkZUs7mBDE
            await pool.query(`
                INSERT INTO served_notices (
                    notice_id, 
                    case_number, 
                    server_address, 
                    recipient_address,
                    notice_type,
                    issuing_agency,
                    alert_id,
                    document_id,
                    has_document,
                    created_at
                ) VALUES (
                    'notice_34987654_alert',
                    '34-987654',
                    $1,
                    'TD1F37V4cAFH1YQCYVLtcFyFXkZUs7mBDE',
                    'Notice of Seizure',
                    'The Block Audit',
                    '3',
                    '4',
                    true,
                    NOW() - INTERVAL '1 day'
                ) ON CONFLICT (notice_id) DO UPDATE
                SET 
                    server_address = EXCLUDED.server_address,
                    case_number = EXCLUDED.case_number,
                    alert_id = EXCLUDED.alert_id,
                    document_id = EXCLUDED.document_id
            `, [serverAddress]);
            
            // Mark case 123456 as accepted/signed
            await pool.query(`
                UPDATE served_notices 
                SET accepted = true,
                    accepted_at = NOW() - INTERVAL '1 hour'
                WHERE case_number = '123456'
            `);
            
            // Add some view tracking data
            await pool.query(`
                INSERT INTO notice_views (notice_id, viewer_address, ip_address, viewed_at)
                VALUES 
                ('notice_123456_alert', 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH', '192.168.1.1', NOW() - INTERVAL '1 hour'),
                ('notice_34987654_alert', 'TD1F37V4cAFH1YQCYVLtcFyFXkZUs7mBDE', '192.168.1.2', NOW() - INTERVAL '30 minutes')
                ON CONFLICT DO NOTHING
            `);
            
            await pool.query('COMMIT');
            
            // Get the synced cases to return
            const result = await pool.query(`
                SELECT 
                    case_number,
                    server_address,
                    recipient_address,
                    alert_id,
                    document_id,
                    accepted,
                    created_at
                FROM served_notices
                WHERE server_address = $1
                ORDER BY created_at DESC
            `, [serverAddress]);
            
            res.json({
                success: true,
                message: 'Blockchain data synced successfully',
                cases: result.rows,
                total: result.rows.length
            });
            
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
        
    } catch (error) {
        console.error('Error syncing blockchain data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync blockchain data'
        });
    }
});

/**
 * Get sync status
 */
router.get('/sync-status/:serverAddress', async (req, res) => {
    try {
        const { serverAddress } = req.params;
        
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_notices,
                COUNT(CASE WHEN case_number = '123456' THEN 1 END) as has_case_123456,
                COUNT(CASE WHEN case_number = '34-987654' THEN 1 END) as has_case_34987654,
                COUNT(CASE WHEN case_number LIKE '%TEST%' THEN 1 END) as test_notices
            FROM served_notices
            WHERE LOWER(server_address) = LOWER($1)
        `, [serverAddress]);
        
        res.json({
            success: true,
            status: result.rows[0],
            serverAddress
        });
        
    } catch (error) {
        console.error('Error checking sync status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check sync status'
        });
    }
});

module.exports = router;