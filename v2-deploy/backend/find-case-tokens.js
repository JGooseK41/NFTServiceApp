/**
 * Find tokens for specific case
 * Search all tables for case 34-2501-8285700
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function findCaseTokens() {
    try {
        const caseNumber = '34-2501-8285700';
        
        console.log('\n🔍 SEARCHING FOR CASE:', caseNumber);
        console.log('=' .repeat(60));
        
        // 1. Check notice_components
        console.log('\n1. NOTICE_COMPONENTS TABLE:');
        console.log('-'.repeat(40));
        
        const ncResult = await pool.query(`
            SELECT 
                notice_id,
                case_number,
                recipient_address,
                server_address,
                notice_type,
                issuing_agency,
                created_at,
                LENGTH(alert_thumbnail_data) as alert_size,
                LENGTH(document_data) as doc_size
            FROM notice_components
            WHERE case_number = $1
        `, [caseNumber]);
        
        if (ncResult.rows.length > 0) {
            console.log(`Found ${ncResult.rows.length} records:`);
            ncResult.rows.forEach(row => {
                console.log(`\nNotice ID: ${row.notice_id}`);
                console.log(`  Recipient: ${row.recipient_address}`);
                console.log(`  Server: ${row.server_address}`);
                console.log(`  Type: ${row.notice_type}`);
                console.log(`  Agency: ${row.issuing_agency}`);
                console.log(`  Alert Size: ${row.alert_size ? (row.alert_size / 1024).toFixed(2) + ' KB' : 'NULL'}`);
                console.log(`  Document Size: ${row.doc_size ? (row.doc_size / 1024).toFixed(2) + ' KB' : 'NULL'}`);
                console.log(`  Created: ${row.created_at}`);
            });
        } else {
            console.log('❌ No records found');
        }
        
        // 2. Check served_notices
        console.log('\n2. SERVED_NOTICES TABLE:');
        console.log('-'.repeat(40));
        
        const snResult = await pool.query(`
            SELECT 
                notice_id,
                alert_id,
                document_id,
                recipient_address,
                server_address,
                status,
                created_at
            FROM served_notices
            WHERE case_number = $1
            ORDER BY created_at DESC
        `, [caseNumber]);
        
        if (snResult.rows.length > 0) {
            console.log(`Found ${snResult.rows.length} records:`);
            snResult.rows.forEach(row => {
                console.log(`\nNotice ID: ${row.notice_id}`);
                console.log(`  Alert ID: ${row.alert_id || 'NULL'}`);
                console.log(`  Document ID: ${row.document_id || 'NULL'}`);
                console.log(`  Recipient: ${row.recipient_address}`);
                console.log(`  Server: ${row.server_address}`);
                console.log(`  Status: ${row.status}`);
                console.log(`  Created: ${row.created_at}`);
            });
        } else {
            console.log('❌ No records found');
        }
        
        // 3. Check documents table
        console.log('\n3. DOCUMENTS TABLE:');
        console.log('-'.repeat(40));
        
        const docResult = await pool.query(`
            SELECT 
                id,
                notice_id,
                case_number,
                LENGTH(alert_thumbnail) as alert_size,
                LENGTH(document_full) as doc_size,
                created_at
            FROM documents
            WHERE case_number = $1
        `, [caseNumber]);
        
        if (docResult.rows.length > 0) {
            console.log(`Found ${docResult.rows.length} records:`);
            docResult.rows.forEach(row => {
                console.log(`\nID: ${row.id}, Notice ID: ${row.notice_id}`);
                console.log(`  Alert Size: ${row.alert_size ? (row.alert_size / 1024).toFixed(2) + ' KB' : 'NULL'}`);
                console.log(`  Document Size: ${row.doc_size ? (row.doc_size / 1024).toFixed(2) + ' KB' : 'NULL'}`);
                console.log(`  Created: ${row.created_at}`);
            });
        } else {
            console.log('❌ No records found');
        }
        
        // 4. Check blockchain_documents
        console.log('\n4. BLOCKCHAIN_DOCUMENTS TABLE:');
        console.log('-'.repeat(40));
        
        const bcResult = await pool.query(`
            SELECT 
                id,
                notice_id,
                case_number,
                LENGTH(alert_thumbnail_data) as alert_size,
                LENGTH(document_data) as doc_size,
                created_at
            FROM blockchain_documents
            WHERE case_number = $1
        `, [caseNumber]);
        
        if (bcResult.rows.length > 0) {
            console.log(`Found ${bcResult.rows.length} records:`);
            bcResult.rows.forEach(row => {
                console.log(`\nID: ${row.id}, Notice ID: ${row.notice_id}`);
                console.log(`  Alert Size: ${row.alert_size ? (row.alert_size / 1024).toFixed(2) + ' KB' : 'NULL'}`);
                console.log(`  Document Size: ${row.doc_size ? (row.doc_size / 1024).toFixed(2) + ' KB' : 'NULL'}`);
                console.log(`  Created: ${row.created_at}`);
            });
        } else {
            console.log('❌ No records found');
        }
        
        // 5. Summary of token IDs found
        console.log('\n5. SUMMARY OF TOKEN IDS:');
        console.log('-'.repeat(40));
        
        const tokenSummary = await pool.query(`
            SELECT DISTINCT
                'served_notices' as source,
                alert_id as token_id,
                'alert' as token_type
            FROM served_notices
            WHERE case_number = $1 AND alert_id IS NOT NULL
            UNION
            SELECT DISTINCT
                'served_notices' as source,
                document_id as token_id,
                'document' as token_type
            FROM served_notices
            WHERE case_number = $1 AND document_id IS NOT NULL
            ORDER BY token_type, token_id
        `, [caseNumber]);
        
        if (tokenSummary.rows.length > 0) {
            console.log('Token IDs found:');
            tokenSummary.rows.forEach(row => {
                console.log(`  ${row.token_type.toUpperCase()} Token: ${row.token_id}`);
            });
        } else {
            console.log('No token IDs found in served_notices');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('SEARCH COMPLETE');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

findCaseTokens();