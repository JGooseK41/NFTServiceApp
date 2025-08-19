/**
 * Documents V2 - Proper implementation from scratch
 * Handles disk storage correctly
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { Pool } = require('pg');

// Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Storage paths
const STORAGE_PATH = process.env.DISK_MOUNT_PATH || '/var/data';
const DOCUMENTS_PATH = path.join(STORAGE_PATH, 'documents');
const FALLBACK_PATH = path.join(__dirname, '../../uploads');

// Ensure storage directory exists
async function ensureStorage() {
    // Try primary storage
    try {
        await fs.access(STORAGE_PATH);
        await fs.mkdir(DOCUMENTS_PATH, { recursive: true });
        console.log(`✅ Using disk storage at: ${DOCUMENTS_PATH}`);
        return DOCUMENTS_PATH;
    } catch {
        // Use fallback
        try {
            await fs.mkdir(FALLBACK_PATH, { recursive: true });
            console.log(`⚠️ Using fallback storage at: ${FALLBACK_PATH}`);
            return FALLBACK_PATH;
        } catch (error) {
            console.error('❌ No storage available:', error);
            throw error;
        }
    }
}

// Get active storage path
let activeStoragePath = FALLBACK_PATH;
ensureStorage().then(path => { activeStoragePath = path; });

// Configure multer to store files directly
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        cb(null, activeStoragePath);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files allowed'));
        }
    }
});

/**
 * Upload PDF to disk
 * POST /api/v2/documents/upload-to-disk
 */
router.post('/upload-to-disk', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { noticeId } = req.body;
        const filePath = req.file.path;
        const fileName = req.file.filename;

        console.log(`📁 Stored PDF: ${fileName} at ${filePath}`);

        // Store reference in database
        await pool.query(`
            INSERT INTO document_storage_v2 (
                notice_id,
                file_name,
                original_name,
                file_path,
                file_size,
                storage_type,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (notice_id) DO UPDATE SET
                file_name = EXCLUDED.file_name,
                file_path = EXCLUDED.file_path,
                updated_at = NOW()
        `, [
            noticeId,
            fileName,
            req.file.originalname,
            filePath,
            req.file.size,
            activeStoragePath === DOCUMENTS_PATH ? 'disk' : 'local'
        ]);

        res.json({
            success: true,
            path: filePath,
            url: `/api/v2/documents/serve/${fileName}`,
            fileName: fileName,
            size: req.file.size
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Serve PDF from disk
 * GET /api/v2/documents/serve/:filename
 */
router.get('/serve/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        
        // Sanitize filename
        const safeName = path.basename(filename);
        
        // Try primary storage first
        let filePath = path.join(activeStoragePath, safeName);
        
        try {
            await fs.access(filePath);
        } catch {
            // Try fallback
            filePath = path.join(FALLBACK_PATH, safeName);
            await fs.access(filePath);
        }

        // Set headers for PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
        
        // Stream file
        const fileStream = require('fs').createReadStream(filePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('Serve error:', error);
        res.status(404).json({ error: 'File not found' });
    }
});

/**
 * Get document for case manager
 * GET /api/v2/documents/get-from-disk/:noticeId
 */
router.get('/get-from-disk/:noticeId', async (req, res) => {
    try {
        const { noticeId } = req.params;

        // Get file info from database
        const result = await pool.query(`
            SELECT file_name, file_path, original_name
            FROM document_storage_v2
            WHERE notice_id = $1
        `, [noticeId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const doc = result.rows[0];
        
        // Serve the file
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${doc.original_name}"`);
        
        const fileStream = require('fs').createReadStream(doc.file_path);
        fileStream.pipe(res);

    } catch (error) {
        console.error('Get document error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Store thumbnail (small, can go in database)
 * POST /api/v2/documents/store-thumbnail
 */
router.post('/store-thumbnail', express.json({ limit: '10mb' }), async (req, res) => {
    try {
        const { noticeId, thumbnail } = req.body;

        await pool.query(`
            UPDATE document_storage_v2
            SET thumbnail_data = $1
            WHERE notice_id = $2
        `, [thumbnail, noticeId]);

        res.json({ success: true });

    } catch (error) {
        console.error('Thumbnail error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Initialize table
 */
async function initTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS document_storage_v2 (
                id SERIAL PRIMARY KEY,
                notice_id VARCHAR(255) UNIQUE NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                original_name VARCHAR(255),
                file_path TEXT NOT NULL,
                file_size BIGINT,
                storage_type VARCHAR(50),
                thumbnail_data TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Document storage V2 table ready');
    } catch (error) {
        console.error('Table init error:', error);
    }
}

// Initialize on load
initTable();

module.exports = router;