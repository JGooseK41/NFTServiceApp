/**
 * Unencrypted Document Storage Routes
 * Stores unencrypted copies of documents for process server access via case manager
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs').promises;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

/**
 * Store unencrypted document for case manager access
 * POST /api/documents/notice/:noticeId/unencrypted
 */
router.post('/notice/:noticeId/unencrypted', upload.single('unencryptedDocument'), async (req, res) => {
    try {
        const { noticeId } = req.params;
        const { caseNumber, serverAddress, documentType, accessType } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No document provided' });
        }
        
        console.log(`Storing unencrypted document for notice ${noticeId}...`);
        
        // Store document in database (or disk if configured)
        const documentData = req.file.buffer.toString('base64');
        const dataUrl = `data:${req.file.mimetype};base64,${documentData}`;
        
        // First, ensure notice_components entry exists
        const checkQuery = `
            SELECT notice_id FROM notice_components WHERE notice_id = $1
        `;
        const checkResult = await pool.query(checkQuery, [noticeId]);
        
        if (checkResult.rows.length === 0) {
            // Create entry if it doesn't exist
            await pool.query(`
                INSERT INTO notice_components (
                    notice_id, 
                    case_number,
                    server_address,
                    created_at
                ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            `, [noticeId, caseNumber || '', serverAddress || '']);
        }
        
        // Store unencrypted document
        const updateQuery = `
            UPDATE notice_components
            SET 
                unencrypted_document_data = $1,
                unencrypted_document_mime_type = $2,
                unencrypted_document_filename = $3,
                unencrypted_stored_at = CURRENT_TIMESTAMP
            WHERE notice_id = $4
        `;
        
        await pool.query(updateQuery, [
            dataUrl,
            req.file.mimetype,
            req.file.originalname,
            noticeId
        ]);
        
        // If Render disk is available, also store on disk
        const DISK_MOUNT_PATH = process.env.DISK_MOUNT_PATH || '/var/data';
        try {
            await fs.access(DISK_MOUNT_PATH);
            
            const diskDir = path.join(DISK_MOUNT_PATH, 'unencrypted_documents');
            await fs.mkdir(diskDir, { recursive: true });
            
            const diskPath = path.join(diskDir, `${noticeId}_${req.file.originalname}`);
            await fs.writeFile(diskPath, req.file.buffer);
            
            console.log(`✅ Also stored on disk: ${diskPath}`);
        } catch (diskError) {
            console.log('Disk storage not available, using database only');
        }
        
        res.json({
            success: true,
            message: 'Unencrypted document stored successfully',
            noticeId,
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size
        });
        
    } catch (error) {
        console.error('Error storing unencrypted document:', error);
        res.status(500).json({ error: 'Failed to store document' });
    }
});

/**
 * Retrieve unencrypted document for case manager viewing
 * GET /api/documents/notice/:noticeId/unencrypted
 */
router.get('/notice/:noticeId/unencrypted', async (req, res) => {
    try {
        const { noticeId } = req.params;
        const { serverAddress } = req.query;
        
        console.log(`Retrieving unencrypted document for notice ${noticeId}...`);
        
        // Get document from database
        const query = `
            SELECT 
                unencrypted_document_data,
                unencrypted_document_mime_type,
                unencrypted_document_filename,
                document_data,
                document_mime_type,
                server_address
            FROM notice_components
            WHERE notice_id = $1
        `;
        
        const result = await pool.query(query, [noticeId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        const doc = result.rows[0];
        
        // Verify server has access
        if (serverAddress && doc.server_address && doc.server_address !== serverAddress) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Return unencrypted document if available, otherwise fall back to regular document
        if (doc.unencrypted_document_data) {
            res.json({
                success: true,
                documentData: doc.unencrypted_document_data,
                mimeType: doc.unencrypted_document_mime_type,
                fileName: doc.unencrypted_document_filename
            });
        } else if (doc.document_data) {
            // Fallback to regular document
            res.json({
                success: true,
                documentData: doc.document_data,
                mimeType: doc.document_mime_type,
                fileName: 'document.pdf'
            });
        } else {
            res.status(404).json({ error: 'No document data available' });
        }
        
    } catch (error) {
        console.error('Error retrieving unencrypted document:', error);
        res.status(500).json({ error: 'Failed to retrieve document' });
    }
});

/**
 * Direct view endpoint for documents
 * GET /api/documents/notice/:noticeId/view
 */
router.get('/notice/:noticeId/view', async (req, res) => {
    try {
        const { noticeId } = req.params;
        
        // Get document
        const query = `
            SELECT 
                unencrypted_document_data,
                unencrypted_document_mime_type,
                document_data,
                document_mime_type
            FROM notice_components
            WHERE notice_id = $1
        `;
        
        const result = await pool.query(query, [noticeId]);
        
        if (result.rows.length === 0) {
            return res.status(404).send('Document not found');
        }
        
        const doc = result.rows[0];
        const data = doc.unencrypted_document_data || doc.document_data;
        const mimeType = doc.unencrypted_document_mime_type || doc.document_mime_type || 'application/pdf';
        
        if (!data) {
            return res.status(404).send('No document data available');
        }
        
        // Convert base64 to buffer
        let buffer;
        if (data.startsWith('data:')) {
            const base64Data = data.split(',')[1];
            buffer = Buffer.from(base64Data, 'base64');
        } else {
            buffer = Buffer.from(data, 'base64');
        }
        
        // Send document
        res.set('Content-Type', mimeType);
        res.set('Content-Disposition', `inline; filename="document_${noticeId}.pdf"`);
        res.send(buffer);
        
    } catch (error) {
        console.error('Error viewing document:', error);
        res.status(500).send('Failed to load document');
    }
});

// Ensure table has unencrypted document columns
async function ensureTableStructure() {
    try {
        const alterQueries = [
            `ALTER TABLE notice_components ADD COLUMN IF NOT EXISTS unencrypted_document_data TEXT`,
            `ALTER TABLE notice_components ADD COLUMN IF NOT EXISTS unencrypted_document_mime_type VARCHAR(100)`,
            `ALTER TABLE notice_components ADD COLUMN IF NOT EXISTS unencrypted_document_filename VARCHAR(255)`,
            `ALTER TABLE notice_components ADD COLUMN IF NOT EXISTS unencrypted_stored_at TIMESTAMP`
        ];
        
        for (const query of alterQueries) {
            try {
                await pool.query(query);
            } catch (error) {
                if (error.code !== '42701') { // Column already exists
                    console.error('Error adding column:', error.message);
                }
            }
        }
        
        console.log('✅ Unencrypted document columns ready');
    } catch (error) {
        console.error('Error ensuring table structure:', error);
    }
}

// Initialize on startup
ensureTableStructure();

module.exports = router;