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
                id,
                action_type,
                actor_address,
                target_id,
                details,
                ip_address,
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
                id: row.id,
                timestamp: row.created_at,
                action: row.action_type,
                wallet: row.actor_address,
                targetId: row.target_id,
                ipAddress: row.ip_address,
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

        // First get case data including recipients and token IDs
        const caseResult = await pool.query(`
            SELECT recipients, alert_token_id, document_token_id
            FROM case_service_records WHERE case_number = $1
        `, [caseNumber]);

        if (caseResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Case not found'
            });
        }

        // Handle JSONB recipients field (already parsed by PostgreSQL)
        let recipients = caseResult.rows[0].recipients || [];
        if (typeof recipients === 'string') {
            try {
                recipients = JSON.parse(recipients);
            } catch (e) {
                recipients = [recipients]; // Single recipient as string
            }
        }
        if (!Array.isArray(recipients)) {
            recipients = [];
        }

        const alertTokenId = caseResult.rows[0].alert_token_id;
        const documentTokenId = caseResult.rows[0].document_token_id;

        // Get all audit logs for this case (by recipients AND by target_id)
        const auditResult = await pool.query(`
            SELECT
                id,
                action_type,
                actor_address,
                target_id,
                details,
                ip_address,
                created_at
            FROM audit_logs
            WHERE actor_address = ANY($1::text[])
               OR target_id = $2
               OR target_id = $3
               OR target_id = $4
            ORDER BY created_at DESC
        `, [recipients, caseNumber, alertTokenId, documentTokenId]);

        const auditEntries = auditResult.rows.map(row => {
            const details = typeof row.details === 'string' ?
                JSON.parse(row.details) : row.details;

            return {
                id: row.id,
                timestamp: row.created_at,
                action: row.action_type,
                recipientWallet: row.actor_address,
                targetId: row.target_id,
                ipAddress: row.ip_address,
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
                id,
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
            return `Recipient viewed document for case ${targetId}`;
        case 'recipient_document_download':
            return `Recipient downloaded PDF for case ${targetId}`;
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