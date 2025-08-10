/**
 * Fix notice_components table columns from INTEGER to TEXT
 */

const { Pool } = require('pg');

async function fixColumns() {
    const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL, 
        ssl: { rejectUnauthorized: false } 
    });
    
    const client = await pool.connect();
    
    try {
        console.log('🔧 Fixing notice_components table columns...\n');
        
        // Fix notice_id
        console.log('Converting notice_id to TEXT...');
        await client.query('ALTER TABLE notice_components ALTER COLUMN notice_id TYPE TEXT USING notice_id::TEXT');
        console.log('✅ notice_id converted\n');
        
        // Fix alert_id
        console.log('Converting alert_id to TEXT...');
        await client.query('ALTER TABLE notice_components ALTER COLUMN alert_id TYPE TEXT USING alert_id::TEXT');
        console.log('✅ alert_id converted\n');
        
        // Fix document_id
        console.log('Converting document_id to TEXT...');
        await client.query('ALTER TABLE notice_components ALTER COLUMN document_id TYPE TEXT USING document_id::TEXT');
        console.log('✅ document_id converted\n');
        
        // Verify
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'notice_components' 
            AND column_name IN ('notice_id', 'alert_id', 'document_id')
        `);
        
        console.log('📊 Final column types:');
        res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
        
        console.log('\n✨ All columns fixed!');
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Details:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the fix
fixColumns().catch(console.error);