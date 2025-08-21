/**
 * Fixed IPFS Recovery Script with Correct CryptoJS Decryption
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const https = require('https');
const { storeDocument, createDocumentStorageTable } = require('./document-storage');
require('dotenv').config();

// IMPORTANT: Set your production database URL here if not in environment
const DATABASE_URL = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;

if (!DATABASE_URL || DATABASE_URL.includes('localhost')) {
    console.error('⚠️  WARNING: You need to set the production DATABASE_URL');
    console.error('Please set PRODUCTION_DATABASE_URL environment variable or update this script');
    console.error('Example: PRODUCTION_DATABASE_URL="postgresql://user:pass@host:5432/dbname" node recover-from-ipfs-fixed.js');
    process.exit(1);
}

// Database connection
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

/**
 * Correct CryptoJS decryption implementation
 */
function decryptCryptoJS(encryptedString, passphrase) {
    // Decode the entire string as base64
    const encryptedData = Buffer.from(encryptedString, 'base64');
    
    // Verify it starts with "Salted__"
    const header = encryptedData.slice(0, 8).toString('utf8');
    if (header !== 'Salted__') {
        throw new Error(`Invalid CryptoJS format. Expected "Salted__", got "${header}"`);
    }
    
    // Extract salt and ciphertext
    const salt = encryptedData.slice(8, 16);
    const ciphertext = encryptedData.slice(16);
    
    // Derive key and IV using MD5 (OpenSSL's EVP_BytesToKey method)
    const keyAndIV = deriveKeyAndIV(passphrase, salt);
    
    // Decrypt using AES-256-CBC
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyAndIV.key, keyAndIV.iv);
    decipher.setAutoPadding(true);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
}

/**
 * OpenSSL's EVP_BytesToKey implementation (used by CryptoJS)
 */
function deriveKeyAndIV(passphrase, salt) {
    const password = Buffer.from(passphrase, 'utf8');
    const keyLen = 32; // AES-256
    const ivLen = 16;  // AES block size
    
    let derivedBytes = Buffer.alloc(0);
    let currentBlock = Buffer.alloc(0);
    
    while (derivedBytes.length < keyLen + ivLen) {
        const hash = crypto.createHash('md5');
        hash.update(currentBlock);
        hash.update(password);
        if (salt) {
            hash.update(salt);
        }
        currentBlock = hash.digest();
        derivedBytes = Buffer.concat([derivedBytes, currentBlock]);
    }
    
    return {
        key: derivedBytes.slice(0, keyLen),
        iv: derivedBytes.slice(keyLen, keyLen + ivLen)
    };
}

/**
 * Download data from IPFS
 */
function downloadFromIPFS(ipfsHash) {
    return new Promise((resolve, reject) => {
        const gateways = [
            'https://gateway.pinata.cloud/ipfs/',
            'https://ipfs.io/ipfs/',
            'https://cloudflare-ipfs.com/ipfs/'
        ];
        
        let attemptIndex = 0;
        
        const tryNextGateway = () => {
            if (attemptIndex >= gateways.length) {
                reject(new Error('Failed to download from all IPFS gateways'));
                return;
            }
            
            const url = gateways[attemptIndex] + ipfsHash;
            console.log(`  Trying: ${url}`);
            attemptIndex++;
            
            https.get(url, (res) => {
                if (res.statusCode !== 200) {
                    console.log(`  Gateway returned ${res.statusCode}, trying next...`);
                    tryNextGateway();
                    return;
                }
                
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    console.log(`  ✅ Downloaded ${data.length} bytes`);
                    resolve(data);
                });
            }).on('error', (err) => {
                console.log(`  Error: ${err.message}, trying next...`);
                tryNextGateway();
            });
        };
        
        tryNextGateway();
    });
}

/**
 * Convert base64 data URL to buffer
 */
function dataURLtoBuffer(dataURL) {
    if (!dataURL || !dataURL.startsWith('data:')) {
        return null;
    }
    
    const parts = dataURL.split(',');
    const base64Data = parts[1];
    return Buffer.from(base64Data, 'base64');
}

/**
 * Recover documents for a single notice
 */
async function recoverNoticeDocuments(notice) {
    const { 
        notice_id, 
        ipfs_hash, 
        encryption_key,
        case_number,
        server_address 
    } = notice;
    
    console.log(`\n📦 Recovering notice ${notice_id} (Case: ${case_number})`);
    console.log(`  IPFS Hash: ${ipfs_hash}`);
    
    try {
        // Download encrypted data from IPFS
        const encryptedData = await downloadFromIPFS(ipfs_hash);
        
        // Check if data starts with expected CryptoJS format
        if (!encryptedData.startsWith('U2FsdGVkX1')) {
            throw new Error('IPFS data is not in CryptoJS format');
        }
        
        console.log(`  🔓 Decrypting with key: ${encryption_key.substring(0, 20)}...`);
        
        // Decrypt the data using the encryption key as passphrase
        const decryptedString = decryptCryptoJS(encryptedData, encryption_key);
        const decryptedData = JSON.parse(decryptedString);
        
        console.log(`  ✅ Decryption successful! Found keys:`, Object.keys(decryptedData));
        
        let thumbnailStored = false;
        let documentStored = false;
        
        // Check for thumbnail data
        if (decryptedData.thumbnail || decryptedData.thumbnailUrl) {
            const thumbnailData = decryptedData.thumbnail || decryptedData.thumbnailUrl;
            const thumbnailBuffer = dataURLtoBuffer(thumbnailData);
            
            if (thumbnailBuffer) {
                await storeDocument(
                    notice_id,
                    'thumbnail',
                    thumbnailBuffer,
                    `thumbnail-${notice_id}.png`,
                    'image/png',
                    server_address || 'recovery'
                );
                thumbnailStored = true;
                console.log(`  ✅ Thumbnail recovered and stored (${thumbnailBuffer.length} bytes)`);
            }
        }
        
        // Check for full document
        if (decryptedData.document || decryptedData.fullDocument || decryptedData.documentUrl) {
            const documentData = decryptedData.document || decryptedData.fullDocument || decryptedData.documentUrl;
            const documentBuffer = dataURLtoBuffer(documentData);
            
            if (documentBuffer) {
                await storeDocument(
                    notice_id,
                    'document',
                    documentBuffer,
                    `document-${notice_id}.png`,
                    'image/png',
                    server_address || 'recovery'
                );
                documentStored = true;
                console.log(`  ✅ Document recovered and stored (${documentBuffer.length} bytes)`);
            }
        }
        
        // Check if we have documents as an array
        if (decryptedData.documents && Array.isArray(decryptedData.documents)) {
            console.log(`  Found ${decryptedData.documents.length} documents in array`);
            for (let i = 0; i < decryptedData.documents.length; i++) {
                const doc = decryptedData.documents[i];
                if (doc.data || doc.url) {
                    const docData = doc.data || doc.url;
                    const docBuffer = dataURLtoBuffer(docData);
                    
                    if (docBuffer) {
                        // Store first as thumbnail, rest as documents
                        const docType = i === 0 && !thumbnailStored ? 'thumbnail' : 'document';
                        await storeDocument(
                            notice_id,
                            docType,
                            docBuffer,
                            doc.name || `${docType}-${notice_id}.png`,
                            doc.type || 'image/png',
                            server_address || 'recovery'
                        );
                        console.log(`  ✅ Document ${i + 1} recovered as ${docType}`);
                        
                        if (docType === 'thumbnail') thumbnailStored = true;
                        else documentStored = true;
                    }
                }
            }
        }
        
        // Update recovery status in database
        await pool.query(`
            UPDATE served_notices 
            SET 
                documents_recovered = true,
                recovery_date = CURRENT_TIMESTAMP,
                recovery_status = $1
            WHERE notice_id = $2
        `, [
            `Recovered: ${thumbnailStored ? 'thumbnail' : ''}${thumbnailStored && documentStored ? ', ' : ''}${documentStored ? 'document' : ''}`,
            notice_id
        ]);
        
        return {
            success: true,
            notice_id,
            thumbnailRecovered: thumbnailStored,
            documentRecovered: documentStored
        };
        
    } catch (error) {
        console.error(`  ❌ Failed: ${error.message}`);
        
        // Update failure status
        await pool.query(`
            UPDATE served_notices 
            SET 
                documents_recovered = false,
                recovery_date = CURRENT_TIMESTAMP,
                recovery_status = $1
            WHERE notice_id = $2
        `, [
            `Failed: ${error.message}`,
            notice_id
        ]);
        
        return {
            success: false,
            notice_id,
            error: error.message
        };
    }
}

/**
 * Main recovery function
 */
async function recoverAllDocuments() {
    console.log('🚀 Starting IPFS Document Recovery with Fixed Decryption\n');
    console.log('Database:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
    console.log('='.repeat(60));
    
    try {
        // Ensure storage table exists
        await createDocumentStorageTable();
        
        // Add recovery tracking columns if they don't exist
        try {
            await pool.query(`
                ALTER TABLE served_notices 
                ADD COLUMN IF NOT EXISTS documents_recovered BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS recovery_date TIMESTAMP,
                ADD COLUMN IF NOT EXISTS recovery_status TEXT;
            `);
        } catch (error) {
            // Columns might already exist
        }
        
        // Find all notices with IPFS hashes and encryption keys
        const query = `
            SELECT DISTINCT
                sn.notice_id,
                sn.ipfs_hash,
                nc.document_encryption_key as encryption_key,
                sn.case_number,
                sn.server_address,
                sn.created_at
            FROM served_notices sn
            LEFT JOIN notice_components nc ON nc.notice_id = sn.notice_id
            WHERE 
                sn.ipfs_hash IS NOT NULL 
                AND sn.ipfs_hash != ''
                AND nc.document_encryption_key IS NOT NULL
                AND (sn.documents_recovered IS NULL OR sn.documents_recovered = false)
            ORDER BY sn.created_at DESC
            LIMIT 10;
        `;
        
        const result = await pool.query(query);
        const notices = result.rows;
        
        console.log(`\nFound ${notices.length} notices to recover\n`);
        
        if (notices.length === 0) {
            console.log('No notices need recovery');
            return;
        }
        
        // Process each notice
        const results = {
            total: notices.length,
            successful: 0,
            failed: 0,
            results: []
        };
        
        for (const notice of notices) {
            const result = await recoverNoticeDocuments(notice);
            results.results.push(result);
            
            if (result.success) {
                results.successful++;
            } else {
                results.failed++;
            }
            
            // Small delay to avoid overwhelming IPFS gateways
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('RECOVERY COMPLETE');
        console.log('='.repeat(60));
        console.log(`Total notices processed: ${results.total}`);
        console.log(`✅ Successfully recovered: ${results.successful}`);
        console.log(`❌ Failed to recover: ${results.failed}`);
        console.log(`Success rate: ${((results.successful / results.total) * 100).toFixed(1)}%`);
        
        // Show failed notices for manual review
        if (results.failed > 0) {
            console.log('\nFailed notices:');
            results.results
                .filter(r => !r.success)
                .forEach(r => {
                    console.log(`  - ${r.notice_id}: ${r.error}`);
                });
        }
        
        return results;
        
    } catch (error) {
        console.error('Fatal error:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run if executed directly
if (require.main === module) {
    recoverAllDocuments()
        .then(results => {
            if (results) {
                process.exit(results.failed === 0 ? 0 : 1);
            }
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { recoverAllDocuments, recoverNoticeDocuments };