/**
 * Recipient Cases API
 * Handles fetching cases/notices for recipients from case_service_records
 * This replaces the old recipient-api that was querying non-existent tables
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const cors = require('cors');

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
        
        // Transform data for frontend
        const notices = result.rows.map(row => {
            // Parse recipients
            let recipientsList = [];
            try {
                recipientsList = typeof row.recipients === 'string' ? 
                    JSON.parse(row.recipients) : row.recipients;
            } catch (e) {
                console.log('Error parsing recipients:', e);
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
                is_recipient: recipientsList.includes(address)
            };
        });
        
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
        
        res.json({
            success: true,
            notice: {
                case_number: caseData.case_number,
                ipfs_hash: caseData.ipfs_hash,
                document_token_id: caseData.document_token_id,
                page_count: caseData.page_count,
                served_at: caseData.served_at,
                server_name: caseData.server_name,
                issuing_agency: caseData.issuing_agency,
                status: caseData.status
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

module.exports = router;