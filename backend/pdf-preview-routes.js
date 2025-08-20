/**
 * PDF Preview Routes
 * Handles temporary PDF processing for preview before saving
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const PDFCleaner = require('./pdf-cleaner');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max per file
        files: 10
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// Initialize PDF cleaner
const pdfCleaner = new PDFCleaner();

/**
 * Process PDFs for preview
 * Cleans and merges without permanent storage
 */
router.post('/preview/process', upload.array('documents', 10), async (req, res) => {
    console.log('POST /api/preview/process - Processing PDFs for preview');
    
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No PDF files uploaded'
            });
        }
        
        console.log(`📋 Processing ${req.files.length} PDFs for preview`);
        
        // Extract file info and buffers
        const pdfBuffers = [];
        const fileInfo = [];
        
        for (const file of req.files) {
            pdfBuffers.push(file.buffer);
            fileInfo.push({
                fileName: file.originalname,
                size: file.size
            });
        }
        
        // Clean and merge PDFs
        const mergedPDF = await pdfCleaner.cleanAndMergePDFs(pdfBuffers, fileInfo);
        
        // Return the merged PDF as base64
        const base64PDF = mergedPDF.toString('base64');
        
        res.json({
            success: true,
            mergedPDF: base64PDF,
            pageCount: fileInfo.length,
            message: 'PDFs cleaned and merged successfully for preview'
        });
        
    } catch (error) {
        console.error('Preview processing error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get processed preview as binary
 */
router.post('/preview/process-binary', upload.array('documents', 10), async (req, res) => {
    console.log('POST /api/preview/process-binary - Processing PDFs for preview');
    
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No PDF files uploaded'
            });
        }
        
        // Extract file info and buffers
        const pdfBuffers = [];
        const fileInfo = [];
        
        for (const file of req.files) {
            pdfBuffers.push(file.buffer);
            fileInfo.push({
                fileName: file.originalname,
                size: file.size
            });
        }
        
        // Clean and merge PDFs
        const mergedPDF = await pdfCleaner.cleanAndMergePDFs(pdfBuffers, fileInfo);
        
        // Return the merged PDF as binary
        res.contentType('application/pdf');
        res.send(mergedPDF);
        
    } catch (error) {
        console.error('Preview processing error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;