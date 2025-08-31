/**
 * Check what documents exist for case 34-2312-235579
 */

const { Client } = require('pg');
require('dotenv').config();

async function checkCaseDocuments() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
        ssl: { rejectUnauthorized: false }
    });
    
    const caseNumber = '34-2312-235579';
    console.log(`\n=== CHECKING DOCUMENTS FOR CASE ${caseNumber} ===\n`);
    
    try {
        await client.connect();
        console.log('Connected to database\n');
        
        // 1. Check document_storage (disk-stored PDFs)
        console.log('1. DOCUMENT_STORAGE (Disk-stored PDFs)');
        console.log('=' .repeat(50));
        
        const diskQuery = `
            SELECT 
                notice_id,
                case_number,
                file_name,
                disk_filename,
                file_size,
                file_type,
                created_at
            FROM document_storage
            WHERE case_number = $1 OR case_number LIKE $2
            ORDER BY created_at DESC
        `;
        
        const diskResult = await client.query(diskQuery, [caseNumber, '%235579%']);
        
        if (diskResult.rows.length > 0) {
            console.log(`Found ${diskResult.rows.length} disk-stored PDFs:\n`);
            diskResult.rows.forEach((row, i) => {
                console.log(`  ${i+1}. Notice: ${row.notice_id}`);
                console.log(`     File: ${row.file_name}`);
                console.log(`     Disk: ${row.disk_filename}`);
                console.log(`     Size: ${(row.file_size / 1024 / 1024).toFixed(2)} MB`);
                console.log(`     Type: ${row.file_type}`);
                console.log(`     Created: ${row.created_at}`);
                console.log('');
            });
        } else {
            console.log('❌ No disk-stored PDFs found\n');
        }
        
        // 2. Check processed_documents (BYTEA storage)
        console.log('2. PROCESSED_DOCUMENTS (BYTEA storage)');
        console.log('=' .repeat(50));
        
        const processedQuery = `
            SELECT 
                document_id,
                case_number,
                page_count,
                file_size,
                mime_type,
                created_at
            FROM processed_documents
            WHERE case_number = $1 OR case_number LIKE $2
            ORDER BY created_at DESC
        `;
        
        try {
            const processedResult = await client.query(processedQuery, [caseNumber, '%235579%']);
            
            if (processedResult.rows.length > 0) {
                console.log(`Found ${processedResult.rows.length} BYTEA documents:\n`);
                processedResult.rows.forEach((row, i) => {
                    console.log(`  ${i+1}. Document ID: ${row.document_id}`);
                    console.log(`     Pages: ${row.page_count}`);
                    console.log(`     Size: ${(row.file_size / 1024 / 1024).toFixed(2)} MB`);
                    console.log(`     Type: ${row.mime_type}`);
                    console.log(`     Created: ${row.created_at}`);
                    console.log('');
                });
            } else {
                console.log('❌ No BYTEA documents found\n');
            }
        } catch (e) {
            console.log('❌ processed_documents table not found\n');
        }
        
        // 3. Check notice_components (base64 images)
        console.log('3. NOTICE_COMPONENTS (Base64 images)');
        console.log('=' .repeat(50));
        
        const componentsQuery = `
            SELECT 
                notice_id,
                alert_id,
                document_id,
                case_number,
                CASE WHEN alert_thumbnail_data IS NOT NULL THEN 'YES' ELSE 'NO' END as has_alert,
                CASE WHEN document_data IS NOT NULL THEN 'YES' ELSE 'NO' END as has_document,
                LENGTH(alert_thumbnail_data) as alert_size,
                LENGTH(document_data) as doc_size,
                ipfs_hash,
                document_ipfs_hash,
                created_at
            FROM notice_components
            WHERE case_number = $1 OR case_number LIKE $2
            ORDER BY created_at DESC
            LIMIT 10
        `;
        
        const componentsResult = await client.query(componentsQuery, [caseNumber, '%235579%']);
        
        if (componentsResult.rows.length > 0) {
            console.log(`Found ${componentsResult.rows.length} notice_components:\n`);
            componentsResult.rows.forEach((row, i) => {
                console.log(`  ${i+1}. Notice: ${row.notice_id}`);
                console.log(`     Alert ID: ${row.alert_id}, Document ID: ${row.document_id}`);
                console.log(`     Case: ${row.case_number}`);
                console.log(`     Alert Image: ${row.has_alert} ${row.alert_size ? `(${(row.alert_size/1024/1024).toFixed(2)} MB)` : ''}`);
                console.log(`     Document Image: ${row.has_document} ${row.doc_size ? `(${(row.doc_size/1024/1024).toFixed(2)} MB)` : ''}`);
                console.log(`     IPFS: ${row.ipfs_hash || 'None'}`);
                console.log(`     Doc IPFS: ${row.document_ipfs_hash || 'None'}`);
                console.log(`     Created: ${row.created_at}`);
                console.log('');
            });
        } else {
            console.log('❌ No notice_components found\n');
        }
        
        // 4. Check simple_images table
        console.log('4. SIMPLE_IMAGES TABLE');
        console.log('=' .repeat(50));
        
        const simpleQuery = `
            SELECT 
                notice_id,
                case_number,
                CASE WHEN alert_image IS NOT NULL OR alert_thumbnail IS NOT NULL THEN 'YES' ELSE 'NO' END as has_alert,
                CASE WHEN document_image IS NOT NULL OR document_thumbnail IS NOT NULL THEN 'YES' ELSE 'NO' END as has_document,
                created_at
            FROM images
            WHERE case_number = $1 OR case_number LIKE $2
            ORDER BY created_at DESC
            LIMIT 10
        `;
        
        try {
            const simpleResult = await client.query(simpleQuery, [caseNumber, '%235579%']);
            
            if (simpleResult.rows.length > 0) {
                console.log(`Found ${simpleResult.rows.length} simple_images:\n`);
                simpleResult.rows.forEach((row, i) => {
                    console.log(`  ${i+1}. Notice: ${row.notice_id}`);
                    console.log(`     Case: ${row.case_number}`);
                    console.log(`     Alert: ${row.has_alert}, Document: ${row.has_document}`);
                    console.log(`     Created: ${row.created_at}`);
                    console.log('');
                });
            } else {
                console.log('❌ No simple_images found\n');
            }
        } catch (e) {
            console.log('❌ simple_images table not found\n');
        }
        
        // 5. Check case_service_records
        console.log('5. CASE_SERVICE_RECORDS');
        console.log('=' .repeat(50));
        
        const caseServiceQuery = `
            SELECT 
                alert_token_id,
                document_token_id,
                case_number,
                ipfs_hash,
                recipients,
                created_at
            FROM case_service_records
            WHERE case_number = $1 OR case_number LIKE $2
            ORDER BY created_at DESC
        `;
        
        const caseServiceResult = await client.query(caseServiceQuery, [caseNumber, '%235579%']);
        
        if (caseServiceResult.rows.length > 0) {
            console.log(`Found ${caseServiceResult.rows.length} case_service_records:\n`);
            caseServiceResult.rows.forEach((row, i) => {
                console.log(`  ${i+1}. Alert Token: ${row.alert_token_id}`);
                console.log(`     Document Token: ${row.document_token_id}`);
                console.log(`     Case: ${row.case_number}`);
                console.log(`     IPFS: ${row.ipfs_hash || 'None'}`);
                console.log(`     Recipients: ${row.recipients}`);
                console.log(`     Created: ${row.created_at}`);
                console.log('');
            });
        } else {
            console.log('❌ No case_service_records found\n');
        }
        
        // Summary
        console.log('\n' + '=' .repeat(50));
        console.log('SUMMARY');
        console.log('=' .repeat(50));
        console.log(`Case Number: ${caseNumber}`);
        console.log(`Disk PDFs: ${diskResult.rows.length}`);
        console.log(`BYTEA PDFs: ${processedResult ? processedResult.rows.length : 0}`);
        console.log(`Notice Components: ${componentsResult.rows.length}`);
        console.log(`Case Service Records: ${caseServiceResult.rows.length}`);
        
        // Check for related case numbers
        console.log('\n' + '=' .repeat(50));
        console.log('CHECKING FOR SIMILAR CASE NUMBERS');
        console.log('=' .repeat(50));
        
        const similarQuery = `
            SELECT DISTINCT case_number, COUNT(*) as count
            FROM notice_components
            WHERE case_number LIKE '%235579%' OR case_number LIKE '%2312%'
            GROUP BY case_number
            ORDER BY count DESC
            LIMIT 10
        `;
        
        const similarResult = await client.query(similarQuery);
        
        if (similarResult.rows.length > 0) {
            console.log('Found similar case numbers:\n');
            similarResult.rows.forEach(row => {
                console.log(`  ${row.case_number}: ${row.count} records`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
        console.log('\n✅ Check complete');
    }
}

checkCaseDocuments();