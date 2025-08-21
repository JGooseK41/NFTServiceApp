const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') ? 
        { rejectUnauthorized: false } : false
});

async function checkCase() {
    const caseNumber = '34-9633897';
    const serverAddress = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';
    
    try {
        console.log('Checking for case:', caseNumber);
        console.log('Server address:', serverAddress);
        
        // Check in cases table
        try {
            const casesResult = await pool.query(
                'SELECT * FROM cases WHERE id = $1 AND server_address = $2',
                [caseNumber, serverAddress]
            );
            console.log('\nIn cases table:', casesResult.rows.length, 'records found');
            if (casesResult.rows.length > 0) {
                console.log('Case exists in cases table');
            }
        } catch (e) {
            console.log('Cases table error:', e.message);
        }
        
        // Check in served_notices table
        try {
            const noticesResult = await pool.query(
                'SELECT COUNT(*) as count FROM served_notices WHERE case_number = $1 AND server_address = $2',
                [caseNumber, serverAddress]
            );
            console.log('\nIn served_notices table:', noticesResult.rows[0].count, 'records found');
        } catch (e) {
            console.log('Served_notices table error:', e.message);
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkCase();