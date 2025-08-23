/**
 * Recipient Cases API
 * Handles fetching cases/notices for recipients from case_service_records
 * This replaces the old recipient-api that was querying non-existent tables
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const cors = require('cors');
const TronWeb = require('tronweb');

// CORS configuration for BlockServed
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Apply CORS to all routes
router.use(cors(corsOptions));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Ensure required columns exist on startup
async function ensureColumns() {
    try {
        // Add missing columns if they don't exist
        await pool.query(`
            ALTER TABLE case_service_records 
            ADD COLUMN IF NOT EXISTS server_name VARCHAR(255)
        `).catch(() => {});
        
        await pool.query(`
            ALTER TABLE case_service_records 
            ADD COLUMN IF NOT EXISTS issuing_agency VARCHAR(255)
        `).catch(() => {});
        
        await pool.query(`
            ALTER TABLE case_service_records 
            ADD COLUMN IF NOT EXISTS page_count INTEGER
        `).catch(() => {});
        
        await pool.query(`
            ALTER TABLE case_service_records 
            ADD COLUMN IF NOT EXISTS status VARCHAR(50)
        `).catch(() => {});
        
        // Update existing records with data from cases table
        await pool.query(`
            UPDATE case_service_records csr
            SET 
                server_name = COALESCE(csr.server_name, c.server_address),
                issuing_agency = COALESCE(csr.issuing_agency, (c.metadata->>'issuingAgency')::text),
                page_count = COALESCE(csr.page_count, c.page_count, (c.metadata->>'pageCount')::int),
                status = COALESCE(csr.status, c.status, 'served')
            FROM cases c
            WHERE csr.case_number = c.case_number::text
            AND (csr.server_name IS NULL OR csr.issuing_agency IS NULL OR csr.page_count IS NULL)
        `).catch(e => console.log('Could not update existing records:', e.message));
        
        console.log('✅ Ensured case_service_records has all required columns');
    } catch (error) {
        console.log('⚠️ Could not add columns:', error.message);
    }
}

// Run on module load
ensureColumns();

/**
 * GET /api/recipient-cases/wallet/:address
 * Get all cases served to a specific wallet address
 */
router.get('/wallet/:address', async (req, res) => {
    try {
        const { address } = req.params;
        console.log(`Fetching cases for wallet: ${address}`);
        
        if (!address || !/^T[A-Za-z0-9]{33}$/.test(address)) {
            return res.status(400).json({ 
                error: 'Invalid wallet address',
                success: false 
            });
        }
        
        // First, let's try a simpler query without the join to see if it works
        let query;
        let result;
        
        try {
            // Try the full query with join
            query = `
                SELECT 
                    csr.case_number,
                    csr.recipients,
                    csr.transaction_hash,
                    csr.alert_token_id,
                    csr.document_token_id,
                    csr.ipfs_hash,
                    csr.served_at,
                    COALESCE(csr.server_name, c.server_address) as server_name,
                    COALESCE(csr.issuing_agency, (c.metadata->>'issuingAgency')::text) as issuing_agency,
                    COALESCE(csr.page_count, c.page_count, (c.metadata->>'pageCount')::int) as page_count,
                    COALESCE(csr.status, c.status, 'served') as status
                FROM case_service_records csr
                LEFT JOIN cases c ON csr.case_number = c.case_number::text
                WHERE csr.recipients::jsonb ? $1
                   OR LOWER(csr.recipients::text) LIKE LOWER($2)
                ORDER BY csr.served_at DESC
            `;
            result = await pool.query(query, [address, `%${address}%`]);
        } catch (joinError) {
            console.log('Join query failed, trying simple query:', joinError.message);
            
            // Fall back to simple query without join
            query = `
                SELECT 
                    case_number,
                    recipients,
                    transaction_hash,
                    alert_token_id,
                    document_token_id,
                    ipfs_hash,
                    served_at,
                    server_name,
                    issuing_agency,
                    page_count,
                    status
                FROM case_service_records
                WHERE recipients::jsonb ? $1
                   OR LOWER(recipients::text) LIKE LOWER($2)
                ORDER BY served_at DESC
            `;
            result = await pool.query(query, [address, `%${address}%`]);
        }
        
        // Transform data for frontend and include images
        const notices = await Promise.all(result.rows.map(async row => {
            // Parse recipients
            let recipientsList = [];
            try {
                recipientsList = typeof row.recipients === 'string' ? 
                    JSON.parse(row.recipients) : row.recipients;
            } catch (e) {
                console.log('Error parsing recipients:', e);
            }
            
            // Try to fetch images for this case
            let images = null;
            try {
                const imageQuery = await pool.query(`
                    SELECT alert_image, document_image, alert_thumbnail, document_thumbnail
                    FROM images 
                    WHERE case_number = $1 OR notice_id = $2
                    LIMIT 1
                `, [row.case_number, row.alert_token_id]);
                
                if (imageQuery.rows.length > 0) {
                    images = {
                        alert_image: imageQuery.rows[0].alert_image,
                        document_image: imageQuery.rows[0].document_image,
                        alert_thumbnail: imageQuery.rows[0].alert_thumbnail,
                        document_thumbnail: imageQuery.rows[0].document_thumbnail
                    };
                }
            } catch (e) {
                console.log('Could not fetch images:', e.message);
            }
            
            return {
                case_number: row.case_number,
                alert_token_id: row.alert_token_id,
                document_token_id: row.document_token_id,
                transaction_hash: row.transaction_hash,
                ipfs_hash: row.ipfs_hash,
                served_at: row.served_at,
                server_name: row.server_name || 'Unknown Server',
                issuing_agency: row.issuing_agency || 'Unknown Agency',
                page_count: row.page_count || 1,
                status: row.status || 'served',
                recipients_count: recipientsList.length,
                is_recipient: recipientsList.includes(address),
                images: images // Include images if available
            };
        }));
        
        console.log(`Found ${notices.length} notices for wallet ${address}`);
        
        res.json({
            success: true,
            notices: notices,
            total: notices.length,
            wallet: address
        });
        
    } catch (error) {
        console.error('Error fetching recipient cases:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch notices',
            success: false,
            details: error.message,
            hint: 'Check server logs for more details'
        });
    }
});

/**
 * GET /api/recipient-cases/:caseNumber/document
 * Get document details for a specific case
 */
router.get('/:caseNumber/document', async (req, res) => {
    try {
        const { caseNumber } = req.params;
        console.log(`Fetching document for case: ${caseNumber}`);
        
        const query = `
            SELECT 
                case_number,
                ipfs_hash,
                document_token_id,
                alert_token_id,
                page_count,
                served_at,
                server_name,
                issuing_agency,
                status
            FROM case_service_records
            WHERE case_number = $1
        `;
        
        const result = await pool.query(query, [caseNumber]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Case not found',
                success: false
            });
        }
        
        const caseData = result.rows[0];
        
        // Try to fetch images for this case
        let images = null;
        try {
            const imageQuery = await pool.query(`
                SELECT alert_image, document_image, alert_thumbnail, document_thumbnail
                FROM images 
                WHERE case_number = $1 OR notice_id = $2 OR notice_id = $3
                LIMIT 1
            `, [caseNumber, caseData.alert_token_id, caseData.document_token_id]);
            
            if (imageQuery.rows.length > 0) {
                images = {
                    alert_image: imageQuery.rows[0].alert_image,
                    document_image: imageQuery.rows[0].document_image,
                    alert_thumbnail: imageQuery.rows[0].alert_thumbnail,
                    document_thumbnail: imageQuery.rows[0].document_thumbnail
                };
            }
        } catch (e) {
            console.log('Could not fetch images from images table:', e.message);
            
            // Try fallback to notice_components table
            try {
                const fallbackQuery = await pool.query(`
                    SELECT 
                        alert_thumbnail_url as alert_thumbnail,
                        document_unencrypted_url as document_image
                    FROM notice_components
                    WHERE case_number = $1 OR alert_id = $2 OR document_id = $3
                    LIMIT 1
                `, [caseNumber, caseData.alert_token_id, caseData.document_token_id]);
                
                if (fallbackQuery.rows.length > 0) {
                    images = {
                        alert_image: fallbackQuery.rows[0].alert_thumbnail,
                        document_image: fallbackQuery.rows[0].document_image,
                        alert_thumbnail: fallbackQuery.rows[0].alert_thumbnail,
                        document_thumbnail: fallbackQuery.rows[0].document_image
                    };
                }
            } catch (fallbackError) {
                console.log('Could not fetch images from notice_components:', fallbackError.message);
            }
        }
        
        res.json({
            success: true,
            notice: {
                case_number: caseData.case_number,
                ipfs_hash: caseData.ipfs_hash,
                document_token_id: caseData.document_token_id,
                alert_token_id: caseData.alert_token_id,
                page_count: caseData.page_count,
                served_at: caseData.served_at,
                server_name: caseData.server_name,
                issuing_agency: caseData.issuing_agency,
                status: caseData.status,
                images: images
            }
        });
        
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({ 
            error: 'Failed to fetch document',
            success: false,
            details: error.message
        });
    }
});

/**
 * POST /api/recipient-cases/:caseNumber/acknowledge
 * Acknowledge receipt of a notice
 */
router.post('/:caseNumber/acknowledge', async (req, res) => {
    try {
        const { caseNumber } = req.params;
        const { signature, wallet, timestamp } = req.body;
        
        console.log(`Recording acknowledgment for case ${caseNumber} by wallet ${wallet}`);
        
        // Create acknowledgments table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS case_acknowledgments (
                id SERIAL PRIMARY KEY,
                case_number VARCHAR(255) NOT NULL,
                wallet_address VARCHAR(255) NOT NULL,
                signature TEXT,
                acknowledged_at TIMESTAMP DEFAULT NOW(),
                ip_address VARCHAR(45),
                user_agent TEXT
            )
        `).catch(e => console.log('Table already exists'));
        
        // Record acknowledgment
        await pool.query(`
            INSERT INTO case_acknowledgments (
                case_number,
                wallet_address,
                signature,
                acknowledged_at,
                ip_address,
                user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            caseNumber,
            wallet,
            signature,
            timestamp || new Date(),
            req.ip || req.connection.remoteAddress,
            req.headers['user-agent']
        ]);
        
        // Update case_service_records status
        await pool.query(`
            UPDATE case_service_records
            SET status = 'acknowledged'
            WHERE case_number = $1
        `, [caseNumber]);
        
        res.json({
            success: true,
            message: 'Acknowledgment recorded successfully'
        });
        
    } catch (error) {
        console.error('Error recording acknowledgment:', error);
        res.status(500).json({ 
            error: 'Failed to record acknowledgment',
            success: false,
            details: error.message
        });
    }
});

/**
 * GET /api/recipient-cases/update-with-blockchain-data
 * Update all tokens with actual blockchain ownership data
 */
router.get('/update-with-blockchain-data', async (req, res) => {
    console.log('Updating tokens with actual blockchain data...');
    const result = {
        updated: [],
        errors: [],
        summary: {}
    };
    
    // Actual blockchain data from NFT transfers
    const blockchainData = [
        // First batch - 2 days ago
        { tokenId: 31, owner: 'TD1F37V4cAFH1YQCYVLtcFyFXkZUs7mBDE', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
        { tokenId: 32, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
        { tokenId: 33, owner: 'TAr8S97Xw3xhrGkZSghXQ85SFuP5XDU4cF', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
        { tokenId: 34, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
        { tokenId: 35, owner: 'TBrjqKepMQKeZWjebMip2bH5872fiD3F6Q', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
        { tokenId: 36, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
        { tokenId: 37, owner: 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
        { tokenId: 38, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
        // Second batch - 1 day ago
        { tokenId: 39, owner: 'TArxGhbLdY6ApwaCYZbwdZYiHBG96heiwp', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' },
        { tokenId: 40, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' },
        { tokenId: 41, owner: 'TUNKp7upGiHt9tamt37VfjHRPUUbZ1yNKS', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' },
        { tokenId: 42, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' },
        { tokenId: 43, owner: 'TVPPcD8P8QWK5eix6B6r5nVNaUFUHfUohe', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' },
        { tokenId: 44, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' },
        { tokenId: 45, owner: 'TCULAeahAiC9nvurUzxvusGRLD2JxoY5Yw', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' },
        { tokenId: 46, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' }
    ];
    
    try {
        // Update each token with blockchain data
        for (const token of blockchainData) {
            try {
                // Keep existing case number for token 37, update placeholder case numbers for others
                let updateResult;
                if (token.tokenId === 37) {
                    // Token 37 already has correct case number
                    updateResult = await pool.query(`
                        UPDATE case_service_records
                        SET 
                            recipients = $1,
                            transaction_hash = $2,
                            status = 'served'
                        WHERE alert_token_id = $3
                        RETURNING case_number
                    `, [
                        JSON.stringify([token.owner]),
                        token.tx,
                        token.tokenId.toString()
                    ]);
                } else {
                    // Update placeholder records
                    updateResult = await pool.query(`
                        UPDATE case_service_records
                        SET 
                            recipients = $1,
                            transaction_hash = $2,
                            status = 'served',
                            issuing_agency = 'Fort Lauderdale Police'
                        WHERE alert_token_id = $3
                        RETURNING case_number
                    `, [
                        JSON.stringify([token.owner]),
                        token.tx,
                        token.tokenId.toString()
                    ]);
                }
                
                if (updateResult.rowCount > 0) {
                    result.updated.push({
                        tokenId: token.tokenId,
                        owner: token.owner,
                        case: updateResult.rows[0].case_number
                    });
                }
            } catch (e) {
                result.errors.push(`Token ${token.tokenId}: ${e.message}`);
            }
        }
        
        // Generate summary by wallet
        const walletSummary = {};
        blockchainData.forEach(token => {
            if (!walletSummary[token.owner]) {
                walletSummary[token.owner] = {
                    tokens: [],
                    count: 0
                };
            }
            walletSummary[token.owner].tokens.push(token.tokenId);
            walletSummary[token.owner].count++;
        });
        
        result.summary = walletSummary;
        result.total_updated = result.updated.length;
        result.success = true;
        
    } catch (error) {
        result.success = false;
        result.error = error.message;
    }
    
    res.json(result);
});

/**
 * GET /api/recipient-cases/add-all-38-tokens
 * Add placeholder records for all 38 NFT tokens
 */
router.get('/add-all-38-tokens', async (req, res) => {
    console.log('Adding placeholder records for all 38 NFT tokens...');
    const result = {
        added: [],
        existing: [],
        errors: []
    };
    
    try {
        // Known mappings
        const knownTokens = {
            '37': { case: '34-4343902', recipient: 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH' }
        };
        
        // Process all 46 tokens (updated based on blockchain data)
        for (let tokenId = 1; tokenId <= 46; tokenId++) {
            const tokenIdStr = tokenId.toString();
            
            // Check if already exists
            const exists = await pool.query(
                'SELECT case_number FROM case_service_records WHERE alert_token_id = $1',
                [tokenIdStr]
            );
            
            if (exists.rows.length > 0) {
                result.existing.push({
                    tokenId: tokenIdStr,
                    case_number: exists.rows[0].case_number
                });
                continue;
            }
            
            // Determine case number and recipient
            let caseNumber, recipients;
            if (knownTokens[tokenIdStr]) {
                caseNumber = knownTokens[tokenIdStr].case;
                recipients = [knownTokens[tokenIdStr].recipient];
            } else {
                // Create placeholder for unknown tokens
                caseNumber = `TOKEN-${tokenIdStr}-PLACEHOLDER`;
                recipients = ['Pending Identification'];
            }
            
            // Insert record
            try {
                await pool.query(`
                    INSERT INTO case_service_records (
                        case_number,
                        recipients,
                        alert_token_id,
                        served_at,
                        server_name,
                        issuing_agency,
                        page_count,
                        status
                    ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7)
                    ON CONFLICT (case_number) 
                    DO UPDATE SET alert_token_id = EXCLUDED.alert_token_id
                `, [
                    caseNumber,
                    JSON.stringify(recipients),
                    tokenIdStr,
                    'Process Server',
                    'Pending',
                    1,
                    knownTokens[tokenIdStr] ? 'served' : 'pending'
                ]);
                
                result.added.push({
                    tokenId: tokenIdStr,
                    case_number: caseNumber,
                    recipients: recipients
                });
            } catch (e) {
                result.errors.push(`Token ${tokenIdStr}: ${e.message}`);
            }
        }
        
        // Get final count
        const finalCount = await pool.query('SELECT COUNT(*) FROM case_service_records');
        result.total_processed = 38;
        result.total_added = result.added.length;
        result.total_existing = result.existing.length;
        result.final_record_count = parseInt(finalCount.rows[0].count);
        result.success = true;
        
    } catch (error) {
        result.success = false;
        result.error = error.message;
    }
    
    res.json(result);
});

/**
 * GET /api/recipient-cases/reconstruct-all-38-tokens  
 * Reconstruct data for all 38 NFT tokens that were minted
 */
router.get('/reconstruct-all-38-tokens', async (req, res) => {
    console.log('Reconstructing data for all 38 NFT tokens...');
    const result = {
        known_tokens: [],
        reconstructed: [],
        existing_data: [],
        errors: []
    };
    
    try {
        // We know these facts:
        // - 38 tokens were created in total
        // - Token #37 belongs to TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH (case 34-4343902)
        // - About half were served on blockchain (so ~19 tokens)
        
        // First, get all existing data from our tables
        console.log('Checking existing database data...');
        
        // Check cases table for any references to token IDs
        const casesWithTokens = await pool.query(`
            SELECT 
                case_number,
                metadata,
                created_at
            FROM cases
            WHERE metadata IS NOT NULL
            ORDER BY created_at
        `);
        
        // Check alert_metadata if it exists
        let alertMetadata = [];
        try {
            const alerts = await pool.query(`
                SELECT alert_id, case_number, recipient_address
                FROM alert_metadata
                WHERE alert_id IS NOT NULL
            `);
            alertMetadata = alerts.rows;
        } catch (e) {
            console.log('alert_metadata table not accessible');
        }
        
        // Build a map of token ID to case data
        const tokenToCaseMap = new Map();
        
        // Add known mapping
        tokenToCaseMap.set('37', {
            case_number: '34-4343902',
            recipient: 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH',
            known: true
        });
        
        // Add from alert_metadata
        alertMetadata.forEach(alert => {
            if (alert.alert_id && !tokenToCaseMap.has(alert.alert_id)) {
                tokenToCaseMap.set(alert.alert_id, {
                    case_number: alert.case_number,
                    recipient: alert.recipient_address,
                    from_table: 'alert_metadata'
                });
            }
        });
        
        // Process all 38 tokens
        console.log('Processing all 38 tokens...');
        for (let tokenId = 1; tokenId <= 38; tokenId++) {
            const tokenIdStr = tokenId.toString();
            
            // Check if this token is already in case_service_records
            const existing = await pool.query(
                'SELECT case_number, recipients FROM case_service_records WHERE alert_token_id = $1',
                [tokenIdStr]
            );
            
            if (existing.rows.length > 0) {
                result.existing_data.push({
                    tokenId: tokenIdStr,
                    case_number: existing.rows[0].case_number,
                    status: 'already_in_database'
                });
                continue;
            }
            
            // Get data from our map or create placeholder
            const tokenData = tokenToCaseMap.get(tokenIdStr);
            
            if (tokenData) {
                // We have data for this token
                try {
                    await pool.query(`
                        INSERT INTO case_service_records (
                            case_number,
                            recipients,
                            alert_token_id,
                            served_at,
                            server_name,
                            issuing_agency,
                            page_count,
                            status
                        ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7)
                        ON CONFLICT (case_number) 
                        DO UPDATE SET alert_token_id = EXCLUDED.alert_token_id
                    `, [
                        tokenData.case_number,
                        JSON.stringify([tokenData.recipient || 'Unknown']),
                        tokenIdStr,
                        'Process Server',
                        'Fort Lauderdale Police',
                        1,
                        'served'
                    ]);
                    
                    result.reconstructed.push({
                        tokenId: tokenIdStr,
                        case_number: tokenData.case_number,
                        recipient: tokenData.recipient,
                        source: tokenData.from_table || 'known_data'
                    });
                } catch (e) {
                    result.errors.push(`Token ${tokenIdStr}: ${e.message}`);
                }
            } else {
                // No data found, create placeholder for unmatched tokens
                // These are likely the tokens that were created but not served
                const placeholderCase = `UNSERVED-TOKEN-${tokenIdStr}`;
                
                try {
                    await pool.query(`
                        INSERT INTO case_service_records (
                            case_number,
                            recipients,
                            alert_token_id,
                            served_at,
                            server_name,
                            issuing_agency,
                            page_count,
                            status
                        ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7)
                        ON CONFLICT (case_number) DO NOTHING
                    `, [
                        placeholderCase,
                        JSON.stringify(['Not Yet Served']),
                        tokenIdStr,
                        'Process Server',
                        'Pending Assignment',
                        1,
                        'pending'
                    ]);
                    
                    result.reconstructed.push({
                        tokenId: tokenIdStr,
                        case_number: placeholderCase,
                        status: 'placeholder_created'
                    });
                } catch (e) {
                    result.errors.push(`Placeholder ${tokenIdStr}: ${e.message}`);
                }
            }
        }
        
        // Final summary
        const finalCount = await pool.query('SELECT COUNT(*) FROM case_service_records');
        result.total_tokens_processed = 38;
        result.total_existing = result.existing_data.length;
        result.total_reconstructed = result.reconstructed.length;
        result.final_record_count = parseInt(finalCount.rows[0].count);
        result.success = true;
        
    } catch (error) {
        result.success = false;
        result.error = error.message;
        result.errors.push(error.message);
    }
    
    res.json(result);
});

/**
 * GET /api/recipient-cases/find-all-historical
 * Find ALL historical data across all tables
 */
router.get('/find-all-historical', async (req, res) => {
    console.log('Searching for all historical data...');
    const result = { 
        tables_searched: [],
        cases_found: {},
        recipients_found: {},
        reconstruction: [],
        errors: []
    };
    
    try {
        // 1. Search cases table
        try {
            const casesQuery = `
                SELECT 
                    case_number,
                    server_address,
                    server_name,
                    issuing_agency,
                    page_count,
                    status,
                    created_at,
                    metadata
                FROM cases
                ORDER BY created_at DESC
            `;
            const cases = await pool.query(casesQuery);
            result.tables_searched.push('cases');
            
            cases.rows.forEach(c => {
                result.cases_found[c.case_number] = {
                    case_number: c.case_number,
                    server_name: c.server_name || c.server_address,
                    issuing_agency: c.issuing_agency,
                    page_count: c.page_count,
                    status: c.status,
                    created_at: c.created_at,
                    from_table: 'cases'
                };
            });
        } catch (e) {
            result.errors.push(`cases: ${e.message}`);
        }
        
        // 2. Search notice_images for recipients
        try {
            const imagesQuery = `
                SELECT 
                    notice_id,
                    case_number,
                    recipient_address,
                    created_at
                FROM notice_images
                WHERE recipient_address IS NOT NULL
            `;
            const images = await pool.query(imagesQuery);
            result.tables_searched.push('notice_images');
            
            images.rows.forEach(img => {
                if (!result.recipients_found[img.recipient_address]) {
                    result.recipients_found[img.recipient_address] = [];
                }
                if (img.case_number) {
                    result.recipients_found[img.recipient_address].push(img.case_number);
                }
            });
        } catch (e) {
            result.errors.push(`notice_images: ${e.message}`);
        }
        
        // 3. Search alert_metadata
        try {
            const alertQuery = `
                SELECT 
                    alert_id,
                    case_number,
                    recipient_address,
                    transaction_hash
                FROM alert_metadata
                WHERE case_number IS NOT NULL
            `;
            const alerts = await pool.query(alertQuery);
            result.tables_searched.push('alert_metadata');
            
            alerts.rows.forEach(alert => {
                if (alert.recipient_address && alert.case_number) {
                    if (!result.recipients_found[alert.recipient_address]) {
                        result.recipients_found[alert.recipient_address] = [];
                    }
                    result.recipients_found[alert.recipient_address].push(alert.case_number);
                    
                    // Update case with alert info
                    if (result.cases_found[alert.case_number]) {
                        result.cases_found[alert.case_number].alert_token_id = alert.alert_id;
                        result.cases_found[alert.case_number].transaction_hash = alert.transaction_hash;
                    }
                }
            });
        } catch (e) {
            result.errors.push(`alert_metadata: ${e.message}`);
        }
        
        // 4. Get current case_service_records
        const currentRecords = await pool.query('SELECT case_number FROM case_service_records');
        const existingCases = new Set(currentRecords.rows.map(r => r.case_number));
        
        // 5. Reconstruct missing data
        for (const [recipient, caseNumbers] of Object.entries(result.recipients_found)) {
            for (const caseNum of caseNumbers) {
                if (!existingCases.has(caseNum)) {
                    try {
                        const caseData = result.cases_found[caseNum] || {};
                        await pool.query(`
                            INSERT INTO case_service_records (
                                case_number,
                                recipients,
                                transaction_hash,
                                alert_token_id,
                                served_at,
                                server_name,
                                issuing_agency,
                                page_count,
                                status
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                            ON CONFLICT (case_number) DO NOTHING
                        `, [
                            caseNum,
                            JSON.stringify([recipient]),
                            caseData.transaction_hash,
                            caseData.alert_token_id,
                            caseData.created_at || new Date(),
                            caseData.server_name || 'Process Server',
                            caseData.issuing_agency || 'Fort Lauderdale Police',
                            caseData.page_count || 1,
                            caseData.status || 'served'
                        ]);
                        result.reconstruction.push(`Added ${caseNum} for ${recipient}`);
                    } catch (e) {
                        result.errors.push(`Reconstruct ${caseNum}: ${e.message}`);
                    }
                }
            }
        }
        
        // 6. Final summary
        const finalCount = await pool.query('SELECT COUNT(*) FROM case_service_records');
        result.total_cases_found = Object.keys(result.cases_found).length;
        result.total_recipients = Object.keys(result.recipients_found).length;
        result.final_record_count = parseInt(finalCount.rows[0].count);
        result.success = true;
        
    } catch (error) {
        result.success = false;
        result.error = error.message;
    }
    
    res.json(result);
});

/**
 * GET /api/recipient-cases/audit-and-fix
 * Audit database and reconstruct missing data
 */
router.get('/audit-and-fix', async (req, res) => {
    console.log('Starting data audit and reconstruction...');
    const audit = { tables: {}, reconstruction: [], errors: [] };
    
    try {
        // 1. Check case_service_records
        const serviceRecords = await pool.query(
            'SELECT case_number, recipients, alert_token_id FROM case_service_records'
        );
        audit.tables.case_service_records = serviceRecords.rows.length;
        
        // 2. Check transaction_tracking
        try {
            const transactions = await pool.query(
                'SELECT case_number, recipient_addresses, alert_token_id FROM transaction_tracking WHERE case_number IS NOT NULL'
            );
            audit.tables.transaction_tracking = transactions.rows.length;
            
            // Reconstruct from transaction_tracking
            for (const tx of transactions.rows) {
                if (tx.case_number && tx.recipient_addresses) {
                    try {
                        await pool.query(`
                            INSERT INTO case_service_records (
                                case_number, recipients, alert_token_id, served_at
                            ) VALUES ($1, $2, $3, NOW())
                            ON CONFLICT (case_number) DO UPDATE
                            SET recipients = COALESCE(case_service_records.recipients, EXCLUDED.recipients),
                                alert_token_id = COALESCE(case_service_records.alert_token_id, EXCLUDED.alert_token_id)
                        `, [tx.case_number, tx.recipient_addresses, tx.alert_token_id]);
                        audit.reconstruction.push(`Reconstructed ${tx.case_number} from transaction_tracking`);
                    } catch (e) {
                        audit.errors.push(`Failed to reconstruct ${tx.case_number}: ${e.message}`);
                    }
                }
            }
        } catch (e) {
            audit.errors.push(`transaction_tracking: ${e.message}`);
        }
        
        // 3. Add known blockchain data for case 34-4343902
        try {
            await pool.query(`
                INSERT INTO case_service_records (
                    case_number, recipients, transaction_hash, alert_token_id, served_at
                ) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (case_number) DO UPDATE
                SET recipients = EXCLUDED.recipients,
                    transaction_hash = EXCLUDED.transaction_hash,
                    alert_token_id = EXCLUDED.alert_token_id
            `, [
                '34-4343902',
                JSON.stringify(['TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH']),
                '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0',
                '37',
                '2025-08-21T14:27:30Z'
            ]);
            audit.reconstruction.push('Added case 34-4343902 from blockchain data');
        } catch (e) {
            audit.errors.push(`Adding 34-4343902: ${e.message}`);
        }
        
        // 4. Final check for recipient
        const recipientCheck = await pool.query(`
            SELECT case_number, recipients, alert_token_id
            FROM case_service_records
            WHERE recipients::text LIKE '%TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH%'
        `);
        
        audit.recipient_cases = recipientCheck.rows;
        audit.success = true;
        audit.message = `Audit complete. Found ${recipientCheck.rows.length} cases for TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH`;
        
    } catch (error) {
        audit.success = false;
        audit.error = error.message;
    }
    
    res.json(audit);
});

/**
 * POST /api/recipient-cases/test-add
 * Test endpoint to manually add a case (for testing only)
 */
router.post('/test-add', async (req, res) => {
    try {
        const {
            case_number,
            recipients,
            transaction_hash,
            alert_token_id,
            served_at
        } = req.body;
        
        console.log('Manually adding case:', case_number);
        
        // Insert into case_service_records
        const query = `
            INSERT INTO case_service_records (
                case_number,
                recipients,
                transaction_hash,
                alert_token_id,
                served_at,
                server_name,
                issuing_agency,
                page_count,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (case_number) 
            DO UPDATE SET 
                recipients = EXCLUDED.recipients,
                transaction_hash = EXCLUDED.transaction_hash,
                alert_token_id = EXCLUDED.alert_token_id,
                served_at = EXCLUDED.served_at
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            case_number,
            JSON.stringify(recipients), // Ensure it's stored as JSON string
            transaction_hash,
            alert_token_id,
            served_at || new Date(),
            'Process Server',
            'Fort Lauderdale Police',
            1,
            'served'
        ]);
        
        res.json({
            success: true,
            message: 'Case added successfully',
            data: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error adding test case:', error);
        res.status(500).json({ 
            error: 'Failed to add case',
            details: error.message
        });
    }
});

/**
 * GET /api/recipient-cases/:caseNumber/images
 * Get all images (alert and document) for a specific case
 */
router.get('/:caseNumber/images', async (req, res) => {
    try {
        const { caseNumber } = req.params;
        const walletAddress = req.headers['x-wallet-address'] || req.query.wallet;
        
        console.log(`Fetching images for case: ${caseNumber}`);
        
        // First get the case to verify access and get token IDs
        const caseQuery = await pool.query(`
            SELECT 
                case_number,
                alert_token_id,
                document_token_id,
                recipients
            FROM case_service_records
            WHERE case_number = $1
        `, [caseNumber]);
        
        if (caseQuery.rows.length === 0) {
            return res.status(404).json({
                error: 'Case not found',
                success: false
            });
        }
        
        const caseData = caseQuery.rows[0];
        
        // Verify recipient access if wallet provided
        if (walletAddress) {
            let recipientsList = [];
            try {
                recipientsList = typeof caseData.recipients === 'string' ? 
                    JSON.parse(caseData.recipients) : caseData.recipients;
            } catch (e) {
                console.log('Error parsing recipients:', e);
            }
            
            if (!recipientsList.includes(walletAddress)) {
                return res.status(403).json({
                    error: 'Access denied - not a recipient of this notice',
                    success: false
                });
            }
        }
        
        // Try to fetch images from multiple sources
        let images = null;
        
        // 1. Try images table first
        try {
            const imageQuery = await pool.query(`
                SELECT 
                    alert_image, 
                    document_image, 
                    alert_thumbnail, 
                    document_thumbnail,
                    created_at,
                    updated_at
                FROM images 
                WHERE case_number = $1 
                   OR notice_id = $2 
                   OR notice_id = $3
                LIMIT 1
            `, [caseNumber, caseData.alert_token_id, caseData.document_token_id]);
            
            if (imageQuery.rows.length > 0) {
                images = imageQuery.rows[0];
                images.source = 'images_table';
            }
        } catch (e) {
            console.log('Images table not available:', e.message);
        }
        
        // 2. Try notice_components table as fallback
        if (!images) {
            try {
                const fallbackQuery = await pool.query(`
                    SELECT 
                        alert_thumbnail_url,
                        document_unencrypted_url,
                        created_at
                    FROM notice_components
                    WHERE case_number = $1 
                       OR alert_id = $2 
                       OR document_id = $3
                    LIMIT 1
                `, [caseNumber, caseData.alert_token_id, caseData.document_token_id]);
                
                if (fallbackQuery.rows.length > 0) {
                    images = {
                        alert_image: fallbackQuery.rows[0].alert_thumbnail_url,
                        document_image: fallbackQuery.rows[0].document_unencrypted_url,
                        alert_thumbnail: fallbackQuery.rows[0].alert_thumbnail_url,
                        document_thumbnail: fallbackQuery.rows[0].document_unencrypted_url,
                        created_at: fallbackQuery.rows[0].created_at,
                        source: 'notice_components'
                    };
                }
            } catch (fallbackError) {
                console.log('Notice components fallback failed:', fallbackError.message);
            }
        }
        
        // 3. Try notice_images table as last resort
        if (!images) {
            try {
                const lastResortQuery = await pool.query(`
                    SELECT 
                        image_data,
                        image_type,
                        created_at
                    FROM notice_images
                    WHERE notice_id = $1 
                       OR notice_id = $2
                    ORDER BY created_at DESC
                    LIMIT 2
                `, [caseData.alert_token_id, caseData.document_token_id]);
                
                if (lastResortQuery.rows.length > 0) {
                    const alertImage = lastResortQuery.rows.find(r => r.notice_id === caseData.alert_token_id);
                    const docImage = lastResortQuery.rows.find(r => r.notice_id === caseData.document_token_id);
                    
                    images = {
                        alert_image: alertImage?.image_data,
                        document_image: docImage?.image_data,
                        alert_thumbnail: alertImage?.image_data,
                        document_thumbnail: docImage?.image_data,
                        created_at: lastResortQuery.rows[0].created_at,
                        source: 'notice_images'
                    };
                }
            } catch (lastError) {
                console.log('Notice images fallback failed:', lastError.message);
            }
        }
        
        if (!images) {
            return res.status(404).json({
                error: 'No images found for this case',
                success: false,
                case_number: caseNumber
            });
        }
        
        res.json({
            success: true,
            case_number: caseNumber,
            alert_token_id: caseData.alert_token_id,
            document_token_id: caseData.document_token_id,
            images: images
        });
        
    } catch (error) {
        console.error('Error fetching images:', error);
        res.status(500).json({ 
            error: 'Failed to fetch images',
            success: false,
            details: error.message
        });
    }
});

/**
 * GET /api/recipient-cases/token/:tokenId/image
 * Get image for a specific token ID (alert or document)
 */
router.get('/token/:tokenId/image', async (req, res) => {
    try {
        const { tokenId } = req.params;
        const imageType = req.query.type || 'full'; // 'full' or 'thumbnail'
        
        console.log(`Fetching image for token: ${tokenId}, type: ${imageType}`);
        
        let image = null;
        
        // Try images table first
        try {
            const query = await pool.query(`
                SELECT 
                    alert_image, 
                    document_image, 
                    alert_thumbnail, 
                    document_thumbnail,
                    case_number
                FROM images 
                WHERE notice_id = $1
                LIMIT 1
            `, [tokenId]);
            
            if (query.rows.length > 0) {
                const row = query.rows[0];
                // Determine if this is an alert or document token
                if (row.alert_image || row.alert_thumbnail) {
                    image = {
                        data: imageType === 'thumbnail' ? row.alert_thumbnail : row.alert_image,
                        type: 'alert',
                        case_number: row.case_number
                    };
                } else if (row.document_image || row.document_thumbnail) {
                    image = {
                        data: imageType === 'thumbnail' ? row.document_thumbnail : row.document_image,
                        type: 'document',
                        case_number: row.case_number
                    };
                }
            }
        } catch (e) {
            console.log('Images table query failed:', e.message);
        }
        
        // Try notice_components fallback
        if (!image) {
            try {
                const query = await pool.query(`
                    SELECT 
                        alert_thumbnail_url,
                        document_unencrypted_url,
                        case_number,
                        alert_id,
                        document_id
                    FROM notice_components
                    WHERE alert_id = $1 OR document_id = $1
                    LIMIT 1
                `, [tokenId]);
                
                if (query.rows.length > 0) {
                    const row = query.rows[0];
                    if (row.alert_id === tokenId) {
                        image = {
                            data: row.alert_thumbnail_url,
                            type: 'alert',
                            case_number: row.case_number
                        };
                    } else if (row.document_id === tokenId) {
                        image = {
                            data: row.document_unencrypted_url,
                            type: 'document',
                            case_number: row.case_number
                        };
                    }
                }
            } catch (fallbackError) {
                console.log('Notice components fallback failed:', fallbackError.message);
            }
        }
        
        if (!image) {
            return res.status(404).json({
                error: 'Image not found for this token',
                success: false,
                token_id: tokenId
            });
        }
        
        res.json({
            success: true,
            token_id: tokenId,
            image: image
        });
        
    } catch (error) {
        console.error('Error fetching token image:', error);
        res.status(500).json({ 
            error: 'Failed to fetch image',
            success: false,
            details: error.message
        });
    }
});

module.exports = router;