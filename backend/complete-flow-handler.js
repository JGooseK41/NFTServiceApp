/**
 * Complete NFT Minting Flow Handler
 * Integrates all components for the full legal notice NFT process
 */

const { Pool } = require('pg');

class CompleteFlowHandler {
    constructor(pool) {
        this.pool = pool;
    }

    /**
     * Handle complete notice creation and minting flow
     * This coordinates all the backend services
     */
    async handleCompleteNoticeFlow(data) {
        const steps = [];
        
        try {
            // Step 1: Document Processing
            steps.push({ step: 'document_processing', status: 'starting' });
            
            // Documents should be:
            // - Encrypted and uploaded to IPFS (permanent record)
            // - Encrypted and stored on disk (fast retrieval)
            const documentResult = {
                ipfsHash: data.ipfsHash,
                encryptionKey: data.encryptionKey,
                diskDocumentId: data.documentId,
                alertImage: data.alertImage
            };
            
            steps.push({ step: 'document_processing', status: 'completed', result: documentResult });
            
            // Step 2: Store Pre-Blockchain Notice Data
            steps.push({ step: 'pre_blockchain_storage', status: 'starting' });
            
            const noticeId = data.noticeId || `notice_${Date.now()}`;
            
            // Store notice data before blockchain confirmation
            const preBlockchainQuery = `
                INSERT INTO pending_notices (
                    notice_id,
                    case_number,
                    server_address,
                    recipient_addresses,
                    ipfs_hash,
                    encryption_key,
                    document_id,
                    alert_image,
                    status,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
                ON CONFLICT (notice_id) DO UPDATE SET
                    status = 'pending',
                    updated_at = NOW()
                RETURNING *
            `;
            
            const pendingNotice = await this.pool.query(preBlockchainQuery, [
                noticeId,
                data.caseNumber,
                data.serverAddress,
                JSON.stringify(data.recipients),
                documentResult.ipfsHash,
                documentResult.encryptionKey,
                documentResult.diskDocumentId,
                documentResult.alertImage,
            ]);
            
            steps.push({ step: 'pre_blockchain_storage', status: 'completed', noticeId });
            
            // Step 3: Blockchain Transaction (handled by frontend)
            steps.push({ step: 'blockchain_mint', status: 'awaiting_frontend' });
            
            return {
                success: true,
                noticeId,
                documentData: documentResult,
                steps,
                nextAction: 'Execute blockchain transaction from frontend'
            };
            
        } catch (error) {
            console.error('Complete flow failed:', error);
            throw {
                error: error.message,
                steps,
                failedAt: steps[steps.length - 1]?.step
            };
        }
    }
    
    /**
     * Handle post-blockchain confirmation
     * Called after successful blockchain transaction
     */
    async handleBlockchainConfirmation(data) {
        const { 
            noticeId, 
            transactionHash, 
            alertTokenIds, 
            documentTokenIds,
            recipients 
        } = data;
        
        try {
            // Update pending notice to confirmed
            await this.pool.query(`
                UPDATE pending_notices 
                SET 
                    status = 'confirmed',
                    transaction_hash = $1,
                    alert_token_ids = $2,
                    document_token_ids = $3,
                    confirmed_at = NOW()
                WHERE notice_id = $4
            `, [transactionHash, JSON.stringify(alertTokenIds), JSON.stringify(documentTokenIds), noticeId]);
            
            // Create individual notice records for each recipient
            for (let i = 0; i < recipients.length; i++) {
                await this.pool.query(`
                    INSERT INTO served_notices (
                        notice_id,
                        alert_token_id,
                        document_token_id,
                        server_address,
                        recipient_address,
                        transaction_hash,
                        ipfs_hash,
                        status,
                        created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'delivered', NOW())
                    ON CONFLICT (notice_id, recipient_address) DO UPDATE SET
                        alert_token_id = EXCLUDED.alert_token_id,
                        document_token_id = EXCLUDED.document_token_id,
                        transaction_hash = EXCLUDED.transaction_hash
                `, [
                    `${noticeId}_${i}`,
                    alertTokenIds[i],
                    documentTokenIds[i],
                    data.serverAddress,
                    recipients[i],
                    transactionHash,
                    data.ipfsHash
                ]);
            }
            
            return {
                success: true,
                message: 'Blockchain confirmation recorded',
                noticeId,
                transactionHash
            };
            
        } catch (error) {
            console.error('Failed to confirm blockchain transaction:', error);
            throw error;
        }
    }
    
    /**
     * Get complete notice status
     */
    async getNoticeStatus(noticeId) {
        try {
            // Check pending notices
            const pending = await this.pool.query(
                'SELECT * FROM pending_notices WHERE notice_id = $1',
                [noticeId]
            );
            
            if (pending.rows.length > 0) {
                const notice = pending.rows[0];
                
                // Get individual recipient statuses
                const served = await this.pool.query(
                    'SELECT * FROM served_notices WHERE notice_id LIKE $1',
                    [`${noticeId}%`]
                );
                
                return {
                    status: notice.status,
                    caseNumber: notice.case_number,
                    recipients: JSON.parse(notice.recipient_addresses || '[]'),
                    ipfsHash: notice.ipfs_hash,
                    transactionHash: notice.transaction_hash,
                    alertTokenIds: JSON.parse(notice.alert_token_ids || '[]'),
                    documentTokenIds: JSON.parse(notice.document_token_ids || '[]'),
                    servedNotices: served.rows,
                    createdAt: notice.created_at,
                    confirmedAt: notice.confirmed_at
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('Failed to get notice status:', error);
            throw error;
        }
    }
    
    /**
     * Initialize required database tables
     */
    async initializeTables() {
        try {
            // Pending notices table (pre-blockchain)
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS pending_notices (
                    notice_id VARCHAR(255) PRIMARY KEY,
                    case_number VARCHAR(255),
                    server_address VARCHAR(255),
                    recipient_addresses JSONB,
                    ipfs_hash VARCHAR(255),
                    encryption_key TEXT,
                    document_id VARCHAR(255),
                    alert_image TEXT,
                    transaction_hash VARCHAR(255),
                    alert_token_ids JSONB,
                    document_token_ids JSONB,
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT NOW(),
                    confirmed_at TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            
            // Add indexes
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_notices(status);
                CREATE INDEX IF NOT EXISTS idx_pending_case ON pending_notices(case_number);
                CREATE INDEX IF NOT EXISTS idx_pending_server ON pending_notices(server_address);
            `);
            
            console.log('✅ Complete flow tables initialized');
            
        } catch (error) {
            console.warn('Table initialization warning:', error.message);
        }
    }
}

// Express routes
function setupCompleteFlowRoutes(app, pool) {
    const handler = new CompleteFlowHandler(pool);
    
    // Initialize tables
    handler.initializeTables();
    
    // Start complete notice flow
    app.post('/api/notices/complete-flow', async (req, res) => {
        try {
            const result = await handler.handleCompleteNoticeFlow(req.body);
            res.json(result);
        } catch (error) {
            console.error('Complete flow error:', error);
            res.status(500).json({ error: error.message || 'Flow failed', details: error });
        }
    });
    
    // Confirm blockchain transaction
    app.post('/api/notices/confirm-blockchain', async (req, res) => {
        try {
            const result = await handler.handleBlockchainConfirmation(req.body);
            res.json(result);
        } catch (error) {
            console.error('Confirmation error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    // Get notice status
    app.get('/api/notices/:noticeId/status', async (req, res) => {
        try {
            const status = await handler.getNoticeStatus(req.params.noticeId);
            if (!status) {
                return res.status(404).json({ error: 'Notice not found' });
            }
            res.json(status);
        } catch (error) {
            console.error('Status error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    console.log('✅ Complete flow routes configured');
}

module.exports = {
    CompleteFlowHandler,
    setupCompleteFlowRoutes
};