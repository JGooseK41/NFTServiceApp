const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
});

async function checkCaseData() {
    try {
        console.log('Checking case 34-4343902 data...\n');
        
        // Check case_service_records
        const serviceRecords = await pool.query(`
            SELECT 
                case_number,
                alert_token_id,
                document_token_id,
                ipfs_hash,
                encryption_key,
                recipients,
                served_at,
                accepted,
                accepted_at
            FROM case_service_records 
            WHERE case_number = '34-4343902'
        `);
        
        if (serviceRecords.rows.length > 0) {
            console.log('=== Case Service Record ===');
            console.log('Case Number:', serviceRecords.rows[0].case_number);
            console.log('Alert Token ID:', serviceRecords.rows[0].alert_token_id);
            console.log('Document Token ID:', serviceRecords.rows[0].document_token_id);
            console.log('IPFS Hash:', serviceRecords.rows[0].ipfs_hash);
            console.log('Encryption Key:', serviceRecords.rows[0].encryption_key);
            console.log('Recipients:', serviceRecords.rows[0].recipients);
            console.log('Served At:', serviceRecords.rows[0].served_at);
            console.log('Accepted:', serviceRecords.rows[0].accepted);
            console.log('Accepted At:', serviceRecords.rows[0].accepted_at);
        } else {
            console.log('No service record found for case 34-4343902');
        }
        
        console.log('\n=== Checking for images ===');
        
        // Check images table
        const images = await pool.query(`
            SELECT 
                case_number,
                notice_id,
                alert_image IS NOT NULL as has_alert_image,
                document_image IS NOT NULL as has_document_image,
                alert_thumbnail IS NOT NULL as has_alert_thumbnail,
                document_thumbnail IS NOT NULL as has_document_thumbnail
            FROM images 
            WHERE case_number = '34-4343902' 
               OR notice_id IN (
                   SELECT alert_token_id FROM case_service_records WHERE case_number = '34-4343902'
                   UNION
                   SELECT document_token_id FROM case_service_records WHERE case_number = '34-4343902'
               )
        `);
        
        if (images.rows.length > 0) {
            console.log('Images found:', images.rows.length);
            images.rows.forEach(row => {
                console.log('- Case:', row.case_number, 'Notice:', row.notice_id);
                console.log('  Alert Image:', row.has_alert_image, 'Doc Image:', row.has_document_image);
                console.log('  Alert Thumb:', row.has_alert_thumbnail, 'Doc Thumb:', row.has_document_thumbnail);
            });
        } else {
            console.log('No images found for this case');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkCaseData();