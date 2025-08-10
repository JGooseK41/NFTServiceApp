/**
 * Minimal Batch Document Upload Endpoint
 * Only uses existing tables, no image handling
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
 * Minimal batch upload - only uses served_notices and batch tables
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
            alertIds,
            documentIds
        } = req.body;
        
        // Parse recipients 
        const recipientList = typeof recipients === 'string' ? 
            JSON.parse(recipients) : recipients;
        
        const alertIdList = typeof alertIds === 'string' ? 
            JSON.parse(alertIds) : alertIds || [];
            
        const documentIdList = typeof documentIds === 'string' ? 
            JSON.parse(documentIds) : documentIds || [];
        
        // Validate
        if (!batchId || !recipientList || recipientList.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Batch ID and recipients are required'
            });
        }
        
        console.log(`Starting minimal batch upload for ${recipientList.length} recipients`);
        
        // Start transaction
        await client.query('BEGIN');
        
        // Store file info
        const thumbnailPath = req.files?.thumbnail?.[0]?.filename || null;
        const documentPath = req.files?.document?.[0]?.filename || null;
        
        // Create batch record
        await client.query(`
            INSERT INTO batch_uploads 
            (batch_id, server_address, recipient_count, status, metadata)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (batch_id) DO UPDATE
            SET status = $4, metadata = $5
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
        
        console.log('Batch record created successfully');
        
        // Process each recipient - ONLY using served_notices table
        const results = [];
        for (let i = 0; i < recipientList.length; i++) {
            const recipient = recipientList[i];
            const noticeId = alertIdList[i] || generateSafeId(batchId, i);
            const alertId = alertIdList[i] || noticeId;
            const documentId = documentIdList[i] || (parseInt(noticeId) + 1).toString();
            
            try {
                console.log(`Processing recipient ${i + 1}: ${recipient}`);
                
                // Insert into served_notices only - no other tables
                await client.query(`
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
                
                console.log(`✅ Created notice ${noticeId} for ${recipient}`);
                
                // Store document images in notice_components table (if files uploaded)
                if (thumbnailPath || documentPath) {
                    await client.query(`
                        INSERT INTO notice_components (
                            notice_id, case_number, server_address, recipient_address,
                            alert_id, alert_thumbnail_url, alert_nft_description,
                            document_id, document_ipfs_hash, document_encryption_key,
                            document_unencrypted_url, notice_type, issuing_agency,
                            served_at, chain_type, page_count, is_compiled, document_count
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), $14, $15, $16, $17)
                        ON CONFLICT (notice_id, chain_type) DO UPDATE SET
                            alert_thumbnail_url = EXCLUDED.alert_thumbnail_url,
                            document_unencrypted_url = EXCLUDED.document_unencrypted_url,
                            updated_at = NOW()
                    `, [
                        noticeId.toString(), // notice_id
                        caseNumber || '', // case_number
                        serverAddress.toLowerCase(), // server_address
                        recipient.toLowerCase(), // recipient_address
                        alertId.toString(), // alert_id
                        thumbnailPath ? `/uploads/documents/${thumbnailPath}` : null, // alert_thumbnail_url
                        'Legal Notice Alert', // alert_nft_description
                        documentId.toString(), // document_id
                        ipfsHash || '', // document_ipfs_hash
                        '', // document_encryption_key
                        documentPath ? `/uploads/documents/${documentPath}` : null, // document_unencrypted_url
                        noticeType || 'Legal Notice', // notice_type
                        issuingAgency || '', // issuing_agency
                        'TRON', // chain_type
                        1, // page_count
                        false, // is_compiled
                        1 // document_count
                    ]);
                    
                    console.log(`✅ Stored images for notice ${noticeId}`);
                }
                
                // Add to batch items
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
                
                results.push({
                    recipient,
                    noticeId,
                    alertId,
                    documentId,
                    status: 'success'
                });
                
            } catch (recipientError) {
                console.error(`❌ Failed recipient ${recipient}:`, recipientError.message);
                
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
        console.log(`✅ Batch complete: ${successCount}/${recipientList.length} successful`);
        
        res.json({
            success: true,
            batchId,
            totalRecipients: recipientList.length,
            successCount,
            failureCount: recipientList.length - successCount,
            results
        });
        
    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
                console.log('🔄 Transaction rolled back');
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError.message);
            }
        }
        
        console.error('❌ Batch upload error:', error.message);
        
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
 */
router.get('/:batchId/status', async (req, res) => {
    try {
        const { batchId } = req.params;
        
        const batchResult = await pool.query(`
            SELECT * FROM batch_uploads WHERE batch_id = $1
        `, [batchId]);
        
        if (batchResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Batch not found'
            });
        }
        
        const itemsResult = await pool.query(`
            SELECT * FROM notice_batch_items 
            WHERE batch_id = $1
            ORDER BY created_at
        `, [batchId]);
        
        res.json({
            success: true,
            batch: batchResult.rows[0],
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
 * Generate safe ID for PostgreSQL
 */
function generateSafeId(batchId, index) {
    const match = batchId.match(/\d+/);
    const batchNum = match ? match[0] : Date.now().toString();
    const truncated = batchNum.slice(-8);
    const safeId = parseInt(truncated) * 100 + index;
    
    if (safeId > 2147483647) {
        return Math.floor(Math.random() * 1000000000);
    }
    
    return safeId.toString();
}

module.exports = router;