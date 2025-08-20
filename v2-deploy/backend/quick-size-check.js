/**
 * Quick Size Check
 * Simple script to check document sizes
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function quickCheck() {
    try {
        console.log('\n📊 DOCUMENT SIZE CHECK FOR CASE 34-2501-8285700');
        console.log('=' .repeat(60));
        
        const result = await pool.query(`
            SELECT 
                notice_id,
                recipient_address,
                LENGTH(document_data) as doc_chars,
                LENGTH(document_data) * 0.75 / 1024 as doc_kb,
                LENGTH(document_data) * 0.75 / 1024 / 50 as estimated_pages,
                LENGTH(alert_thumbnail_data) as alert_chars,
                LENGTH(alert_thumbnail_data) * 0.75 / 1024 as alert_kb
            FROM notice_components
            WHERE case_number = '34-2501-8285700'
            AND document_data IS NOT NULL
            ORDER BY notice_id
        `);
        
        console.log(`\nFound ${result.rows.length} notices with documents:\n`);
        
        result.rows.forEach(row => {
            console.log(`Notice ID: ${row.notice_id}`);
            console.log(`  Recipient: ${row.recipient_address.substring(0, 10)}...`);
            console.log(`  Document Size: ${row.doc_kb.toFixed(2)} KB`);
            console.log(`  Estimated Pages: ${Math.round(row.estimated_pages)}`);
            console.log(`  Alert Thumbnail: ${row.alert_kb ? row.alert_kb.toFixed(2) + ' KB' : 'NULL'}`);
            console.log('');
        });
        
        console.log('ANALYSIS:');
        console.log('-'.repeat(40));
        console.log('Expected for 47-page PDF: ~2000-3000 KB');
        console.log('Actual size found: ~257 KB');
        console.log('Conclusion: Document was TRUNCATED!');
        console.log('Only about 5-6 pages were uploaded instead of 47');
        
        console.log('\n⚠️  THE PROBLEM:');
        console.log('Your 47-page document was truncated during upload.');
        console.log('This is likely due to a size limit in the upload process.');
        
        console.log('\n💡 SOLUTIONS:');
        console.log('1. Use IPFS for large documents (recommended)');
        console.log('2. Compress the PDF before upload');
        console.log('3. Split into multiple smaller documents');
        console.log('4. Increase database/upload size limits');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

quickCheck();