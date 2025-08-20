/**
 * Check all batch-related tables to find the actual issue
 */

const { Pool } = require('pg');

async function checkBatchTables() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });

    let client;
    
    try {
        client = await pool.connect();
        
        console.log('🔍 Checking batch_uploads table:\n');
        
        const batchUploadsSchema = await client.query(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'batch_uploads'
            ORDER BY ordinal_position;
        `);
        
        console.log('batch_uploads columns:');
        batchUploadsSchema.rows.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
        });
        
        console.log('\n🔍 Checking notice_batch_items table:\n');
        
        const batchItemsSchema = await client.query(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'notice_batch_items'
            ORDER BY ordinal_position;
        `);
        
        console.log('notice_batch_items columns:');
        batchItemsSchema.rows.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
        });
        
        console.log('\n🔍 Checking notice_components table:\n');
        
        const componentsSchema = await client.query(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'notice_components'
            AND column_name IN ('notice_id', 'alert_id', 'document_id', 'id')
            ORDER BY ordinal_position;
        `);
        
        console.log('notice_components ID-related columns:');
        componentsSchema.rows.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
        });
        
        // Check for any triggers
        console.log('\n🔍 Checking for triggers on served_notices:\n');
        
        const triggersQuery = await client.query(`
            SELECT 
                trigger_name,
                event_manipulation,
                event_object_table,
                action_timing
            FROM information_schema.triggers
            WHERE event_object_table = 'served_notices';
        `);
        
        if (triggersQuery.rows.length > 0) {
            console.log('Triggers found:');
            triggersQuery.rows.forEach(trigger => {
                console.log(`  ${trigger.trigger_name}: ${trigger.action_timing} ${trigger.event_manipulation}`);
            });
        } else {
            console.log('No triggers found on served_notices');
        }
        
        // Test the exact failing scenario
        console.log('\n🧪 Testing the exact failing scenario:\n');
        
        await client.query('BEGIN');
        
        try {
            // First, create the batch record (this works)
            const batchId = 'TEST_BATCH_' + Date.now();
            console.log(`Creating batch record: ${batchId}`);
            
            await client.query(`
                INSERT INTO batch_uploads 
                (batch_id, server_address, recipient_count, status, metadata)
                VALUES ($1::TEXT, $2::TEXT, $3::INTEGER, $4::TEXT, $5::JSONB)
                ON CONFLICT (batch_id) DO UPDATE
                SET status = EXCLUDED.status
            `, [
                batchId,
                'test_server',
                1,
                'processing',
                JSON.stringify({ test: true })
            ]);
            
            console.log('✅ Batch record created\n');
            
            // Now try the served_notices insert (this should fail?)
            const noticeId = '643619800';  // Similar to what generateSafeId produces
            console.log(`Inserting served_notice with ID: ${noticeId}`);
            
            await client.query(`
                INSERT INTO served_notices 
                (notice_id, server_address, recipient_address, notice_type,
                 case_number, alert_id, document_id, issuing_agency,
                 has_document, ipfs_hash, batch_id)
                VALUES ($1::TEXT, $2::TEXT, $3::TEXT, $4::TEXT, 
                        $5::TEXT, $6::TEXT, $7::TEXT, $8::TEXT,
                        $9::BOOLEAN, $10::TEXT, $11::TEXT)
                ON CONFLICT (notice_id) DO UPDATE
                SET 
                    has_document = EXCLUDED.has_document,
                    ipfs_hash = EXCLUDED.ipfs_hash,
                    batch_id = EXCLUDED.batch_id,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                noticeId,
                'tgdd34rr3rzfuozoqlze9d4tzfbigl4jay',
                'td1f37v4cafh1yqcyvltcfyfxkzus7mbde',
                'Legal Notice',
                'TEST-001',
                noticeId,
                String(Number(noticeId) + 1),
                'Test Agency',
                false,
                '',
                batchId
            ]);
            
            console.log('✅ Served notice inserted\n');
            
            // Try the batch items insert
            console.log('Inserting batch item...');
            
            await client.query(`
                INSERT INTO notice_batch_items
                (batch_id, notice_id, recipient_address, status, created_at)
                VALUES ($1::TEXT, $2::TEXT, $3::TEXT, $4::TEXT, NOW())
                ON CONFLICT DO NOTHING
            `, [
                batchId,
                noticeId,
                'td1f37v4cafh1yqcyvltcfyfxkzus7mbde',
                'success'
            ]);
            
            console.log('✅ Batch item inserted\n');
            
            console.log('🎉 All inserts succeeded! The issue might be elsewhere.\n');
            
        } catch (error) {
            console.log('❌ Failed at some point:');
            console.log('  Error:', error.message);
            console.log('  Code:', error.code);
            console.log('  Detail:', error.detail);
            console.log('  Table:', error.table);
            console.log('  Column:', error.column);
        } finally {
            await client.query('ROLLBACK');
            console.log('\n🔄 Transaction rolled back');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Run the check
console.log('=====================================');
console.log('Batch Tables Check Script');
console.log('=====================================');
console.log('Database:', process.env.DATABASE_URL ? 'Production' : 'Local');
console.log('=====================================\n');

checkBatchTables().then(() => {
    console.log('\n✨ Check completed!');
    process.exit(0);
}).catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
});