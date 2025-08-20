/**
 * IPFS Recovery Script for Render Production
 * Run this directly on Render using the Shell tab
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const https = require('https');

// Use Render's DATABASE_URL directly
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL not found. This script must be run on Render.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Document storage functions
async function createDocumentStorageTable() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS document_storage (
            id SERIAL PRIMARY KEY,
            notice_id VARCHAR(255) NOT NULL,
            document_type VARCHAR(50) NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            file_data TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            uploaded_by VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(notice_id, document_type)
        );
    `;
    
    try {
        await pool.query(createTableQuery);
        
        // Add updated_at column if it doesn't exist
        await pool.query(`
            ALTER TABLE document_storage 
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `);
        
        console.log('✅ Document storage table ready');
    } catch (error) {
        console.error('Error creating/updating table:', error.message);
    }
}

async function storeDocument(noticeId, documentType, fileBuffer, fileName, mimeType, uploadedBy) {
    const base64Data = fileBuffer.toString('base64');
    const fileSize = fileBuffer.length;
    
    const query = `
        INSERT INTO document_storage 
        (notice_id, document_type, file_name, mime_type, file_data, file_size, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (notice_id, document_type) 
        DO UPDATE SET 
            file_name = EXCLUDED.file_name,
            mime_type = EXCLUDED.mime_type,
            file_data = EXCLUDED.file_data,
            file_size = EXCLUDED.file_size,
            uploaded_by = EXCLUDED.uploaded_by
        RETURNING id;
    `;
    
    const values = [noticeId, documentType, fileName, mimeType, base64Data, fileSize, uploadedBy];
    const result = await pool.query(query, values);
    return result.rows[0].id;
}

// Decryption functions - FIXED VERSION
function decryptCryptoJS(encryptedString, passphrase) {
    // The entire string IS the base64 encoded data (not substring(10))
    const encryptedData = Buffer.from(encryptedString, 'base64');
    
    const header = encryptedData.slice(0, 8).toString('utf8');
    if (header !== 'Salted__') {
        throw new Error(`Invalid CryptoJS format. Expected "Salted__", got "${header}"`);
    }
    
    const salt = encryptedData.slice(8, 16);
    const ciphertext = encryptedData.slice(16);
    
    const keyAndIV = deriveKeyAndIV(passphrase, salt);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyAndIV.key, keyAndIV.iv);
    decipher.setAutoPadding(true);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
}

function deriveKeyAndIV(passphrase, salt) {
    const password = Buffer.from(passphrase, 'utf8');
    const keyLen = 32;
    const ivLen = 16;
    
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

function downloadFromIPFS(ipfsHash) {
    return new Promise((resolve, reject) => {
        const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        console.log(`  Downloading from: ${url}`);
        
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`  ✅ Downloaded ${data.length} bytes`);
                resolve(data);
            });
        }).on('error', reject);
    });
}

function dataURLtoBuffer(dataURL) {
    if (!dataURL || !dataURL.startsWith('data:')) {
        return null;
    }
    
    const parts = dataURL.split(',');
    const base64Data = parts[1];
    return Buffer.from(base64Data, 'base64');
}

async function recoverNotice(notice) {
    const { notice_id, ipfs_hash, encryption_key, case_number } = notice;
    
    console.log(`\nRecovering ${notice_id} (${case_number})`);
    
    try {
        const ipfsData = await downloadFromIPFS(ipfs_hash);
        
        let data;
        
        // Check if data is encrypted (CryptoJS format) or plain
        if (ipfsData.startsWith('U2FsdGVkX1')) {
            // Encrypted data - decrypt it
            const decryptedString = decryptCryptoJS(ipfsData, encryption_key);
            console.log(`  ✅ Decrypted successfully`);
            
            // The decrypted data might be JSON or a direct data URL
            if (decryptedString.startsWith('data:image')) {
                // Direct data URL after decryption
                console.log(`  ℹ️ Decrypted to direct data URL`);
                data = { document: decryptedString };
            } else {
                // Try to parse as JSON
                try {
                    data = JSON.parse(decryptedString);
                    console.log(`  ℹ️ Decrypted to JSON with keys:`, Object.keys(data));
                } catch (e) {
                    // If not JSON, treat as document data
                    console.log(`  ℹ️ Decrypted data is not JSON, treating as document`);
                    data = { document: decryptedString };
                }
            }
        } else if (ipfsData.startsWith('data:image')) {
            // Direct data URL - not encrypted, just use as-is
            console.log(`  ℹ️ Data is not encrypted (direct data URL)`);
            // If it's a direct image, treat it as the document
            data = { document: ipfsData };
        } else {
            // Try to parse as JSON (might be unencrypted JSON)
            try {
                data = JSON.parse(ipfsData);
                console.log(`  ℹ️ Data is unencrypted JSON`);
            } catch (e) {
                throw new Error(`Unknown data format (not encrypted, not JSON, not data URL)`);
            }
        }
        
        let recovered = [];
        
        // Store thumbnail
        if (data.thumbnail || data.thumbnailUrl) {
            const thumbnailData = data.thumbnail || data.thumbnailUrl;
            const buffer = dataURLtoBuffer(thumbnailData);
            
            if (buffer) {
                await storeDocument(
                    notice_id,
                    'thumbnail',
                    buffer,
                    `thumbnail-${notice_id}.png`,
                    'image/png',
                    'recovery'
                );
                recovered.push('thumbnail');
                console.log(`  ✅ Thumbnail stored (${buffer.length} bytes)`);
            }
        }
        
        // Store document
        if (data.document || data.fullDocument || data.documentUrl) {
            const documentData = data.document || data.fullDocument || data.documentUrl;
            const buffer = dataURLtoBuffer(documentData);
            
            if (buffer) {
                await storeDocument(
                    notice_id,
                    'document',
                    buffer,
                    `document-${notice_id}.png`,
                    'image/png',
                    'recovery'
                );
                recovered.push('document');
                console.log(`  ✅ Document stored (${buffer.length} bytes)`);
            }
        }
        
        return { success: true, notice_id, recovered };
        
    } catch (error) {
        console.error(`  ❌ Failed: ${error.message}`);
        return { success: false, notice_id, error: error.message };
    }
}

async function main() {
    console.log('🚀 IPFS Document Recovery on Render\n');
    console.log('=' .repeat(50));
    
    try {
        // Create storage table
        await createDocumentStorageTable();
        
        // Add recovery columns
        try {
            await pool.query(`
                ALTER TABLE served_notices 
                ADD COLUMN IF NOT EXISTS documents_recovered BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS recovery_date TIMESTAMP,
                ADD COLUMN IF NOT EXISTS recovery_status TEXT;
            `);
        } catch (e) {
            // Columns might exist
        }
        
        // Find notices to recover
        const query = `
            SELECT DISTINCT
                sn.notice_id,
                sn.ipfs_hash,
                nc.document_encryption_key as encryption_key,
                sn.case_number,
                sn.created_at
            FROM served_notices sn
            LEFT JOIN notice_components nc ON nc.notice_id = sn.notice_id
            WHERE 
                sn.ipfs_hash IS NOT NULL 
                AND sn.ipfs_hash != ''
                AND nc.document_encryption_key IS NOT NULL
                AND (sn.documents_recovered IS NULL OR sn.documents_recovered = false)
            ORDER BY sn.created_at DESC
            LIMIT 20;
        `;
        
        const result = await pool.query(query);
        const notices = result.rows;
        
        console.log(`Found ${notices.length} notices to recover\n`);
        
        if (notices.length === 0) {
            console.log('No notices need recovery');
            return;
        }
        
        let successful = 0;
        let failed = 0;
        
        for (const notice of notices) {
            const result = await recoverNotice(notice);
            
            if (result.success) {
                successful++;
                
                // Mark as recovered
                await pool.query(`
                    UPDATE served_notices 
                    SET 
                        documents_recovered = true,
                        recovery_date = CURRENT_TIMESTAMP,
                        recovery_status = $1
                    WHERE notice_id = $2
                `, [`Recovered: ${result.recovered.join(', ')}`, result.notice_id]);
            } else {
                failed++;
                
                // Mark as failed
                await pool.query(`
                    UPDATE served_notices 
                    SET 
                        documents_recovered = false,
                        recovery_date = CURRENT_TIMESTAMP,
                        recovery_status = $1
                    WHERE notice_id = $2
                `, [`Failed: ${result.error}`, result.notice_id]);
            }
            
            // Small delay
            await new Promise(r => setTimeout(r, 1000));
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('RECOVERY COMPLETE');
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        
    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        await pool.end();
    }
}

main();