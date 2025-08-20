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
        console.log('🔄 Running IPFS hash column migration...');
        
        // Read the migration SQL file
        const migrationPath = path.join(__dirname, 'migrations', 'add_ipfs_hash_column.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Get a client from the pool
        client = await pool.connect();
        
        // Run the migration
        await client.query(migrationSQL);
        
        console.log('✅ Migration completed successfully!');
        
        // Verify the column was added
        const checkQuery = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'served_notices' 
            AND column_name = 'ipfs_hash'
        `;
        
        const result = await client.query(checkQuery);
        
        if (result.rows.length > 0) {
            console.log('✅ Verified: ipfs_hash column exists in served_notices table');
            console.log('Column details:', result.rows[0]);
        } else {
            console.log('⚠️ Warning: ipfs_hash column not found after migration');
        }
        
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