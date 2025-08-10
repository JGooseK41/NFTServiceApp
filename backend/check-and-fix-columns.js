/**
 * Check and fix column types to ensure migration ran correctly
 * This verifies that notice_id columns are TEXT, not INTEGER
 */

const { Pool } = require('pg');

async function checkAndFixColumns() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });

    let client;
    
    try {
        console.log('🔍 Checking column types...\n');
        client = await pool.connect();
        
        // Check current column types
        const checkQuery = `
            SELECT 
                table_name,
                column_name, 
                data_type
            FROM information_schema.columns
            WHERE table_name = 'served_notices'
            AND column_name IN ('notice_id', 'alert_id', 'document_id')
            ORDER BY column_name;
        `;
        
        const result = await client.query(checkQuery);
        
        console.log('Current served_notices column types:');
        result.rows.forEach(row => {
            const icon = row.data_type === 'integer' ? '❌' : '✅';
            console.log(`  ${icon} ${row.column_name}: ${row.data_type}`);
        });
        
        // Check if we need to fix
        const needsFix = result.rows.some(row => row.data_type === 'integer');
        
        if (!needsFix) {
            console.log('\n✅ All columns are already TEXT/VARCHAR. No fix needed!');
            return;
        }
        
        console.log('\n⚠️  INTEGER columns detected. Running fix...\n');
        
        // Run the fix in a transaction
        await client.query('BEGIN');
        
        for (const row of result.rows) {
            if (row.data_type === 'integer') {
                console.log(`  🔧 Converting ${row.column_name} from INTEGER to VARCHAR...`);
                
                try {
                    // First try simple conversion
                    await client.query(`
                        ALTER TABLE served_notices 
                        ALTER COLUMN ${row.column_name} TYPE VARCHAR(255)
                        USING ${row.column_name}::VARCHAR
                    `);
                    console.log(`  ✅ ${row.column_name} converted successfully`);
                } catch (error) {
                    console.log(`  ⚠️  Simple conversion failed, trying with USING clause...`);
                    
                    // Try with explicit conversion
                    await client.query(`
                        ALTER TABLE served_notices 
                        ALTER COLUMN ${row.column_name} TYPE VARCHAR(255)
                        USING COALESCE(${row.column_name}::VARCHAR, '')
                    `);
                    console.log(`  ✅ ${row.column_name} converted with COALESCE`);
                }
            }
        }
        
        await client.query('COMMIT');
        console.log('\n✅ All columns fixed successfully!');
        
        // Verify the fix
        console.log('\n📊 Verifying fix...');
        const verifyResult = await client.query(checkQuery);
        console.log('New served_notices column types:');
        verifyResult.rows.forEach(row => {
            const icon = row.data_type === 'integer' ? '❌' : '✅';
            console.log(`  ${icon} ${row.column_name}: ${row.data_type}`);
        });
        
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('\n❌ Error:', error.message);
        console.error('Details:', error);
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Run the check
console.log('=====================================');
console.log('Column Type Check and Fix Script');
console.log('=====================================');
console.log('Database:', process.env.DATABASE_URL ? 'Production' : 'Local');
console.log('=====================================\n');

checkAndFixColumns().then(() => {
    console.log('\n✨ Script completed!');
    process.exit(0);
}).catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
});