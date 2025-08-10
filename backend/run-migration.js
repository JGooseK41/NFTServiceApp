/**
 * Run database migration to convert ID columns to TEXT
 * This fixes the integer overflow issue permanently
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });

    let client;
    
    try {
        console.log('🔧 Connecting to database...');
        client = await pool.connect();
        
        // First, check current column types
        console.log('\n📊 Checking current column types...');
        const checkQuery = `
            SELECT 
                table_name,
                column_name, 
                data_type,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_name IN ('served_notices', 'notice_components', 'notice_batch_items')
            AND column_name IN ('notice_id', 'alert_id', 'document_id')
            ORDER BY table_name, column_name;
        `;
        
        const currentTypes = await client.query(checkQuery);
        console.log('Current column types:');
        currentTypes.rows.forEach(row => {
            console.log(`  ${row.table_name}.${row.column_name}: ${row.data_type}`);
        });
        
        // Check if migration is needed
        const needsMigration = currentTypes.rows.some(row => 
            row.data_type === 'integer' || row.data_type === 'bigint'
        );
        
        if (!needsMigration) {
            console.log('\n✅ Columns are already TEXT type. No migration needed.');
            return;
        }
        
        console.log('\n🚀 Starting migration...');
        await client.query('BEGIN');
        
        // Run migration for each table separately to handle errors better
        const tables = [
            { name: 'served_notices', columns: ['notice_id', 'alert_id', 'document_id'] },
            { name: 'notice_components', columns: ['notice_id', 'alert_id', 'document_id'] },
            { name: 'notice_batch_items', columns: ['notice_id'] }
        ];
        
        for (const table of tables) {
            console.log(`\n📝 Migrating table: ${table.name}`);
            
            for (const column of table.columns) {
                try {
                    // Check if column exists
                    const columnExists = await client.query(`
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = $1 AND column_name = $2
                    `, [table.name, column]);
                    
                    if (columnExists.rows.length === 0) {
                        console.log(`  ⚠️  Column ${column} does not exist in ${table.name}, skipping...`);
                        continue;
                    }
                    
                    // Check current type
                    const typeCheck = await client.query(`
                        SELECT data_type FROM information_schema.columns 
                        WHERE table_name = $1 AND column_name = $2
                    `, [table.name, column]);
                    
                    if (typeCheck.rows[0].data_type === 'text' || 
                        typeCheck.rows[0].data_type === 'character varying') {
                        console.log(`  ✓ ${column} is already TEXT type`);
                        continue;
                    }
                    
                    // Convert column
                    const alterQuery = `
                        ALTER TABLE ${table.name} 
                        ALTER COLUMN ${column} TYPE TEXT USING ${column}::TEXT
                    `;
                    
                    console.log(`  Converting ${column} to TEXT...`);
                    await client.query(alterQuery);
                    console.log(`  ✓ ${column} converted successfully`);
                    
                } catch (error) {
                    console.error(`  ❌ Error converting ${column}:`, error.message);
                    throw error;
                }
            }
        }
        
        // Create indexes
        console.log('\n📑 Creating indexes...');
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_served_notices_notice_id_text ON served_notices(notice_id)',
            'CREATE INDEX IF NOT EXISTS idx_served_notices_alert_id_text ON served_notices(alert_id)',
            'CREATE INDEX IF NOT EXISTS idx_served_notices_document_id_text ON served_notices(document_id)',
            'CREATE INDEX IF NOT EXISTS idx_notice_components_notice_id_text ON notice_components(notice_id)',
            'CREATE INDEX IF NOT EXISTS idx_notice_batch_items_notice_id_text ON notice_batch_items(notice_id)'
        ];
        
        for (const indexQuery of indexes) {
            try {
                await client.query(indexQuery);
                const indexName = indexQuery.match(/idx_\w+/)[0];
                console.log(`  ✓ Index ${indexName} created`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`  ⚠️  Index already exists, skipping...`);
                } else {
                    console.error(`  ❌ Error creating index:`, error.message);
                }
            }
        }
        
        await client.query('COMMIT');
        console.log('\n✅ Migration completed successfully!');
        
        // Verify the changes
        console.log('\n📊 Verifying new column types...');
        const newTypes = await client.query(checkQuery);
        console.log('New column types:');
        newTypes.rows.forEach(row => {
            console.log(`  ${row.table_name}.${row.column_name}: ${row.data_type}`);
        });
        
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
            console.log('\n⚠️  Transaction rolled back due to error');
        }
        console.error('\n❌ Migration failed:', error.message);
        console.error('Details:', error);
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Run the migration
console.log('=================================');
console.log('ID Column Type Migration Script');
console.log('=================================');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Database:', process.env.DATABASE_URL ? 'Production' : 'Local');

runMigration().then(() => {
    console.log('\n✨ All done!');
    process.exit(0);
}).catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
});