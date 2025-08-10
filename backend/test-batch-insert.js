/**
 * Minimal test to isolate the batch insert issue
 */

const { Pool } = require('pg');

async function testBatchInsert() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });

    let client;
    
    try {
        console.log('🔧 Testing batch insert issue...\n');
        client = await pool.connect();
        
        // Start transaction
        await client.query('BEGIN');
        console.log('✅ Transaction started\n');
        
        // Test 1: Insert with INTEGER-like string
        const testId1 = '999999';
        console.log(`Test 1: Inserting with numeric string ID: "${testId1}"`);
        
        try {
            await client.query(`
                INSERT INTO served_notices 
                (notice_id, server_address, recipient_address, notice_type,
                 case_number, alert_id, document_id, issuing_agency,
                 has_document, ipfs_hash, batch_id)
                VALUES ($1::TEXT, $2::TEXT, $3::TEXT, $4::TEXT, 
                        $5::TEXT, $6::TEXT, $7::TEXT, $8::TEXT,
                        $9::BOOLEAN, $10::TEXT, $11::TEXT)
                ON CONFLICT (notice_id) DO NOTHING
            `, [
                testId1, 'test', 'test', 'test',
                'test', testId1, testId1, 'test',
                false, '', 'test'
            ]);
            console.log('✅ Test 1 PASSED\n');
        } catch (error) {
            console.log('❌ Test 1 FAILED:', error.message, '\n');
        }
        
        // Test 2: Insert with large numeric string
        const testId2 = '1754866436198';  // Like the actual failing ID
        console.log(`Test 2: Inserting with large numeric string ID: "${testId2}"`);
        
        try {
            await client.query(`
                INSERT INTO served_notices 
                (notice_id, server_address, recipient_address, notice_type,
                 case_number, alert_id, document_id, issuing_agency,
                 has_document, ipfs_hash, batch_id)
                VALUES ($1::TEXT, $2::TEXT, $3::TEXT, $4::TEXT, 
                        $5::TEXT, $6::TEXT, $7::TEXT, $8::TEXT,
                        $9::BOOLEAN, $10::TEXT, $11::TEXT)
                ON CONFLICT (notice_id) DO NOTHING
            `, [
                testId2, 'test', 'test', 'test',
                'test', testId2, testId2, 'test',
                false, '', 'test'
            ]);
            console.log('✅ Test 2 PASSED\n');
        } catch (error) {
            console.log('❌ Test 2 FAILED:', error.message, '\n');
        }
        
        // Test 3: Insert without type casting
        const testId3 = 'TEST_NO_CAST';
        console.log(`Test 3: Inserting without ::TEXT casting: "${testId3}"`);
        
        try {
            await client.query(`
                INSERT INTO served_notices 
                (notice_id, server_address, recipient_address, notice_type,
                 case_number, alert_id, document_id, issuing_agency,
                 has_document, ipfs_hash, batch_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (notice_id) DO NOTHING
            `, [
                testId3, 'test', 'test', 'test',
                'test', testId3, testId3, 'test',
                false, '', 'test'
            ]);
            console.log('✅ Test 3 PASSED\n');
        } catch (error) {
            console.log('❌ Test 3 FAILED:', error.message, '\n');
        }
        
        // Test 4: Check what happens with generateSafeId result
        function generateSafeId(batchId, index) {
            try {
                const match = batchId.match(/\d+/);
                const batchNum = match ? match[0] : Date.now().toString();
                const truncated = batchNum.slice(-7);
                const safeId = parseInt(truncated) * 100 + (index % 100);
                
                if (safeId > 2147483647 || safeId < 0 || isNaN(safeId)) {
                    return String(Math.floor(Math.random() * 1000000000));
                }
                
                return String(safeId);
            } catch (error) {
                return String(Math.floor(Math.random() * 1000000000));
            }
        }
        
        const testId4 = generateSafeId('BATCH_1754866436198_155', 0);
        console.log(`Test 4: Using generateSafeId result: "${testId4}" (type: ${typeof testId4})`);
        
        try {
            await client.query(`
                INSERT INTO served_notices 
                (notice_id, server_address, recipient_address, notice_type,
                 case_number, alert_id, document_id, issuing_agency,
                 has_document, ipfs_hash, batch_id)
                VALUES ($1::TEXT, $2::TEXT, $3::TEXT, $4::TEXT, 
                        $5::TEXT, $6::TEXT, $7::TEXT, $8::TEXT,
                        $9::BOOLEAN, $10::TEXT, $11::TEXT)
                ON CONFLICT (notice_id) DO NOTHING
            `, [
                testId4, 'test', 'test', 'test',
                'test', testId4, String(Number(testId4) + 1), 'test',
                false, '', 'test'
            ]);
            console.log('✅ Test 4 PASSED\n');
        } catch (error) {
            console.log('❌ Test 4 FAILED:', error.message);
            console.log('   Error code:', error.code);
            console.log('   Error detail:', error.detail, '\n');
        }
        
        // Rollback
        await client.query('ROLLBACK');
        console.log('🔄 Transaction rolled back (test data not saved)\n');
        
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('❌ Test error:', error.message);
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Run the test
console.log('=====================================');
console.log('Batch Insert Test Script');
console.log('=====================================');
console.log('Database:', process.env.DATABASE_URL ? 'Production' : 'Local');
console.log('=====================================\n');

testBatchInsert().then(() => {
    console.log('✨ All tests completed!');
    process.exit(0);
}).catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
});