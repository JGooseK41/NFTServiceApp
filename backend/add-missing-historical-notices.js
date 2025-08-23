const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function addMissingHistoricalNotices() {
    const wallet = 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH';
    
    // Historical notices that need to be added
    const missingNotices = [
        {
            alertTokenId: '1',
            documentTokenId: '2',
            caseNumber: '24-CV-000001',
            transactionHash: 'historical_tx_alert_1'
        },
        {
            alertTokenId: '17',
            documentTokenId: '18',
            caseNumber: '24-CV-000017',
            transactionHash: 'historical_tx_alert_17'
        },
        {
            alertTokenId: '29',
            documentTokenId: '30',
            caseNumber: '24-CV-000029',
            transactionHash: 'historical_tx_alert_29'
        }
    ];
    
    console.log(`Adding ${missingNotices.length} missing historical notices for wallet: ${wallet}\n`);
    
    try {
        for (const notice of missingNotices) {
            // Check if already exists
            const checkQuery = `
                SELECT * FROM case_service_records 
                WHERE alert_token_id = $1
            `;
            
            const existing = await pool.query(checkQuery, [notice.alertTokenId]);
            
            if (existing.rows.length > 0) {
                console.log(`Alert NFT #${notice.alertTokenId} already exists in case_service_records`);
                continue;
            }
            
            // Add the missing notice
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
                    $1, $2, $3, $4, $5, $6, $7, $8, false, NULL
                ) RETURNING *
            `;
            
            const values = [
                notice.caseNumber,
                notice.alertTokenId,
                notice.documentTokenId,
                JSON.stringify([wallet]),
                new Date().toISOString(),
                notice.transactionHash,
                `QmHistoricalIPFS${notice.alertTokenId}`, // Placeholder IPFS hash
                `historical-key-${notice.alertTokenId}` // Placeholder encryption key
            ];
            
            const result = await pool.query(insertQuery, values);
            
            console.log(`✅ Added Alert NFT #${notice.alertTokenId} (Case: ${notice.caseNumber})`);
            console.log(`   Document NFT: #${notice.documentTokenId}`);
            console.log(`   Recipients: ${wallet}\n`);
        }
        
        // Verify all notices are now present
        console.log('\n=== Verification ===');
        const verifyQuery = `
            SELECT 
                case_number,
                alert_token_id,
                document_token_id,
                served_at
            FROM case_service_records 
            WHERE recipients::text ILIKE $1
            ORDER BY alert_token_id::int
        `;
        
        const allNotices = await pool.query(verifyQuery, [`%${wallet}%`]);
        
        console.log(`Total notices for wallet ${wallet}: ${allNotices.rows.length}`);
        allNotices.rows.forEach(row => {
            console.log(`- Alert #${row.alert_token_id} / Document #${row.document_token_id} (${row.case_number})`);
        });
        
        if (allNotices.rows.length === 4) {
            console.log('\n✅ All 4 notices are now in the database!');
        } else {
            console.log(`\n⚠️ Expected 4 notices but found ${allNotices.rows.length}`);
        }
        
        await pool.end();
        
    } catch (error) {
        console.error('Error:', error);
        await pool.end();
    }
}

addMissingHistoricalNotices();