const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL || "postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db",
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        await client.connect();
        console.log('Connected to database');
        
        // Check case
        const res = await client.query(
            "SELECT case_number, status, created_at FROM cases WHERE case_number = '34-2312-235579'"
        );
        
        console.log('Case data:', res.rows);
        
        // Check service record
        const res2 = await client.query(
            "SELECT case_number, transaction_hash, alert_token_id, document_token_id FROM case_service_records WHERE case_number = '34-2312-235579'"
        );
        
        console.log('Service record:', res2.rows);
        
        await client.end();
    } catch (err) {
        console.error('Error:', err.message);
        await client.end();
    }
}

check();