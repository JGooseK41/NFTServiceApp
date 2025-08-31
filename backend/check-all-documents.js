/**
 * Check ALL documents in the database across all storage methods
 */

const { Client } = require('pg');
require('dotenv').config();

async function checkAllDocuments() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
        ssl: { rejectUnauthorized: false }
    });
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('    COMPLETE DOCUMENT INVENTORY');
    console.log(`${'='.repeat(60)}\n`);
    
    try {
        await client.connect();
        console.log('✅ Connected to database\n');
        
        // 1. Check document_storage (disk-stored PDFs)
        console.log('1. DOCUMENT_STORAGE TABLE (PDFs on Disk)');
        console.log('-'.repeat(60));
        
        const diskStats = await client.query(`
            SELECT 
                COUNT(*) as total_documents,
                COUNT(DISTINCT case_number) as unique_cases,
                SUM(file_size) as total_size,
                MIN(created_at) as oldest,
                MAX(created_at) as newest
            FROM document_storage
        `);
        
        const diskByCase = await client.query(`
            SELECT 
                case_number,
                COUNT(*) as doc_count,
                SUM(file_size) as total_size,
                MAX(created_at) as latest
            FROM document_storage
            GROUP BY case_number
            ORDER BY latest DESC
            LIMIT 20
        `);
        
        if (diskStats.rows[0].total_documents > 0) {
            const stats = diskStats.rows[0];
            console.log(`📊 Total PDFs on disk: ${stats.total_documents}`);
            console.log(`📁 Unique cases: ${stats.unique_cases}`);
            console.log(`💾 Total size: ${(stats.total_size / 1024 / 1024).toFixed(2)} MB`);
            console.log(`📅 Date range: ${stats.oldest} to ${stats.newest}`);
            
            console.log('\nTop cases with disk-stored PDFs:');
            diskByCase.rows.forEach(row => {
                console.log(`  • ${row.case_number || 'NO CASE'}: ${row.doc_count} docs (${(row.total_size/1024/1024).toFixed(2)} MB)`);
            });
        } else {
            console.log('❌ No documents in document_storage table');
        }
        
        // 2. Check processed_documents (BYTEA storage)
        console.log('\n\n2. PROCESSED_DOCUMENTS TABLE (BYTEA PDFs)');
        console.log('-'.repeat(60));
        
        try {
            const processedStats = await client.query(`
                SELECT 
                    COUNT(*) as total_documents,
                    COUNT(DISTINCT case_number) as unique_cases,
                    SUM(file_size) as total_size,
                    SUM(page_count) as total_pages,
                    MIN(created_at) as oldest,
                    MAX(created_at) as newest
                FROM processed_documents
            `);
            
            if (processedStats.rows[0].total_documents > 0) {
                const stats = processedStats.rows[0];
                console.log(`📊 Total BYTEA PDFs: ${stats.total_documents}`);
                console.log(`📁 Unique cases: ${stats.unique_cases}`);
                console.log(`💾 Total size: ${(stats.total_size / 1024 / 1024).toFixed(2)} MB`);
                console.log(`📄 Total pages: ${stats.total_pages}`);
                console.log(`📅 Date range: ${stats.oldest} to ${stats.newest}`);
            } else {
                console.log('❌ No documents in processed_documents table');
            }
        } catch (e) {
            console.log('❌ processed_documents table does not exist');
        }
        
        // 3. Check notice_components (base64 images/documents)
        console.log('\n\n3. NOTICE_COMPONENTS TABLE (Base64 Storage)');
        console.log('-'.repeat(60));
        
        const componentStats = await client.query(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT case_number) as unique_cases,
                COUNT(CASE WHEN alert_thumbnail_data IS NOT NULL THEN 1 END) as with_alert_image,
                COUNT(CASE WHEN document_data IS NOT NULL THEN 1 END) as with_document_image,
                COUNT(CASE WHEN ipfs_hash IS NOT NULL THEN 1 END) as with_ipfs,
                COUNT(CASE WHEN document_ipfs_hash IS NOT NULL THEN 1 END) as with_doc_ipfs,
                MIN(created_at) as oldest,
                MAX(created_at) as newest
            FROM notice_components
        `);
        
        const componentsByCase = await client.query(`
            SELECT 
                case_number,
                COUNT(*) as record_count,
                COUNT(CASE WHEN alert_thumbnail_data IS NOT NULL THEN 1 END) as alerts,
                COUNT(CASE WHEN document_data IS NOT NULL THEN 1 END) as documents,
                MAX(created_at) as latest
            FROM notice_components
            WHERE case_number IS NOT NULL
            GROUP BY case_number
            ORDER BY latest DESC
            LIMIT 20
        `);
        
        if (componentStats.rows[0].total_records > 0) {
            const stats = componentStats.rows[0];
            console.log(`📊 Total notice components: ${stats.total_records}`);
            console.log(`📁 Unique cases: ${stats.unique_cases}`);
            console.log(`🖼️  With alert images: ${stats.with_alert_image}`);
            console.log(`📄 With document images: ${stats.with_document_image}`);
            console.log(`🌐 With IPFS hash: ${stats.with_ipfs}`);
            console.log(`📎 With document IPFS: ${stats.with_doc_ipfs}`);
            console.log(`📅 Date range: ${stats.oldest} to ${stats.newest}`);
            
            console.log('\nTop cases with base64 data:');
            componentsByCase.rows.forEach(row => {
                console.log(`  • ${row.case_number}: ${row.record_count} records (${row.alerts} alerts, ${row.documents} docs)`);
            });
        }
        
        // 4. Check simple_images table
        console.log('\n\n4. SIMPLE_IMAGES TABLE');
        console.log('-'.repeat(60));
        
        try {
            const imageStats = await client.query(`
                SELECT 
                    COUNT(*) as total_images,
                    COUNT(DISTINCT case_number) as unique_cases,
                    COUNT(CASE WHEN alert_image IS NOT NULL OR alert_thumbnail IS NOT NULL THEN 1 END) as with_alert,
                    COUNT(CASE WHEN document_image IS NOT NULL OR document_thumbnail IS NOT NULL THEN 1 END) as with_document,
                    MIN(created_at) as oldest,
                    MAX(created_at) as newest
                FROM images
            `);
            
            if (imageStats.rows[0].total_images > 0) {
                const stats = imageStats.rows[0];
                console.log(`📊 Total image records: ${stats.total_images}`);
                console.log(`📁 Unique cases: ${stats.unique_cases}`);
                console.log(`🖼️  With alert images: ${stats.with_alert}`);
                console.log(`📄 With document images: ${stats.with_document}`);
                console.log(`📅 Date range: ${stats.oldest} to ${stats.newest}`);
            } else {
                console.log('❌ No records in images table');
            }
        } catch (e) {
            console.log('❌ images table does not exist');
        }
        
        // 5. Check case_service_records
        console.log('\n\n5. CASE_SERVICE_RECORDS TABLE');
        console.log('-'.repeat(60));
        
        const caseServiceStats = await client.query(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT case_number) as unique_cases,
                COUNT(CASE WHEN ipfs_hash IS NOT NULL THEN 1 END) as with_ipfs,
                MIN(created_at) as oldest,
                MAX(created_at) as newest
            FROM case_service_records
        `);
        
        if (caseServiceStats.rows[0].total_records > 0) {
            const stats = caseServiceStats.rows[0];
            console.log(`📊 Total service records: ${stats.total_records}`);
            console.log(`📁 Unique cases: ${stats.unique_cases}`);
            console.log(`🌐 With IPFS: ${stats.with_ipfs}`);
            console.log(`📅 Date range: ${stats.oldest} to ${stats.newest}`);
        }
        
        // 6. Get all unique case numbers across all tables
        console.log('\n\n6. ALL UNIQUE CASE NUMBERS');
        console.log('-'.repeat(60));
        
        const allCases = await client.query(`
            WITH all_cases AS (
                SELECT DISTINCT case_number FROM document_storage WHERE case_number IS NOT NULL
                UNION
                SELECT DISTINCT case_number FROM notice_components WHERE case_number IS NOT NULL
                UNION
                SELECT DISTINCT case_number FROM case_service_records WHERE case_number IS NOT NULL
            )
            SELECT 
                case_number,
                (SELECT COUNT(*) FROM document_storage ds WHERE ds.case_number = all_cases.case_number) as disk_pdfs,
                (SELECT COUNT(*) FROM notice_components nc WHERE nc.case_number = all_cases.case_number) as components,
                (SELECT COUNT(*) FROM case_service_records csr WHERE csr.case_number = all_cases.case_number) as service_records
            FROM all_cases
            ORDER BY case_number DESC
            LIMIT 50
        `);
        
        console.log(`Found ${allCases.rows.length} unique cases. Top cases:\n`);
        console.log('Case Number                     | PDFs | Components | Service Records');
        console.log('-'.repeat(70));
        allCases.rows.forEach(row => {
            console.log(`${row.case_number.padEnd(30)} | ${String(row.disk_pdfs).padEnd(4)} | ${String(row.components).padEnd(10)} | ${row.service_records}`);
        });
        
        // 7. Summary
        console.log('\n\n' + '='.repeat(60));
        console.log('OVERALL SUMMARY');
        console.log('='.repeat(60));
        
        const summary = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM document_storage) as disk_pdfs,
                (SELECT COUNT(*) FROM notice_components WHERE document_data IS NOT NULL OR alert_thumbnail_data IS NOT NULL) as base64_docs,
                (SELECT COUNT(DISTINCT case_number) FROM (
                    SELECT case_number FROM document_storage WHERE case_number IS NOT NULL
                    UNION
                    SELECT case_number FROM notice_components WHERE case_number IS NOT NULL
                    UNION
                    SELECT case_number FROM case_service_records WHERE case_number IS NOT NULL
                ) t) as total_unique_cases
        `);
        
        const s = summary.rows[0];
        console.log(`📊 Total disk-stored PDFs: ${s.disk_pdfs}`);
        console.log(`🖼️  Total base64 documents/images: ${s.base64_docs}`);
        console.log(`📁 Total unique cases: ${s.total_unique_cases}`);
        
        // Check if case 34-2312-235579 exists
        console.log('\n\n' + '='.repeat(60));
        console.log('SEARCHING FOR CASE 34-2312-235579');
        console.log('='.repeat(60));
        
        const targetCase = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM document_storage WHERE case_number = $1 OR case_number LIKE $2) as in_disk,
                (SELECT COUNT(*) FROM notice_components WHERE case_number = $1 OR case_number LIKE $2) as in_components,
                (SELECT COUNT(*) FROM case_service_records WHERE case_number = $1 OR case_number LIKE $2) as in_service
        `, ['34-2312-235579', '%235579%']);
        
        const tc = targetCase.rows[0];
        if (tc.in_disk > 0 || tc.in_components > 0 || tc.in_service > 0) {
            console.log('✅ FOUND case 34-2312-235579:');
            console.log(`  - In document_storage: ${tc.in_disk} records`);
            console.log(`  - In notice_components: ${tc.in_components} records`);
            console.log(`  - In case_service_records: ${tc.in_service} records`);
        } else {
            console.log('❌ Case 34-2312-235579 NOT FOUND in any table');
            
            // Search for similar patterns
            const similar = await client.query(`
                SELECT DISTINCT case_number 
                FROM notice_components 
                WHERE case_number LIKE '%235579%' OR case_number LIKE '%2312%'
                LIMIT 10
            `);
            
            if (similar.rows.length > 0) {
                console.log('\nSimilar case numbers found:');
                similar.rows.forEach(row => console.log(`  • ${row.case_number}`));
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
        console.log('\n✅ Check complete\n');
    }
}

checkAllDocuments();