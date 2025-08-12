/**
 * Debug Notice Images
 * Check what's happening with a specific notice
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function debugNotice(noticeId) {
    try {
        console.log(`\n🔍 Debugging Notice ID: ${noticeId}\n`);
        
        // Check notice_components table
        console.log('1. Checking notice_components table...');
        const componentsResult = await pool.query(`
            SELECT 
                id,
                alert_token_id,
                document_token_id,
                CASE 
                    WHEN alert_thumbnail_data IS NOT NULL THEN 'Yes (' || LENGTH(alert_thumbnail_data) || ' chars)'
                    ELSE 'No'
                END as has_alert_data,
                alert_thumbnail_mime_type,
                alert_thumbnail_url,
                CASE 
                    WHEN document_data IS NOT NULL THEN 'Yes (' || LENGTH(document_data) || ' chars)'
                    ELSE 'No'
                END as has_document_data,
                document_mime_type,
                document_unencrypted_url,
                created_at
            FROM notice_components
            WHERE alert_token_id = $1 OR document_token_id = $1
        `, [noticeId]);
        
        if (componentsResult.rows.length > 0) {
            console.log('✅ Found in notice_components:');
            console.table(componentsResult.rows);
        } else {
            console.log('❌ Not found in notice_components');
        }
        
        // Check documents table
        console.log('\n2. Checking documents table...');
        const documentsResult = await pool.query(`
            SELECT 
                id,
                notice_id,
                case_number,
                CASE 
                    WHEN alert_thumbnail IS NOT NULL THEN 'Yes (' || LENGTH(alert_thumbnail) || ' chars)'
                    ELSE 'No'
                END as has_alert_thumbnail,
                CASE 
                    WHEN document_full IS NOT NULL THEN 'Yes (' || LENGTH(document_full) || ' chars)'
                    ELSE 'No'
                END as has_document_full,
                created_at
            FROM documents
            WHERE notice_id = $1
        `, [noticeId]);
        
        if (documentsResult.rows.length > 0) {
            console.log('✅ Found in documents:');
            console.table(documentsResult.rows);
        } else {
            console.log('❌ Not found in documents');
        }
        
        // Check token_tracking table
        console.log('\n3. Checking token_tracking table...');
        const tokenResult = await pool.query(`
            SELECT 
                token_id,
                token_type,
                case_number,
                recipient_address,
                server_address,
                ipfs_hash,
                created_at
            FROM token_tracking
            WHERE token_id = $1
        `, [noticeId]);
        
        if (tokenResult.rows.length > 0) {
            console.log('✅ Found in token_tracking:');
            console.table(tokenResult.rows);
        } else {
            console.log('❌ Not found in token_tracking');
        }
        
        // Check blockchain_documents table
        console.log('\n4. Checking blockchain_documents table...');
        const blockchainResult = await pool.query(`
            SELECT 
                id,
                notice_id,
                case_number,
                CASE 
                    WHEN alert_thumbnail_data IS NOT NULL THEN 'Yes (' || LENGTH(alert_thumbnail_data) || ' chars)'
                    ELSE 'No'
                END as has_alert_data,
                CASE 
                    WHEN document_data IS NOT NULL THEN 'Yes (' || LENGTH(document_data) || ' chars)'
                    ELSE 'No'
                END as has_document_data,
                created_at
            FROM blockchain_documents
            WHERE notice_id = $1 OR notice_id = $1::text
        `, [noticeId]);
        
        if (blockchainResult.rows.length > 0) {
            console.log('✅ Found in blockchain_documents:');
            console.table(blockchainResult.rows);
        } else {
            console.log('❌ Not found in blockchain_documents');
        }
        
        // Check all tables for case number
        console.log('\n5. Searching all tables for case 34-2501-8285700...');
        
        const caseSearch = await pool.query(`
            SELECT 'notice_components' as table_name, COUNT(*) as count
            FROM notice_components
            WHERE case_number = '34-2501-8285700'
            UNION ALL
            SELECT 'documents' as table_name, COUNT(*) as count
            FROM documents
            WHERE case_number = '34-2501-8285700'
            UNION ALL
            SELECT 'blockchain_documents' as table_name, COUNT(*) as count
            FROM blockchain_documents
            WHERE case_number = '34-2501-8285700'
        `);
        
        console.log('Records by table for case 34-2501-8285700:');
        console.table(caseSearch.rows);
        
        // Get the actual alert and document IDs for this case
        console.log('\n6. Looking for related notice IDs...');
        const relatedNotices = await pool.query(`
            SELECT DISTINCT notice_id, alert_token_id, document_token_id, case_number
            FROM (
                SELECT notice_id, alert_token_id, document_token_id, case_number
                FROM notice_components
                WHERE case_number = '34-2501-8285700'
                UNION
                SELECT notice_id::integer, NULL, NULL, case_number
                FROM documents
                WHERE case_number = '34-2501-8285700'
                UNION
                SELECT notice_id::integer, NULL, NULL, case_number
                FROM blockchain_documents
                WHERE case_number = '34-2501-8285700'
            ) as all_notices
        `);
        
        if (relatedNotices.rows.length > 0) {
            console.log('Found related notices:');
            console.table(relatedNotices.rows);
        }
        
        console.log('\n📊 Summary:');
        console.log('- Notice ID requested:', noticeId);
        console.log('- Case number:', '34-2501-8285700');
        console.log('- Components found:', componentsResult.rows.length > 0 ? 'Yes' : 'No');
        console.log('- Documents found:', documentsResult.rows.length > 0 ? 'Yes' : 'No');
        
    } catch (error) {
        console.error('Error debugging notice:', error);
    } finally {
        await pool.end();
    }
}

// Run the debug
const noticeId = process.argv[2] || '943220202';
debugNotice(noticeId);