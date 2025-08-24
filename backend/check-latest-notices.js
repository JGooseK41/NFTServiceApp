const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function checkLatestNotices() {
    console.log('=== CHECKING LATEST NOTICES FOR IPFS DATA ===\n');
    
    try {
        // Get the latest notices (highest Alert NFT IDs)
        const latestQuery = `
            SELECT 
                case_number,
                alert_token_id,
                document_token_id,
                recipients,
                ipfs_hash,
                encryption_key,
                served_at,
                transaction_hash
            FROM case_service_records
            WHERE alert_token_id IS NOT NULL
            ORDER BY alert_token_id::int DESC
            LIMIT 20
        `;
        
        const latest = await pool.query(latestQuery);
        
        console.log(`Found ${latest.rows.length} latest notices:\n`);
        
        let withIPFS = 0;
        let withKeys = 0;
        
        latest.rows.forEach(row => {
            console.log(`Alert NFT #${row.alert_token_id}:`);
            console.log(`  Case: ${row.case_number}`);
            console.log(`  Document NFT: #${row.document_token_id}`);
            
            const recipients = JSON.parse(row.recipients || '[]');
            console.log(`  Recipient: ${recipients[0] || 'Unknown'}`);
            
            if (row.ipfs_hash) {
                console.log(`  IPFS Hash: ${row.ipfs_hash}`);
                withIPFS++;
            } else {
                console.log(`  IPFS Hash: NONE`);
            }
            
            if (row.encryption_key) {
                console.log(`  Encryption Key: YES (${row.encryption_key.substring(0, 16)}...)`);
                withKeys++;
            } else {
                console.log(`  Encryption Key: NONE`);
            }
            
            console.log(`  Served: ${row.served_at}`);
            console.log(`  TX Hash: ${row.transaction_hash}`);
            console.log('');
        });
        
        console.log('=== SUMMARY ===');
        console.log(`Total latest notices: ${latest.rows.length}`);
        console.log(`With IPFS hash: ${withIPFS}`);
        console.log(`With encryption key: ${withKeys}`);
        
        // Check the highest Alert NFT IDs specifically
        console.log('\n=== CHECKING HIGH TOKEN IDS (39-45) ===\n');
        
        const highTokenQuery = `
            SELECT 
                alert_token_id,
                case_number,
                recipients,
                ipfs_hash,
                encryption_key
            FROM case_service_records
            WHERE alert_token_id::int >= 39
            ORDER BY alert_token_id::int
        `;
        
        const highTokens = await pool.query(highTokenQuery);
        
        if (highTokens.rows.length > 0) {
            console.log(`Found ${highTokens.rows.length} notices with Alert NFT >= 39:\n`);
            highTokens.rows.forEach(row => {
                const recipients = JSON.parse(row.recipients || '[]');
                console.log(`Alert #${row.alert_token_id}: ${recipients[0] || 'Unknown'}`);
                console.log(`  IPFS: ${row.ipfs_hash ? 'YES' : 'NO'}`);
                console.log(`  Key: ${row.encryption_key ? 'YES' : 'NO'}`);
            });
        } else {
            console.log('No notices found with Alert NFT >= 39');
        }
        
        // Check complete_flow_documents for latest entries
        console.log('\n=== CHECKING COMPLETE_FLOW_DOCUMENTS ===\n');
        
        const flowQuery = `
            SELECT 
                token_id,
                ipfs_hash,
                encryption_key,
                document_path,
                case_number,
                created_at
            FROM complete_flow_documents
            ORDER BY created_at DESC
            LIMIT 10
        `;
        
        try {
            const flowDocs = await pool.query(flowQuery);
            
            if (flowDocs.rows.length > 0) {
                console.log(`Found ${flowDocs.rows.length} complete_flow_documents:\n`);
                flowDocs.rows.forEach(row => {
                    console.log(`Token ${row.token_id}:`);
                    console.log(`  IPFS: ${row.ipfs_hash || 'NONE'}`);
                    console.log(`  Key: ${row.encryption_key ? 'YES' : 'NO'}`);
                    console.log(`  Path: ${row.document_path || 'NONE'}`);
                    console.log(`  Case: ${row.case_number}`);
                    console.log(`  Created: ${row.created_at}`);
                    console.log('');
                });
            } else {
                console.log('No entries in complete_flow_documents');
            }
        } catch (err) {
            console.log('complete_flow_documents table not found or error:', err.message);
        }
        
        // Check notice_components for latest
        console.log('\n=== CHECKING NOTICE_COMPONENTS FOR LATEST ===\n');
        
        const componentsQuery = `
            SELECT 
                notice_id,
                alert_id,
                document_id,
                ipfs_hash,
                document_ipfs_hash,
                document_data IS NOT NULL as has_data,
                created_at
            FROM notice_components
            WHERE alert_id::int >= 35
            ORDER BY alert_id::int DESC
            LIMIT 10
        `;
        
        try {
            const components = await pool.query(componentsQuery);
            
            if (components.rows.length > 0) {
                console.log(`Found ${components.rows.length} notice_components:\n`);
                components.rows.forEach(row => {
                    console.log(`Alert #${row.alert_id}:`);
                    console.log(`  Notice ID: ${row.notice_id}`);
                    console.log(`  Has document data: ${row.has_data}`);
                    console.log(`  IPFS: ${row.ipfs_hash || 'NONE'}`);
                    console.log(`  Doc IPFS: ${row.document_ipfs_hash || 'NONE'}`);
                    console.log(`  Created: ${row.created_at}`);
                    console.log('');
                });
            } else {
                console.log('No notice_components for Alert >= 35');
            }
        } catch (err) {
            console.log('Error querying notice_components:', err.message);
        }
        
        await pool.end();
        
    } catch (error) {
        console.error('Error:', error);
        await pool.end();
    }
}

checkLatestNotices();