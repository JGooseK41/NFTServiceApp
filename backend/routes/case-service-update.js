/**
 * Case Service Update Route
 * Handles updating cases with complete service data including NFT token IDs, 
 * transaction hashes, IPFS data, and alert images
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * PUT /api/cases/:caseNumber/service-complete
 * Update case with complete service data after NFTs are minted
 */
router.put('/cases/:caseNumber/service-complete', async (req, res) => {
    const client = await pool.connect();
    
    try {
        // Trim case number to prevent issues with trailing whitespace
        const caseNumber = (req.params.caseNumber || '').trim();
        const {
            transactionHash,
            alertTokenId,
            documentTokenId,
            alertImage,        // Base64 image data
            ipfsHash,         // IPFS hash for encrypted document
            encryptionKey,    // Key to decrypt IPFS document
            recipients,       // Array of recipient addresses
            agency,
            noticeType,
            pageCount,
            servedAt,
            serverAddress,
            metadata = {}
        } = req.body;

        if (!caseNumber) {
            return res.status(400).json({
                success: false,
                error: 'Case number is required'
            });
        }

        console.log(`Updating case ${caseNumber} with service data`);
        console.log('Alert Token ID:', alertTokenId);
        console.log('Document Token ID:', documentTokenId);
        console.log('Transaction Hash:', transactionHash);
        console.log('IPFS Hash:', ipfsHash);
        console.log('Has Alert Image:', !!alertImage);

        await client.query('BEGIN');

        // First, check if we have a cases table entry
        // Use case_number (text) or id::text for comparison since caseNumber is a string
        const caseCheck = await client.query(
            'SELECT id FROM cases WHERE case_number = $1 OR id::text = $1',
            [caseNumber]
        );

        let caseId;
        
        if (caseCheck.rows.length === 0) {
            // Create case entry if it doesn't exist
            const insertResult = await client.query(`
                INSERT INTO cases (
                    case_number,
                    server_address,
                    status,
                    created_at,
                    updated_at,
                    metadata
                ) VALUES ($1, $2, $3, NOW(), NOW(), $4)
                RETURNING id
            `, [
                caseNumber,
                serverAddress || req.headers['x-server-address'],
                'served',
                JSON.stringify({
                    agency,
                    noticeType,
                    pageCount,
                    recipients,
                    ...metadata
                })
            ]);
            caseId = insertResult.rows[0].id;
        } else {
            caseId = caseCheck.rows[0].id;
            
            // Update existing case - merge new metadata with existing
            await client.query(`
                UPDATE cases
                SET
                    status = 'served',
                    updated_at = NOW(),
                    metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
                WHERE id = $2
            `, [
                JSON.stringify({
                    agency,
                    noticeType,
                    pageCount,
                    recipients,
                    transactionHash,
                    alertTokenId,
                    documentTokenId,
                    ipfsHash,
                    encryptionKey,
                    servedAt: servedAt || new Date().toISOString(),
                    ...metadata
                }),
                caseId
            ]);
        }

        // Store alert image if provided
        if (alertImage) {
            // Try to store in notice_images table (may not exist in all deployments)
            try {
                await client.query(`
                    INSERT INTO notice_images (
                        case_number,
                        alert_image,
                        created_at
                    ) VALUES ($1, $2, NOW())
                    ON CONFLICT (case_number)
                    DO UPDATE SET
                        alert_image = EXCLUDED.alert_image,
                        created_at = NOW()
                `, [caseNumber, alertImage]);
            } catch (imageError) {
                // Table might not exist - store in cases metadata instead
                console.log('notice_images table not available, storing in metadata');
                await client.query(`
                    UPDATE cases
                    SET alert_preview = $1,
                        updated_at = NOW()
                    WHERE case_number = $2 OR id::text = $2
                `, [alertImage, caseNumber]);
            }
        }

        // Store service details in a dedicated table
        await client.query(`
            INSERT INTO case_service_records (
                case_id,
                case_number,
                transaction_hash,
                alert_token_id,
                document_token_id,
                ipfs_hash,
                encryption_key,
                recipients,
                page_count,
                served_at,
                server_address,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            ON CONFLICT (case_number) 
            DO UPDATE SET
                transaction_hash = EXCLUDED.transaction_hash,
                alert_token_id = EXCLUDED.alert_token_id,
                document_token_id = EXCLUDED.document_token_id,
                ipfs_hash = EXCLUDED.ipfs_hash,
                encryption_key = EXCLUDED.encryption_key,
                recipients = EXCLUDED.recipients,
                page_count = EXCLUDED.page_count,
                served_at = EXCLUDED.served_at,
                updated_at = NOW()
        `, [
            caseId,
            caseNumber,
            transactionHash,
            alertTokenId,
            documentTokenId,
            ipfsHash,
            encryptionKey,
            JSON.stringify(recipients || []),
            pageCount || 1,
            servedAt || new Date().toISOString(),
            serverAddress || req.headers['x-server-address']
        ]);

        // Update notice_components if they exist
        if (alertTokenId || documentTokenId) {
            await client.query(`
                UPDATE notice_components
                SET 
                    alert_token_id = COALESCE($1, alert_token_id),
                    document_token_id = COALESCE($2, document_token_id),
                    transaction_hash = COALESCE($3, transaction_hash),
                    status = 'served',
                    updated_at = NOW()
                WHERE case_number = $4
            `, [alertTokenId, documentTokenId, transactionHash, caseNumber]);
        }

        await client.query('COMMIT');

        console.log(`✅ Case ${caseNumber} updated with complete service data`);

        res.json({
            success: true,
            message: 'Case updated with service data',
            caseNumber,
            data: {
                caseId,
                transactionHash,
                alertTokenId,
                documentTokenId,
                ipfsHash,
                hasAlertImage: !!alertImage
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating case service data:', error);
        console.error('Error details:', {
            code: error.code,
            detail: error.detail,
            table: error.table,
            column: error.column,
            constraint: error.constraint
        });
        res.status(500).json({
            success: false,
            error: 'Failed to update case service data',
            message: error.message,
            detail: error.detail || null
        });
    } finally {
        client.release();
    }
});

/**
 * GET /api/cases/:caseNumber/service-data
 * Retrieve complete service data for a case
 */
router.get('/cases/:caseNumber/service-data', async (req, res) => {
    try {
        // Trim case number to prevent issues with trailing whitespace
        const caseNumber = (req.params.caseNumber || '').trim();

        if (!caseNumber) {
            return res.status(400).json({
                success: false,
                error: 'Case number is required'
            });
        }

        console.log(`Fetching service data for case ${caseNumber}`);

        // Get case data with all service information
        const result = await pool.query(`
            SELECT 
                c.id,
                c.case_number,
                c.status,
                c.metadata,
                c.server_address,
                c.created_at,
                c.updated_at,
                csr.transaction_hash,
                csr.alert_token_id,
                csr.document_token_id,
                csr.ipfs_hash,
                csr.encryption_key,
                csr.recipients,
                csr.page_count,
                csr.served_at,
                ni.alert_image,
                ni.document_preview
            FROM cases c
            LEFT JOIN case_service_records csr ON c.case_number = csr.case_number
            LEFT JOIN notice_images ni ON c.case_number = ni.case_number
            WHERE c.case_number = $1 OR c.id = $1
        `, [caseNumber]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Case not found'
            });
        }

        const caseData = result.rows[0];
        
        // Parse JSON fields
        const metadata = typeof caseData.metadata === 'string' 
            ? JSON.parse(caseData.metadata) 
            : caseData.metadata;
            
        const recipients = typeof caseData.recipients === 'string'
            ? JSON.parse(caseData.recipients)
            : caseData.recipients;

        res.json({
            success: true,
            case: {
                id: caseData.id,
                caseNumber: caseData.case_number,
                status: caseData.status,
                serverAddress: caseData.server_address,
                transactionHash: caseData.transaction_hash,
                alertTokenId: caseData.alert_token_id,
                documentTokenId: caseData.document_token_id,
                ipfsHash: caseData.ipfs_hash,
                ipfsDocument: caseData.ipfs_hash, // Alias
                encryptionKey: caseData.encryption_key,
                encryption_key: caseData.encryption_key, // Alias
                recipients: recipients,
                pageCount: caseData.page_count,
                page_count: caseData.page_count, // Alias
                servedAt: caseData.served_at,
                alertImage: caseData.alert_image,
                alertPreview: caseData.alert_image, // Alias
                alert_preview: caseData.alert_image, // Alias
                documentPreview: caseData.document_preview,
                agency: metadata?.agency,
                noticeType: metadata?.noticeType,
                metadata: metadata,
                createdAt: caseData.created_at,
                updatedAt: caseData.updated_at
            }
        });

    } catch (error) {
        console.error('Error fetching case service data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch case service data',
            message: error.message
        });
    }
});

/**
 * Create necessary tables if they don't exist
 */
async function createTables() {
    try {
        // First check if table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'case_service_records'
            )
        `);
        
        if (!tableCheck.rows[0].exists) {
            // Create case_service_records table
            await pool.query(`
                CREATE TABLE case_service_records (
                    id SERIAL PRIMARY KEY,
                    case_id INTEGER,
                    case_number VARCHAR(255) UNIQUE NOT NULL,
                    transaction_hash VARCHAR(255),
                    alert_token_id VARCHAR(255),
                    document_token_id VARCHAR(255),
                    ipfs_hash VARCHAR(255),
                    encryption_key TEXT,
                    recipients JSONB,
                    page_count INTEGER DEFAULT 1,
                    served_at TIMESTAMP,
                    server_address VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            console.log('✅ Created case_service_records table');
        } else {
            console.log('✅ Case service records table already exists');
        }

        // Table exists - check for missing columns and add them
        console.log('Checking for missing columns in case_service_records...');

        // Check if case_number column exists
        const columnCheck = await pool.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'case_service_records' AND column_name = 'case_number'
        `);

        if (columnCheck.rows.length === 0) {
            console.log('Adding missing case_number column...');
            await pool.query(`ALTER TABLE case_service_records ADD COLUMN case_number VARCHAR(255)`);
            await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS case_service_records_case_number_key ON case_service_records(case_number)`);
            console.log('✅ Added case_number column');
        }

    } catch (error) {
        console.error('Error creating/updating tables:', error);
        // Try without checking - just ensure it exists
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS case_service_records (
                    id SERIAL PRIMARY KEY,
                    case_id INTEGER,
                    case_number VARCHAR(255),
                    transaction_hash VARCHAR(255),
                    alert_token_id VARCHAR(255),
                    document_token_id VARCHAR(255),
                    ipfs_hash VARCHAR(255),
                    encryption_key TEXT,
                    recipients JSONB,
                    page_count INTEGER DEFAULT 1,
                    served_at TIMESTAMP,
                    server_address VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // Try to add missing columns (will fail silently if they exist)
            await pool.query(`ALTER TABLE case_service_records ADD COLUMN IF NOT EXISTS case_number VARCHAR(255)`).catch(() => {});

            // Try to add unique constraint if it doesn't exist
            await pool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS case_service_records_case_number_key
                ON case_service_records(case_number)
            `).catch(() => {});
            
        } catch (fallbackError) {
            console.error('Fallback table creation also failed:', fallbackError);
        }
    }
}

// Initialize tables on startup
createTables();

/**
 * GET /api/cases/check-schema
 * Check the actual database schema for BOTH tables
 */
router.get('/cases/check-schema', async (req, res) => {
    const results = {};
    try {
        // Check case_service_records
        try {
            const csrTest = await pool.query(`SELECT case_number FROM case_service_records LIMIT 1`);
            results.case_service_records = { works: true, rows: csrTest.rowCount };
        } catch (e) {
            results.case_service_records = { works: false, error: e.message };
        }

        // Check cases table
        try {
            const casesTest = await pool.query(`SELECT case_number FROM cases LIMIT 1`);
            results.cases = { works: true, rows: casesTest.rowCount };
        } catch (e) {
            results.cases = { works: false, error: e.message };
        }

        // Get column lists for both tables
        const csrCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'case_service_records'`);
        const casesCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'cases'`);

        results.case_service_records_columns = csrCols.rows.map(r => r.column_name);
        results.cases_columns = casesCols.rows.map(r => r.column_name);

        res.json({
            success: true,
            results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            results
        });
    }
});

/**
 * POST /api/cases/run-migration
 * Manually trigger database migration (for when auto-deploy doesn't restart server)
 */
router.post('/cases/run-migration', async (req, res) => {
    const results = [];
    try {
        console.log('Manual migration triggered...');

        // First, check if table exists at all
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'case_service_records'
            )
        `);

        if (!tableCheck.rows[0].exists) {
            // Create the table from scratch
            console.log('Creating case_service_records table...');
            await pool.query(`
                CREATE TABLE case_service_records (
                    id SERIAL PRIMARY KEY,
                    case_id INTEGER,
                    case_number VARCHAR(255),
                    transaction_hash VARCHAR(255),
                    alert_token_id VARCHAR(255),
                    document_token_id VARCHAR(255),
                    ipfs_hash VARCHAR(255),
                    encryption_key TEXT,
                    recipients JSONB,
                    page_count INTEGER DEFAULT 1,
                    served_at TIMESTAMP,
                    server_address VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            results.push('Created case_service_records table');
        } else {
            // Table exists - check for missing columns
            const columns = await pool.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'case_service_records'
            `);
            const existingColumns = columns.rows.map(r => r.column_name);
            results.push(`Existing columns: ${existingColumns.join(', ')}`);

            // Add missing columns
            const requiredColumns = [
                { name: 'case_number', type: 'VARCHAR(255)' },
                { name: 'case_id', type: 'INTEGER' },
                { name: 'transaction_hash', type: 'VARCHAR(255)' },
                { name: 'alert_token_id', type: 'VARCHAR(255)' },
                { name: 'document_token_id', type: 'VARCHAR(255)' },
                { name: 'ipfs_hash', type: 'VARCHAR(255)' },
                { name: 'encryption_key', type: 'TEXT' },
                { name: 'recipients', type: 'JSONB' },
                { name: 'page_count', type: 'INTEGER DEFAULT 1' },
                { name: 'served_at', type: 'TIMESTAMP' },
                { name: 'server_address', type: 'VARCHAR(255)' }
            ];

            for (const col of requiredColumns) {
                if (!existingColumns.includes(col.name)) {
                    console.log(`Adding missing column: ${col.name}`);
                    await pool.query(`ALTER TABLE case_service_records ADD COLUMN ${col.name} ${col.type}`);
                    results.push(`Added column: ${col.name}`);
                }
            }
        }

        // Try to create unique index
        await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS case_service_records_case_number_key
            ON case_service_records(case_number)
        `).catch(e => results.push(`Index note: ${e.message}`));

        res.json({
            success: true,
            message: 'Migration completed',
            results
        });
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            results
        });
    }
});

module.exports = router;