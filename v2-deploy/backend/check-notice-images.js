const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function checkNoticeImages(noticeId) {
    try {
        console.log(`\nChecking images for notice ID: ${noticeId}\n`);
        
        // Check notice_components table
        const componentsQuery = `
            SELECT 
                notice_id,
                alert_thumbnail_data IS NOT NULL as has_thumbnail_data,
                alert_thumbnail_url,
                document_data IS NOT NULL as has_document_data,
                document_unencrypted_url,
                storage_source,
                LENGTH(alert_thumbnail_data) as thumbnail_data_size,
                LENGTH(document_data) as document_data_size
            FROM notice_components
            WHERE notice_id = $1
        `;
        
        const componentsResult = await pool.query(componentsQuery, [noticeId]);
        
        if (componentsResult.rows.length > 0) {
            console.log('Found in notice_components table:');
            const row = componentsResult.rows[0];
            console.log('- Has thumbnail data (base64):', row.has_thumbnail_data);
            console.log('- Thumbnail URL (legacy):', row.alert_thumbnail_url);
            console.log('- Thumbnail data size:', row.thumbnail_data_size || 0, 'bytes');
            console.log('- Has document data (base64):', row.has_document_data);
            console.log('- Document URL (legacy):', row.document_unencrypted_url);
            console.log('- Document data size:', row.document_data_size || 0, 'bytes');
            console.log('- Storage source:', row.storage_source);
            
            if (row.alert_thumbnail_url && row.alert_thumbnail_url.includes('/uploads/')) {
                console.log('\n⚠️  WARNING: This notice has legacy file URLs that no longer exist!');
                console.log('The URLs point to temporary storage that has been removed.');
            }
            
            if (!row.has_thumbnail_data && !row.has_document_data) {
                console.log('\n❌ ERROR: No base64 data found! This notice has no viewable images.');
            }
        } else {
            console.log('Not found in notice_components table');
            
            // Check document_storage as fallback
            const storageQuery = `
                SELECT 
                    notice_id,
                    document_type,
                    file_data IS NOT NULL as has_data,
                    LENGTH(file_data) as data_size,
                    mime_type
                FROM document_storage
                WHERE notice_id = $1
            `;
            
            const storageResult = await pool.query(storageQuery, [noticeId]);
            
            if (storageResult.rows.length > 0) {
                console.log('\nFound in document_storage table (fallback):');
                storageResult.rows.forEach(row => {
                    console.log(`- ${row.document_type}: ${row.has_data ? 'Has data' : 'No data'} (${row.data_size || 0} bytes, ${row.mime_type})`);
                });
            } else {
                console.log('Not found in document_storage table either');
            }
        }
        
    } catch (error) {
        console.error('Error checking notice images:', error);
    } finally {
        await pool.end();
    }
}

// Get notice ID from command line or use the one from the error
const noticeId = process.argv[2] || '943220200';
checkNoticeImages(noticeId);