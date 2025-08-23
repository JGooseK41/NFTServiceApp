/**
 * Find ALL historical served notices across all tables
 * This will search every possible table for case data
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function findAllHistoricalData() {
    console.log('\n========================================');
    console.log('SEARCHING FOR ALL HISTORICAL DATA');
    console.log('========================================\n');
    
    const allCasesFound = new Map(); // case_number -> data
    
    try {
        // 1. Check all tables that exist
        console.log('1. FINDING ALL TABLES:');
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `;
        const tables = await pool.query(tablesQuery);
        console.log('Tables found:', tables.rows.map(r => r.table_name).join(', '));
        console.log('');

        // 2. Search cases table
        console.log('2. SEARCHING CASES TABLE:');
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
                    metadata,
                    (metadata->>'recipients')::text as metadata_recipients,
                    (metadata->>'transaction_hash')::text as metadata_tx,
                    (metadata->>'alert_token_id')::text as metadata_alert_id,
                    (metadata->>'document_token_id')::text as metadata_doc_id
                FROM cases
                ORDER BY created_at DESC
            `;
            const cases = await pool.query(casesQuery);
            console.log(`Found ${cases.rows.length} cases`);
            
            cases.rows.forEach(c => {
                if (!allCasesFound.has(c.case_number)) {
                    allCasesFound.set(c.case_number, {
                        case_number: c.case_number,
                        server_name: c.server_name || c.server_address,
                        issuing_agency: c.issuing_agency,
                        page_count: c.page_count,
                        status: c.status,
                        created_at: c.created_at,
                        recipients: c.metadata_recipients ? [c.metadata_recipients] : [],
                        transaction_hash: c.metadata_tx,
                        alert_token_id: c.metadata_alert_id,
                        document_token_id: c.metadata_doc_id
                    });
                }
                console.log(`  - Case ${c.case_number}: Created ${c.created_at}`);
            });
        } catch (e) {
            console.log('Error reading cases:', e.message);
        }

        // 3. Search notice_images table (might have case data)
        console.log('\n3. SEARCHING NOTICE_IMAGES TABLE:');
        try {
            const imagesQuery = `
                SELECT 
                    notice_id,
                    case_number,
                    recipient_address,
                    created_at,
                    metadata
                FROM notice_images
                WHERE case_number IS NOT NULL
                ORDER BY created_at DESC
            `;
            const images = await pool.query(imagesQuery);
            console.log(`Found ${images.rows.length} notice images with case numbers`);
            
            images.rows.forEach(img => {
                const existing = allCasesFound.get(img.case_number) || {};
                if (img.recipient_address && !existing.recipients?.includes(img.recipient_address)) {
                    if (!existing.recipients) existing.recipients = [];
                    existing.recipients.push(img.recipient_address);
                }
                allCasesFound.set(img.case_number, {
                    ...existing,
                    case_number: img.case_number,
                    has_images: true
                });
                console.log(`  - Case ${img.case_number}: Has images, Recipient: ${img.recipient_address}`);
            });
        } catch (e) {
            console.log('Error reading notice_images:', e.message);
        }

        // 4. Search notice_views table
        console.log('\n4. SEARCHING NOTICE_VIEWS TABLE:');
        try {
            const viewsQuery = `
                SELECT DISTINCT
                    notice_id,
                    viewer_address,
                    created_at
                FROM notice_views
                ORDER BY created_at DESC
            `;
            const views = await pool.query(viewsQuery);
            console.log(`Found ${views.rows.length} notice views`);
            
            // Try to match notice_id to case numbers
            views.rows.slice(0, 10).forEach(v => {
                console.log(`  - Notice ${v.notice_id} viewed by ${v.viewer_address}`);
            });
        } catch (e) {
            console.log('Error reading notice_views:', e.message);
        }

        // 5. Search alert_metadata table
        console.log('\n5. SEARCHING ALERT_METADATA TABLE:');
        try {
            const alertQuery = `
                SELECT 
                    alert_id,
                    case_number,
                    recipient_address,
                    server_address,
                    transaction_hash,
                    created_at
                FROM alert_metadata
                ORDER BY created_at DESC
            `;
            const alerts = await pool.query(alertQuery);
            console.log(`Found ${alerts.rows.length} alert metadata records`);
            
            alerts.rows.forEach(alert => {
                const existing = allCasesFound.get(alert.case_number) || {};
                if (alert.recipient_address && !existing.recipients?.includes(alert.recipient_address)) {
                    if (!existing.recipients) existing.recipients = [];
                    existing.recipients.push(alert.recipient_address);
                }
                allCasesFound.set(alert.case_number, {
                    ...existing,
                    case_number: alert.case_number,
                    transaction_hash: alert.transaction_hash || existing.transaction_hash,
                    alert_token_id: alert.alert_id || existing.alert_token_id,
                    server_name: alert.server_address || existing.server_name
                });
                console.log(`  - Alert ${alert.alert_id}: Case ${alert.case_number}, Recipient: ${alert.recipient_address}`);
            });
        } catch (e) {
            console.log('Error reading alert_metadata:', e.message);
        }

        // 6. Check for any blockchain transaction logs
        console.log('\n6. SEARCHING FOR ANY TRANSACTION LOGS:');
        const transactionTables = ['transaction_tracking', 'blockchain_transactions', 'nft_mints', 'mint_logs'];
        for (const tableName of transactionTables) {
            try {
                const query = `SELECT * FROM ${tableName} LIMIT 5`;
                const result = await pool.query(query);
                console.log(`  ✓ Found table ${tableName} with ${result.rowCount} sample rows`);
                
                // Get all records
                const allQuery = `SELECT * FROM ${tableName}`;
                const allResults = await pool.query(allQuery);
                allResults.rows.forEach(row => {
                    if (row.case_number) {
                        const existing = allCasesFound.get(row.case_number) || {};
                        if (row.recipient_addresses || row.recipients) {
                            const recipients = row.recipient_addresses || row.recipients;
                            if (typeof recipients === 'string') {
                                try {
                                    const parsed = JSON.parse(recipients);
                                    existing.recipients = parsed;
                                } catch {
                                    existing.recipients = [recipients];
                                }
                            }
                        }
                        allCasesFound.set(row.case_number, {
                            ...existing,
                            case_number: row.case_number,
                            transaction_hash: row.transaction_hash || row.tx_hash || existing.transaction_hash,
                            alert_token_id: row.alert_token_id || row.alert_id || existing.alert_token_id
                        });
                    }
                });
            } catch (e) {
                // Table doesn't exist, skip
            }
        }

        // 7. Summary of all cases found
        console.log('\n========================================');
        console.log('SUMMARY OF ALL CASES FOUND:');
        console.log('========================================\n');
        
        console.log(`Total unique cases found: ${allCasesFound.size}`);
        
        // Group by recipient
        const recipientMap = new Map();
        allCasesFound.forEach((caseData, caseNumber) => {
            if (caseData.recipients && caseData.recipients.length > 0) {
                caseData.recipients.forEach(recipient => {
                    if (!recipientMap.has(recipient)) {
                        recipientMap.set(recipient, []);
                    }
                    recipientMap.get(recipient).push(caseNumber);
                });
            }
        });
        
        console.log(`\nTotal unique recipient wallets: ${recipientMap.size}`);
        console.log('\nRecipients and their cases:');
        recipientMap.forEach((cases, recipient) => {
            console.log(`  ${recipient}: ${cases.length} case(s)`);
            cases.forEach(c => console.log(`    - ${c}`));
        });

        // 8. Check what's currently in case_service_records
        console.log('\n========================================');
        console.log('CURRENT CASE_SERVICE_RECORDS:');
        console.log('========================================\n');
        
        const currentRecords = await pool.query('SELECT case_number, recipients, alert_token_id FROM case_service_records');
        console.log(`Currently have ${currentRecords.rows.length} records in case_service_records`);
        currentRecords.rows.forEach(r => {
            console.log(`  - ${r.case_number}: Token ${r.alert_token_id}, Recipients: ${r.recipients}`);
        });

        // 9. Identify what needs to be added
        console.log('\n========================================');
        console.log('CASES TO BE RECONSTRUCTED:');
        console.log('========================================\n');
        
        const existingCaseNumbers = new Set(currentRecords.rows.map(r => r.case_number));
        const toReconstruct = [];
        
        allCasesFound.forEach((caseData, caseNumber) => {
            if (!existingCaseNumbers.has(caseNumber) && caseData.recipients && caseData.recipients.length > 0) {
                toReconstruct.push(caseData);
                console.log(`  - ${caseNumber}: Recipients: ${caseData.recipients.join(', ')}`);
            }
        });
        
        console.log(`\nNeed to reconstruct ${toReconstruct.length} cases`);
        
        // 10. Perform reconstruction
        if (toReconstruct.length > 0) {
            console.log('\n========================================');
            console.log('PERFORMING RECONSTRUCTION:');
            console.log('========================================\n');
            
            for (const caseData of toReconstruct) {
                try {
                    const insertQuery = `
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
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        ON CONFLICT (case_number) DO NOTHING
                    `;
                    
                    await pool.query(insertQuery, [
                        caseData.case_number,
                        JSON.stringify(caseData.recipients),
                        caseData.transaction_hash,
                        caseData.alert_token_id,
                        caseData.document_token_id,
                        caseData.created_at || new Date(),
                        caseData.server_name || 'Process Server',
                        caseData.issuing_agency || 'Fort Lauderdale Police',
                        caseData.page_count || 1,
                        caseData.status || 'served'
                    ]);
                    console.log(`  ✓ Reconstructed case ${caseData.case_number}`);
                } catch (e) {
                    console.log(`  ✗ Failed to reconstruct ${caseData.case_number}: ${e.message}`);
                }
            }
        }
        
        // Final verification
        const finalCount = await pool.query('SELECT COUNT(*) FROM case_service_records');
        console.log(`\n✅ Final count in case_service_records: ${finalCount.rows[0].count}`);
        
    } catch (error) {
        console.error('Error during search:', error);
    } finally {
        await pool.end();
    }
}

// Run the search
findAllHistoricalData();