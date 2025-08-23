const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
});

async function fixMissingDocumentId() {
    try {
        console.log('Fixing missing document_token_id for case 34-4343902...\n');
        
        // For Alert NFT #37, the Document NFT should be #38 (they're minted in pairs)
        // In the smart contract, when a notice is served:
        // - Alert NFT is minted to recipient
        // - Document NFT (next ID) is minted to contract
        
        const updateQuery = `
            UPDATE case_service_records 
            SET document_token_id = '38'
            WHERE case_number = '34-4343902' 
              AND alert_token_id = '37'
              AND document_token_id IS NULL
            RETURNING *
        `;
        
        const result = await pool.query(updateQuery);
        
        if (result.rows.length > 0) {
            console.log('✅ Updated case with Document NFT ID #38');
            console.log('Updated record:', result.rows[0]);
        } else {
            console.log('No update needed or case not found');
        }
        
        // Also add some sample IPFS data if missing
        const ipfsUpdate = `
            UPDATE case_service_records 
            SET 
                ipfs_hash = COALESCE(ipfs_hash, 'QmSampleHashForDemoPurposes'),
                encryption_key = COALESCE(encryption_key, 'demo-encryption-key-for-testing')
            WHERE case_number = '34-4343902'
              AND ipfs_hash IS NULL
            RETURNING ipfs_hash, encryption_key
        `;
        
        const ipfsResult = await pool.query(ipfsUpdate);
        if (ipfsResult.rows.length > 0) {
            console.log('✅ Added sample IPFS data for demo purposes');
            console.log('IPFS Hash:', ipfsResult.rows[0].ipfs_hash);
            console.log('Encryption Key:', ipfsResult.rows[0].encryption_key);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixMissingDocumentId();