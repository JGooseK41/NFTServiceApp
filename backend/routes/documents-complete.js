/**
 * Complete Document Storage API
 * Handles both encrypted IPFS and unencrypted database storage
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const multer = require('multer');

// Increase size limit to 50MB for large PDFs
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * POST /api/documents/store-complete
 * Store complete document with dual storage
 */
router.post('/store-complete', express.json({ limit: '50mb' }), async (req, res) => {
    try {
        const {
            noticeId,
            caseNumber,
            recipientAddress,
            serverAddress,
            documentData, // Base64 PDF (unencrypted)
            documentMimeType,
            ipfsHash, // Encrypted version on IPFS
            encryptionKey, // For recipient decryption
            pageCount
        } = req.body;
        
        console.log(`Storing complete document for notice ${noticeId}`);
        console.log(`Document size: ${(documentData.length / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Page count: ${pageCount}`);
        console.log(`IPFS hash: ${ipfsHash}`);
        
        // Ensure table has all needed columns
        await pool.query(`
            ALTER TABLE notice_components 
            ADD COLUMN IF NOT EXISTS document_data TEXT,
            ADD COLUMN IF NOT EXISTS document_mime_type VARCHAR(100),
            ADD COLUMN IF NOT EXISTS ipfs_hash VARCHAR(255),
            ADD COLUMN IF NOT EXISTS encryption_key TEXT,
            ADD COLUMN IF NOT EXISTS page_count INTEGER,
            ADD COLUMN IF NOT EXISTS storage_complete BOOLEAN DEFAULT false
        `).catch(e => console.log('Columns already exist'));
        
        // Store/update document
        const result = await pool.query(`
            INSERT INTO notice_components (
                notice_id,
                case_number,
                server_address,
                recipient_address,
                document_data,
                document_mime_type,
                ipfs_hash,
                encryption_key,
                page_count,
                storage_complete,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
            ON CONFLICT (notice_id) DO UPDATE SET
                document_data = EXCLUDED.document_data,
                document_mime_type = EXCLUDED.document_mime_type,
                ipfs_hash = EXCLUDED.ipfs_hash,
                encryption_key = EXCLUDED.encryption_key,
                page_count = EXCLUDED.page_count,
                storage_complete = true,
                updated_at = NOW()
            RETURNING *
        `, [
            noticeId,
            caseNumber,
            serverAddress,
            recipientAddress,
            documentData,
            documentMimeType || 'application/pdf',
            ipfsHash,
            encryptionKey,
            pageCount
        ]);
        
        console.log('✅ Document stored successfully');
        
        res.json({
            success: true,
            id: result.rows[0].id,
            noticeId: noticeId,
            ipfsHash: ipfsHash,
            pageCount: pageCount,
            storageComplete: true
        });
        
    } catch (error) {
        console.error('Error storing document:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/documents/:noticeId/full
 * Get full unencrypted document (for process servers)
 */
router.get('/:noticeId/full', async (req, res) => {
    try {
        const { noticeId } = req.params;
        const { walletAddress } = req.query;
        
        console.log(`Fetching full document for notice ${noticeId}`);
        
        // Get document
        const result = await pool.query(`
            SELECT 
                document_data,
                document_mime_type,
                server_address,
                recipient_address,
                page_count
            FROM notice_components
            WHERE notice_id = $1
        `, [noticeId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Document not found'
            });
        }
        
        const doc = result.rows[0];
        
        // Check access (process server or recipient)
        const isServer = doc.server_address?.toLowerCase() === walletAddress?.toLowerCase();
        const isRecipient = doc.recipient_address?.toLowerCase() === walletAddress?.toLowerCase();
        
        if (!isServer && !isRecipient) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }
        
        // Log access
        await pool.query(`
            INSERT INTO document_access_log (
                notice_id,
                wallet_address,
                access_type,
                accessed_at
            ) VALUES ($1, $2, $3, NOW())
        `, [noticeId, walletAddress, isServer ? 'server' : 'recipient']).catch(e => {
            // Table might not exist
        });
        
        res.json({
            success: true,
            documentData: doc.document_data,
            mimeType: doc.document_mime_type || 'application/pdf',
            pageCount: doc.page_count,
            accessType: isServer ? 'server' : 'recipient'
        });
        
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

/**
 * GET /api/documents/:noticeId/encryption-key
 * Get encryption key for recipient (after service acceptance)
 */
router.get('/:noticeId/encryption-key', async (req, res) => {
    try {
        const { noticeId } = req.params;
        const { walletAddress, signature } = req.query;
        
        // Verify recipient
        const result = await pool.query(`
            SELECT 
                encryption_key,
                ipfs_hash,
                recipient_address
            FROM notice_components
            WHERE notice_id = $1
        `, [noticeId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Document not found'
            });
        }
        
        const doc = result.rows[0];
        
        // Verify recipient
        if (doc.recipient_address?.toLowerCase() !== walletAddress?.toLowerCase()) {
            return res.status(403).json({
                error: 'Only the recipient can access the encryption key'
            });
        }
        
        // Check if service was accepted
        const acceptanceCheck = await pool.query(`
            SELECT is_signed 
            FROM served_notices 
            WHERE notice_id = $1
        `, [noticeId]);
        
        if (!acceptanceCheck.rows[0]?.is_signed) {
            return res.status(403).json({
                error: 'Service must be accepted before accessing the document'
            });
        }
        
        res.json({
            success: true,
            encryptionKey: doc.encryption_key,
            ipfsHash: doc.ipfs_hash
        });
        
    } catch (error) {
        console.error('Error fetching encryption key:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;