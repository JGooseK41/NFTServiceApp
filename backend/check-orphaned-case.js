const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') ? 
        { rejectUnauthorized: false } : false
});

async function checkAndFixCase() {
    const caseNumber = '34-9633897';
    const serverAddress = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';
    
    try {
        console.log('=== Checking for case:', caseNumber);
        console.log('=== Server address:', serverAddress);
        console.log('');
        
        // Check in cases table
        console.log('1. Checking cases table...');
        const casesResult = await pool.query(
            'SELECT * FROM cases WHERE id = $1 AND server_address = $2',
            [caseNumber, serverAddress]
        );
        console.log('   Found in cases table:', casesResult.rows.length, 'records');
        if (casesResult.rows.length > 0) {
            console.log('   Case data:', {
                id: casesResult.rows[0].id,
                server: casesResult.rows[0].server_address,
                created: casesResult.rows[0].created_at,
                status: casesResult.rows[0].status
            });
        }
        
        // Check in served_notices table
        console.log('\n2. Checking served_notices table...');
        const noticesResult = await pool.query(
            'SELECT * FROM served_notices WHERE case_number = $1 AND server_address = $2',
            [caseNumber, serverAddress]
        );
        console.log('   Found in served_notices:', noticesResult.rows.length, 'records');
        
        // Check what the simple-cases endpoint would return
        console.log('\n3. Checking what simple-cases query returns...');
        const simpleCasesQuery = `
            SELECT DISTINCT
                case_number,
                server_address,
                recipient_address,
                recipient_name,
                notice_type,
                issuing_agency,
                created_at
            FROM served_notices
            WHERE LOWER(server_address) = LOWER($1)
                AND case_number IS NOT NULL
                AND case_number != ''
            ORDER BY created_at DESC
        `;
        const simpleCasesResult = await pool.query(simpleCasesQuery, [serverAddress]);
        const caseNumbers = [...new Set(simpleCasesResult.rows.map(r => r.case_number))];
        console.log('   Total cases found for server:', caseNumbers.length);
        console.log('   Case numbers:', caseNumbers);
        console.log('   Contains our case?', caseNumbers.includes(caseNumber));
        
        // Proposed fix
        if (casesResult.rows.length > 0 && noticesResult.rows.length === 0) {
            console.log('\n=== ISSUE FOUND ===');
            console.log('Case exists in cases table but not in served_notices.');
            console.log('This is why it\'s not showing in your Cases tab.');
            
            const fix = process.argv[2] === '--fix';
            if (fix) {
                console.log('\n=== APPLYING FIX ===');
                console.log('Deleting orphaned case from cases table...');
                await pool.query(
                    'DELETE FROM cases WHERE id = $1 AND server_address = $2',
                    [caseNumber, serverAddress]
                );
                console.log('✅ Orphaned case deleted. You can now create it fresh.');
            } else {
                console.log('\nTo fix this, run: node check-orphaned-case.js --fix');
            }
        } else if (casesResult.rows.length === 0 && noticesResult.rows.length === 0) {
            console.log('\n=== No case found in either table ===');
            console.log('The case might be cached somewhere else or in a different format.');
        } else {
            console.log('\n=== Case status is normal ===');
            console.log('Case should be visible in the Cases tab.');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkAndFixCase();