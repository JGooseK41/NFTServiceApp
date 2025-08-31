/**
 * Direct database check for case documents
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
});

async function checkCaseDocuments() {
    const caseNumber = '34-2312-235579';
    console.log(`\n=== Checking documents for case ${caseNumber} ===\n`);
    
    let client;
    try {
        client = await pool.connect();
        console.log('Connected to database\n');
        
        // Check notice_components for document data
        console.log('=== NOTICE_COMPONENTS TABLE ===');
        const componentsQuery = `
            SELECT 
                nc.notice_id,
                nc.alert_id,
                nc.document_id,
                nc.case_number,
                CASE WHEN nc.alert_thumbnail_data IS NOT NULL THEN 'YES' ELSE 'NO' END as has_alert_image,
                CASE WHEN nc.document_data IS NOT NULL THEN 'YES' ELSE 'NO' END as has_document_image,
                LENGTH(nc.alert_thumbnail_data) as alert_image_size,
                LENGTH(nc.document_data) as document_image_size,
                nc.alert_thumbnail_mime_type,
                nc.document_mime_type,
                nc.ipfs_hash,
                nc.document_ipfs_hash,
                nc.created_at
            FROM notice_components nc
            WHERE nc.case_number = $1 OR nc.case_number LIKE $2
            ORDER BY nc.created_at DESC
            LIMIT 10
        `;
        
        const componentsResult = await client.query(componentsQuery, [
            caseNumber, 
            `%235579%`
        ]);
        
        if (componentsResult.rows.length > 0) {
            console.log(`Found ${componentsResult.rows.length} records:\n`);
            componentsResult.rows.forEach((row, index) => {
                console.log(`${index + 1}. Notice ID: ${row.notice_id}`);
                console.log(`   Alert ID: ${row.alert_id}`);
                console.log(`   Document ID: ${row.document_id}`);
                console.log(`   Case Number: ${row.case_number}`);
                console.log(`   Has Alert Image: ${row.has_alert_image} ${row.alert_image_size ? `(${row.alert_image_size} chars)` : ''}`);
                console.log(`   Has Document Image: ${row.has_document_image} ${row.document_image_size ? `(${row.document_image_size} chars)` : ''}`);
                console.log(`   Alert MIME: ${row.alert_thumbnail_mime_type || 'N/A'}`);
                console.log(`   Document MIME: ${row.document_mime_type || 'N/A'}`);
                console.log(`   IPFS Hash: ${row.ipfs_hash || 'N/A'}`);
                console.log(`   Document IPFS: ${row.document_ipfs_hash || 'N/A'}`);
                console.log(`   Created: ${row.created_at}`);
                console.log('');
            });
        } else {
            console.log('No records found in notice_components\n');
        }
        
        // Check simple images table
        console.log('=== SIMPLE_IMAGES TABLE ===');
        const imagesQuery = `
            SELECT 
                notice_id,
                case_number,
                CASE WHEN alert_image IS NOT NULL THEN 'YES' ELSE 'NO' END as has_alert,
                CASE WHEN document_image IS NOT NULL THEN 'YES' ELSE 'NO' END as has_document,
                CASE WHEN alert_thumbnail IS NOT NULL THEN 'YES' ELSE 'NO' END as has_alert_thumb,
                CASE WHEN document_thumbnail IS NOT NULL THEN 'YES' ELSE 'NO' END as has_doc_thumb,
                LENGTH(alert_image) as alert_size,
                LENGTH(document_image) as doc_size,
                created_at
            FROM images
            WHERE case_number = $1 OR case_number LIKE $2
            ORDER BY created_at DESC
            LIMIT 10
        `;
        
        try {
            const imagesResult = await client.query(imagesQuery, [
                caseNumber,
                `%235579%`
            ]);
            
            if (imagesResult.rows.length > 0) {
                console.log(`Found ${imagesResult.rows.length} records:\n`);
                imagesResult.rows.forEach((row, index) => {
                    console.log(`${index + 1}. Notice ID: ${row.notice_id}`);
                    console.log(`   Case Number: ${row.case_number}`);
                    console.log(`   Alert Image: ${row.has_alert} ${row.alert_size ? `(${row.alert_size} chars)` : ''}`);
                    console.log(`   Document Image: ${row.has_document} ${row.doc_size ? `(${row.doc_size} chars)` : ''}`);
                    console.log(`   Alert Thumbnail: ${row.has_alert_thumb}`);
                    console.log(`   Document Thumbnail: ${row.has_doc_thumb}`);
                    console.log(`   Created: ${row.created_at}`);
                    console.log('');
                });
            } else {
                console.log('No records found in simple_images\n');
            }
        } catch (e) {
            console.log('Simple images table not available or error:', e.message, '\n');
        }
        
        // Check for any notices with this case pattern
        console.log('=== SEARCHING FOR ANY DOCUMENTS WITH CASE PATTERN ===');
        const searchQuery = `
            SELECT 
                notice_id,
                alert_id,
                document_id,
                case_number,
                CASE WHEN alert_thumbnail_data IS NOT NULL THEN 'YES' ELSE 'NO' END as has_alert,
                CASE WHEN document_data IS NOT NULL THEN 'YES' ELSE 'NO' END as has_document
            FROM notice_components
            WHERE case_number IS NOT NULL 
            AND (
                case_number LIKE '%235579%' 
                OR case_number LIKE '%2312%'
                OR case_number = '34-2312-235579'
            )
            LIMIT 20
        `;
        
        const searchResult = await client.query(searchQuery);
        if (searchResult.rows.length > 0) {
            console.log(`Found ${searchResult.rows.length} related records:\n`);
            const uniqueCases = [...new Set(searchResult.rows.map(r => r.case_number))];
            console.log('Unique case numbers found:');
            uniqueCases.forEach(c => console.log(`  - ${c}`));
            
            console.log('\nDocument availability:');
            const withImages = searchResult.rows.filter(r => r.has_alert === 'YES' || r.has_document === 'YES');
            console.log(`  Records with images: ${withImages.length}/${searchResult.rows.length}`);
        } else {
            console.log('No records found with case pattern\n');
        }
        
        console.log('\n✅ Check completed');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

checkCaseDocuments();