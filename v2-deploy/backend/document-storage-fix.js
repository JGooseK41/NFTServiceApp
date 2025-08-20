/**
 * Document Storage Fix for Render Deployment
 * 
 * PROBLEM: Render's ephemeral filesystem loses uploaded files on each deployment
 * SOLUTION: Store documents in PostgreSQL database as base64 or use external storage
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Migration to add document storage table
 */
async function createDocumentStorageTable() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS document_storage (
            id SERIAL PRIMARY KEY,
            notice_id VARCHAR(255) NOT NULL,
            document_type VARCHAR(50) NOT NULL, -- 'thumbnail' or 'document'
            file_name VARCHAR(255),
            mime_type VARCHAR(100),
            file_data TEXT NOT NULL, -- Base64 encoded file data
            file_size INTEGER,
            uploaded_by VARCHAR(255),
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata JSONB,
            UNIQUE(notice_id, document_type)
        );

        CREATE INDEX IF NOT EXISTS idx_document_storage_notice_id ON document_storage(notice_id);
        CREATE INDEX IF NOT EXISTS idx_document_storage_uploaded_at ON document_storage(uploaded_at);
    `;

    try {
        await pool.query(createTableQuery);
        console.log('✅ Document storage table created/verified');
        
        // Add migration status tracking
        await pool.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        await pool.query(`
            INSERT INTO migrations (name) 
            VALUES ('document_storage_table') 
            ON CONFLICT (name) DO NOTHING;
        `);
        
        return true;
    } catch (error) {
        console.error('Error creating document storage table:', error);
        return false;
    }
}

/**
 * Store document in database
 */
async function storeDocument(noticeId, documentType, fileBuffer, fileName, mimeType, uploadedBy) {
    try {
        // Convert buffer to base64
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
                uploaded_at = CURRENT_TIMESTAMP
            RETURNING id, uploaded_at;
        `;
        
        const result = await pool.query(query, [
            noticeId,
            documentType,
            fileName,
            mimeType,
            base64Data,
            fileSize,
            uploadedBy
        ]);
        
        console.log(`✅ Stored ${documentType} for notice ${noticeId} in database (${fileSize} bytes)`);
        return result.rows[0];
    } catch (error) {
        console.error('Error storing document:', error);
        throw error;
    }
}

/**
 * Retrieve document from database
 */
async function getDocument(noticeId, documentType) {
    try {
        const query = `
            SELECT file_name, mime_type, file_data, file_size, uploaded_at
            FROM document_storage
            WHERE notice_id = $1 AND document_type = $2;
        `;
        
        const result = await pool.query(query, [noticeId, documentType]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const doc = result.rows[0];
        // Convert base64 back to buffer
        const buffer = Buffer.from(doc.file_data, 'base64');
        
        return {
            fileName: doc.file_name,
            mimeType: doc.mime_type,
            buffer: buffer,
            size: doc.file_size,
            uploadedAt: doc.uploaded_at
        };
    } catch (error) {
        console.error('Error retrieving document:', error);
        throw error;
    }
}

/**
 * Migrate existing files to database (if any still exist)
 */
async function migrateExistingFiles() {
    const uploadsDir = path.join(__dirname, 'uploads', 'documents');
    
    try {
        const files = await fs.readdir(uploadsDir);
        let migrated = 0;
        
        for (const file of files) {
            try {
                const filePath = path.join(uploadsDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.isFile()) {
                    const fileBuffer = await fs.readFile(filePath);
                    
                    // Extract notice ID from filename
                    // Format: thumbnail-{timestamp}-{hash}.png or document-{timestamp}-{hash}.png
                    const parts = file.split('-');
                    const documentType = parts[0]; // 'thumbnail' or 'document'
                    const timestamp = parts[1];
                    
                    if (documentType === 'thumbnail' || documentType === 'document') {
                        // Use timestamp as a temporary notice ID
                        await storeDocument(
                            timestamp,
                            documentType,
                            fileBuffer,
                            file,
                            'image/png',
                            'migration'
                        );
                        migrated++;
                        console.log(`Migrated ${file} to database`);
                    }
                }
            } catch (error) {
                console.error(`Error migrating file ${file}:`, error);
            }
        }
        
        console.log(`✅ Migrated ${migrated} files to database`);
    } catch (error) {
        console.log('No existing files to migrate or uploads directory not found');
    }
}

/**
 * Clean up old documents (optional, for storage management)
 */
async function cleanupOldDocuments(daysToKeep = 90) {
    try {
        const query = `
            DELETE FROM document_storage
            WHERE uploaded_at < NOW() - INTERVAL '${daysToKeep} days'
            RETURNING id, notice_id;
        `;
        
        const result = await pool.query(query);
        console.log(`Cleaned up ${result.rowCount} old documents`);
        return result.rowCount;
    } catch (error) {
        console.error('Error cleaning up old documents:', error);
        return 0;
    }
}

/**
 * Get storage statistics
 */
async function getStorageStats() {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_documents,
                SUM(file_size) as total_size_bytes,
                AVG(file_size) as avg_size_bytes,
                MAX(uploaded_at) as last_upload,
                MIN(uploaded_at) as first_upload
            FROM document_storage;
        `;
        
        const result = await pool.query(query);
        return result.rows[0];
    } catch (error) {
        console.error('Error getting storage stats:', error);
        return null;
    }
}

// Export functions
module.exports = {
    createDocumentStorageTable,
    storeDocument,
    getDocument,
    migrateExistingFiles,
    cleanupOldDocuments,
    getStorageStats
};

// Run migration if this file is executed directly
if (require.main === module) {
    (async () => {
        console.log('🚀 Starting document storage migration...');
        
        // Create table
        await createDocumentStorageTable();
        
        // Migrate any existing files
        await migrateExistingFiles();
        
        // Show stats
        const stats = await getStorageStats();
        console.log('📊 Storage statistics:', stats);
        
        console.log('✅ Migration complete!');
        process.exit(0);
    })();
}