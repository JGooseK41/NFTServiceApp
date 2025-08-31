const { Client } = require('pg');

async function quickCheck() {
    const client = new Client({
        connectionString: 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 60000,
        query_timeout: 60000
    });
    
    try {
        await client.connect();
        console.log('Connected!\n');
        
        // Quick count
        const counts = await client.query(`
            SELECT 
                'document_storage' as table_name, COUNT(*) as count 
            FROM document_storage
            UNION ALL
            SELECT 
                'notice_components' as table_name, COUNT(*) as count 
            FROM notice_components
            UNION ALL
            SELECT 
                'case_service_records' as table_name, COUNT(*) as count 
            FROM case_service_records
        `);
        
        console.log('DOCUMENT COUNTS:');
        counts.rows.forEach(row => {
            console.log(`${row.table_name}: ${row.count} records`);
        });
        
        // Check for case 235579
        console.log('\nCASE 235579:');
        const caseCheck = await client.query(`
            SELECT case_number, COUNT(*) as count 
            FROM notice_components 
            WHERE case_number LIKE '%235579%' 
            GROUP BY case_number
            LIMIT 5
        `);
        
        if (caseCheck.rows.length > 0) {
            caseCheck.rows.forEach(row => {
                console.log(`Found: ${row.case_number} (${row.count} records)`);
            });
        } else {
            console.log('Not found');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

quickCheck();