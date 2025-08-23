const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function checkMissingNotices() {
    const wallet = 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH';
    const alertTokenIds = ['1', '17', '29', '37'];
    
    console.log(`\nChecking notices for wallet: ${wallet}`);
    console.log(`Expected Alert NFTs: ${alertTokenIds.join(', ')}\n`);
    
    try {
        // Check what's in case_service_records
        console.log('=== Checking case_service_records ===');
        const serviceQuery = `
            SELECT 
                case_number,
                alert_token_id,
                document_token_id,
                recipients,
                served_at,
                transaction_hash
            FROM case_service_records 
            WHERE alert_token_id = ANY($1::text[])
               OR recipients::text ILIKE $2
            ORDER BY alert_token_id::int
        `;
        
        const serviceResult = await pool.query(serviceQuery, [alertTokenIds, `%${wallet}%`]);
        
        console.log(`Found ${serviceResult.rows.length} records in case_service_records:`);
        serviceResult.rows.forEach(row => {
            console.log(`- Alert #${row.alert_token_id}: Case ${row.case_number}`);
            console.log(`  Recipients: ${row.recipients}`);
            console.log(`  Document Token: ${row.document_token_id || 'NOT SET'}`);
            console.log(`  TX: ${row.transaction_hash}\n`);
        });
        
        // Check if the missing alerts exist in the cases table
        console.log('=== Checking cases table for missing notices ===');
        const casesQuery = `
            SELECT 
                id,
                case_number,
                token_id,
                alert_token_id,
                document_token_id,
                recipient_address,
                status,
                created_at
            FROM cases 
            WHERE recipient_address = $1
               OR token_id = ANY($2::text[])
               OR alert_token_id = ANY($2::text[])
            ORDER BY created_at
        `;
        
        const casesResult = await pool.query(casesQuery, [wallet, alertTokenIds]);
        
        console.log(`Found ${casesResult.rows.length} cases:`);
        casesResult.rows.forEach(row => {
            console.log(`- Case ${row.case_number}: Token ${row.token_id || row.alert_token_id}`);
            console.log(`  Recipient: ${row.recipient_address}`);
            console.log(`  Status: ${row.status}\n`);
        });
        
        // Find which Alert NFTs are missing from case_service_records
        const foundAlertIds = serviceResult.rows.map(r => r.alert_token_id);
        const missingAlertIds = alertTokenIds.filter(id => !foundAlertIds.includes(id));
        
        if (missingAlertIds.length > 0) {
            console.log(`\n⚠️  Missing Alert NFTs in case_service_records: ${missingAlertIds.join(', ')}`);
            console.log('These need to be added to case_service_records for the recipient to see them.\n');
            
            // Try to find transaction data for missing alerts
            for (const alertId of missingAlertIds) {
                console.log(`Searching for Alert NFT #${alertId}...`);
                
                // Check if it exists in cases table
                const caseCheck = await pool.query(`
                    SELECT * FROM cases 
                    WHERE token_id = $1 OR alert_token_id = $1
                    LIMIT 1
                `, [alertId]);
                
                if (caseCheck.rows.length > 0) {
                    const caseData = caseCheck.rows[0];
                    console.log(`  Found in cases table: Case ${caseData.case_number}`);
                    console.log(`  Would need to add to case_service_records with:`);
                    console.log(`    - alert_token_id: ${alertId}`);
                    console.log(`    - document_token_id: ${parseInt(alertId) + 1}`);
                    console.log(`    - recipients: ["${wallet}"]`);
                } else {
                    console.log(`  Not found in cases table - may need blockchain lookup`);
                }
            }
        }
        
        await pool.end();
        
    } catch (error) {
        console.error('Error:', error);
        await pool.end();
    }
}

checkMissingNotices();