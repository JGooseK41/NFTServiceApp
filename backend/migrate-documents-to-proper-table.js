/**
 * Migrate Documents to Proper Architecture
 * 
 * This script migrates recovered documents from document_storage table
 * to the proper location for long-term scalable architecture
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL not set. This must be run on Render or with proper environment.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function analyzeCurrentStructure() {
    console.log('📊 Analyzing current database structure...\n');
    
    try {
        // Check what tables exist
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `;
        const tables = await pool.query(tablesQuery);
        console.log('Existing tables:');
        tables.rows.forEach(t => console.log(`  - ${t.table_name}`));
        
        // Check notice_components structure
        console.log('\n📋 Checking notice_components table structure:');
        const ncColumnsQuery = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'notice_components'
            ORDER BY ordinal_position;
        `;
        const ncColumns = await pool.query(ncColumnsQuery);
        
        if (ncColumns.rows.length > 0) {
            console.log('notice_components columns:');
            ncColumns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
            });
        } else {
            console.log('notice_components table not found');
        }
        
        // Check document_storage structure
        console.log('\n📦 Checking document_storage table:');
        const dsColumnsQuery = `
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'document_storage'
            ORDER BY ordinal_position;
        `;
        const dsColumns = await pool.query(dsColumnsQuery);
        
        if (dsColumns.rows.length > 0) {
            console.log('document_storage columns:');
            dsColumns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type}`);
            });
        }
        
        // Check how many documents we have to migrate
        const countQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT notice_id) as unique_notices,
                SUM(CASE WHEN document_type = 'thumbnail' THEN 1 ELSE 0 END) as thumbnails,
                SUM(CASE WHEN document_type = 'document' THEN 1 ELSE 0 END) as documents
            FROM document_storage;
        `;
        const counts = await pool.query(countQuery);
        
        console.log('\n📈 Document storage statistics:');
        console.log(`  Total records: ${counts.rows[0].total}`);
        console.log(`  Unique notices: ${counts.rows[0].unique_notices}`);
        console.log(`  Thumbnails: ${counts.rows[0].thumbnails}`);
        console.log(`  Documents: ${counts.rows[0].documents}`);
        
        // Check if notice_components has image storage columns
        const imageColumnsQuery = `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'notice_components'
            AND column_name IN ('thumbnail_data', 'document_data', 'alert_thumbnail', 'document_unencrypted');
        `;
        const imageColumns = await pool.query(imageColumnsQuery);
        
        console.log('\n🖼️ Image storage columns in notice_components:');
        if (imageColumns.rows.length > 0) {
            imageColumns.rows.forEach(col => console.log(`  - ${col.column_name}`));
        } else {
            console.log('  No image storage columns found - they need to be added');
        }
        
    } catch (error) {
        console.error('Error analyzing structure:', error);
    }
}

async function prepareNoticeComponentsTable() {
    console.log('\n🔧 Preparing notice_components table for document storage...\n');
    
    try {
        // Add columns for storing documents if they don't exist
        const alterQueries = [
            `ALTER TABLE notice_components 
             ADD COLUMN IF NOT EXISTS alert_thumbnail_data TEXT`,
            
            `ALTER TABLE notice_components 
             ADD COLUMN IF NOT EXISTS alert_thumbnail_mime_type VARCHAR(100)`,
            
            `ALTER TABLE notice_components 
             ADD COLUMN IF NOT EXISTS document_data TEXT`,
            
            `ALTER TABLE notice_components 
             ADD COLUMN IF NOT EXISTS document_mime_type VARCHAR(100)`,
            
            `ALTER TABLE notice_components 
             ADD COLUMN IF NOT EXISTS documents_stored_at TIMESTAMP`,
            
            `ALTER TABLE notice_components 
             ADD COLUMN IF NOT EXISTS storage_source VARCHAR(50)`
        ];
        
        for (const query of alterQueries) {
            try {
                await pool.query(query);
                console.log(`✅ Added/verified column`);
            } catch (error) {
                if (error.code === '42701') { // Column already exists
                    console.log(`  Column already exists`);
                } else {
                    throw error;
                }
            }
        }
        
        console.log('\n✅ notice_components table ready for document storage');
        
    } catch (error) {
        console.error('Error preparing table:', error);
        throw error;
    }
}

async function migrateDocuments() {
    console.log('\n🚀 Starting document migration...\n');
    
    try {
        // Get all documents from document_storage
        const documentsQuery = `
            SELECT 
                notice_id,
                document_type,
                file_data,
                mime_type,
                file_name,
                created_at
            FROM document_storage
            ORDER BY notice_id, document_type;
        `;
        
        const documents = await pool.query(documentsQuery);
        console.log(`Found ${documents.rows.length} documents to migrate`);
        
        // Group by notice_id
        const noticeDocuments = {};
        documents.rows.forEach(doc => {
            if (!noticeDocuments[doc.notice_id]) {
                noticeDocuments[doc.notice_id] = {};
            }
            noticeDocuments[doc.notice_id][doc.document_type] = doc;
        });
        
        let migrated = 0;
        let failed = 0;
        
        for (const [noticeId, docs] of Object.entries(noticeDocuments)) {
            try {
                // Check if notice_components entry exists
                const existsQuery = `
                    SELECT notice_id FROM notice_components WHERE notice_id = $1
                `;
                const exists = await pool.query(existsQuery, [noticeId]);
                
                if (exists.rows.length === 0) {
                    // Create notice_components entry
                    await pool.query(`
                        INSERT INTO notice_components (notice_id, created_at)
                        VALUES ($1, CURRENT_TIMESTAMP)
                    `, [noticeId]);
                    console.log(`Created notice_components entry for ${noticeId}`);
                }
                
                // Update with document data
                const updateQuery = `
                    UPDATE notice_components
                    SET 
                        alert_thumbnail_data = $1,
                        alert_thumbnail_mime_type = $2,
                        document_data = $3,
                        document_mime_type = $4,
                        documents_stored_at = CURRENT_TIMESTAMP,
                        storage_source = 'migrated_from_document_storage'
                    WHERE notice_id = $5
                `;
                
                const values = [
                    docs.thumbnail ? docs.thumbnail.file_data : null,
                    docs.thumbnail ? docs.thumbnail.mime_type : null,
                    docs.document ? docs.document.file_data : null,
                    docs.document ? docs.document.mime_type : null,
                    noticeId
                ];
                
                await pool.query(updateQuery, values);
                migrated++;
                console.log(`✅ Migrated documents for notice ${noticeId}`);
                
            } catch (error) {
                console.error(`❌ Failed to migrate notice ${noticeId}:`, error.message);
                failed++;
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('MIGRATION COMPLETE');
        console.log(`✅ Successfully migrated: ${migrated} notices`);
        console.log(`❌ Failed: ${failed} notices`);
        
        // Verify migration
        const verifyQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(alert_thumbnail_data) as with_thumbnails,
                COUNT(document_data) as with_documents
            FROM notice_components
            WHERE storage_source = 'migrated_from_document_storage';
        `;
        
        const verification = await pool.query(verifyQuery);
        console.log('\n📊 Verification:');
        console.log(`  Total migrated entries: ${verification.rows[0].total}`);
        console.log(`  With thumbnails: ${verification.rows[0].with_thumbnails}`);
        console.log(`  With documents: ${verification.rows[0].with_documents}`);
        
    } catch (error) {
        console.error('Migration error:', error);
        throw error;
    }
}

async function updateDocumentRoutes() {
    console.log('\n📝 Instructions for updating document retrieval:\n');
    
    console.log('The documents are now stored in notice_components table.');
    console.log('The backend routes need to be updated to fetch from there.');
    console.log('\nThe frontend expects these endpoints:');
    console.log('  GET /api/documents/:noticeId/images');
    console.log('  POST /api/documents/notice/:noticeId/components');
    console.log('\nThese should now query notice_components table instead of document_storage.');
}

async function main() {
    console.log('🏗️ Document Migration to Proper Architecture\n');
    console.log('='.repeat(50));
    
    try {
        // Step 1: Analyze current structure
        await analyzeCurrentStructure();
        
        // Step 2: Prepare the target table
        await prepareNoticeComponentsTable();
        
        // Step 3: Migrate the documents
        await migrateDocuments();
        
        // Step 4: Show next steps
        await updateDocumentRoutes();
        
    } catch (error) {
        console.error('\n❌ Fatal error:', error);
    } finally {
        await pool.end();
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}