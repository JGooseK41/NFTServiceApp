/**
 * Transaction Hash Tracking Routes
 * Properly stores and retrieves transaction hashes for all notices
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * Store transaction hash for batch of recipients
 * In a batch transaction, all recipients share the same transaction hash
 */
router.post('/batch', async (req, res) => {
  try {
    const { txHash, caseNumber, recipients } = req.body;
    
    if (!txHash || !recipients || !Array.isArray(recipients)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: txHash and recipients array'
      });
    }
    
    console.log(`📝 Storing transaction hash ${txHash} for ${recipients.length} recipients`);
    
    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update each recipient's record with the transaction hash
      for (const recipient of recipients) {
        // Update blockchain_data table
        await client.query(`
          UPDATE blockchain_data
          SET 
            alert_tx_hash = $1,
            document_tx_hash = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE 
            recipient_address = $2
            AND case_number = $3
        `, [txHash, recipient.address, caseNumber]);
        
        // Also update notice_components if it exists
        await client.query(`
          UPDATE notice_components
          SET 
            alert_tx_hash = $1,
            document_tx_hash = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE 
            recipient_address = $2
            AND case_number = $3
        `, [txHash, recipient.address, caseNumber]);
        
        // Store in a dedicated transaction tracking table
        await client.query(`
          INSERT INTO transaction_hashes (
            tx_hash,
            case_number,
            recipient_address,
            alert_id,
            document_id,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          ON CONFLICT (tx_hash, recipient_address) DO UPDATE
          SET 
            case_number = EXCLUDED.case_number,
            alert_id = EXCLUDED.alert_id,
            document_id = EXCLUDED.document_id
        `, [
          txHash,
          caseNumber,
          recipient.address,
          recipient.alertId || null,
          recipient.documentId || null
        ]);
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: `Transaction hash stored for ${recipients.length} recipients`,
        txHash: txHash
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error storing transaction hash:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store transaction hash'
    });
  }
});

/**
 * Get transaction hash for a specific notice
 */
router.get('/:noticeId/transaction', async (req, res) => {
  try {
    const { noticeId } = req.params;
    
    // Try multiple tables to find the transaction hash
    const result = await pool.query(`
      SELECT 
        COALESCE(bd.alert_tx_hash, bd.document_tx_hash, th.tx_hash) as tx_hash,
        bd.case_number,
        bd.recipient_address,
        bd.created_at
      FROM blockchain_data bd
      LEFT JOIN transaction_hashes th ON 
        (th.alert_id = $1 OR th.document_id = $1)
      WHERE 
        bd.notice_id = $1 OR
        bd.alert_id = $1 OR
        bd.document_id = $1
      LIMIT 1
    `, [noticeId]);
    
    if (result.rows.length > 0) {
      res.json({
        success: true,
        txHash: result.rows[0].tx_hash,
        caseNumber: result.rows[0].case_number,
        recipientAddress: result.rows[0].recipient_address,
        timestamp: result.rows[0].created_at
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Transaction hash not found for this notice'
      });
    }
    
  } catch (error) {
    console.error('Error retrieving transaction hash:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve transaction hash'
    });
  }
});

/**
 * Get all transaction hashes for a case
 */
router.get('/case/:caseNumber', async (req, res) => {
  try {
    const { caseNumber } = req.params;
    
    const result = await pool.query(`
      SELECT DISTINCT
        COALESCE(alert_tx_hash, document_tx_hash) as tx_hash,
        COUNT(*) as recipient_count,
        MIN(created_at) as first_transaction,
        array_agg(DISTINCT recipient_address) as recipients
      FROM blockchain_data
      WHERE 
        case_number = $1 AND
        (alert_tx_hash IS NOT NULL OR document_tx_hash IS NOT NULL)
      GROUP BY COALESCE(alert_tx_hash, document_tx_hash)
      ORDER BY MIN(created_at) DESC
    `, [caseNumber]);
    
    res.json({
      success: true,
      caseNumber: caseNumber,
      transactions: result.rows
    });
    
  } catch (error) {
    console.error('Error retrieving case transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve case transactions'
    });
  }
});

/**
 * Create transaction tracking table if it doesn't exist
 */
async function ensureTransactionTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transaction_hashes (
        id SERIAL PRIMARY KEY,
        tx_hash VARCHAR(100) NOT NULL,
        case_number VARCHAR(255),
        recipient_address VARCHAR(100),
        alert_id VARCHAR(100),
        document_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tx_hash, recipient_address)
      )
    `);
    
    // Create indexes for fast lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tx_hash ON transaction_hashes(tx_hash);
      CREATE INDEX IF NOT EXISTS idx_case_tx ON transaction_hashes(case_number);
      CREATE INDEX IF NOT EXISTS idx_alert_tx ON transaction_hashes(alert_id);
      CREATE INDEX IF NOT EXISTS idx_doc_tx ON transaction_hashes(document_id);
    `);
    
    console.log('✅ Transaction tracking table ready');
  } catch (error) {
    console.error('Error creating transaction table:', error);
  }
}

// Initialize table on startup
ensureTransactionTable();

module.exports = router;