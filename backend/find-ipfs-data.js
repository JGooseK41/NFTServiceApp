const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function findIPFSData() {
    console.log('=== SEARCHING FOR IPFS DATA ACROSS ALL TABLES ===\n');
    
    try {
        // Tables that might contain IPFS data
        const tables = [
            'cases',
            'notices',
            'notice_components',
            'document_storage',
            'documents_v2',
            'encrypted_documents',
            'ipfs_uploads',
            'notice_staging',
            'drafts',
            'complete_flow_documents'
        ];
        
        for (const table of tables) {
            try {
                // Check if table exists and has IPFS-related columns
                const columnsQuery = `
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = $1 
                    AND (column_name LIKE '%ipfs%' OR column_name LIKE '%hash%' OR column_name LIKE '%cid%')
                `;
                
                const columns = await pool.query(columnsQuery, [table]);
                
                if (columns.rows.length > 0) {
                    console.log(`\n=== Table: ${table} ===`);
                    console.log('IPFS-related columns:', columns.rows.map(r => r.column_name).join(', '));
                    
                    // Get sample data
                    const dataQuery = `SELECT * FROM ${table} WHERE `;
                    const conditions = columns.rows.map(r => `${r.column_name} IS NOT NULL`).join(' OR ');
                    const fullQuery = dataQuery + conditions + ' LIMIT 3';
                    
                    const data = await pool.query(fullQuery);
                    console.log(`Records with IPFS data: ${data.rows.length}`);
                    
                    if (data.rows.length > 0) {
                        data.rows.forEach((row, i) => {
                            console.log(`\nRecord ${i + 1}:`);
                            columns.rows.forEach(col => {
                                if (row[col.column_name]) {
                                    console.log(`  ${col.column_name}: ${row[col.column_name]}`);
                                }
                            });
                            // Also show related IDs
                            if (row.token_id) console.log(`  token_id: ${row.token_id}`);
                            if (row.alert_token_id) console.log(`  alert_token_id: ${row.alert_token_id}`);
                            if (row.document_token_id) console.log(`  document_token_id: ${row.document_token_id}`);
                            if (row.case_number) console.log(`  case_number: ${row.case_number}`);
                        });
                    }
                }
            } catch (err) {
                // Table doesn't exist or error querying
                if (err.code !== '42P01') { // Not "table does not exist" error
                    console.log(`Error checking ${table}: ${err.message}`);
                }
            }
        }
        
        // Check notice_components specifically for alert/document relationships
        console.log('\n=== Checking notice_components for token relationships ===');
        try {
            const componentQuery = `
                SELECT 
                    notice_id,
                    alert_id,
                    document_id,
                    ipfs_hash,
                    document_ipfs_hash,
                    case_number
                FROM notice_components
                WHERE ipfs_hash IS NOT NULL 
                   OR document_ipfs_hash IS NOT NULL
                LIMIT 5
            `;
            
            const components = await pool.query(componentQuery);
            console.log(`Found ${components.rows.length} notice_components with IPFS data`);
            components.rows.forEach(row => {
                console.log(`\nNotice ${row.notice_id}:`);
                console.log(`  Alert ID: ${row.alert_id}`);
                console.log(`  Document ID: ${row.document_id}`);
                console.log(`  IPFS Hash: ${row.ipfs_hash}`);
                console.log(`  Document IPFS: ${row.document_ipfs_hash}`);
                console.log(`  Case: ${row.case_number}`);
            });
        } catch (err) {
            console.log('notice_components table not found or error:', err.message);
        }
        
        // Check complete_flow_documents
        console.log('\n=== Checking complete_flow_documents ===');
        try {
            const flowQuery = `
                SELECT 
                    token_id,
                    ipfs_hash,
                    encryption_key,
                    case_number,
                    created_at
                FROM complete_flow_documents
                WHERE ipfs_hash IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 5
            `;
            
            const flowDocs = await pool.query(flowQuery);
            console.log(`Found ${flowDocs.rows.length} complete_flow_documents with IPFS data`);
            flowDocs.rows.forEach(row => {
                console.log(`\nToken ${row.token_id}:`);
                console.log(`  IPFS Hash: ${row.ipfs_hash}`);
                console.log(`  Has encryption key: ${row.encryption_key ? 'Yes' : 'No'}`);
                console.log(`  Case: ${row.case_number}`);
                console.log(`  Created: ${row.created_at}`);
            });
        } catch (err) {
            console.log('complete_flow_documents table not found or error:', err.message);
        }
        
        await pool.end();
        
    } catch (error) {
        console.error('Error:', error);
        await pool.end();
    }
}

findIPFSData();