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
            documentTokenId,  // null for Lite contract (single NFT per serve)
            alertImage,
            ipfsHash,
            encryptionKey,
            recipients,
            agency,
            noticeType,
            pageCount,
            servedAt,
            serverAddress,
            chain,
            explorerUrl,
            contractType = 'lite', // Default to Lite contract
            metadata = {}
        } = req.body;

        if (!caseNumber) {
            return res.status(400).json({
                success: false,
                error: 'Case number is required'
            });
        }

        // Normalize recipients - extract addresses if they're objects with {address, label}
        let normalizedRecipients = recipients || [];
        if (Array.isArray(normalizedRecipients)) {
            normalizedRecipients = normalizedRecipients.map(r => {
                if (typeof r === 'string') return r;
                if (r && typeof r === 'object' && r.address) return r.address;
                return r;
            }).filter(Boolean);
        }
        console.log('Normalized recipients:', normalizedRecipients);

        console.log(`Updating case ${caseNumber} with service data`);
        console.log('Contract Type:', contractType);
        console.log('Token ID:', alertTokenId); // Single token for Lite contract
        console.log('Transaction Hash:', transactionHash);
        console.log('IPFS Hash:', ipfsHash);
        console.log('Chain:', chain || 'tron-nile');
        console.log('Has Alert Image:', !!alertImage);

        console.log(`\n========== SERVICE-COMPLETE: ${caseNumber} ==========`);
        console.log(`Server Address: ${serverAddress}`);
        console.log(`Transaction Hash: ${transactionHash}`);
        console.log(`Alert Token ID: ${alertTokenId}`);

        const metadataJson = JSON.stringify({
            agency,
            noticeType,
            pageCount,
            recipients: normalizedRecipients,
            transactionHash,
            alertTokenId,
            documentTokenId,
            ipfsHash,
            encryptionKey,
            servedAt: servedAt || new Date().toISOString(),
            ...metadata
        });

        // Ensure we start with a clean transaction state
        try {
            await client.query('ROLLBACK');
            console.log('ROLLBACK executed (cleanup)');
        } catch (e) {
            console.log('No transaction to rollback:', e.message);
        }

        // Start fresh transaction
        try {
            await client.query('BEGIN');
            console.log('BEGIN executed successfully');

            // Verify transaction is working with a simple test query
            const testQuery = await client.query('SELECT 1 as test');
            console.log('Transaction test query passed:', testQuery.rows[0].test);
        } catch (beginError) {
            console.error('BEGIN or test query failed:', beginError.message);
            console.error('Error code:', beginError.code);
            throw beginError;
        }

        // STEP 1: Update or insert case - use explicit check to avoid ON CONFLICT issues
        let existingCase;
        try {
            console.log('Executing SELECT to check if case exists...');
            console.log('Case number:', caseNumber);
            console.log('Case number type:', typeof caseNumber);
            console.log('Case number length:', caseNumber.length);
            existingCase = await client.query(
                'SELECT id, status FROM cases WHERE id = $1',
                [caseNumber]
            );
            console.log(`SELECT completed: found ${existingCase.rows.length} rows`);
        } catch (selectError) {
            console.error('SELECT failed:', selectError.message);
            console.error('SELECT error code:', selectError.code);
            console.error('SELECT error detail:', selectError.detail);
            throw selectError;
        }

        let caseId, caseStatus;

        try {
            if (existingCase.rows.length > 0) {
                // Case exists - UPDATE it
                console.log(`Case ${caseNumber} exists, updating to served...`);
                const updateResult = await client.query(`
                    UPDATE cases SET
                        status = 'served',
                        served_at = COALESCE(served_at, NOW()),
                        updated_at = NOW(),
                        tx_hash = $2,
                        alert_nft_id = $3,
                        metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb
                    WHERE id = $1
                    RETURNING id, status
                `, [
                    caseNumber,
                    transactionHash,
                    alertTokenId,
                    metadataJson
                ]);
                console.log('UPDATE completed successfully');
                caseId = updateResult.rows[0].id;
                caseStatus = updateResult.rows[0].status;
            } else {
                // Case doesn't exist - INSERT it
                console.log(`Case ${caseNumber} doesn't exist, creating...`);
                const insertResult = await client.query(`
                    INSERT INTO cases (
                        id,
                        server_address,
                        status,
                        chain,
                        tx_hash,
                        alert_nft_id,
                        created_at,
                        updated_at,
                        served_at,
                        metadata
                    ) VALUES ($1, $2, 'served', $3, $4, $5, NOW(), NOW(), NOW(), $6)
                    RETURNING id, status
                `, [
                    caseNumber,
                    serverAddress || req.headers['x-server-address'],
                    chain || 'tron-mainnet',
                    transactionHash,
                    alertTokenId,
                    metadataJson
                ]);
                console.log('INSERT completed successfully');
                caseId = insertResult.rows[0].id;
                caseStatus = insertResult.rows[0].status;
            }
        } catch (upsertError) {
            console.error('UPDATE/INSERT failed:', upsertError.message);
            console.error('Error code:', upsertError.code);
            console.error('Error detail:', upsertError.detail);
            throw upsertError;
        }

        console.log(`✅ Cases table updated: id=${caseId}, status=${caseStatus}`);

        // Store alert image if provided
        if (alertImage) {
            // Try to store in notice_images table (may not exist in all deployments)
            // Use SAVEPOINT to allow recovery if the table doesn't exist
            try {
                await client.query('SAVEPOINT notice_images_insert');
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
                await client.query('RELEASE SAVEPOINT notice_images_insert');
            } catch (imageError) {
                // Rollback to savepoint to keep transaction valid
                await client.query('ROLLBACK TO SAVEPOINT notice_images_insert');
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
        // First, check if the unique constraint exists - if not, we need to handle differently
        let hasUniqueConstraint = true; // Assume it exists by default
        try {
            const constraintCheck = await client.query(`
                SELECT 1 FROM pg_indexes
                WHERE tablename = 'case_service_records'
                AND indexname LIKE '%case_number%'
            `);
            hasUniqueConstraint = constraintCheck.rows.length > 0;
            console.log(`Unique constraint on case_number exists: ${hasUniqueConstraint}`);
        } catch (constraintCheckError) {
            console.error('Constraint check failed:', constraintCheckError.message);
            console.error('Error code:', constraintCheckError.code);
            // Assume constraint exists and try to proceed
            console.log('Assuming unique constraint exists and proceeding...');
        }

        let insertResult;
        if (hasUniqueConstraint) {
            insertResult = await client.query(`
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
                JSON.stringify(normalizedRecipients),
                pageCount || 1,
                servedAt || new Date().toISOString(),
                serverAddress || req.headers['x-server-address'],
                chain || 'tron-mainnet',
                explorerUrl || null
            ]);
        } else {
            // No unique constraint - try delete + insert approach
            console.log('No unique constraint - using delete + insert approach');
            await client.query(
                'DELETE FROM case_service_records WHERE case_number = $1',
                [caseNumber]
            );
            insertResult = await client.query(`
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
                RETURNING id, case_number
            `, [
                caseNumber,
                transactionHash,
                alertTokenId,
                documentTokenId,
                ipfsHash,
                encryptionKey,
                JSON.stringify(normalizedRecipients),
                pageCount || 1,
                servedAt || new Date().toISOString(),
                serverAddress || req.headers['x-server-address'],
                chain || 'tron-mainnet',
                explorerUrl || null
            ]);
        }
        console.log('INSERT result:', insertResult.rows);

        // CRITICAL: Validate that the INSERT actually returned a row
        if (!insertResult.rows || insertResult.rows.length === 0) {
            throw new Error('INSERT into case_service_records returned no rows - data may not have been saved');
        }
        console.log(`✅ Service record inserted/updated: id=${insertResult.rows[0].id}, case_number=${insertResult.rows[0].case_number}`);

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

        // CRITICAL: Verify WITHIN the transaction (using same client) BEFORE committing
        // This ensures we catch any issues before the data is committed
        const verifyServiceRecord = await client.query(
            'SELECT case_number, transaction_hash FROM case_service_records WHERE case_number = $1',
            [caseNumber]
        );
        console.log(`Pre-commit verification: found ${verifyServiceRecord.rows.length} rows in case_service_records for case ${caseNumber}`);

        if (verifyServiceRecord.rows.length === 0) {
            // Data wasn't actually saved - rollback and report error
            console.error('CRITICAL: INSERT appeared to succeed but record not found before COMMIT!');
            await client.query('ROLLBACK');
            return res.status(500).json({
                success: false,
                error: 'Database verification failed - record not saved in transaction',
                message: 'INSERT succeeded but record not found before COMMIT. This may indicate a database issue.',
                caseNumber,
                debug: {
                    insertResult: insertResult.rows,
                    hasUniqueConstraint
                }
            });
        }

        // Verify cases table too
        const verifyCases = await client.query(
            'SELECT id, status FROM cases WHERE id = $1',
            [caseNumber]
        );
        if (verifyCases.rows.length === 0 || verifyCases.rows[0].status !== 'served') {
            console.error('CRITICAL: Cases table not properly updated before COMMIT!');
            await client.query('ROLLBACK');
            return res.status(500).json({
                success: false,
                error: 'Database verification failed - case status not updated in transaction',
                message: 'Case status not properly updated before COMMIT.',
                caseNumber,
                casesVerifyResult: verifyCases.rows
            });
        }

        console.log(`✅ Pre-commit verification passed. Committing transaction...`);
        await client.query('COMMIT');
        console.log(`✅ Transaction committed successfully`);

        // Post-commit verification on pool (to detect any connection/replication issues)
        const postCommitVerify = await pool.query(
            'SELECT case_number, transaction_hash FROM case_service_records WHERE case_number = $1',
            [caseNumber]
        );
        if (postCommitVerify.rows.length === 0) {
            // This indicates a serious database issue - data committed but not visible
            console.error('WARNING: Post-commit verification failed - data may not be immediately visible');
            // Still return success since commit succeeded, but log the issue
        } else {
            console.log(`✅ Post-commit verification passed`);
        }

        console.log(`✅ Case ${caseNumber} updated with complete service data (verified)`);

        res.json({
            success: true,
            message: 'Case updated with service data',
            verified: true,
            caseNumber,
            data: {
                caseId,
                caseStatus: verifyCases.rows[0].status,
                transactionHash,
                alertTokenId,
                documentTokenId,
                ipfsHash,
                hasAlertImage: !!alertImage
            }
        });

    } catch (error) {
        try { await client.query('ROLLBACK'); } catch (e) {}
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
            code: error.code || null,
            detail: error.detail || null,
            version: '20260208-v2' // Version tracker
        });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/cases/:caseNumber/service-complete-notx
 * Same as service-complete but WITHOUT transactions - for debugging
 */
router.put('/cases/:caseNumber/service-complete-notx', async (req, res) => {
    try {
        const caseNumber = (req.params.caseNumber || '').trim();
        const {
            transactionHash,
            alertTokenId,
            documentTokenId,
            alertImage,
            recipients,
            serverAddress,
            chain,
            ipfsHash,
            encryptionKey,
            agency,
            noticeType,
            pageCount,
            metadata = {}
        } = req.body;

        if (!caseNumber) {
            return res.status(400).json({ success: false, error: 'Case number required' });
        }

        const normalizedRecipients = (recipients || []).map(r => typeof r === 'string' ? r : r?.address).filter(Boolean);
        console.log(`service-complete-notx: ${caseNumber}, recipients: ${normalizedRecipients.length}, pages: ${pageCount}`);

        const metadataJson = JSON.stringify({
            ...metadata,
            transactionHash,
            alertTokenId,
            recipients: normalizedRecipients,
            pageCount,
            agency,
            noticeType
        });

        // Check if case exists
        const existing = await pool.query('SELECT id FROM cases WHERE id = $1', [caseNumber]);

        if (existing.rows.length > 0) {
            // Update
            await pool.query(`
                UPDATE cases SET status = 'served', tx_hash = $2, alert_nft_id = $3,
                metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb, updated_at = NOW(), served_at = COALESCE(served_at, NOW())
                WHERE id = $1
            `, [caseNumber, transactionHash, alertTokenId, metadataJson]);
        } else {
            // Insert
            await pool.query(`
                INSERT INTO cases (id, server_address, status, chain, tx_hash, alert_nft_id, metadata, created_at, updated_at, served_at)
                VALUES ($1, $2, 'served', $3, $4, $5, $6, NOW(), NOW(), NOW())
            `, [caseNumber, serverAddress, chain || 'tron-nile', transactionHash, alertTokenId, metadataJson]);
        }

        // Insert/update service record with ALL fields
        await pool.query(`
            INSERT INTO case_service_records (
                case_number,
                transaction_hash,
                alert_token_id,
                document_token_id,
                recipients,
                page_count,
                ipfs_hash,
                encryption_key,
                issuing_agency,
                served_at,
                server_address,
                chain,
                status,
                created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11, 'served', NOW())
            ON CONFLICT (case_number) DO UPDATE SET
                transaction_hash = EXCLUDED.transaction_hash,
                alert_token_id = EXCLUDED.alert_token_id,
                document_token_id = COALESCE(EXCLUDED.document_token_id, case_service_records.document_token_id),
                recipients = EXCLUDED.recipients,
                page_count = COALESCE(EXCLUDED.page_count, case_service_records.page_count),
                ipfs_hash = COALESCE(EXCLUDED.ipfs_hash, case_service_records.ipfs_hash),
                encryption_key = COALESCE(EXCLUDED.encryption_key, case_service_records.encryption_key),
                issuing_agency = COALESCE(EXCLUDED.issuing_agency, case_service_records.issuing_agency),
                status = 'served',
                updated_at = NOW()
        `, [
            caseNumber,
            transactionHash,
            alertTokenId,
            documentTokenId,
            JSON.stringify(normalizedRecipients),
            pageCount || 1,
            ipfsHash,
            encryptionKey,
            agency,
            serverAddress,
            chain || 'tron-nile'
        ]);

        // Store alert image if provided
        if (alertImage) {
            try {
                await pool.query(`
                    INSERT INTO notice_images (case_number, alert_image, created_at)
                    VALUES ($1, $2, NOW())
                    ON CONFLICT (case_number)
                    DO UPDATE SET alert_image = EXCLUDED.alert_image, created_at = NOW()
                `, [caseNumber, alertImage]);
            } catch (imageError) {
                // Table might not exist - store in cases metadata instead
                console.log('notice_images table not available, storing in metadata');
                await pool.query(`
                    UPDATE cases SET alert_preview = $1, updated_at = NOW()
                    WHERE case_number = $2 OR id::text = $2
                `, [alertImage, caseNumber]);
            }
        }

        res.json({ success: true, message: 'Saved without transaction', caseNumber, recipientCount: normalizedRecipients.length, pageCount });
    } catch (error) {
        console.error('No-TX service-complete error:', error);
        res.status(500).json({ success: false, error: error.message, code: error.code });
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
            LEFT JOIN case_service_records csr ON (c.case_number = csr.case_number OR c.id::text = csr.case_number)
            LEFT JOIN notice_images ni ON (c.case_number = ni.case_number OR c.id::text = ni.case_number)
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
 * GET /api/cases/:caseNumber/diagnose
 * Diagnostic endpoint to check data flow for receipts
 */
router.get('/cases/:caseNumber/diagnose', async (req, res) => {
    try {
        const caseNumber = (req.params.caseNumber || '').trim();

        if (!caseNumber) {
            return res.status(400).json({ error: 'Case number required' });
        }

        const diagnosis = {
            caseNumber,
            timestamp: new Date().toISOString(),
            casesTable: null,
            caseServiceRecords: null,
            joinResult: null
        };

        // 1. Check cases table
        const casesResult = await pool.query(`
            SELECT id, server_address, status, metadata, created_at, served_at
            FROM cases WHERE id = $1 OR id::text = $1
        `, [caseNumber]);

        if (casesResult.rows.length > 0) {
            const row = casesResult.rows[0];
            const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
            diagnosis.casesTable = {
                found: true,
                id: row.id,
                status: row.status,
                serverAddress: row.server_address,
                servedAt: row.served_at,
                metadataTransactionHash: metadata?.transactionHash || null,
                metadataAlertTokenId: metadata?.alertTokenId || null
            };
        } else {
            diagnosis.casesTable = { found: false };
        }

        // 2. Check case_service_records
        const csrResult = await pool.query(`
            SELECT case_number, transaction_hash, alert_token_id, document_token_id,
                   ipfs_hash, served_at, server_address, chain, explorer_url
            FROM case_service_records WHERE case_number = $1
        `, [caseNumber]);

        if (csrResult.rows.length > 0) {
            const row = csrResult.rows[0];
            diagnosis.caseServiceRecords = {
                found: true,
                caseNumber: row.case_number,
                transactionHash: row.transaction_hash,
                alertTokenId: row.alert_token_id,
                documentTokenId: row.document_token_id,
                ipfsHash: row.ipfs_hash,
                servedAt: row.served_at,
                serverAddress: row.server_address,
                chain: row.chain,
                explorerUrl: row.explorer_url
            };
        } else {
            diagnosis.caseServiceRecords = { found: false };
        }

        // 3. Check JOIN result
        const joinResult = await pool.query(`
            SELECT c.id, c.status, csr.transaction_hash, csr.alert_token_id
            FROM cases c
            LEFT JOIN case_service_records csr ON c.id::text = csr.case_number
            WHERE c.id = $1 OR c.id::text = $1
        `, [caseNumber]);

        if (joinResult.rows.length > 0) {
            const row = joinResult.rows[0];
            diagnosis.joinResult = {
                found: true,
                id: row.id,
                status: row.status,
                transactionHash: row.transaction_hash,
                alertTokenId: row.alert_token_id,
                joinWorking: !!(row.transaction_hash || row.alert_token_id)
            };
        } else {
            diagnosis.joinResult = { found: false };
        }

        res.json({
            success: true,
            diagnosis
        });

    } catch (error) {
        console.error('Diagnosis error:', error);
        res.status(500).json({ success: false, error: error.message });
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

            // Try to add missing columns
            await pool.query(`ALTER TABLE case_service_records ADD COLUMN IF NOT EXISTS case_number VARCHAR(255)`).catch(e => {
                console.log('Note: Could not add case_number column:', e.message);
            });

        } catch (fallbackError) {
            console.error('Fallback table creation also failed:', fallbackError);
        }
    }

    // CRITICAL: Ensure unique index exists on case_number
    // This is required for ON CONFLICT (case_number) to work
    await ensureUniqueIndex();
}

/**
 * Ensure unique index exists on case_number column
 * This is CRITICAL for the ON CONFLICT clause to work properly
 */
async function ensureUniqueIndex() {
    try {
        // Check if index exists
        const indexCheck = await pool.query(`
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'case_service_records'
            AND indexdef LIKE '%case_number%'
            AND indexdef LIKE '%UNIQUE%'
        `);

        if (indexCheck.rows.length > 0) {
            console.log('✅ Unique index on case_number already exists:', indexCheck.rows[0].indexname);
            return;
        }

        console.log('⚠️ No unique index on case_number found. Attempting to create...');

        // First, check for NULL or duplicate values that would prevent index creation
        const duplicateCheck = await pool.query(`
            SELECT case_number, COUNT(*) as count
            FROM case_service_records
            WHERE case_number IS NOT NULL
            GROUP BY case_number
            HAVING COUNT(*) > 1
        `);

        if (duplicateCheck.rows.length > 0) {
            console.error('❌ Found duplicate case_number values - cannot create unique index:');
            for (const row of duplicateCheck.rows) {
                console.error(`   - "${row.case_number}" appears ${row.count} times`);
            }
            console.error('   Please manually fix duplicates before unique index can be created');
            return;
        }

        // Check for NULL values
        const nullCheck = await pool.query(`
            SELECT COUNT(*) as count FROM case_service_records WHERE case_number IS NULL
        `);

        if (parseInt(nullCheck.rows[0].count) > 0) {
            console.log(`⚠️ Found ${nullCheck.rows[0].count} rows with NULL case_number - will exclude from index`);
            // Create partial index excluding NULLs
            await pool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS case_service_records_case_number_key
                ON case_service_records(case_number)
                WHERE case_number IS NOT NULL
            `);
        } else {
            // Create regular unique index
            await pool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS case_service_records_case_number_key
                ON case_service_records(case_number)
            `);
        }

        console.log('✅ Created unique index on case_number');

    } catch (error) {
        console.error('❌ Failed to ensure unique index on case_number:', error.message);
        console.error('   The ON CONFLICT clause may not work correctly!');
        console.error('   Error details:', error.detail || 'none');
    }
}

// Create notice_images table if it doesn't exist
async function createNoticeImagesTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notice_images (
                id SERIAL PRIMARY KEY,
                case_number VARCHAR(255) UNIQUE,
                notice_id VARCHAR(255),
                alert_image TEXT,
                document_preview TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ notice_images table ready');
    } catch (error) {
        console.log('Note: Could not create notice_images table:', error.message);
    }
}

// Initialize tables on startup
createTables();
createNoticeImagesTable();

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
                { name: 'viewed_at', type: 'TIMESTAMP' },
                { name: 'server_address', type: 'VARCHAR(255)' },
                { name: 'server_name', type: 'VARCHAR(255)' },
                { name: 'issuing_agency', type: 'VARCHAR(255)' },
                { name: 'chain', type: "VARCHAR(50) DEFAULT 'tron-mainnet'" },
                { name: 'explorer_url', type: 'TEXT' },
                { name: 'status', type: "VARCHAR(50) DEFAULT 'served'" },
                { name: 'accepted', type: 'BOOLEAN DEFAULT FALSE' },
                { name: 'accepted_at', type: 'TIMESTAMP' }
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

/**
 * Recipient Activity Logging
 * Creates audit trail for when recipients view/download their served documents
 */

// Create recipient_activity table on startup
async function createActivityTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recipient_activity (
                id SERIAL PRIMARY KEY,
                case_number VARCHAR(255) NOT NULL,
                recipient_address VARCHAR(255) NOT NULL,
                activity_type VARCHAR(50) NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Create index for fast lookups
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_recipient_activity_case
            ON recipient_activity(case_number)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_recipient_activity_recipient
            ON recipient_activity(recipient_address)
        `);

        console.log('✅ Recipient activity table ready');
    } catch (error) {
        console.log('Note: Could not create recipient_activity table:', error.message);
    }
}
createActivityTable();

/**
 * POST /api/cases/log-activity
 * Log recipient activity (view, download, accept) for audit trail
 */
router.post('/cases/log-activity', async (req, res) => {
    try {
        const {
            caseNumber,
            recipientAddress,
            activityType,      // 'view', 'download', 'decrypt', 'accept'
            metadata = {}
        } = req.body;

        if (!caseNumber || !recipientAddress || !activityType) {
            return res.status(400).json({
                success: false,
                error: 'caseNumber, recipientAddress, and activityType are required'
            });
        }

        // Valid activity types
        const validTypes = ['view', 'download', 'decrypt', 'accept', 'view_alert', 'view_document'];
        if (!validTypes.includes(activityType)) {
            return res.status(400).json({
                success: false,
                error: `Invalid activityType. Must be one of: ${validTypes.join(', ')}`
            });
        }

        // Get IP and user agent from request
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] ||
                         req.connection?.remoteAddress ||
                         'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        const result = await pool.query(`
            INSERT INTO recipient_activity (
                case_number,
                recipient_address,
                activity_type,
                ip_address,
                user_agent,
                metadata,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id, created_at
        `, [
            caseNumber,
            recipientAddress,
            activityType,
            ipAddress,
            userAgent,
            JSON.stringify(metadata)
        ]);

        console.log(`📝 Activity logged: ${activityType} by ${recipientAddress} on case ${caseNumber}`);

        res.json({
            success: true,
            message: 'Activity logged',
            activityId: result.rows[0].id,
            timestamp: result.rows[0].created_at
        });

    } catch (error) {
        console.error('Activity log error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/cases/:caseNumber/activity
 * Get all activity for a specific case (for audit trail)
 */
router.get('/cases/:caseNumber/activity', async (req, res) => {
    try {
        const { caseNumber } = req.params;

        const result = await pool.query(`
            SELECT
                id,
                recipient_address,
                activity_type,
                ip_address,
                user_agent,
                metadata,
                created_at
            FROM recipient_activity
            WHERE case_number = $1
            ORDER BY created_at DESC
        `, [caseNumber]);

        res.json({
            success: true,
            caseNumber,
            activities: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error('Get activity error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/cases/recipient/:address/activity
 * Get all activity for a specific recipient across all cases
 */
router.get('/cases/recipient/:address/activity', async (req, res) => {
    try {
        const { address } = req.params;

        const result = await pool.query(`
            SELECT
                id,
                case_number,
                activity_type,
                ip_address,
                metadata,
                created_at
            FROM recipient_activity
            WHERE recipient_address = $1
            ORDER BY created_at DESC
            LIMIT 100
        `, [address]);

        res.json({
            success: true,
            recipientAddress: address,
            activities: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error('Get recipient activity error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/diagnose-service-complete
 * Diagnostic endpoint to test what would fail in service-complete
 */
router.get('/diagnose-service-complete', async (req, res) => {
    const results = [];
    const client = await pool.connect();

    try {
        // Step 1: Check cases table columns
        const casesColumns = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'cases'
            ORDER BY ordinal_position
        `);
        results.push({
            step: 'cases_table_columns',
            status: 'ok',
            columns: casesColumns.rows
        });

        // Step 2: Check case_service_records columns
        const csrColumns = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'case_service_records'
            ORDER BY ordinal_position
        `);
        results.push({
            step: 'case_service_records_columns',
            status: 'ok',
            columns: csrColumns.rows
        });

        // Step 3: Test ALTER TABLE on case_service_records
        try {
            await pool.query(`ALTER TABLE case_service_records ADD COLUMN IF NOT EXISTS chain VARCHAR(50) DEFAULT 'tron-mainnet'`);
            results.push({ step: 'alter_case_service_records_chain', status: 'ok' });
        } catch (e) {
            results.push({ step: 'alter_case_service_records_chain', status: 'error', error: e.message });
        }

        // Step 4: Test ALTER TABLE on cases
        try {
            await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS chain VARCHAR(50) DEFAULT 'tron-mainnet'`);
            results.push({ step: 'alter_cases_chain', status: 'ok' });
        } catch (e) {
            results.push({ step: 'alter_cases_chain', status: 'error', error: e.message });
        }

        // Step 5: Test BEGIN transaction
        try {
            await client.query('BEGIN');
            results.push({ step: 'begin_transaction', status: 'ok' });
        } catch (e) {
            results.push({ step: 'begin_transaction', status: 'error', error: e.message });
        }

        // Step 6: Test SELECT from cases
        try {
            const testSelect = await client.query(
                'SELECT id FROM cases WHERE case_number = $1 OR id::text = $1 LIMIT 1',
                ['__test_diagnostic__']
            );
            results.push({ step: 'select_from_cases', status: 'ok', found: testSelect.rows.length });
        } catch (e) {
            results.push({ step: 'select_from_cases', status: 'error', error: e.message });
        }

        // Step 7: Test INSERT into cases with chain column (matches actual service-complete code)
        try {
            const testInsert = await client.query(`
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
                '__test_diagnostic_' + Date.now() + '__',
                'TTestAddress',
                'test',
                'tron-nile',
                '{}'
            ]);
            results.push({ step: 'insert_into_cases', status: 'ok', inserted: testInsert.rows.length > 0, id: testInsert.rows[0]?.id });
        } catch (e) {
            results.push({ step: 'insert_into_cases', status: 'error', error: e.message });
        }

        // Rollback test transaction
        await client.query('ROLLBACK');
        results.push({ step: 'rollback', status: 'ok' });

        res.json({
            success: true,
            message: 'Diagnostic complete',
            results
        });

    } catch (error) {
        try { await client.query('ROLLBACK'); } catch (e) {}
        console.error('Diagnostic error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            results
        });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/test-service-complete-echo
 * Echo the received data and attempt the same flow as service-complete
 */
router.put('/test-service-complete-echo', async (req, res) => {
    const client = await pool.connect();
    const results = [];

    try {
        const caseNumber = 'test_echo_' + Date.now();
        const { transactionHash, alertTokenId, recipients, serverAddress, chain, metadata = {} } = req.body;

        results.push({
            step: 'parse_body',
            status: 'ok',
            received: {
                caseNumber,
                transactionHash: transactionHash?.substring(0, 20) + '...',
                alertTokenId,
                recipientsCount: recipients?.length,
                serverAddress: serverAddress?.substring(0, 10) + '...',
                chain,
                metadataKeys: Object.keys(metadata || {})
            }
        });

        // Normalize recipients
        let normalizedRecipients = recipients || [];
        if (Array.isArray(normalizedRecipients)) {
            normalizedRecipients = normalizedRecipients.map(r => {
                if (typeof r === 'string') return r;
                if (r && typeof r === 'object' && r.address) return r.address;
                return r;
            }).filter(Boolean);
        }
        results.push({ step: 'normalize_recipients', status: 'ok', count: normalizedRecipients.length });

        // Build metadata JSON
        let metadataJson;
        try {
            metadataJson = JSON.stringify({
                recipients: normalizedRecipients,
                transactionHash,
                alertTokenId,
                ...metadata
            });
            results.push({ step: 'json_stringify', status: 'ok', length: metadataJson.length });
        } catch (e) {
            results.push({ step: 'json_stringify', status: 'error', error: e.message });
            throw e;
        }

        // ROLLBACK cleanup
        try {
            await client.query('ROLLBACK');
            results.push({ step: 'rollback', status: 'ok' });
        } catch (e) {
            results.push({ step: 'rollback', status: 'skipped' });
        }

        // BEGIN
        await client.query('BEGIN');
        results.push({ step: 'begin', status: 'ok' });

        // SELECT
        const existing = await client.query('SELECT id FROM cases WHERE id = $1', [caseNumber]);
        results.push({ step: 'select', status: 'ok', found: existing.rows.length });

        // INSERT
        const insertResult = await client.query(`
            INSERT INTO cases (id, server_address, status, chain, tx_hash, alert_nft_id, metadata, created_at, updated_at, served_at)
            VALUES ($1, $2, 'served', $3, $4, $5, $6, NOW(), NOW(), NOW())
            RETURNING id, status
        `, [caseNumber, serverAddress || 'TTest', chain || 'tron-nile', transactionHash, alertTokenId, metadataJson]);
        results.push({ step: 'insert', status: 'ok', id: insertResult.rows[0]?.id });

        // ROLLBACK to cleanup test
        await client.query('ROLLBACK');
        results.push({ step: 'cleanup', status: 'ok' });

        res.json({ success: true, results });

    } catch (error) {
        try { await client.query('ROLLBACK'); } catch (e) {}
        res.json({ success: false, error: error.message, code: error.code, results });
    } finally {
        client.release();
    }
});

/**
 * GET /api/test-service-complete-flow
 * Test endpoint to debug the exact service-complete flow with hardcoded values
 */
router.get('/test-service-complete-flow', async (req, res) => {
    const client = await pool.connect();
    const results = [];
    const caseNumber = 'test_flow_' + Date.now();

    try {
        // Step 1: ROLLBACK (cleanup)
        try {
            await client.query('ROLLBACK');
            results.push({ step: 'rollback_cleanup', status: 'ok' });
        } catch (e) {
            results.push({ step: 'rollback_cleanup', status: 'skipped', message: e.message });
        }

        // Step 2: BEGIN
        try {
            await client.query('BEGIN');
            results.push({ step: 'begin', status: 'ok' });
        } catch (e) {
            results.push({ step: 'begin', status: 'error', error: e.message });
            throw e;
        }

        // Step 3: SELECT to check if case exists
        let existingCase;
        try {
            existingCase = await client.query(
                'SELECT id, status FROM cases WHERE id = $1',
                [caseNumber]
            );
            results.push({ step: 'select', status: 'ok', found: existingCase.rows.length });
        } catch (e) {
            results.push({ step: 'select', status: 'error', error: e.message, code: e.code });
            throw e;
        }

        // Step 4: INSERT (case doesn't exist)
        try {
            const metadataJson = JSON.stringify({ test: true });
            const insertResult = await client.query(`
                INSERT INTO cases (
                    id,
                    server_address,
                    status,
                    chain,
                    tx_hash,
                    alert_nft_id,
                    created_at,
                    updated_at,
                    served_at,
                    metadata
                ) VALUES ($1, $2, 'served', $3, $4, $5, NOW(), NOW(), NOW(), $6)
                RETURNING id, status
            `, [
                caseNumber,
                'TTestServer',
                'tron-nile',
                'test_tx_hash',
                '12345',
                metadataJson
            ]);
            results.push({ step: 'insert_cases', status: 'ok', inserted: insertResult.rows[0] });
        } catch (e) {
            results.push({ step: 'insert_cases', status: 'error', error: e.message, code: e.code, detail: e.detail });
            throw e;
        }

        // Step 5: INSERT into case_service_records
        try {
            const csrResult = await client.query(`
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
                    transaction_hash = EXCLUDED.transaction_hash,
                    updated_at = NOW()
                RETURNING id, case_number
            `, [
                caseNumber,
                'test_tx_hash',
                '12345',
                JSON.stringify(['TTestRecipient']),
                'TTestServer',
                'tron-nile'
            ]);
            results.push({ step: 'insert_csr', status: 'ok', inserted: csrResult.rows[0] });
        } catch (e) {
            results.push({ step: 'insert_csr', status: 'error', error: e.message, code: e.code });
            throw e;
        }

        // Step 6: ROLLBACK (cleanup test data)
        await client.query('ROLLBACK');
        results.push({ step: 'rollback_final', status: 'ok' });

        res.json({ success: true, results });

    } catch (error) {
        try { await client.query('ROLLBACK'); } catch (e) {}
        res.json({
            success: false,
            error: error.message,
            code: error.code,
            results
        });
    } finally {
        client.release();
    }
});

/**
 * GET /api/cases/check-constraints
 * Diagnostic endpoint to check table constraints
 */
router.get('/cases/check-constraints', async (req, res) => {
    try {
        const results = {};

        // Check constraints on cases table
        const casesConstraints = await pool.query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'cases'
        `);
        results.cases_constraints = casesConstraints.rows;

        // Check constraints on case_service_records table
        const csrConstraints = await pool.query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'case_service_records'
        `);
        results.case_service_records_constraints = csrConstraints.rows;

        // Check indexes on both tables
        const casesIndexes = await pool.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'cases'
        `);
        results.cases_indexes = casesIndexes.rows;

        const csrIndexes = await pool.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'case_service_records'
        `);
        results.case_service_records_indexes = csrIndexes.rows;

        // Check if id has a primary key in cases
        const hasPK = casesConstraints.rows.some(c => c.constraint_type === 'PRIMARY KEY');
        results.cases_has_primary_key = hasPK;

        // Check if case_number has unique constraint in case_service_records
        const hasUnique = csrConstraints.rows.some(c =>
            c.constraint_type === 'UNIQUE' || c.constraint_name.includes('case_number')
        ) || csrIndexes.rows.some(i => i.indexdef?.includes('UNIQUE') && i.indexdef?.includes('case_number'));
        results.csr_has_unique_case_number = hasUnique;

        res.json({
            success: true,
            results,
            recommendations: [
                !hasPK ? 'CRITICAL: cases table has no PRIMARY KEY on id - ON CONFLICT will fail' : null,
                !hasUnique ? 'WARNING: case_service_records may not have unique constraint on case_number' : null
            ].filter(Boolean)
        });

    } catch (error) {
        console.error('Check constraints error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/cases/fix-orphaned-cases
 * Migration endpoint to fix ALL orphaned cases across all servers.
 * This finds cases in case_service_records that have corresponding entries
 * in the cases table still showing as 'draft' and updates them to 'served'.
 */
router.post('/cases/fix-orphaned-cases', async (req, res) => {
    const results = [];

    try {
        console.log('🔄 Starting orphaned cases migration...');

        // Step 1: Find all orphaned cases (in case_service_records but cases.status != 'served')
        const orphanedQuery = await pool.query(`
            SELECT
                csr.case_number,
                csr.server_address,
                csr.transaction_hash,
                csr.alert_token_id,
                csr.served_at,
                c.status as current_status
            FROM case_service_records csr
            JOIN cases c ON c.id = csr.case_number
            WHERE c.status != 'served'
        `);

        results.push({
            step: 'find_orphaned',
            found: orphanedQuery.rows.length,
            cases: orphanedQuery.rows.map(r => ({
                caseNumber: r.case_number,
                currentStatus: r.current_status
            }))
        });

        if (orphanedQuery.rows.length === 0) {
            return res.json({
                success: true,
                message: 'No orphaned cases found - all synced!',
                fixedCount: 0,
                results
            });
        }

        // Step 2: Update all orphaned cases to 'served'
        const updateResult = await pool.query(`
            UPDATE cases c
            SET
                status = 'served',
                served_at = COALESCE(c.served_at, csr.served_at, NOW()),
                updated_at = NOW(),
                metadata = COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object(
                    'fixedByMigration', true,
                    'fixedAt', NOW()::text,
                    'transactionHash', csr.transaction_hash,
                    'alertTokenId', csr.alert_token_id
                )
            FROM case_service_records csr
            WHERE c.id = csr.case_number
              AND c.status != 'served'
            RETURNING c.id, c.status, c.served_at
        `);

        results.push({
            step: 'update_cases',
            updated: updateResult.rows.length,
            cases: updateResult.rows.map(r => ({
                caseNumber: r.id,
                newStatus: r.status,
                servedAt: r.served_at
            }))
        });

        console.log(`✅ Fixed ${updateResult.rows.length} orphaned cases`);

        // Step 3: Verify the fix
        const verifyQuery = await pool.query(`
            SELECT COUNT(*) as remaining
            FROM case_service_records csr
            JOIN cases c ON c.id = csr.case_number
            WHERE c.status != 'served'
        `);

        results.push({
            step: 'verify',
            remainingOrphaned: parseInt(verifyQuery.rows[0].remaining)
        });

        res.json({
            success: true,
            message: `Fixed ${updateResult.rows.length} orphaned cases`,
            fixedCount: updateResult.rows.length,
            remainingOrphaned: parseInt(verifyQuery.rows[0].remaining),
            results
        });

    } catch (error) {
        console.error('Orphaned cases migration error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            results
        });
    }
});

/**
 * GET /api/cases/orphaned-status
 * Check how many orphaned cases exist (for diagnostics)
 */
router.get('/cases/orphaned-status', async (req, res) => {
    try {
        // Count orphaned cases
        const orphanedCount = await pool.query(`
            SELECT COUNT(*) as count
            FROM case_service_records csr
            JOIN cases c ON c.id = csr.case_number
            WHERE c.status != 'served'
        `);

        // Get total counts
        const totalCases = await pool.query(`SELECT COUNT(*) as count FROM cases`);
        const totalServiceRecords = await pool.query(`SELECT COUNT(*) as count FROM case_service_records`);
        const servedCases = await pool.query(`SELECT COUNT(*) as count FROM cases WHERE status = 'served'`);
        const draftCases = await pool.query(`SELECT COUNT(*) as count FROM cases WHERE status = 'draft'`);

        res.json({
            success: true,
            orphanedCount: parseInt(orphanedCount.rows[0].count),
            totals: {
                cases: parseInt(totalCases.rows[0].count),
                serviceRecords: parseInt(totalServiceRecords.rows[0].count),
                served: parseInt(servedCases.rows[0].count),
                draft: parseInt(draftCases.rows[0].count)
            },
            healthy: parseInt(orphanedCount.rows[0].count) === 0
        });

    } catch (error) {
        console.error('Orphaned status check error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/cases/fix-whitespace-cases
 * Fix cases where id has leading/trailing whitespace causing mismatch with case_service_records.
 * This finds cases in the cases table with whitespace and updates them to match the trimmed version.
 */
router.post('/cases/fix-whitespace-cases', async (req, res) => {
    const results = [];

    try {
        console.log('🔄 Starting whitespace case fix migration...');

        // Step 1: Find all cases where id has leading/trailing whitespace
        const whitespaceQuery = await pool.query(`
            SELECT id, server_address, status, TRIM(id) as trimmed_id
            FROM cases
            WHERE id != TRIM(id)
        `);

        results.push({
            step: 'find_whitespace_cases',
            found: whitespaceQuery.rows.length,
            cases: whitespaceQuery.rows.map(r => ({
                id: r.id,
                trimmedId: r.trimmed_id,
                status: r.status
            }))
        });

        if (whitespaceQuery.rows.length === 0) {
            return res.json({
                success: true,
                message: 'No cases with whitespace issues found',
                fixedCount: 0,
                results
            });
        }

        // Step 2: For each whitespace case, check if there's a served version with trimmed id
        let fixed = 0;
        let deleted = 0;

        for (const row of whitespaceQuery.rows) {
            const untrimmedId = row.id;
            const trimmedId = row.trimmed_id;
            const serverAddress = row.server_address;

            // Check if there's already a case with the trimmed id
            const existingTrimmed = await pool.query(
                'SELECT id, status FROM cases WHERE id = $1 AND server_address = $2',
                [trimmedId, serverAddress]
            );

            if (existingTrimmed.rows.length > 0) {
                // There's already a trimmed version - delete the whitespace one
                // Keep the trimmed version (which is likely 'served')
                await pool.query(
                    'DELETE FROM cases WHERE id = $1 AND server_address = $2',
                    [untrimmedId, serverAddress]
                );
                deleted++;
                results.push({
                    step: 'delete_duplicate',
                    untrimmedId,
                    trimmedId,
                    reason: 'Trimmed version exists, deleted whitespace duplicate'
                });
            } else {
                // No trimmed version exists - update the id to be trimmed
                await pool.query(
                    'UPDATE cases SET id = $1 WHERE id = $2 AND server_address = $3',
                    [trimmedId, untrimmedId, serverAddress]
                );
                fixed++;
                results.push({
                    step: 'update_id',
                    from: untrimmedId,
                    to: trimmedId
                });
            }
        }

        console.log(`✅ Fixed ${fixed} cases, deleted ${deleted} duplicates`);

        // Step 3: Verify no more whitespace cases exist
        const verifyQuery = await pool.query(`
            SELECT COUNT(*) as remaining FROM cases WHERE id != TRIM(id)
        `);

        results.push({
            step: 'verify',
            remainingWhitespace: parseInt(verifyQuery.rows[0].remaining)
        });

        res.json({
            success: true,
            message: `Fixed ${fixed} whitespace cases, deleted ${deleted} duplicates`,
            fixed,
            deleted,
            remainingWhitespace: parseInt(verifyQuery.rows[0].remaining),
            results
        });

    } catch (error) {
        console.error('Whitespace fix error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            results
        });
    }
});

/**
 * POST /api/cases/manual-mark-served
 * Manually mark a case as served when the automatic service-complete failed
 * but the NFT was successfully minted on blockchain.
 * Requires: caseNumber, transactionHash, serverAddress
 * Optional: alertTokenId, recipients, chain
 */
router.post('/cases/manual-mark-served', async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            caseNumber,
            transactionHash,
            alertTokenId,
            serverAddress,
            recipients,
            chain = 'tron-nile'
        } = req.body;

        if (!caseNumber || !transactionHash || !serverAddress) {
            return res.status(400).json({
                success: false,
                error: 'caseNumber, transactionHash, and serverAddress are required'
            });
        }

        const trimmedCaseNumber = caseNumber.trim();
        console.log(`\n========== MANUAL MARK SERVED: ${trimmedCaseNumber} ==========`);
        console.log(`Transaction: ${transactionHash}`);
        console.log(`Server: ${serverAddress}`);
        console.log(`Token ID: ${alertTokenId || 'N/A'}`);

        await client.query('BEGIN');

        // Step 1: Update cases table
        // Build metadata JSON separately to avoid type inference issues
        const metadataUpdate = JSON.stringify({
            manuallyMarkedServed: true,
            markedAt: new Date().toISOString(),
            transactionHash: transactionHash,
            alertTokenId: alertTokenId || null
        });

        const casesUpdate = await client.query(`
            UPDATE cases
            SET status = 'served',
                served_at = COALESCE(served_at, NOW()),
                updated_at = NOW(),
                tx_hash = $2,
                alert_nft_id = $3,
                metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb
            WHERE id = $1
            RETURNING id, status, served_at
        `, [trimmedCaseNumber, transactionHash, alertTokenId || null, metadataUpdate]);

        if (casesUpdate.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: `Case ${trimmedCaseNumber} not found in cases table`
            });
        }

        console.log(`✅ Cases table updated:`, casesUpdate.rows[0]);

        // Step 2: Create/update case_service_records
        const serviceRecord = await client.query(`
            INSERT INTO case_service_records (
                case_number,
                transaction_hash,
                alert_token_id,
                recipients,
                served_at,
                server_address,
                chain,
                status,
                created_at
            ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, 'served', NOW())
            ON CONFLICT (case_number)
            DO UPDATE SET
                transaction_hash = COALESCE(EXCLUDED.transaction_hash, case_service_records.transaction_hash),
                alert_token_id = COALESCE(EXCLUDED.alert_token_id, case_service_records.alert_token_id),
                recipients = COALESCE(EXCLUDED.recipients, case_service_records.recipients),
                served_at = COALESCE(case_service_records.served_at, NOW()),
                status = 'served',
                updated_at = NOW()
            RETURNING id, case_number, transaction_hash
        `, [
            trimmedCaseNumber,
            transactionHash,
            alertTokenId || null,
            JSON.stringify(recipients || []),
            serverAddress,
            chain
        ]);

        console.log(`✅ Service record created/updated:`, serviceRecord.rows[0]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Case ${trimmedCaseNumber} manually marked as served`,
            case: casesUpdate.rows[0],
            serviceRecord: serviceRecord.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Manual mark served error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

module.exports = router;