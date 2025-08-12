/**
 * Recovery Script: Restore Documents from IPFS
 * 
 * This script recovers lost documents by:
 * 1. Finding all notices with IPFS hashes and decryption keys
 * 2. Downloading the encrypted data from IPFS
 * 3. Decrypting the documents
 * 4. Storing them in the persistent database storage
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const { storeDocument, createDocumentStorageTable } = require('./document-storage-fix');

// Use built-in fetch if available (Node 18+), otherwise try to use node-fetch
let fetch;
if (typeof globalThis.fetch !== 'undefined') {
    fetch = globalThis.fetch;
} else {
    try {
        fetch = require('node-fetch');
    } catch (error) {
        console.error('Warning: node-fetch not installed. Using https module as fallback.');
        const https = require('https');
        
        // Simple fetch polyfill for HTTPS GET requests
        fetch = function(url, options = {}) {
            return new Promise((resolve, reject) => {
                https.get(url, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        resolve({
                            ok: res.statusCode >= 200 && res.statusCode < 300,
                            status: res.statusCode,
                            text: () => Promise.resolve(data),
                            json: () => Promise.resolve(JSON.parse(data))
                        });
                    });
                }).on('error', reject);
            });
        };
    }
}

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// IPFS gateways to try (in order of preference)
const IPFS_GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.ipfs.io/ipfs/',
    'https://4everland.io/ipfs/'
];

/**
 * Decrypt data using AES-256-GCM
 */
function decryptData(encryptedData, key) {
    try {
        // Parse the encrypted data
        const data = JSON.parse(encryptedData);
        
        // Extract components
        const iv = Buffer.from(data.iv, 'hex');
        const authTag = Buffer.from(data.authTag, 'hex');
        const encrypted = Buffer.from(data.encryptedData, 'hex');
        
        // Create decipher
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
        decipher.setAuthTag(authTag);
        
        // Decrypt
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        // Parse the decrypted JSON
        return JSON.parse(decrypted.toString());
    } catch (error) {
        console.error('Decryption error:', error);
        
        // Try alternative decryption method (if data was encrypted differently)
        try {
            const encrypted = Buffer.from(encryptedData, 'base64');
            const keyBuffer = Buffer.from(key, 'hex');
            const iv = encrypted.slice(0, 16);
            const authTag = encrypted.slice(16, 32);
            const ciphertext = encrypted.slice(32);
            
            const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(ciphertext);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            
            return JSON.parse(decrypted.toString());
        } catch (altError) {
            console.error('Alternative decryption also failed:', altError);
            throw error;
        }
    }
}

/**
 * Download data from IPFS
 */
async function downloadFromIPFS(ipfsHash) {
    console.log(`Downloading from IPFS: ${ipfsHash}`);
    
    for (const gateway of IPFS_GATEWAYS) {
        try {
            const url = `${gateway}${ipfsHash}`;
            console.log(`Trying gateway: ${url}`);
            
            const response = await fetch(url, {
                timeout: 30000 // 30 second timeout
            });
            
            if (response.ok) {
                const data = await response.text();
                console.log(`✅ Successfully downloaded from ${gateway}`);
                return data;
            }
        } catch (error) {
            console.log(`Failed with ${gateway}:`, error.message);
        }
    }
    
    throw new Error(`Failed to download ${ipfsHash} from any IPFS gateway`);
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
        server_address,
        recipient_address 
    } = notice;
    
    console.log(`\nRecovering documents for notice ${notice_id}...`);
    
    try {
        // Download encrypted data from IPFS
        const encryptedData = await downloadFromIPFS(ipfs_hash);
        
        // Decrypt the data
        const decryptedData = decryptData(encryptedData, encryption_key);
        
        let thumbnailStored = false;
        let documentStored = false;
        
        // Check what data we have
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
                console.log(`  ✅ Thumbnail recovered and stored`);
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
                console.log(`  ✅ Document recovered and stored`);
            }
        }
        
        // Check if we have documents as an array
        if (decryptedData.documents && Array.isArray(decryptedData.documents)) {
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
        console.error(`  ❌ Failed to recover notice ${notice_id}:`, error.message);
        
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
    console.log('🚀 Starting IPFS document recovery...\n');
    
    // Ensure storage table exists
    await createDocumentStorageTable();
    
    // Add recovery tracking columns if they don't exist
    try {
        await pool.query(`
            ALTER TABLE served_notices 
            ADD COLUMN IF NOT EXISTS documents_recovered BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS recovery_date TIMESTAMP,
            ADD COLUMN IF NOT EXISTS recovery_status TEXT,
            ADD COLUMN IF NOT EXISTS encryption_key TEXT;
        `);
    } catch (error) {
        console.log('Recovery columns may already exist');
    }
    
    // Find all notices with IPFS hashes and get encryption keys from notice_components
    const query = `
        SELECT DISTINCT
            sn.notice_id,
            sn.ipfs_hash,
            nc.document_encryption_key as encryption_key,
            sn.case_number,
            sn.server_address,
            sn.recipient_address,
            sn.created_at
        FROM served_notices sn
        LEFT JOIN notice_components nc ON nc.notice_id = sn.notice_id
        WHERE 
            sn.ipfs_hash IS NOT NULL 
            AND sn.ipfs_hash != ''
            AND nc.document_encryption_key IS NOT NULL
            AND (sn.documents_recovered IS NULL OR sn.documents_recovered = false)
        ORDER BY sn.created_at DESC;
    `;
    
    const result = await pool.query(query);
    const notices = result.rows;
    
    console.log(`Found ${notices.length} notices with IPFS data to recover\n`);
    
    if (notices.length === 0) {
        console.log('No notices to recover');
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
        
        // Add a small delay to avoid overwhelming IPFS gateways
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('RECOVERY COMPLETE');
    console.log('='.repeat(50));
    console.log(`Total notices processed: ${results.total}`);
    console.log(`Successfully recovered: ${results.successful}`);
    console.log(`Failed to recover: ${results.failed}`);
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
}

/**
 * Recover a specific notice by ID
 */
async function recoverSingleNotice(noticeId) {
    const query = `
        SELECT DISTINCT
            sn.notice_id,
            sn.ipfs_hash,
            nc.document_encryption_key as encryption_key,
            sn.case_number,
            sn.server_address,
            sn.recipient_address,
            sn.created_at
        FROM served_notices sn
        LEFT JOIN notice_components nc ON nc.notice_id = sn.notice_id
        WHERE sn.notice_id = $1
        AND nc.document_encryption_key IS NOT NULL;
    `;
    
    const result = await pool.query(query, [noticeId]);
    
    if (result.rows.length === 0) {
        console.log(`Notice ${noticeId} not found`);
        return null;
    }
    
    return await recoverNoticeDocuments(result.rows[0]);
}

// Export functions
module.exports = {
    recoverAllDocuments,
    recoverSingleNotice,
    recoverNoticeDocuments
};

// Run if executed directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args[0] === '--single' && args[1]) {
        // Recover single notice
        recoverSingleNotice(args[1])
            .then(result => {
                console.log('Result:', result);
                process.exit(result?.success ? 0 : 1);
            })
            .catch(error => {
                console.error('Error:', error);
                process.exit(1);
            });
    } else {
        // Recover all notices
        recoverAllDocuments()
            .then(results => {
                process.exit(results.failed === 0 ? 0 : 1);
            })
            .catch(error => {
                console.error('Fatal error:', error);
                process.exit(1);
            });
    }
}