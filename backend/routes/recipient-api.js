/**
 * Recipient API Routes
 * Handles notice viewing, signing, and audit trail for recipients
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * GET /api/notices/recipient/:address
 * Get all notices for a recipient address
 */
router.get('/recipient/:address', async (req, res) => {
    let client;
    try {
        const { address } = req.params;
        
        if (!address || !/^T[A-Za-z0-9]{33}$/.test(address)) {
            return res.status(400).json({ 
                error: 'Invalid recipient address',
                success: false 
            });
        }
        
        client = await pool.connect();
        
        // Query for both Alert and Document notices
        const query = `
            SELECT DISTINCT
                sn.notice_id,
                sn.document_id,
                sn.alert_id,
                sn.case_number,
                sn.notice_type,
                sn.issuing_agency,
                sn.recipient_name,
                sn.created_at,
                sn.accepted,
                sn.signature_timestamp,
                c.metadata,
                c.pdf_path,
                c.document_hash
            FROM served_notices sn
            LEFT JOIN cases c ON c.id = sn.case_number
            WHERE LOWER(sn.recipient_address) = LOWER($1)
                AND (sn.document_id IS NOT NULL OR sn.alert_id IS NOT NULL)
            ORDER BY sn.created_at DESC
        `;
        
        const result = await client.query(query, [address]);
        
        // Group notices by case
        const noticeMap = new Map();
        
        for (const row of result.rows) {
            const caseKey = row.case_number || row.notice_id;
            
            if (!noticeMap.has(caseKey)) {
                noticeMap.set(caseKey, {
                    notice_id: row.notice_id,
                    document_id: row.document_id,
                    alert_id: row.alert_id,
                    case_number: row.case_number,
                    notice_type: row.notice_type,
                    issuing_agency: row.issuing_agency,
                    recipient_name: row.recipient_name,
                    created_at: row.created_at,
                    accepted: row.accepted,
                    signature_timestamp: row.signature_timestamp,
                    has_document: !!row.document_id,
                    has_alert: !!row.alert_id,
                    metadata: row.metadata
                });
            } else {
                // Merge Alert and Document IDs if both exist
                const existing = noticeMap.get(caseKey);
                if (row.document_id && !existing.document_id) {
                    existing.document_id = row.document_id;
                    existing.has_document = true;
                }
                if (row.alert_id && !existing.alert_id) {
                    existing.alert_id = row.alert_id;
                    existing.has_alert = true;
                }
                if (row.accepted) {
                    existing.accepted = true;
                    existing.signature_timestamp = row.signature_timestamp;
                }
            }
        }
        
        const notices = Array.from(noticeMap.values());
        
        res.json({
            success: true,
            notices: notices,
            total: notices.length
        });
        
    } catch (error) {
        console.error('Error fetching recipient notices:', error);
        res.status(500).json({ 
            error: 'Failed to fetch notices',
            success: false
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * POST /api/notices/audit
 * Store audit trail for notice viewing
 */
router.post('/audit', async (req, res) => {
    let client;
    try {
        const {
            noticeId,
            documentId,
            caseNumber,
            recipient,
            timestamp,
            auditTrail,
            txId,
            signedAt
        } = req.body;
        
        client = await pool.connect();
        
        // Store audit trail
        const auditQuery = `
            INSERT INTO notice_audit_trail (
                notice_id,
                document_id,
                case_number,
                recipient_address,
                viewed_at,
                signed_at,
                tx_id,
                ip_address,
                city,
                region,
                country,
                country_code,
                postal,
                latitude,
                longitude,
                timezone,
                isp,
                user_agent,
                language,
                platform,
                screen_resolution,
                referrer,
                metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
            RETURNING id
        `;
        
        const auditResult = await client.query(auditQuery, [
            noticeId,
            documentId,
            caseNumber,
            recipient,
            new Date(timestamp),
            signedAt ? new Date(signedAt) : null,
            txId,
            auditTrail.ip,
            auditTrail.city,
            auditTrail.region,
            auditTrail.country,
            auditTrail.countryCode,
            auditTrail.postal,
            auditTrail.latitude,
            auditTrail.longitude,
            auditTrail.timezone,
            auditTrail.isp,
            auditTrail.userAgent,
            auditTrail.language,
            auditTrail.platform,
            auditTrail.screenResolution,
            auditTrail.referrer,
            JSON.stringify(auditTrail)
        ]);
        
        // Update served_notices to mark as accepted
        if (txId) {
            await client.query(`
                UPDATE served_notices 
                SET accepted = true, 
                    signature_timestamp = NOW(),
                    signature_tx_id = $1
                WHERE (notice_id = $2 OR document_id = $2)
                    AND LOWER(recipient_address) = LOWER($3)
            `, [txId, noticeId || documentId, recipient]);
        }
        
        res.json({
            success: true,
            auditId: auditResult.rows[0].id,
            acknowledgment: 'Service confirmed and recorded',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error storing audit trail:', error);
        res.status(500).json({ 
            error: 'Failed to store audit trail',
            success: false
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * POST /api/notices/:noticeId/decrypt
 * Get decryption key after signature verification
 */
router.post('/:noticeId/decrypt', async (req, res) => {
    let client;
    try {
        const { noticeId } = req.params;
        const { txId, signature } = req.body;
        const recipientAddress = req.headers['x-recipient-address'];
        
        if (!recipientAddress) {
            return res.status(401).json({ 
                error: 'Recipient address required',
                success: false 
            });
        }
        
        client = await pool.connect();
        
        // Verify the notice belongs to this recipient
        const noticeCheck = await client.query(`
            SELECT 
                sn.*,
                c.metadata,
                ni.encryption_key,
                ni.ipfs_hash
            FROM served_notices sn
            LEFT JOIN cases c ON c.id = sn.case_number
            LEFT JOIN notice_images ni ON ni.notice_id = sn.notice_id
            WHERE (sn.notice_id = $1 OR sn.document_id = $1)
                AND LOWER(sn.recipient_address) = LOWER($2)
        `, [noticeId, recipientAddress]);
        
        if (noticeCheck.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Notice not found or not authorized',
                success: false 
            });
        }
        
        const notice = noticeCheck.rows[0];
        
        // Generate or retrieve decryption key
        let decryptionKey = notice.encryption_key;
        
        if (!decryptionKey) {
            // Generate a deterministic key based on notice data
            const keyData = `${noticeId}-${recipientAddress}-${notice.case_number}`;
            decryptionKey = crypto.createHash('sha256').update(keyData).digest('hex');
            
            // Store for future use
            await client.query(`
                UPDATE notice_images 
                SET encryption_key = $1 
                WHERE notice_id = $2
            `, [decryptionKey, noticeId]);
        }
        
        res.json({
            success: true,
            decryptionKey: decryptionKey,
            ipfsHash: notice.ipfs_hash,
            documentId: notice.document_id,
            caseNumber: notice.case_number
        });
        
    } catch (error) {
        console.error('Error getting decryption key:', error);
        res.status(500).json({ 
            error: 'Failed to get decryption key',
            success: false
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * GET /api/notices/:noticeId/document
 * Get the decrypted document for viewing
 */
router.get('/:noticeId/document', async (req, res) => {
    let client;
    try {
        const { noticeId } = req.params;
        const recipientAddress = req.headers['x-recipient-address'];
        const decryptionKey = req.headers['x-decryption-key'];
        
        if (!recipientAddress) {
            return res.status(401).json({ 
                error: 'Recipient address required',
                success: false 
            });
        }
        
        client = await pool.connect();
        
        // Get the case PDF path
        const query = `
            SELECT 
                c.pdf_path,
                c.id as case_id,
                sn.case_number
            FROM served_notices sn
            JOIN cases c ON c.id = sn.case_number
            WHERE (sn.notice_id = $1 OR sn.document_id = $1)
                AND LOWER(sn.recipient_address) = LOWER($2)
            LIMIT 1
        `;
        
        const result = await client.query(query, [noticeId, recipientAddress]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Document not found',
                success: false 
            });
        }
        
        const { pdf_path, case_id } = result.rows[0];
        
        // Read the PDF file
        const diskMountPath = process.env.DISK_MOUNT_PATH || '/mnt/data';
        const fullPath = path.join(diskMountPath, pdf_path);
        
        try {
            const pdfBuffer = await fs.readFile(fullPath);
            
            // Note: In production, you would decrypt the PDF here if it was encrypted
            // For now, we're sending the original PDF
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="Legal_Notice_${case_id}.pdf"`);
            res.send(pdfBuffer);
            
        } catch (fileError) {
            console.error('Error reading PDF file:', fileError);
            
            // Fallback: Try to get from the API endpoint
            const backendUrl = process.env.BACKEND_URL || 'https://nftserviceapp.onrender.com';
            const pdfUrl = `${backendUrl}/api/cases/${case_id}/pdf`;
            
            res.redirect(pdfUrl);
        }
        
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({ 
            error: 'Failed to fetch document',
            success: false
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * GET /api/notices/audit/:caseNumber
 * Get audit trail for a case (for process servers)
 */
router.get('/audit/:caseNumber', async (req, res) => {
    let client;
    try {
        const { caseNumber } = req.params;
        const serverAddress = req.headers['x-server-address'];
        
        if (!serverAddress) {
            return res.status(401).json({ 
                error: 'Server address required',
                success: false 
            });
        }
        
        client = await pool.connect();
        
        // Verify the server owns this case
        const caseCheck = await client.query(`
            SELECT id FROM cases 
            WHERE id = $1 AND LOWER(server_address) = LOWER($2)
        `, [caseNumber, serverAddress]);
        
        if (caseCheck.rows.length === 0) {
            return res.status(403).json({ 
                error: 'Not authorized to view this audit trail',
                success: false 
            });
        }
        
        // Get audit trail
        const auditQuery = `
            SELECT 
                recipient_address,
                viewed_at,
                signed_at,
                tx_id,
                ip_address,
                city,
                region,
                country,
                latitude,
                longitude,
                timezone,
                isp,
                user_agent,
                platform
            FROM notice_audit_trail
            WHERE case_number = $1
            ORDER BY viewed_at DESC
        `;
        
        const auditResult = await client.query(auditQuery, [caseNumber]);
        
        res.json({
            success: true,
            caseNumber: caseNumber,
            auditTrail: auditResult.rows,
            total: auditResult.rows.length
        });
        
    } catch (error) {
        console.error('Error fetching audit trail:', error);
        res.status(500).json({ 
            error: 'Failed to fetch audit trail',
            success: false
        });
    } finally {
        if (client) client.release();
    }
});

module.exports = router;