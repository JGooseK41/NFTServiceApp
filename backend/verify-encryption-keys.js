/**
 * Verify Encryption Keys Script
 * Check if we can find encryption keys for notices with IPFS hashes
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function verifyKeys() {
    console.log('🔐 Verifying encryption keys for IPFS recovery...\n');
    
    try {
        // Check notices with IPFS hashes and their encryption keys
        const query = `
            SELECT DISTINCT
                sn.notice_id,
                sn.ipfs_hash,
                nc.document_encryption_key as nc_key,
                sn.case_number,
                sn.created_at
            FROM served_notices sn
            LEFT JOIN notice_components nc ON nc.notice_id = sn.notice_id
            WHERE 
                sn.ipfs_hash IS NOT NULL 
                AND sn.ipfs_hash != ''
            ORDER BY sn.created_at DESC
            LIMIT 20;
        `;
        
        const result = await pool.query(query);
        
        console.log(`Found ${result.rows.length} notices with IPFS hashes\n`);
        
        let withKeys = 0;
        let withoutKeys = 0;
        const missingKeys = [];
        
        for (const row of result.rows) {
            const hasKey = row.nc_key && row.nc_key !== '';
            
            if (hasKey) {
                withKeys++;
                console.log(`✅ Notice ${row.notice_id}: Has encryption key`);
                console.log(`   IPFS: ${row.ipfs_hash}`);
                console.log(`   Key: ${row.nc_key.substring(0, 20)}...`);
            } else {
                withoutKeys++;
                missingKeys.push(row);
                console.log(`❌ Notice ${row.notice_id}: Missing encryption key`);
                console.log(`   IPFS: ${row.ipfs_hash}`);
            }
            console.log('');
        }
        
        console.log('='.repeat(50));
        console.log('SUMMARY:');
        console.log(`✅ Notices with encryption keys: ${withKeys}`);
        console.log(`❌ Notices without encryption keys: ${withoutKeys}`);
        
        if (withoutKeys > 0) {
            console.log('\n⚠️  NOTICES MISSING ENCRYPTION KEYS:');
            missingKeys.forEach(notice => {
                console.log(`  - Notice ${notice.notice_id} (Case: ${notice.case_number})`);
            });
            
            console.log('\n💡 For notices without keys, you may need to:');
            console.log('1. Check if the key is in the blockchain transaction data');
            console.log('2. Look for the key in browser localStorage');
            console.log('3. Check if a default key was used');
            
            // Check if all missing keys share the same IPFS hash (might use same key)
            const uniqueHashes = [...new Set(missingKeys.map(n => n.ipfs_hash))];
            if (uniqueHashes.length === 1) {
                console.log('\n📝 Note: All notices without keys share the same IPFS hash.');
                console.log('They likely use the same encryption key.');
            }
        }
        
        // Check if we have any keys in notice_components at all
        const keyCheckQuery = `
            SELECT COUNT(*) as total, 
                   COUNT(document_encryption_key) as with_keys
            FROM notice_components;
        `;
        
        const keyStats = await pool.query(keyCheckQuery);
        console.log('\n📊 Notice Components Table Stats:');
        console.log(`Total entries: ${keyStats.rows[0].total}`);
        console.log(`Entries with encryption keys: ${keyStats.rows[0].with_keys}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

// Run verification
verifyKeys();