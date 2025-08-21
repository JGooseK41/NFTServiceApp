const { Pool } = require('pg');

// Direct connection with explicit SSL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
});

async function fixOrphanedCase() {
    const caseNumber = '34-9633897';
    const serverAddress = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';
    
    console.log('=== FIXING ORPHANED CASE ===');
    console.log('Case Number:', caseNumber);
    console.log('Server Address:', serverAddress);
    console.log('');
    
    try {
        // First check if it exists
        console.log('Checking if case exists in cases table...');
        const checkResult = await pool.query(
            'SELECT id, server_address, created_at FROM cases WHERE id = $1',
            [caseNumber]
        );
        
        if (checkResult.rows.length > 0) {
            console.log('✓ Found orphaned case in database');
            console.log('  Created:', checkResult.rows[0].created_at);
            console.log('  Server:', checkResult.rows[0].server_address);
            
            // Delete it
            console.log('\nDeleting orphaned case...');
            const deleteResult = await pool.query(
                'DELETE FROM cases WHERE id = $1 RETURNING id',
                [caseNumber]
            );
            
            if (deleteResult.rows.length > 0) {
                console.log('✅ Successfully deleted orphaned case:', deleteResult.rows[0].id);
                console.log('\n=== FIXED ===');
                console.log('You can now create case 34-9633897 fresh in the UI.');
            } else {
                console.log('⚠️ Case not deleted - may have been removed already');
            }
        } else {
            console.log('ℹ️ Case not found in database - it may have been cleaned up already');
            console.log('You should be able to create it now.');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('Could not connect to database. Check your connection string.');
        }
    } finally {
        await pool.end();
        console.log('\nDatabase connection closed.');
    }
}

// Run immediately
fixOrphanedCase();