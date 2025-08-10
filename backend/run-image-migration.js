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
        console.log('🔄 Running image URL columns migration...');
        
        // Read the migration SQL file
        const migrationPath = path.join(__dirname, 'migrations', 'add_image_url_columns.sql');
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
            WHERE table_name = 'served_notices' 
            AND column_name IN ('alert_thumbnail_url', 'document_unencrypted_url', 'recipient_name', 'page_count', 'transaction_hash', 'block_number')
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