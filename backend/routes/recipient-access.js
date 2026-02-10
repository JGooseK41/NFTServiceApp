/**
 * Recipient Access Routes
 * Handles public notice info and view-only access logging
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * GET /api/notices/:noticeId/public
 * Get public notice information (no authentication required)
 */
router.get('/:noticeId/public', async (req, res) => {
    try {
        const { noticeId } = req.params;
        
        console.log(`Getting public info for notice ${noticeId}`);
        
        // Get basic notice info (non-sensitive)
        const result = await pool.query(`
            SELECT 
                sn.notice_id,
                sn.case_number,
                sn.notice_type,
                sn.recipient_address,
                sn.server_address,
                sn.served_at,
                sn.tx_hash,
                sn.is_signed,
                ps.full_name as server_name,
                ps.agency as issuing_agency,
                nc.page_count
            FROM served_notices sn
            LEFT JOIN process_servers ps ON LOWER(ps.wallet_address) = LOWER(sn.server_address)
            LEFT JOIN notice_components nc ON nc.notice_id = sn.notice_id
            WHERE sn.notice_id = $1
        `, [noticeId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Notice not found'
            });
        }
        
        const notice = result.rows[0];
        
        // Return public information only
        res.json({
            noticeId: notice.notice_id,
            caseNumber: notice.case_number,
            noticeType: notice.notice_type || 'Legal Document',
            recipientAddress: notice.recipient_address,
            serverAddress: notice.server_address,
            serverName: notice.server_name || 'Process Server',
            issuingAgency: notice.issuing_agency || 'Court',
            servedAt: notice.served_at,
            txHash: notice.tx_hash,
            isSigned: notice.is_signed,
            pageCount: notice.page_count || 1,
            status: notice.is_signed ? 'Signed for Receipt' : 'Awaiting Signature'
        });
        
    } catch (error) {
        console.error('Error getting public notice info:', error);
        res.status(500).json({
            error: 'Failed to retrieve notice information'
        });
    }
});

/**
 * POST /api/notices/log-view
 * Log view-only access (when recipient declines to sign)
 */
router.post('/log-view', async (req, res) => {
    try {
        const {
            noticeId,
            walletAddress,
            viewType, // 'declined-signature' or 'view-only'
            timestamp
        } = req.body;
        
        console.log(`Logging ${viewType} access for notice ${noticeId}`);
        
        // Create table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notice_views (
                id SERIAL PRIMARY KEY,
                notice_id BIGINT NOT NULL,
                wallet_address VARCHAR(255),
                view_type VARCHAR(50),
                viewed_at TIMESTAMP,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `).catch(e => console.log('Table already exists'));
        
        // Log the view
        await pool.query(`
            INSERT INTO notice_views (
                notice_id,
                wallet_address,
                view_type,
                viewed_at,
                ip_address,
                user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            noticeId,
            walletAddress || 'anonymous',
            viewType,
            timestamp || new Date(),
            req.clientIp || req.ip,
            req.headers['user-agent']
        ]);
        
        // Update served_notices to track that it was viewed
        await pool.query(`
            UPDATE served_notices 
            SET updated_at = NOW()
            WHERE notice_id = $1
        `, [noticeId]);
        
        console.log(`✅ View logged for notice ${noticeId}`);
        
        res.json({
            success: true,
            message: 'View logged successfully',
            viewType: viewType
        });
        
    } catch (error) {
        console.error('Error logging view:', error);
        res.status(500).json({
            error: 'Failed to log view'
        });
    }
});

/**
 * POST /api/notices/:noticeId/signature
 * Log when recipient signs for receipt
 */
router.post('/:noticeId/signature', async (req, res) => {
    try {
        const { noticeId } = req.params;
        const {
            walletAddress,
            signature,
            txHash,
            timestamp
        } = req.body;
        
        console.log(`Recording signature for notice ${noticeId}`);
        
        // Verify recipient
        const verifyResult = await pool.query(`
            SELECT recipient_address 
            FROM served_notices 
            WHERE notice_id = $1
        `, [noticeId]);
        
        if (verifyResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Notice not found'
            });
        }
        
        const notice = verifyResult.rows[0];
        
        if (notice.recipient_address?.toLowerCase() !== walletAddress?.toLowerCase()) {
            return res.status(403).json({
                error: 'Only the recipient can sign for this notice'
            });
        }
        
        // Update notice as signed
        await pool.query(`
            UPDATE served_notices 
            SET 
                is_signed = true,
                signature = $2,
                signature_tx = $3,
                signed_at = $4,
                updated_at = NOW()
            WHERE notice_id = $1
        `, [noticeId, signature, txHash, timestamp || new Date()]);
        
        // Log the signature event
        await pool.query(`
            INSERT INTO notice_views (
                notice_id,
                wallet_address,
                view_type,
                viewed_at
            ) VALUES ($1, $2, 'signed-for-receipt', $3)
        `, [noticeId, walletAddress, timestamp || new Date()]);
        
        console.log(`✅ Signature recorded for notice ${noticeId}`);
        
        res.json({
            success: true,
            message: 'Signature recorded successfully',
            noticeId: noticeId,
            signedAt: timestamp || new Date()
        });
        
    } catch (error) {
        console.error('Error recording signature:', error);
        res.status(500).json({
            error: 'Failed to record signature'
        });
    }
});

/**
 * GET /api/notices/:noticeId/status
 * Get notice status for recipient
 */
router.get('/:noticeId/status', async (req, res) => {
    try {
        const { noticeId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                is_signed,
                signed_at,
                (SELECT COUNT(*) FROM notice_views WHERE notice_id = $1) as view_count,
                (SELECT MAX(viewed_at) FROM notice_views WHERE notice_id = $1) as last_viewed
            FROM served_notices
            WHERE notice_id = $1
        `, [noticeId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Notice not found'
            });
        }
        
        const status = result.rows[0];
        
        res.json({
            noticeId: noticeId,
            isSigned: status.is_signed,
            signedAt: status.signed_at,
            viewCount: parseInt(status.view_count) || 0,
            lastViewed: status.last_viewed,
            status: status.is_signed ? 'Signed for Receipt' : 'Awaiting Signature'
        });
        
    } catch (error) {
        console.error('Error getting notice status:', error);
        res.status(500).json({
            error: 'Failed to get notice status'
        });
    }
});

module.exports = router;