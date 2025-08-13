/**
 * Document Access Control Routes
 * Ensures only recipients can view documents
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const crypto = require('crypto');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * POST /api/access/verify-recipient
 * Verify if connected wallet is the recipient
 */
router.post('/verify-recipient', async (req, res) => {
    try {
        const { 
            walletAddress, 
            alertTokenId, 
            documentTokenId,
            signature // Optional: signed message for extra verification
        } = req.body;
        
        // Get the intended recipient and server from token tracking or notice_components
        let result;
        
        // First try token_tracking table
        try {
            result = await pool.query(`
                SELECT 
                    recipient_address,
                    case_number,
                    notice_type,
                    issuing_agency,
                    server_address,
                    status
                FROM token_tracking
                WHERE token_id IN ($1, $2)
                LIMIT 1
            `, [alertTokenId, documentTokenId]);
        } catch (e) {
            // token_tracking table might not exist
            result = { rows: [] };
        }
        
        // If not found in token_tracking, try notice_components
        if (result.rows.length === 0) {
            console.log(`Checking notice_components for tokens: alert=${alertTokenId}, doc=${documentTokenId}`);
            result = await pool.query(`
                SELECT 
                    recipient_address,
                    case_number,
                    notice_type,
                    issuing_agency,
                    server_address,
                    status
                FROM notice_components
                WHERE alert_token_id IN ($1, $2) OR document_token_id IN ($1, $2)
                LIMIT 1
            `, [alertTokenId, documentTokenId]);
        }
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Notice not found in database'
            });
        }
        
        const notice = result.rows[0];
        const isRecipient = notice.recipient_address?.toLowerCase() === walletAddress?.toLowerCase();
        const isServer = notice.server_address?.toLowerCase() === walletAddress?.toLowerCase();
        const hasAccess = isRecipient || isServer;
        
        console.log('Access check:', {
            walletAddress: walletAddress?.toLowerCase(),
            recipientAddress: notice.recipient_address?.toLowerCase(),
            serverAddress: notice.server_address?.toLowerCase(),
            isRecipient,
            isServer,
            hasAccess
        });
        
        // Create access token if recipient or server
        let accessToken = null;
        if (hasAccess) {
            // Generate time-limited access token
            accessToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour
            
            // Store access token
            await pool.query(`
                INSERT INTO document_access_tokens (
                    token,
                    wallet_address,
                    alert_token_id,
                    document_token_id,
                    expires_at,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                ON CONFLICT (wallet_address, alert_token_id) 
                DO UPDATE SET 
                    token = $1,
                    expires_at = $5,
                    created_at = CURRENT_TIMESTAMP
            `, [accessToken, walletAddress, alertTokenId, documentTokenId, expiresAt]);
        }
        
        // Log access attempt
        await pool.query(`
            INSERT INTO access_attempts (
                wallet_address,
                alert_token_id,
                document_token_id,
                is_recipient,
                granted,
                denial_reason,
                ip_address,
                user_agent,
                attempted_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        `, [
            walletAddress,
            alertTokenId,
            documentTokenId,
            isRecipient,
            hasAccess,
            isServer ? 'process_server_access' : (isRecipient ? null : 'not_recipient'),
            req.ip,
            req.headers['user-agent']
        ]);
        
        res.json({
            success: true,
            isRecipient,
            isServer,
            accessGranted: hasAccess,
            accessToken: hasAccess ? accessToken : null,
            publicInfo: {
                caseNumber: notice.case_number,
                noticeType: notice.notice_type,
                issuingAgency: notice.issuing_agency,
                serverAddress: notice.server_address,
                status: notice.status
            },
            message: isRecipient ? 
                'Access granted - you are the recipient' : 
                isServer ?
                'Access granted - you are the process server' :
                'Access denied - you are not the recipient or server. You can only view public notice information.'
        });
        
    } catch (error) {
        console.error('Error verifying recipient:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/access/public/:tokenId
 * Get public information about a notice (available to anyone)
 */
router.get('/public/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        
        // Get public information only
        const result = await pool.query(`
            SELECT 
                t.token_id,
                t.token_type,
                t.case_number,
                t.notice_type,
                t.issuing_agency,
                t.server_address,
                t.status,
                t.is_delivered,
                t.is_signed,
                t.created_at,
                t.public_text,
                nc.alert_thumbnail_data,
                nc.alert_thumbnail_mime_type
            FROM token_tracking t
            LEFT JOIN notice_components nc ON nc.alert_token_id = t.token_id
            WHERE t.token_id = $1
        `, [tokenId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Notice not found'
            });
        }
        
        const notice = result.rows[0];
        
        // Return only public information
        res.json({
            success: true,
            publicData: {
                tokenId: notice.token_id,
                tokenType: notice.token_type,
                caseNumber: notice.case_number,
                noticeType: notice.notice_type,
                issuingAgency: notice.issuing_agency,
                serverAddress: notice.server_address,
                status: notice.status,
                isDelivered: notice.is_delivered,
                isSigned: notice.is_signed,
                createdAt: notice.created_at,
                publicText: notice.public_text,
                // Alert thumbnail is public (shows notice was served)
                alertThumbnail: notice.alert_thumbnail_data ? 
                    `data:${notice.alert_thumbnail_mime_type};base64,${notice.alert_thumbnail_data}` : 
                    null
            },
            message: 'This is public notice information. Document content requires recipient verification.'
        });
        
    } catch (error) {
        console.error('Error fetching public info:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/access/document/:documentTokenId
 * Get document content (requires valid access token)
 */
router.get('/document/:documentTokenId', async (req, res) => {
    try {
        const { documentTokenId } = req.params;
        const accessToken = req.headers['x-access-token'] || req.query.token;
        
        if (!accessToken) {
            return res.status(401).json({
                success: false,
                error: 'Access token required. Please verify your wallet first.'
            });
        }
        
        // Verify access token
        const tokenResult = await pool.query(`
            SELECT 
                wallet_address,
                alert_token_id,
                document_token_id,
                expires_at
            FROM document_access_tokens
            WHERE token = $1
            AND document_token_id = $2
            AND expires_at > NOW()
        `, [accessToken, documentTokenId]);
        
        if (tokenResult.rows.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'Invalid or expired access token. Please verify your wallet again.'
            });
        }
        
        const tokenData = tokenResult.rows[0];
        
        // Get document data
        const docResult = await pool.query(`
            SELECT 
                nc.document_data,
                nc.document_mime_type,
                nc.document_unencrypted_url,
                t.ipfs_hash,
                t.document_hash,
                t.page_count
            FROM notice_components nc
            JOIN token_tracking t ON t.token_id = nc.document_token_id
            WHERE nc.document_token_id = $1
        `, [documentTokenId]);
        
        if (docResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }
        
        const document = docResult.rows[0];
        
        // Log document access
        await pool.query(`
            INSERT INTO document_access_log (
                document_token_id,
                wallet_address,
                access_token_used,
                ip_address,
                accessed_at
            ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `, [documentTokenId, tokenData.wallet_address, accessToken, req.ip]);
        
        // Update access token usage
        await pool.query(`
            UPDATE document_access_tokens
            SET last_used_at = CURRENT_TIMESTAMP,
                usage_count = COALESCE(usage_count, 0) + 1
            WHERE token = $1
        `, [accessToken]);
        
        // Return document data
        res.json({
            success: true,
            document: {
                data: document.document_data ? 
                    `data:${document.document_mime_type};base64,${document.document_data}` : 
                    document.document_unencrypted_url,
                mimeType: document.document_mime_type,
                ipfsHash: document.ipfs_hash,
                documentHash: document.document_hash,
                pageCount: document.page_count
            },
            accessInfo: {
                walletAddress: tokenData.wallet_address,
                expiresAt: tokenData.expires_at
            }
        });
        
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/access/revoke
 * Revoke access token
 */
router.post('/revoke', async (req, res) => {
    try {
        const { accessToken } = req.body;
        
        await pool.query(`
            UPDATE document_access_tokens
            SET expires_at = CURRENT_TIMESTAMP,
                revoked = true
            WHERE token = $1
        `, [accessToken]);
        
        res.json({
            success: true,
            message: 'Access token revoked'
        });
        
    } catch (error) {
        console.error('Error revoking token:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;