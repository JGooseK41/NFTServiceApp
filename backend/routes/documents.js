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
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image and PDF files are allowed'));
        }
    }
});

// Ensure notice_components table exists
async function ensureTableExists(pool) {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notice_components (
                id SERIAL PRIMARY KEY,
                notice_id INTEGER NOT NULL,
                case_number VARCHAR(255) NOT NULL,
                server_address VARCHAR(255) NOT NULL,
                recipient_address VARCHAR(255) NOT NULL,
                
                -- Alert NFT data
                alert_id INTEGER NOT NULL,
                alert_thumbnail_url TEXT,
                alert_nft_description TEXT,
                alert_token_uri TEXT,
                alert_acknowledged BOOLEAN DEFAULT FALSE,
                alert_acknowledged_at TIMESTAMP,
                
                -- Document NFT data  
                document_id INTEGER NOT NULL,
                document_ipfs_hash VARCHAR(255),
                document_encryption_key TEXT,
                document_unencrypted_url TEXT,
                document_accepted BOOLEAN DEFAULT FALSE,
                document_accepted_at TIMESTAMP,
                
                -- Common data
                notice_type VARCHAR(100),
                issuing_agency VARCHAR(255),
                served_at TIMESTAMP NOT NULL,
                chain_type VARCHAR(50) NOT NULL DEFAULT 'tron_mainnet',
                transaction_hash VARCHAR(255),
                
                -- Compiled document fields
                page_count INTEGER DEFAULT 1,
                is_compiled BOOLEAN DEFAULT FALSE,
                document_count INTEGER DEFAULT 1,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                UNIQUE(notice_id, chain_type)
            )
        `);
        
        -- Add columns if they don't exist (for existing tables)
        await pool.query(`
            ALTER TABLE notice_components 
            ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1,
            ADD COLUMN IF NOT EXISTS is_compiled BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS document_count INTEGER DEFAULT 1
        `).catch(err => console.log('Columns might already exist:', err.message));
        
        // Create indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_case_number ON notice_components(case_number)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_server_address ON notice_components(server_address)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_recipient_address ON notice_components(recipient_address)');
    } catch (error) {
        console.error('Error ensuring table exists:', error);
    }
}

// Store notice components (alert + document)
router.post('/notice/:noticeId/components', upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'unencryptedDocument', maxCount: 1 }
]), async (req, res) => {
    const { noticeId } = req.params;
    const { 
        caseNumber,
        serverAddress,
        recipientAddress,
        alertId,
        documentId,
        nftDescription,
        noticeType,
        issuingAgency,
        ipfsHash,
        encryptionKey,
        chainType = 'tron_mainnet',
        pageCount,
        isCompiled,
        documentCount
    } = req.body;
    
    try {
        const { pool } = req.app.locals;
        
        // Get uploaded file URLs
        const thumbnailUrl = req.files?.thumbnail ? 
            `/uploads/documents/${req.files.thumbnail[0].filename}` : null;
        const unencryptedDocUrl = req.files?.unencryptedDocument ? 
            `/uploads/documents/${req.files.unencryptedDocument[0].filename}` : null;
        
        // Store in notice_components table
        const query = `
            INSERT INTO notice_components (
                notice_id, case_number, server_address, recipient_address,
                alert_id, alert_thumbnail_url, alert_nft_description,
                document_id, document_ipfs_hash, document_encryption_key,
                document_unencrypted_url, notice_type, issuing_agency,
                served_at, chain_type, page_count, is_compiled, document_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), $14, $15, $16, $17)
            ON CONFLICT (notice_id, chain_type) DO UPDATE SET
                alert_thumbnail_url = EXCLUDED.alert_thumbnail_url,
                alert_nft_description = EXCLUDED.alert_nft_description,
                document_unencrypted_url = EXCLUDED.document_unencrypted_url,
                page_count = EXCLUDED.page_count,
                is_compiled = EXCLUDED.is_compiled,
                document_count = EXCLUDED.document_count,
                updated_at = NOW()
            RETURNING *
        `;
        
        const values = [
            noticeId, caseNumber, serverAddress, recipientAddress,
            alertId, thumbnailUrl, nftDescription,
            documentId, ipfsHash, encryptionKey, unencryptedDocUrl,
            noticeType, issuingAgency, chainType,
            parseInt(pageCount) || 1,
            isCompiled === 'true' || false,
            parseInt(documentCount) || 1
        ];
        
        const result = await pool.query(query, values);
        
        res.json({
            success: true,
            noticeId: noticeId,
            data: result.rows[0],
            // Return URLs in the format expected by multi-document handler
            url: unencryptedDocUrl,
            documentUrl: unencryptedDocUrl,
            thumbnailUrl: thumbnailUrl,
            alertThumbnailUrl: thumbnailUrl,
            pageCount: parseInt(pageCount) || 1,
            isCompiled: isCompiled === 'true',
            documentCount: parseInt(documentCount) || 1,
            urls: {
                thumbnail: thumbnailUrl,
                unencryptedDocument: unencryptedDocUrl
            }
        });
        
    } catch (error) {
        console.error('Error storing notice components:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to store notice components' 
        });
    }
});

// Get notices grouped by case number for a server
router.get('/server/:serverAddress/cases', async (req, res) => {
    const { serverAddress } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    try {
        const { pool } = req.app.locals;
        
        // Ensure table exists
        await ensureTableExists(pool);
        
        // Get notices grouped by case number
        const query = `
            SELECT 
                case_number,
                COUNT(*) as notice_count,
                MIN(served_at) as first_served,
                MAX(served_at) as last_served,
                array_agg(
                    json_build_object(
                        'notice_id', notice_id,
                        'alert_id', alert_id,
                        'document_id', document_id,
                        'recipient', recipient_address,
                        'alert_acknowledged', alert_acknowledged,
                        'document_accepted', document_accepted,
                        'thumbnail_url', alert_thumbnail_url,
                        'notice_type', notice_type
                    ) ORDER BY notice_id
                ) as notices
            FROM notice_components
            WHERE server_address = $1
            GROUP BY case_number
            ORDER BY MAX(served_at) DESC
            LIMIT $2 OFFSET $3
        `;
        
        const result = await pool.query(query, [serverAddress, limit, offset]);
        
        res.json({
            success: true,
            cases: result.rows,
            total: result.rowCount
        });
        
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch cases' 
        });
    }
});

// Get full notice details including unencrypted document (only for server)
router.get('/notice/:noticeId/receipt-data', async (req, res) => {
    const { noticeId } = req.params;
    const { serverAddress } = req.query;
    
    if (!serverAddress) {
        return res.status(400).json({ 
            success: false, 
            error: 'Server address required' 
        });
    }
    
    try {
        const { pool } = req.app.locals;
        
        // Ensure table exists
        await ensureTableExists(pool);
        
        // Verify the requester is the server who sent the notice
        const query = `
            SELECT * FROM notice_components
            WHERE notice_id = $1 AND server_address = $2
        `;
        
        const result = await pool.query(query, [noticeId, serverAddress]);
        
        if (result.rows.length === 0) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied or notice not found' 
            });
        }
        
        const notice = result.rows[0];
        
        // Return full data including unencrypted document URL
        res.json({
            success: true,
            notice: {
                ...notice,
                // Include full URLs for images
                alert_thumbnail_full_url: notice.alert_thumbnail_url ? 
                    `${req.protocol}://${req.get('host')}${notice.alert_thumbnail_url}` : null,
                document_unencrypted_full_url: notice.document_unencrypted_url ? 
                    `${req.protocol}://${req.get('host')}${notice.document_unencrypted_url}` : null
            }
        });
        
    } catch (error) {
        console.error('Error fetching receipt data:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch receipt data' 
        });
    }
});

// Update acknowledgment status
router.post('/notice/:noticeId/acknowledge', async (req, res) => {
    const { noticeId } = req.params;
    const { type, acknowledged = true } = req.body; // type: 'alert' or 'document'
    
    try {
        const { pool } = req.app.locals;
        
        let query;
        if (type === 'alert') {
            query = `
                UPDATE notice_components 
                SET alert_acknowledged = $2, 
                    alert_acknowledged_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
                    updated_at = NOW()
                WHERE notice_id = $1
                RETURNING *
            `;
        } else if (type === 'document') {
            query = `
                UPDATE notice_components 
                SET document_accepted = $2,
                    document_accepted_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
                    updated_at = NOW()
                WHERE notice_id = $1
                RETURNING *
            `;
        } else {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid type. Must be "alert" or "document"' 
            });
        }
        
        const result = await pool.query(query, [noticeId, acknowledged]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Notice not found' 
            });
        }
        
        res.json({
            success: true,
            notice: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error updating acknowledgment:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update acknowledgment' 
        });
    }
});

module.exports = router;