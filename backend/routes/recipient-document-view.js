/**
 * Recipient Document Viewing
 * Allows recipients to view documents after refusing to sign
 * All views are logged for legal compliance
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

// CORS for BlockServed
const corsOptions = {
    origin: [
        'https://blockserved.com',
        'https://www.blockserved.com',
        'https://theblockservice.com',
        'https://www.theblockservice.com',
        'https://nft-legal-service.netlify.app',
        'http://localhost:8080',
        'http://localhost:3000',
        'http://localhost:3001'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Recipient-Address', 'X-Wallet-Provider', 'X-Visitor-Id', 'X-Fingerprint', 'X-Fingerprint-Confidence', 'X-Screen-Resolution']
};

router.use(cors(corsOptions));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Disk paths
const DISK_MOUNT_PATH = process.env.DISK_MOUNT_PATH || '/var/data';
const CASES_DIR = path.join(DISK_MOUNT_PATH, 'cases');

/**
 * Log document view
 */
async function logDocumentView(caseNumber, recipientAddress, viewType, metadata = {}) {
    try {
        await pool.query(`
            INSERT INTO document_views (
                case_number,
                recipient_address,
                view_type,
                metadata,
                viewed_at,
                ip_address,
                user_agent
            ) VALUES ($1, $2, $3, $4, NOW(), $5, $6)
        `, [
            caseNumber,
            recipientAddress,
            viewType,
            JSON.stringify(metadata),
            metadata.ip_address || null,
            metadata.user_agent || null
        ]);
        console.log(`📊 Logged ${viewType} view for case ${caseNumber} by ${recipientAddress}`);
    } catch (error) {
        // Try to create table if it doesn't exist
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS document_views (
                    id SERIAL PRIMARY KEY,
                    case_number VARCHAR(255),
                    recipient_address VARCHAR(255),
                    view_type VARCHAR(50),
                    metadata JSONB,
                    viewed_at TIMESTAMP DEFAULT NOW(),
                    ip_address VARCHAR(45),
                    user_agent TEXT
                )
            `);
            // Try logging again
            await pool.query(`
                INSERT INTO document_views (
                    case_number, recipient_address, view_type, metadata, viewed_at
                ) VALUES ($1, $2, $3, $4, NOW())
            `, [caseNumber, recipientAddress, viewType, JSON.stringify(metadata)]);
        } catch (e) {
            console.error('Could not log view:', e.message);
        }
    }
}

/**
 * GET /api/recipient/document/:caseNumber/view
 * View document after refusing signature
 */
router.get('/document/:caseNumber/view', async (req, res) => {
    const { caseNumber } = req.params;
    const recipientAddress = req.headers['x-recipient-address'] || req.query.wallet;
    const { reason = 'refused_signature' } = req.query;
    
    if (!recipientAddress) {
        return res.status(401).json({ 
            error: 'Recipient wallet address required',
            message: 'Please provide X-Recipient-Address header or wallet query parameter'
        });
    }
    
    try {
        console.log(`\n📄 Document view request for case ${caseNumber} by ${recipientAddress}`);
        console.log(`   Reason: ${reason}`);
        
        // First check if recipient has access to this case
        const accessCheck = await pool.query(`
            SELECT 
                csr.case_number,
                csr.recipients,
                csr.server_address,
                csr.alert_token_id,
                csr.document_token_id,
                csr.created_at
            FROM case_service_records csr
            WHERE csr.case_number = $1
            AND (
                csr.recipients LIKE $2
                OR csr.recipients::jsonb ? $3
                OR EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(csr.recipients::jsonb) AS recipient
                    WHERE LOWER(recipient) = LOWER($3)
                )
            )
            LIMIT 1
        `, [caseNumber, `%${recipientAddress}%`, recipientAddress]);
        
        if (accessCheck.rows.length === 0) {
            // Log unauthorized access attempt
            await logDocumentView(caseNumber, recipientAddress, 'unauthorized_attempt', {
                reason: 'no_access',
                ip_address: req.clientIp || req.ip,
                user_agent: req.headers['user-agent']
            });
            
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'You do not have access to this document'
            });
        }
        
        const caseRecord = accessCheck.rows[0];
        
        // Log the view with reason
        await logDocumentView(caseNumber, recipientAddress, reason, {
            server_address: caseRecord.server_address,
            alert_token_id: caseRecord.alert_token_id,
            document_token_id: caseRecord.document_token_id,
            ip_address: req.clientIp || req.ip,
            user_agent: req.headers['user-agent'],
            referer: req.headers.referer
        });
        
        // Try multiple paths to find the PDF
        const possiblePaths = [
            path.join(CASES_DIR, caseNumber, 'document.pdf'),
            path.join(CASES_DIR, `CASE-${caseNumber}`, 'document.pdf'),
            path.join(DISK_MOUNT_PATH, 'uploads', 'pdfs', `${caseNumber}.pdf`),
            path.join(DISK_MOUNT_PATH, 'documents', `${caseNumber}.pdf`)
        ];
        
        let pdfPath = null;
        let pdfBuffer = null;
        
        for (const testPath of possiblePaths) {
            try {
                await fs.access(testPath);
                pdfPath = testPath;
                pdfBuffer = await fs.readFile(testPath);
                console.log(`✅ Found PDF at: ${testPath}`);
                break;
            } catch (e) {
                // Try next path
            }
        }
        
        if (!pdfBuffer) {
            // Check database for stored path
            const dbCheck = await pool.query(`
                SELECT pdf_path FROM cases WHERE id::text = $1 OR case_number = $1
                UNION
                SELECT file_path as pdf_path FROM document_storage
                WHERE case_number = $1 OR notice_id = $1
                LIMIT 1
            `, [caseNumber]);
            
            if (dbCheck.rows.length > 0 && dbCheck.rows[0].pdf_path) {
                try {
                    pdfBuffer = await fs.readFile(dbCheck.rows[0].pdf_path);
                    pdfPath = dbCheck.rows[0].pdf_path;
                    console.log(`✅ Found PDF from database path: ${pdfPath}`);
                } catch (e) {
                    console.error(`Failed to read from DB path: ${dbCheck.rows[0].pdf_path}`);
                }
            }
        }
        
        if (!pdfBuffer) {
            console.error(`❌ No PDF found for case ${caseNumber}`);
            console.log('   Searched paths:', possiblePaths);
            
            return res.status(404).json({ 
                error: 'Document not found',
                message: 'The document file could not be located',
                case_number: caseNumber
            });
        }
        
        // Update view count
        await pool.query(`
            UPDATE case_service_records 
            SET last_viewed = NOW(),
                view_count = COALESCE(view_count, 0) + 1
            WHERE case_number = $1
        `, [caseNumber]).catch(() => {});
        
        // Serve the PDF
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length,
            'Content-Disposition': `inline; filename="legal-notice-${caseNumber}.pdf"`,
            'X-View-Logged': 'true',
            'X-View-Reason': reason
        });
        
        console.log(`✅ Serving PDF for case ${caseNumber} (${(pdfBuffer.length/1024/1024).toFixed(2)} MB)`);
        console.log(`   View logged as: ${reason}`);
        
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Error serving document:', error);
        res.status(500).json({ 
            error: 'Failed to retrieve document',
            message: error.message 
        });
    }
});

/**
 * GET /api/recipient/document/:caseNumber/status
 * Check if recipient has already viewed or signed
 */
router.get('/document/:caseNumber/status', async (req, res) => {
    const { caseNumber } = req.params;
    const recipientAddress = req.headers['x-recipient-address'] || req.query.wallet;
    
    if (!recipientAddress) {
        return res.status(401).json({ error: 'Recipient address required' });
    }
    
    try {
        // Check view history
        const viewHistory = await pool.query(`
            SELECT 
                view_type,
                viewed_at,
                metadata
            FROM document_views
            WHERE case_number = $1 AND recipient_address = $2
            ORDER BY viewed_at DESC
        `, [caseNumber, recipientAddress]);
        
        // Check if accepted/signed
        const acceptanceCheck = await pool.query(`
            SELECT 
                accepted,
                accepted_at,
                status
            FROM case_service_records
            WHERE case_number = $1
            AND (
                recipients LIKE $2
                OR recipients::jsonb ? $3
            )
        `, [caseNumber, `%${recipientAddress}%`, recipientAddress]);
        
        const hasViewed = viewHistory.rows.length > 0;
        const hasRefused = viewHistory.rows.some(v => v.view_type === 'refused_signature');
        const hasAccepted = acceptanceCheck.rows.length > 0 && acceptanceCheck.rows[0].accepted;
        
        res.json({
            case_number: caseNumber,
            recipient: recipientAddress,
            has_viewed: hasViewed,
            has_refused: hasRefused,
            has_accepted: hasAccepted,
            view_count: viewHistory.rows.length,
            last_viewed: hasViewed ? viewHistory.rows[0].viewed_at : null,
            status: hasAccepted ? 'accepted' : hasRefused ? 'refused' : hasViewed ? 'viewed' : 'pending'
        });
        
    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({ error: 'Failed to check status' });
    }
});

/**
 * POST /api/recipient/document/:caseNumber/acknowledge
 * Log that recipient acknowledges receiving the document
 */
router.post('/document/:caseNumber/acknowledge', async (req, res) => {
    const { caseNumber } = req.params;
    const { recipientAddress, acknowledgmentType = 'viewed' } = req.body;
    
    if (!recipientAddress) {
        return res.status(400).json({ error: 'Recipient address required' });
    }
    
    try {
        // Log acknowledgment
        await logDocumentView(caseNumber, recipientAddress, acknowledgmentType, {
            timestamp: new Date().toISOString(),
            ip_address: req.clientIp || req.ip,
            user_agent: req.headers['user-agent']
        });
        
        res.json({
            success: true,
            message: 'Acknowledgment recorded',
            case_number: caseNumber,
            type: acknowledgmentType
        });
        
    } catch (error) {
        console.error('Error recording acknowledgment:', error);
        res.status(500).json({ error: 'Failed to record acknowledgment' });
    }
});

module.exports = router;