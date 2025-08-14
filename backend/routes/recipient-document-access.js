/**
 * RECIPIENT DOCUMENT ACCESS
 * Allows recipients to view documents even after accepting
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Create pool instance
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') 
        ? { rejectUnauthorized: false }
        : false
});

// Get notice details for recipient
router.get('/recipient/:address/notices', async (req, res) => {
    try {
        const { address } = req.params;
        
        console.log(`Getting notices for recipient: ${address}`);
        
        // Get all notices for this recipient
        const result = await pool.query(`
            SELECT 
                nc.*,
                nd.thumbnail_data,
                nd.document_data,
                nd.document_type,
                nv.viewed_at,
                nv.signed_at,
                nv.ip_address as view_ip,
                nv.user_agent as view_agent
            FROM notice_components nc
            LEFT JOIN notice_documents nd ON nc.notice_id = nd.notice_id
            LEFT JOIN notice_views nv ON nc.alert_id = nv.alert_id AND nv.wallet_address = $1
            WHERE LOWER(nc.recipient_address) = LOWER($1)
            ORDER BY nc.created_at DESC
        `, [address]);
        
        res.json({
            success: true,
            notices: result.rows
        });
        
    } catch (error) {
        console.error('Error getting recipient notices:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve notices' 
        });
    }
});

// Get specific notice document for viewing
router.get('/recipient/:address/notice/:alertId/document', async (req, res) => {
    try {
        const { address, alertId } = req.params;
        
        console.log(`Recipient ${address} requesting document for alert ${alertId}`);
        
        // Get the document
        const result = await pool.query(`
            SELECT 
                nc.*,
                nd.document_data,
                nd.thumbnail_data,
                nd.document_type,
                nv.signed_at,
                nv.viewed_at
            FROM notice_components nc
            LEFT JOIN notice_documents nd ON nc.notice_id = nd.notice_id
            LEFT JOIN notice_views nv ON nc.alert_id = nv.alert_id AND nv.wallet_address = $1
            WHERE nc.alert_id = $2 
            AND LOWER(nc.recipient_address) = LOWER($1)
        `, [address, alertId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Notice not found or you are not the recipient' 
            });
        }
        
        const notice = result.rows[0];
        
        // Check if already signed
        const alreadySigned = notice.signed_at ? true : false;
        
        res.json({
            success: true,
            notice: {
                alertId: notice.alert_id,
                documentId: notice.document_id,
                caseNumber: notice.case_number,
                noticeType: notice.notice_type,
                issuingAgency: notice.issuing_agency,
                document: notice.document_data,
                thumbnail: notice.thumbnail_data,
                documentType: notice.document_type,
                signedAt: notice.signed_at,
                viewedAt: notice.viewed_at,
                alreadySigned: alreadySigned,
                canView: true // Recipients can always view their documents
            }
        });
        
    } catch (error) {
        console.error('Error getting document:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve document' 
        });
    }
});

// Record document acceptance/signature
router.post('/recipient/:address/notice/:alertId/accept', async (req, res) => {
    try {
        const { address, alertId } = req.params;
        const { signature, ipAddress, userAgent } = req.body;
        
        console.log(`Recording acceptance for alert ${alertId} by ${address}`);
        
        // Check if already signed
        const existing = await pool.query(
            'SELECT signed_at FROM notice_views WHERE alert_id = $1 AND wallet_address = $2',
            [alertId, address]
        );
        
        if (existing.rows.length > 0 && existing.rows[0].signed_at) {
            // Already signed - return success but note it
            return res.json({
                success: true,
                alreadySigned: true,
                signedAt: existing.rows[0].signed_at,
                message: 'Document was already accepted'
            });
        }
        
        // Record the signature
        await pool.query(`
            INSERT INTO notice_views (
                alert_id, 
                wallet_address, 
                signed_at, 
                signature_data,
                ip_address,
                user_agent
            ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5)
            ON CONFLICT (alert_id, wallet_address) 
            DO UPDATE SET 
                signed_at = CURRENT_TIMESTAMP,
                signature_data = $3,
                ip_address = $4,
                user_agent = $5
        `, [alertId, address, signature, ipAddress, userAgent]);
        
        res.json({
            success: true,
            alreadySigned: false,
            message: 'Document accepted successfully'
        });
        
    } catch (error) {
        console.error('Error recording acceptance:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to record acceptance' 
        });
    }
});

// Get document viewing status
router.get('/recipient/:address/notice/:alertId/status', async (req, res) => {
    try {
        const { address, alertId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                viewed_at,
                signed_at,
                signature_data
            FROM notice_views
            WHERE alert_id = $1 AND wallet_address = $2
        `, [alertId, address]);
        
        if (result.rows.length === 0) {
            return res.json({
                success: true,
                status: 'not_viewed',
                viewed: false,
                signed: false
            });
        }
        
        const view = result.rows[0];
        
        res.json({
            success: true,
            status: view.signed_at ? 'signed' : 'viewed',
            viewed: true,
            signed: view.signed_at ? true : false,
            viewedAt: view.viewed_at,
            signedAt: view.signed_at
        });
        
    } catch (error) {
        console.error('Error getting status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get status' 
        });
    }
});

module.exports = router;