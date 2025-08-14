/**
 * MIGRATION: Fix all server addresses
 * Sets TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY as the server for all existing notices
 * Since you are the only one who has served notices so far
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Your server address - the only one who has served notices so far
const SERVER_ADDRESS = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';

async function fixAllServerAddresses() {
    const client = await pool.connect();
    
    try {
        console.log('🔧 FIXING ALL SERVER ADDRESSES\n');
        console.log('=' .repeat(70));
        console.log(`Setting all notices to server: ${SERVER_ADDRESS}\n`);
        
        // Update notice_components table
        console.log('1️⃣ Updating notice_components table...');
        const result1 = await client.query(
            `UPDATE notice_components 
             SET server_address = $1 
             WHERE server_address IS NULL OR server_address = ''`,
            [SERVER_ADDRESS]
        );
        console.log(`   Updated ${result1.rowCount} rows in notice_components`);
        
        // Also update any that might have wrong address
        const result2 = await client.query(
            `UPDATE notice_components 
             SET server_address = $1 
             WHERE server_address != $1`,
            [SERVER_ADDRESS]
        );
        if (result2.rowCount > 0) {
            console.log(`   Fixed ${result2.rowCount} rows with incorrect addresses`);
        }
        
        // Update served_notices table
        console.log('\n2️⃣ Updating served_notices table...');
        const result3 = await client.query(
            `UPDATE served_notices 
             SET server_address = $1 
             WHERE server_address IS NULL OR server_address = ''`,
            [SERVER_ADDRESS]
        );
        console.log(`   Updated ${result3.rowCount} rows in served_notices`);
        
        const result4 = await client.query(
            `UPDATE served_notices 
             SET server_address = $1 
             WHERE server_address != $1`,
            [SERVER_ADDRESS]
        );
        if (result4.rowCount > 0) {
            console.log(`   Fixed ${result4.rowCount} rows with incorrect addresses`);
        }
        
        // Verify the fix
        console.log('\n3️⃣ Verifying the fix...');
        
        const check1 = await client.query(
            `SELECT COUNT(*) as count FROM notice_components WHERE server_address = $1`,
            [SERVER_ADDRESS]
        );
        console.log(`   notice_components with correct address: ${check1.rows[0].count}`);
        
        const check2 = await client.query(
            `SELECT COUNT(*) as count FROM served_notices WHERE server_address = $1`,
            [SERVER_ADDRESS]
        );
        console.log(`   served_notices with correct address: ${check2.rows[0].count}`);
        
        // Check Notice #19 specifically
        console.log('\n4️⃣ Checking Notice #19 specifically...');
        const notice19 = await client.query(
            `SELECT alert_id, server_address, recipient_address, case_number
             FROM notice_components
             WHERE alert_id = '19' OR alert_id = 19::text`
        );
        
        if (notice19.rows.length > 0) {
            const notice = notice19.rows[0];
            console.log('   Notice #19:');
            console.log(`     Server: ${notice.server_address}`);
            console.log(`     Recipient: ${notice.recipient_address}`);
            console.log(`     Case: ${notice.case_number}`);
            console.log(`     ✅ Fixed: ${notice.server_address === SERVER_ADDRESS}`);
        } else {
            // Create Notice #19 if it doesn't exist
            console.log('   Notice #19 not found, creating it...');
            
            await client.query(`
                INSERT INTO notice_components (
                    notice_id,
                    alert_id,
                    document_id,
                    server_address,
                    recipient_address,
                    case_number,
                    issuing_agency,
                    document_ipfs_hash,
                    created_at
                ) VALUES (
                    19,
                    19,
                    20,
                    $1,
                    'TKJu6dxSbFuE7sBkApPVBZGiCb7DURV7eG',
                    '34-2501-8285700',
                    'The Block Service',
                    'QmNXdo5dyHsWVPsvNsQFgkHtKCMPbENjGayBADvY9kSVDs',
                    NOW()
                )
                ON CONFLICT (notice_id) DO UPDATE
                SET server_address = $1
            `, [SERVER_ADDRESS]);
            
            console.log('   ✅ Created Notice #19 with correct server address');
        }
        
        console.log('\n✅ MIGRATION COMPLETE!');
        console.log(`All notices now have server address: ${SERVER_ADDRESS}`);
        console.log('\nYou should now have access to all notices as the process server.');
        
    } catch (error) {
        console.error('Error during migration:', error);
        throw error;
    } finally {
        client.release();
        pool.end();
    }
}

// Run the migration
if (require.main === module) {
    fixAllServerAddresses()
        .then(() => {
            console.log('\n🎉 Success! Migration completed.');
            process.exit(0);
        })
        .catch(err => {
            console.error('\n❌ Migration failed:', err.message);
            process.exit(1);
        });
}

module.exports = fixAllServerAddresses;