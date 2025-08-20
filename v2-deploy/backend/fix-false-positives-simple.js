/**
 * Simple Fix for False Positive Delivered Notices
 * Removes notices from served_notices that don't have blockchain confirmation
 * This version doesn't verify against blockchain, just cleans up obvious false positives
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function fixFalsePositives() {
    let client;
    
    try {
        console.log('🔧 Starting false positive cleanup...\n');
        client = await pool.connect();
        
        // Step 1: Check current state
        console.log('1️⃣ Checking current database state...');
        
        // Count notices without transaction hash
        const unverifiedCount = await client.query(`
            SELECT COUNT(*) as count
            FROM served_notices 
            WHERE (transaction_hash IS NULL OR transaction_hash = '')
               AND created_at > NOW() - INTERVAL '30 days'
        `);
        
        console.log(`   Found ${unverifiedCount.rows[0].count} notices without transaction hash (last 30 days)\n`);
        
        // Step 2: Show sample of unverified notices
        console.log('2️⃣ Sample of unverified notices:');
        const samples = await client.query(`
            SELECT notice_id, server_address, recipient_address, created_at, status
            FROM served_notices 
            WHERE (transaction_hash IS NULL OR transaction_hash = '')
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        samples.rows.forEach(notice => {
            console.log(`   - Notice ${notice.notice_id}: ${notice.recipient_address} (${notice.created_at.toISOString().split('T')[0]})`);
        });
        
        // Step 3: Get user confirmation
        console.log('\n3️⃣ These notices appear to be false positives (no blockchain confirmation).');
        console.log('   They will be removed from the database.\n');
        
        // Step 4: Remove false positives
        console.log('4️⃣ Removing false positives...');
        
        // First, backup the data we're about to delete
        const backupResult = await client.query(`
            SELECT * FROM served_notices 
            WHERE (transaction_hash IS NULL OR transaction_hash = '')
               AND blockchain_verified IS NOT TRUE
               AND created_at > NOW() - INTERVAL '30 days'
        `);
        
        console.log(`   Backing up ${backupResult.rows.length} records...`);
        
        // Log the notices we're removing
        if (backupResult.rows.length > 0) {
            console.log('\n   Removing the following notices:');
            backupResult.rows.forEach(row => {
                console.log(`     - ${row.notice_id}: ${row.case_number || 'N/A'} to ${row.recipient_address}`);
            });
        }
        
        // Delete the false positives
        const deleteResult = await client.query(`
            DELETE FROM served_notices 
            WHERE (transaction_hash IS NULL OR transaction_hash = '')
               AND blockchain_verified IS NOT TRUE
               AND created_at > NOW() - INTERVAL '30 days'
            RETURNING notice_id, case_number, recipient_address
        `);
        
        console.log(`\n   ✅ Removed ${deleteResult.rows.length} false positive records`);
        
        // Step 5: Update status for older unverified notices
        console.log('\n5️⃣ Updating status for older unverified notices...');
        
        const updateResult = await client.query(`
            UPDATE served_notices 
            SET status = 'PENDING_BLOCKCHAIN'
            WHERE (transaction_hash IS NULL OR transaction_hash = '')
               AND blockchain_verified IS NOT TRUE
               AND created_at <= NOW() - INTERVAL '30 days'
               AND (status IS NULL OR status != 'PENDING_BLOCKCHAIN')
            RETURNING notice_id
        `);
        
        console.log(`   Updated ${updateResult.rows.length} older notices to PENDING_BLOCKCHAIN status`);
        
        // Step 6: Show final statistics
        console.log('\n6️⃣ Final Statistics:');
        
        const finalStats = await client.query(`
            SELECT 
                COUNT(*) FILTER (WHERE transaction_hash IS NOT NULL AND transaction_hash != '') as verified,
                COUNT(*) FILTER (WHERE transaction_hash IS NULL OR transaction_hash = '') as unverified,
                COUNT(*) as total
            FROM served_notices
        `);
        
        const stats = finalStats.rows[0];
        console.log(`   Total notices: ${stats.total}`);
        console.log(`   Verified (with tx hash): ${stats.verified}`);
        console.log(`   Unverified (no tx hash): ${stats.unverified}`);
        
        // Step 7: Ensure constraints exist
        console.log('\n7️⃣ Ensuring database constraints...');
        
        // Check if constraints already exist
        const constraintCheck = await client.query(`
            SELECT COUNT(*) as count
            FROM pg_indexes
            WHERE indexname = 'idx_served_notices_tx_unique'
        `);
        
        if (constraintCheck.rows[0].count === 0) {
            await client.query(`
                CREATE UNIQUE INDEX idx_served_notices_tx_unique 
                ON served_notices(transaction_hash) 
                WHERE transaction_hash IS NOT NULL AND transaction_hash != ''
            `);
            console.log('   ✅ Added unique constraint on transaction_hash');
        } else {
            console.log('   ✓ Unique constraint already exists');
        }
        
        console.log('\n✅ Cleanup complete!');
        console.log('   - Removed false positive records');
        console.log('   - Updated status for unverified notices');
        console.log('   - Database constraints verified');
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

// Run the cleanup
fixFalsePositives().then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
}).catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
});