/**
 * Run Token ID Migration
 * Adds token ID tracking to the database
 */

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
        console.log('🚀 Starting Token ID migration...');
        
        client = await pool.connect();
        
        // Read migration SQL
        const migrationPath = path.join(__dirname, 'migrations', 'add-token-ids.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Begin transaction
        await client.query('BEGIN');
        
        // Run migration
        console.log('📝 Adding token ID columns and indexes...');
        await client.query(migrationSQL);
        
        // Update existing notices with token IDs if we have them
        console.log('🔄 Updating existing notices with token IDs...');
        
        // First, let's check what data we have
        const checkResult = await client.query(`
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN notice_id ~ '^[0-9]+$' THEN 1 END) as numeric_ids
            FROM notice_components
        `);
        
        console.log(`Found ${checkResult.rows[0].total} notices, ${checkResult.rows[0].numeric_ids} with numeric IDs`);
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log('✅ Migration completed successfully!');
        
        // Show sample data
        const sampleResult = await client.query(`
            SELECT notice_id, alert_token_id, document_token_id, unified_reference
            FROM notice_components
            LIMIT 5
        `);
        
        console.log('\n📊 Sample migrated data:');
        console.table(sampleResult.rows);
        
        // Show token registry view
        const registryResult = await client.query(`
            SELECT * FROM token_registry LIMIT 5
        `);
        
        console.log('\n📋 Token Registry View:');
        console.table(registryResult.rows);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        
        if (client) {
            try {
                await client.query('ROLLBACK');
                console.log('🔄 Transaction rolled back');
            } catch (rollbackError) {
                console.error('Failed to rollback:', rollbackError);
            }
        }
        
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Run the migration
runMigration().catch(console.error);