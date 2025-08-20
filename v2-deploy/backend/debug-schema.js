/**
 * Debug script to check the exact schema and find the issue
 */

const { Pool } = require('pg');

async function debugSchema() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });

    let client;
    
    try {
        client = await pool.connect();
        
        console.log('🔍 Checking ALL columns in served_notices table:\n');
        
        const schemaQuery = `
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'served_notices'
            ORDER BY ordinal_position;
        `;
        
        const result = await client.query(schemaQuery);
        
        console.log('served_notices table schema:');
        console.log('================================');
        result.rows.forEach(col => {
            console.log(`${col.column_name}:`);
            console.log(`  Type: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
            console.log(`  Nullable: ${col.is_nullable}`);
            console.log(`  Default: ${col.column_default || 'none'}`);
            console.log('');
        });
        
        // Check constraints
        console.log('\n🔍 Checking constraints:\n');
        const constraintQuery = `
            SELECT 
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'served_notices'
            ORDER BY tc.constraint_type, tc.constraint_name;
        `;
        
        const constraints = await client.query(constraintQuery);
        console.log('Constraints:');
        constraints.rows.forEach(con => {
            console.log(`  ${con.constraint_type}: ${con.constraint_name} (${con.column_name})`);
        });
        
        // Test insert with the exact same query as batch-documents.js
        console.log('\n🧪 Testing insert with same query structure:\n');
        
        await client.query('BEGIN');
        
        try {
            const testId = `TEST_${Date.now()}`;
            
            console.log('Attempting insert with:');
            console.log(`  notice_id: "${testId}" (type: string)`);
            console.log(`  server_address: "test_server"`);
            console.log(`  recipient_address: "test_recipient"`);
            
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
                testId,           // notice_id
                'test_server',    // server_address
                'test_recipient', // recipient_address
                'Test Notice',    // notice_type
                'TEST-001',       // case_number
                testId,           // alert_id
                testId,           // document_id
                'Test Agency',    // issuing_agency
                false,            // has_document
                '',               // ipfs_hash
                'TEST_BATCH'      // batch_id
            ]);
            
            console.log('\n✅ Test insert SUCCEEDED!');
            
            // Check what was inserted
            const checkResult = await client.query(
                'SELECT notice_id, alert_id, document_id FROM served_notices WHERE notice_id = $1',
                [testId]
            );
            
            if (checkResult.rows.length > 0) {
                console.log('\nInserted row:');
                console.log(checkResult.rows[0]);
            }
            
        } catch (error) {
            console.log('\n❌ Test insert FAILED!');
            console.log('Error:', error.message);
            console.log('Code:', error.code);
            console.log('Detail:', error.detail);
            console.log('Hint:', error.hint);
            console.log('Position:', error.position);
        } finally {
            await client.query('ROLLBACK');
        }
        
        // Check if there's an "id" column that might be the issue
        console.log('\n🔍 Checking for auto-increment columns:\n');
        const autoIncQuery = `
            SELECT 
                column_name,
                data_type,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'served_notices'
            AND column_default LIKE 'nextval%';
        `;
        
        const autoIncResult = await client.query(autoIncQuery);
        if (autoIncResult.rows.length > 0) {
            console.log('Auto-increment columns found:');
            autoIncResult.rows.forEach(col => {
                console.log(`  ${col.column_name}: ${col.data_type} (default: ${col.column_default})`);
            });
        } else {
            console.log('No auto-increment columns found');
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Run the debug
console.log('=====================================');
console.log('Schema Debug Script');
console.log('=====================================');
console.log('Database:', process.env.DATABASE_URL ? 'Production' : 'Local');
console.log('=====================================\n');

debugSchema().then(() => {
    console.log('\n✨ Debug completed!');
    process.exit(0);
}).catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
});