const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function diagnoseMissingNotices() {
    const wallet = 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH';
    const expectedAlertIds = ['1', '17', '29', '37'];
    
    console.log('=== DIAGNOSING MISSING NOTICES ===\n');
    console.log(`Wallet: ${wallet}`);
    console.log(`Expected Alert NFTs: ${expectedAlertIds.join(', ')}\n`);
    
    try {
        // 1. Check what's in case_service_records for these Alert IDs
        console.log('1. Checking case_service_records for Alert IDs...\n');
        
        for (const alertId of expectedAlertIds) {
            const query = `
                SELECT 
                    case_number,
                    alert_token_id,
                    document_token_id,
                    recipients,
                    served_at
                FROM case_service_records 
                WHERE alert_token_id = $1
            `;
            
            const result = await pool.query(query, [alertId]);
            
            if (result.rows.length > 0) {
                const row = result.rows[0];
                console.log(`Alert NFT #${alertId}: FOUND`);
                console.log(`  Case: ${row.case_number}`);
                console.log(`  Recipients: ${row.recipients}`);
                
                // Check if wallet is in recipients
                const recipients = typeof row.recipients === 'string' 
                    ? JSON.parse(row.recipients) 
                    : row.recipients;
                    
                if (recipients.includes(wallet)) {
                    console.log(`  ✅ Wallet IS in recipients list`);
                } else {
                    console.log(`  ❌ Wallet NOT in recipients list!`);
                    console.log(`  Current recipients: ${JSON.stringify(recipients)}`);
                }
            } else {
                console.log(`Alert NFT #${alertId}: NOT FOUND in database`);
            }
            console.log('');
        }
        
        // 2. Check what the wallet query actually returns
        console.log('\n2. Checking what wallet query returns...\n');
        
        const walletQuery = `
            SELECT 
                case_number,
                alert_token_id,
                document_token_id,
                recipients
            FROM case_service_records 
            WHERE recipients::text ILIKE $1
            ORDER BY alert_token_id::int
        `;
        
        const walletResult = await pool.query(walletQuery, [`%${wallet}%`]);
        
        console.log(`Notices found for wallet: ${walletResult.rows.length}`);
        walletResult.rows.forEach(row => {
            console.log(`- Alert #${row.alert_token_id} (Case: ${row.case_number})`);
        });
        
        // 3. Proposed fix
        console.log('\n3. PROPOSED FIX:\n');
        
        for (const alertId of expectedAlertIds) {
            const checkResult = await pool.query(
                'SELECT recipients FROM case_service_records WHERE alert_token_id = $1',
                [alertId]
            );
            
            if (checkResult.rows.length > 0) {
                const currentRecipients = typeof checkResult.rows[0].recipients === 'string'
                    ? JSON.parse(checkResult.rows[0].recipients)
                    : checkResult.rows[0].recipients;
                
                if (!currentRecipients.includes(wallet)) {
                    console.log(`Alert NFT #${alertId}: Need to UPDATE recipients`);
                    console.log(`  Current: ${JSON.stringify(currentRecipients)}`);
                    console.log(`  Should be: ["${wallet}"]`);
                    console.log(`  SQL: UPDATE case_service_records SET recipients = '["${wallet}"]'::jsonb WHERE alert_token_id = '${alertId}';`);
                    console.log('');
                }
            }
        }
        
        await pool.end();
        
    } catch (error) {
        console.error('Error:', error);
        await pool.end();
    }
}

diagnoseMissingNotices();