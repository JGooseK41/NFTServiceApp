/**
 * Update token records with actual blockchain data
 * Based on the actual NFT transfers from the blockchain
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Actual blockchain data from NFT transfers
const blockchainData = [
    // First batch - 2 days ago (tx: 5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0)
    { tokenId: 31, owner: 'TD1F37V4cAFH1YQCYVLtcFyFXkZUs7mBDE', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
    { tokenId: 32, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
    { tokenId: 33, owner: 'TAr8S97Xw3xhrGkZSghXQ85SFuP5XDU4cF', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
    { tokenId: 34, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
    { tokenId: 35, owner: 'TBrjqKepMQKeZWjebMip2bH5872fiD3F6Q', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
    { tokenId: 36, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
    { tokenId: 37, owner: 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' }, // Known case
    { tokenId: 38, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0' },
    
    // Second batch - 1 day ago (tx: 033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5)
    { tokenId: 39, owner: 'TArxGhbLdY6ApwaCYZbwdZYiHBG96heiwp', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' },
    { tokenId: 40, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' },
    { tokenId: 41, owner: 'TUNKp7upGiHt9tamt37VfjHRPUUbZ1yNKS', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' },
    { tokenId: 42, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' },
    { tokenId: 43, owner: 'TVPPcD8P8QWK5eix6B6r5nVNaUFUHfUohe', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' },
    { tokenId: 44, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' },
    { tokenId: 45, owner: 'TCULAeahAiC9nvurUzxvusGRLD2JxoY5Yw', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' },
    { tokenId: 46, owner: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', tx: '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5' }
];

async function updateTokensWithBlockchainData() {
    console.log('\n========================================');
    console.log('UPDATING TOKENS WITH BLOCKCHAIN DATA');
    console.log('========================================\n');
    
    let updated = 0;
    let errors = 0;
    
    try {
        for (const token of blockchainData) {
            try {
                // Skip token 37 as it already has correct data
                if (token.tokenId === 37) {
                    console.log(`Token #37: Already correctly mapped to case 34-4343902`);
                    continue;
                }
                
                // Update the placeholder record with actual owner
                const result = await pool.query(`
                    UPDATE case_service_records
                    SET 
                        recipients = $1,
                        transaction_hash = $2,
                        status = 'served',
                        issuing_agency = 'via Blockserved.com'
                    WHERE alert_token_id = $3
                    RETURNING case_number
                `, [
                    JSON.stringify([token.owner]),
                    token.tx,
                    token.tokenId.toString()
                ]);
                
                if (result.rowCount > 0) {
                    console.log(`✓ Updated token #${token.tokenId} -> Owner: ${token.owner}`);
                    updated++;
                } else {
                    console.log(`⚠ Token #${token.tokenId} not found in database`);
                }
                
            } catch (e) {
                console.log(`✗ Error updating token #${token.tokenId}: ${e.message}`);
                errors++;
            }
        }
        
        // Summary by wallet
        console.log('\n========================================');
        console.log('SUMMARY BY WALLET ADDRESS');
        console.log('========================================\n');
        
        const walletCounts = {};
        blockchainData.forEach(token => {
            if (!walletCounts[token.owner]) {
                walletCounts[token.owner] = [];
            }
            walletCounts[token.owner].push(token.tokenId);
        });
        
        for (const [wallet, tokenIds] of Object.entries(walletCounts)) {
            console.log(`${wallet}: ${tokenIds.length} tokens`);
            console.log(`  Token IDs: ${tokenIds.join(', ')}`);
        }
        
        console.log('\n========================================');
        console.log('UPDATE COMPLETE');
        console.log(`Updated: ${updated} tokens`);
        console.log(`Errors: ${errors}`);
        console.log('========================================\n');
        
    } catch (error) {
        console.error('Error during update:', error);
    } finally {
        await pool.end();
    }
}

// Run the update
updateTokensWithBlockchainData();