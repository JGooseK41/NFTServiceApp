/**
 * Find Actual Token IDs in Database
 * Check what token IDs were actually minted
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function findActualTokens() {
    try {
        console.log('\n🔍 FINDING ACTUAL TOKEN IDS IN DATABASE');
        console.log('=' .repeat(60));
        
        // 1. Check notice_components for token IDs
        console.log('\n1. TOKENS IN NOTICE_COMPONENTS:');
        console.log('-'.repeat(40));
        
        const componentsResult = await pool.query(`
            SELECT 
                alert_token_id,
                document_token_id,
                case_number,
                recipient_address,
                server_address,
                created_at
            FROM notice_components
            WHERE alert_token_id IS NOT NULL 
               OR document_token_id IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 20
        `);
        
        console.log(`Found ${componentsResult.rows.length} records with token IDs:\n`);
        
        componentsResult.rows.forEach(row => {
            console.log(`Case: ${row.case_number}`);
            console.log(`  Alert Token: ${row.alert_token_id || 'NULL'}`);
            console.log(`  Document Token: ${row.document_token_id || 'NULL'}`);
            console.log(`  Recipient: ${row.recipient_address}`);
            console.log(`  Server: ${row.server_address}`);
            console.log(`  Created: ${row.created_at}`);
            console.log('');
        });
        
        // 2. Check served_notices for token IDs
        console.log('\n2. TOKENS IN SERVED_NOTICES:');
        console.log('-'.repeat(40));
        
        const servedResult = await pool.query(`
            SELECT 
                notice_id,
                alert_id,
                document_id,
                case_number,
                recipient_address,
                server_address,
                status,
                created_at
            FROM served_notices
            WHERE alert_id IS NOT NULL 
               OR document_id IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 20
        `);
        
        console.log(`Found ${servedResult.rows.length} served notices with token IDs:\n`);
        
        servedResult.rows.forEach(row => {
            console.log(`Notice ID: ${row.notice_id}, Case: ${row.case_number}`);
            console.log(`  Alert ID: ${row.alert_id || 'NULL'}`);
            console.log(`  Document ID: ${row.document_id || 'NULL'}`);
            console.log(`  Status: ${row.status}`);
            console.log(`  Created: ${row.created_at}`);
            console.log('');
        });
        
        // 3. Check token_tracking if it exists
        console.log('\n3. TOKENS IN TOKEN_TRACKING:');
        console.log('-'.repeat(40));
        
        try {
            const tokenResult = await pool.query(`
                SELECT 
                    token_id,
                    token_type,
                    case_number,
                    recipient_address,
                    server_address,
                    created_at
                FROM token_tracking
                ORDER BY token_id::integer DESC
                LIMIT 20
            `);
            
            console.log(`Found ${tokenResult.rows.length} tokens:\n`);
            
            tokenResult.rows.forEach(row => {
                console.log(`Token ${row.token_id} (${row.token_type}): Case ${row.case_number}`);
            });
        } catch (e) {
            console.log('token_tracking table not found');
        }
        
        // 4. Find highest token IDs
        console.log('\n4. HIGHEST TOKEN IDS:');
        console.log('-'.repeat(40));
        
        const maxResult = await pool.query(`
            SELECT 
                MAX(CAST(alert_token_id AS INTEGER)) as max_alert,
                MAX(CAST(document_token_id AS INTEGER)) as max_document
            FROM notice_components
            WHERE alert_token_id ~ '^[0-9]+$'
               AND document_token_id ~ '^[0-9]+$'
        `);
        
        console.log('Highest Alert Token ID:', maxResult.rows[0].max_alert || 'None');
        console.log('Highest Document Token ID:', maxResult.rows[0].max_document || 'None');
        
        // 5. Find tokens for case 34-2501-8285700
        console.log('\n5. TOKENS FOR CASE 34-2501-8285700:');
        console.log('-'.repeat(40));
        
        const caseResult = await pool.query(`
            SELECT 
                'notice_components' as source,
                alert_token_id,
                document_token_id,
                recipient_address,
                server_address
            FROM notice_components
            WHERE case_number = '34-2501-8285700'
            UNION ALL
            SELECT 
                'served_notices' as source,
                alert_id::text,
                document_id::text,
                recipient_address,
                server_address
            FROM served_notices
            WHERE case_number = '34-2501-8285700'
        `);
        
        if (caseResult.rows.length > 0) {
            console.log('Found tokens for case 34-2501-8285700:');
            caseResult.rows.forEach(row => {
                console.log(`  Source: ${row.source}`);
                console.log(`  Alert Token: ${row.alert_token_id || 'NULL'}`);
                console.log(`  Document Token: ${row.document_token_id || 'NULL'}`);
                console.log('');
            });
        } else {
            console.log('No tokens found for case 34-2501-8285700');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('SEARCH COMPLETE');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('Error finding tokens:', error);
    } finally {
        await pool.end();
    }
}

findActualTokens();