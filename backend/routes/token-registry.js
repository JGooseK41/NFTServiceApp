/**
 * Token Registry Routes
 * Comprehensive token tracking and querying system
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * POST /api/tokens/register
 * Register a new token pair with all metadata
 */
router.post('/register', async (req, res) => {
    let client;
    
    try {
        const {
            alertTokenId,
            documentTokenId,
            caseNumber,
            transactionHash,
            blockNumber,
            blockchainTimestamp,
            serverAddress,
            recipientAddress,
            recipientName,
            noticeType,
            issuingAgency,
            ipfsHash,
            documentHash,
            pageCount,
            publicText
        } = req.body;
        
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Insert alert token
        await client.query(`
            INSERT INTO token_tracking (
                token_id, token_type, paired_token_id, case_number,
                transaction_hash, block_number, blockchain_timestamp,
                server_address, recipient_address, recipient_name,
                notice_type, issuing_agency, public_text,
                is_delivered, status
            ) VALUES ($1, 'alert', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, 'delivered')
        `, [
            alertTokenId, documentTokenId, caseNumber,
            transactionHash, blockNumber, blockchainTimestamp,
            serverAddress, recipientAddress, recipientName,
            noticeType, issuingAgency, publicText
        ]);
        
        // Insert document token
        await client.query(`
            INSERT INTO token_tracking (
                token_id, token_type, paired_token_id, case_number,
                transaction_hash, block_number, blockchain_timestamp,
                server_address, recipient_address, recipient_name,
                notice_type, issuing_agency, ipfs_hash, document_hash,
                page_count, status
            ) VALUES ($1, 'document', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending_signature')
        `, [
            documentTokenId, alertTokenId, caseNumber,
            transactionHash, blockNumber, blockchainTimestamp,
            serverAddress, recipientAddress, recipientName,
            noticeType, issuingAgency, ipfsHash, documentHash,
            pageCount || 1
        ]);
        
        // Update notice_components if it exists
        await client.query(`
            UPDATE notice_components 
            SET alert_token_id = $1,
                document_token_id = $2,
                creation_tx_hash = $3,
                blockchain_timestamp = $4,
                block_number = $5
            WHERE (notice_id = $1::TEXT OR notice_id = $2::TEXT)
                AND case_number = $6
        `, [alertTokenId, documentTokenId, transactionHash, blockchainTimestamp, blockNumber, caseNumber]);
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Token pair registered successfully',
            data: {
                alertTokenId,
                documentTokenId,
                unifiedReference: `${caseNumber}-${alertTokenId}-${documentTokenId}`
            }
        });
        
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error registering tokens:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * GET /api/tokens/:tokenId
 * Get complete information about a token
 */
router.get('/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        
        // Use the comprehensive view
        const result = await pool.query(`
            SELECT * FROM comprehensive_notice_view 
            WHERE alert_token_id = $1 OR document_token_id = $1
        `, [tokenId]);
        
        if (result.rows.length === 0) {
            // Try the search function
            const searchResult = await pool.query(
                'SELECT * FROM find_notice_by_any_id($1)',
                [tokenId]
            );
            
            if (searchResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Token not found'
                });
            }
            
            return res.json({
                success: true,
                data: searchResult.rows[0]
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error fetching token:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/tokens/case/:caseNumber
 * Get all tokens for a case
 */
router.get('/case/:caseNumber', async (req, res) => {
    try {
        const { caseNumber } = req.params;
        
        const result = await pool.query(`
            SELECT * FROM comprehensive_notice_view 
            WHERE case_number = $1
            ORDER BY created_at DESC
        `, [caseNumber]);
        
        res.json({
            success: true,
            count: result.rows.length,
            tokens: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching case tokens:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/tokens/tx/:transactionHash
 * Find tokens by transaction hash
 */
router.get('/tx/:transactionHash', async (req, res) => {
    try {
        const { transactionHash } = req.params;
        
        const result = await pool.query(`
            SELECT * FROM token_tracking 
            WHERE transaction_hash = $1 
               OR signature_tx_hash = $1
        `, [transactionHash]);
        
        res.json({
            success: true,
            count: result.rows.length,
            tokens: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching by tx hash:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/tokens/:tokenId/history
 * Get complete history of a token
 */
router.get('/:tokenId/history', async (req, res) => {
    try {
        const { tokenId } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM get_notice_history($1)',
            [tokenId]
        );
        
        res.json({
            success: true,
            tokenId,
            history: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching token history:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/tokens/:tokenId/sign
 * Record document signature
 */
router.post('/:tokenId/sign', async (req, res) => {
    let client;
    
    try {
        const { tokenId } = req.params;
        const { signatureTxHash, signerAddress } = req.body;
        
        client = await pool.connect();
        
        const result = await client.query(`
            UPDATE token_tracking 
            SET is_signed = true,
                signed_at = CURRENT_TIMESTAMP,
                signature_tx_hash = $2,
                status = 'signed'
            WHERE token_id = $1 AND token_type = 'document'
            RETURNING *
        `, [tokenId, signatureTxHash]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Document token not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Document signature recorded',
            token: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error recording signature:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * GET /api/tokens/search
 * Advanced search with multiple parameters
 */
router.get('/search', async (req, res) => {
    try {
        const { 
            server, 
            recipient, 
            startDate, 
            endDate, 
            status,
            noticeType 
        } = req.query;
        
        let query = 'SELECT * FROM comprehensive_notice_view WHERE 1=1';
        const params = [];
        let paramCount = 1;
        
        if (server) {
            query += ` AND server_address = $${paramCount++}`;
            params.push(server);
        }
        
        if (recipient) {
            query += ` AND recipient_address = $${paramCount++}`;
            params.push(recipient);
        }
        
        if (startDate) {
            query += ` AND created_at >= $${paramCount++}`;
            params.push(startDate);
        }
        
        if (endDate) {
            query += ` AND created_at <= $${paramCount++}`;
            params.push(endDate);
        }
        
        if (status === 'signed') {
            query += ' AND document_signed = true';
        } else if (status === 'pending') {
            query += ' AND document_signed = false';
        }
        
        if (noticeType) {
            query += ` AND notice_type = $${paramCount++}`;
            params.push(noticeType);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            count: result.rows.length,
            results: result.rows
        });
        
    } catch (error) {
        console.error('Error searching tokens:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;