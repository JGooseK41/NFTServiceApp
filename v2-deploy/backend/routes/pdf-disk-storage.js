/**
 * PDF Disk Storage Routes
 * Handles storing PDFs on Render disk and serving them appropriately
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Use Render mounted disk path
const DISK_MOUNT_PATH = process.env.DISK_MOUNT_PATH || '/var/data';
const PDF_UPLOAD_DIR = path.join(DISK_MOUNT_PATH, 'uploads', 'pdfs');

// Configure multer for PDF uploads to mounted disk
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = PDF_UPLOAD_DIR;
        await fs.mkdir(uploadDir, { recursive: true });
        console.log(`📁 Upload directory (mounted disk): ${uploadDir}`);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        const filename = `pdf-${uniqueSuffix}${path.extname(file.originalname)}`;
        console.log(`📄 Saving PDF as: ${filename}`);
        cb(null, filename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for PDFs
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});

/**
 * Upload PDF to disk storage
 * POST /api/documents/upload-pdf
 */
router.post('/upload-pdf', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No PDF file uploaded' 
            });
        }

        const {
            noticeId,
            caseNumber,
            serverAddress,
            recipientAddress,
            fileName,
            fileType,
            fileSize
        } = req.body;

        console.log(`✅ PDF uploaded to disk: ${req.file.filename}`);
        console.log(`   Path: ${req.file.path}`);
        console.log(`   Size: ${req.file.size} bytes`);

        // Store reference in database
        const query = `
            INSERT INTO document_storage (
                notice_id,
                case_number,
                server_address,
                recipient_address,
                file_name,
                file_path,
                file_size,
                file_type,
                disk_filename,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            ON CONFLICT (notice_id) DO UPDATE SET
                file_path = EXCLUDED.file_path,
                disk_filename = EXCLUDED.disk_filename,
                updated_at = NOW()
            RETURNING *
        `;

        // Store the actual disk path and a URL path for serving
        const diskPath = req.file.path;
        const servePath = `/api/documents/serve-pdf/${req.file.filename}`;
        
        await pool.query(query, [
            noticeId,
            caseNumber,
            serverAddress,
            recipientAddress,
            fileName || req.file.originalname,
            diskPath,  // Store actual disk path
            req.file.size,
            fileType || 'application/pdf',
            req.file.filename
        ]);

        res.json({
            success: true,
            documentUrl: servePath,  // URL for serving the file
            diskPath: diskPath,       // Actual disk location
            fileId: req.file.filename,
            fileSize: req.file.size,
            message: 'PDF stored on Render disk successfully'
        });

    } catch (error) {
        console.error('Error uploading PDF:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to upload PDF',
            message: error.message 
        });
    }
});

/**
 * Serve PDF file from disk by filename
 * GET /api/documents/serve-pdf/:filename
 */
router.get('/serve-pdf/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(PDF_UPLOAD_DIR, filename);
        
        // Check if file exists
        await fs.access(filePath);
        
        // Send the PDF file
        res.sendFile(filePath);
        
    } catch (error) {
        console.error('Error serving PDF:', error);
        res.status(404).json({ 
            success: false,
            error: 'PDF not found' 
        });
    }
});

/**
 * Retrieve PDF for server (theblockservice.com)
 * GET /api/documents/pdf/:noticeId
 */
router.get('/pdf/:noticeId', async (req, res) => {
    try {
        const { noticeId } = req.params;
        const { serverAddress } = req.query;

        if (!serverAddress) {
            return res.status(400).json({ 
                success: false,
                error: 'Server address required' 
            });
        }

        // Verify requester is the server
        const query = `
            SELECT * FROM document_storage
            WHERE notice_id = $1 AND server_address = $2
        `;

        const result = await pool.query(query, [noticeId, serverAddress]);

        if (result.rows.length === 0) {
            return res.status(403).json({ 
                success: false,
                error: 'Access denied or document not found' 
            });
        }

        const doc = result.rows[0];
        const filePath = path.join(__dirname, '..', doc.file_path);

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({ 
                success: false,
                error: 'PDF file not found on disk' 
            });
        }

        // Send the PDF file
        res.sendFile(filePath);

    } catch (error) {
        console.error('Error retrieving PDF:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to retrieve PDF' 
        });
    }
});

/**
 * Retrieve PDF for recipient (blockserved.com)
 * GET /api/documents/recipient-pdf/:noticeId
 */
router.get('/recipient-pdf/:noticeId', async (req, res) => {
    try {
        const { noticeId } = req.params;
        const { recipientAddress } = req.query;

        if (!recipientAddress) {
            return res.status(400).json({ 
                success: false,
                error: 'Recipient address required' 
            });
        }

        // Check if recipient has signed for the document
        const query = `
            SELECT ds.*, nc.document_accepted 
            FROM document_storage ds
            LEFT JOIN notice_components nc ON nc.notice_id = ds.notice_id
            WHERE ds.notice_id = $1 AND ds.recipient_address = $2
        `;

        const result = await pool.query(query, [noticeId, recipientAddress]);

        if (result.rows.length === 0) {
            return res.status(403).json({ 
                success: false,
                error: 'Access denied or document not found' 
            });
        }

        const doc = result.rows[0];

        // Check if document has been accepted/signed
        if (!doc.document_accepted) {
            return res.status(403).json({ 
                success: false,
                error: 'Document requires signature before viewing' 
            });
        }

        const filePath = path.join(__dirname, '..', doc.file_path);

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({ 
                success: false,
                error: 'PDF file not found on disk' 
            });
        }

        // Send the PDF file
        res.sendFile(filePath);

    } catch (error) {
        console.error('Error retrieving recipient PDF:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to retrieve PDF' 
        });
    }
});

/**
 * Get PDF for IPFS encryption
 * GET /api/documents/for-ipfs/:noticeId
 */
router.get('/for-ipfs/:noticeId', async (req, res) => {
    try {
        const { noticeId } = req.params;
        const { serverAddress } = req.query;

        // Verify server owns this document
        const query = `
            SELECT * FROM document_storage
            WHERE notice_id = $1 AND server_address = $2
        `;

        const result = await pool.query(query, [noticeId, serverAddress]);

        if (result.rows.length === 0) {
            return res.status(403).json({ 
                success: false,
                error: 'Document not found or access denied' 
            });
        }

        const doc = result.rows[0];
        const filePath = path.join(__dirname, '..', doc.file_path);

        // Read file from disk
        const fileBuffer = await fs.readFile(filePath);

        // Return as buffer for encryption
        res.json({
            success: true,
            documentBuffer: fileBuffer.toString('base64'), // Convert to base64 for transport
            fileName: doc.file_name,
            fileSize: doc.file_size,
            metadata: {
                noticeId: doc.notice_id,
                caseNumber: doc.case_number,
                serverAddress: doc.server_address,
                recipientAddress: doc.recipient_address
            }
        });

    } catch (error) {
        console.error('Error getting PDF for IPFS:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to retrieve PDF for IPFS' 
        });
    }
});

/**
 * Ensure document_storage table exists
 */
async function ensureTableExists() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS document_storage (
                id SERIAL PRIMARY KEY,
                notice_id VARCHAR(255) UNIQUE NOT NULL,
                case_number VARCHAR(255),
                server_address VARCHAR(255) NOT NULL,
                recipient_address VARCHAR(255),
                file_name VARCHAR(255),
                file_path TEXT NOT NULL,
                file_size BIGINT,
                file_type VARCHAR(100),
                disk_filename VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create indexes separately (PostgreSQL syntax)
        await pool.query('CREATE INDEX IF NOT EXISTS idx_doc_storage_notice_id ON document_storage(notice_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_doc_storage_server_address ON document_storage(server_address)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_doc_storage_recipient_address ON document_storage(recipient_address)');
        console.log('✅ Document storage table ready');
    } catch (error) {
        // Table might already exist
        console.log('Document storage table check:', error.message);
    }
}

// Initialize table on startup
ensureTableExists();

module.exports = router;