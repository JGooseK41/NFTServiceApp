const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 1
});

async function findCaseDocuments() {
    const caseNumber = '34-2312-235579';
    console.log(`=== SEARCHING FOR CASE ${caseNumber} DOCUMENTS ===\n`);
    
    try {
        // Check case_service_records
        console.log('=== CASE_SERVICE_RECORDS ===');
        const caseQuery = `
            SELECT * FROM case_service_records 
            WHERE case_number = $1 OR case_number LIKE $2
        `;
        const caseResult = await pool.query(caseQuery, [caseNumber, `%235579%`]);
        
        if (caseResult.rows.length > 0) {
            console.log(`Found ${caseResult.rows.length} records in case_service_records:`);
            caseResult.rows.forEach(row => {
                console.log(`  Alert NFT: ${row.alert_token_id}`);
                console.log(`  Document NFT: ${row.document_token_id}`);
                console.log(`  IPFS Hash: ${row.ipfs_hash || 'NONE'}`);
                console.log(`  Encryption Key: ${row.encryption_key ? 'YES' : 'NO'}`);
                console.log(`  Recipients: ${row.recipients}`);
                console.log('');
            });
        } else {
            console.log('Not found in case_service_records\n');
        }
        
        // Check cases table
        console.log('=== CASES TABLE ===');
        const casesQuery = `
            SELECT * FROM cases 
            WHERE case_number = $1 OR case_number LIKE $2
            LIMIT 5
        `;
        const casesResult = await pool.query(casesQuery, [caseNumber, `%235579%`]);
        
        if (casesResult.rows.length > 0) {
            console.log(`Found ${casesResult.rows.length} records in cases:`);
            casesResult.rows.forEach(row => {
                console.log(`  ID: ${row.id}`);
                console.log(`  Case Number: ${row.case_number}`);
                console.log(`  Token ID: ${row.token_id}`);
                console.log(`  Alert Token: ${row.alert_token_id}`);
                console.log(`  Document Token: ${row.document_token_id}`);
                console.log(`  IPFS Hash: ${row.ipfs_hash || 'NONE'}`);
                console.log(`  Has document data: ${row.document_data ? 'YES' : 'NO'}`);
                console.log('');
            });
        } else {
            console.log('Not found in cases table\n');
        }
        
        // Check notice_components
        console.log('=== NOTICE_COMPONENTS ===');
        const componentsQuery = `
            SELECT * FROM notice_components 
            WHERE case_number = $1 OR case_number LIKE $2
            LIMIT 5
        `;
        const componentsResult = await pool.query(componentsQuery, [caseNumber, `%235579%`]);
        
        if (componentsResult.rows.length > 0) {
            console.log(`Found ${componentsResult.rows.length} records in notice_components:`);
            componentsResult.rows.forEach(row => {
                console.log(`  Notice ID: ${row.notice_id}`);
                console.log(`  Alert ID: ${row.alert_id}`);
                console.log(`  Document ID: ${row.document_id}`);
                console.log(`  IPFS Hash: ${row.ipfs_hash || 'NONE'}`);
                console.log(`  Document IPFS: ${row.document_ipfs_hash || 'NONE'}`);
                console.log(`  Has document data: ${row.document_data ? 'YES' : 'NO'}`);
                console.log('');
            });
        } else {
            console.log('Not found in notice_components\n');
        }
        
        // Check complete_flow_documents
        console.log('=== COMPLETE_FLOW_DOCUMENTS ===');
        const flowQuery = `
            SELECT * FROM complete_flow_documents 
            WHERE case_number = $1 OR case_number LIKE $2
            LIMIT 5
        `;
        const flowResult = await pool.query(flowQuery, [caseNumber, `%235579%`]);
        
        if (flowResult.rows.length > 0) {
            console.log(`Found ${flowResult.rows.length} records in complete_flow_documents:`);
            flowResult.rows.forEach(row => {
                console.log(`  Token ID: ${row.token_id}`);
                console.log(`  IPFS Hash: ${row.ipfs_hash || 'NONE'}`);
                console.log(`  Encryption Key: ${row.encryption_key ? 'YES' : 'NO'}`);
                console.log(`  Document Path: ${row.document_path || 'NONE'}`);
                console.log(`  Created: ${row.created_at}`);
                console.log('');
            });
        } else {
            console.log('Not found in complete_flow_documents\n');
        }
        
        // Check served_notices
        console.log('=== SERVED_NOTICES ===');
        const servedQuery = `
            SELECT * FROM served_notices 
            WHERE case_number = $1 OR case_number LIKE $2
            LIMIT 5
        `;
        const servedResult = await pool.query(servedQuery, [caseNumber, `%235579%`]);
        
        if (servedResult.rows.length > 0) {
            console.log(`Found ${servedResult.rows.length} records in served_notices:`);
            servedResult.rows.forEach(row => {
                console.log(`  ID: ${row.id}`);
                console.log(`  Notice ID: ${row.notice_id}`);
                console.log(`  IPFS Hash: ${row.ipfs_hash || 'NONE'}`);
                console.log(`  Encryption Key: ${row.encryption_key ? 'YES' : 'NO'}`);
                console.log(`  Token ID: ${row.token_id}`);
                console.log('');
            });
        } else {
            console.log('Not found in served_notices\n');
        }
        
        // Check notices table
        console.log('=== NOTICES TABLE ===');
        const noticesQuery = `
            SELECT id, token_id, ipfs_hash, encryption_key, created_at
            FROM notices 
            WHERE case_number = $1 OR case_number LIKE $2
            OR token_id IN (
                SELECT alert_token_id FROM case_service_records 
                WHERE case_number LIKE $2
            )
            LIMIT 5
        `;
        const noticesResult = await pool.query(noticesQuery, [caseNumber, `%235579%`]);
        
        if (noticesResult.rows.length > 0) {
            console.log(`Found ${noticesResult.rows.length} records in notices:`);
            noticesResult.rows.forEach(row => {
                console.log(`  ID: ${row.id}`);
                console.log(`  Token ID: ${row.token_id}`);
                console.log(`  IPFS Hash: ${row.ipfs_hash || 'NONE'}`);
                console.log(`  Encryption Key: ${row.encryption_key ? 'YES' : 'NO'}`);
                console.log(`  Created: ${row.created_at}`);
                console.log('');
            });
        } else {
            console.log('Not found in notices table\n');
        }
        
        // Search for any table with this case number pattern
        console.log('=== SEARCHING ALL TABLES FOR 235579 ===');
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `;
        const tables = await pool.query(tablesQuery);
        
        for (const table of tables.rows) {
            try {
                const searchQuery = `
                    SELECT COUNT(*) as count 
                    FROM ${table.table_name} 
                    WHERE EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = $1 
                        AND column_name IN ('case_number', 'case_id', 'notice_id')
                    )
                    AND (
                        case_number LIKE $2 
                        OR case_id LIKE $2
                        OR notice_id LIKE $2
                    )
                `;
                
                const result = await pool.query(searchQuery, [table.table_name, '%235579%']);
                if (result.rows[0].count > 0) {
                    console.log(`  Found in ${table.table_name}: ${result.rows[0].count} records`);
                }
            } catch (err) {
                // Skip tables that don't have relevant columns
            }
        }
        
        await pool.end();
        
    } catch (error) {
        console.error('Error:', error);
        await pool.end();
    }
}

findCaseDocuments();