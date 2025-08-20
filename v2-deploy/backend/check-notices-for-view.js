const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db';

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
});

async function checkNotices() {
    try {
        const result = await pool.query(`
            SELECT 
                notice_id, 
                document_id, 
                recipient_address,
                document_accepted,
                created_at
            FROM notice_components 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        console.log('Recent notices for testing view-only access:\n');
        result.rows.forEach(row => {
            console.log(`Notice ID: ${row.notice_id}`);
            console.log(`Document ID: ${row.document_id}`);
            console.log(`Recipient: ${row.recipient_address}`);
            console.log(`Signed: ${row.document_accepted ? 'Yes' : 'No (can use view-only)'}`);
            console.log(`Created: ${new Date(row.created_at).toLocaleString()}`);
            console.log('---');
        });
        
        if (result.rows.length > 0) {
            const firstNotice = result.rows[0];
            console.log('\nTo test view-only access from BlockServed:');
            console.log(`https://nftserviceapp.netlify.app/?noticeId=${firstNotice.notice_id}&documentId=${firstNotice.document_id}&action=view`);
            console.log(`\nConnect with wallet: ${firstNotice.recipient_address}`);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkNotices();