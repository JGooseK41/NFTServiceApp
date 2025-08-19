/**
 * Disk-Only Document Storage
 * Stores PDFs on Render disk, database only holds references
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Render disk mount path
const DISK_MOUNT_PATH = process.env.DISK_MOUNT_PATH || '/var/data';
const DOCUMENTS_DIR = path.join(DISK_MOUNT_PATH, 'documents');

// Ensure directories exist
async function ensureDirectories() {
    try {
        await fs.access(DISK_MOUNT_PATH);
        await fs.mkdir(path.join(DOCUMENTS_DIR, 'pdfs'), { recursive: true });
        await fs.mkdir(path.join(DOCUMENTS_DIR, 'thumbnails'), { recursive: true });
        await fs.mkdir(path.join(DOCUMENTS_DIR, 'unencrypted'), { recursive: true });
        console.log('✅ Disk directories ready at:', DOCUMENTS_DIR);
        return true;
    } catch (error) {
        console.error('❌ Disk storage not available:', error.message);
        return false;
    }
}

// Configure multer to store directly on disk
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(DOCUMENTS_DIR, 'pdfs');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.pdf`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

/**
 * Store document reference in database (not the actual file)
 */
async function storeDocumentReference(noticeId, fileInfo, metadata) {
    const query = `
        INSERT INTO document_references (
            notice_id,
            file_path,
            file_name,
            file_size,
            mime_type,
            storage_type,
            case_number,
            server_address,
            created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (notice_id) DO UPDATE SET
            file_path = EXCLUDED.file_path,
            file_name = EXCLUDED.file_name,
            updated_at = NOW()
        RETURNING *
    `;
    
    const values = [
        noticeId,
        fileInfo.path,
        fileInfo.originalname,
        fileInfo.size,
        fileInfo.mimetype,
        'disk',
        metadata.caseNumber || null,
        metadata.serverAddress || null
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
}

/**
 * Upload document - stores on disk only
 * POST /api/documents/disk/:noticeId
 */
router.post('/disk/:noticeId', upload.single('document'), async (req, res) => {
    try {
        const { noticeId } = req.params;
        const { caseNumber, serverAddress, documentType } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        console.log(`📁 Stored on disk: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // Store only reference in database
        const reference = await storeDocumentReference(noticeId, req.file, {
            caseNumber,
            serverAddress
        });
        
        // Also store unencrypted copy for case manager
        if (documentType !== 'encrypted') {
            const unencryptedPath = path.join(DOCUMENTS_DIR, 'unencrypted', req.file.filename);
            await fs.copyFile(req.file.path, unencryptedPath);
            console.log('📂 Unencrypted copy stored for case manager');
        }
        
        res.json({
            success: true,
            message: 'Document stored on disk',
            fileId: req.file.filename,
            filePath: `/api/documents/serve/${req.file.filename}`,
            fileSize: req.file.size,
            noticeId
        });
        
    } catch (error) {
        console.error('Error storing document:', error);
        res.status(500).json({ error: 'Failed to store document' });
    }
});

/**
 * Serve document from disk
 * GET /api/documents/serve/:filename
 */
router.get('/serve/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        
        // Sanitize filename
        const safeName = path.basename(filename);
        const filePath = path.join(DOCUMENTS_DIR, 'pdfs', safeName);
        
        // Check if file exists
        await fs.access(filePath);
        
        // Stream file to response
        res.sendFile(filePath);
        
    } catch (error) {
        console.error('Error serving document:', error);
        res.status(404).json({ error: 'Document not found' });
    }
});

/**
 * Get document for case manager (unencrypted)
 * GET /api/documents/case/:noticeId
 */
router.get('/case/:noticeId', async (req, res) => {
    try {
        const { noticeId } = req.params;
        
        // Get file reference from database
        const query = `
            SELECT file_path, file_name, mime_type
            FROM document_references
            WHERE notice_id = $1
        `;
        
        const result = await pool.query(query, [noticeId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        const doc = result.rows[0];
        
        // Check unencrypted version first
        const filename = path.basename(doc.file_path);
        let filePath = path.join(DOCUMENTS_DIR, 'unencrypted', filename);
        
        try {
            await fs.access(filePath);
        } catch {
            // Fall back to original
            filePath = doc.file_path;
        }
        
        // Stream file
        res.sendFile(filePath);
        
    } catch (error) {
        console.error('Error retrieving document:', error);
        res.status(500).json({ error: 'Failed to retrieve document' });
    }
});

/**
 * Store thumbnail only (small base64 is OK)
 * POST /api/documents/thumbnail/:noticeId
 */
router.post('/thumbnail/:noticeId', upload.single('thumbnail'), async (req, res) => {
    try {
        const { noticeId } = req.params;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No thumbnail provided' });
        }
        
        // For thumbnails, we can store in DB since they're small
        const thumbnailData = req.file.buffer.toString('base64');
        
        const query = `
            UPDATE notice_components
            SET 
                alert_thumbnail_data = $1,
                alert_thumbnail_mime_type = $2
            WHERE notice_id = $3
        `;
        
        await pool.query(query, [
            `data:${req.file.mimetype};base64,${thumbnailData}`,
            req.file.mimetype,
            noticeId
        ]);
        
        res.json({
            success: true,
            message: 'Thumbnail stored',
            noticeId
        });
        
    } catch (error) {
        console.error('Error storing thumbnail:', error);
        res.status(500).json({ error: 'Failed to store thumbnail' });
    }
});

/**
 * Cleanup old files
 */
async function cleanupOldFiles() {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Get old references
        const query = `
            SELECT file_path 
            FROM document_references 
            WHERE created_at < $1
        `;
        
        const result = await pool.query(query, [thirtyDaysAgo]);
        
        for (const row of result.rows) {
            try {
                await fs.unlink(row.file_path);
                console.log(`🗑️ Cleaned up old file: ${path.basename(row.file_path)}`);
            } catch (error) {
                // File might already be deleted
            }
        }
        
        // Remove database references
        await pool.query(`
            DELETE FROM document_references 
            WHERE created_at < $1
        `, [thirtyDaysAgo]);
        
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

// Ensure table exists
async function ensureTableExists() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS document_references (
                id SERIAL PRIMARY KEY,
                notice_id VARCHAR(255) UNIQUE NOT NULL,
                file_path TEXT NOT NULL,
                file_name VARCHAR(255),
                file_size BIGINT,
                mime_type VARCHAR(100),
                storage_type VARCHAR(50) DEFAULT 'disk',
                case_number VARCHAR(255),
                server_address VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        console.log('✅ Document references table ready');
    } catch (error) {
        console.error('Error creating table:', error);
    }
}

// Initialize on startup
(async () => {
    const diskAvailable = await ensureDirectories();
    if (diskAvailable) {
        await ensureTableExists();
        // Schedule cleanup every 24 hours
        setInterval(cleanupOldFiles, 24 * 60 * 60 * 1000);
    } else {
        console.warn('⚠️ Disk storage not available - documents cannot be stored');
    }
})();

module.exports = router;