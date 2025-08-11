/**
 * Fix False Positive Delivered Notices
 * Removes notices from served_notices that don't have blockchain confirmation
 * and adds transaction_hash validation
 */

const { Pool } = require('pg');
const TronWeb = require('tronweb');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const tronWeb = new TronWeb({
    fullHost: process.env.TRON_NETWORK === 'mainnet' 
        ? 'https://api.trongrid.io'
        : 'https://nile.trongrid.io'
});

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

async function fixFalsePositives() {
    let client;
    
    try {
        console.log('🔧 Starting false positive fix...\n');
        client = await pool.connect();
        
        // Step 1: Add transaction_hash column if it doesn't exist
        console.log('1️⃣ Adding transaction_hash column to served_notices...');
        await client.query(`
            ALTER TABLE served_notices 
            ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(255),
            ADD COLUMN IF NOT EXISTS block_number BIGINT,
            ADD COLUMN IF NOT EXISTS blockchain_verified BOOLEAN DEFAULT FALSE
        `);
        
        // Step 2: Get all notices without transaction hash
        console.log('\n2️⃣ Finding notices without blockchain verification...');
        const unverifiedNotices = await client.query(`
            SELECT notice_id, server_address, recipient_address, created_at
            FROM served_notices 
            WHERE transaction_hash IS NULL 
               OR transaction_hash = ''
               OR blockchain_verified = FALSE
            ORDER BY created_at DESC
        `);
        
        console.log(`   Found ${unverifiedNotices.rows.length} unverified notices\n`);
        
        if (unverifiedNotices.rows.length === 0) {
            console.log('✅ No unverified notices found!');
            return;
        }
        
        // Step 3: Load contract to verify on blockchain
        console.log('3️⃣ Loading smart contract...');
        const contractABI = require('../contracts/LegalNoticeNFT_v5_Enumerable.abi');
        const contract = await tronWeb.contract(contractABI, CONTRACT_ADDRESS);
        
        // Step 4: Check each notice on blockchain
        console.log('\n4️⃣ Verifying notices on blockchain...');
        let verified = 0;
        let falsePositives = 0;
        
        for (const notice of unverifiedNotices.rows) {
            try {
                // Try to get notice from blockchain
                const blockchainNotice = await contract.notices(notice.notice_id).call();
                
                if (blockchainNotice && blockchainNotice.serverAddress) {
                    // Notice exists on blockchain - get transaction events
                    console.log(`   ✓ Notice ${notice.notice_id} verified on blockchain`);
                    
                    // Try to get events for this notice
                    const events = await tronWeb.getEventResult(CONTRACT_ADDRESS, {
                        eventName: 'NoticeServed',
                        size: 200
                    });
                    
                    // Find the event for this notice
                    const noticeEvent = events.find(e => 
                        e.result && e.result.noticeId === notice.notice_id
                    );
                    
                    if (noticeEvent) {
                        // Update with transaction hash
                        await client.query(`
                            UPDATE served_notices 
                            SET transaction_hash = $1,
                                block_number = $2,
                                blockchain_verified = TRUE
                            WHERE notice_id = $3
                        `, [noticeEvent.transaction, noticeEvent.block, notice.notice_id]);
                        verified++;
                    }
                } else {
                    // Notice doesn't exist on blockchain - it's a false positive
                    console.log(`   ✗ Notice ${notice.notice_id} NOT on blockchain - FALSE POSITIVE`);
                    falsePositives++;
                }
            } catch (err) {
                // If we can't find it on blockchain, it's likely a false positive
                console.log(`   ✗ Notice ${notice.notice_id} - Error checking: ${err.message}`);
                falsePositives++;
            }
        }
        
        console.log(`\n5️⃣ Results:`);
        console.log(`   ✓ ${verified} notices verified on blockchain`);
        console.log(`   ✗ ${falsePositives} false positives found`);
        
        // Step 5: Remove false positives
        if (falsePositives > 0) {
            console.log('\n6️⃣ Removing false positives...');
            
            const deleteResult = await client.query(`
                DELETE FROM served_notices 
                WHERE (transaction_hash IS NULL OR transaction_hash = '')
                  AND blockchain_verified = FALSE
                  AND created_at > NOW() - INTERVAL '7 days'
                RETURNING notice_id
            `);
            
            console.log(`   Removed ${deleteResult.rows.length} false positive records`);
            
            deleteResult.rows.forEach(row => {
                console.log(`     - Deleted notice ${row.notice_id}`);
            });
        }
        
        // Step 6: Add constraints to prevent future false positives
        console.log('\n7️⃣ Adding database constraints...');
        
        // Create index on transaction_hash
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_served_notices_tx_hash 
            ON served_notices(transaction_hash)
        `);
        
        // Create unique constraint on transaction_hash when not null
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_served_notices_tx_unique 
            ON served_notices(transaction_hash) 
            WHERE transaction_hash IS NOT NULL AND transaction_hash != ''
        `);
        
        console.log('\n✅ False positive fix complete!');
        console.log('   - Added transaction_hash column');
        console.log('   - Verified existing notices against blockchain');
        console.log('   - Removed false positives');
        console.log('   - Added constraints to prevent future issues');
        
    } catch (error) {
        console.error('❌ Error fixing false positives:', error);
        throw error;
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

// Run the fix
fixFalsePositives().then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
}).catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
});