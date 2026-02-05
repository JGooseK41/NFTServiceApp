/**
 * Diagnose what data exists for a specific wallet's tokens
 * Run: node diagnose-wallet-tokens.js TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function diagnoseWalletTokens(walletAddress) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`DIAGNOSING WALLET: ${walletAddress}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
        // 1. Check case_service_records for this wallet
        console.log('1. CASE SERVICE RECORDS (what BlockServed sees):');
        console.log('-'.repeat(50));

        const csr = await pool.query(`
            SELECT
                case_number,
                alert_token_id,
                document_token_id,
                ipfs_hash,
                encryption_key,
                transaction_hash,
                server_name,
                served_at,
                recipients
            FROM case_service_records
            WHERE recipients::text ILIKE $1
            ORDER BY alert_token_id::int
        `, [`%${walletAddress}%`]);

        if (csr.rows.length === 0) {
            console.log('  No records found');
        } else {
            csr.rows.forEach(row => {
                console.log(`  Token #${row.alert_token_id}:`);
                console.log(`    Case: ${row.case_number}`);
                console.log(`    IPFS Hash: ${row.ipfs_hash || 'MISSING'}`);
                console.log(`    Encryption Key: ${row.encryption_key ? 'Present' : 'MISSING'}`);
                console.log(`    Transaction: ${row.transaction_hash || 'MISSING'}`);
                console.log('');
            });
        }

        // 2. Check notice_components for these token IDs
        console.log('\n2. NOTICE COMPONENTS (document URLs):');
        console.log('-'.repeat(50));

        const tokenIds = csr.rows.map(r => r.alert_token_id).filter(Boolean);

        if (tokenIds.length > 0) {
            const nc = await pool.query(`
                SELECT
                    notice_id,
                    alert_id,
                    document_id,
                    case_number,
                    recipient_address,
                    alert_thumbnail_url,
                    document_unencrypted_url,
                    document_ipfs_hash,
                    document_encryption_key,
                    created_at
                FROM notice_components
                WHERE alert_id = ANY($1::text[])
                   OR document_id = ANY($1::text[])
                   OR recipient_address ILIKE $2
            `, [tokenIds, `%${walletAddress}%`]);

            if (nc.rows.length === 0) {
                console.log('  No records found for these token IDs');
            } else {
                nc.rows.forEach(row => {
                    console.log(`  Notice ${row.notice_id || row.alert_id}:`);
                    console.log(`    Case: ${row.case_number || 'MISSING'}`);
                    console.log(`    Alert Thumbnail: ${row.alert_thumbnail_url ? 'Present' : 'MISSING'}`);
                    console.log(`    Document URL: ${row.document_unencrypted_url ? 'Present' : 'MISSING'}`);
                    console.log(`    IPFS Hash: ${row.document_ipfs_hash || 'MISSING'}`);
                    console.log('');
                });
            }
        }

        // 3. Check images table
        console.log('\n3. IMAGES TABLE:');
        console.log('-'.repeat(50));

        const images = await pool.query(`
            SELECT
                notice_id,
                case_number,
                alert_image,
                document_image,
                recipient_address,
                created_at
            FROM images
            WHERE notice_id = ANY($1::text[])
               OR recipient_address ILIKE $2
        `, [tokenIds, `%${walletAddress}%`]);

        if (images.rows.length === 0) {
            console.log('  No records found');
        } else {
            images.rows.forEach(row => {
                console.log(`  Notice ${row.notice_id}:`);
                console.log(`    Case: ${row.case_number || 'MISSING'}`);
                console.log(`    Alert Image: ${row.alert_image ? 'Present' : 'MISSING'}`);
                console.log(`    Document Image: ${row.document_image ? 'Present' : 'MISSING'}`);
                console.log('');
            });
        }

        // 4. Check served_notices
        console.log('\n4. SERVED NOTICES:');
        console.log('-'.repeat(50));

        const served = await pool.query(`
            SELECT
                notice_id,
                alert_id,
                document_id,
                case_number,
                ipfs_hash,
                recipient_address,
                served_at
            FROM served_notices
            WHERE recipient_address ILIKE $1
               OR alert_id = ANY($2::text[])
        `, [`%${walletAddress}%`, tokenIds]);

        if (served.rows.length === 0) {
            console.log('  No records found');
        } else {
            served.rows.forEach(row => {
                console.log(`  Notice ${row.notice_id}:`);
                console.log(`    Alert ID: ${row.alert_id}, Document ID: ${row.document_id}`);
                console.log(`    Case: ${row.case_number || 'MISSING'}`);
                console.log(`    IPFS: ${row.ipfs_hash || 'MISSING'}`);
                console.log('');
            });
        }

        // 5. Summary
        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY:');
        console.log('='.repeat(60));

        const hasPlaceholders = csr.rows.some(r => r.case_number?.includes('PLACEHOLDER'));
        const missingDocUrls = csr.rows.filter(r => !r.ipfs_hash).length;

        if (hasPlaceholders) {
            console.log('  PROBLEM: Case numbers are placeholders (TOKEN-X-PLACEHOLDER)');
            console.log('  This means the original case data was not linked when tokens were created.');
        }

        if (missingDocUrls > 0) {
            console.log(`  PROBLEM: ${missingDocUrls} records missing IPFS hashes`);
        }

        console.log('\n  The issue is likely:');
        console.log('  - Documents were served on blockchain (NFTs minted)');
        console.log('  - But database records were not created during the serve process');
        console.log('  - Later, placeholder records were created from blockchain data');
        console.log('  - These placeholders have no link to actual document files');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

// Run with wallet address from command line
const walletAddress = process.argv[2] || 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH';
diagnoseWalletTokens(walletAddress);
