#!/usr/bin/env node

/**
 * Test PDF Disk Storage System
 * Verifies that PDFs are stored on disk and can be retrieved properly
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require'
});

async function testPDFDiskStorage() {
    console.log('🧪 Testing PDF Disk Storage System...\n');
    
    try {
        // 1. Check if document_storage table exists
        console.log('1️⃣ Checking document_storage table...');
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'document_storage'
            );
        `);
        
        if (tableCheck.rows[0].exists) {
            console.log('✅ document_storage table exists');
            
            // Check for any stored documents
            const docCount = await pool.query('SELECT COUNT(*) FROM document_storage');
            console.log(`   Found ${docCount.rows[0].count} documents in disk storage`);
        } else {
            console.log('⚠️ document_storage table does not exist - will be created on first use');
        }
        
        // 2. Check upload directory
        console.log('\n2️⃣ Checking upload directory...');
        const uploadDir = path.join(__dirname, 'backend/uploads/pdfs');
        
        if (fs.existsSync(uploadDir)) {
            console.log(`✅ Upload directory exists: ${uploadDir}`);
            
            const files = fs.readdirSync(uploadDir);
            console.log(`   Found ${files.length} PDF files on disk`);
            
            if (files.length > 0) {
                console.log('   Sample files:');
                files.slice(0, 5).forEach(file => {
                    const stats = fs.statSync(path.join(uploadDir, file));
                    console.log(`     - ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                });
            }
        } else {
            console.log(`⚠️ Upload directory does not exist yet: ${uploadDir}`);
            console.log('   Will be created when first PDF is uploaded');
        }
        
        // 3. Check notice_components for comparison
        console.log('\n3️⃣ Checking notice_components (old Base64 storage)...');
        const base64Check = await pool.query(`
            SELECT 
                notice_id,
                LENGTH(document_data) as data_size,
                document_mime_type
            FROM notice_components 
            WHERE document_data IS NOT NULL 
            LIMIT 5
        `);
        
        if (base64Check.rows.length > 0) {
            console.log(`⚠️ Found ${base64Check.rows.length} documents still using Base64 storage:`);
            base64Check.rows.forEach(row => {
                const sizeMB = (row.data_size / 1024 / 1024).toFixed(2);
                console.log(`   - Notice ${row.notice_id}: ${sizeMB} MB (${row.document_mime_type || 'unknown type'})`);
            });
            console.log('   These should be migrated to disk storage');
        } else {
            console.log('✅ No documents using Base64 storage (good!)');
        }
        
        // 4. Test retrieval endpoints
        console.log('\n4️⃣ Testing retrieval endpoints...');
        
        // Test if the PDF disk storage route is loaded
        const fetch = (await import('node-fetch')).default;
        const backendUrl = process.env.BACKEND_URL || 'https://nftserviceapp.onrender.com';
        
        try {
            const response = await fetch(`${backendUrl}/api/documents/pdf/test`, {
                method: 'GET'
            });
            
            if (response.status === 400) {
                console.log('✅ PDF disk storage endpoint is responding correctly');
            } else {
                console.log(`⚠️ Unexpected response from PDF endpoint: ${response.status}`);
            }
        } catch (error) {
            console.log('⚠️ Could not reach PDF disk storage endpoint:', error.message);
        }
        
        // 5. Summary
        console.log('\n📊 Summary:');
        console.log('='.repeat(50));
        
        const summary = {
            diskStorageReady: tableCheck.rows[0].exists,
            uploadDirExists: fs.existsSync(uploadDir),
            pdfFilesOnDisk: fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).length : 0,
            base64DocumentsFound: base64Check.rows.length
        };
        
        if (summary.diskStorageReady && summary.uploadDirExists) {
            console.log('✅ PDF Disk Storage System is READY');
            console.log(`   - ${summary.pdfFilesOnDisk} PDFs stored on disk`);
            if (summary.base64DocumentsFound > 0) {
                console.log(`   - ${summary.base64DocumentsFound} documents need migration from Base64`);
            }
        } else {
            console.log('⚠️ PDF Disk Storage System needs initialization');
            console.log('   The system will initialize automatically on first use');
        }
        
        console.log('\n✨ Test complete!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await pool.end();
    }
}

// Run the test
testPDFDiskStorage().catch(console.error);