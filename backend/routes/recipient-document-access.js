/**
 * RECIPIENT DOCUMENT ACCESS
 * Allows recipients to view documents even after accepting
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');

// Build forensic details from request headers (extracted by middleware in server.js)
function buildForensicDetails(req, extraDetails = {}) {
    const forensic = { ...extraDetails };
    if (req.clientWalletProvider) forensic.walletProvider = req.clientWalletProvider;
    if (req.clientVisitorId) forensic.visitorId = req.clientVisitorId;
    if (req.clientFingerprint) forensic.fingerprint = req.clientFingerprint;
    if (req.clientFingerprintConfidence) forensic.fingerprintConfidence = req.clientFingerprintConfidence;
    if (req.clientScreenResolution) forensic.screen_resolution = req.clientScreenResolution;
    return forensic;
}

// Get notice details for recipient
router.get('/recipient/:address/notices', async (req, res) => {
    try {
        const { address } = req.params;
        
        console.log(`Getting notices for recipient: ${address}`);
        
        // Log recipient access to audit_logs
        const ipAddress = req.clientIp || req.ip;
        const userAgent = req.clientUserAgent || req.headers['user-agent'];
        const acceptLanguage = req.clientLanguage || req.headers['accept-language'];
        const timezone = req.clientTimezone || req.headers['x-timezone'];

        await pool.query(`
            INSERT INTO audit_logs (
                action_type,
                actor_address,
                details,
                ip_address,
                user_agent,
                accept_language,
                timezone,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
            'recipient_notice_query',
            address,
            JSON.stringify(buildForensicDetails(req, {
                endpoint: 'recipient_notices',
                page: 'blockserved',
                referer: req.headers.referer,
                timestamp: new Date().toISOString()
            })),
            ipAddress,
            userAgent,
            acceptLanguage,
            timezone
        ]);
        
        // Query case_service_records where this address is in the recipients array
        // This is where all the data is actually stored when notices are served
        const result = await pool.query(`
            SELECT 
                csr.case_number,
                csr.transaction_hash,
                csr.alert_token_id,
                csr.document_token_id,
                csr.ipfs_hash,
                csr.encryption_key,
                csr.recipients,
                csr.page_count,
                csr.served_at,
                csr.server_address,
                csr.created_at,
                csr.updated_at,
                c.status,
                c.metadata,
                ni.alert_image,
                ni.document_preview
            FROM case_service_records csr
            LEFT JOIN cases c ON c.case_number = csr.case_number
            LEFT JOIN notice_images ni ON ni.case_number = csr.case_number
            WHERE csr.recipients::jsonb ? $1
               OR LOWER(csr.recipients::text) LIKE LOWER($2)
            ORDER BY csr.served_at DESC
        `, [address, `%${address}%`]);
        
        // Transform the data into the format BlockServed expects
        const notices = result.rows.map(row => {
            // Parse metadata if it's a string
            const metadata = typeof row.metadata === 'string' ? 
                JSON.parse(row.metadata) : row.metadata || {};
            
            return {
                notice_id: `NFT-${row.alert_token_id}`,
                alert_token_id: row.alert_token_id,
                document_token_id: row.document_token_id,
                case_number: row.case_number,
                notice_type: metadata.noticeType || 'Legal Notice',
                issuing_agency: metadata.agency || metadata.issuingAgency || 'via Blockserved.com',
                created_at: row.served_at || row.created_at,
                served_at: row.served_at,
                transaction_hash: row.transaction_hash,
                ipfs_document: row.ipfs_hash,
                encryption_key: row.encryption_key,
                alert_image: row.alert_image,
                document_preview: row.document_preview,
                page_count: row.page_count,
                server_address: row.server_address,
                has_document: !!row.ipfs_hash,
                accepted: false, // Can be updated when we add signature tracking
                status: row.status
            };
        });
        
        console.log(`Found ${notices.length} notices for ${address}`);
        
        res.json({
            success: true,
            notices: notices
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
        
        // Log document access to audit_logs
        const ipAddress = req.clientIp || req.ip;
        const userAgent = req.clientUserAgent || req.headers['user-agent'];
        const acceptLanguage = req.clientLanguage || req.headers['accept-language'];
        const timezone = req.clientTimezone || req.headers['x-timezone'];

        await pool.query(`
            INSERT INTO audit_logs (
                action_type,
                actor_address,
                target_id,
                details,
                ip_address,
                user_agent,
                accept_language,
                timezone,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [
            'recipient_document_view',
            address,
            alertId,
            JSON.stringify(buildForensicDetails(req, {
                endpoint: 'recipient_document',
                page: 'blockserved',
                referer: req.headers.referer,
                timestamp: new Date().toISOString()
            })),
            ipAddress,
            userAgent,
            acceptLanguage,
            timezone
        ]);
        
        // Get the document from case_service_records
        const result = await pool.query(`
            SELECT 
                csr.*,
                c.metadata,
                ni.alert_image,
                ni.document_preview
            FROM case_service_records csr
            LEFT JOIN cases c ON c.case_number = csr.case_number
            LEFT JOIN notice_images ni ON ni.case_number = csr.case_number
            WHERE csr.alert_token_id = $1
            AND (csr.recipients::jsonb ? $2 OR LOWER(csr.recipients::text) LIKE LOWER($3))
        `, [alertId, address, `%${address}%`]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Notice not found or you are not the recipient' 
            });
        }
        
        const notice = result.rows[0];
        const metadata = typeof notice.metadata === 'string' ? 
            JSON.parse(notice.metadata) : notice.metadata || {};
        
        res.json({
            success: true,
            notice: {
                alertId: notice.alert_token_id,
                documentId: notice.document_token_id,
                caseNumber: notice.case_number,
                noticeType: metadata.noticeType || 'Legal Notice',
                issuingAgency: metadata.agency || metadata.issuingAgency || 'via Blockserved.com',
                ipfsHash: notice.ipfs_hash,
                encryptionKey: notice.encryption_key,
                alertImage: notice.alert_image,
                documentPreview: notice.document_preview,
                transactionHash: notice.transaction_hash,
                servedAt: notice.served_at,
                pageCount: notice.page_count,
                alreadySigned: false, // Will add signature tracking later
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