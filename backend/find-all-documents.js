#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

const DB_URL = process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require';

async function findDocuments() {
    const client = new Client({
        connectionString: DB_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
        statement_timeout: 30000,
        idle_in_transaction_session_timeout: 30000
    });
    
    console.log('\n========================================');
    console.log('   SEARCHING FOR ALL DOCUMENTS');
    console.log('========================================\n');
    
    try {
        await client.connect();
        console.log('✅ Connected to database\n');
        
        // 1. Quick summary of all tables
        console.log('1. QUICK SUMMARY');
        console.log('----------------');
        
        const summary = await client.query(`
            SELECT 
                'document_storage' as table_name,
                COUNT(*) as count,
                COUNT(DISTINCT case_number) as cases
            FROM document_storage
            UNION ALL
            SELECT 
                'notice_components' as table_name,
                COUNT(*) as count,
                COUNT(DISTINCT case_number) as cases
            FROM notice_components
            WHERE document_data IS NOT NULL OR alert_thumbnail_data IS NOT NULL
            UNION ALL
            SELECT 
                'case_service_records' as table_name,
                COUNT(*) as count,
                COUNT(DISTINCT case_number) as cases
            FROM case_service_records
        `);
        
        console.log('Table                 | Records | Cases');
        console.log('---------------------|---------|-------');
        summary.rows.forEach(row => {
            console.log(`${row.table_name.padEnd(20)} | ${String(row.count).padStart(7)} | ${String(row.cases).padStart(6)}`);
        });
        
        // 2. Document Storage (PDFs on disk)
        console.log('\n\n2. DOCUMENT_STORAGE (PDFs on Disk)');
        console.log('-----------------------------------');
        
        const diskDocs = await client.query(`
            SELECT 
                notice_id,
                case_number,
                file_name,
                disk_filename,
                file_size,
                created_at
            FROM document_storage
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        if (diskDocs.rows.length > 0) {
            console.log(`Found ${diskDocs.rowCount} recent PDFs:\n`);
            diskDocs.rows.forEach((row, i) => {
                console.log(`${i+1}. Case: ${row.case_number || 'NO CASE'}`);
                console.log(`   Notice: ${row.notice_id}`);
                console.log(`   File: ${row.file_name || 'unnamed'}`);
                console.log(`   Disk: ${row.disk_filename || 'NO DISK FILE'}`);
                console.log(`   Size: ${row.file_size ? (row.file_size/1024/1024).toFixed(2) + ' MB' : 'unknown'}`);
                console.log(`   Date: ${row.created_at}`);
                console.log('');
            });
        } else {
            console.log('❌ No PDFs found in document_storage');
        }
        
        // 3. Notice Components (Base64 images)
        console.log('\n3. NOTICE_COMPONENTS (Base64 Storage)');
        console.log('--------------------------------------');
        
        const components = await client.query(`
            SELECT 
                notice_id,
                case_number,
                alert_id,
                document_id,
                CASE WHEN alert_thumbnail_data IS NOT NULL THEN 'YES' ELSE 'NO' END as has_alert,
                CASE WHEN document_data IS NOT NULL THEN 'YES' ELSE 'NO' END as has_doc,
                created_at
            FROM notice_components
            WHERE alert_thumbnail_data IS NOT NULL OR document_data IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        if (components.rows.length > 0) {
            console.log(`Found ${components.rowCount} recent components with images:\n`);
            components.rows.forEach((row, i) => {
                console.log(`${i+1}. Case: ${row.case_number || 'NO CASE'}`);
                console.log(`   Notice: ${row.notice_id}`);
                console.log(`   Alert ID: ${row.alert_id}, Doc ID: ${row.document_id}`);
                console.log(`   Has Alert Image: ${row.has_alert}`);
                console.log(`   Has Document Image: ${row.has_doc}`);
                console.log(`   Date: ${row.created_at}`);
                console.log('');
            });
        } else {
            console.log('❌ No base64 images found');
        }
        
        // 4. All unique case numbers
        console.log('\n4. ALL UNIQUE CASE NUMBERS');
        console.log('---------------------------');
        
        const cases = await client.query(`
            SELECT DISTINCT case_number 
            FROM (
                SELECT case_number FROM document_storage WHERE case_number IS NOT NULL
                UNION
                SELECT case_number FROM notice_components WHERE case_number IS NOT NULL
                UNION
                SELECT case_number FROM case_service_records WHERE case_number IS NOT NULL
            ) t
            WHERE case_number != ''
            ORDER BY case_number DESC
            LIMIT 20
        `);
        
        if (cases.rows.length > 0) {
            console.log(`Found ${cases.rowCount} unique cases:\n`);
            cases.rows.forEach(row => {
                console.log(`  • ${row.case_number}`);
            });
        }
        
        // 5. Search for case 235579
        console.log('\n\n5. SEARCHING FOR CASE 235579');
        console.log('-----------------------------');
        
        const targetCase = await client.query(`
            SELECT 
                'document_storage' as source,
                notice_id,
                case_number,
                file_name,
                disk_filename
            FROM document_storage
            WHERE case_number LIKE '%235579%'
            UNION ALL
            SELECT 
                'notice_components' as source,
                notice_id,
                case_number,
                'base64_image' as file_name,
                NULL as disk_filename
            FROM notice_components
            WHERE case_number LIKE '%235579%'
            LIMIT 10
        `);
        
        if (targetCase.rows.length > 0) {
            console.log(`✅ Found ${targetCase.rowCount} records with "235579":\n`);
            targetCase.rows.forEach(row => {
                console.log(`Source: ${row.source}`);
                console.log(`  Case: ${row.case_number}`);
                console.log(`  Notice: ${row.notice_id}`);
                console.log(`  File: ${row.file_name}`);
                if (row.disk_filename) {
                    console.log(`  Disk: ${row.disk_filename}`);
                }
                console.log('');
            });
        } else {
            console.log('❌ No records found for case 235579');
        }
        
        console.log('\n========================================');
        console.log('✅ Search complete');
        console.log('========================================\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.message.includes('timeout')) {
            console.log('\n💡 Try running this script from the Render server directly');
        }
    } finally {
        await client.end();
    }
}

// Run the search
findDocuments().catch(console.error);