/**
 * Transaction Staging System
 * Backend is the single source of truth for all transaction data
 * All data is stored here FIRST, then used for blockchain transactions
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { Pool } = require('pg');

// Test endpoint to verify CORS
router.get('/test', (req, res) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
        'https://theblockservice.com',
        'https://www.theblockservice.com',
        'https://blockserved.com',
        'https://www.blockserved.com',
        'https://nft-legal-service.netlify.app',
        'http://localhost:8080',
        'http://localhost:3000'
    ];
    
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Server-Address');
    }
    
    res.json({
        success: true,
        message: 'CORS test successful',
        origin: origin,
        allowed: allowedOrigins.includes(origin)
    });
});

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            const uploadDir = path.join(__dirname, '../uploads/staged');
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            console.error('Error creating upload directory:', error);
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images and PDFs are allowed'));
        }
    }
});

/**
 * POST /api/stage/transaction
 * Stage a complete transaction with all data and files
 * This becomes the single source of truth
 */
router.post('/transaction', 
    upload.fields([
        { name: 'thumbnail', maxCount: 1 },
        { name: 'document', maxCount: 1 },
        { name: 'encryptedDocument', maxCount: 1 }
    ]),
    async (req, res) => {
        // Set CORS headers immediately
        const origin = req.headers.origin;
        const allowedOrigins = [
            'https://theblockservice.com',
            'https://www.theblockservice.com',
            'https://blockserved.com',
            'https://www.blockserved.com',
            'https://nft-legal-service.netlify.app',
            'http://localhost:8080',
            'http://localhost:3000'
        ];
        
        if (allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Server-Address');
        }
        
        console.log('POST /api/stage/transaction - Request received from:', req.headers.origin);
        console.log('Request body keys:', Object.keys(req.body));
        console.log('Request files:', req.files ? Object.keys(req.files) : 'No files');
        
        let client;
        
        try {
            client = await pool.connect();
            await client.query('BEGIN');
            
            // Generate transaction ID
            const transactionId = `TXN_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
            
            // Parse request data
            const data = {
                // Transaction identification
                transactionId,
                sessionId: req.body.sessionId || crypto.randomBytes(16).toString('hex'),
                
                // Recipients (can be single or multiple)
                recipients: typeof req.body.recipients === 'string' 
                    ? JSON.parse(req.body.recipients || '[]')
                    : req.body.recipients || [],
                
                // Notice details
                noticeType: req.body.noticeType || 'Legal Notice',
                caseNumber: req.body.caseNumber || '',
                issuingAgency: req.body.issuingAgency || '',
                publicText: req.body.publicText || '',
                caseDetails: req.body.caseDetails || '',
                legalRights: req.body.legalRights || '',
                
                // Server details
                serverAddress: req.body.serverAddress || '',
                serverName: req.body.serverName || '',
                
                // Document details
                hasDocument: req.body.hasDocument === 'true',
                requiresSignature: req.body.requiresSignature === 'true',
                
                // IPFS details
                ipfsHash: req.body.ipfsHash || '',
                encryptionKey: req.body.encryptionKey || '',
                encryptedIPFS: req.body.encryptedIPFS || '',
                
                // Fee details - Match contract values
                sponsorFees: req.body.sponsorFees === 'true',
                creationFee: parseFloat(req.body.creationFee || '20'),  // serviceFee is 20 TRX
                sponsorshipFee: parseFloat(req.body.sponsorshipFee || '2'), // sponsorshipFee is 2 TRX
                
                // Network details
                network: req.body.network || 'mainnet',
                contractAddress: req.body.contractAddress || '',
                
                // Metadata
                metadataURI: req.body.metadataURI || '',
                tokenName: req.body.tokenName || 'Legal Notice NFT',
                deliveryMethod: req.body.deliveryMethod || 'document'
            };
            
            // Process uploaded files
            const files = {
                thumbnailPath: req.files?.thumbnail?.[0]?.filename || null,
                documentPath: req.files?.document?.[0]?.filename || null,
                encryptedDocumentPath: req.files?.encryptedDocument?.[0]?.filename || null
            };
            
            // Store main transaction record
            await client.query(`
                INSERT INTO staged_transactions (
                    transaction_id,
                    session_id,
                    status,
                    network,
                    server_address,
                    contract_address,
                    recipient_count,
                    total_fee,
                    data,
                    created_at,
                    expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
            `, [
                transactionId,
                data.sessionId,
                'staged',
                data.network,
                data.serverAddress,
                data.contractAddress,
                data.recipients.length,
                data.creationFee + (data.sponsorFees ? data.sponsorshipFee * data.recipients.length : 0),
                JSON.stringify(data),
                new Date(Date.now() + 30 * 60 * 1000) // 30 minute expiry
            ]);
            
            // Store notice details
            await client.query(`
                INSERT INTO staged_notices (
                    transaction_id,
                    notice_type,
                    case_number,
                    issuing_agency,
                    public_text,
                    case_details,
                    legal_rights,
                    has_document,
                    requires_signature,
                    token_name,
                    delivery_method
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [
                transactionId,
                data.noticeType,
                data.caseNumber,
                data.issuingAgency,
                data.publicText,
                data.caseDetails,
                data.legalRights,
                data.hasDocument,
                data.requiresSignature,
                data.tokenName,
                data.deliveryMethod
            ]);
            
            // Store file references
            if (files.thumbnailPath || files.documentPath || files.encryptedDocumentPath) {
                await client.query(`
                    INSERT INTO staged_files (
                        transaction_id,
                        thumbnail_path,
                        document_path,
                        encrypted_document_path,
                        thumbnail_url,
                        document_url,
                        encrypted_document_url
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    transactionId,
                    files.thumbnailPath,
                    files.documentPath,
                    files.encryptedDocumentPath,
                    files.thumbnailPath ? `/uploads/staged/${files.thumbnailPath}` : null,
                    files.documentPath ? `/uploads/staged/${files.documentPath}` : null,
                    files.encryptedDocumentPath ? `/uploads/staged/${files.encryptedDocumentPath}` : null
                ]);
            }
            
            // Store IPFS details if provided
            if (data.ipfsHash || data.encryptedIPFS) {
                await client.query(`
                    INSERT INTO staged_ipfs (
                        transaction_id,
                        ipfs_hash,
                        encrypted_ipfs,
                        encryption_key,
                        metadata_uri
                    ) VALUES ($1, $2, $3, $4, $5)
                `, [
                    transactionId,
                    data.ipfsHash,
                    data.encryptedIPFS,
                    data.encryptionKey,
                    data.metadataURI
                ]);
            }
            
            // Store recipients
            for (let i = 0; i < data.recipients.length; i++) {
                const recipient = data.recipients[i];
                const noticeId = `${Date.now()}${i}`.slice(-10); // Generate notice ID
                
                await client.query(`
                    INSERT INTO staged_recipients (
                        transaction_id,
                        recipient_address,
                        notice_id,
                        recipient_index,
                        status
                    ) VALUES ($1, $2, $3, $4, $5)
                `, [
                    transactionId,
                    recipient,
                    noticeId,
                    i,
                    'pending'
                ]);
            }
            
            // Calculate energy requirements - more accurate estimation
            // Based on actual transaction analysis:
            // - Simple notice: ~300,000 energy
            // - With document: ~400,000 energy
            // - Each additional recipient: ~50,000 energy
            const baseEnergy = 300000; // Base energy for contract call (reduced from 1M)
            const documentEnergy = data.hasDocument ? 100000 : 0; // Extra for document storage
            const perRecipientEnergy = 50000; // Energy per recipient
            const totalEnergy = baseEnergy + documentEnergy + (perRecipientEnergy * Math.max(0, data.recipients.length - 1));
            
            // Calculate rental cost - using current market rates
            // Energy rental is approximately 0.00003 TRX per energy unit
            const energyRentalRate = 0.00003; // TRX per energy
            const rentalCostTRX = totalEnergy * energyRentalRate;
            
            // Store energy estimates
            await client.query(`
                INSERT INTO staged_energy_estimates (
                    transaction_id,
                    estimated_energy,
                    burning_cost_trx,
                    rental_cost_trx,
                    savings_trx
                ) VALUES ($1, $2, $3, $4, $5)
            `, [
                transactionId,
                totalEnergy,
                (totalEnergy * 420) / 1_000_000, // Burning cost if no rental
                rentalCostTRX,
                ((totalEnergy * 420) / 1_000_000) - rentalCostTRX // Savings from rental
            ]);
            
            await client.query('COMMIT');
            
            // Return comprehensive response
            res.json({
                success: true,
                transactionId,
                sessionId: data.sessionId,
                status: 'staged',
                recipients: data.recipients,
                files: {
                    thumbnail: files.thumbnailPath ? `/uploads/staged/${files.thumbnailPath}` : null,
                    document: files.documentPath ? `/uploads/staged/${files.documentPath}` : null,
                    encryptedDocument: files.encryptedDocumentPath ? `/uploads/staged/${files.encryptedDocumentPath}` : null
                },
                estimates: {
                    energyRequired: totalEnergy,
                    burningCostTRX: (totalEnergy * 420) / 1_000_000,
                    rentalCostTRX: rentalCostTRX,
                    savingsTRX: ((totalEnergy * 420) / 1_000_000) - rentalCostTRX,
                    totalFeeTRX: data.creationFee + (data.sponsorFees ? data.sponsorshipFee * data.recipients.length : 0)
                },
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                message: 'Transaction staged successfully. Backend is now the source of truth.'
            });
            
        } catch (error) {
            if (client) {
                await client.query('ROLLBACK');
            }
            
            console.error('Transaction staging error:', error);
            
            // Clean up uploaded files on error
            const files = req.files;
            if (files) {
                for (const fieldname in files) {
                    for (const file of files[fieldname]) {
                        await fs.unlink(file.path).catch(() => {});
                    }
                }
            }
            
            // Ensure CORS headers are set even on error
            const origin = req.headers.origin;
            const allowedOrigins = [
                'https://theblockservice.com',
                'https://www.theblockservice.com',
                'https://blockserved.com',
                'https://www.blockserved.com',
                'https://nft-legal-service.netlify.app',
                'http://localhost:8080',
                'http://localhost:3000'
            ];
            
            if (allowedOrigins.includes(origin)) {
                res.setHeader('Access-Control-Allow-Origin', origin);
                res.setHeader('Access-Control-Allow-Credentials', 'true');
            }
            
            res.status(500).json({
                success: false,
                error: error.message,
                message: 'Failed to stage transaction'
            });
            
        } finally {
            if (client) {
                client.release();
            }
        }
});

/**
 * GET /api/stage/transaction/:transactionId
 * Retrieve ALL data for a staged transaction
 * This is used by the blockchain transaction executor
 */
router.get('/transaction/:transactionId', async (req, res) => {
    // Set CORS headers
    const origin = req.headers.origin;
    const allowedOrigins = [
        'https://theblockservice.com',
        'https://www.theblockservice.com',
        'https://blockserved.com',
        'https://www.blockserved.com',
        'https://nft-legal-service.netlify.app',
        'http://localhost:8080',
        'http://localhost:3000'
    ];
    
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }
    
    console.log('GET /api/stage/transaction/:id - Request for:', req.params.transactionId);
    console.log('From origin:', origin);
    
    let client;
    
    try {
        const { transactionId } = req.params;
        
        client = await pool.connect();
        
        // Get main transaction
        const txResult = await client.query(`
            SELECT * FROM staged_transactions 
            WHERE transaction_id = $1 
            AND expires_at > NOW()
        `, [transactionId]);
        
        if (txResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found or expired'
            });
        }
        
        const transaction = txResult.rows[0];
        
        // Get notice details
        const noticeResult = await client.query(`
            SELECT * FROM staged_notices 
            WHERE transaction_id = $1
        `, [transactionId]);
        
        // Get file details
        const filesResult = await client.query(`
            SELECT * FROM staged_files 
            WHERE transaction_id = $1
        `, [transactionId]);
        
        // Get IPFS details
        const ipfsResult = await client.query(`
            SELECT * FROM staged_ipfs 
            WHERE transaction_id = $1
        `, [transactionId]);
        
        // Get recipients
        const recipientsResult = await client.query(`
            SELECT * FROM staged_recipients 
            WHERE transaction_id = $1 
            ORDER BY recipient_index
        `, [transactionId]);
        
        // Get energy estimates
        const energyResult = await client.query(`
            SELECT * FROM staged_energy_estimates 
            WHERE transaction_id = $1
        `, [transactionId]);
        
        // Compile complete transaction data
        let parsedData = {};
        try {
            parsedData = JSON.parse(transaction.data || '{}');
        } catch (parseError) {
            console.error('Error parsing transaction data:', parseError);
            parsedData = {};
        }
        
        const completeData = {
            transaction: transaction,
            notice: noticeResult.rows[0] || {},
            files: filesResult.rows[0] || {},
            ipfs: ipfsResult.rows[0] || {},
            recipients: recipientsResult.rows,
            energy: energyResult.rows[0] || {},
            data: parsedData
        };
        
        res.json({
            success: true,
            transactionId,
            status: transaction.status,
            expiresAt: transaction.expires_at,
            completeData
        });
        
    } catch (error) {
        console.error('Error retrieving staged transaction:', error);
        console.error('Stack trace:', error.stack);
        
        // Always return proper JSON
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve staged transaction',
            transactionId: req.params.transactionId
        });
        
    } finally {
        if (client) {
            client.release();
        }
    }
});

/**
 * POST /api/stage/execute/:transactionId
 * Execute a staged transaction - pulls all data from backend
 */
router.post('/execute/:transactionId', async (req, res) => {
    let client;
    
    try {
        const { transactionId } = req.params;
        const { blockchainTxHash, alertIds, documentIds, energyUsed } = req.body;
        
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Get staged transaction
        const txResult = await client.query(`
            SELECT * FROM staged_transactions 
            WHERE transaction_id = $1 
            AND status = 'staged'
            AND expires_at > NOW()
        `, [transactionId]);
        
        if (txResult.rows.length === 0) {
            throw new Error('Transaction not found, already executed, or expired');
        }
        
        const transaction = txResult.rows[0];
        let txData = {};
        try {
            txData = JSON.parse(transaction.data || '{}');
        } catch (parseError) {
            console.error('Error parsing transaction data:', parseError);
        }
        
        // Get all related data
        const noticeResult = await client.query(`
            SELECT * FROM staged_notices WHERE transaction_id = $1
        `, [transactionId]);
        
        const filesResult = await client.query(`
            SELECT * FROM staged_files WHERE transaction_id = $1
        `, [transactionId]);
        
        const recipientsResult = await client.query(`
            SELECT * FROM staged_recipients 
            WHERE transaction_id = $1 
            ORDER BY recipient_index
        `, [transactionId]);
        
        // Move files from staged to permanent storage
        if (filesResult.rows.length > 0) {
            const files = filesResult.rows[0];
            const stagedDir = path.join(__dirname, '../uploads/staged');
            const permanentDir = path.join(__dirname, '../uploads/documents');
            
            await fs.mkdir(permanentDir, { recursive: true });
            
            for (const field of ['thumbnail_path', 'document_path', 'encrypted_document_path']) {
                if (files[field]) {
                    const oldPath = path.join(stagedDir, files[field]);
                    const newPath = path.join(permanentDir, files[field]);
                    await fs.rename(oldPath, newPath).catch(err => {
                        console.log(`Could not move ${field}:`, err.message);
                    });
                }
            }
        }
        
        // Insert into permanent served_notices table
        const recipients = recipientsResult.rows;
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            const alertId = alertIds?.[i] || recipient.notice_id;
            const documentId = documentIds?.[i] || `${recipient.notice_id}_doc`;
            
            await client.query(`
                INSERT INTO served_notices (
                    notice_id,
                    server_address,
                    recipient_address,
                    notice_type,
                    case_number,
                    alert_id,
                    document_id,
                    issuing_agency,
                    has_document,
                    ipfs_hash,
                    batch_id,
                    tx_hash
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (notice_id) DO UPDATE SET
                    tx_hash = EXCLUDED.tx_hash,
                    updated_at = NOW()
            `, [
                recipient.notice_id,
                txData.serverAddress,
                recipient.recipient_address,
                txData.noticeType,
                txData.caseNumber,
                alertId,
                documentId,
                txData.issuingAgency,
                txData.hasDocument,
                txData.ipfsHash,
                transactionId,
                blockchainTxHash
            ]);
            
            // Update recipient status
            await client.query(`
                UPDATE staged_recipients 
                SET status = 'executed', 
                    alert_id = $2,
                    document_id = $3
                WHERE transaction_id = $1 
                AND recipient_index = $4
            `, [transactionId, alertId, documentId, i]);
        }
        
        // Store images in notice_components if they exist
        if (filesResult.rows.length > 0) {
            const files = filesResult.rows[0];
            const notice = noticeResult.rows[0];
            
            for (const recipient of recipients) {
                await client.query(`
                    INSERT INTO notice_components (
                        notice_id,
                        case_number,
                        server_address,
                        recipient_address,
                        alert_id,
                        alert_thumbnail_url,
                        document_id,
                        document_unencrypted_url,
                        document_ipfs_hash,
                        document_encryption_key,
                        notice_type,
                        issuing_agency,
                        chain_type
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    ON CONFLICT (notice_id, chain_type) DO UPDATE SET
                        alert_thumbnail_url = EXCLUDED.alert_thumbnail_url,
                        document_unencrypted_url = EXCLUDED.document_unencrypted_url,
                        updated_at = NOW()
                `, [
                    recipient.notice_id,
                    notice.case_number,
                    txData.serverAddress,
                    recipient.recipient_address,
                    recipient.alert_id,
                    files.thumbnail_path ? `/uploads/documents/${files.thumbnail_path}` : null,
                    recipient.document_id,
                    files.document_path ? `/uploads/documents/${files.document_path}` : null,
                    txData.ipfsHash,
                    txData.encryptionKey,
                    notice.notice_type,
                    notice.issuing_agency,
                    'TRON'
                ]);
            }
        }
        
        // Update transaction status
        await client.query(`
            UPDATE staged_transactions 
            SET status = 'executed',
                blockchain_tx_hash = $2,
                energy_used = $3,
                executed_at = NOW()
            WHERE transaction_id = $1
        `, [transactionId, blockchainTxHash, energyUsed]);
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            transactionId,
            blockchainTxHash,
            recipients: recipients.map(r => ({
                address: r.recipient_address,
                noticeId: r.notice_id,
                alertId: r.alert_id,
                documentId: r.document_id
            })),
            message: 'Transaction executed and backend updated successfully'
        });
        
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        
        console.error('Transaction execution error:', error);
        
        res.status(500).json({
            success: false,
            error: error.message
        });
        
    } finally {
        if (client) {
            client.release();
        }
    }
});

/**
 * DELETE /api/stage/cleanup
 * Clean up expired staged transactions
 */
router.delete('/cleanup', async (req, res) => {
    let client;
    
    try {
        client = await pool.connect();
        
        // Get expired transactions
        const expiredResult = await client.query(`
            SELECT transaction_id FROM staged_transactions 
            WHERE expires_at < NOW() 
            AND status = 'staged'
        `);
        
        // Clean up files for expired transactions
        for (const row of expiredResult.rows) {
            const filesResult = await client.query(`
                SELECT * FROM staged_files 
                WHERE transaction_id = $1
            `, [row.transaction_id]);
            
            if (filesResult.rows.length > 0) {
                const files = filesResult.rows[0];
                const stagedDir = path.join(__dirname, '../uploads/staged');
                
                for (const field of ['thumbnail_path', 'document_path', 'encrypted_document_path']) {
                    if (files[field]) {
                        const filePath = path.join(stagedDir, files[field]);
                        await fs.unlink(filePath).catch(() => {});
                    }
                }
            }
        }
        
        // Delete expired records
        await client.query(`
            DELETE FROM staged_energy_estimates 
            WHERE transaction_id IN (
                SELECT transaction_id FROM staged_transactions 
                WHERE expires_at < NOW() AND status = 'staged'
            )
        `);
        
        await client.query(`
            DELETE FROM staged_recipients 
            WHERE transaction_id IN (
                SELECT transaction_id FROM staged_transactions 
                WHERE expires_at < NOW() AND status = 'staged'
            )
        `);
        
        await client.query(`
            DELETE FROM staged_ipfs 
            WHERE transaction_id IN (
                SELECT transaction_id FROM staged_transactions 
                WHERE expires_at < NOW() AND status = 'staged'
            )
        `);
        
        await client.query(`
            DELETE FROM staged_files 
            WHERE transaction_id IN (
                SELECT transaction_id FROM staged_transactions 
                WHERE expires_at < NOW() AND status = 'staged'
            )
        `);
        
        await client.query(`
            DELETE FROM staged_notices 
            WHERE transaction_id IN (
                SELECT transaction_id FROM staged_transactions 
                WHERE expires_at < NOW() AND status = 'staged'
            )
        `);
        
        const deleteResult = await client.query(`
            DELETE FROM staged_transactions 
            WHERE expires_at < NOW() 
            AND status = 'staged'
            RETURNING transaction_id
        `);
        
        res.json({
            success: true,
            cleaned: deleteResult.rows.length,
            transactionIds: deleteResult.rows.map(r => r.transaction_id)
        });
        
    } catch (error) {
        console.error('Cleanup error:', error);
        
        res.status(500).json({
            success: false,
            error: error.message
        });
        
    } finally {
        if (client) {
            client.release();
        }
    }
});

module.exports = router;