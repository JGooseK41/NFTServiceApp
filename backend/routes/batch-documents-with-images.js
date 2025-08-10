/**
 * Safe Batch Document Upload Endpoint
 * Handles document uploads for multiple recipients with better error handling
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { Pool } = require('pg');

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/documents');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * POST /api/batch/documents
 * Safe batch upload using only existing table columns
 */
router.post('/documents', upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'document', maxCount: 1 }
]), async (req, res) => {
    let client;
    
    try {
        client = await pool.connect();
        
        const {
            batchId,
            recipients,
            caseNumber,
            serverAddress,
            noticeType,
            issuingAgency,
            ipfsHash,
            encryptionKey,
            alertIds,
            documentIds
        } = req.body;
        
        // Parse recipients if it's a string
        const recipientList = typeof recipients === 'string' ? 
            JSON.parse(recipients) : recipients;
        
        const alertIdList = typeof alertIds === 'string' ? 
            JSON.parse(alertIds) : alertIds || [];
            
        const documentIdList = typeof documentIds === 'string' ? 
            JSON.parse(documentIds) : documentIds || [];
        
        // Validate required fields
        if (!batchId || !recipientList || recipientList.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Batch ID and recipients are required'
            });
        }
        
        // Start transaction
        await client.query('BEGIN');
        console.log(`Starting batch upload for ${recipientList.length} recipients`);
        
        // Generate safe notice IDs for each recipient
        const noticeIds = [];
        for (let i = 0; i < recipientList.length; i++) {
            const noticeId = alertIdList[i] || generateSafeId(batchId, i);
            noticeIds.push(noticeId);
        }
        
        // Store file paths
        const thumbnailPath = req.files?.thumbnail?.[0]?.filename || null;
        const documentPath = req.files?.document?.[0]?.filename || null;
        
        // Create batch record
        try {
            const batchResult = await client.query(`
                INSERT INTO batch_uploads 
                (batch_id, server_address, recipient_count, status, metadata)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (batch_id) DO UPDATE
                SET status = $4, metadata = $5
                RETURNING id
            `, [
                batchId,
                serverAddress,
                recipientList.length,
                'processing',
                JSON.stringify({
                    caseNumber,
                    noticeType,
                    issuingAgency,
                    ipfsHash,
                    thumbnailPath,
                    documentPath,
                    timestamp: new Date().toISOString()
                })
            ]);
            
            console.log('Batch record created:', batchResult.rows[0].id);
        } catch (error) {
            console.error('Error creating batch record:', error.message);
            throw error;
        }
        
        // Process each recipient - using only columns that exist in served_notices
        const results = [];
        for (let i = 0; i < recipientList.length; i++) {
            const recipient = recipientList[i];
            const noticeId = noticeIds[i];
            const alertId = alertIdList[i] || noticeId;
            const documentId = documentIdList[i] || (parseInt(noticeId) + 1).toString();
            
            try {
                console.log(`Processing recipient ${i + 1}/${recipientList.length}: ${recipient}`);
                
                // Use only columns that exist in served_notices table
                const noticeResult = await client.query(`
                    INSERT INTO served_notices 
                    (notice_id, server_address, recipient_address, notice_type,
                     case_number, alert_id, document_id, issuing_agency,
                     has_document, ipfs_hash, batch_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (notice_id) DO UPDATE
                    SET 
                        has_document = $9,
                        ipfs_hash = $10,
                        batch_id = $11,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING notice_id
                `, [
                    noticeId.toString(),
                    serverAddress.toLowerCase(),
                    recipient.toLowerCase(),
                    noticeType || 'Legal Notice',
                    caseNumber || '',
                    alertId.toString(),
                    documentId.toString(),
                    issuingAgency || '',
                    !!documentPath,
                    ipfsHash || '',
                    batchId
                ]);
                
                console.log(`Notice created for recipient ${recipient}: ${noticeResult.rows[0].notice_id}`);
                
                // Create batch item record
                await client.query(`
                    INSERT INTO notice_batch_items
                    (batch_id, notice_id, recipient_address, status)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (batch_id, notice_id) DO UPDATE
                    SET status = $4
                `, [
                    batchId,
                    noticeId.toString(),
                    recipient,
                    'success'
                ]);
                
                results.push({
                    recipient,
                    noticeId,
                    alertId,
                    documentId,
                    status: 'success'
                });
                
            } catch (recipientError) {
                console.error(`Error processing recipient ${recipient}:`, recipientError.message);
                
                // Don't fail the entire batch for one recipient
                results.push({
                    recipient,
                    noticeId,
                    status: 'failed',
                    error: recipientError.message
                });
            }
        }
        
        // Update batch status
        const successCount = results.filter(r => r.status === 'success').length;
        const batchStatus = successCount === recipientList.length ? 'completed' : 'partial';
        
        await client.query(`
            UPDATE batch_uploads
            SET status = $1, 
                metadata = metadata || jsonb_build_object(
                    'completedAt', $2,
                    'successCount', $3,
                    'failureCount', $4
                )
            WHERE batch_id = $5
        `, [
            batchStatus,
            new Date().toISOString(),
            successCount,
            recipientList.length - successCount,
            batchId
        ]);
        
        await client.query('COMMIT');
        console.log(`Batch upload completed: ${successCount}/${recipientList.length} successful`);
        
        res.json({
            success: true,
            batchId,
            totalRecipients: recipientList.length,
            successCount,
            failureCount: recipientList.length - successCount,
            results,
            documentUrl: documentPath ? `/uploads/documents/${documentPath}` : null,
            thumbnailUrl: thumbnailPath ? `/uploads/documents/${thumbnailPath}` : null
        });
        
    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
                console.log('Transaction rolled back');
            } catch (rollbackError) {
                console.error('Error during rollback:', rollbackError.message);
            }
        }
        
        console.error('Batch upload error:', error.message);
        console.error('Stack:', error.stack);
        
        res.status(500).json({
            success: false,
            error: `Batch upload failed: ${error.message}`
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

/**
 * GET /api/batch/:batchId/status
 * Get status of a batch upload
 */
router.get('/:batchId/status', async (req, res) => {
    try {
        const { batchId } = req.params;
        
        // Get batch info
        const batchResult = await pool.query(`
            SELECT * FROM batch_uploads WHERE batch_id = $1
        `, [batchId]);
        
        if (batchResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Batch not found'
            });
        }
        
        const batch = batchResult.rows[0];
        
        // Get batch items
        const itemsResult = await pool.query(`
            SELECT * FROM notice_batch_items 
            WHERE batch_id = $1
            ORDER BY created_at
        `, [batchId]);
        
        res.json({
            success: true,
            batch: {
                ...batch,
                metadata: batch.metadata || {}
            },
            items: itemsResult.rows
        });
        
    } catch (error) {
        console.error('Error fetching batch status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Generate a safe ID that fits in PostgreSQL INTEGER
 */
function generateSafeId(batchId, index) {
    // Extract numeric part from batch ID
    const match = batchId.match(/\d+/);
    const batchNum = match ? match[0] : Date.now().toString();
    
    // Take last 8 digits and add index
    const truncated = batchNum.slice(-8);
    const safeId = parseInt(truncated) * 100 + index;
    
    // Ensure it's within INTEGER range
    if (safeId > 2147483647) {
        return Math.floor(Math.random() * 1000000000);
    }
    
    return safeId.toString();
}

module.exports = router;