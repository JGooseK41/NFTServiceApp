/**
 * Simple IPFS Recovery - For Unencrypted Data URLs
 * Run this on Render to recover documents that are stored as plain data URLs
 */

const { Pool } = require('pg');
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
        console.log('✅ Document storage table ready');
    } catch (error) {
        console.error('Error creating table:', error.message);
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
            uploaded_by = EXCLUDED.uploaded_by,
            updated_at = CURRENT_TIMESTAMP
        RETURNING id;
    `;
    
    const values = [noticeId, documentType, fileName, mimeType, base64Data, fileSize, uploadedBy];
    const result = await pool.query(query, values);
    return result.rows[0].id;
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
    if (parts.length !== 2) {
        return null;
    }
    
    // Extract mime type from data URL
    const mimeMatch = parts[0].match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    
    const base64Data = parts[1];
    return {
        buffer: Buffer.from(base64Data, 'base64'),
        mimeType: mimeType
    };
}

async function recoverNotice(notice) {
    const { notice_id, ipfs_hash, case_number } = notice;
    
    console.log(`\nRecovering ${notice_id} (${case_number})`);
    
    try {
        const ipfsData = await downloadFromIPFS(ipfs_hash);
        
        let recovered = [];
        
        // Check what type of data we have
        if (ipfsData.startsWith('data:image')) {
            // Direct data URL - store it as the document
            console.log(`  ℹ️ Found direct image data URL`);
            
            const extracted = dataURLtoBuffer(ipfsData);
            if (extracted) {
                // Store as both thumbnail and document for compatibility
                await storeDocument(
                    notice_id,
                    'thumbnail',
                    extracted.buffer,
                    `thumbnail-${notice_id}.png`,
                    extracted.mimeType,
                    'ipfs-recovery'
                );
                recovered.push('thumbnail');
                
                await storeDocument(
                    notice_id,
                    'document',
                    extracted.buffer,
                    `document-${notice_id}.png`,
                    extracted.mimeType,
                    'ipfs-recovery'
                );
                recovered.push('document');
                
                console.log(`  ✅ Stored as both thumbnail and document (${extracted.buffer.length} bytes)`);
            }
        } else {
            // Try to parse as JSON
            try {
                const data = JSON.parse(ipfsData);
                console.log(`  ℹ️ Found JSON data with keys:`, Object.keys(data));
                
                // Check for thumbnail
                if (data.thumbnail || data.thumbnailUrl) {
                    const thumbnailData = data.thumbnail || data.thumbnailUrl;
                    const extracted = dataURLtoBuffer(thumbnailData);
                    
                    if (extracted) {
                        await storeDocument(
                            notice_id,
                            'thumbnail',
                            extracted.buffer,
                            `thumbnail-${notice_id}.png`,
                            extracted.mimeType,
                            'ipfs-recovery'
                        );
                        recovered.push('thumbnail');
                        console.log(`  ✅ Thumbnail stored (${extracted.buffer.length} bytes)`);
                    }
                }
                
                // Check for document
                if (data.document || data.fullDocument || data.documentUrl) {
                    const documentData = data.document || data.fullDocument || data.documentUrl;
                    const extracted = dataURLtoBuffer(documentData);
                    
                    if (extracted) {
                        await storeDocument(
                            notice_id,
                            'document',
                            extracted.buffer,
                            `document-${notice_id}.png`,
                            extracted.mimeType,
                            'ipfs-recovery'
                        );
                        recovered.push('document');
                        console.log(`  ✅ Document stored (${extracted.buffer.length} bytes)`);
                    }
                }
            } catch (e) {
                console.log(`  ⚠️ Data is not JSON, might be encrypted (skipping)`);
                throw new Error('Data format not supported - might need decryption');
            }
        }
        
        if (recovered.length > 0) {
            // Mark as recovered
            await pool.query(`
                UPDATE served_notices 
                SET 
                    documents_recovered = true,
                    recovery_date = CURRENT_TIMESTAMP,
                    recovery_status = $1
                WHERE notice_id = $2
            `, [`Recovered: ${recovered.join(', ')}`, notice_id]);
            
            return { success: true, notice_id, recovered };
        } else {
            throw new Error('No documents found to recover');
        }
        
    } catch (error) {
        console.error(`  ❌ Failed: ${error.message}`);
        
        // Mark as failed
        await pool.query(`
            UPDATE served_notices 
            SET 
                documents_recovered = false,
                recovery_date = CURRENT_TIMESTAMP,
                recovery_status = $1
            WHERE notice_id = $2
        `, [`Failed: ${error.message}`, notice_id]);
        
        return { success: false, notice_id, error: error.message };
    }
}

async function main() {
    console.log('🚀 Simple IPFS Document Recovery (Unencrypted Data)\n');
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
        
        // Find notices to recover - don't require encryption key for unencrypted data
        const query = `
            SELECT DISTINCT
                sn.notice_id,
                sn.ipfs_hash,
                sn.case_number,
                sn.created_at
            FROM served_notices sn
            WHERE 
                sn.ipfs_hash IS NOT NULL 
                AND sn.ipfs_hash != ''
                AND (sn.documents_recovered IS NULL OR sn.documents_recovered = false)
            ORDER BY sn.created_at DESC
            LIMIT 50;
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
            } else {
                failed++;
            }
            
            // Small delay to avoid overwhelming IPFS
            await new Promise(r => setTimeout(r, 500));
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('RECOVERY COMPLETE');
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        
        // Show some statistics
        const stats = await pool.query(`
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN documents_recovered = true THEN 1 END) as recovered
            FROM served_notices
            WHERE ipfs_hash IS NOT NULL AND ipfs_hash != '';
        `);
        
        console.log(`\n📊 Overall Statistics:`);
        console.log(`Total notices with IPFS: ${stats.rows[0].total}`);
        console.log(`Successfully recovered: ${stats.rows[0].recovered}`);
        
    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        await pool.end();
    }
}

main();