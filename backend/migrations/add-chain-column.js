/**
 * Migration: Add chain column to case_service_records
 * This enables multi-chain support (TRON, Ethereum, Base, etc.)
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('Adding chain column to case_service_records...');

        // Add chain column if it doesn't exist
        await client.query(`
            ALTER TABLE case_service_records
            ADD COLUMN IF NOT EXISTS chain VARCHAR(50) DEFAULT 'tron-mainnet'
        `);

        console.log('✅ Added chain column');

        // Add explorer_url column for storing the full explorer URL
        await client.query(`
            ALTER TABLE case_service_records
            ADD COLUMN IF NOT EXISTS explorer_url TEXT
        `);

        console.log('✅ Added explorer_url column');

        // Also add to cases table for consistency
        await client.query(`
            ALTER TABLE cases
            ADD COLUMN IF NOT EXISTS chain VARCHAR(50) DEFAULT 'tron-mainnet'
        `);

        console.log('✅ Added chain column to cases table');

        // Verify the columns were added
        const result = await client.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'case_service_records'
            AND column_name IN ('chain', 'explorer_url')
            ORDER BY ordinal_position
        `);

        console.log('\nNew columns:');
        result.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (default: ${col.column_default})`);
        });

        console.log('\n✅ Migration completed successfully');

    } catch (error) {
        console.error('Migration error:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    migrate().catch(console.error);
}

module.exports = { migrate };
