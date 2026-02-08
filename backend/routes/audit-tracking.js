/**
 * Audit Tracking Routes
 * Complete tracking of recipient interactions with notices
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Add wallet provider columns to wallet_connections table
async function initializeWalletProviderColumns() {
    try {
        await pool.query(`
            ALTER TABLE wallet_connections
            ADD COLUMN IF NOT EXISTS wallet_provider VARCHAR(100)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE wallet_connections
            ADD COLUMN IF NOT EXISTS wallet_version VARCHAR(50)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE wallet_connections
            ADD COLUMN IF NOT EXISTS wallet_network VARCHAR(255)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE wallet_connections
            ADD COLUMN IF NOT EXISTS is_in_app_browser BOOLEAN DEFAULT FALSE
        `).catch(() => {});

        // Multi-chain support columns
        await pool.query(`
            ALTER TABLE wallet_connections
            ADD COLUMN IF NOT EXISTS chain_type VARCHAR(50)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE wallet_connections
            ADD COLUMN IF NOT EXISTS chain_id VARCHAR(50)
        `).catch(() => {});

        console.log('✅ Wallet provider columns initialized in wallet_connections');
    } catch (error) {
        console.error('Error initializing wallet provider columns:', error.message);
    }
}

// Initialize on startup
initializeWalletProviderColumns();

/**
 * POST /api/audit/view
 * Record that a notice was viewed
 */
router.post('/view', async (req, res) => {
    try {
        const {
            alertTokenId,
            documentTokenId,
            sessionId,
            viewType = 'direct_link',
            referrer
        } = req.body;
        
        // Get IP and user agent from request - use standardized client forensic data
        const ipAddress = req.clientIp || req.ip;
        const userAgent = req.clientUserAgent || req.headers['user-agent'];
        
        // Record the view event
        const result = await pool.query(
            'SELECT record_audit_event($1, $2, $3, $4, $5, $6, $7, $8) as event_id',
            [
                'view',
                alertTokenId,
                documentTokenId,
                null, // no wallet address yet
                JSON.stringify({ viewType, referrer }),
                sessionId,
                ipAddress,
                userAgent
            ]
        );
        
        // Also update notice_views table
        await pool.query(`
            INSERT INTO notice_views (
                notice_id,
                alert_token_id,
                document_token_id,
                viewer_address,
                ip_address,
                user_agent,
                session_id,
                view_type,
                referrer_url,
                viewed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        `, [
            alertTokenId,
            alertTokenId,
            documentTokenId,
            null,
            ipAddress,
            userAgent,
            sessionId,
            viewType,
            referrer
        ]);
        
        res.json({
            success: true,
            eventId: result.rows[0].event_id,
            message: 'View recorded successfully'
        });
        
    } catch (error) {
        console.error('Error recording view:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/audit/wallet-connect
 * Record wallet connection event
 */
router.post('/wallet-connect', async (req, res) => {
    try {
        const {
            walletAddress,
            alertTokenId,
            documentTokenId,
            sessionId,
            network,
            walletType = 'tronlink',
            connectionMethod = 'browser_extension',
            // Wallet provider fields
            walletProvider,
            walletVersion,
            walletNetwork,
            isInAppBrowser = false,
            // Multi-chain support
            chainType,
            chainId
        } = req.body;
        
        const ipAddress = req.clientIp || req.ip;
        const userAgent = req.headers['user-agent'];
        
        // Check if this wallet is the intended recipient
        const recipientCheck = await pool.query(`
            SELECT recipient_address, case_number 
            FROM token_tracking 
            WHERE token_id = $1 OR token_id = $2
            LIMIT 1
        `, [alertTokenId, documentTokenId]);
        
        const isRecipient = recipientCheck.rows.length > 0 && 
                           recipientCheck.rows[0].recipient_address?.toLowerCase() === walletAddress?.toLowerCase();
        
        // Use detected wallet provider or fall back to walletType
        const detectedProvider = walletProvider || walletType || 'Unknown';

        // Determine chain type if not provided
        const detectedChainType = chainType ||
            (network?.includes('tron') ? 'tron' :
             network?.includes('eth') ? 'ethereum' :
             network?.includes('bsc') ? 'bsc' :
             network?.includes('polygon') ? 'polygon' : null);

        // Record wallet connection with wallet provider info
        await pool.query(`
            INSERT INTO wallet_connections (
                wallet_address,
                alert_token_id,
                document_token_id,
                case_number,
                network,
                wallet_type,
                connection_method,
                session_id,
                ip_address,
                user_agent,
                is_recipient,
                viewed_notice,
                wallet_provider,
                wallet_version,
                wallet_network,
                is_in_app_browser,
                chain_type,
                chain_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (wallet_address, session_id, alert_token_id)
            DO UPDATE SET
                connection_timestamp = CURRENT_TIMESTAMP,
                viewed_notice = true,
                wallet_provider = COALESCE(EXCLUDED.wallet_provider, wallet_connections.wallet_provider),
                wallet_version = COALESCE(EXCLUDED.wallet_version, wallet_connections.wallet_version),
                wallet_network = COALESCE(EXCLUDED.wallet_network, wallet_connections.wallet_network),
                is_in_app_browser = COALESCE(EXCLUDED.is_in_app_browser, wallet_connections.is_in_app_browser),
                chain_type = COALESCE(EXCLUDED.chain_type, wallet_connections.chain_type),
                chain_id = COALESCE(EXCLUDED.chain_id, wallet_connections.chain_id)
        `, [
            walletAddress,
            alertTokenId,
            documentTokenId,
            recipientCheck.rows[0]?.case_number,
            network,
            walletType,
            connectionMethod,
            sessionId,
            ipAddress,
            userAgent,
            isRecipient,
            detectedProvider,
            walletVersion || null,
            walletNetwork || null,
            isInAppBrowser,
            detectedChainType,
            chainId || null
        ]);

        // Log wallet provider for debugging
        console.log(`Wallet connected: ${walletAddress} using ${detectedProvider} ${walletVersion || ''} (${connectionMethod})`);

        // Record audit event with comprehensive wallet info
        await pool.query(
            'SELECT record_audit_event($1, $2, $3, $4, $5, $6, $7, $8)',
            [
                'wallet_connect',
                alertTokenId,
                documentTokenId,
                walletAddress,
                JSON.stringify({
                    // Network info
                    network,
                    walletNetwork,
                    // Wallet identification
                    walletProvider: detectedProvider,
                    walletVersion,
                    walletType,
                    connectionMethod,
                    isInAppBrowser,
                    // Recipient verification
                    isRecipient,
                    // Multi-chain ready metadata
                    chainType: network?.includes('tron') ? 'tron' :
                               network?.includes('eth') ? 'ethereum' :
                               network?.includes('bsc') ? 'bsc' :
                               network?.includes('polygon') ? 'polygon' : 'unknown'
                }),
                sessionId,
                ipAddress,
                userAgent
            ]
        );
        
        // Update notice_views with wallet address
        await pool.query(`
            UPDATE notice_views
            SET wallet_address = $1,
                wallet_connected = true,
                connection_timestamp = CURRENT_TIMESTAMP
            WHERE session_id = $2
            AND (alert_token_id = $3 OR document_token_id = $4)
        `, [walletAddress, sessionId, alertTokenId, documentTokenId]);
        
        res.json({
            success: true,
            isRecipient,
            message: isRecipient ? 
                'Wallet connected - you are the intended recipient' : 
                'Wallet connected - you are not the intended recipient'
        });
        
    } catch (error) {
        console.error('Error recording wallet connection:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/audit/sign-attempt
 * Record signature attempt
 */
router.post('/sign-attempt', async (req, res) => {
    try {
        const {
            documentTokenId,
            alertTokenId,
            walletAddress,
            sessionId,
            status = 'initiated'
        } = req.body;
        
        const ipAddress = req.clientIp || req.ip;
        
        // Get recipient address and case number
        const tokenInfo = await pool.query(`
            SELECT recipient_address, case_number
            FROM token_tracking
            WHERE token_id = $1 OR token_id = $2
            LIMIT 1
        `, [documentTokenId, alertTokenId]);
        
        const isCorrectRecipient = tokenInfo.rows[0]?.recipient_address?.toLowerCase() === walletAddress?.toLowerCase();
        
        // Record signature attempt
        const result = await pool.query(`
            INSERT INTO signature_attempts (
                document_token_id,
                alert_token_id,
                case_number,
                wallet_address,
                attempt_status,
                session_id,
                ip_address,
                is_correct_recipient,
                recipient_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `, [
            documentTokenId,
            alertTokenId,
            tokenInfo.rows[0]?.case_number,
            walletAddress,
            status,
            sessionId,
            ipAddress,
            isCorrectRecipient,
            tokenInfo.rows[0]?.recipient_address
        ]);
        
        // Record audit event
        await pool.query(
            'SELECT record_audit_event($1, $2, $3, $4, $5, $6, $7, $8)',
            [
                'sign_attempt',
                alertTokenId,
                documentTokenId,
                walletAddress,
                JSON.stringify({ 
                    status,
                    isCorrectRecipient,
                    attemptId: result.rows[0].id
                }),
                sessionId,
                ipAddress,
                req.headers['user-agent']
            ]
        );
        
        // Update wallet connection
        await pool.query(`
            UPDATE wallet_connections
            SET attempted_signature = true
            WHERE wallet_address = $1
            AND session_id = $2
            AND (alert_token_id = $3 OR document_token_id = $4)
        `, [walletAddress, sessionId, alertTokenId, documentTokenId]);
        
        res.json({
            success: true,
            attemptId: result.rows[0].id,
            isCorrectRecipient,
            message: isCorrectRecipient ? 
                'Signature attempt recorded' : 
                'Warning: You are not the intended recipient'
        });
        
    } catch (error) {
        console.error('Error recording signature attempt:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/audit/sign-complete
 * Record successful signature
 */
router.post('/sign-complete', async (req, res) => {
    try {
        const {
            attemptId,
            documentTokenId,
            alertTokenId,
            walletAddress,
            transactionHash,
            sessionId
        } = req.body;
        
        // Update signature attempt
        await pool.query(`
            UPDATE signature_attempts
            SET attempt_status = 'success',
                transaction_hash = $1
            WHERE id = $2
        `, [transactionHash, attemptId]);
        
        // Update token tracking
        await pool.query(`
            UPDATE token_tracking
            SET is_signed = true,
                signed_at = CURRENT_TIMESTAMP,
                signature_tx_hash = $1,
                status = 'signed'
            WHERE token_id = $2 AND token_type = 'document'
        `, [transactionHash, documentTokenId]);
        
        // Update wallet connection
        await pool.query(`
            UPDATE wallet_connections
            SET completed_signature = true,
                signature_tx_hash = $1
            WHERE wallet_address = $2
            AND session_id = $3
            AND (alert_token_id = $4 OR document_token_id = $5)
        `, [transactionHash, walletAddress, sessionId, alertTokenId, documentTokenId]);
        
        // Record audit event
        await pool.query(
            'SELECT record_audit_event($1, $2, $3, $4, $5, $6, $7, $8)',
            [
                'sign_success',
                alertTokenId,
                documentTokenId,
                walletAddress,
                JSON.stringify({ 
                    transactionHash,
                    attemptId
                }),
                sessionId,
                req.clientIp || req.ip,
                req.headers['user-agent']
            ]
        );
        
        res.json({
            success: true,
            message: 'Signature recorded successfully',
            transactionHash
        });
        
    } catch (error) {
        console.error('Error recording signature:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/audit/journey/:alertTokenId
 * Get complete recipient journey for a notice
 */
router.get('/journey/:alertTokenId', async (req, res) => {
    try {
        const { alertTokenId } = req.params;
        
        // Get journey summary
        const journeyResult = await pool.query(`
            SELECT * FROM recipient_journey
            WHERE alert_token_id = $1
        `, [alertTokenId]);
        
        // Get detailed audit trail
        const auditResult = await pool.query(
            'SELECT * FROM get_complete_audit_trail($1, NULL)',
            [alertTokenId]
        );
        
        // Get all view events
        const viewsResult = await pool.query(`
            SELECT * FROM notice_views
            WHERE alert_token_id = $1
            ORDER BY viewed_at
        `, [alertTokenId]);
        
        // Get wallet connections
        const walletsResult = await pool.query(`
            SELECT * FROM wallet_connections
            WHERE alert_token_id = $1
            ORDER BY connection_timestamp
        `, [alertTokenId]);
        
        // Get signature attempts
        const signaturesResult = await pool.query(`
            SELECT * FROM signature_attempts
            WHERE alert_token_id = $1
            ORDER BY attempt_timestamp
        `, [alertTokenId]);
        
        res.json({
            success: true,
            journey: journeyResult.rows[0] || {},
            audit_trail: auditResult.rows,
            views: viewsResult.rows,
            wallet_connections: walletsResult.rows,
            signature_attempts: signaturesResult.rows
        });
        
    } catch (error) {
        console.error('Error fetching journey:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/audit/stats/:caseNumber
 * Get engagement statistics for a case
 */
router.get('/stats/:caseNumber', async (req, res) => {
    try {
        const { caseNumber } = req.params;
        
        // Get all journeys for this case
        const journeysResult = await pool.query(`
            SELECT * FROM recipient_journey
            WHERE case_number = $1
        `, [caseNumber]);
        
        // Calculate statistics
        const stats = {
            total_recipients: journeysResult.rows.length,
            viewed: journeysResult.rows.filter(r => r.total_views > 0).length,
            wallets_connected: journeysResult.rows.filter(r => r.wallets_connected > 0).length,
            signed: journeysResult.rows.filter(r => r.journey_status === 'completed').length,
            average_engagement_score: journeysResult.rows.reduce((sum, r) => sum + (r.engagement_score || 0), 0) / journeysResult.rows.length,
            average_time_to_sign: null,
            detailed_journeys: journeysResult.rows
        };
        
        // Calculate average time to sign (excluding nulls)
        const timesToSign = journeysResult.rows
            .filter(r => r.seconds_to_signature)
            .map(r => r.seconds_to_signature);
        
        if (timesToSign.length > 0) {
            stats.average_time_to_sign = timesToSign.reduce((a, b) => a + b, 0) / timesToSign.length;
        }
        
        res.json({
            success: true,
            caseNumber,
            stats
        });
        
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;