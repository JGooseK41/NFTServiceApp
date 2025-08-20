/**
 * Draft Management System
 * Allows users to save and resume NFT creation progress
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { Pool } = require('pg');

// CORS middleware for all drafts routes
router.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
        'https://theblockservice.com',
        'https://www.theblockservice.com',
        'https://blockserved.com',
        'https://www.blockserved.com',
        'https://nft-legal-service.netlify.app',
        'http://localhost:8080',
        'http://localhost:3000'
    ];
    
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            const uploadDir = path.join(__dirname, '../uploads/drafts');
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            console.error('Error creating upload directory:', error);
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Initialize drafts tables if they don't exist
 */
async function initializeTables() {
    let client;
    try {
        client = await pool.connect();
        
        // Create drafts table
        await client.query(`
            CREATE TABLE IF NOT EXISTS notice_drafts (
                draft_id VARCHAR(255) PRIMARY KEY,
                draft_name VARCHAR(500) NOT NULL,
                server_address VARCHAR(255) NOT NULL,
                notice_type VARCHAR(255),
                case_number VARCHAR(255),
                issuing_agency VARCHAR(255),
                public_text TEXT,
                case_details TEXT,
                legal_rights TEXT,
                recipients JSONB,
                token_name VARCHAR(255),
                delivery_method VARCHAR(50),
                sponsor_fees BOOLEAN DEFAULT false,
                thumbnail_data TEXT,
                document_data TEXT,
                encrypted_document_data TEXT,
                ipfs_hash VARCHAR(255),
                encrypted_ipfs VARCHAR(255),
                encryption_key VARCHAR(500),
                metadata_uri VARCHAR(500),
                custom_fields JSONB,
                status VARCHAR(50) DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                last_accessed TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // Create draft files table
        await client.query(`
            CREATE TABLE IF NOT EXISTS draft_files (
                file_id SERIAL PRIMARY KEY,
                draft_id VARCHAR(255) REFERENCES notice_drafts(draft_id) ON DELETE CASCADE,
                file_type VARCHAR(50) NOT NULL,
                file_name VARCHAR(500),
                file_path VARCHAR(500),
                file_size BIGINT,
                mime_type VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        console.log('✅ Draft tables initialized');
        
    } catch (error) {
        console.error('❌ Error initializing draft tables:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        if (client) {
            client.release();
        }
    }
}

// Initialize tables on startup
initializeTables();

// Test endpoint to verify drafts router is working
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Drafts router is working',
        timestamp: new Date().toISOString()
    });
});

/**
 * POST /api/drafts/save
 * Save a draft of the NFT creation form
 */
router.post('/save', 
    upload.fields([
        { name: 'thumbnail', maxCount: 1 },
        { name: 'document', maxCount: 1 },
        { name: 'encryptedDocument', maxCount: 1 }
    ]),
    async (req, res) => {
        console.log('POST /api/drafts/save - Request received from:', req.headers.origin);
        console.log('Server address:', req.body.serverAddress);
        console.log('Draft name:', req.body.draftName);
        
        let client;
        
        try {
            client = await pool.connect();
            await client.query('BEGIN');
            
            // Generate or use existing draft ID
            const draftId = req.body.draftId || `DRAFT_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
            const draftName = req.body.draftName || `Draft - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
            
            // Parse request data
            const draftData = {
                draftId,
                draftName,
                serverAddress: req.body.serverAddress || '',
                noticeType: req.body.noticeType || '',
                caseNumber: req.body.caseNumber || '',
                issuingAgency: req.body.issuingAgency || '',
                publicText: req.body.publicText || '',
                caseDetails: req.body.caseDetails || '',
                legalRights: req.body.legalRights || '',
                recipients: typeof req.body.recipients === 'string' 
                    ? JSON.parse(req.body.recipients || '[]')
                    : req.body.recipients || [],
                tokenName: req.body.tokenName || '',
                deliveryMethod: req.body.deliveryMethod || 'document',
                sponsorFees: req.body.sponsorFees === 'true',
                thumbnailData: req.body.thumbnailData || '',
                documentData: req.body.documentData || '',
                encryptedDocumentData: req.body.encryptedDocumentData || '',
                ipfsHash: req.body.ipfsHash || '',
                encryptedIPFS: req.body.encryptedIPFS || '',
                encryptionKey: req.body.encryptionKey || '',
                metadataURI: req.body.metadataURI || '',
                customFields: JSON.parse(req.body.customFields || '{}')
            };
            
            // Check if draft exists
            const existingDraft = await client.query(
                'SELECT draft_id FROM notice_drafts WHERE draft_id = $1',
                [draftId]
            );
            
            if (existingDraft.rows.length > 0) {
                // Update existing draft
                await client.query(`
                    UPDATE notice_drafts SET
                        draft_name = $2,
                        notice_type = $3,
                        case_number = $4,
                        issuing_agency = $5,
                        public_text = $6,
                        case_details = $7,
                        legal_rights = $8,
                        recipients = $9,
                        token_name = $10,
                        delivery_method = $11,
                        sponsor_fees = $12,
                        thumbnail_data = $13,
                        document_data = $14,
                        encrypted_document_data = $15,
                        ipfs_hash = $16,
                        encrypted_ipfs = $17,
                        encryption_key = $18,
                        metadata_uri = $19,
                        custom_fields = $20,
                        updated_at = NOW(),
                        last_accessed = NOW()
                    WHERE draft_id = $1
                `, [
                    draftId,
                    draftData.draftName,
                    draftData.noticeType,
                    draftData.caseNumber,
                    draftData.issuingAgency,
                    draftData.publicText,
                    draftData.caseDetails,
                    draftData.legalRights,
                    JSON.stringify(draftData.recipients),
                    draftData.tokenName,
                    draftData.deliveryMethod,
                    draftData.sponsorFees,
                    draftData.thumbnailData,
                    draftData.documentData,
                    draftData.encryptedDocumentData,
                    draftData.ipfsHash,
                    draftData.encryptedIPFS,
                    draftData.encryptionKey,
                    draftData.metadataURI,
                    JSON.stringify(draftData.customFields)
                ]);
                
                // Delete old files
                await client.query('DELETE FROM draft_files WHERE draft_id = $1', [draftId]);
                
            } else {
                // Insert new draft
                await client.query(`
                    INSERT INTO notice_drafts (
                        draft_id, draft_name, server_address, notice_type, case_number,
                        issuing_agency, public_text, case_details, legal_rights, recipients,
                        token_name, delivery_method, sponsor_fees, thumbnail_data, document_data,
                        encrypted_document_data, ipfs_hash, encrypted_ipfs, encryption_key,
                        metadata_uri, custom_fields
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                `, [
                    draftId,
                    draftData.draftName,
                    draftData.serverAddress,
                    draftData.noticeType,
                    draftData.caseNumber,
                    draftData.issuingAgency,
                    draftData.publicText,
                    draftData.caseDetails,
                    draftData.legalRights,
                    JSON.stringify(draftData.recipients),
                    draftData.tokenName,
                    draftData.deliveryMethod,
                    draftData.sponsorFees,
                    draftData.thumbnailData,
                    draftData.documentData,
                    draftData.encryptedDocumentData,
                    draftData.ipfsHash,
                    draftData.encryptedIPFS,
                    draftData.encryptionKey,
                    draftData.metadataURI,
                    JSON.stringify(draftData.customFields)
                ]);
            }
            
            // Save file references
            if (req.files) {
                for (const fieldname in req.files) {
                    for (const file of req.files[fieldname]) {
                        await client.query(`
                            INSERT INTO draft_files (
                                draft_id, file_type, file_name, file_path, file_size, mime_type
                            ) VALUES ($1, $2, $3, $4, $5, $6)
                        `, [
                            draftId,
                            fieldname,
                            file.originalname,
                            file.filename,
                            file.size,
                            file.mimetype
                        ]);
                    }
                }
            }
            
            await client.query('COMMIT');
            
            res.json({
                success: true,
                draftId,
                draftName: draftData.draftName,
                message: existingDraft.rows.length > 0 ? 'Draft updated successfully' : 'Draft saved successfully'
            });
            
        } catch (error) {
            if (client) {
                await client.query('ROLLBACK');
            }
            
            console.error('Error saving draft:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
            
        } finally {
            if (client) {
                client.release();
            }
        }
});

/**
 * GET /api/drafts/list
 * Get all drafts for a server address
 */
router.get('/list', async (req, res) => {
    console.log('GET /api/drafts/list - Request from:', req.headers.origin);
    console.log('Server address:', req.query.serverAddress);
    
    let client;
    
    try {
        const serverAddress = req.query.serverAddress;
        
        if (!serverAddress) {
            return res.status(400).json({
                success: false,
                error: 'Server address required'
            });
        }
        
        client = await pool.connect();
        
        const result = await client.query(`
            SELECT 
                draft_id,
                draft_name,
                notice_type,
                case_number,
                issuing_agency,
                recipients,
                status,
                created_at,
                updated_at,
                last_accessed
            FROM notice_drafts
            WHERE server_address = $1
            AND status IN ('draft', 'staged')
            ORDER BY last_accessed DESC
            LIMIT 50
        `, [serverAddress]);
        
        const drafts = result.rows.map(row => ({
            ...row,
            recipients: JSON.parse(row.recipients || '[]'),
            recipientCount: JSON.parse(row.recipients || '[]').length
        }));
        
        res.json({
            success: true,
            drafts
        });
        
    } catch (error) {
        console.error('Error listing drafts:', error);
        console.error('Stack trace:', error.stack);
        
        // Always return JSON even on error
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to list drafts',
            drafts: []
        });
        
    } finally {
        if (client) {
            client.release();
        }
    }
});

/**
 * GET /api/drafts/load/:draftId
 * Load a specific draft
 */
router.get('/load/:draftId', async (req, res) => {
    let client;
    
    try {
        const { draftId } = req.params;
        
        client = await pool.connect();
        
        // Update last accessed time
        await client.query(
            'UPDATE notice_drafts SET last_accessed = NOW() WHERE draft_id = $1',
            [draftId]
        );
        
        // Get draft data
        const draftResult = await client.query(`
            SELECT * FROM notice_drafts WHERE draft_id = $1
        `, [draftId]);
        
        if (draftResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Draft not found'
            });
        }
        
        const draft = draftResult.rows[0];
        
        // Get associated files
        const filesResult = await client.query(`
            SELECT * FROM draft_files WHERE draft_id = $1
        `, [draftId]);
        
        // Parse JSON fields
        draft.recipients = JSON.parse(draft.recipients || '[]');
        draft.custom_fields = JSON.parse(draft.custom_fields || '{}');
        
        res.json({
            success: true,
            draft,
            files: filesResult.rows
        });
        
    } catch (error) {
        console.error('Error loading draft:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
        
    } finally {
        if (client) {
            client.release();
        }
    }
});

/**
 * DELETE /api/drafts/:draftId
 * Delete a draft
 */
router.delete('/:draftId', async (req, res) => {
    let client;
    
    try {
        const { draftId } = req.params;
        
        client = await pool.connect();
        
        // Get file paths before deletion
        const filesResult = await client.query(`
            SELECT file_path FROM draft_files WHERE draft_id = $1
        `, [draftId]);
        
        // Delete from database (cascade will delete files)
        const deleteResult = await client.query(`
            DELETE FROM notice_drafts WHERE draft_id = $1 RETURNING draft_id
        `, [draftId]);
        
        if (deleteResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Draft not found'
            });
        }
        
        // Delete physical files
        const draftsDir = path.join(__dirname, '../uploads/drafts');
        for (const file of filesResult.rows) {
            if (file.file_path) {
                const filePath = path.join(draftsDir, file.file_path);
                await fs.unlink(filePath).catch(() => {});
            }
        }
        
        res.json({
            success: true,
            message: 'Draft deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting draft:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
        
    } finally {
        if (client) {
            client.release();
        }
    }
});

/**
 * POST /api/drafts/convert/:draftId
 * Convert a draft to a staged transaction
 */
router.post('/convert/:draftId', async (req, res) => {
    let client;
    
    try {
        const { draftId } = req.params;
        
        client = await pool.connect();
        
        // Get draft data
        const draftResult = await client.query(`
            SELECT * FROM notice_drafts WHERE draft_id = $1
        `, [draftId]);
        
        if (draftResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Draft not found'
            });
        }
        
        const draft = draftResult.rows[0];
        
        // Update draft status
        await client.query(`
            UPDATE notice_drafts SET status = 'staged' WHERE draft_id = $1
        `, [draftId]);
        
        res.json({
            success: true,
            draft,
            message: 'Draft ready for staging'
        });
        
    } catch (error) {
        console.error('Error converting draft:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
        
    } finally {
        if (client) {
            client.release();
        }
    }
});

module.exports = router;