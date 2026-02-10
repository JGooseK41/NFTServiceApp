/**
 * Notice Staging API Routes
 * Handles validation, staging, and confirmation of legal notices
 * 
 * Flow: Frontend → Stage → Validate → Return Contract Params → Await Blockchain Confirmation
 */

const express = require('express');
const router = express.Router();
const blockchainSync = require('../services/blockchain-sync');
const pool = require('../db');

/**
 * POST /api/notices/stage
 * Stage a notice for blockchain submission after validation
 */
router.post('/stage', async (req, res) => {
    try {
        const {
            recipient_address,
            encrypted_ipfs,
            encryption_key,
            issuing_agency, // This will be validated against process_servers.agency
            notice_type,
            case_number,
            case_details,
            legal_rights,
            sponsor_fees,
            metadata_uri,
            server_address // Must match authenticated user
        } = req.body;
        
        console.log('📝 Staging notice request:', {
            recipient: recipient_address,
            server: server_address,
            agency: issuing_agency
        });
        
        // Stage the notice (includes validation)
        const result = await blockchainSync.stageNotice({
            recipient_address,
            encrypted_ipfs,
            encryption_key,
            issuing_agency,
            notice_type,
            case_number,
            case_details,
            legal_rights,
            sponsor_fees,
            metadata_uri,
            server_address
        });
        
        console.log('✅ Notice staged successfully:', result.stagingId);
        
        res.json({
            success: true,
            stagingId: result.stagingId,
            contractParams: result.contractParams,
            message: 'Notice validated and staged. Ready for blockchain submission.'
        });
        
    } catch (error) {
        console.error('❌ Staging error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/notices/stage/:id/status
 * Check the status of a staged notice
 */
router.get('/stage/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        
        const status = await blockchainSync.getNoticeStatus(id);
        
        res.json({
            success: true,
            ...status
        });
        
    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/notices/confirm
 * Confirm a notice was submitted to blockchain
 */
router.post('/confirm', async (req, res) => {
    try {
        const {
            staging_id,
            transaction_hash,
            alert_id,
            document_id
        } = req.body;
        
        // Update staging record with transaction hash
        await pool.query(`
            UPDATE staged_notices
            SET 
                transaction_hash = $2,
                alert_id = $3,
                document_id = $4,
                status = 'submitted',
                submitted_at = NOW()
            WHERE id = $1
        `, [staging_id, transaction_hash, alert_id, document_id]);
        
        res.json({
            success: true,
            message: 'Transaction recorded. Awaiting blockchain confirmation.'
        });
        
    } catch (error) {
        console.error('Error confirming transaction:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/notices/validate-agency
 * Validate that a server's agency matches their registration
 */
router.get('/validate-agency', async (req, res) => {
    try {
        const { server_address } = req.query;
        
        if (!server_address) {
            return res.status(400).json({
                success: false,
                error: 'Server address required'
            });
        }
        
        const result = await pool.query(`
            SELECT 
                wallet_address,
                name,
                agency,
                status,
                server_id
            FROM process_servers
            WHERE wallet_address = $1
        `, [server_address]);
        
        if (result.rows.length === 0) {
            return res.json({
                success: false,
                registered: false,
                error: 'Process server not registered'
            });
        }
        
        const server = result.rows[0];
        
        if (server.status !== 'approved') {
            return res.json({
                success: false,
                registered: true,
                approved: false,
                error: 'Process server not approved',
                status: server.status
            });
        }
        
        res.json({
            success: true,
            registered: true,
            approved: true,
            agency: server.agency,
            name: server.name,
            server_id: server.server_id
        });
        
    } catch (error) {
        console.error('Error validating agency:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/notices/batch/stage
 * Stage multiple notices for batch submission
 */
router.post('/batch/stage', async (req, res) => {
    try {
        const { notices, server_address } = req.body;
        
        if (!Array.isArray(notices) || notices.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Notices array required'
            });
        }
        
        if (notices.length > 10) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 10 notices per batch'
            });
        }
        
        // Get server's agency
        const serverResult = await pool.query(
            'SELECT agency FROM process_servers WHERE wallet_address = $1 AND status = $2',
            [server_address, 'approved']
        );
        
        if (!serverResult.rows.length) {
            return res.status(400).json({
                success: false,
                error: 'Process server not found or not approved'
            });
        }
        
        const serverAgency = serverResult.rows[0].agency;
        const stagedNotices = [];
        const contractParamsArray = [];
        
        // Stage each notice
        for (const notice of notices) {
            // Override issuing_agency with server's registered agency
            notice.issuing_agency = serverAgency;
            notice.server_address = server_address;
            
            const staged = await blockchainSync.stageNotice(notice);
            stagedNotices.push(staged.stagingId);
            contractParamsArray.push(staged.contractParams);
        }
        
        res.json({
            success: true,
            stagingIds: stagedNotices,
            contractParams: contractParamsArray,
            totalFee: notices.length * 25000000, // 25 TRX per notice
            message: `${notices.length} notices staged for batch submission`
        });
        
    } catch (error) {
        console.error('Batch staging error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/notices/recent
 * Get recent notices for a server or recipient
 */
router.get('/recent', async (req, res) => {
    try {
        const { server_address, recipient_address, limit = 10 } = req.query;
        
        let query;
        let params;
        
        if (server_address) {
            query = `
                SELECT 
                    sn.*,
                    ps.agency,
                    ps.name as server_name
                FROM served_notices sn
                LEFT JOIN process_servers ps ON sn.server_address = ps.wallet_address
                WHERE sn.server_address = $1
                ORDER BY sn.created_at DESC
                LIMIT $2
            `;
            params = [server_address, limit];
        } else if (recipient_address) {
            query = `
                SELECT 
                    sn.*,
                    ps.agency,
                    ps.name as server_name
                FROM served_notices sn
                LEFT JOIN process_servers ps ON sn.server_address = ps.wallet_address
                WHERE sn.recipient_address = $1
                ORDER BY sn.created_at DESC
                LIMIT $2
            `;
            params = [recipient_address, limit];
        } else {
            return res.status(400).json({
                success: false,
                error: 'Server or recipient address required'
            });
        }
        
        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            notices: result.rows,
            count: result.rows.length
        });
        
    } catch (error) {
        console.error('Error fetching recent notices:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;