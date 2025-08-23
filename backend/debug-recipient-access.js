/**
 * Debug recipient access for specific wallet and case
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function debugRecipientAccess() {
    const walletAddress = 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH';
    const caseNumber = '34-4343902';
    
    console.log('\n========================================');
    console.log('DEBUGGING RECIPIENT ACCESS');
    console.log('========================================');
    console.log('Wallet:', walletAddress);
    console.log('Case:', caseNumber);
    console.log('========================================\n');
    
    try {
        // 1. Check if case exists in cases table
        console.log('1. CHECKING CASES TABLE:');
        const caseResult = await pool.query(
            'SELECT case_number, status, metadata, server_address FROM cases WHERE case_number = $1',
            [caseNumber]
        );
        
        if (caseResult.rows.length > 0) {
            console.log('✅ Case found in cases table');
            console.log('   Status:', caseResult.rows[0].status);
            console.log('   Server:', caseResult.rows[0].server_address);
            const metadata = caseResult.rows[0].metadata;
            if (metadata) {
                const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
                console.log('   Metadata recipients:', parsed.recipients);
            }
        } else {
            console.log('❌ Case NOT found in cases table');
        }
        
        // 2. Check case_service_records - THIS IS WHAT THE API QUERIES
        console.log('\n2. CHECKING CASE_SERVICE_RECORDS TABLE:');
        const serviceResult = await pool.query(
            'SELECT * FROM case_service_records WHERE case_number = $1',
            [caseNumber]
        );
        
        if (serviceResult.rows.length > 0) {
            const record = serviceResult.rows[0];
            console.log('✅ Found in case_service_records');
            console.log('   Recipients field:', record.recipients);
            
            // Parse recipients to check if wallet is included
            let recipients = [];
            if (record.recipients) {
                try {
                    recipients = typeof record.recipients === 'string' ? 
                        JSON.parse(record.recipients) : record.recipients;
                } catch (e) {
                    console.log('   ⚠️ Error parsing recipients:', e.message);
                }
            }
            
            console.log('   Parsed recipients:', recipients);
            console.log('   Wallet in recipients?', recipients.includes(walletAddress));
            console.log('   Transaction hash:', record.transaction_hash);
            console.log('   Alert token ID:', record.alert_token_id);
            console.log('   IPFS hash:', record.ipfs_hash ? 'Present' : 'Missing');
        } else {
            console.log('❌ NOT found in case_service_records');
        }
        
        // 3. Check what the API would return for this wallet
        console.log('\n3. SIMULATING API QUERY:');
        console.log('   Query: WHERE recipients::jsonb ? $1 OR LOWER(recipients::text) LIKE LOWER($2)');
        console.log('   Params:', [walletAddress, `%${walletAddress}%`]);
        
        const apiResult = await pool.query(`
            SELECT 
                csr.case_number,
                csr.recipients,
                csr.alert_token_id
            FROM case_service_records csr
            WHERE csr.recipients::jsonb ? $1
               OR LOWER(csr.recipients::text) LIKE LOWER($2)
        `, [walletAddress, `%${walletAddress}%`]);
        
        console.log('   API would return', apiResult.rows.length, 'records for this wallet');
        if (apiResult.rows.length > 0) {
            apiResult.rows.forEach(row => {
                console.log('   - Case:', row.case_number, 'Alert NFT:', row.alert_token_id);
            });
        }
        
        // 4. Try different query methods
        console.log('\n4. TRYING DIFFERENT QUERY METHODS:');
        
        // Method 1: Direct text search
        const method1 = await pool.query(
            `SELECT case_number FROM case_service_records WHERE recipients::text LIKE $1`,
            [`%${walletAddress}%`]
        );
        console.log('   Text search (LIKE %wallet%):', method1.rows.length, 'results');
        
        // Method 2: Case-insensitive search
        const method2 = await pool.query(
            `SELECT case_number FROM case_service_records WHERE LOWER(recipients::text) LIKE LOWER($1)`,
            [`%${walletAddress}%`]
        );
        console.log('   Case-insensitive search:', method2.rows.length, 'results');
        
        // Method 3: Specific case check
        const method3 = await pool.query(
            `SELECT recipients FROM case_service_records WHERE case_number = $1`,
            [caseNumber]
        );
        if (method3.rows.length > 0) {
            const recText = method3.rows[0].recipients;
            console.log('   Specific case recipients raw:', recText);
            console.log('   Contains wallet (text)?', recText?.includes(walletAddress));
        }
        
        // 5. Check for case sensitivity issues
        console.log('\n5. CHECKING CASE SENSITIVITY:');
        const caseCheck = await pool.query(`
            SELECT case_number, recipients 
            FROM case_service_records 
            WHERE case_number = $1 OR case_number = $2
        `, [caseNumber, caseNumber.toUpperCase()]);
        
        caseCheck.rows.forEach(row => {
            console.log('   Found case:', row.case_number);
            console.log('   Recipients:', row.recipients);
        });
        
        console.log('\n========================================');
        console.log('DIAGNOSIS COMPLETE');
        console.log('========================================\n');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

debugRecipientAccess();