/**
 * Run Complete Token & Audit Migration
 * Sets up comprehensive tracking system
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
    let client;
    
    try {
        console.log('🚀 Starting comprehensive migration...');
        
        client = await pool.connect();
        
        // Begin transaction
        await client.query('BEGIN');
        
        // Run migrations in order
        const migrations = [
            'add-token-ids.sql',
            'comprehensive-token-tracking.sql',
            'comprehensive-audit-tracking.sql'
        ];
        
        for (const migration of migrations) {
            console.log(`\n📝 Running migration: ${migration}...`);
            const migrationPath = path.join(__dirname, 'migrations', migration);
            
            if (fs.existsSync(migrationPath)) {
                const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
                await client.query(migrationSQL);
                console.log(`✅ ${migration} completed`);
            } else {
                console.log(`⚠️ ${migration} not found, skipping...`);
            }
        }
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log('\n✅ All migrations completed successfully!');
        
        // Show table structure
        console.log('\n📊 Database structure:');
        
        const tables = [
            'token_tracking',
            'token_audit_events',
            'wallet_connections',
            'signature_attempts'
        ];
        
        for (const table of tables) {
            const countResult = await client.query(
                `SELECT COUNT(*) as count FROM ${table}`,
                []
            );
            console.log(`  - ${table}: ${countResult.rows[0].count} records`);
        }
        
        // Show available views
        const viewsResult = await client.query(`
            SELECT viewname 
            FROM pg_views 
            WHERE schemaname = 'public' 
            AND viewname IN ('comprehensive_notice_view', 'recipient_journey', 'token_registry')
        `);
        
        console.log('\n📋 Available views:');
        viewsResult.rows.forEach(row => {
            console.log(`  - ${row.viewname}`);
        });
        
        // Show available functions
        const functionsResult = await client.query(`
            SELECT routine_name 
            FROM information_schema.routines 
            WHERE routine_schema = 'public'
            AND routine_type = 'FUNCTION'
            AND routine_name IN (
                'find_notice_by_any_id',
                'get_notice_history',
                'record_audit_event',
                'get_complete_audit_trail'
            )
        `);
        
        console.log('\n🔧 Available functions:');
        functionsResult.rows.forEach(row => {
            console.log(`  - ${row.routine_name}()`);
        });
        
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

// Run the migrations
runMigrations().catch(console.error);