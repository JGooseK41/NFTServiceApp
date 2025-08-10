const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    let client;
    try {
        console.log('🔄 Running server registration fields migration...');
        
        // Read the migration SQL file
        const migrationPath = path.join(__dirname, 'migrations', 'add_server_registration_fields.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Get a client from the pool
        client = await pool.connect();
        
        // Run the migration
        await client.query(migrationSQL);
        
        console.log('✅ Migration completed successfully!');
        
        // Verify the columns were added
        const checkQuery = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'process_servers' 
            AND column_name IN ('server_id', 'server_name', 'physical_address')
            ORDER BY column_name
        `;
        
        const result = await client.query(checkQuery);
        
        console.log('✅ Verified columns exist:');
        result.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type}`);
        });
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Run the migration
runMigration();