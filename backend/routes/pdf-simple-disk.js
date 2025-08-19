/**
 * Simple PDF Disk Storage Routes
 * Stores PDFs directly on disk without complex database requirements
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Use Render disk or local directory
const DISK_PATH = process.env.DISK_MOUNT_PATH || path.join(__dirname, '..', 'uploads');
const PDF_DIR = path.join(DISK_PATH, 'pdfs');

// Ensure upload directory exists
async function ensureUploadDir() {
    try {
        await fs.mkdir(PDF_DIR, { recursive: true });
        console.log(`📁 PDF directory ready: ${PDF_DIR}`);
    } catch (error) {
        console.error('Error creating upload directory:', error);
    }
}

ensureUploadDir();

// Configure multer for PDF uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        await ensureUploadDir();
        cb(null, PDF_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        const filename = `pdf-${uniqueId}.pdf`;
        cb(null, filename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || 
            file.originalname.toLowerCase().endsWith('.pdf')) {
            return cb(null, true);
        }
        cb(new Error('Only PDF files are allowed'));
    }
});

/**
 * Simple PDF upload endpoint
 * POST /api/pdf-simple/upload
 */
router.post('/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No PDF file uploaded' 
            });
        }

        console.log(`✅ PDF uploaded: ${req.file.filename}`);
        console.log(`   Path: ${req.file.path}`);
        console.log(`   Size: ${req.file.size} bytes`);

        // Return the file info and URL for retrieval
        res.json({
            success: true,
            fileId: req.file.filename,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            retrieveUrl: `/api/pdf-simple/retrieve/${req.file.filename}`,
            directUrl: `/api/pdf-simple/direct/${req.file.filename}`,
            message: 'PDF uploaded successfully'
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to upload PDF',
            message: error.message 
        });
    }
});

/**
 * Retrieve PDF by file ID
 * GET /api/pdf-simple/retrieve/:fileId
 */
router.get('/retrieve/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const filePath = path.join(PDF_DIR, fileId);
        
        // Check if file exists
        const stats = await fs.stat(filePath);
        
        console.log(`📄 Serving PDF: ${fileId} (${stats.size} bytes)`);
        
        // Set proper headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Disposition', `inline; filename="${fileId}"`);
        
        // Send the file
        res.sendFile(filePath);
        
    } catch (error) {
        console.error('Retrieve error:', error);
        if (error.code === 'ENOENT') {
            res.status(404).json({ 
                success: false,
                error: 'PDF not found' 
            });
        } else {
            res.status(500).json({ 
                success: false,
                error: 'Failed to retrieve PDF',
                message: error.message 
            });
        }
    }
});

/**
 * Direct PDF access (no JSON wrapper)
 * GET /api/pdf-simple/direct/:fileId
 */
router.get('/direct/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const filePath = path.join(PDF_DIR, fileId);
        
        // Check if file exists
        await fs.access(filePath);
        
        // Send file directly
        res.sendFile(filePath);
        
    } catch (error) {
        res.status(404).send('PDF not found');
    }
});

/**
 * List all uploaded PDFs
 * GET /api/pdf-simple/list
 */
router.get('/list', async (req, res) => {
    try {
        await ensureUploadDir();
        const files = await fs.readdir(PDF_DIR);
        
        const pdfFiles = [];
        for (const file of files) {
            if (file.endsWith('.pdf')) {
                const filePath = path.join(PDF_DIR, file);
                const stats = await fs.stat(filePath);
                pdfFiles.push({
                    fileId: file,
                    size: stats.size,
                    created: stats.birthtime,
                    retrieveUrl: `/api/pdf-simple/retrieve/${file}`
                });
            }
        }
        
        res.json({
            success: true,
            count: pdfFiles.length,
            files: pdfFiles
        });
        
    } catch (error) {
        console.error('List error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to list PDFs',
            message: error.message 
        });
    }
});

/**
 * Health check endpoint
 * GET /api/pdf-simple/health
 */
router.get('/health', async (req, res) => {
    try {
        await ensureUploadDir();
        const files = await fs.readdir(PDF_DIR);
        const pdfCount = files.filter(f => f.endsWith('.pdf')).length;
        
        res.json({
            success: true,
            status: 'healthy',
            uploadDir: PDF_DIR,
            pdfCount: pdfCount,
            diskPath: DISK_PATH,
            message: 'PDF Simple Disk Storage is operational'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'error',
            error: error.message
        });
    }
});

module.exports = router;