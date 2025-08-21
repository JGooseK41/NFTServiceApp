/**
 * Fix NULL server_address values in database
 * Run this in Render shell to fix the constraint violations
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixServerAddresses() {
    const client = await pool.connect();
    
    try {
        console.log('🔧 Fixing NULL server_address values...\n');
        
        // Start transaction
        await client.query('BEGIN');
        
        // 1. First, make the column nullable temporarily
        console.log('1. Making server_address column nullable temporarily...');
        await client.query(`
            ALTER TABLE served_notices 
            ALTER COLUMN server_address DROP NOT NULL
        `);
        
        // 2. Update all NULL server_address values
        console.log('2. Updating NULL server_address values...');
        const updateResult = await client.query(`
            UPDATE served_notices
            SET server_address = 'TJRex3vGsNeoNjKWEXsM87qCDdvqV7Koa6'
            WHERE server_address IS NULL
        `);
        console.log(`   Updated ${updateResult.rowCount} records`);
        
        // 3. Update notice_components table
        console.log('3. Updating notice_components table...');
        const componentsResult = await client.query(`
            UPDATE notice_components
            SET server_address = 'TJRex3vGsNeoNjKWEXsM87qCDdvqV7Koa6'
            WHERE server_address IS NULL OR server_address = ''
        `);
        console.log(`   Updated ${componentsResult.rowCount} records`);
        
        // 4. Check if token_tracking table exists and update it
        console.log('4. Checking token_tracking table...');
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'token_tracking'
            )
        `);
        
        if (tableCheck.rows[0].exists) {
            const tokenResult = await client.query(`
                UPDATE token_tracking
                SET server_address = 'TJRex3vGsNeoNjKWEXsM87qCDdvqV7Koa6'
                WHERE server_address IS NULL OR server_address = ''
            `);
            console.log(`   Updated ${tokenResult.rowCount} token_tracking records`);
        } else {
            console.log('   token_tracking table not found, skipping');
        }
        
        // 5. Re-add the NOT NULL constraint (optional - you might want to keep it nullable)
        // console.log('5. Re-adding NOT NULL constraint...');
        // await client.query(`
        //     ALTER TABLE served_notices 
        //     ALTER COLUMN server_address SET NOT NULL
        // `);
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log('\n✅ Fix completed successfully!');
        
        // Show summary
        const summary = await client.query(`
            SELECT 
                'served_notices' as table_name,
                COUNT(*) as total_records,
                COUNT(server_address) as has_server_address,
                COUNT(CASE WHEN server_address = 'TJRex3vGsNeoNjKWEXsM87qCDdvqV7Koa6' THEN 1 END) as your_wallet
            FROM served_notices
            UNION ALL
            SELECT 
                'notice_components',
                COUNT(*),
                COUNT(server_address),
                COUNT(CASE WHEN server_address = 'TJRex3vGsNeoNjKWEXsM87qCDdvqV7Koa6' THEN 1 END)
            FROM notice_components
        `);
        
        console.log('\nDatabase Summary:');
        console.table(summary.rows);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error fixing server addresses:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the fix
fixServerAddresses().catch(console.error);