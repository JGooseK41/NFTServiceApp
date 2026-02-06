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
            chain,            // Chain identifier (e.g., 'tron-nile', 'eth-mainnet')
            explorerUrl,      // Full explorer URL for the transaction
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
        console.log('Chain:', chain || 'not specified');
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
                    chain,
                    created_at,
                    updated_at,
                    metadata
                ) VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)
                RETURNING id
            `, [
                caseNumber,
                serverAddress || req.headers['x-server-address'],
                'served',
                chain || 'tron-mainnet',
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

        // Store service details in a dedicated table (case_number is the key, no need for case_id)
        const insertResult = await client.query(`
            INSERT INTO case_service_records (
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
                chain,
                explorer_url,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
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
                chain = COALESCE(EXCLUDED.chain, case_service_records.chain),
                explorer_url = COALESCE(EXCLUDED.explorer_url, case_service_records.explorer_url),
                updated_at = NOW()
            RETURNING id, case_number
        `, [
            caseNumber,
            transactionHash,
            alertTokenId,
            documentTokenId,
            ipfsHash,
            encryptionKey,
            JSON.stringify(recipients || []),
            pageCount || 1,
            servedAt || new Date().toISOString(),
            serverAddress || req.headers['x-server-address'],
            chain || 'tron-mainnet',
            explorerUrl || null
        ]);
        console.log('INSERT result:', insertResult.rows);

        // Update notice_components if they exist (optional - may not exist in all deployments)
        if (alertTokenId || documentTokenId) {
            try {
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
            } catch (e) {
                // Table may not exist or have these columns - that's OK
                console.log('Note: notice_components update skipped:', e.message);
            }
        }

        await client.query('COMMIT');

        // Verify the insert worked
        const verifyResult = await pool.query(
            'SELECT case_number, transaction_hash FROM case_service_records WHERE case_number = $1',
            [caseNumber]
        );
        console.log(`Verification query found ${verifyResult.rows.length} rows for case ${caseNumber}`);
        if (verifyResult.rows.length === 0) {
            console.error('WARNING: INSERT succeeded but record not found!');
        }

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
                csr.chain,
                csr.explorer_url,
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
                chain: caseData.chain || 'tron-mainnet',
                explorerUrl: caseData.explorer_url,
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
 * GET /api/cases/query-record/:caseNumber
 * Query a specific record from case_service_records
 */
router.get('/cases/query-record/:caseNumber', async (req, res) => {
    try {
        const { caseNumber } = req.params;
        const result = await pool.query(
            `SELECT * FROM case_service_records WHERE case_number = $1`,
            [caseNumber]
        );
        res.json({
            success: true,
            found: result.rows.length > 0,
            record: result.rows[0] || null,
            allRecordsCount: (await pool.query('SELECT COUNT(*) FROM case_service_records')).rows[0].count
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

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
                { name: 'server_address', type: 'VARCHAR(255)' },
                { name: 'chain', type: "VARCHAR(50) DEFAULT 'tron-mainnet'" },
                { name: 'explorer_url', type: 'TEXT' }
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
        try {
            await pool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS case_service_records_case_number_key
                ON case_service_records(case_number)
            `);
            results.push('Unique index on case_number ensured');
        } catch (e) {
            results.push(`Index error: ${e.message}`);
        }

        // Check if index exists
        const indexCheck = await pool.query(`
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'case_service_records' AND indexname LIKE '%case_number%'
        `);
        results.push(`Indexes found: ${indexCheck.rows.map(r => r.indexname).join(', ') || 'none'}`);

        // Also verify ON CONFLICT will work by testing
        try {
            await pool.query(`
                INSERT INTO case_service_records (case_number, transaction_hash, recipients, served_at)
                VALUES ('__test_migration__', 'test_tx', '[]', NOW())
                ON CONFLICT (case_number)
                DO UPDATE SET transaction_hash = EXCLUDED.transaction_hash
            `);
            // Clean up test
            await pool.query(`DELETE FROM case_service_records WHERE case_number = '__test_migration__'`);
            results.push('ON CONFLICT test: PASSED');
        } catch (e) {
            results.push(`ON CONFLICT test FAILED: ${e.message}`);
        }

        // ALSO check and update the 'cases' table
        const casesColumns = await pool.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'cases'
        `);
        const existingCasesColumns = casesColumns.rows.map(r => r.column_name);
        results.push(`Cases table columns: ${existingCasesColumns.join(', ')}`);

        if (!existingCasesColumns.includes('case_number')) {
            console.log('Adding case_number column to cases table...');
            await pool.query(`ALTER TABLE cases ADD COLUMN case_number VARCHAR(255)`);
            results.push('Added case_number to cases table');
        }

        // Add chain column to cases table for multi-chain support
        if (!existingCasesColumns.includes('chain')) {
            console.log('Adding chain column to cases table...');
            await pool.query(`ALTER TABLE cases ADD COLUMN chain VARCHAR(50) DEFAULT 'tron-mainnet'`);
            results.push('Added chain to cases table');
        }

        // Check the type of id column
        const idTypeCheck = await pool.query(`
            SELECT data_type FROM information_schema.columns
            WHERE table_name = 'cases' AND column_name = 'id'
        `);
        const idType = idTypeCheck.rows[0]?.data_type;
        results.push(`cases.id column type: ${idType}`);

        // If id is text, we need to generate UUID or text IDs
        // If id is integer, set up auto-increment
        if (idType === 'integer') {
            try {
                await pool.query(`CREATE SEQUENCE IF NOT EXISTS cases_id_seq`);
                const maxId = await pool.query(`SELECT COALESCE(MAX(id), 0) as max_id FROM cases`);
                const startVal = (maxId.rows[0].max_id || 0) + 1;
                await pool.query(`ALTER SEQUENCE cases_id_seq RESTART WITH ${startVal}`);
                await pool.query(`ALTER TABLE cases ALTER COLUMN id SET DEFAULT nextval('cases_id_seq')`);
                results.push(`Set up auto-increment on cases.id starting at ${startVal}`);
            } catch (e) {
                results.push(`Note: Could not set up auto-increment: ${e.message}`);
            }
        } else if (idType === 'text' || idType === 'character varying') {
            // For text IDs, set a default using gen_random_uuid() or similar
            try {
                await pool.query(`ALTER TABLE cases ALTER COLUMN id SET DEFAULT gen_random_uuid()::text`);
                results.push('Set up UUID default on text id column');
            } catch (e) {
                results.push(`Note: Could not set UUID default: ${e.message}`);
            }
        }

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

/**
 * POST /api/cases/sync-from-blockchain
 * Retroactively sync past serves from blockchain data
 * Queries NFT transfer events and populates case_service_records
 */
router.post('/cases/sync-from-blockchain', async (req, res) => {
    const TronWeb = require('tronweb');
    const results = [];

    try {
        const { serverAddress, contractAddress, network = 'nile' } = req.body;

        if (!serverAddress) {
            return res.status(400).json({
                success: false,
                error: 'serverAddress is required'
            });
        }

        // Configure TronWeb for the appropriate network
        const fullHost = network === 'nile'
            ? 'https://nile.trongrid.io'
            : 'https://api.trongrid.io';

        const defaultContract = network === 'nile'
            ? 'TUM1cojG7vdtph81H2Dy2VyRqoa1v9FywW'
            : 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

        const contract = contractAddress || defaultContract;

        console.log(`Syncing blockchain data for server: ${serverAddress}`);
        console.log(`Network: ${network}, Contract: ${contract}`);
        results.push(`Syncing from ${network} network, contract ${contract}`);

        const tronWeb = new TronWeb({
            fullHost: fullHost,
            headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY || '' }
        });

        // Get Transfer events from the contract
        // This gets all NFT transfers (mints are transfers from address 0)
        let events = [];
        try {
            // Query events from the contract
            const eventResult = await tronWeb.getEventResult(contract, {
                eventName: 'Transfer',
                size: 200,
                onlyConfirmed: true
            });
            events = eventResult || [];
            results.push(`Found ${events.length} Transfer events`);
        } catch (e) {
            results.push(`Event query error: ${e.message}`);
            // Try alternative method - get transactions for the server address
        }

        // Filter for mints (from = 0x0) sent by this server
        const mints = [];
        for (const event of events) {
            try {
                const from = event.result?.from || event.result?.[0];
                const to = event.result?.to || event.result?.[1];
                const tokenId = event.result?.tokenId || event.result?.[2];

                // Check if this is a mint (from zero address)
                const isFromZero = from === '0' || from === '0x0' ||
                    from === '410000000000000000000000000000000000000000' ||
                    from === 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'; // Zero address in base58

                if (isFromZero && to) {
                    // Convert to base58 if needed
                    let recipientAddress = to;
                    if (to.startsWith('41') && to.length === 42) {
                        recipientAddress = tronWeb.address.fromHex(to);
                    }

                    mints.push({
                        recipient: recipientAddress,
                        tokenId: tokenId?.toString(),
                        transactionHash: event.transaction,
                        timestamp: event.timestamp,
                        blockNumber: event.block
                    });
                }
            } catch (e) {
                // Skip malformed events
            }
        }

        results.push(`Found ${mints.length} mint events`);

        // Now try to match mints with existing cases and insert records
        let synced = 0;
        let skipped = 0;

        for (const mint of mints) {
            try {
                // Check if we already have this transaction in case_service_records
                const existing = await pool.query(
                    'SELECT id FROM case_service_records WHERE transaction_hash = $1',
                    [mint.transactionHash]
                );

                if (existing.rows.length > 0) {
                    skipped++;
                    continue;
                }

                // Try to find a matching case by looking at cases table
                // Check if there's a case that was created around this time
                const caseMatch = await pool.query(`
                    SELECT case_number, server_address, metadata
                    FROM cases
                    WHERE server_address = $1
                    ORDER BY created_at DESC
                    LIMIT 1
                `, [serverAddress]);

                if (caseMatch.rows.length > 0) {
                    const caseData = caseMatch.rows[0];

                    // Insert into case_service_records
                    await pool.query(`
                        INSERT INTO case_service_records (
                            case_number,
                            transaction_hash,
                            alert_token_id,
                            recipients,
                            served_at,
                            server_address,
                            chain,
                            created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                        ON CONFLICT (case_number)
                        DO UPDATE SET
                            transaction_hash = COALESCE(EXCLUDED.transaction_hash, case_service_records.transaction_hash),
                            alert_token_id = COALESCE(EXCLUDED.alert_token_id, case_service_records.alert_token_id),
                            recipients = COALESCE(EXCLUDED.recipients, case_service_records.recipients)
                    `, [
                        caseData.case_number,
                        mint.transactionHash,
                        mint.tokenId,
                        JSON.stringify([mint.recipient]),
                        mint.timestamp ? new Date(mint.timestamp) : new Date(),
                        serverAddress,
                        network === 'nile' ? 'tron-nile' : 'tron-mainnet'
                    ]);

                    synced++;
                    results.push(`Synced: ${caseData.case_number} -> ${mint.recipient} (token #${mint.tokenId})`);
                }
            } catch (e) {
                results.push(`Error syncing mint: ${e.message}`);
            }
        }

        results.push(`Synced ${synced} records, skipped ${skipped} duplicates`);

        res.json({
            success: true,
            message: 'Blockchain sync completed',
            synced,
            skipped,
            totalEvents: events.length,
            mintEvents: mints.length,
            results
        });

    } catch (error) {
        console.error('Blockchain sync error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            results
        });
    }
});

/**
 * POST /api/cases/manual-recipient-fix
 * Manually add recipient to a case's service records
 * For cases where we know the recipient but blockchain query failed
 */
router.post('/cases/manual-recipient-fix', async (req, res) => {
    try {
        const {
            caseNumber,
            recipientAddress,
            transactionHash,
            tokenId,
            serverAddress,
            chain = 'tron-nile'
        } = req.body;

        if (!caseNumber || !recipientAddress) {
            return res.status(400).json({
                success: false,
                error: 'caseNumber and recipientAddress are required'
            });
        }

        console.log(`Manual fix: Adding ${recipientAddress} to case ${caseNumber}`);

        // Upsert the record
        const result = await pool.query(`
            INSERT INTO case_service_records (
                case_number,
                transaction_hash,
                alert_token_id,
                recipients,
                served_at,
                server_address,
                chain,
                created_at
            ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, NOW())
            ON CONFLICT (case_number)
            DO UPDATE SET
                transaction_hash = COALESCE(EXCLUDED.transaction_hash, case_service_records.transaction_hash),
                alert_token_id = COALESCE(EXCLUDED.alert_token_id, case_service_records.alert_token_id),
                recipients = EXCLUDED.recipients,
                updated_at = NOW()
            RETURNING *
        `, [
            caseNumber,
            transactionHash || null,
            tokenId || null,
            JSON.stringify([recipientAddress]),
            serverAddress || null,
            chain
        ]);

        res.json({
            success: true,
            message: `Added ${recipientAddress} to case ${caseNumber}`,
            record: result.rows[0]
        });

    } catch (error) {
        console.error('Manual fix error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;