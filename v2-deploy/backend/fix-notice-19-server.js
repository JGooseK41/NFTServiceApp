/**
 * FIX NOTICE #19 SERVER ADDRESS
 * Updates the server address for Notice #19 so you can access it
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

// Your server wallet address - the correct one you've been using
const YOUR_SERVER_ADDRESS = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';

async function fixNotice19() {
    const client = await pool.connect();
    
    try {
        console.log('🔧 FIXING NOTICE #19 SERVER ADDRESS\n');
        console.log('=' .repeat(70));
        
        // First, check if Notice #19 exists in notice_components
        console.log('\n1️⃣ Checking if Notice #19 exists in notice_components...');
        let checkQuery = `
            SELECT alert_id, document_id, server_address, recipient_address, case_number
            FROM notice_components
            WHERE alert_id = 19 OR document_id = 19 OR notice_id = 19
        `;
        
        let result = await client.query(checkQuery);
        
        if (result.rows.length > 0) {
            const notice = result.rows[0];
            console.log('✅ Found Notice #19 in notice_components');
            console.log(`  Current server: ${notice.server_address || 'NULL'}`);
            console.log(`  Recipient: ${notice.recipient_address}`);
            console.log(`  Case: ${notice.case_number}`);
            
            // Update the server address
            console.log(`\n2️⃣ Updating server address to ${YOUR_SERVER_ADDRESS}...`);
            
            const updateQuery = `
                UPDATE notice_components 
                SET server_address = $1
                WHERE alert_id = 19 OR document_id = 19 OR notice_id = 19
            `;
            
            await client.query(updateQuery, [YOUR_SERVER_ADDRESS]);
            console.log('✅ Updated notice_components table');
            
        } else {
            console.log('❌ Notice #19 not found in notice_components');
            
            // Try to insert it based on IPFS metadata
            console.log('\n2️⃣ Creating Notice #19 entry from IPFS metadata...');
            
            const insertQuery = `
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
            `;
            
            await client.query(insertQuery, [YOUR_SERVER_ADDRESS]);
            console.log('✅ Created/updated Notice #19 entry');
        }
        
        // Also update served_notices if it exists there
        console.log('\n3️⃣ Checking served_notices table...');
        checkQuery = `
            SELECT alert_id, server_address
            FROM served_notices
            WHERE alert_id = 19 OR document_id = 19 OR notice_id = 19
        `;
        
        result = await client.query(checkQuery);
        
        if (result.rows.length > 0) {
            console.log('Found in served_notices, updating...');
            
            const updateQuery = `
                UPDATE served_notices 
                SET server_address = $1
                WHERE alert_id = 19 OR document_id = 19 OR notice_id = 19
            `;
            
            await client.query(updateQuery, [YOUR_SERVER_ADDRESS]);
            console.log('✅ Updated served_notices table');
        }
        
        // Verify the fix
        console.log('\n4️⃣ Verifying the fix...');
        checkQuery = `
            SELECT alert_id, server_address, recipient_address
            FROM notice_components
            WHERE alert_id = 19
        `;
        
        result = await client.query(checkQuery);
        
        if (result.rows.length > 0) {
            const notice = result.rows[0];
            console.log('✅ VERIFICATION:');
            console.log(`  Alert ID: ${notice.alert_id}`);
            console.log(`  Server Address: ${notice.server_address}`);
            console.log(`  Is your address: ${notice.server_address === YOUR_SERVER_ADDRESS}`);
            
            if (notice.server_address === YOUR_SERVER_ADDRESS) {
                console.log('\n🎉 SUCCESS! You should now have access to Notice #19');
                console.log('\nTest it:');
                console.log('1. Refresh your browser');
                console.log('2. Run: DebugAccess.checkNotice19()');
                console.log('3. You should now see "Access GRANTED" as the process server');
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.release();
        pool.end();
    }
}

// Run the fix
fixNotice19();