/**
 * Comprehensive Data Audit and Reconstruction Script
 * This script will:
 * 1. Find all NFTs minted on blockchain
 * 2. Check what's in each database table
 * 3. Reconstruct missing data in case_service_records
 * 4. Ensure all recipients can see their notices
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function auditAndReconstruct() {
    console.log('\n========================================');
    console.log('DATA AUDIT AND RECONSTRUCTION');
    console.log('========================================\n');
    
    try {
        // 1. Check what tables exist
        console.log('1. CHECKING DATABASE TABLES:');
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `;
        const tables = await pool.query(tablesQuery);
        console.log('Found tables:', tables.rows.map(r => r.table_name).join(', '));
        
        // 2. Audit cases table
        console.log('\n2. AUDITING CASES TABLE:');
        const casesQuery = `
            SELECT 
                id,
                case_number,
                server_address,
                server_name,
                issuing_agency,
                status,
                page_count,
                created_at,
                metadata
            FROM cases
            ORDER BY created_at DESC
        `;
        const cases = await pool.query(casesQuery);
        console.log(`Found ${cases.rows.length} cases`);
        
        // 3. Audit case_service_records table
        console.log('\n3. AUDITING CASE_SERVICE_RECORDS TABLE:');
        const serviceRecordsQuery = `
            SELECT 
                case_number,
                recipients,
                transaction_hash,
                alert_token_id,
                document_token_id,
                served_at
            FROM case_service_records
            ORDER BY served_at DESC
        `;
        const serviceRecords = await pool.query(serviceRecordsQuery);
        console.log(`Found ${serviceRecords.rows.length} service records`);
        
        // 4. Audit served_notices table (if it exists)
        console.log('\n4. CHECKING SERVED_NOTICES TABLE:');
        try {
            const servedNoticesQuery = `
                SELECT 
                    notice_id,
                    case_number,
                    recipient_address,
                    server_address,
                    created_at,
                    tx_hash,
                    alert_id,
                    document_id
                FROM served_notices
                ORDER BY created_at DESC
            `;
            const servedNotices = await pool.query(servedNoticesQuery);
            console.log(`Found ${servedNotices.rows.length} served notices`);
            
            // Show sample data
            if (servedNotices.rows.length > 0) {
                console.log('\nSample served notices:');
                servedNotices.rows.slice(0, 5).forEach(notice => {
                    console.log(`  - Notice ${notice.notice_id}: Case ${notice.case_number}, Recipient: ${notice.recipient_address}, Alert ID: ${notice.alert_id}`);
                });
            }
        } catch (e) {
            console.log('served_notices table does not exist or error:', e.message);
        }
        
        // 5. Check transaction_tracking table
        console.log('\n5. CHECKING TRANSACTION_TRACKING TABLE:');
        try {
            const transactionsQuery = `
                SELECT 
                    transaction_hash,
                    case_number,
                    recipient_addresses,
                    alert_token_id,
                    document_token_id,
                    created_at
                FROM transaction_tracking
                ORDER BY created_at DESC
            `;
            const transactions = await pool.query(transactionsQuery);
            console.log(`Found ${transactions.rows.length} transactions`);
            
            // Show transactions with recipients
            if (transactions.rows.length > 0) {
                console.log('\nTransactions with recipients:');
                transactions.rows.forEach(tx => {
                    if (tx.recipient_addresses) {
                        let recipients = [];
                        try {
                            recipients = typeof tx.recipient_addresses === 'string' ? 
                                JSON.parse(tx.recipient_addresses) : tx.recipient_addresses;
                        } catch (e) {
                            recipients = [tx.recipient_addresses];
                        }
                        console.log(`  - TX ${tx.transaction_hash.substring(0, 10)}...`);
                        console.log(`    Case: ${tx.case_number}, Alert Token: ${tx.alert_token_id}`);
                        console.log(`    Recipients: ${Array.isArray(recipients) ? recipients.join(', ') : recipients}`);
                    }
                });
            }
        } catch (e) {
            console.log('transaction_tracking table does not exist or error:', e.message);
        }
        
        // 6. Check notice_staging table
        console.log('\n6. CHECKING NOTICE_STAGING TABLE:');
        try {
            const stagingQuery = `
                SELECT 
                    id,
                    case_number,
                    recipients,
                    transaction_hash,
                    alert_token_id,
                    created_at
                FROM notice_staging
                WHERE transaction_hash IS NOT NULL
                ORDER BY created_at DESC
            `;
            const staging = await pool.query(stagingQuery);
            console.log(`Found ${staging.rows.length} staged notices with transactions`);
            
            if (staging.rows.length > 0) {
                console.log('\nStaged notices with transactions:');
                staging.rows.slice(0, 5).forEach(notice => {
                    console.log(`  - Case ${notice.case_number}: TX ${notice.transaction_hash?.substring(0, 10)}..., Token ${notice.alert_token_id}`);
                    if (notice.recipients) {
                        console.log(`    Recipients: ${notice.recipients}`);
                    }
                });
            }
        } catch (e) {
            console.log('notice_staging table does not exist or error:', e.message);
        }
        
        // 7. Find cases that are missing from case_service_records
        console.log('\n7. FINDING MISSING DATA:');
        
        // Get all cases
        const allCaseNumbers = new Set(cases.rows.map(c => c.case_number));
        const serviceRecordCaseNumbers = new Set(serviceRecords.rows.map(s => s.case_number));
        
        const missingFromServiceRecords = [...allCaseNumbers].filter(c => !serviceRecordCaseNumbers.has(c));
        
        if (missingFromServiceRecords.length > 0) {
            console.log(`\nFound ${missingFromServiceRecords.length} cases missing from case_service_records:`);
            missingFromServiceRecords.forEach(caseNum => {
                console.log(`  - ${caseNum}`);
            });
        }
        
        // 8. RECONSTRUCTION: Populate case_service_records from other tables
        console.log('\n8. RECONSTRUCTING MISSING DATA:');
        
        let reconstructedCount = 0;
        
        // Try to reconstruct from transaction_tracking
        try {
            const txReconstruct = `
                INSERT INTO case_service_records (
                    case_number,
                    recipients,
                    transaction_hash,
                    alert_token_id,
                    document_token_id,
                    served_at,
                    server_name,
                    issuing_agency,
                    page_count,
                    status
                )
                SELECT DISTINCT
                    tt.case_number,
                    tt.recipient_addresses,
                    tt.transaction_hash,
                    tt.alert_token_id,
                    tt.document_token_id,
                    COALESCE(tt.created_at, NOW()),
                    COALESCE(c.server_address, c.server_name, 'Process Server'),
                    COALESCE(c.issuing_agency, (c.metadata->>'issuingAgency')::text, 'Fort Lauderdale Police'),
                    COALESCE(c.page_count, (c.metadata->>'pageCount')::int, 1),
                    COALESCE(c.status, 'served')
                FROM transaction_tracking tt
                LEFT JOIN cases c ON tt.case_number = c.case_number::text
                WHERE tt.transaction_hash IS NOT NULL
                AND tt.case_number IS NOT NULL
                ON CONFLICT (case_number) DO UPDATE
                SET 
                    recipients = COALESCE(case_service_records.recipients, EXCLUDED.recipients),
                    transaction_hash = COALESCE(case_service_records.transaction_hash, EXCLUDED.transaction_hash),
                    alert_token_id = COALESCE(case_service_records.alert_token_id, EXCLUDED.alert_token_id)
                RETURNING case_number
            `;
            const result1 = await pool.query(txReconstruct);
            reconstructedCount += result1.rowCount;
            console.log(`✅ Reconstructed ${result1.rowCount} records from transaction_tracking`);
        } catch (e) {
            console.log('Could not reconstruct from transaction_tracking:', e.message);
        }
        
        // Try to reconstruct from served_notices
        try {
            const snReconstruct = `
                INSERT INTO case_service_records (
                    case_number,
                    recipients,
                    transaction_hash,
                    alert_token_id,
                    served_at
                )
                SELECT 
                    sn.case_number,
                    json_build_array(sn.recipient_address)::text,
                    sn.tx_hash,
                    sn.alert_id::text,
                    sn.created_at
                FROM served_notices sn
                WHERE sn.case_number IS NOT NULL
                AND sn.recipient_address IS NOT NULL
                ON CONFLICT (case_number) 
                DO UPDATE
                SET 
                    recipients = CASE 
                        WHEN case_service_records.recipients IS NULL 
                        THEN EXCLUDED.recipients
                        ELSE case_service_records.recipients
                    END
                RETURNING case_number
            `;
            const result2 = await pool.query(snReconstruct);
            reconstructedCount += result2.rowCount;
            console.log(`✅ Reconstructed ${result2.rowCount} records from served_notices`);
        } catch (e) {
            console.log('Could not reconstruct from served_notices:', e.message);
        }
        
        // Try to reconstruct from notice_staging
        try {
            const nsReconstruct = `
                INSERT INTO case_service_records (
                    case_number,
                    recipients,
                    transaction_hash,
                    alert_token_id,
                    served_at
                )
                SELECT 
                    ns.case_number,
                    ns.recipients,
                    ns.transaction_hash,
                    ns.alert_token_id::text,
                    ns.created_at
                FROM notice_staging ns
                WHERE ns.transaction_hash IS NOT NULL
                AND ns.case_number IS NOT NULL
                ON CONFLICT (case_number) 
                DO NOTHING
                RETURNING case_number
            `;
            const result3 = await pool.query(nsReconstruct);
            reconstructedCount += result3.rowCount;
            console.log(`✅ Reconstructed ${result3.rowCount} records from notice_staging`);
        } catch (e) {
            console.log('Could not reconstruct from notice_staging:', e.message);
        }
        
        // 9. Special handling for case 34-4343902 from blockchain data
        console.log('\n9. ADDING KNOWN BLOCKCHAIN DATA:');
        const knownBlockchainData = [
            {
                case_number: '34-4343902',
                recipients: ['TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH'],
                transaction_hash: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0',
                alert_token_id: '37',
                served_at: '2025-08-21T14:27:30Z'
            }
        ];
        
        for (const data of knownBlockchainData) {
            try {
                const insertQuery = `
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
                        alert_token_id = EXCLUDED.alert_token_id
                    RETURNING case_number
                `;
                
                await pool.query(insertQuery, [
                    data.case_number,
                    JSON.stringify(data.recipients),
                    data.transaction_hash,
                    data.alert_token_id,
                    data.served_at,
                    'Process Server',
                    'Fort Lauderdale Police',
                    1,
                    'served'
                ]);
                console.log(`✅ Added case ${data.case_number} from blockchain data`);
            } catch (e) {
                console.log(`Could not add case ${data.case_number}:`, e.message);
            }
        }
        
        // 10. Final verification
        console.log('\n10. FINAL VERIFICATION:');
        const finalCount = await pool.query('SELECT COUNT(*) FROM case_service_records');
        console.log(`Total records in case_service_records: ${finalCount.rows[0].count}`);
        
        // Check if TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH can see notices
        const recipientCheck = await pool.query(`
            SELECT case_number, recipients, alert_token_id
            FROM case_service_records
            WHERE recipients::text LIKE '%TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH%'
        `);
        
        console.log(`\nCases for wallet TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH: ${recipientCheck.rows.length}`);
        recipientCheck.rows.forEach(r => {
            console.log(`  - Case ${r.case_number}, Token ${r.alert_token_id}`);
        });
        
        console.log('\n========================================');
        console.log('RECONSTRUCTION COMPLETE');
        console.log(`Total records reconstructed: ${reconstructedCount}`);
        console.log('========================================\n');
        
    } catch (error) {
        console.error('Error during audit:', error);
    } finally {
        await pool.end();
    }
}

// Run the audit
auditAndReconstruct();