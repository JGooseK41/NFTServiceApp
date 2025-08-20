/**
 * One-time update script to set all existing notices to your server address
 * Since you're the only one who has used the system so far
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function updateExistingNotices() {
    const client = await pool.connect();
    
    // Your server address
    const YOUR_ADDRESS = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';
    
    try {
        console.log('🔧 Updating all existing notices to your server address...\n');
        console.log('Server Address:', YOUR_ADDRESS);
        console.log('');
        
        // Start transaction
        await client.query('BEGIN');
        
        // 1. Make server_address nullable temporarily (if not already)
        console.log('1. Making server_address nullable temporarily...');
        await client.query(`
            ALTER TABLE served_notices 
            ALTER COLUMN server_address DROP NOT NULL
        `).catch(e => console.log('   Column already nullable'));
        
        // 2. Update ALL server_address values in served_notices
        console.log('2. Updating ALL served_notices records...');
        const servedResult = await client.query(`
            UPDATE served_notices
            SET server_address = $1
            WHERE server_address IS NULL 
               OR server_address = ''
               OR server_address != $1
        `, [YOUR_ADDRESS]);
        console.log(`   Updated ${servedResult.rowCount} served_notices records`);
        
        // 3. Update ALL notice_components records
        console.log('3. Updating ALL notice_components records...');
        const componentsResult = await client.query(`
            UPDATE notice_components
            SET server_address = $1
            WHERE server_address IS NULL 
               OR server_address = ''
               OR server_address != $1
        `, [YOUR_ADDRESS]);
        console.log(`   Updated ${componentsResult.rowCount} notice_components records`);
        
        // 4. Update token_tracking if it exists
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
                SET server_address = $1
                WHERE server_address IS NULL 
                   OR server_address = ''
                   OR server_address != $1
            `, [YOUR_ADDRESS]);
            console.log(`   Updated ${tokenResult.rowCount} token_tracking records`);
        } else {
            console.log('   token_tracking table not found, skipping');
        }
        
        // 5. Update documents table if it has server_address
        console.log('5. Checking documents table...');
        const hasColumn = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'documents' 
                AND column_name = 'server_address'
            )
        `);
        
        if (hasColumn.rows[0].exists) {
            const docsResult = await client.query(`
                UPDATE documents
                SET server_address = $1
                WHERE server_address IS NULL 
                   OR server_address = ''
                   OR server_address != $1
            `, [YOUR_ADDRESS]);
            console.log(`   Updated ${docsResult.rowCount} documents records`);
        } else {
            console.log('   documents table does not have server_address column');
        }
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log('\n✅ Update completed successfully!');
        
        // Show summary
        const summary = await client.query(`
            SELECT 
                'served_notices' as table_name,
                COUNT(*) as total_records,
                COUNT(CASE WHEN server_address = $1 THEN 1 END) as updated_to_your_address
            FROM served_notices
            UNION ALL
            SELECT 
                'notice_components',
                COUNT(*),
                COUNT(CASE WHEN server_address = $1 THEN 1 END)
            FROM notice_components
        `, [YOUR_ADDRESS]);
        
        console.log('\nDatabase Summary:');
        console.table(summary.rows);
        
        console.log('\n✅ All existing notices have been updated to your server address!');
        console.log('Going forward, new notices will use the connected wallet address.');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error updating server addresses:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the update
updateExistingNotices().catch(console.error);