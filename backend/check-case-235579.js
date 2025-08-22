/**
 * Check specific case 34-2312-235579 data
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
});

async function checkCase() {
    const caseNumber = '34-2312-235579';
    
    try {
        console.log('\n===========================================');
        console.log(`Checking Case: ${caseNumber}`);
        console.log('===========================================\n');
        
        // 1. Check cases table
        console.log('1. CASES TABLE:');
        console.log('---------------');
        const caseResult = await pool.query(
            'SELECT * FROM cases WHERE case_number = $1',
            [caseNumber]
        );
        
        if (caseResult.rows.length > 0) {
            const caseData = caseResult.rows[0];
            console.log('  Status:', caseData.status);
            console.log('  Server Address:', caseData.server_address);
            console.log('  Created:', caseData.created_at);
            console.log('  Updated:', caseData.updated_at);
            console.log('  Metadata:', JSON.stringify(caseData.metadata, null, 2));
        } else {
            console.log('  ❌ NOT FOUND in cases table');
        }
        
        // 2. Check case_service_records
        console.log('\n2. CASE SERVICE RECORDS:');
        console.log('------------------------');
        const serviceResult = await pool.query(
            'SELECT * FROM case_service_records WHERE case_number = $1',
            [caseNumber]
        );
        
        if (serviceResult.rows.length > 0) {
            const serviceData = serviceResult.rows[0];
            console.log('  Transaction Hash:', serviceData.transaction_hash);
            console.log('  Alert Token ID:', serviceData.alert_token_id);
            console.log('  Document Token ID:', serviceData.document_token_id);
            console.log('  IPFS Hash:', serviceData.ipfs_hash?.substring(0, 50) + '...');
            console.log('  Encryption Key:', serviceData.encryption_key ? 'Present' : 'Missing');
            console.log('  Recipients:', serviceData.recipients);
            console.log('  Page Count:', serviceData.page_count);
            console.log('  Served At:', serviceData.served_at);
            console.log('  Server Address:', serviceData.server_address);
        } else {
            console.log('  ❌ NOT FOUND in service records');
        }
        
        // 3. Check notice_images
        console.log('\n3. NOTICE IMAGES:');
        console.log('-----------------');
        const imagesResult = await pool.query(
            'SELECT case_number, created_at, LENGTH(alert_image) as alert_size, LENGTH(document_preview) as doc_size FROM notice_images WHERE case_number = $1',
            [caseNumber]
        );
        
        if (imagesResult.rows.length > 0) {
            const imageData = imagesResult.rows[0];
            console.log('  Alert Image Size:', imageData.alert_size, 'bytes');
            console.log('  Document Preview Size:', imageData.doc_size, 'bytes');
            console.log('  Created:', imageData.created_at);
        } else {
            console.log('  ❌ NOT FOUND in notice_images');
        }
        
        // 4. Check what the API would return
        console.log('\n4. API RESPONSE (What frontend would receive):');
        console.log('-----------------------------------------------');
        
        // Simulate the API query
        const apiResult = await pool.query(`
            SELECT 
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
                ni.alert_image IS NOT NULL as has_alert_image,
                ni.document_preview IS NOT NULL as has_document_preview
            FROM cases c
            LEFT JOIN case_service_records csr ON c.case_number = csr.case_number
            LEFT JOIN notice_images ni ON c.case_number = ni.case_number
            WHERE c.case_number = $1
        `, [caseNumber]);
        
        if (apiResult.rows.length > 0) {
            console.log(JSON.stringify(apiResult.rows[0], null, 2));
        } else {
            console.log('  ❌ No data would be returned');
        }
        
        // 5. Check for any audit logs
        console.log('\n5. RECENT AUDIT LOGS FOR THIS CASE:');
        console.log('------------------------------------');
        const auditResult = await pool.query(`
            SELECT action_type, actor_address, created_at 
            FROM audit_logs 
            WHERE target_id = $1 OR details::text LIKE $2
            ORDER BY created_at DESC
            LIMIT 5
        `, [caseNumber, `%${caseNumber}%`]);
        
        if (auditResult.rows.length > 0) {
            auditResult.rows.forEach(log => {
                console.log(`  ${log.created_at}: ${log.action_type} by ${log.actor_address?.substring(0, 10)}...`);
            });
        } else {
            console.log('  No audit logs found');
        }
        
        console.log('\n===========================================\n');
        
    } catch (error) {
        console.error('Error checking case:', error);
    } finally {
        await pool.end();
    }
}

checkCase();