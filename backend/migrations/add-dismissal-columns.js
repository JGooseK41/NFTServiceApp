/**
 * Migration to add dismissal columns to notice_components table
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Adding dismissal columns to notice_components table...\n');
        
        // Check if columns already exist
        const checkQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'notice_components' 
            AND column_name IN ('dismissed', 'dismissed_at')
        `;
        
        const existing = await client.query(checkQuery);
        const existingColumns = existing.rows.map(r => r.column_name);
        
        // Add dismissed column if it doesn't exist
        if (!existingColumns.includes('dismissed')) {
            await client.query(`
                ALTER TABLE notice_components 
                ADD COLUMN dismissed BOOLEAN DEFAULT false
            `);
            console.log('✅ Added dismissed column');
        } else {
            console.log('⚠️  dismissed column already exists');
        }
        
        // Add dismissed_at column if it doesn't exist
        if (!existingColumns.includes('dismissed_at')) {
            await client.query(`
                ALTER TABLE notice_components 
                ADD COLUMN dismissed_at TIMESTAMP
            `);
            console.log('✅ Added dismissed_at column');
        } else {
            console.log('⚠️  dismissed_at column already exists');
        }
        
        // Create index for faster queries
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_notice_components_dismissed 
            ON notice_components(server_address, dismissed)
        `);
        console.log('✅ Created index for dismissal queries');
        
        // Count existing notices
        const countResult = await client.query('SELECT COUNT(*) FROM notice_components');
        console.log(`\n📊 Total notices in database: ${countResult.rows[0].count}`);
        
        console.log('\n✅ Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    runMigration().catch(console.error);
}

module.exports = runMigration;