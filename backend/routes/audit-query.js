/**
 * Audit Query Routes
 * View comprehensive audit logs for compliance and tracking
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * GET /api/audit/recipient/:address
 * Get all audit events for a specific recipient
 */
router.get('/recipient/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const { startDate, endDate, actionType } = req.query;
        
        let query = `
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
            WHERE actor_address = $1
        `;
        
        const params = [address];
        let paramIndex = 2;
        
        if (startDate) {
            query += ` AND created_at >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            query += ` AND created_at <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        
        if (actionType) {
            query += ` AND action_type = $${paramIndex}`;
            params.push(actionType);
            paramIndex++;
        }
        
        query += ` ORDER BY created_at DESC`;
        
        const result = await pool.query(query, params);
        
        // Parse and enhance the audit entries
        const auditEntries = result.rows.map(row => {
            const details = typeof row.details === 'string' ? 
                JSON.parse(row.details) : row.details;
            
            return {
                id: row.audit_id,
                timestamp: row.created_at,
                action: row.action_type,
                wallet: row.actor_address,
                targetId: row.target_id,
                ipAddress: row.ip_address,
                userAgent: row.user_agent,
                details: details,
                // Human-readable action description
                description: getActionDescription(row.action_type, row.target_id)
            };
        });
        
        res.json({
            success: true,
            recipientAddress: address,
            totalEvents: auditEntries.length,
            events: auditEntries
        });
        
    } catch (error) {
        console.error('Error fetching recipient audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit logs'
        });
    }
});

/**
 * GET /api/audit/case/:caseNumber
 * Get all audit events related to a specific case
 */
router.get('/case/:caseNumber', async (req, res) => {
    try {
        const { caseNumber } = req.params;
        
        // First get all recipients for this case
        const caseResult = await pool.query(`
            SELECT recipients FROM case_service_records WHERE case_number = $1
        `, [caseNumber]);
        
        if (caseResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Case not found'
            });
        }
        
        const recipients = JSON.parse(caseResult.rows[0].recipients || '[]');
        
        // Get all audit logs for these recipients
        const auditResult = await pool.query(`
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
            WHERE actor_address = ANY($1::text[])
            ORDER BY created_at DESC
        `, [recipients]);
        
        const auditEntries = auditResult.rows.map(row => {
            const details = typeof row.details === 'string' ? 
                JSON.parse(row.details) : row.details;
            
            return {
                id: row.audit_id,
                timestamp: row.created_at,
                action: row.action_type,
                recipientWallet: row.actor_address,
                targetId: row.target_id,
                ipAddress: row.ip_address,
                userAgent: row.user_agent,
                details: details,
                description: getActionDescription(row.action_type, row.target_id)
            };
        });
        
        res.json({
            success: true,
            caseNumber: caseNumber,
            recipients: recipients,
            totalEvents: auditEntries.length,
            events: auditEntries
        });
        
    } catch (error) {
        console.error('Error fetching case audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit logs'
        });
    }
});

/**
 * GET /api/audit/summary
 * Get audit summary statistics
 */
router.get('/summary', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let dateFilter = '';
        const params = [];
        
        if (startDate && endDate) {
            dateFilter = 'WHERE created_at BETWEEN $1 AND $2';
            params.push(startDate, endDate);
        }
        
        // Get summary statistics
        const summaryQuery = `
            SELECT 
                action_type,
                COUNT(*) as count,
                COUNT(DISTINCT actor_address) as unique_actors,
                COUNT(DISTINCT ip_address) as unique_ips,
                MIN(created_at) as first_event,
                MAX(created_at) as last_event
            FROM audit_logs
            ${dateFilter}
            GROUP BY action_type
            ORDER BY count DESC
        `;
        
        const summaryResult = await pool.query(summaryQuery, params);
        
        // Get recent activity
        const recentQuery = `
            SELECT 
                audit_id,
                action_type,
                actor_address,
                target_id,
                ip_address,
                created_at
            FROM audit_logs
            ${dateFilter}
            ORDER BY created_at DESC
            LIMIT 100
        `;
        
        const recentResult = await pool.query(recentQuery, params);
        
        res.json({
            success: true,
            summary: summaryResult.rows,
            recentActivity: recentResult.rows,
            dateRange: {
                start: startDate || 'all time',
                end: endDate || 'now'
            }
        });
        
    } catch (error) {
        console.error('Error fetching audit summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit summary'
        });
    }
});

// Helper function to get human-readable action descriptions
function getActionDescription(actionType, targetId) {
    switch(actionType) {
        case 'recipient_notice_query':
            return 'Recipient checked their notices on BlockServed';
        case 'recipient_document_view':
            return `Recipient viewed document for notice ${targetId}`;
        case 'wallet_connect':
            return 'Recipient connected wallet to BlockServed';
        case 'document_signed':
            return `Recipient signed document ${targetId}`;
        case 'notice_served':
            return `Notice ${targetId} was served`;
        default:
            return actionType.replace(/_/g, ' ');
    }
}

module.exports = router;