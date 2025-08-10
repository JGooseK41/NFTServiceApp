/**
 * Batch Document Upload Endpoint
 * Handles document uploads for multiple recipients in a single request
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

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
 * Upload documents for multiple recipients
 * 
 * Request body:
 * - batchId: Unique batch identifier
 * - recipients: Array of recipient addresses
 * - caseNumber: Case number for all recipients
 * - serverAddress: Server wallet address
 * - noticeType: Type of notice
 * - issuingAgency: Agency name
 * - ipfsHash: IPFS hash (if uploaded)
 * - encryptionKey: Encryption key for documents
 * 
 * Files:
 * - thumbnail: Alert NFT thumbnail
 * - document: Full document
 */
router.post('/documents', upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'document', maxCount: 1 }
]), async (req, res) => {
    const pool = req.app.get('db');
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
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
            throw new Error('Batch ID and recipients are required');
        }
        
        // Generate safe notice IDs for each recipient
        const noticeIds = [];
        for (let i = 0; i < recipientList.length; i++) {
            // Use provided IDs or generate safe ones
            const noticeId = alertIdList[i] || 
                            generateSafeId(batchId, i);
            noticeIds.push(noticeId);
        }
        
        // Store file paths
        const thumbnailPath = req.files?.thumbnail?.[0]?.filename || null;
        const documentPath = req.files?.document?.[0]?.filename || null;
        
        // Create batch record
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
        
        const batchDbId = batchResult.rows[0].id;
        
        // Process each recipient
        const results = [];
        for (let i = 0; i < recipientList.length; i++) {
            const recipient = recipientList[i];
            const noticeId = noticeIds[i];
            const alertId = alertIdList[i] || noticeId;
            const documentId = documentIdList[i] || (parseInt(noticeId) + 1).toString();
            
            try {
                // Create notice record for this recipient
                const noticeResult = await client.query(`
                    INSERT INTO notices 
                    (notice_id, server_address, recipient_address, notice_type,
                     case_number, alert_id, document_id, issuing_agency,
                     has_document, ipfs_hash, status, batch_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (notice_id) DO UPDATE
                    SET 
                        has_document = $9,
                        ipfs_hash = $10,
                        status = $11,
                        batch_id = $12,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING *
                `, [
                    noticeId.toString(),
                    serverAddress.toLowerCase(),
                    recipient.toLowerCase(),
                    noticeType,
                    caseNumber,
                    alertId.toString(),
                    documentId.toString(),
                    issuingAgency || '',
                    !!documentPath,
                    ipfsHash || '',
                    'uploaded',
                    batchId
                ]);
                
                // Create batch item record
                await client.query(`
                    INSERT INTO notice_batch_items
                    (batch_id, notice_id, recipient_address, status)
                    VALUES ($1, $2, $3, $4)
                `, [
                    batchId,
                    noticeId.toString(),
                    recipient,
                    'success'
                ]);
                
                // Store document images if provided
                if (thumbnailPath || documentPath) {
                    await client.query(`
                        INSERT INTO notice_images
                        (notice_id, thumbnail_path, document_path, encrypted_path)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (notice_id) DO UPDATE
                        SET 
                            thumbnail_path = COALESCE($2, thumbnail_path),
                            document_path = COALESCE($3, document_path),
                            updated_at = CURRENT_TIMESTAMP
                    `, [
                        noticeId.toString(),
                        thumbnailPath ? `/uploads/documents/${thumbnailPath}` : null,
                        documentPath ? `/uploads/documents/${documentPath}` : null,
                        null // encrypted_path if needed
                    ]);
                }
                
                results.push({
                    recipient,
                    noticeId,
                    alertId,
                    documentId,
                    status: 'success'
                });
                
            } catch (recipientError) {
                console.error(`Error processing recipient ${recipient}:`, recipientError);
                
                // Record failure for this recipient
                await client.query(`
                    INSERT INTO notice_batch_items
                    (batch_id, notice_id, recipient_address, status)
                    VALUES ($1, $2, $3, $4)
                `, [
                    batchId,
                    noticeId.toString(),
                    recipient,
                    'failed'
                ]);
                
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
        await client.query('ROLLBACK');
        console.error('Batch upload error:', error);
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process batch upload'
        });
    } finally {
        client.release();
    }
});

/**
 * GET /api/batch/:batchId/status
 * Get status of a batch upload
 */
router.get('/:batchId/status', async (req, res) => {
    const pool = req.app.get('db');
    
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