/**
 * Fix Server Access
 * Update notice_components to ensure server_address is set correctly
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function fixServerAccess() {
    try {
        console.log('\n🔧 Fixing Server Access Issues\n');
        
        // Your process server wallet
        const serverWallet = 'TJRex3vGsNeoNjKWEXsM87qCDdvqV7Koa6';
        
        // First, check current state
        console.log('1. Checking current server_address values...');
        const currentState = await pool.query(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(server_address) as has_server_address,
                COUNT(CASE WHEN server_address = $1 THEN 1 END) as matching_server
            FROM notice_components
        `, [serverWallet]);
        
        console.log('Current state:');
        console.table(currentState.rows);
        
        // Update records where server_address is NULL but you are the creator
        console.log('\n2. Updating NULL server_address fields...');
        const updateResult = await pool.query(`
            UPDATE notice_components
            SET server_address = $1
            WHERE server_address IS NULL
            OR server_address = ''
            RETURNING alert_token_id, document_token_id, case_number
        `, [serverWallet]);
        
        console.log(`Updated ${updateResult.rowCount} records`);
        if (updateResult.rowCount > 0) {
            console.log('Updated notices:');
            console.table(updateResult.rows.slice(0, 10)); // Show first 10
        }
        
        // Also update token_tracking if it exists
        console.log('\n3. Updating token_tracking table...');
        try {
            const tokenUpdate = await pool.query(`
                UPDATE token_tracking
                SET server_address = $1
                WHERE server_address IS NULL
                OR server_address = ''
                RETURNING token_id, token_type, case_number
            `, [serverWallet]);
            
            console.log(`Updated ${tokenUpdate.rowCount} token_tracking records`);
            if (tokenUpdate.rowCount > 0) {
                console.log('Updated tokens:');
                console.table(tokenUpdate.rows.slice(0, 10));
            }
        } catch (e) {
            console.log('token_tracking table not found or error:', e.message);
        }
        
        // Verify the fix for specific case
        console.log('\n4. Verifying fix for case 34-2501-8285700...');
        const verifyResult = await pool.query(`
            SELECT 
                alert_token_id,
                document_token_id,
                server_address,
                recipient_address,
                case_number
            FROM notice_components
            WHERE case_number = '34-2501-8285700'
        `);
        
        if (verifyResult.rows.length > 0) {
            console.log('Case 34-2501-8285700 after fix:');
            console.table(verifyResult.rows);
        }
        
        // Final check
        console.log('\n5. Final state check...');
        const finalState = await pool.query(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(server_address) as has_server_address,
                COUNT(CASE WHEN LOWER(server_address) = LOWER($1) THEN 1 END) as matching_server
            FROM notice_components
        `, [serverWallet]);
        
        console.log('Final state:');
        console.table(finalState.rows);
        
        console.log('\n✅ Server access fix complete!');
        console.log('You should now be able to view documents you served.');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

// Add command line option to run the fix
const args = process.argv.slice(2);
if (args.includes('--fix') || args.includes('-f')) {
    console.log('Running fix...');
    fixServerAccess();
} else {
    console.log('This script will update all notice_components records to set you as the server.');
    console.log('Run with --fix or -f flag to apply the fix:');
    console.log('  node fix-server-access.js --fix');
}