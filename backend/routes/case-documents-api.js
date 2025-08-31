/**
 * Case Documents API
 * Specialized endpoints for retrieving PDF documents and images by case number
 * Handles both disk-stored PDFs and legacy base64 storage
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
 * Returns both disk-stored PDFs and legacy base64 images
 * GET /api/case-documents/:caseNumber/documents
 */
router.get('/:caseNumber/documents', async (req, res) => {
    const { caseNumber } = req.params;
    
    let client;
    try {
        client = await pool.connect();
        console.log(`\n=== Fetching documents for case ${caseNumber} ===`);
        
        // First check document_storage table for disk-stored PDFs
        const diskStorageQuery = `
            SELECT 
                ds.notice_id,
                ds.case_number,
                ds.server_address,
                ds.recipient_address,
                ds.file_name,
                ds.file_path,
                ds.disk_filename,
                ds.file_size,
                ds.file_type,
                ds.created_at
            FROM document_storage ds
            WHERE ds.case_number = $1 OR ds.case_number LIKE $2
            ORDER BY ds.created_at DESC
        `;
        
        const diskResult = await client.query(diskStorageQuery, [
            caseNumber,
            `%${caseNumber.split('-').pop()}%`
        ]);
        
        console.log(`Found ${diskResult.rows.length} disk-stored PDFs`);
        
        // Then check notice_components table for legacy base64 storage
        const componentsQuery = `
            SELECT 
                nc.notice_id,
                nc.alert_id,
                nc.document_id,
                nc.server_address,
                nc.recipient_address,
                nc.alert_thumbnail_data,
                nc.alert_thumbnail_mime_type,
                nc.document_data,
                nc.document_mime_type,
                nc.ipfs_hash,
                nc.document_ipfs_hash,
                nc.case_number,
                nc.created_at
            FROM notice_components nc
            WHERE nc.case_number = $1 OR nc.case_number LIKE $2
            ORDER BY nc.created_at DESC
        `;
        
        const componentsResult = await client.query(componentsQuery, [
            caseNumber, 
            `%${caseNumber.split('-').pop()}%` // Also search by last segment
        ]);
        
        console.log(`Found ${componentsResult.rows.length} records in notice_components`);
        
        // Also check simple_images table
        const imagesQuery = `
            SELECT 
                notice_id,
                server_address,
                recipient_address,
                alert_image,
                document_image,
                alert_thumbnail,
                document_thumbnail,
                case_number,
                created_at
            FROM images
            WHERE case_number = $1 OR case_number LIKE $2
            ORDER BY created_at DESC
        `;
        
        let imagesResult = { rows: [] };
        try {
            imagesResult = await client.query(imagesQuery, [
                caseNumber,
                `%${caseNumber.split('-').pop()}%`
            ]);
            console.log(`Found ${imagesResult.rows.length} records in simple_images table`);
        } catch (e) {
            console.log('Simple images table not available');
        }
        
        // Also check case_service_records for complete flow
        const caseServiceQuery = `
            SELECT 
                csr.*,
                cfd.document_path,
                cfd.ipfs_hash as cfd_ipfs_hash
            FROM case_service_records csr
            LEFT JOIN complete_flow_documents cfd ON cfd.token_id = csr.document_token_id
            WHERE csr.case_number = $1 OR csr.case_number LIKE $2
            ORDER BY csr.created_at DESC
        `;
        
        const caseServiceResult = await client.query(caseServiceQuery, [
            caseNumber,
            `%${caseNumber.split('-').pop()}%`
        ]);
        console.log(`Found ${caseServiceResult.rows.length} records in case_service_records`);
        
        // Combine and format results
        const documents = [];
        
        // Process notice_components records
        for (const row of componentsResult.rows) {
            const doc = {
                notice_id: row.notice_id,
                alert_id: row.alert_id,
                document_id: row.document_id,
                server_address: row.server_address,
                recipient_address: row.recipient_address,
                case_number: row.case_number,
                created_at: row.created_at,
                source: 'notice_components',
                images: {}
            };
            
            // Add alert thumbnail
            if (row.alert_thumbnail_data) {
                doc.images.alert_thumbnail = format === 'dataurl' 
                    ? `data:${row.alert_thumbnail_mime_type || 'image/png'};base64,${row.alert_thumbnail_data}`
                    : row.alert_thumbnail_data;
                doc.images.alert_thumbnail_available = true;
            } else {
                doc.images.alert_thumbnail_available = false;
            }
            
            // Add document image
            if (row.document_data) {
                doc.images.document = format === 'dataurl'
                    ? `data:${row.document_mime_type || 'image/png'};base64,${row.document_data}`
                    : row.document_data;
                doc.images.document_available = true;
            } else {
                doc.images.document_available = false;
            }
            
            // Add IPFS info if available
            if (row.ipfs_hash || row.document_ipfs_hash) {
                doc.ipfs = {
                    alert_hash: row.ipfs_hash,
                    document_hash: row.document_ipfs_hash
                };
            }
            
            documents.push(doc);
        }
        
        // Process simple_images records (avoid duplicates)
        const processedNoticeIds = new Set(documents.map(d => d.notice_id));
        for (const row of imagesResult.rows) {
            if (!processedNoticeIds.has(row.notice_id)) {
                const doc = {
                    notice_id: row.notice_id,
                    server_address: row.server_address,
                    recipient_address: row.recipient_address,
                    case_number: row.case_number,
                    created_at: row.created_at,
                    source: 'simple_images',
                    images: {}
                };
                
                // Add images
                if (row.alert_thumbnail || row.alert_image) {
                    const imageData = row.alert_thumbnail || row.alert_image;
                    doc.images.alert_thumbnail = format === 'dataurl'
                        ? `data:image/png;base64,${imageData}`
                        : imageData;
                    doc.images.alert_thumbnail_available = true;
                }
                
                if (row.document_thumbnail || row.document_image) {
                    const imageData = row.document_thumbnail || row.document_image;
                    doc.images.document = format === 'dataurl'
                        ? `data:image/png;base64,${imageData}`
                        : imageData;
                    doc.images.document_available = true;
                }
                
                documents.push(doc);
            }
        }
        
        // Add case_service_records info
        const caseServiceInfo = caseServiceResult.rows.map(row => ({
            alert_token_id: row.alert_token_id,
            document_token_id: row.document_token_id,
            ipfs_hash: row.ipfs_hash || row.cfd_ipfs_hash,
            document_path: row.document_path,
            recipients: row.recipients,
            created_at: row.created_at
        }));
        
        // Summary statistics
        const stats = {
            total_documents: documents.length,
            with_alert_images: documents.filter(d => d.images.alert_thumbnail_available).length,
            with_document_images: documents.filter(d => d.images.document_available).length,
            with_ipfs: documents.filter(d => d.ipfs).length,
            case_service_records: caseServiceInfo.length
        };
        
        console.log('\n=== Summary ===');
        console.log(`Total documents found: ${stats.total_documents}`);
        console.log(`With alert images: ${stats.with_alert_images}`);
        console.log(`With document images: ${stats.with_document_images}`);
        console.log(`With IPFS hashes: ${stats.with_ipfs}`);
        
        res.json({
            success: true,
            case_number: caseNumber,
            stats,
            documents,
            case_service_info: caseServiceInfo
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
 * Get a specific document image by notice ID
 * GET /api/case-documents/notice/:noticeId/image
 */
router.get('/notice/:noticeId/image', async (req, res) => {
    const { noticeId } = req.params;
    const { type = 'document' } = req.query; // 'document' or 'alert'
    
    let client;
    try {
        client = await pool.connect();
        
        // Query notice_components for the specific image
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
                error: 'Document not found',
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
                error: `No ${type} image available for this notice`,
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
        console.error('Error fetching document image:', error);
        res.status(500).json({ 
            error: 'Failed to fetch document image',
            details: error.message 
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            status: 'healthy',
            timestamp: result.rows[0].now
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

module.exports = router;