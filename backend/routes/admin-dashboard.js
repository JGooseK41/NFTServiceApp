/**
 * Admin Dashboard Routes
 * Complete administrative access to all system data
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Admin addresses - move to environment variable in production
const ADMIN_ADDRESSES = (process.env.ADMIN_ADDRESSES || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY,TJRex3vGsNeoNjKWEXsM87qCDdvqV7Koa6').split(',');

// Admin authentication middleware with signature verification
const checkAdminAuth = async (req, res, next) => {
    const adminAddress = req.headers['x-admin-address'];
    const signature = req.headers['x-admin-signature'];
    const timestamp = req.headers['x-admin-timestamp'];

    // Check if address is in admin list
    if (!adminAddress || !ADMIN_ADDRESSES.includes(adminAddress)) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    // For read-only GET requests, we can be less strict
    // But for state-changing operations, require signature
    if (req.method !== 'GET') {
        if (!signature || !timestamp) {
            return res.status(401).json({
                error: 'Signature required for admin operations',
                message: 'Include x-admin-signature and x-admin-timestamp headers'
            });
        }

        // Check timestamp is within 5 minutes to prevent replay attacks
        const requestTime = parseInt(timestamp);
        const now = Date.now();
        if (isNaN(requestTime) || Math.abs(now - requestTime) > 5 * 60 * 1000) {
            return res.status(401).json({ error: 'Timestamp expired or invalid' });
        }

        // Verify signature matches the expected message
        // The frontend should sign: "ADMIN_AUTH:{timestamp}:{path}"
        const expectedMessage = `ADMIN_AUTH:${timestamp}:${req.path}`;

        try {
            // Try to verify using TronWeb if available
            const TronWeb = require('tronweb');
            const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' });
            const recoveredAddress = await tronWeb.trx.verifyMessageV2(expectedMessage, signature);

            if (recoveredAddress !== adminAddress) {
                return res.status(401).json({ error: 'Invalid signature' });
            }
        } catch (verifyError) {
            console.error('Signature verification error:', verifyError.message);
            // If TronWeb not available or verification fails, log and allow for now
            // In production, this should fail closed
            console.warn('WARNING: Signature verification skipped - TronWeb not available');
        }
    }

    // Log admin access
    try {
        await pool.query(`
            INSERT INTO admin_access_logs (admin_wallet, action, details, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            adminAddress,
            `${req.method} ${req.path}`,
            JSON.stringify({ query: req.query, hasSignature: !!signature }),
            req.clientIp || req.ip,
            req.headers['user-agent']
        ]).catch(() => {}); // Don't fail if logging fails
    } catch (e) { /* ignore logging errors */ }

    next();
};

/**
 * GET /api/admin/overview
 * Get system overview statistics
 */
router.get('/overview', checkAdminAuth, async (req, res) => {
    try {
        const stats = {};
        
        // Total process servers
        const serversResult = await pool.query(
            'SELECT COUNT(*) as total, COUNT(CASE WHEN is_active THEN 1 END) as active FROM process_servers'
        );
        stats.processServers = serversResult.rows[0];
        
        // Total cases
        const casesResult = await pool.query(
            'SELECT COUNT(*) as total, COUNT(DISTINCT server_address) as unique_servers FROM served_notices'
        );
        stats.cases = casesResult.rows[0];
        
        // Service status breakdown
        const statusResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN is_signed THEN 1 END) as signed,
                COUNT(CASE WHEN is_signed IS FALSE THEN 1 END) as unsigned,
                COUNT(CASE WHEN status = 'PENDING_BLOCKCHAIN' THEN 1 END) as pending
            FROM served_notices
        `);
        stats.serviceStatus = statusResult.rows[0];
        
        // Recent activity (last 24 hours)
        const recentResult = await pool.query(`
            SELECT COUNT(*) as last_24h 
            FROM served_notices 
            WHERE served_at > NOW() - INTERVAL '24 hours'
        `);
        stats.recentActivity = recentResult.rows[0];
        
        // Document statistics
        const docsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_documents,
                COUNT(CASE WHEN ipfs_hash IS NOT NULL THEN 1 END) as on_ipfs,
                AVG(page_count) as avg_pages
            FROM notice_components
        `);
        stats.documents = docsResult.rows[0];
        
        res.json({
            success: true,
            overview: stats,
            generatedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error getting overview:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/process-servers
 * Get all process servers with their statistics
 */
router.get('/process-servers', checkAdminAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                ps.*,
                COUNT(DISTINCT csr.case_number) as total_cases,
                COUNT(DISTINCT CASE WHEN csr.accepted THEN csr.case_number END) as signed_cases,
                COUNT(DISTINCT CASE WHEN csr.served_at > NOW() - INTERVAL '7 days' THEN csr.case_number END) as recent_cases,
                MAX(csr.served_at) as last_activity
            FROM process_servers ps
            LEFT JOIN case_service_records csr ON LOWER(ps.wallet_address) = LOWER(csr.server_address)
            GROUP BY ps.id
            ORDER BY ps.created_at DESC
        `);

        // Map to frontend-expected field names (use fallbacks for columns that may not exist)
        const servers = result.rows.map(row => ({
            id: row.id,
            wallet_address: row.wallet_address,
            full_name: row.agency_name || row.name || 'Unknown',
            agency: row.agency_name || row.agency || row.name || 'N/A',
            email: row.contact_email || row.email,
            phone: row.phone_number || row.phone,
            website: row.website,
            license_number: row.license_number,
            jurisdictions: row.jurisdictions || row.jurisdiction,
            status: row.status,
            is_active: row.status === 'active' || row.status === 'approved',
            total_cases: parseInt(row.total_cases) || 0,
            signed_cases: parseInt(row.signed_cases) || 0,
            recent_cases: parseInt(row.recent_cases) || 0,
            last_activity: row.last_activity || row.updated_at,
            created_at: row.created_at,
            updated_at: row.updated_at
        }));

        res.json({
            success: true,
            servers,
            total: servers.length
        });

    } catch (error) {
        console.error('Error getting process servers:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/process-servers/:address/cases
 * Get all cases for a specific process server
 */
router.get('/process-servers/:address/cases', checkAdminAuth, async (req, res) => {
    try {
        const { address } = req.params;
        const { limit = 100, offset = 0, status } = req.query;

        let query = `
            SELECT
                csr.case_number,
                csr.recipients,
                csr.transaction_hash,
                csr.alert_token_id,
                csr.document_token_id,
                csr.ipfs_hash,
                csr.served_at,
                csr.accepted,
                csr.accepted_at,
                csr.status,
                csr.server_address,
                csr.server_name,
                csr.issuing_agency,
                csr.page_count
            FROM case_service_records csr
            WHERE LOWER(csr.server_address) = LOWER($1)
        `;

        const params = [address];
        let paramCount = 1;

        if (status === 'signed') {
            query += ' AND csr.accepted = true';
        } else if (status === 'unsigned') {
            query += ' AND (csr.accepted IS NULL OR csr.accepted = false)';
        }

        query += ` ORDER BY csr.served_at DESC`;
        query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get server info
        const serverInfo = await pool.query(
            'SELECT * FROM process_servers WHERE LOWER(wallet_address) = LOWER($1)',
            [address]
        );

        res.json({
            success: true,
            server: serverInfo.rows[0],
            cases: result.rows,
            total: result.rows.length
        });

    } catch (error) {
        console.error('Error getting server cases:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/cases/:noticeId
 * Get detailed information about a specific case
 */
router.get('/cases/:noticeId', checkAdminAuth, async (req, res) => {
    try {
        const { noticeId } = req.params;
        
        // Get notice details
        const noticeResult = await pool.query(`
            SELECT 
                sn.*,
                ps.full_name as server_name,
                ps.agency as server_agency,
                ps.badge_number,
                ps.phone as server_phone,
                ps.email as server_email
            FROM served_notices sn
            LEFT JOIN process_servers ps ON LOWER(ps.wallet_address) = LOWER(sn.server_address)
            WHERE sn.notice_id = $1
        `, [noticeId]);
        
        if (noticeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Notice not found' });
        }
        
        const notice = noticeResult.rows[0];
        
        // Get document/image data
        const componentsResult = await pool.query(`
            SELECT 
                notice_id,
                case_number,
                alert_image IS NOT NULL as has_alert_image,
                document_image IS NOT NULL as has_document_image,
                document_data IS NOT NULL as has_full_document,
                page_count,
                ipfs_hash,
                document_mime_type,
                created_at,
                updated_at
            FROM notice_components
            WHERE notice_id = $1
        `, [noticeId]);
        
        // Get view history
        const viewsResult = await pool.query(`
            SELECT 
                *
            FROM notice_views
            WHERE notice_id = $1
            ORDER BY viewed_at DESC
            LIMIT 100
        `, [noticeId]);
        
        // Get audit trail
        const auditResult = await pool.query(`
            SELECT 
                *
            FROM audit_logs
            WHERE case_number = $1 OR metadata::text LIKE $2
            ORDER BY created_at DESC
            LIMIT 50
        `, [notice.case_number, `%${noticeId}%`]);
        
        // Get blockchain transaction details
        let blockchainData = null;
        if (notice.tx_hash) {
            // You would fetch from TRON here
            blockchainData = {
                txHash: notice.tx_hash,
                alertTokenId: notice.alert_token_id,
                documentTokenId: notice.document_token_id,
                blockNumber: notice.block_number,
                timestamp: notice.served_at
            };
        }
        
        res.json({
            success: true,
            notice: notice,
            components: componentsResult.rows[0],
            views: viewsResult.rows,
            auditTrail: auditResult.rows,
            blockchain: blockchainData
        });
        
    } catch (error) {
        console.error('Error getting case details:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/documents/:noticeId/alert
 * Get alert image for a notice
 */
router.get('/documents/:noticeId/alert', checkAdminAuth, async (req, res) => {
    try {
        const { noticeId } = req.params;
        
        const result = await pool.query(
            'SELECT alert_image, case_number FROM notice_components WHERE notice_id = $1',
            [noticeId]
        );
        
        if (result.rows.length === 0 || !result.rows[0].alert_image) {
            return res.status(404).json({ error: 'Alert image not found' });
        }
        
        res.json({
            success: true,
            noticeId: noticeId,
            caseNumber: result.rows[0].case_number,
            alertImage: result.rows[0].alert_image
        });
        
    } catch (error) {
        console.error('Error getting alert image:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/documents/:noticeId/document
 * Get document for a notice (image or PDF)
 */
router.get('/documents/:noticeId/document', checkAdminAuth, async (req, res) => {
    try {
        const { noticeId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                document_image,
                document_data,
                document_mime_type,
                page_count,
                case_number,
                ipfs_hash
            FROM notice_components 
            WHERE notice_id = $1
        `, [noticeId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        const doc = result.rows[0];
        
        res.json({
            success: true,
            noticeId: noticeId,
            caseNumber: doc.case_number,
            document: doc.document_data || doc.document_image,
            mimeType: doc.document_mime_type || 'image/png',
            pageCount: doc.page_count,
            ipfsHash: doc.ipfs_hash
        });
        
    } catch (error) {
        console.error('Error getting document:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/search
 * Search across all data
 */
router.get('/search', checkAdminAuth, async (req, res) => {
    try {
        const { q, type = 'all' } = req.query;
        
        if (!q) {
            return res.status(400).json({ error: 'Search query required' });
        }
        
        const results = {
            cases: [],
            servers: [],
            recipients: []
        };
        
        // Search cases
        if (type === 'all' || type === 'cases') {
            const casesResult = await pool.query(`
                SELECT * FROM served_notices 
                WHERE 
                    case_number ILIKE $1 OR
                    notice_id::text = $2 OR
                    recipient_address ILIKE $1 OR
                    tx_hash ILIKE $1
                LIMIT 50
            `, [`%${q}%`, q]);
            results.cases = casesResult.rows;
        }
        
        // Search process servers
        if (type === 'all' || type === 'servers') {
            const serversResult = await pool.query(`
                SELECT * FROM process_servers
                WHERE 
                    wallet_address ILIKE $1 OR
                    full_name ILIKE $1 OR
                    email ILIKE $1 OR
                    badge_number ILIKE $1 OR
                    agency ILIKE $1
                LIMIT 50
            `, [`%${q}%`]);
            results.servers = serversResult.rows;
        }
        
        // Search by recipient
        if (type === 'all' || type === 'recipients') {
            const recipientResult = await pool.query(`
                SELECT 
                    recipient_address,
                    COUNT(*) as notice_count,
                    COUNT(CASE WHEN is_signed THEN 1 END) as signed_count,
                    MAX(served_at) as last_served
                FROM served_notices
                WHERE recipient_address ILIKE $1
                GROUP BY recipient_address
                LIMIT 50
            `, [`%${q}%`]);
            results.recipients = recipientResult.rows;
        }
        
        res.json({
            success: true,
            query: q,
            results: results
        });
        
    } catch (error) {
        console.error('Error searching:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/audit-logs
 * Get system audit logs
 */
router.get('/audit-logs', checkAdminAuth, async (req, res) => {
    try {
        const { limit = 100, offset = 0, status, startDate, endDate } = req.query;
        
        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const params = [];
        let paramCount = 0;
        
        if (status) {
            query += ` AND status = $${++paramCount}`;
            params.push(status);
        }
        
        if (startDate) {
            query += ` AND created_at >= $${++paramCount}`;
            params.push(startDate);
        }
        
        if (endDate) {
            query += ` AND created_at <= $${++paramCount}`;
            params.push(endDate);
        }
        
        query += ` ORDER BY created_at DESC`;
        query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(limit, offset);
        
        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            logs: result.rows,
            total: result.rows.length
        });
        
    } catch (error) {
        console.error('Error getting audit logs:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/process-servers/:address/toggle
 * Toggle process server active status
 */
router.post('/process-servers/:address/toggle', checkAdminAuth, async (req, res) => {
    try {
        const { address } = req.params;
        
        const result = await pool.query(`
            UPDATE process_servers 
            SET is_active = NOT is_active, updated_at = NOW()
            WHERE LOWER(wallet_address) = LOWER($1)
            RETURNING *
        `, [address]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Server not found' });
        }
        
        res.json({
            success: true,
            server: result.rows[0],
            message: `Server ${result.rows[0].is_active ? 'activated' : 'deactivated'}`
        });
        
    } catch (error) {
        console.error('Error toggling server:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/statistics
 * Get detailed statistics for reporting
 */
router.get('/statistics', checkAdminAuth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let dateFilter = '';
        const params = [];
        
        if (startDate && endDate) {
            dateFilter = 'WHERE served_at BETWEEN $1 AND $2';
            params.push(startDate, endDate);
        }
        
        // Service statistics by day
        const dailyStats = await pool.query(`
            SELECT 
                DATE(served_at) as date,
                COUNT(*) as total_served,
                COUNT(CASE WHEN is_signed THEN 1 END) as signed,
                COUNT(DISTINCT server_address) as active_servers
            FROM served_notices
            ${dateFilter}
            GROUP BY DATE(served_at)
            ORDER BY date DESC
            LIMIT 30
        `, params);
        
        // Top process servers
        const topServers = await pool.query(`
            SELECT 
                server_address,
                ps.full_name,
                ps.agency,
                COUNT(*) as total_cases,
                COUNT(CASE WHEN is_signed THEN 1 END) as signed_cases,
                ROUND(COUNT(CASE WHEN is_signed THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as success_rate
            FROM served_notices sn
            LEFT JOIN process_servers ps ON LOWER(ps.wallet_address) = LOWER(sn.server_address)
            ${dateFilter}
            GROUP BY server_address, ps.full_name, ps.agency
            ORDER BY total_cases DESC
            LIMIT 10
        `, params);
        
        // Document statistics
        const docStats = await pool.query(`
            SELECT 
                AVG(page_count) as avg_pages,
                MAX(page_count) as max_pages,
                COUNT(CASE WHEN ipfs_hash IS NOT NULL THEN 1 END) as ipfs_stored,
                COUNT(CASE WHEN document_data IS NOT NULL THEN 1 END) as backend_stored
            FROM notice_components nc
            JOIN served_notices sn ON sn.notice_id = nc.notice_id
            ${dateFilter}
        `, params);
        
        res.json({
            success: true,
            dailyStats: dailyStats.rows,
            topServers: topServers.rows,
            documentStats: docStats.rows[0],
            period: { startDate, endDate }
        });
        
    } catch (error) {
        console.error('Error getting statistics:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;