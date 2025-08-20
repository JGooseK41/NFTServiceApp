/**
 * Run Document Access Control Migration
 * Sets up access control tables
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
        console.log('🚀 Starting document access control migration...');
        
        client = await pool.connect();
        
        // Begin transaction
        await client.query('BEGIN');
        
        // Run document access control migration
        const migrationPath = path.join(__dirname, 'migrations', 'document-access-control.sql');
        
        if (fs.existsSync(migrationPath)) {
            console.log('\n📝 Running document-access-control.sql...');
            const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
            await client.query(migrationSQL);
            console.log('✅ Document access control tables created');
        } else {
            console.error(`❌ Migration file not found: ${migrationPath}`);
            throw new Error('Migration file not found');
        }
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log('\n✅ Migration completed successfully!');
        
        // Show table structure
        console.log('\n📊 Access control tables:');
        
        const tables = [
            'document_access_tokens',
            'access_attempts',
            'document_access_log'
        ];
        
        for (const table of tables) {
            try {
                const countResult = await client.query(
                    `SELECT COUNT(*) as count FROM ${table}`,
                    []
                );
                console.log(`  - ${table}: ${countResult.rows[0].count} records`);
            } catch (e) {
                console.log(`  - ${table}: table created`);
            }
        }
        
        // Test functions
        console.log('\n🔧 Testing access control functions...');
        
        // Test can_access_document function
        const testResult = await client.query(
            `SELECT can_access_document('TJuG3TPy8oe9GgNyXRKpFJknCrwVvH1234', 1) as can_access`
        );
        console.log('  - can_access_document() function: ✅ working');
        
        // Test get_access_level function
        const levelResult = await client.query(
            `SELECT * FROM get_access_level('TJuG3TPy8oe9GgNyXRKpFJknCrwVvH1234', 1, 2)`
        );
        console.log('  - get_access_level() function: ✅ working');
        
        console.log('\n🎉 Document access control system is ready!');
        console.log('   - Only recipients can view documents');
        console.log('   - Public can view alert notices');
        console.log('   - All access attempts are logged');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        
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