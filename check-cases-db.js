const { Pool } = require('pg');

async function checkCases() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require'
    });
    
    try {
        // Check cases table
        const casesResult = await pool.query(`
            SELECT id, server_address, status, created_at 
            FROM cases 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        console.log('Cases table:', casesResult.rows);
        
        // Check served_notices table  
        const servedResult = await pool.query(`
            SELECT case_number, server_address, created_at 
            FROM served_notices 
            WHERE case_number IS NOT NULL
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        console.log('\nServed notices with case numbers:', servedResult.rows);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkCases();
