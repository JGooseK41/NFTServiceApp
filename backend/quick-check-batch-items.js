/**
 * Quick check of notice_batch_items table structure
 */

const { Pool } = require('pg');

async function quickCheck() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });

    let client;
    
    try {
        client = await pool.connect();
        
        console.log('🔍 Checking notice_batch_items table structure:\n');
        
        const result = await client.query(`
            SELECT 
                column_name,
                data_type,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'notice_batch_items'
            ORDER BY ordinal_position;
        `);
        
        if (result.rows.length === 0) {
            console.log('❌ Table notice_batch_items not found!\n');
            
            // Check if it exists with different name
            const tablesResult = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name LIKE '%batch%'
                ORDER BY table_name;
            `);
            
            console.log('Tables with "batch" in name:');
            tablesResult.rows.forEach(row => {
                console.log(`  - ${row.table_name}`);
            });
        } else {
            console.log('notice_batch_items columns:');
            result.rows.forEach(col => {
                const type = col.data_type + (col.character_maximum_length ? `(${col.character_maximum_length})` : '');
                const icon = col.column_name === 'notice_id' && col.data_type === 'integer' ? '❌' : '✅';
                console.log(`  ${icon} ${col.column_name}: ${type}`);
            });
        }
        
        // Also check notice_components
        console.log('\n🔍 Checking notice_components table (notice_id column):\n');
        
        const componentsResult = await client.query(`
            SELECT 
                column_name,
                data_type,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'notice_components'
            AND column_name = 'notice_id'
            ORDER BY ordinal_position;
        `);
        
        if (componentsResult.rows.length > 0) {
            const col = componentsResult.rows[0];
            const type = col.data_type + (col.character_maximum_length ? `(${col.character_maximum_length})` : '');
            const icon = col.data_type === 'integer' ? '❌' : '✅';
            console.log(`notice_components.notice_id: ${icon} ${type}`);
        } else {
            console.log('notice_components table or notice_id column not found');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

console.log('=====================================');
console.log('Quick Batch Items Check');
console.log('=====================================\n');

quickCheck().then(() => {
    console.log('\n✨ Done!');
}).catch(console.error);