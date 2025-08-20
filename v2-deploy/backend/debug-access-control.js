/**
 * Debug Access Control Issues
 * Check why process servers aren't being recognized
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function debugAccessControl() {
    try {
        console.log('\n🔍 Debugging Access Control Issues\n');
        
        // Test data
        const alertTokenId = '943220201';
        const documentTokenId = '943220202';
        const walletAddress = 'TJRex3vGsNeoNjKWEXsM87qCDdvqV7Koa6'; // Your wallet
        
        console.log('Test Parameters:');
        console.log('- Alert Token ID:', alertTokenId);
        console.log('- Document Token ID:', documentTokenId);
        console.log('- Wallet Address:', walletAddress);
        console.log('- Wallet (lowercase):', walletAddress.toLowerCase());
        console.log('');
        
        // Check token_tracking table
        console.log('1. Checking token_tracking table...');
        try {
            const tokenResult = await pool.query(`
                SELECT 
                    token_id,
                    token_type,
                    recipient_address,
                    server_address,
                    LOWER(recipient_address) as recipient_lower,
                    LOWER(server_address) as server_lower,
                    case_number
                FROM token_tracking
                WHERE token_id IN ($1, $2)
            `, [alertTokenId, documentTokenId]);
            
            if (tokenResult.rows.length > 0) {
                console.log('Found in token_tracking:');
                tokenResult.rows.forEach(row => {
                    console.log(`  Token ${row.token_id} (${row.token_type}):`);
                    console.log(`    Recipient: ${row.recipient_address} (${row.recipient_lower})`);
                    console.log(`    Server: ${row.server_address} (${row.server_lower})`);
                    console.log(`    Is Recipient: ${row.recipient_lower === walletAddress.toLowerCase()}`);
                    console.log(`    Is Server: ${row.server_lower === walletAddress.toLowerCase()}`);
                });
            } else {
                console.log('❌ Not found in token_tracking');
            }
        } catch (e) {
            console.log('❌ token_tracking table error:', e.message);
        }
        
        // Check notice_components table
        console.log('\n2. Checking notice_components table...');
        const componentsResult = await pool.query(`
            SELECT 
                alert_token_id,
                document_token_id,
                recipient_address,
                server_address,
                LOWER(recipient_address) as recipient_lower,
                LOWER(server_address) as server_lower,
                case_number
            FROM notice_components
            WHERE alert_token_id IN ($1, $2) OR document_token_id IN ($1, $2)
        `, [alertTokenId, documentTokenId]);
        
        if (componentsResult.rows.length > 0) {
            console.log('Found in notice_components:');
            componentsResult.rows.forEach(row => {
                console.log(`  Alert ${row.alert_token_id}, Doc ${row.document_token_id}:`);
                console.log(`    Recipient: ${row.recipient_address} (${row.recipient_lower})`);
                console.log(`    Server: ${row.server_address} (${row.server_lower})`);
                console.log(`    Is Recipient: ${row.recipient_lower === walletAddress.toLowerCase()}`);
                console.log(`    Is Server: ${row.server_lower === walletAddress.toLowerCase()}`);
            });
        } else {
            console.log('❌ Not found in notice_components');
        }
        
        // Check for any records with this wallet as server
        console.log('\n3. Looking for all records where you are the server...');
        const serverRecords = await pool.query(`
            SELECT 
                'notice_components' as source,
                alert_token_id,
                document_token_id,
                server_address,
                recipient_address,
                case_number
            FROM notice_components
            WHERE LOWER(server_address) = LOWER($1)
            UNION ALL
            SELECT 
                'token_tracking' as source,
                token_id as alert_token_id,
                NULL as document_token_id,
                server_address,
                recipient_address,
                case_number
            FROM token_tracking
            WHERE LOWER(server_address) = LOWER($1)
            LIMIT 10
        `, [walletAddress]);
        
        if (serverRecords.rows.length > 0) {
            console.log('Found records where you are the server:');
            console.table(serverRecords.rows);
        } else {
            console.log('❌ No records found where you are the server');
        }
        
        // Check what addresses are actually stored
        console.log('\n4. Sample of actual server addresses in database...');
        const addressSample = await pool.query(`
            SELECT DISTINCT 
                server_address,
                COUNT(*) as count
            FROM notice_components
            WHERE server_address IS NOT NULL
            GROUP BY server_address
            LIMIT 5
        `);
        
        console.log('Server addresses in database:');
        console.table(addressSample.rows);
        
        // Check access attempts
        console.log('\n5. Recent access attempts for this wallet...');
        const attempts = await pool.query(`
            SELECT 
                alert_token_id,
                document_token_id,
                is_recipient,
                granted,
                denial_reason,
                attempted_at
            FROM access_attempts
            WHERE LOWER(wallet_address) = LOWER($1)
            ORDER BY attempted_at DESC
            LIMIT 5
        `, [walletAddress]);
        
        if (attempts.rows.length > 0) {
            console.log('Recent access attempts:');
            console.table(attempts.rows);
        } else {
            console.log('No access attempts found');
        }
        
        console.log('\n📊 Summary:');
        console.log('The issue appears to be that server_address might be NULL or not matching your wallet address.');
        console.log('Your wallet:', walletAddress);
        console.log('Check if server addresses are being saved correctly when notices are created.');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

debugAccessControl();