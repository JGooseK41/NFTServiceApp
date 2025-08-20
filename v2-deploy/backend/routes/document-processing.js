/**
 * DOCUMENT PROCESSING ROUTE
 * Handles the proper workflow for legal document processing
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const { PDFDocument: PDFLib } = require('pdf-lib');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') 
        ? { rejectUnauthorized: false }
        : false
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

/**
 * STEP 1: Process uploaded documents
 * - Combine multiple documents into one
 * - Compress the combined document
 * - Store on backend
 */
router.post('/process', upload.array('documents', 10), async (req, res) => {
    try {
        console.log(`Processing ${req.files.length} documents...`);
        
        // Create combined PDF
        const combinedPdf = await PDFLib.create();
        
        for (const file of req.files) {
            if (file.mimetype === 'application/pdf') {
                const pdfBytes = file.buffer;
                const pdf = await PDFLib.load(pdfBytes);
                const pages = await combinedPdf.copyPages(pdf, pdf.getPageIndices());
                pages.forEach(page => combinedPdf.addPage(page));
            } else {
                // Convert images to PDF pages
                // Implementation depends on your needs
                console.log(`Converting ${file.mimetype} to PDF page`);
            }
        }
        
        // Save combined PDF
        const combinedPdfBytes = await combinedPdf.save();
        
        // Compress the document (you can use additional compression here)
        const compressedBytes = combinedPdfBytes; // Add compression logic if needed
        
        // Generate unique document ID
        const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store in database
        await pool.query(`
            INSERT INTO processed_documents (
                document_id,
                compressed_data,
                page_count,
                file_size,
                created_at
            ) VALUES ($1, $2, $3, $4, NOW())
        `, [
            documentId,
            compressedBytes,
            combinedPdf.getPageCount(),
            compressedBytes.length
        ]);
        
        // Extract first page for alert image
        const firstPagePdf = await PDFLib.create();
        const [firstPage] = await firstPagePdf.copyPages(combinedPdf, [0]);
        firstPagePdf.addPage(firstPage);
        const firstPageBytes = await firstPagePdf.save();
        
        // Convert first page to image
        // Note: You'll need a PDF to image converter like pdf2pic or similar
        // For now, we'll store the first page PDF
        
        // Create alert image with overlay
        const alertImageUrl = await createAlertImage(documentId, firstPageBytes);
        
        res.json({
            success: true,
            documentId: documentId,
            compressedUrl: `/api/documents/${documentId}/compressed`,
            alertImageUrl: alertImageUrl,
            pageCount: combinedPdf.getPageCount(),
            fileSize: compressedBytes.length
        });
        
    } catch (error) {
        console.error('Document processing error:', error);
        res.status(500).json({ error: 'Document processing failed' });
    }
});

/**
 * STEP 2: Create alert image with legal overlay
 */
async function createAlertImage(documentId, firstPageBytes) {
    try {
        // Convert PDF first page to image
        // This is a simplified version - you'd use a proper PDF to image converter
        
        // For now, create a placeholder with overlay
        const width = 850;
        const height = 1100;
        
        // Create overlay image with Sharp
        const overlayBuffer = await sharp({
            create: {
                width: width,
                height: height,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 0.9 }
            }
        })
        .composite([
            {
                input: Buffer.from(`
                    <svg width="${width}" height="${height}">
                        <rect x="0" y="0" width="${width}" height="${height}" fill="white" opacity="0.95"/>
                        <rect x="50" y="50" width="${width-100}" height="${height-100}" 
                              fill="none" stroke="red" stroke-width="5" stroke-dasharray="10,5"/>
                        <text x="${width/2}" y="200" font-family="Arial" font-size="48" 
                              fill="red" text-anchor="middle" font-weight="bold">
                            SEALED LEGAL DOCUMENT
                        </text>
                        <text x="${width/2}" y="250" font-family="Arial" font-size="24" 
                              fill="black" text-anchor="middle">
                            Official Legal Notice
                        </text>
                        <text x="${width/2}" y="300" font-family="Arial" font-size="20" 
                              fill="black" text-anchor="middle">
                            Document ID: ${documentId}
                        </text>
                        <text x="${width/2}" y="${height-100}" font-family="Arial" font-size="16" 
                              fill="gray" text-anchor="middle">
                            Full document available upon blockchain verification
                        </text>
                    </svg>
                `),
                top: 0,
                left: 0
            }
        ])
        .png()
        .toBuffer();
        
        // Store alert image in database
        await pool.query(`
            INSERT INTO alert_images (
                document_id,
                image_data,
                mime_type,
                created_at
            ) VALUES ($1, $2, $3, NOW())
            ON CONFLICT (document_id) 
            DO UPDATE SET 
                image_data = $2,
                mime_type = $3,
                updated_at = NOW()
        `, [documentId, overlayBuffer, 'image/png']);
        
        return `/api/documents/${documentId}/alert-image`;
        
    } catch (error) {
        console.error('Alert image creation error:', error);
        throw error;
    }
}

/**
 * STEP 3: Get compressed document for encryption
 */
router.get('/:documentId/compressed', async (req, res) => {
    try {
        const { documentId } = req.params;
        
        const result = await pool.query(`
            SELECT compressed_data, mime_type
            FROM processed_documents
            WHERE document_id = $1
        `, [documentId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        const doc = result.rows[0];
        res.set('Content-Type', doc.mime_type || 'application/pdf');
        res.send(doc.compressed_data);
        
    } catch (error) {
        console.error('Error fetching compressed document:', error);
        res.status(500).json({ error: 'Failed to fetch document' });
    }
});

/**
 * STEP 4: Get alert image for base64 encoding
 */
router.get('/:documentId/alert-image', async (req, res) => {
    try {
        const { documentId } = req.params;
        
        const result = await pool.query(`
            SELECT image_data, mime_type
            FROM alert_images
            WHERE document_id = $1
        `, [documentId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Alert image not found' });
        }
        
        const img = result.rows[0];
        res.set('Content-Type', img.mime_type || 'image/png');
        res.send(img.image_data);
        
    } catch (error) {
        console.error('Error fetching alert image:', error);
        res.status(500).json({ error: 'Failed to fetch alert image' });
    }
});

/**
 * Create alert image with overlay (POST)
 */
router.post('/:documentId/alert-image', async (req, res) => {
    try {
        const { documentId } = req.params;
        const { overlay } = req.body;
        
        // Get the first page of the document
        const docResult = await pool.query(`
            SELECT compressed_data 
            FROM processed_documents 
            WHERE document_id = $1
        `, [documentId]);
        
        if (docResult.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Create alert image with custom overlay
        const alertImageUrl = await createAlertImage(documentId, docResult.rows[0].compressed_data);
        
        res.json({
            success: true,
            url: alertImageUrl,
            imageId: `alert_${documentId}`,
            mimeType: 'image/png'
        });
        
    } catch (error) {
        console.error('Error creating alert image:', error);
        res.status(500).json({ error: 'Failed to create alert image' });
    }
});

module.exports = router;