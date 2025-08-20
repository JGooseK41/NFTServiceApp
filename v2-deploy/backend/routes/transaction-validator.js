/**
 * Transaction Validation and Preparation Endpoint
 * Validates all data BEFORE initiating blockchain transactions
 * Prevents wasted energy rental on failed transactions
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { Pool } = require('pg');

// Initialize database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Configure multer for temporary storage
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/temp');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
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
 * POST /api/validate/prepare-transaction
 * Validates and prepares transaction data
 * Returns a transaction ID that can be executed later
 */
router.post('/prepare-transaction', 
    upload.fields([
        { name: 'thumbnail', maxCount: 1 },
        { name: 'document', maxCount: 1 }
    ]),
    async (req, res) => {
        let client;
        
        try {
            // Parse request data
            const data = {
                recipients: JSON.parse(req.body.recipients || '[]'),
                caseNumber: req.body.caseNumber || '',
                serverAddress: req.body.serverAddress || '',
                noticeType: req.body.noticeType || 'Legal Notice',
                issuingAgency: req.body.issuingAgency || '',
                publicText: req.body.publicText || '',
                hasDocument: req.body.hasDocument === 'true',
                sponsorFees: req.body.sponsorFees === 'true',
                network: req.body.network || 'mainnet'
            };
            
            // Validation checks
            const validationErrors = [];
            
            // 1. Check recipients
            if (!data.recipients || data.recipients.length === 0) {
                validationErrors.push('At least one recipient is required');
            }
            
            // 2. Validate TRON addresses
            const invalidAddresses = data.recipients.filter(addr => {
                return !addr || (!addr.startsWith('T') || addr.length !== 34);
            });
            
            if (invalidAddresses.length > 0) {
                validationErrors.push(`Invalid TRON addresses: ${invalidAddresses.join(', ')}`);
            }
            
            // 3. Check server address
            if (!data.serverAddress) {
                validationErrors.push('Server address is required');
            }
            
            // 4. Check files if document is expected
            const thumbnailFile = req.files?.thumbnail?.[0];
            const documentFile = req.files?.document?.[0];
            
            if (data.hasDocument && !documentFile) {
                validationErrors.push('Document file is required when hasDocument is true');
            }
            
            // Return validation errors if any
            if (validationErrors.length > 0) {
                // Clean up uploaded files on validation error
                if (thumbnailFile) await fs.unlink(thumbnailFile.path).catch(() => {});
                if (documentFile) await fs.unlink(documentFile.path).catch(() => {});
                
                return res.status(400).json({
                    success: false,
                    validationErrors,
                    message: 'Validation failed'
                });
            }
            
            // Generate transaction ID
            const transactionId = `TXN_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
            
            // Connect to database
            client = await pool.connect();
            
            // Store prepared transaction data
            const preparedData = {
                transactionId,
                recipients: data.recipients,
                caseNumber: data.caseNumber,
                serverAddress: data.serverAddress,
                noticeType: data.noticeType,
                issuingAgency: data.issuingAgency,
                publicText: data.publicText,
                hasDocument: data.hasDocument,
                sponsorFees: data.sponsorFees,
                network: data.network,
                thumbnailPath: thumbnailFile?.filename || null,
                documentPath: documentFile?.filename || null,
                status: 'prepared',
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 min expiry
            };
            
            // Store in database
            await client.query(`
                INSERT INTO prepared_transactions 
                (transaction_id, data, status, created_at, expires_at)
                VALUES ($1, $2, $3, NOW(), $4)
            `, [
                transactionId,
                JSON.stringify(preparedData),
                'prepared',
                preparedData.expiresAt
            ]);
            
            // Calculate energy requirements
            const isBatch = data.recipients.length > 1;
            const baseEnergy = 800000;
            const documentEnergy = data.hasDocument ? 100000 : 0;
            const perRecipientEnergy = 50000;
            const totalEnergy = baseEnergy + documentEnergy + (perRecipientEnergy * data.recipients.length);
            
            // Calculate fees
            const baseFee = 2; // 2 TRX base fee
            const sponsorshipFee = data.sponsorFees ? (10 * data.recipients.length) : 0;
            const totalFee = baseFee + sponsorshipFee;
            
            // Success response with all needed info
            res.json({
                success: true,
                transactionId,
                validation: {
                    passed: true,
                    recipientCount: data.recipients.length,
                    hasDocument: data.hasDocument,
                    network: data.network
                },
                estimates: {
                    energyRequired: totalEnergy,
                    energyCostTRX: (totalEnergy * 420) / 1_000_000, // Burning cost
                    rentalCostTRX: (totalEnergy * 30) / 1_000_000,  // Rental cost  
                    transactionFeeTRX: totalFee,
                    totalCostWithBurning: totalFee + ((totalEnergy * 420) / 1_000_000),
                    totalCostWithRental: totalFee + ((totalEnergy * 30) / 1_000_000),
                    savingsWithRental: ((totalEnergy * 390) / 1_000_000)
                },
                expiresIn: '15 minutes',
                message: 'Transaction validated and prepared successfully'
            });
            
        } catch (error) {
            console.error('Transaction preparation error:', error);
            
            // Clean up files on error
            const thumbnailFile = req.files?.thumbnail?.[0];
            const documentFile = req.files?.document?.[0];
            if (thumbnailFile) await fs.unlink(thumbnailFile.path).catch(() => {});
            if (documentFile) await fs.unlink(documentFile.path).catch(() => {});
            
            res.status(500).json({
                success: false,
                error: error.message,
                message: 'Failed to prepare transaction'
            });
            
        } finally {
            if (client) {
                client.release();
            }
        }
});

/**
 * POST /api/validate/execute-transaction
 * Executes a previously prepared transaction
 * Only called AFTER energy rental is confirmed
 */
router.post('/execute-transaction', async (req, res) => {
    let client;
    
    try {
        const { transactionId, txHash, energyRented } = req.body;
        
        if (!transactionId) {
            return res.status(400).json({
                success: false,
                error: 'Transaction ID is required'
            });
        }
        
        client = await pool.connect();
        
        // Retrieve prepared transaction
        const result = await client.query(`
            SELECT * FROM prepared_transactions 
            WHERE transaction_id = $1 
            AND status = 'prepared'
            AND expires_at > NOW()
        `, [transactionId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found or expired'
            });
        }
        
        const preparedTx = result.rows[0];
        const txData = JSON.parse(preparedTx.data);
        
        // Move files from temp to permanent storage
        if (txData.thumbnailPath || txData.documentPath) {
            const tempDir = path.join(__dirname, '../uploads/temp');
            const permanentDir = path.join(__dirname, '../uploads/documents');
            
            await fs.mkdir(permanentDir, { recursive: true });
            
            if (txData.thumbnailPath) {
                const tempPath = path.join(tempDir, txData.thumbnailPath);
                const newPath = path.join(permanentDir, txData.thumbnailPath);
                await fs.rename(tempPath, newPath);
            }
            
            if (txData.documentPath) {
                const tempPath = path.join(tempDir, txData.documentPath);
                const newPath = path.join(permanentDir, txData.documentPath);
                await fs.rename(tempPath, newPath);
            }
        }
        
        // Update transaction status
        await client.query(`
            UPDATE prepared_transactions 
            SET status = 'executed', 
                tx_hash = $2,
                executed_at = NOW(),
                energy_rented = $3
            WHERE transaction_id = $1
        `, [transactionId, txHash, energyRented]);
        
        // Generate notice IDs for response
        const noticeIds = txData.recipients.map((_, index) => {
            const baseId = Date.now().toString().slice(-9);
            return `${baseId}${index}`;
        });
        
        res.json({
            success: true,
            transactionId,
            noticeIds,
            recipients: txData.recipients,
            files: {
                thumbnail: txData.thumbnailPath ? `/uploads/documents/${txData.thumbnailPath}` : null,
                document: txData.documentPath ? `/uploads/documents/${txData.documentPath}` : null
            },
            message: 'Transaction executed successfully'
        });
        
    } catch (error) {
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
 * GET /api/validate/transaction/:transactionId
 * Get prepared transaction details
 */
router.get('/transaction/:transactionId', async (req, res) => {
    let client;
    
    try {
        const { transactionId } = req.params;
        
        client = await pool.connect();
        
        const result = await client.query(`
            SELECT * FROM prepared_transactions 
            WHERE transaction_id = $1
        `, [transactionId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }
        
        const tx = result.rows[0];
        const data = JSON.parse(tx.data);
        
        res.json({
            success: true,
            transaction: {
                id: tx.transaction_id,
                status: tx.status,
                createdAt: tx.created_at,
                expiresAt: tx.expires_at,
                executedAt: tx.executed_at,
                data: data
            }
        });
        
    } catch (error) {
        console.error('Error fetching transaction:', error);
        
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
 * DELETE /api/validate/cleanup
 * Clean up expired prepared transactions
 */
router.delete('/cleanup', async (req, res) => {
    let client;
    
    try {
        client = await pool.connect();
        
        // Delete expired transactions
        const result = await client.query(`
            DELETE FROM prepared_transactions 
            WHERE expires_at < NOW() 
            AND status = 'prepared'
            RETURNING transaction_id
        `);
        
        res.json({
            success: true,
            cleaned: result.rows.length,
            transactionIds: result.rows.map(r => r.transaction_id)
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