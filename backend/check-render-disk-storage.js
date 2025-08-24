const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function checkRenderDiskStorage() {
    console.log('=== CHECKING RENDER DISK STORAGE FOR DOCUMENTS ===\n');
    
    // Check if running on Render (has /var/data)
    const isRender = fs.existsSync('/var/data');
    console.log(`Running on Render: ${isRender ? 'YES' : 'NO (local environment)'}\n`);
    
    // Possible document storage paths
    const storagePaths = [
        '/var/data/documents',
        '/var/data/pdfs',
        '/var/data/uploads',
        '/var/data/notices',
        '/var/data/ipfs',
        './documents',
        './uploads',
        './pdfs',
        '../documents',
        '../uploads'
    ];
    
    console.log('=== CHECKING STORAGE PATHS ===\n');
    
    for (const storagePath of storagePaths) {
        try {
            if (fs.existsSync(storagePath)) {
                const stats = fs.statSync(storagePath);
                if (stats.isDirectory()) {
                    const files = fs.readdirSync(storagePath);
                    console.log(`✅ Found directory: ${storagePath}`);
                    console.log(`   Files: ${files.length}`);
                    
                    if (files.length > 0) {
                        // Show first few files
                        console.log('   Sample files:');
                        files.slice(0, 5).forEach(file => {
                            const filePath = path.join(storagePath, file);
                            const fileStats = fs.statSync(filePath);
                            console.log(`     - ${file} (${fileStats.size} bytes)`);
                        });
                        
                        // Check for PDF files
                        const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
                        if (pdfFiles.length > 0) {
                            console.log(`   PDF files found: ${pdfFiles.length}`);
                            pdfFiles.slice(0, 3).forEach(pdf => {
                                console.log(`     - ${pdf}`);
                            });
                        }
                        
                        // Check for encrypted files
                        const encFiles = files.filter(f => f.includes('encrypted') || f.endsWith('.enc'));
                        if (encFiles.length > 0) {
                            console.log(`   Encrypted files found: ${encFiles.length}`);
                        }
                    }
                } else {
                    console.log(`📄 Found file (not directory): ${storagePath}`);
                }
            }
        } catch (err) {
            // Path doesn't exist or permission denied
        }
    }
    
    // Check database for file paths
    console.log('\n=== CHECKING DATABASE FOR FILE PATHS ===\n');
    
    try {
        // Check documents_v2 table
        const docsV2Query = `
            SELECT 
                id,
                file_path,
                original_name,
                file_size,
                created_at
            FROM documents_v2
            WHERE file_path IS NOT NULL
            LIMIT 5
        `;
        
        const docsV2 = await pool.query(docsV2Query);
        if (docsV2.rows.length > 0) {
            console.log('documents_v2 table has file paths:');
            docsV2.rows.forEach(row => {
                console.log(`  ID ${row.id}: ${row.file_path}`);
                console.log(`    Name: ${row.original_name}, Size: ${row.file_size} bytes`);
                
                // Check if file exists
                if (fs.existsSync(row.file_path)) {
                    console.log(`    ✅ File exists on disk`);
                } else {
                    console.log(`    ❌ File NOT found on disk`);
                }
            });
        } else {
            console.log('No file paths in documents_v2 table');
        }
        
        // Check document_storage table
        const storageQuery = `
            SELECT 
                id,
                notice_id,
                document_path,
                created_at
            FROM document_storage
            WHERE document_path IS NOT NULL
            LIMIT 5
        `;
        
        const storage = await pool.query(storageQuery);
        if (storage.rows.length > 0) {
            console.log('\ndocument_storage table has paths:');
            storage.rows.forEach(row => {
                console.log(`  Notice ${row.notice_id}: ${row.document_path}`);
                
                // Check if file exists
                if (fs.existsSync(row.document_path)) {
                    console.log(`    ✅ File exists on disk`);
                } else {
                    console.log(`    ❌ File NOT found on disk`);
                }
            });
        } else {
            console.log('No document paths in document_storage table');
        }
        
        // Check for IPFS-related data in complete_flow_documents
        const flowQuery = `
            SELECT 
                token_id,
                ipfs_hash,
                encryption_key,
                document_path,
                case_number
            FROM complete_flow_documents
            WHERE token_id IN ('1', '3', '5', '7', '9', '11', '13', '15', '17', '19')
            ORDER BY token_id::int
        `;
        
        const flowDocs = await pool.query(flowQuery);
        console.log('\n=== COMPLETE_FLOW_DOCUMENTS (Alert NFTs 1-19) ===\n');
        if (flowDocs.rows.length > 0) {
            flowDocs.rows.forEach(row => {
                console.log(`Alert NFT #${row.token_id}:`);
                console.log(`  IPFS Hash: ${row.ipfs_hash || 'NONE'}`);
                console.log(`  Encryption Key: ${row.encryption_key ? 'YES' : 'NO'}`);
                console.log(`  Document Path: ${row.document_path || 'NONE'}`);
                if (row.document_path && fs.existsSync(row.document_path)) {
                    console.log(`  ✅ File exists on disk`);
                }
                console.log(`  Case: ${row.case_number}`);
            });
        } else {
            console.log('No data found for these Alert NFTs');
        }
        
    } catch (error) {
        console.error('Database error:', error.message);
    }
    
    // Check environment variables for storage configuration
    console.log('\n=== STORAGE CONFIGURATION ===\n');
    console.log(`DOCUMENT_STORAGE_PATH: ${process.env.DOCUMENT_STORAGE_PATH || 'Not set'}`);
    console.log(`IPFS_GATEWAY: ${process.env.IPFS_GATEWAY || 'Not set'}`);
    console.log(`PINATA_API_KEY: ${process.env.PINATA_API_KEY ? 'Set' : 'Not set'}`);
    console.log(`PINATA_SECRET_KEY: ${process.env.PINATA_SECRET_KEY ? 'Set' : 'Not set'}`);
    
    await pool.end();
}

checkRenderDiskStorage();