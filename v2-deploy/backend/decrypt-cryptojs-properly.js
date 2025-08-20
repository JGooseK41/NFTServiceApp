/**
 * Proper CryptoJS Decryption Implementation
 * This script correctly decrypts CryptoJS-encrypted data from IPFS
 */

const crypto = require('crypto');
const https = require('https');
const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Fetch data from IPFS
 */
function fetchFromIPFS(ipfsHash) {
    return new Promise((resolve, reject) => {
        const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        console.log(`Fetching from: ${url}`);
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

/**
 * CryptoJS-compatible decryption
 * CryptoJS.AES.encrypt() creates a specific format that we need to decrypt
 */
function decryptCryptoJS(encryptedString, passphrase) {
    // CryptoJS format: "U2FsdGVkX1" + base64(salt + ciphertext)
    // When CryptoJS.AES.encrypt(data, passphrase) is called, it:
    // 1. Generates a random 8-byte salt
    // 2. Derives key and IV from passphrase + salt using MD5
    // 3. Encrypts with AES-256-CBC
    // 4. Outputs: "U2FsdGVkX1" + base64("Salted__" + salt + ciphertext)
    
    if (!encryptedString.startsWith('U2FsdGVkX1')) {
        throw new Error('Not a CryptoJS encrypted string');
    }
    
    // Decode the base64 part after "U2FsdGVkX1"
    const encryptedData = Buffer.from(encryptedString.substring(10), 'base64');
    
    // Check for "Salted__" header
    const header = encryptedData.slice(0, 8).toString('utf8');
    if (header !== 'Salted__') {
        // Sometimes CryptoJS doesn't include the "Salted__" text, just the salt
        // In this case, the first 8 bytes are the salt itself
        console.log('No Salted__ header found, treating first 8 bytes as salt');
        
        const salt = encryptedData.slice(0, 8);
        const ciphertext = encryptedData.slice(8);
        
        // Derive key and IV using MD5 (OpenSSL's EVP_BytesToKey)
        const keyAndIV = deriveKeyAndIV(passphrase, salt);
        
        // Decrypt using AES-256-CBC
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyAndIV.key, keyAndIV.iv);
        decipher.setAutoPadding(true);
        
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted.toString('utf8');
    } else {
        // Standard format with "Salted__" header
        const salt = encryptedData.slice(8, 16);
        const ciphertext = encryptedData.slice(16);
        
        // Derive key and IV
        const keyAndIV = deriveKeyAndIV(passphrase, salt);
        
        // Decrypt
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyAndIV.key, keyAndIV.iv);
        decipher.setAutoPadding(true);
        
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted.toString('utf8');
    }
}

/**
 * OpenSSL's EVP_BytesToKey implementation
 * This is what CryptoJS uses internally for key derivation
 */
function deriveKeyAndIV(passphrase, salt) {
    const password = Buffer.from(passphrase, 'utf8');
    const keyLen = 32; // AES-256
    const ivLen = 16;  // AES block size
    
    const derivedBytes = [];
    let data = Buffer.concat([password, salt]);
    
    while (derivedBytes.length < keyLen + ivLen) {
        const hash = crypto.createHash('md5');
        hash.update(data);
        const digest = hash.digest();
        derivedBytes.push(digest);
        data = Buffer.concat([digest, password, salt]);
    }
    
    const result = Buffer.concat(derivedBytes);
    return {
        key: result.slice(0, keyLen),
        iv: result.slice(keyLen, keyLen + ivLen)
    };
}

/**
 * Try multiple decryption approaches
 */
async function tryDecryption(encryptedData, encryptionKey) {
    const attempts = [];
    
    // Attempt 1: Use encryption key directly as passphrase
    try {
        console.log('\nAttempt 1: Using key as passphrase...');
        const decrypted = decryptCryptoJS(encryptedData, encryptionKey);
        console.log('✅ Success with key as passphrase!');
        return { success: true, method: 'passphrase', data: decrypted };
    } catch (e) {
        attempts.push({ method: 'passphrase', error: e.message });
    }
    
    // Attempt 2: Try hex key as bytes converted to string
    try {
        console.log('\nAttempt 2: Converting hex key to UTF-8 string...');
        const keyBytes = Buffer.from(encryptionKey, 'hex');
        const keyString = keyBytes.toString('utf8');
        const decrypted = decryptCryptoJS(encryptedData, keyString);
        console.log('✅ Success with hex-to-string key!');
        return { success: true, method: 'hex-to-string', data: decrypted };
    } catch (e) {
        attempts.push({ method: 'hex-to-string', error: e.message });
    }
    
    // Attempt 3: Try the key without any conversion (raw hex string)
    try {
        console.log('\nAttempt 3: Using raw hex string as passphrase...');
        // Sometimes the "encryption key" is actually already the passphrase
        const decrypted = decryptCryptoJS(encryptedData, encryptionKey);
        console.log('✅ Success with raw hex string!');
        return { success: true, method: 'raw-hex', data: decrypted };
    } catch (e) {
        attempts.push({ method: 'raw-hex', error: e.message });
    }
    
    // Attempt 4: Check if the data might be double-encoded
    try {
        console.log('\nAttempt 4: Checking for double-encoding...');
        // Sometimes data gets base64 encoded twice
        const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
        if (decoded.startsWith('U2FsdGVkX1')) {
            const decrypted = decryptCryptoJS(decoded, encryptionKey);
            console.log('✅ Success with double-decoded data!');
            return { success: true, method: 'double-encoded', data: decrypted };
        }
    } catch (e) {
        attempts.push({ method: 'double-encoded', error: e.message });
    }
    
    return { success: false, attempts };
}

/**
 * Main function to test decryption
 */
async function testDecryption() {
    console.log('🔐 Testing CryptoJS Decryption\n');
    console.log('='.repeat(50));
    
    try {
        // Get a sample notice with IPFS hash and encryption key
        const query = `
            SELECT DISTINCT
                sn.notice_id,
                sn.ipfs_hash,
                nc.document_encryption_key as encryption_key,
                sn.case_number
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
            console.log('No notices with IPFS data and encryption keys found');
            return;
        }
        
        const notice = result.rows[0];
        console.log(`Notice ID: ${notice.notice_id}`);
        console.log(`Case: ${notice.case_number}`);
        console.log(`IPFS Hash: ${notice.ipfs_hash}`);
        console.log(`Encryption Key: ${notice.encryption_key}`);
        console.log(`Key Length: ${notice.encryption_key.length} characters`);
        console.log('');
        
        // Download from IPFS
        console.log('📥 Downloading from IPFS...');
        const ipfsData = await fetchFromIPFS(notice.ipfs_hash);
        
        console.log(`Downloaded ${ipfsData.length} bytes`);
        console.log(`First 50 chars: ${ipfsData.substring(0, 50)}...`);
        console.log(`Starts with U2FsdGVkX1: ${ipfsData.startsWith('U2FsdGVkX1')}`);
        console.log('');
        
        // Try decryption
        console.log('🔓 Attempting decryption...');
        console.log('='.repeat(50));
        
        const result2 = await tryDecryption(ipfsData, notice.encryption_key);
        
        if (result2.success) {
            console.log('\n' + '='.repeat(50));
            console.log('🎉 DECRYPTION SUCCESSFUL!');
            console.log('='.repeat(50));
            console.log(`Method used: ${result2.method}`);
            console.log('\nDecrypted data preview:');
            
            try {
                // Try to parse as JSON
                const parsed = JSON.parse(result2.data);
                console.log('Data is valid JSON with keys:', Object.keys(parsed));
                
                // Check for document data
                if (parsed.thumbnail || parsed.thumbnailUrl) {
                    console.log('✅ Found thumbnail data');
                }
                if (parsed.document || parsed.fullDocument || parsed.documentUrl) {
                    console.log('✅ Found document data');
                }
                if (parsed.documents && Array.isArray(parsed.documents)) {
                    console.log(`✅ Found ${parsed.documents.length} documents`);
                }
                
                // Save successful method for recovery
                console.log('\n📝 Instructions for recovery:');
                console.log(`Use decryption method: ${result2.method}`);
                console.log('The documents can now be recovered and stored in the database.');
                
            } catch (e) {
                console.log('Decrypted data is not JSON, showing first 200 chars:');
                console.log(result2.data.substring(0, 200));
            }
            
        } else {
            console.log('\n' + '='.repeat(50));
            console.log('❌ ALL DECRYPTION ATTEMPTS FAILED');
            console.log('='.repeat(50));
            console.log('\nAttempted methods and errors:');
            result2.attempts.forEach(attempt => {
                console.log(`  ${attempt.method}: ${attempt.error}`);
            });
            
            console.log('\n💡 Possible issues:');
            console.log('1. The encryption key might be incorrect');
            console.log('2. The data might use a different encryption method');
            console.log('3. The key might need different preprocessing');
            console.log('\nNext steps:');
            console.log('1. Check the frontend code to see exactly how the key is generated');
            console.log('2. Verify the encryption method matches CryptoJS.AES.encrypt()');
            console.log('3. Check if any additional transformations are applied to the key');
        }
        
    } catch (error) {
        console.error('\n❌ Error during testing:', error);
    } finally {
        await pool.end();
    }
}

// Run the test
testDecryption();