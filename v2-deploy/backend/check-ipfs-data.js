/**
 * Diagnostic script to check what's actually stored in IPFS
 */

const https = require('https');
const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function fetchFromIPFS(ipfsHash) {
    return new Promise((resolve, reject) => {
        const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function checkIPFSData() {
    console.log('🔍 Checking IPFS data format...\n');
    
    try {
        // Get a sample notice with IPFS hash
        const query = `
            SELECT DISTINCT
                sn.notice_id,
                sn.ipfs_hash,
                nc.document_encryption_key as encryption_key
            FROM served_notices sn
            LEFT JOIN notice_components nc ON nc.notice_id = sn.notice_id
            WHERE 
                sn.ipfs_hash IS NOT NULL 
                AND sn.ipfs_hash != ''
                AND nc.document_encryption_key IS NOT NULL
            LIMIT 1;
        `;
        
        const result = await pool.query(query);
        
        if (result.rows.length === 0) {
            console.log('No notices with IPFS data found');
            return;
        }
        
        const notice = result.rows[0];
        console.log(`Notice ID: ${notice.notice_id}`);
        console.log(`IPFS Hash: ${notice.ipfs_hash}`);
        console.log(`Encryption Key: ${notice.encryption_key}\n`);
        
        // Download from IPFS
        console.log('Downloading from IPFS...');
        const ipfsData = await fetchFromIPFS(notice.ipfs_hash);
        
        console.log('Downloaded data analysis:');
        console.log('- Length:', ipfsData.length);
        console.log('- First 100 chars:', ipfsData.substring(0, 100));
        console.log('- First 20 bytes (hex):', Buffer.from(ipfsData.substring(0, 20)).toString('hex'));
        
        // Check if it starts with U2FsdGVkX1 (CryptoJS marker)
        if (ipfsData.startsWith('U2FsdGVkX1')) {
            console.log('\n✅ Data is CryptoJS format (U2FsdGVkX1 prefix)');
            
            // Decode and check structure
            const base64Part = ipfsData.substring(10);
            const decoded = Buffer.from(base64Part, 'base64');
            
            console.log('\nDecoded structure:');
            console.log('- Total size:', decoded.length, 'bytes');
            console.log('- First 16 bytes (hex):', decoded.slice(0, 16).toString('hex'));
            console.log('- First 8 bytes (ascii):', decoded.slice(0, 8).toString('ascii'));
            
            if (decoded.slice(0, 8).toString('ascii') === 'Salted__') {
                console.log('✅ Has "Salted__" header');
                console.log('- Salt (hex):', decoded.slice(8, 16).toString('hex'));
                console.log('- Encrypted data starts at byte 16');
                console.log('- Encrypted data length:', decoded.length - 16, 'bytes');
            } else {
                console.log('❌ Missing "Salted__" header - not standard OpenSSL format');
                console.log('This might be a different encryption format');
            }
        } else {
            console.log('\n❌ Data does NOT start with U2FsdGVkX1');
            
            // Check if it's JSON
            try {
                const parsed = JSON.parse(ipfsData);
                console.log('✅ Data is JSON:');
                console.log('Keys:', Object.keys(parsed));
                
                // Check for encryption structure
                if (parsed.iv && parsed.encryptedData) {
                    console.log('Looks like AES-GCM format with IV and encrypted data');
                }
                if (parsed.encrypted) {
                    console.log('Has "encrypted" field:', parsed.encrypted.substring(0, 50) + '...');
                }
            } catch (e) {
                console.log('❌ Data is not JSON');
                
                // Check if it's base64
                try {
                    const decoded = Buffer.from(ipfsData, 'base64');
                    console.log('✅ Data appears to be base64');
                    console.log('- Decoded length:', decoded.length);
                    console.log('- First 16 bytes (hex):', decoded.slice(0, 16).toString('hex'));
                } catch (e2) {
                    console.log('❌ Data is not valid base64');
                }
            }
        }
        
        // Try different decryption approaches
        console.log('\n=== Trying different decryption methods ===\n');
        
        // Method 1: Direct AES decryption
        try {
            const crypto = require('crypto');
            const key = Buffer.from(notice.encryption_key, 'hex');
            
            // Try as simple AES-256-CBC
            if (key.length === 32) {
                const iv = Buffer.alloc(16, 0);
                const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
                
                let decrypted = decipher.update(ipfsData, 'base64');
                decrypted = Buffer.concat([decrypted, decipher.final()]);
                
                console.log('✅ Method 1 (AES-256-CBC with zero IV) worked!');
                console.log('Decrypted:', decrypted.toString().substring(0, 100));
            }
        } catch (e) {
            console.log('❌ Method 1 failed:', e.message);
        }
        
        // Method 2: CryptoJS-compatible decryption
        try {
            const crypto = require('crypto');
            
            // Use key as passphrase
            const passphrase = notice.encryption_key;
            
            if (ipfsData.startsWith('U2FsdGVkX1')) {
                // This is what we expect
                console.log('Attempting CryptoJS decryption with passphrase...');
            } else {
                // Try treating the whole thing as base64 encrypted
                const testData = 'U2FsdGVkX1' + ipfsData;
                console.log('Trying with U2FsdGVkX1 prefix added...');
            }
        } catch (e) {
            console.log('❌ Method 2 failed:', e.message);
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkIPFSData();