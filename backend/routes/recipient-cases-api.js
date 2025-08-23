/**
 * Recipient Cases API
 * Handles fetching cases/notices for recipients from case_service_records
 * This replaces the old recipient-api that was querying non-existent tables
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Ensure required columns exist on startup
async function ensureColumns() {
    try {
        // Add missing columns if they don't exist
        await pool.query(`
            ALTER TABLE case_service_records 
            ADD COLUMN IF NOT EXISTS server_name VARCHAR(255) DEFAULT 'Process Server'
        `).catch(() => {});
        
        await pool.query(`
            ALTER TABLE case_service_records 
            ADD COLUMN IF NOT EXISTS issuing_agency VARCHAR(255) DEFAULT 'Fort Lauderdale Police'
        `).catch(() => {});
        
        await pool.query(`
            ALTER TABLE case_service_records 
            ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1
        `).catch(() => {});
        
        await pool.query(`
            ALTER TABLE case_service_records 
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'served'
        `).catch(() => {});
        
        console.log('✅ Ensured case_service_records has all required columns');
    } catch (error) {
        console.log('⚠️ Could not add columns:', error.message);
    }
}

// Run on module load
ensureColumns();

/**
 * GET /api/recipient-cases/wallet/:address
 * Get all cases served to a specific wallet address
 */
router.get('/wallet/:address', async (req, res) => {
    try {
        const { address } = req.params;
        console.log(`Fetching cases for wallet: ${address}`);
        
        if (!address || !/^T[A-Za-z0-9]{33}$/.test(address)) {
            return res.status(400).json({ 
                error: 'Invalid wallet address',
                success: false 
            });
        }
        
        // Query case_service_records for cases where this wallet is a recipient
        const query = `
            SELECT 
                case_number,
                recipients,
                transaction_hash,
                alert_token_id,
                document_token_id,
                ipfs_hash,
                served_at,
                server_name,
                issuing_agency,
                page_count,
                status
            FROM case_service_records
            WHERE recipients::jsonb ? $1
               OR LOWER(recipients::text) LIKE LOWER($2)
            ORDER BY served_at DESC
        `;
        
        const result = await pool.query(query, [address, `%${address}%`]);
        
        // Transform data for frontend
        const notices = result.rows.map(row => {
            // Parse recipients
            let recipientsList = [];
            try {
                recipientsList = typeof row.recipients === 'string' ? 
                    JSON.parse(row.recipients) : row.recipients;
            } catch (e) {
                console.log('Error parsing recipients:', e);
            }
            
            return {
                case_number: row.case_number,
                alert_token_id: row.alert_token_id,
                document_token_id: row.document_token_id,
                transaction_hash: row.transaction_hash,
                ipfs_hash: row.ipfs_hash,
                served_at: row.served_at,
                server_name: row.server_name || 'Process Server',
                issuing_agency: row.issuing_agency || 'Fort Lauderdale Police',
                page_count: row.page_count || 1,
                status: row.status || 'served',
                recipients_count: recipientsList.length,
                is_recipient: recipientsList.includes(address)
            };
        });
        
        console.log(`Found ${notices.length} notices for wallet ${address}`);
        
        res.json({
            success: true,
            notices: notices,
            total: notices.length,
            wallet: address
        });
        
    } catch (error) {
        console.error('Error fetching recipient cases:', error);
        res.status(500).json({ 
            error: 'Failed to fetch notices',
            success: false,
            details: error.message
        });
    }
});

/**
 * GET /api/recipient-cases/:caseNumber/document
 * Get document details for a specific case
 */
router.get('/:caseNumber/document', async (req, res) => {
    try {
        const { caseNumber } = req.params;
        console.log(`Fetching document for case: ${caseNumber}`);
        
        const query = `
            SELECT 
                case_number,
                ipfs_hash,
                document_token_id,
                page_count,
                served_at,
                server_name,
                issuing_agency,
                status
            FROM case_service_records
            WHERE case_number = $1
        `;
        
        const result = await pool.query(query, [caseNumber]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Case not found',
                success: false
            });
        }
        
        const caseData = result.rows[0];
        
        res.json({
            success: true,
            notice: {
                case_number: caseData.case_number,
                ipfs_hash: caseData.ipfs_hash,
                document_token_id: caseData.document_token_id,
                page_count: caseData.page_count,
                served_at: caseData.served_at,
                server_name: caseData.server_name,
                issuing_agency: caseData.issuing_agency,
                status: caseData.status
            }
        });
        
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({ 
            error: 'Failed to fetch document',
            success: false,
            details: error.message
        });
    }
});

/**
 * POST /api/recipient-cases/:caseNumber/acknowledge
 * Acknowledge receipt of a notice
 */
router.post('/:caseNumber/acknowledge', async (req, res) => {
    try {
        const { caseNumber } = req.params;
        const { signature, wallet, timestamp } = req.body;
        
        console.log(`Recording acknowledgment for case ${caseNumber} by wallet ${wallet}`);
        
        // Create acknowledgments table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS case_acknowledgments (
                id SERIAL PRIMARY KEY,
                case_number VARCHAR(255) NOT NULL,
                wallet_address VARCHAR(255) NOT NULL,
                signature TEXT,
                acknowledged_at TIMESTAMP DEFAULT NOW(),
                ip_address VARCHAR(45),
                user_agent TEXT
            )
        `).catch(e => console.log('Table already exists'));
        
        // Record acknowledgment
        await pool.query(`
            INSERT INTO case_acknowledgments (
                case_number,
                wallet_address,
                signature,
                acknowledged_at,
                ip_address,
                user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            caseNumber,
            wallet,
            signature,
            timestamp || new Date(),
            req.ip || req.connection.remoteAddress,
            req.headers['user-agent']
        ]);
        
        // Update case_service_records status
        await pool.query(`
            UPDATE case_service_records
            SET status = 'acknowledged'
            WHERE case_number = $1
        `, [caseNumber]);
        
        res.json({
            success: true,
            message: 'Acknowledgment recorded successfully'
        });
        
    } catch (error) {
        console.error('Error recording acknowledgment:', error);
        res.status(500).json({ 
            error: 'Failed to record acknowledgment',
            success: false,
            details: error.message
        });
    }
});

module.exports = router;