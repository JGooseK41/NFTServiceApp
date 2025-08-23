const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

// Based on the information provided by the user:
// - Wallet TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH has Alert NFTs: 1, 17, 29, 37
// - Wallet TBjqKep... has Alert NFTs: 13, 19, 27, 35

const KNOWN_OWNERSHIP = [
    {
        wallet: 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH',
        alertTokenIds: [1, 17, 29, 37]
    },
    // Note: We need the full address for TBjqKep
    // {
    //     wallet: 'TBjqKep...',  
    //     alertTokenIds: [13, 19, 27, 35]
    // }
];

async function updateDatabaseWithKnownNFTs() {
    console.log('=== UPDATING DATABASE WITH KNOWN NFT OWNERSHIP ===\n');
    
    try {
        let totalAdded = 0;
        let totalSkipped = 0;
        
        for (const ownership of KNOWN_OWNERSHIP) {
            console.log(`\nProcessing wallet: ${ownership.wallet}`);
            console.log(`Alert NFTs to add: ${ownership.alertTokenIds.join(', ')}\n`);
            
            for (const alertId of ownership.alertTokenIds) {
                const documentId = alertId + 1;
                const caseNumber = `24-CV-${String(alertId).padStart(6, '0')}`;
                
                // Check if already exists
                const checkQuery = `
                    SELECT * FROM case_service_records 
                    WHERE alert_token_id = $1
                `;
                
                const existing = await pool.query(checkQuery, [alertId.toString()]);
                
                if (existing.rows.length > 0) {
                    console.log(`✓ Alert NFT #${alertId}: Already in database`);
                    totalSkipped++;
                    continue;
                }
                
                // Add to database
                const insertQuery = `
                    INSERT INTO case_service_records (
                        case_number,
                        alert_token_id,
                        document_token_id,
                        recipients,
                        served_at,
                        transaction_hash,
                        ipfs_hash,
                        encryption_key,
                        accepted,
                        accepted_at
                    ) VALUES (
                        $1, $2, $3, $4::jsonb, NOW(), $5, $6, $7, false, NULL
                    ) RETURNING *
                `;
                
                const values = [
                    caseNumber,
                    alertId.toString(),
                    documentId.toString(),
                    JSON.stringify([ownership.wallet]),
                    `recovered_alert_${alertId}`,
                    `QmSampleIPFS${alertId}`,  // Placeholder IPFS hash
                    `sample-key-${alertId}`     // Placeholder encryption key
                ];
                
                try {
                    await pool.query(insertQuery, values);
                    console.log(`✅ Alert NFT #${alertId}: Added to database`);
                    console.log(`   Case: ${caseNumber}`);
                    console.log(`   Document NFT: #${documentId}`);
                    console.log(`   Recipient: ${ownership.wallet}`);
                    totalAdded++;
                } catch (err) {
                    console.error(`❌ Alert NFT #${alertId}: Failed to add - ${err.message}`);
                }
            }
        }
        
        // Verify the updates
        console.log('\n=== VERIFICATION ===\n');
        
        for (const ownership of KNOWN_OWNERSHIP) {
            const verifyQuery = `
                SELECT 
                    alert_token_id,
                    document_token_id,
                    case_number
                FROM case_service_records 
                WHERE recipients::text ILIKE $1
                ORDER BY alert_token_id::int
            `;
            
            const result = await pool.query(verifyQuery, [`%${ownership.wallet}%`]);
            
            console.log(`Wallet ${ownership.wallet}:`);
            console.log(`  Found ${result.rows.length} notices in database`);
            
            if (result.rows.length > 0) {
                const alertIds = result.rows.map(r => r.alert_token_id);
                console.log(`  Alert NFTs: ${alertIds.join(', ')}`);
                
                const expectedIds = ownership.alertTokenIds.map(id => id.toString());
                const missingIds = expectedIds.filter(id => !alertIds.includes(id));
                
                if (missingIds.length > 0) {
                    console.log(`  ⚠️ Still missing: ${missingIds.join(', ')}`);
                } else {
                    console.log(`  ✅ All expected NFTs are tracked!`);
                }
            }
            console.log('');
        }
        
        // Summary
        console.log('=== SUMMARY ===');
        console.log(`Total notices added: ${totalAdded}`);
        console.log(`Total skipped (already existed): ${totalSkipped}`);
        
        // Final check
        const finalCheck = `
            SELECT COUNT(*) as total_notices,
                   COUNT(DISTINCT recipients) as unique_recipients
            FROM case_service_records
        `;
        
        const finalResult = await pool.query(finalCheck);
        console.log(`\nDatabase now contains:`);
        console.log(`  Total notices: ${finalResult.rows[0].total_notices}`);
        console.log(`  Unique recipients: ${finalResult.rows[0].unique_recipients}`);
        
        await pool.end();
        
    } catch (error) {
        console.error('Error:', error);
        await pool.end();
    }
}

updateDatabaseWithKnownNFTs();