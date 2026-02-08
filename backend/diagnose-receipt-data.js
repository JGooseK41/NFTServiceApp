/**
 * Diagnose receipt data flow
 * Run with: node diagnose-receipt-data.js <case_number>
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function diagnose(caseNumber) {
    console.log(`\n========== DIAGNOSING RECEIPT DATA FOR CASE: ${caseNumber} ==========\n`);

    try {
        // 1. Check cases table
        console.log('1. CASES TABLE:');
        const casesResult = await pool.query(`
            SELECT id, server_address, status, metadata, created_at, served_at
            FROM cases
            WHERE id = $1 OR id::text = $1
        `, [caseNumber]);

        if (casesResult.rows.length === 0) {
            console.log('   ❌ Case NOT FOUND in cases table');
        } else {
            const row = casesResult.rows[0];
            console.log('   ✅ Case found in cases table');
            console.log('   - ID:', row.id);
            console.log('   - Status:', row.status);
            console.log('   - Server:', row.server_address);
            console.log('   - Served At:', row.served_at);

            // Check metadata for tx hash and token ID
            const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
            if (metadata) {
                console.log('   - Metadata transactionHash:', metadata.transactionHash || 'NOT SET');
                console.log('   - Metadata alertTokenId:', metadata.alertTokenId || 'NOT SET');
            }
        }

        // 2. Check case_service_records table
        console.log('\n2. CASE_SERVICE_RECORDS TABLE:');
        const csrResult = await pool.query(`
            SELECT case_number, transaction_hash, alert_token_id, document_token_id,
                   ipfs_hash, served_at, server_address, chain
            FROM case_service_records
            WHERE case_number = $1
        `, [caseNumber]);

        if (csrResult.rows.length === 0) {
            console.log('   ❌ Case NOT FOUND in case_service_records');
        } else {
            const row = csrResult.rows[0];
            console.log('   ✅ Record found in case_service_records');
            console.log('   - Case Number:', row.case_number);
            console.log('   - Transaction Hash:', row.transaction_hash || '❌ NOT SET');
            console.log('   - Alert Token ID:', row.alert_token_id || '❌ NOT SET');
            console.log('   - Document Token ID:', row.document_token_id || 'N/A (Lite contract)');
            console.log('   - IPFS Hash:', row.ipfs_hash || 'NOT SET');
            console.log('   - Served At:', row.served_at);
            console.log('   - Server:', row.server_address);
            console.log('   - Chain:', row.chain);
        }

        // 3. Check JOIN result (as used by /service-data endpoint)
        console.log('\n3. JOIN RESULT (as used by /api/cases/:id/service-data):');
        const joinResult = await pool.query(`
            SELECT
                c.id,
                c.status,
                c.metadata,
                csr.transaction_hash,
                csr.alert_token_id,
                csr.document_token_id,
                csr.served_at as csr_served_at
            FROM cases c
            LEFT JOIN case_service_records csr ON (c.id::text = csr.case_number)
            WHERE c.id = $1 OR c.id::text = $1
        `, [caseNumber]);

        if (joinResult.rows.length === 0) {
            console.log('   ❌ No result from JOIN query');
        } else {
            const row = joinResult.rows[0];
            console.log('   - Case ID:', row.id);
            console.log('   - Status:', row.status);
            console.log('   - Transaction Hash from JOIN:', row.transaction_hash || '❌ NULL/NOT JOINED');
            console.log('   - Alert Token ID from JOIN:', row.alert_token_id || '❌ NULL/NOT JOINED');
        }

        // 4. List all case_service_records (last 10)
        console.log('\n4. RECENT CASE_SERVICE_RECORDS (last 10):');
        const recentCSR = await pool.query(`
            SELECT case_number, transaction_hash, alert_token_id, served_at
            FROM case_service_records
            ORDER BY created_at DESC
            LIMIT 10
        `);

        for (const row of recentCSR.rows) {
            console.log(`   - ${row.case_number}: txHash=${row.transaction_hash ? 'YES' : 'NO'}, tokenId=${row.alert_token_id || 'N/A'}`);
        }

        console.log('\n========== DIAGNOSIS COMPLETE ==========\n');

    } catch (error) {
        console.error('Error during diagnosis:', error);
    } finally {
        await pool.end();
    }
}

// Run with case number from command line
const caseNumber = process.argv[2];
if (!caseNumber) {
    console.log('Usage: node diagnose-receipt-data.js <case_number>');
    console.log('Example: node diagnose-receipt-data.js "test case 1"');
    process.exit(1);
}

diagnose(caseNumber);
