/**
 * Case Documents Retrieval API
 * Handles retrieval of PDF documents stored on disk and legacy base64 images
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs').promises;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Disk storage paths (matching pdf-disk-storage.js)
const DISK_MOUNT_PATH = process.env.DISK_MOUNT_PATH || '/var/data';
const PDF_UPLOAD_DIR = path.join(DISK_MOUNT_PATH, 'uploads', 'pdfs');

/**
 * Get all documents for a specific case number
 * GET /api/case-documents/:caseNumber
 */
router.get('/:caseNumber', async (req, res) => {
    const { caseNumber } = req.params;
    
    let client;
    try {
        client = await pool.connect();
        console.log(`\n=== Fetching documents for case ${caseNumber} ===`);
        
        const documents = [];
        
        // 1. Check document_storage table for disk-stored PDFs
        const diskStorageQuery = `
            SELECT 
                ds.*,
                nc.alert_id,
                nc.document_id
            FROM document_storage ds
            LEFT JOIN notice_components nc ON nc.notice_id = ds.notice_id
            WHERE ds.case_number = $1 OR ds.case_number LIKE $2
            ORDER BY ds.created_at DESC
        `;
        
        const diskResult = await client.query(diskStorageQuery, [
            caseNumber,
            `%${caseNumber.split('-').pop()}%`
        ]);
        
        console.log(`Found ${diskResult.rows.length} disk-stored PDFs`);
        
        for (const row of diskResult.rows) {
            // Check if file exists on disk
            let fileExists = false;
            let fileAccessible = false;
            
            if (row.disk_filename) {
                const filePath = path.join(PDF_UPLOAD_DIR, row.disk_filename);
                try {
                    await fs.access(filePath);
                    fileExists = true;
                    fileAccessible = true;
                } catch (e) {
                    console.log(`File not accessible: ${filePath}`);
                }
            }
            
            documents.push({
                type: 'pdf',
                storage: 'disk',
                notice_id: row.notice_id,
                alert_id: row.alert_id,
                document_id: row.document_id,
                case_number: row.case_number,
                file_name: row.file_name,
                file_size: row.file_size,
                file_type: row.file_type || 'application/pdf',
                disk_filename: row.disk_filename,
                file_path: row.file_path,
                file_exists: fileExists,
                file_accessible: fileAccessible,
                serve_url: fileAccessible ? `/api/case-documents/serve/${row.disk_filename}` : null,
                created_at: row.created_at
            });
        }
        
        // 2. Check processed_documents table for BYTEA storage
        const processedDocsQuery = `
            SELECT 
                pd.*,
                ai.document_id as has_alert_image,
                bc.alert_nft_id,
                bc.document_nft_id
            FROM processed_documents pd
            LEFT JOIN alert_images ai ON ai.document_id = pd.document_id
            LEFT JOIN blockchain_records bc ON bc.document_id = pd.document_id
            WHERE pd.case_number = $1 OR pd.case_number LIKE $2
            ORDER BY pd.created_at DESC
        `;
        
        try {
            const processedResult = await client.query(processedDocsQuery, [
                caseNumber,
                `%${caseNumber.split('-').pop()}%`
            ]);
            
            console.log(`Found ${processedResult.rows.length} processed documents (BYTEA)`);
            
            for (const row of processedResult.rows) {
                documents.push({
                    type: 'pdf',
                    storage: 'bytea',
                    document_id: row.document_id,
                    case_number: row.case_number,
                    page_count: row.page_count,
                    file_size: row.file_size,
                    mime_type: row.mime_type,
                    has_alert_image: !!row.has_alert_image,
                    alert_nft_id: row.alert_nft_id,
                    document_nft_id: row.document_nft_id,
                    serve_url: `/api/case-documents/serve-bytea/${row.document_id}`,
                    created_at: row.created_at
                });
            }
        } catch (e) {
            console.log('Processed documents table not available');
        }
        
        // 3. Check notice_components for legacy base64 images (thumbnails)
        const componentsQuery = `
            SELECT 
                nc.notice_id,
                nc.alert_id,
                nc.document_id,
                nc.case_number,
                CASE WHEN nc.alert_thumbnail_data IS NOT NULL THEN true ELSE false END as has_alert_thumbnail,
                CASE WHEN nc.document_data IS NOT NULL THEN true ELSE false END as has_document_image,
                nc.alert_thumbnail_mime_type,
                nc.document_mime_type,
                nc.ipfs_hash,
                nc.document_ipfs_hash,
                nc.created_at
            FROM notice_components nc
            WHERE (nc.case_number = $1 OR nc.case_number LIKE $2)
            AND (nc.alert_thumbnail_data IS NOT NULL OR nc.document_data IS NOT NULL)
            ORDER BY nc.created_at DESC
        `;
        
        const componentsResult = await client.query(componentsQuery, [
            caseNumber,
            `%${caseNumber.split('-').pop()}%`
        ]);
        
        console.log(`Found ${componentsResult.rows.length} legacy base64 images`);
        
        for (const row of componentsResult.rows) {
            // Check if we already have this notice from disk storage
            const existingDoc = documents.find(d => d.notice_id === row.notice_id);
            if (!existingDoc) {
                documents.push({
                    type: 'image',
                    storage: 'base64',
                    notice_id: row.notice_id,
                    alert_id: row.alert_id,
                    document_id: row.document_id,
                    case_number: row.case_number,
                    has_alert_thumbnail: row.has_alert_thumbnail,
                    has_document_image: row.has_document_image,
                    alert_mime_type: row.alert_thumbnail_mime_type,
                    document_mime_type: row.document_mime_type,
                    ipfs_hash: row.ipfs_hash,
                    document_ipfs_hash: row.document_ipfs_hash,
                    alert_image_url: row.has_alert_thumbnail ? `/api/case-documents/image/${row.notice_id}?type=alert` : null,
                    document_image_url: row.has_document_image ? `/api/case-documents/image/${row.notice_id}?type=document` : null,
                    created_at: row.created_at
                });
            }
        }
        
        // Summary
        const summary = {
            case_number: caseNumber,
            total_documents: documents.length,
            pdf_files: documents.filter(d => d.type === 'pdf').length,
            disk_stored: documents.filter(d => d.storage === 'disk').length,
            bytea_stored: documents.filter(d => d.storage === 'bytea').length,
            base64_images: documents.filter(d => d.storage === 'base64').length,
            files_accessible: documents.filter(d => d.file_accessible).length
        };
        
        console.log('\n=== Summary ===');
        console.log(`Total documents: ${summary.total_documents}`);
        console.log(`PDF files: ${summary.pdf_files}`);
        console.log(`Disk stored: ${summary.disk_stored}`);
        console.log(`BYTEA stored: ${summary.bytea_stored}`);
        console.log(`Base64 images: ${summary.base64_images}`);
        console.log(`Files accessible: ${summary.files_accessible}`);
        
        res.json({
            success: true,
            summary,
            documents
        });
        
    } catch (error) {
        console.error('Error fetching case documents:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch case documents',
            details: error.message 
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * Serve a PDF file from disk storage
 * GET /api/case-documents/serve/:filename
 */
router.get('/serve/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(PDF_UPLOAD_DIR, filename);
        
        console.log(`Serving PDF: ${filename}`);
        
        // Check if file exists
        await fs.access(filePath);
        
        // Get file stats
        const stats = await fs.stat(filePath);
        
        // Set headers
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': stats.size,
            'Content-Disposition': `inline; filename="${filename}"`
        });
        
        // Stream the file
        const fileStream = require('fs').createReadStream(filePath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('Error serving PDF:', error);
        if (error.code === 'ENOENT') {
            res.status(404).json({ 
                error: 'PDF file not found',
                filename: req.params.filename 
            });
        } else {
            res.status(500).json({ 
                error: 'Failed to serve PDF',
                details: error.message 
            });
        }
    }
});

/**
 * Serve a PDF from BYTEA storage
 * GET /api/case-documents/serve-bytea/:documentId
 */
router.get('/serve-bytea/:documentId', async (req, res) => {
    const { documentId } = req.params;
    
    let client;
    try {
        client = await pool.connect();
        
        const query = `
            SELECT compressed_data, mime_type, file_size
            FROM processed_documents
            WHERE document_id = $1
        `;
        
        const result = await client.query(query, [documentId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Document not found',
                document_id: documentId 
            });
        }
        
        const { compressed_data, mime_type, file_size } = result.rows[0];
        
        // Set headers
        res.set({
            'Content-Type': mime_type || 'application/pdf',
            'Content-Length': file_size || compressed_data.length,
            'Content-Disposition': `inline; filename="document-${documentId}.pdf"`
        });
        
        // Send the binary data
        res.send(compressed_data);
        
    } catch (error) {
        console.error('Error serving BYTEA document:', error);
        res.status(500).json({ 
            error: 'Failed to serve document',
            details: error.message 
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * Get a base64 image (legacy support)
 * GET /api/case-documents/image/:noticeId
 */
router.get('/image/:noticeId', async (req, res) => {
    const { noticeId } = req.params;
    const { type = 'document' } = req.query; // 'document' or 'alert'
    
    let client;
    try {
        client = await pool.connect();
        
        const query = `
            SELECT 
                alert_thumbnail_data,
                alert_thumbnail_mime_type,
                document_data,
                document_mime_type,
                case_number
            FROM notice_components
            WHERE notice_id = $1 OR alert_id = $1 OR document_id = $1
            LIMIT 1
        `;
        
        const result = await client.query(query, [noticeId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Image not found',
                notice_id: noticeId 
            });
        }
        
        const row = result.rows[0];
        let imageData, mimeType;
        
        if (type === 'alert') {
            imageData = row.alert_thumbnail_data;
            mimeType = row.alert_thumbnail_mime_type || 'image/png';
        } else {
            imageData = row.document_data;
            mimeType = row.document_mime_type || 'image/png';
        }
        
        if (!imageData) {
            return res.status(404).json({ 
                error: `No ${type} image available`,
                notice_id: noticeId,
                case_number: row.case_number
            });
        }
        
        // Return as actual image
        const buffer = Buffer.from(imageData, 'base64');
        res.set('Content-Type', mimeType);
        res.set('Content-Length', buffer.length);
        res.send(buffer);
        
    } catch (error) {
        console.error('Error fetching image:', error);
        res.status(500).json({ 
            error: 'Failed to fetch image',
            details: error.message 
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * Health check
 */
router.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        
        // Check if PDF directory exists
        let pdfDirExists = false;
        try {
            await fs.access(PDF_UPLOAD_DIR);
            pdfDirExists = true;
        } catch (e) {
            // Directory doesn't exist
        }
        
        res.json({
            status: 'healthy',
            timestamp: result.rows[0].now,
            pdf_directory: PDF_UPLOAD_DIR,
            pdf_directory_exists: pdfDirExists
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

module.exports = router;