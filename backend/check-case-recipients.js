/**
 * Check recipients for a specific case
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkCaseRecipients() {
    const caseNumber = '34-4343902';
    const expectedWallet = 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH';
    
    console.log('\n========================================');
    console.log('CHECKING CASE RECIPIENTS');
    console.log('========================================');
    console.log('Case Number:', caseNumber);
    console.log('Expected Wallet:', expectedWallet);
    console.log('========================================\n');
    
    try {
        // Check case_service_records table
        console.log('1. CHECKING case_service_records TABLE:');
        const result = await pool.query(
            'SELECT case_number, recipients, served_at FROM case_service_records WHERE case_number = $1',
            [caseNumber]
        );
        
        if (result.rows.length > 0) {
            const record = result.rows[0];
            console.log('✅ Found case in case_service_records');
            console.log('   Served at:', record.served_at);
            console.log('   Recipients raw value:', record.recipients);
            console.log('   Recipients type:', typeof record.recipients);
            
            // Try to parse recipients
            let recipients = [];
            if (record.recipients) {
                try {
                    if (typeof record.recipients === 'string') {
                        recipients = JSON.parse(record.recipients);
                    } else {
                        recipients = record.recipients;
                    }
                } catch (e) {
                    console.log('   ⚠️ Error parsing recipients:', e.message);
                    // Try splitting by comma if it's a comma-separated string
                    if (typeof record.recipients === 'string' && record.recipients.includes(',')) {
                        recipients = record.recipients.split(',').map(r => r.trim());
                    }
                }
            }
            
            console.log('   Parsed recipients:', recipients);
            console.log('   Number of recipients:', Array.isArray(recipients) ? recipients.length : 0);
            
            if (Array.isArray(recipients)) {
                console.log('   Is wallet in list?', recipients.includes(expectedWallet));
                
                // Check with different case variations
                const lowerWallet = expectedWallet.toLowerCase();
                const upperWallet = expectedWallet.toUpperCase();
                
                recipients.forEach((r, i) => {
                    console.log(`   Recipient ${i + 1}: "${r}"`);
                    if (r.toLowerCase() === lowerWallet) {
                        console.log(`     → Matches expected wallet (case-insensitive)`);
                    }
                });
            }
        } else {
            console.log('❌ Case NOT found in case_service_records');
        }
        
        // Check all cases with any recipient
        console.log('\n2. ALL CASES IN case_service_records:');
        const allCases = await pool.query(
            'SELECT case_number, recipients FROM case_service_records WHERE recipients IS NOT NULL'
        );
        
        console.log(`Found ${allCases.rows.length} cases with recipients`);
        
        // Search for the wallet in any case
        let foundInCases = [];
        allCases.rows.forEach(row => {
            let recipients = [];
            try {
                if (typeof row.recipients === 'string') {
                    recipients = JSON.parse(row.recipients);
                } else {
                    recipients = row.recipients;
                }
            } catch (e) {
                // Ignore parse errors
            }
            
            if (Array.isArray(recipients) && recipients.includes(expectedWallet)) {
                foundInCases.push(row.case_number);
            } else if (typeof row.recipients === 'string' && row.recipients.includes(expectedWallet)) {
                foundInCases.push(row.case_number);
            }
        });
        
        if (foundInCases.length > 0) {
            console.log(`\n✅ Wallet ${expectedWallet} found in cases:`, foundInCases);
        } else {
            console.log(`\n❌ Wallet ${expectedWallet} not found in any case`);
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkCaseRecipients();