const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function checkV1DocumentStorage() {
    console.log('=== CHECKING V1 DOCUMENT STORAGE PATTERN ===\n');
    
    try {
        // Check notice_components for document data
        console.log('=== NOTICE_COMPONENTS TABLE ===\n');
        const componentsQuery = `
            SELECT 
                notice_id,
                alert_id,
                document_id,
                case_number,
                document_data IS NOT NULL as has_document_data,
                document_ipfs_hash,
                ipfs_hash,
                LENGTH(document_data) as data_size,
                created_at
            FROM notice_components
            WHERE alert_id IN ('1', '3', '5', '7', '9', '11', '13', '15', '17', '19', 
                              '21', '23', '25', '27', '29', '31', '33', '35', '37', '39')
            ORDER BY alert_id::int
        `;
        
        const components = await pool.query(componentsQuery);
        
        if (components.rows.length > 0) {
            console.log(`Found ${components.rows.length} notice_components:\n`);
            components.rows.forEach(row => {
                console.log(`Alert #${row.alert_id}:`);
                console.log(`  Notice ID: ${row.notice_id}`);
                console.log(`  Document ID: ${row.document_id}`);
                console.log(`  Has document_data: ${row.has_document_data ? `YES (${row.data_size} bytes)` : 'NO'}`);
                console.log(`  IPFS Hash: ${row.ipfs_hash || 'NONE'}`);
                console.log(`  Document IPFS: ${row.document_ipfs_hash || 'NONE'}`);
                console.log(`  Created: ${row.created_at}`);
                console.log('');
            });
        } else {
            console.log('No notice_components found for these Alert NFTs');
        }
        
        // Check documents_v2 table
        console.log('\n=== DOCUMENTS_V2 TABLE ===\n');
        const docsQuery = `
            SELECT 
                id,
                notice_id,
                file_path,
                original_name,
                mime_type,
                file_size,
                document_data IS NOT NULL as has_data,
                LENGTH(document_data) as data_size,
                created_at
            FROM documents_v2
            WHERE notice_id IN (
                SELECT notice_id FROM notice_components 
                WHERE alert_id IN ('1', '3', '5', '7', '9', '11', '13', '15', '17', '19')
            )
            LIMIT 10
        `;
        
        const docs = await pool.query(docsQuery);
        
        if (docs.rows.length > 0) {
            console.log(`Found ${docs.rows.length} documents_v2 entries:\n`);
            docs.rows.forEach(row => {
                console.log(`Document ${row.id}:`);
                console.log(`  Notice ID: ${row.notice_id}`);
                console.log(`  File: ${row.original_name} (${row.mime_type})`);
                console.log(`  Size: ${row.file_size} bytes`);
                console.log(`  Has data: ${row.has_data ? `YES (${row.data_size} bytes)` : 'NO'}`);
                console.log(`  File path: ${row.file_path || 'NONE'}`);
                console.log('');
            });
        } else {
            console.log('No documents_v2 entries found');
        }
        
        // Check simple_images table
        console.log('\n=== SIMPLE_IMAGES TABLE ===\n');
        const imagesQuery = `
            SELECT 
                notice_id,
                image_type,
                OCTET_LENGTH(image_data) as data_size,
                metadata,
                created_at
            FROM simple_images
            WHERE notice_id IN (
                SELECT notice_id FROM notice_components 
                WHERE alert_id IN ('1', '3', '5', '7', '9', '11', '13', '15', '17', '19')
            )
            ORDER BY notice_id, image_type
            LIMIT 20
        `;
        
        const images = await pool.query(imagesQuery);
        
        if (images.rows.length > 0) {
            console.log(`Found ${images.rows.length} simple_images entries:\n`);
            
            // Group by notice_id
            const byNotice = {};
            images.rows.forEach(row => {
                if (!byNotice[row.notice_id]) {
                    byNotice[row.notice_id] = [];
                }
                byNotice[row.notice_id].push(row);
            });
            
            Object.keys(byNotice).forEach(noticeId => {
                console.log(`Notice ${noticeId}:`);
                byNotice[noticeId].forEach(img => {
                    console.log(`  ${img.image_type}: ${img.data_size} bytes`);
                    if (img.metadata) {
                        const meta = JSON.parse(img.metadata);
                        if (meta.pageNumber) console.log(`    Page: ${meta.pageNumber}`);
                        if (meta.totalPages) console.log(`    Total pages: ${meta.totalPages}`);
                    }
                });
                console.log('');
            });
        } else {
            console.log('No simple_images found');
        }
        
        // Check for any IPFS data in complete_flow_documents
        console.log('\n=== COMPLETE_FLOW_DOCUMENTS TABLE ===\n');
        const flowQuery = `
            SELECT 
                token_id,
                ipfs_hash,
                encryption_key IS NOT NULL as has_key,
                document_path,
                case_number,
                created_at
            FROM complete_flow_documents
            WHERE ipfs_hash IS NOT NULL
            LIMIT 10
        `;
        
        const flow = await pool.query(flowQuery);
        
        if (flow.rows.length > 0) {
            console.log(`Found ${flow.rows.length} complete_flow_documents with IPFS:\n`);
            flow.rows.forEach(row => {
                console.log(`Token ${row.token_id}:`);
                console.log(`  IPFS: ${row.ipfs_hash}`);
                console.log(`  Has key: ${row.has_key}`);
                console.log(`  Path: ${row.document_path || 'NONE'}`);
                console.log(`  Case: ${row.case_number}`);
                console.log('');
            });
        } else {
            console.log('No IPFS data in complete_flow_documents');
        }
        
        // Summary of what we found
        console.log('\n=== SUMMARY ===\n');
        
        const summaryQuery = `
            SELECT 
                'notice_components' as table_name,
                COUNT(*) as total_records,
                COUNT(CASE WHEN document_data IS NOT NULL THEN 1 END) as with_data,
                COUNT(CASE WHEN ipfs_hash IS NOT NULL OR document_ipfs_hash IS NOT NULL THEN 1 END) as with_ipfs
            FROM notice_components
            WHERE alert_id IS NOT NULL
            
            UNION ALL
            
            SELECT 
                'documents_v2' as table_name,
                COUNT(*) as total_records,
                COUNT(CASE WHEN document_data IS NOT NULL THEN 1 END) as with_data,
                0 as with_ipfs
            FROM documents_v2
            
            UNION ALL
            
            SELECT 
                'simple_images' as table_name,
                COUNT(DISTINCT notice_id) as total_records,
                COUNT(DISTINCT notice_id) as with_data,
                0 as with_ipfs
            FROM simple_images
        `;
        
        const summary = await pool.query(summaryQuery);
        
        console.log('Storage locations found:');
        summary.rows.forEach(row => {
            console.log(`  ${row.table_name}:`);
            console.log(`    Total records: ${row.total_records}`);
            console.log(`    With data: ${row.with_data}`);
            if (row.with_ipfs > 0) {
                console.log(`    With IPFS: ${row.with_ipfs}`);
            }
        });
        
        await pool.end();
        
    } catch (error) {
        console.error('Error:', error);
        await pool.end();
    }
}

checkV1DocumentStorage();