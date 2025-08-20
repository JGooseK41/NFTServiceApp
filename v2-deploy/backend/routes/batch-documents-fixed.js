/**
 * Fixed Batch Document Upload Endpoint
 * Resolves transaction abort issues with proper error handling and connection management
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { Pool } = require('pg');

// Initialize database connection with better settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection cannot be established
  statement_timeout: 30000, // Cancel queries after 30 seconds
  query_timeout: 30000 // Alternative timeout setting
});

// Type safety utilities
const SafeTypes = {
    string: (val, defaultVal = '') => {
        if (val === null || val === undefined) return defaultVal;
        return String(val);
    },
    number: (val, defaultVal = 0) => {
        if (val === null || val === undefined) return defaultVal;
        const num = Number(val);
        return isNaN(num) ? defaultVal : num;
    },
    boolean: (val, defaultVal = false) => {
        if (val === null || val === undefined) return defaultVal;
        return Boolean(val);
    },
    array: (val, defaultVal = []) => {
        if (!val) return defaultVal;
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed : defaultVal;
            } catch {
                return defaultVal;
            }
        }
        return defaultVal;
    },
    json: (val, defaultVal = {}) => {
        if (!val) return defaultVal;
        if (typeof val === 'object') return val;
        if (typeof val === 'string') {
            try {
                return JSON.parse(val);
            } catch {
                return defaultVal;
            }
        }
        return defaultVal;
    }
};

// Configure multer with error handling
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            const uploadDir = path.join(__dirname, '../uploads/documents');
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        try {
            const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
            const safeFileName = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
            cb(null, safeFileName);
        } catch (error) {
            cb(error, null);
        }
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Accept images and PDFs only
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images and PDFs are allowed'));
        }
    }
});

/**
 * Comprehensive validation middleware
 */
const validateBatchRequest = (req, res, next) => {
    try {
        // Parse and validate all fields upfront
        const body = req.body || {};
        
        // Safe parsing with defaults
        req.validatedData = {
            batchId: SafeTypes.string(body.batchId, `BATCH_${Date.now()}_${Math.floor(Math.random() * 1000)}`),
            recipients: SafeTypes.array(body.recipients),
            caseNumber: SafeTypes.string(body.caseNumber, ''),
            serverAddress: SafeTypes.string(body.serverAddress, ''),
            noticeType: SafeTypes.string(body.noticeType, 'Legal Notice'),
            issuingAgency: SafeTypes.string(body.issuingAgency, ''),
            ipfsHash: SafeTypes.string(body.ipfsHash, ''),
            encryptionKey: SafeTypes.string(body.encryptionKey, ''),
            alertIds: SafeTypes.array(body.alertIds),
            documentIds: SafeTypes.array(body.documentIds)
        };
        
        // Validation errors collection
        const errors = [];
        
        // Critical validations
        if (req.validatedData.recipients.length === 0) {
            errors.push('At least one recipient is required');
        }
        
        if (!req.validatedData.serverAddress) {
            errors.push('Server address is required');
        }
        
        // Validate TRON addresses
        const invalidAddresses = req.validatedData.recipients.filter(addr => {
            const cleaned = SafeTypes.string(addr);
            return !cleaned || (!cleaned.startsWith('T') && cleaned.length !== 34);
        });
        
        if (invalidAddresses.length > 0) {
            errors.push(`Invalid TRON addresses: ${invalidAddresses.join(', ')}`);
        }
        
        // Return validation errors
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                errors,
                message: 'Validation failed'
            });
        }
        
        // Clean and normalize data
        req.validatedData.recipients = req.validatedData.recipients.map(r => SafeTypes.string(r).trim());
        req.validatedData.serverAddress = req.validatedData.serverAddress.toLowerCase().trim();
        
        console.log('Batch validation passed:', {
            batchId: req.validatedData.batchId,
            recipientCount: req.validatedData.recipients.length,
            serverAddress: req.validatedData.serverAddress
        });
        
        next();
    } catch (error) {
        console.error('Validation error:', error);
        res.status(400).json({
            success: false,
            error: 'Invalid request data',
            details: error.message
        });
    }
};

/**
 * Execute query with automatic retry on connection issues
 */
async function executeQuery(client, query, params, retries = 2) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await client.query(query, params);
        } catch (error) {
            console.error(`Query attempt ${attempt} failed:`, error.message);
            
            // If it's a transaction abort error and we have retries left, try to recover
            if (error.message.includes('current transaction is aborted') && attempt < retries) {
                console.log('Attempting to recover from transaction abort...');
                try {
                    await client.query('ROLLBACK');
                    await client.query('BEGIN');
                    console.log('Transaction recovered, retrying query...');
                } catch (rollbackError) {
                    console.error('Failed to recover transaction:', rollbackError.message);
                    throw error;
                }
            } else if (attempt === retries) {
                throw error;
            }
            
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
    }
}

/**
 * POST /api/batch/documents  
 * Fixed batch upload with better error recovery
 */
router.post('/documents', 
    upload.fields([
        { name: 'thumbnail', maxCount: 1 },
        { name: 'document', maxCount: 1 }
    ]),
    validateBatchRequest,
    async (req, res) => {
        let client;
        
        try {
            // Get a fresh connection from the pool
            console.log('Acquiring database connection...');
            client = await pool.connect();
            
            // Start fresh transaction
            console.log('Starting transaction...');
            await client.query('BEGIN');
            
            const data = req.validatedData;
            
            // Extract file info safely
            const thumbnailFile = req.files?.thumbnail?.[0];
            const documentFile = req.files?.document?.[0];
            const thumbnailPath = thumbnailFile?.filename || null;
            const documentPath = documentFile?.filename || null;
            
            console.log(`Processing batch ${data.batchId} for ${data.recipients.length} recipients`);
            
            // Create batch record with proper types
            const batchMetadata = {
                caseNumber: data.caseNumber,
                noticeType: data.noticeType,
                issuingAgency: data.issuingAgency,
                ipfsHash: data.ipfsHash,
                thumbnailPath: thumbnailPath,
                documentPath: documentPath,
                timestamp: new Date().toISOString(),
                recipientCount: data.recipients.length
            };
            
            // Use executeQuery for better error handling
            await executeQuery(client, `
                INSERT INTO batch_uploads 
                (batch_id, server_address, recipient_count, status, metadata)
                VALUES ($1::TEXT, $2::TEXT, $3::INTEGER, $4::TEXT, $5::JSONB)
                ON CONFLICT (batch_id) DO UPDATE
                SET 
                    status = EXCLUDED.status,
                    metadata = EXCLUDED.metadata,
                    recipient_count = EXCLUDED.recipient_count
            `, [
                data.batchId,
                data.serverAddress,
                data.recipients.length,
                'processing',
                JSON.stringify(batchMetadata)
            ]);
            
            console.log('Batch record created');
            
            // Process each recipient with comprehensive error handling
            const results = [];
            const failedRecipients = [];
            
            for (let i = 0; i < data.recipients.length; i++) {
                const recipient = SafeTypes.string(data.recipients[i]).toLowerCase();
                const noticeId = SafeTypes.string(data.alertIds[i] || generateSafeId(data.batchId, i));
                const alertId = SafeTypes.string(data.alertIds[i] || noticeId);
                const documentId = SafeTypes.string(data.documentIds[i] || String(Number(noticeId) + 1));
                
                console.log(`Processing ${i + 1}/${data.recipients.length}: ${recipient}`);
                
                // Create a savepoint for this recipient
                const savepointName = `recipient_${i}`;
                
                try {
                    // Create savepoint
                    await client.query(`SAVEPOINT ${savepointName}`);
                    
                    // Insert into served_notices with explicit types
                    await client.query(`
                        INSERT INTO served_notices 
                        (notice_id, server_address, recipient_address, notice_type,
                         case_number, alert_id, document_id, issuing_agency,
                         has_document, ipfs_hash, batch_id)
                        VALUES ($1::TEXT, $2::TEXT, $3::TEXT, $4::TEXT, 
                                $5::TEXT, $6::TEXT, $7::TEXT, $8::TEXT,
                                $9::BOOLEAN, $10::TEXT, $11::TEXT)
                        ON CONFLICT (notice_id) DO UPDATE
                        SET 
                            has_document = EXCLUDED.has_document,
                            ipfs_hash = EXCLUDED.ipfs_hash,
                            batch_id = EXCLUDED.batch_id,
                            updated_at = CURRENT_TIMESTAMP
                    `, [
                        noticeId,
                        data.serverAddress,
                        recipient,
                        data.noticeType,
                        data.caseNumber,
                        alertId,
                        documentId,
                        data.issuingAgency,
                        Boolean(documentPath),
                        data.ipfsHash || '',
                        data.batchId
                    ]);
                    
                    // Store images in notice_components if files exist
                    if (thumbnailPath || documentPath) {
                        const thumbnailUrl = thumbnailPath ? `/uploads/documents/${thumbnailPath}` : null;
                        const documentUrl = documentPath ? `/uploads/documents/${documentPath}` : null;
                        
                        await client.query(`
                            INSERT INTO notice_components (
                                notice_id, case_number, server_address, recipient_address,
                                alert_id, alert_thumbnail_url, alert_nft_description,
                                document_id, document_ipfs_hash, document_encryption_key,
                                document_unencrypted_url, notice_type, issuing_agency,
                                served_at, chain_type, page_count, is_compiled, document_count
                            ) VALUES (
                                $1::TEXT, $2::TEXT, $3::TEXT, $4::TEXT,
                                $5::TEXT, $6::TEXT, $7::TEXT,
                                $8::TEXT, $9::TEXT, $10::TEXT,
                                $11::TEXT, $12::TEXT, $13::TEXT,
                                NOW(), $14::TEXT, $15::INTEGER, $16::BOOLEAN, $17::INTEGER
                            )
                            ON CONFLICT (notice_id, chain_type) DO UPDATE SET
                                alert_thumbnail_url = COALESCE(EXCLUDED.alert_thumbnail_url, notice_components.alert_thumbnail_url),
                                document_unencrypted_url = COALESCE(EXCLUDED.document_unencrypted_url, notice_components.document_unencrypted_url),
                                updated_at = NOW()
                        `, [
                            noticeId,
                            data.caseNumber || '',
                            data.serverAddress,
                            recipient,
                            alertId,
                            thumbnailUrl,
                            'Legal Notice Alert',
                            documentId,
                            data.ipfsHash || '',
                            data.encryptionKey || '',
                            documentUrl,
                            data.noticeType,
                            data.issuingAgency || '',
                            'TRON',
                            1,
                            false,
                            1
                        ]);
                        
                        console.log(`  ✅ Images stored for ${noticeId}`);
                    }
                    
                    // Record success in batch items
                    await client.query(`
                        INSERT INTO notice_batch_items
                        (batch_id, notice_id, recipient_address, status, created_at)
                        VALUES ($1::TEXT, $2::TEXT, $3::TEXT, $4::TEXT, NOW())
                        ON CONFLICT DO NOTHING
                    `, [
                        data.batchId,
                        noticeId,
                        recipient,
                        'success'
                    ]);
                    
                    // Release savepoint on success
                    await client.query(`RELEASE SAVEPOINT ${savepointName}`);
                    
                    results.push({
                        recipient,
                        noticeId,
                        alertId,
                        documentId,
                        status: 'success'
                    });
                    
                    console.log(`  ✅ Completed ${noticeId}`);
                    
                } catch (recipientError) {
                    console.error(`  ❌ Failed for ${recipient}:`, recipientError.message);
                    
                    // Rollback to savepoint
                    try {
                        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                    } catch (rollbackError) {
                        console.error('Failed to rollback to savepoint:', rollbackError.message);
                    }
                    
                    // Record failure
                    failedRecipients.push({
                        recipient,
                        error: recipientError.message,
                        code: recipientError.code
                    });
                    
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
            const failureCount = results.length - successCount;
            const batchStatus = failureCount === 0 ? 'completed' : 
                               successCount === 0 ? 'failed' : 'partial';
            
            await executeQuery(client, `
                UPDATE batch_uploads
                SET 
                    status = $1::TEXT,
                    metadata = metadata || $2::JSONB
                WHERE batch_id = $3::TEXT
            `, [
                batchStatus,
                JSON.stringify({
                    completedAt: new Date().toISOString(),
                    successCount,
                    failureCount,
                    failedRecipients
                }),
                data.batchId
            ]);
            
            // Commit the transaction
            await client.query('COMMIT');
            
            console.log(`✅ Batch ${data.batchId} complete: ${successCount}/${data.recipients.length} successful`);
            
            // Successful response
            res.json({
                success: true,
                batchId: data.batchId,
                totalRecipients: data.recipients.length,
                successCount,
                failureCount,
                results,
                files: {
                    thumbnail: thumbnailPath ? `/uploads/documents/${thumbnailPath}` : null,
                    document: documentPath ? `/uploads/documents/${documentPath}` : null
                },
                status: batchStatus
            });
            
        } catch (error) {
            // Rollback on any error
            if (client) {
                try {
                    await client.query('ROLLBACK');
                    console.log('Transaction rolled back');
                } catch (rollbackError) {
                    console.error('Rollback error:', rollbackError.message);
                }
            }
            
            console.error('Batch upload error:', error);
            console.error('Stack:', error.stack);
            
            // Clean up uploaded files on error
            if (req.files) {
                const uploadDir = path.join(__dirname, '../uploads/documents');
                for (const fieldName in req.files) {
                    for (const file of req.files[fieldName]) {
                        try {
                            await fs.unlink(path.join(uploadDir, file.filename));
                            console.log(`Cleaned up file: ${file.filename}`);
                        } catch (cleanupError) {
                            console.error(`Failed to clean up file ${file.filename}:`, cleanupError.message);
                        }
                    }
                }
            }
            
            // Detailed error response
            res.status(500).json({
                success: false,
                error: error.message,
                code: error.code,
                detail: error.detail,
                hint: error.hint,
                position: error.position,
                batchId: req.validatedData?.batchId
            });
            
        } finally {
            // Always release the client back to the pool
            if (client) {
                try {
                    client.release();
                    console.log('Database connection released');
                } catch (releaseError) {
                    console.error('Error releasing client:', releaseError.message);
                }
            }
        }
});

/**
 * GET /api/batch/:batchId/status
 * Get batch status with proper error handling
 */
router.get('/:batchId/status', async (req, res) => {
    let client;
    
    try {
        const batchId = SafeTypes.string(req.params.batchId);
        
        if (!batchId) {
            return res.status(400).json({
                success: false,
                error: 'Batch ID is required'
            });
        }
        
        client = await pool.connect();
        
        // Get batch info
        const batchResult = await client.query(`
            SELECT * FROM batch_uploads 
            WHERE batch_id = $1::TEXT
        `, [batchId]);
        
        if (batchResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Batch not found',
                batchId
            });
        }
        
        const batch = batchResult.rows[0];
        
        // Get batch items
        const itemsResult = await client.query(`
            SELECT * FROM notice_batch_items 
            WHERE batch_id = $1::TEXT
            ORDER BY created_at
        `, [batchId]);
        
        res.json({
            success: true,
            batch: {
                ...batch,
                metadata: SafeTypes.json(batch.metadata, {})
            },
            items: itemsResult.rows,
            summary: {
                total: itemsResult.rows.length,
                success: itemsResult.rows.filter(r => r.status === 'success').length,
                failed: itemsResult.rows.filter(r => r.status === 'failed').length
            }
        });
        
    } catch (error) {
        console.error('Error fetching batch status:', error);
        
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code
        });
        
    } finally {
        if (client) {
            client.release();
        }
    }
});

/**
 * Generate safe ID for PostgreSQL
 */
function generateSafeId(batchId, index) {
    try {
        const match = batchId.match(/\d+/);
        const batchNum = match ? match[0] : Date.now().toString();
        const truncated = batchNum.slice(-7); // Keep it under 2.1 billion
        const safeId = parseInt(truncated) * 100 + (index % 100);
        
        // Extra safety check
        if (safeId > 2147483647 || safeId < 0 || isNaN(safeId)) {
            return String(Math.floor(Math.random() * 1000000000));
        }
        
        return String(safeId);
    } catch (error) {
        // Fallback to random ID
        return String(Math.floor(Math.random() * 1000000000));
    }
}

module.exports = router;