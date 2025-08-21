/**
 * Encrypted Disk Storage Handler
 * Stores documents encrypted on disk with efficient retrieval
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;

class EncryptedStorage {
    constructor(pool, basePath = process.env.DISK_MOUNT_PATH || '/var/data') {
        this.pool = pool;
        this.basePath = basePath;
        this.uploadsPath = path.join(basePath, 'encrypted-documents');
    }

    /**
     * Generate encryption key from password/seed
     */
    generateKey(seed = null) {
        if (!seed) {
            // Generate random key for new documents
            return crypto.randomBytes(KEY_LENGTH);
        }
        // Derive key from seed for consistent decryption
        return crypto.scryptSync(seed, 'legal-notice-salt', KEY_LENGTH);
    }

    /**
     * Encrypt document data
     */
    encryptDocument(buffer, key = null) {
        // Generate or use provided key
        const encryptionKey = key || this.generateKey();
        
        // Generate random IV
        const iv = crypto.randomBytes(IV_LENGTH);
        
        // Create cipher
        const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
        
        // Encrypt data
        const encrypted = Buffer.concat([
            cipher.update(buffer),
            cipher.final()
        ]);
        
        // Get auth tag
        const authTag = cipher.getAuthTag();
        
        // Combine IV + authTag + encrypted data
        const combined = Buffer.concat([iv, authTag, encrypted]);
        
        return {
            encryptedData: combined,
            key: encryptionKey.toString('hex'),
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }

    /**
     * Decrypt document data
     */
    decryptDocument(encryptedBuffer, keyHex) {
        // Extract components
        const iv = encryptedBuffer.slice(0, IV_LENGTH);
        const authTag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
        const encrypted = encryptedBuffer.slice(IV_LENGTH + TAG_LENGTH);
        
        // Convert key from hex
        const key = Buffer.from(keyHex, 'hex');
        
        // Create decipher
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        
        // Decrypt data
        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);
        
        return decrypted;
    }

    /**
     * Store encrypted document to disk and database
     */
    async storeEncryptedDocument(fileBuffer, metadata) {
        try {
            // Ensure directory exists
            await fs.mkdir(this.uploadsPath, { recursive: true });
            
            // Encrypt the document
            const { encryptedData, key, iv, authTag } = this.encryptDocument(fileBuffer);
            
            // Generate unique filename
            const documentId = `doc_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
            const filename = `${documentId}.enc`;
            const filepath = path.join(this.uploadsPath, filename);
            
            // Write encrypted file to disk
            await fs.writeFile(filepath, encryptedData);
            
            // Store metadata and encryption info in database
            const query = `
                INSERT INTO encrypted_documents (
                    document_id,
                    notice_id,
                    case_number,
                    server_address,
                    recipient_address,
                    file_path,
                    file_size,
                    encryption_key,
                    encryption_iv,
                    auth_tag,
                    original_name,
                    mime_type,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                RETURNING *
            `;
            
            const values = [
                documentId,
                metadata.noticeId,
                metadata.caseNumber,
                metadata.serverAddress,
                metadata.recipientAddress,
                filepath,
                encryptedData.length,
                key,  // Store encrypted - in production, encrypt this with master key
                iv,
                authTag,
                metadata.originalName,
                metadata.mimeType || 'application/pdf'
            ];
            
            const result = await this.pool.query(query, values);
            
            return {
                success: true,
                documentId,
                filepath,
                size: encryptedData.length,
                encrypted: true,
                url: `/api/documents/encrypted/${documentId}`
            };
            
        } catch (error) {
            console.error('Failed to store encrypted document:', error);
            throw error;
        }
    }

    /**
     * Retrieve and decrypt document for authorized user
     */
    async retrieveDocument(documentId, requestingAddress) {
        try {
            // Get document metadata from database
            const query = `
                SELECT * FROM encrypted_documents 
                WHERE document_id = $1
            `;
            
            const result = await this.pool.query(query, [documentId]);
            
            if (result.rows.length === 0) {
                throw new Error('Document not found');
            }
            
            const doc = result.rows[0];
            
            // Check authorization (server or recipient can access)
            const isAuthorized = 
                requestingAddress === doc.server_address ||
                requestingAddress === doc.recipient_address ||
                await this.isAdmin(requestingAddress);
            
            if (!isAuthorized) {
                throw new Error('Unauthorized access');
            }
            
            // Read encrypted file
            const encryptedData = await fs.readFile(doc.file_path);
            
            // Decrypt document
            const decryptedData = this.decryptDocument(encryptedData, doc.encryption_key);
            
            // Log access
            await this.logAccess(documentId, requestingAddress);
            
            return {
                data: decryptedData,
                mimeType: doc.mime_type,
                filename: doc.original_name,
                metadata: {
                    caseNumber: doc.case_number,
                    noticeId: doc.notice_id,
                    createdAt: doc.created_at
                }
            };
            
        } catch (error) {
            console.error('Failed to retrieve document:', error);
            throw error;
        }
    }

    /**
     * Quick metadata check without decryption
     */
    async getDocumentMetadata(documentId) {
        const query = `
            SELECT 
                document_id,
                notice_id,
                case_number,
                file_size,
                original_name,
                created_at,
                last_accessed
            FROM encrypted_documents 
            WHERE document_id = $1
        `;
        
        const result = await this.pool.query(query, [documentId]);
        return result.rows[0] || null;
    }

    /**
     * Check if address is admin
     */
    async isAdmin(address) {
        // Check if address is in admin table or has admin role
        const query = `
            SELECT COUNT(*) as is_admin 
            FROM process_servers 
            WHERE wallet_address = $1 AND status = 'approved'
        `;
        
        const result = await this.pool.query(query, [address]);
        return result.rows[0]?.is_admin > 0;
    }

    /**
     * Log document access
     */
    async logAccess(documentId, accessedBy) {
        const query = `
            INSERT INTO document_access_log (
                document_id,
                accessed_by,
                accessed_at
            ) VALUES ($1, $2, NOW())
        `;
        
        await this.pool.query(query, [documentId, accessedBy]).catch(err => {
            console.warn('Could not log document access:', err.message);
        });
        
        // Update last accessed timestamp
        await this.pool.query(
            'UPDATE encrypted_documents SET last_accessed = NOW() WHERE document_id = $1',
            [documentId]
        ).catch(err => {
            console.warn('Could not update last accessed:', err.message);
        });
    }

    /**
     * Create database tables if they don't exist
     */
    async createTables() {
        try {
            // Encrypted documents table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS encrypted_documents (
                    document_id VARCHAR(255) PRIMARY KEY,
                    notice_id VARCHAR(255),
                    case_number VARCHAR(255),
                    server_address VARCHAR(255),
                    recipient_address VARCHAR(255),
                    file_path TEXT NOT NULL,
                    file_size BIGINT,
                    encryption_key TEXT NOT NULL,
                    encryption_iv VARCHAR(255),
                    auth_tag VARCHAR(255),
                    original_name VARCHAR(255),
                    mime_type VARCHAR(100),
                    created_at TIMESTAMP DEFAULT NOW(),
                    last_accessed TIMESTAMP,
                    INDEX idx_notice (notice_id),
                    INDEX idx_case (case_number),
                    INDEX idx_server (server_address),
                    INDEX idx_recipient (recipient_address)
                )
            `);

            // Access log table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS document_access_log (
                    id SERIAL PRIMARY KEY,
                    document_id VARCHAR(255),
                    accessed_by VARCHAR(255),
                    accessed_at TIMESTAMP DEFAULT NOW(),
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    INDEX idx_document (document_id),
                    INDEX idx_accessor (accessed_by)
                )
            `);

            console.log('✅ Encrypted storage tables ready');
        } catch (error) {
            console.warn('Could not create tables (may already exist):', error.message);
        }
    }
}

// Express route handlers
function setupEncryptedStorageRoutes(app, pool) {
    const storage = new EncryptedStorage(pool);
    
    // Initialize tables
    storage.createTables();
    
    // Multer for file uploads
    const upload = multer({ 
        storage: multer.memoryStorage(),
        limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
    });
    
    // Upload and encrypt document
    app.post('/api/documents/upload-encrypted', upload.single('document'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file provided' });
            }
            
            const metadata = {
                noticeId: req.body.noticeId,
                caseNumber: req.body.caseNumber,
                serverAddress: req.body.serverAddress || req.headers['x-server-address'],
                recipientAddress: req.body.recipientAddress,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype
            };
            
            const result = await storage.storeEncryptedDocument(req.file.buffer, metadata);
            
            res.json(result);
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    // Retrieve and decrypt document
    app.get('/api/documents/encrypted/:documentId', async (req, res) => {
        try {
            const { documentId } = req.params;
            const requestingAddress = req.headers['x-wallet-address'] || 
                                    req.headers['x-server-address'] ||
                                    req.query.address;
            
            if (!requestingAddress) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            
            const document = await storage.retrieveDocument(documentId, requestingAddress);
            
            // Set appropriate headers
            res.setHeader('Content-Type', document.mimeType);
            res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`);
            
            // Send decrypted document
            res.send(document.data);
            
        } catch (error) {
            console.error('Retrieval error:', error);
            if (error.message === 'Unauthorized access') {
                res.status(403).json({ error: 'Access denied' });
            } else if (error.message === 'Document not found') {
                res.status(404).json({ error: 'Document not found' });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    });
    
    // Get document metadata (no decryption)
    app.get('/api/documents/encrypted/:documentId/metadata', async (req, res) => {
        try {
            const { documentId } = req.params;
            const metadata = await storage.getDocumentMetadata(documentId);
            
            if (!metadata) {
                return res.status(404).json({ error: 'Document not found' });
            }
            
            res.json(metadata);
        } catch (error) {
            console.error('Metadata error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    console.log('✅ Encrypted storage routes configured');
}

module.exports = {
    EncryptedStorage,
    setupEncryptedStorageRoutes
};