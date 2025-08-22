/**
 * Data Export Routes
 * API endpoints for the visual data dashboard
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') 
        ? { rejectUnauthorized: false }
        : false
});

// Get all cases
router.get('/cases', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                case_number,
                status,
                server_address,
                created_at,
                updated_at,
                metadata
            FROM cases 
            ORDER BY created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({ error: 'Failed to fetch cases' });
    }
});

// Get all service records
router.get('/service-records', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                case_number,
                transaction_hash,
                alert_token_id,
                document_token_id,
                ipfs_hash,
                encryption_key,
                recipients,
                page_count,
                served_at,
                server_address,
                created_at
            FROM case_service_records 
            ORDER BY served_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching service records:', error);
        res.status(500).json({ error: 'Failed to fetch service records' });
    }
});

// Get all notice images
router.get('/images', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                case_number,
                alert_image,
                document_preview,
                created_at
            FROM notice_images 
            ORDER BY created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching images:', error);
        res.status(500).json({ error: 'Failed to fetch images' });
    }
});

// Get recent audit logs
router.get('/audit-logs', async (req, res) => {
    try {
        const limit = req.query.limit || 100;
        const result = await pool.query(`
            SELECT 
                audit_id,
                action_type,
                actor_address,
                target_id,
                details,
                ip_address,
                user_agent,
                created_at
            FROM audit_logs 
            ORDER BY created_at DESC
            LIMIT $1
        `, [limit]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// Get notice views
router.get('/notice-views', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                alert_id,
                wallet_address,
                viewed_at,
                signed_at,
                signature_data,
                ip_address,
                user_agent
            FROM notice_views 
            ORDER BY viewed_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching notice views:', error);
        res.status(500).json({ error: 'Failed to fetch notice views' });
    }
});

// Get summary statistics
router.get('/summary', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM cases) as total_cases,
                (SELECT COUNT(*) FROM cases WHERE status = 'served') as served_cases,
                (SELECT COUNT(*) FROM case_service_records) as service_records,
                (SELECT COUNT(*) FROM notice_images) as image_records,
                (SELECT COUNT(*) FROM audit_logs) as audit_events,
                (SELECT COUNT(DISTINCT actor_address) FROM audit_logs) as unique_recipients,
                (SELECT COUNT(*) FROM notice_views WHERE signed_at IS NOT NULL) as documents_signed
        `);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching summary:', error);
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});

// Get detailed case information
router.get('/case/:caseNumber', async (req, res) => {
    try {
        const { caseNumber } = req.params;
        
        // Get all related data for a case
        const [caseData, serviceRecord, images, auditLogs] = await Promise.all([
            pool.query('SELECT * FROM cases WHERE case_number = $1', [caseNumber]),
            pool.query('SELECT * FROM case_service_records WHERE case_number = $1', [caseNumber]),
            pool.query('SELECT * FROM notice_images WHERE case_number = $1', [caseNumber]),
            pool.query(`
                SELECT * FROM audit_logs 
                WHERE target_id = $1 OR details::text LIKE $2
                ORDER BY created_at DESC
            `, [caseNumber, `%${caseNumber}%`])
        ]);
        
        res.json({
            case: caseData.rows[0],
            serviceRecord: serviceRecord.rows[0],
            images: images.rows[0],
            auditLogs: auditLogs.rows
        });
    } catch (error) {
        console.error('Error fetching case details:', error);
        res.status(500).json({ error: 'Failed to fetch case details' });
    }
});

// Export all data as JSON
router.get('/export-all', async (req, res) => {
    try {
        const [cases, serviceRecords, images, auditLogs, noticeViews] = await Promise.all([
            pool.query('SELECT * FROM cases ORDER BY created_at DESC'),
            pool.query('SELECT * FROM case_service_records ORDER BY served_at DESC'),
            pool.query('SELECT * FROM notice_images ORDER BY created_at DESC'),
            pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1000'),
            pool.query('SELECT * FROM notice_views ORDER BY viewed_at DESC')
        ]);
        
        res.json({
            exportDate: new Date().toISOString(),
            data: {
                cases: cases.rows,
                serviceRecords: serviceRecords.rows,
                images: images.rows,
                auditLogs: auditLogs.rows,
                noticeViews: noticeViews.rows
            }
        });
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

module.exports = router;