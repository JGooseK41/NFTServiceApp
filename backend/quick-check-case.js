const { Client } = require('pg');

async function quickCheck() {
    const client = new Client({
        connectionString: 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        console.log('Connected to database');
        
        // Quick check for case documents
        const result = await client.query(`
            SELECT 
                notice_id,
                case_number,
                CASE WHEN alert_thumbnail_data IS NOT NULL THEN 'YES' ELSE 'NO' END as has_alert,
                CASE WHEN document_data IS NOT NULL THEN 'YES' ELSE 'NO' END as has_document
            FROM notice_components
            WHERE case_number LIKE '%235579%'
            LIMIT 5
        `);
        
        console.log('\nFound', result.rows.length, 'records:');
        result.rows.forEach(row => {
            console.log(`Notice ${row.notice_id}: Alert=${row.has_alert}, Document=${row.has_document}, Case=${row.case_number}`);
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

quickCheck();