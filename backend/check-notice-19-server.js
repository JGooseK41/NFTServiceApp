/**
 * CHECK AND FIX NOTICE #19 SERVER ADDRESS
 * Verifies the server address recorded in backend for Notice #19
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function checkNotice19() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 CHECKING NOTICE #19 IN DATABASE\n');
        console.log('=' .repeat(70));
        
        // Check notice_components table
        console.log('\n1️⃣ Checking notice_components table...');
        let query = `
            SELECT 
                notice_id,
                alert_id,
                document_id,
                server_address,
                recipient_address,
                case_number,
                issuing_agency,
                created_at,
                alert_thumbnail_url,
                document_unencrypted_url
            FROM notice_components
            WHERE alert_id = 19 OR document_id = 19 OR notice_id = 19
        `;
        
        let result = await client.query(query);
        
        if (result.rows.length > 0) {
            console.log('✅ Found in notice_components:');
            const notice = result.rows[0];
            console.log(`  Notice ID: ${notice.notice_id}`);
            console.log(`  Alert ID: ${notice.alert_id}`);
            console.log(`  Document ID: ${notice.document_id}`);
            console.log(`  Server Address: ${notice.server_address || 'NULL/MISSING'}`);
            console.log(`  Recipient Address: ${notice.recipient_address || 'NULL/MISSING'}`);
            console.log(`  Case Number: ${notice.case_number}`);
            console.log(`  Created: ${notice.created_at}`);
            console.log(`  Has Alert Image: ${!!notice.alert_thumbnail_url}`);
            console.log(`  Has Document Image: ${!!notice.document_unencrypted_url}`);
            
            if (!notice.server_address) {
                console.log('\n⚠️ WARNING: Server address is missing!');
            }
        } else {
            console.log('❌ Not found in notice_components');
        }
        
        // Check served_notices table
        console.log('\n2️⃣ Checking served_notices table...');
        query = `
            SELECT 
                notice_id,
                alert_id,
                document_id,
                server_address,
                recipient_address,
                case_number,
                created_at,
                ipfs_hash
            FROM served_notices
            WHERE alert_id = 19 OR document_id = 19 OR notice_id = 19
        `;
        
        result = await client.query(query);
        
        if (result.rows.length > 0) {
            console.log('✅ Found in served_notices:');
            const notice = result.rows[0];
            console.log(`  Notice ID: ${notice.notice_id}`);
            console.log(`  Alert ID: ${notice.alert_id}`);
            console.log(`  Document ID: ${notice.document_id}`);
            console.log(`  Server Address: ${notice.server_address || 'NULL/MISSING'}`);
            console.log(`  Recipient Address: ${notice.recipient_address || 'NULL/MISSING'}`);
            console.log(`  Case Number: ${notice.case_number}`);
            console.log(`  Created: ${notice.created_at}`);
            console.log(`  IPFS Hash: ${notice.ipfs_hash}`);
            
            if (!notice.server_address) {
                console.log('\n⚠️ WARNING: Server address is missing!');
            }
        } else {
            console.log('❌ Not found in served_notices');
        }
        
        // Check all notices with similar case number
        console.log('\n3️⃣ Checking for notices with case number 34-2501-8285700...');
        query = `
            SELECT 
                alert_id,
                document_id,
                server_address,
                recipient_address,
                created_at
            FROM notice_components
            WHERE case_number = '34-2501-8285700'
            ORDER BY created_at DESC
        `;
        
        result = await client.query(query);
        
        if (result.rows.length > 0) {
            console.log(`Found ${result.rows.length} notices with this case number:`);
            result.rows.forEach(notice => {
                console.log(`  Alert #${notice.alert_id}: Server=${notice.server_address?.substring(0, 10)}... Recipient=${notice.recipient_address?.substring(0, 10)}...`);
            });
        }
        
        // Get the most likely server address (from recent notices)
        console.log('\n4️⃣ Finding your server address from recent notices...');
        query = `
            SELECT DISTINCT server_address, COUNT(*) as count
            FROM notice_components
            WHERE server_address IS NOT NULL
            GROUP BY server_address
            ORDER BY count DESC
            LIMIT 5
        `;
        
        result = await client.query(query);
        
        if (result.rows.length > 0) {
            console.log('Most frequent server addresses:');
            result.rows.forEach(row => {
                console.log(`  ${row.server_address}: ${row.count} notices`);
            });
            
            const likelyServer = result.rows[0].server_address;
            console.log(`\n📍 Most likely your server address: ${likelyServer}`);
            
            // Ask if we should update Notice #19
            console.log('\n💡 TO FIX NOTICE #19 ACCESS:');
            console.log(`Run: node fix-notice-19-server.js ${likelyServer}`);
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.release();
        pool.end();
    }
}

checkNotice19();