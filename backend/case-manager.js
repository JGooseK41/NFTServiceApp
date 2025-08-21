/**
 * Case Manager
 * Handles complete case lifecycle from creation to serving
 */

const DiskStorageManager = require('./disk-storage-manager');
const PDFProcessor = require('./pdf-processor');
const CaseServiceTracking = require('./case-service-tracking');
const crypto = require('crypto');
const { Pool } = require('pg');

class CaseManager {
    constructor() {
        this.diskStorage = new DiskStorageManager();
        this.pdfProcessor = new PDFProcessor();
        this.serviceTracking = new CaseServiceTracking();
        
        // PostgreSQL connection
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
        });
        
        // Initialize on creation
        this.initialize();
    }

    async initialize() {
        // Initialize disk storage
        await this.diskStorage.initialize();
        
        // Create cases table if it doesn't exist
        await this.createTablesIfNeeded();
        
        // Start cleanup job
        this.startCleanupJob();
    }

    /**
     * Create database tables
     */
    async createTablesIfNeeded() {
        const query = `
            CREATE TABLE IF NOT EXISTS cases (
                id VARCHAR(50) PRIMARY KEY,
                server_address VARCHAR(100) NOT NULL,
                recipient_address VARCHAR(100),
                pdf_path VARCHAR(500),
                alert_preview TEXT,
                document_hash VARCHAR(100),
                status VARCHAR(20) DEFAULT 'draft',
                ipfs_hash VARCHAR(100),
                encryption_key VARCHAR(100),
                alert_nft_id VARCHAR(100),
                document_nft_id VARCHAR(100),
                tx_hash VARCHAR(100),
                metadata JSONB,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                served_at TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_cases_server ON cases(server_address);
            CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
            CREATE INDEX IF NOT EXISTS idx_cases_created ON cases(created_at DESC);
        `;
        
        try {
            await this.db.query(query);
            console.log('✅ Cases table ready');
        } catch (error) {
            console.error('Failed to create tables:', error);
        }
    }

    /**
     * Create a new case from uploaded PDFs
     */
    async createCase(serverAddress, uploadedFiles, metadata = {}) {
        console.log(`📋 Creating new case for server: ${serverAddress}`);
        
        try {
            // REQUIRE case number from form - do not generate random IDs
            if (!metadata.caseNumber) {
                throw new Error('Case number is required. Please provide a case number from the form.');
            }
            
            const caseId = metadata.caseNumber;
            console.log(`Using case number from form: ${caseId}`);
            
            // Check if case already exists for this server
            let existingCase = { rows: [] };
            try {
                // First ensure the table exists
                await this.createTablesIfNeeded();
                
                existingCase = await this.db.query(
                    'SELECT * FROM cases WHERE id = $1 AND server_address = $2',
                    [caseId, serverAddress]
                );
            } catch (dbError) {
                console.error('Database query error (will continue with creation):', dbError.message);
                // If table doesn't exist or other DB error, continue with creation
                existingCase = { rows: [] };
            }
            
            if (existingCase.rows.length > 0) {
                console.log(`Case ${caseId} already exists for server ${serverAddress}`);
                // Return the existing case with a flag indicating it exists
                return {
                    success: false,
                    exists: true,
                    caseId: caseId,
                    case: existingCase.rows[0],
                    message: `Case ${caseId} already exists. Would you like to resume or amend it?`,
                    error: 'CASE_EXISTS'
                };
            }
            
            // Convert uploaded files to buffers and collect file info
            const pdfBuffers = [];
            const fileInfo = [];
            
            console.log(`📂 Processing ${uploadedFiles.length} uploaded files for case ${caseId}`);
            
            for (const file of uploadedFiles) {
                if (file.buffer) {
                    pdfBuffers.push(file.buffer);
                    fileInfo.push({
                        fileName: file.originalname || file.filename || `Document ${pdfBuffers.length}`,
                        size: file.size || file.buffer.length
                    });
                    console.log(`  ✓ Added file: ${file.originalname} (${file.size} bytes)`);
                } else if (file.data) {
                    // Handle base64 data
                    const base64Data = file.data.replace(/^data:application\/pdf;base64,/, '');
                    const buffer = Buffer.from(base64Data, 'base64');
                    pdfBuffers.push(buffer);
                    fileInfo.push({
                        fileName: file.name || `Document ${pdfBuffers.length}`,
                        size: buffer.length
                    });
                    console.log(`  ✓ Added base64 file: ${file.name} (${buffer.length} bytes)`);
                }
            }
            
            console.log(`📊 Total PDFs to merge: ${pdfBuffers.length}`);
            if (pdfBuffers.length === 0) {
                throw new Error('No valid PDF files to process');
            }
            
            // Merge PDFs into one document with separators and page numbers
            const mergedPDF = await this.pdfProcessor.mergePDFs(pdfBuffers, fileInfo);
            
            // Save to disk
            const diskResult = await this.diskStorage.saveCasePDF(caseId, mergedPDF);
            
            // Generate alert preview from first page
            const alertPreview = await this.pdfProcessor.generateAlertPreview(mergedPDF);
            
            // Calculate document hash
            const documentHash = crypto.createHash('sha256')
                .update(mergedPDF)
                .digest('hex');
            
            // Get PDF info
            const pdfInfo = await this.pdfProcessor.getPDFInfo(mergedPDF);
            
            // Save to database
            const insertQuery = `
                INSERT INTO cases (
                    id, server_address, pdf_path, alert_preview, 
                    document_hash, status, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;
            
            const caseMetadata = {
                ...metadata,
                pageCount: pdfInfo.pageCount,
                fileSize: pdfInfo.size,
                originalFiles: uploadedFiles.map(f => ({
                    name: f.originalname || f.fileName,
                    size: f.size
                }))
            };
            
            const result = await this.db.query(insertQuery, [
                caseId,
                serverAddress,
                diskResult.pdfPath,
                alertPreview,
                documentHash,
                'draft',
                JSON.stringify(caseMetadata)
            ]);
            
            console.log(`✅ Case created: ${caseId}`);
            
            return {
                success: true,
                caseId,
                case: result.rows[0],
                pdfInfo,
                alertPreview
            };
            
        } catch (error) {
            console.error('Failed to create case:', error);
            console.error('Stack trace:', error.stack);
            return {
                success: false,
                error: error.message || 'Unknown error occurred during case creation'
            };
        }
    }

    /**
     * Get case details
     */
    async getCase(caseId, serverAddress = null) {
        try {
            let query = 'SELECT * FROM cases WHERE id = $1';
            const params = [caseId];
            
            // Add server check for security
            if (serverAddress) {
                query += ' AND server_address = $2';
                params.push(serverAddress);
            }
            
            const result = await this.db.query(query, params);
            
            if (result.rows.length === 0) {
                return { success: false, error: 'Case not found' };
            }
            
            const caseData = result.rows[0];
            
            // Get PDF from disk if requested
            let pdfBuffer = null;
            if (caseData.pdf_path) {
                try {
                    pdfBuffer = await this.diskStorage.readCasePDF(caseId);
                } catch (error) {
                    console.error('Failed to read PDF from disk:', error);
                }
            }
            
            return {
                success: true,
                case: caseData,
                hasPDF: !!pdfBuffer,
                pdfSize: pdfBuffer ? pdfBuffer.length : 0
            };
            
        } catch (error) {
            console.error('Failed to get case:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get case PDF
     */
    async getCasePDF(caseId, serverAddress = null) {
        // Verify case ownership
        const caseResult = await this.getCase(caseId, serverAddress);
        
        if (!caseResult.success) {
            return { success: false, error: caseResult.error };
        }
        
        try {
            const pdfBuffer = await this.diskStorage.readCasePDF(caseId);
            return {
                success: true,
                pdf: pdfBuffer,
                contentType: 'application/pdf'
            };
        } catch (error) {
            console.error('Failed to get case PDF:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * List cases for a server
     */
    async listCases(serverAddress, status = null) {
        try {
            let query = `
                SELECT id, status, created_at, served_at, 
                       metadata->>'pageCount' as page_count,
                       metadata->>'fileSize' as file_size,
                       recipient_address, ipfs_hash, alert_nft_id
                FROM cases 
                WHERE server_address = $1
            `;
            const params = [serverAddress];
            
            if (status) {
                query += ' AND status = $2';
                params.push(status);
            }
            
            query += ' ORDER BY created_at DESC LIMIT 100';
            
            const result = await this.db.query(query, params);
            
            return {
                success: true,
                cases: result.rows
            };
            
        } catch (error) {
            console.error('Failed to list cases:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update case status
     */
    async updateCaseStatus(caseId, status, additionalData = {}) {
        try {
            const updates = ['status = $2', 'updated_at = NOW()'];
            const params = [caseId, status];
            let paramIndex = 3;
            
            // Add additional fields if provided
            if (additionalData.recipientAddress) {
                updates.push(`recipient_address = $${paramIndex}`);
                params.push(additionalData.recipientAddress);
                paramIndex++;
            }
            
            if (additionalData.ipfsHash) {
                updates.push(`ipfs_hash = $${paramIndex}`);
                params.push(additionalData.ipfsHash);
                paramIndex++;
            }
            
            if (additionalData.encryptionKey) {
                updates.push(`encryption_key = $${paramIndex}`);
                params.push(additionalData.encryptionKey);
                paramIndex++;
            }
            
            if (status === 'served') {
                updates.push('served_at = NOW()');
            }
            
            const query = `
                UPDATE cases 
                SET ${updates.join(', ')}
                WHERE id = $1
                RETURNING *
            `;
            
            const result = await this.db.query(query, params);
            
            // Archive case if served
            if (status === 'served') {
                await this.diskStorage.archiveCase(caseId);
            }
            
            return {
                success: true,
                case: result.rows[0]
            };
            
        } catch (error) {
            console.error('Failed to update case status:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Prepare case for serving (encrypt and upload to IPFS)
     * Can be called multiple times for different recipients
     */
    async prepareCaseForServing(caseId, recipientAddress) {
        try {
            // Get case and PDF
            const caseData = await this.getCase(caseId);
            if (!caseData.success) {
                return { success: false, error: caseData.error };
            }
            
            const pdfBuffer = await this.diskStorage.readCasePDF(caseId);
            
            // Record this service attempt
            await this.serviceTracking.recordService(caseId, recipientAddress, {
                serviceType: 'standard',
                notes: `Preparing service for ${recipientAddress}`
            });
            
            // Generate unique encryption key for this recipient
            const encryptionKey = crypto.randomBytes(32).toString('hex');
            
            // Encrypt PDF
            const encryptedPDF = await this.encryptPDF(pdfBuffer, encryptionKey);
            
            // Here you would upload to IPFS
            // const ipfsHash = await this.uploadToIPFS(encryptedPDF);
            
            // For now, simulate IPFS upload
            const ipfsHash = 'Qm' + crypto.randomBytes(22).toString('hex');
            
            // Don't update main case status - it can serve multiple recipients
            // Just track this specific service
            
            return {
                success: true,
                caseId,
                ipfsHash,
                encryptionKey,
                alertPreview: caseData.case.alert_preview,
                documentHash: caseData.case.document_hash,
                recipientAddress
            };
            
        } catch (error) {
            console.error('Failed to prepare case for serving:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Serve case to multiple recipients
     */
    async serveCaseToMultiple(caseId, recipients) {
        const results = [];
        
        for (const recipient of recipients) {
            try {
                const prepareResult = await this.prepareCaseForServing(caseId, recipient.address);
                
                if (prepareResult.success) {
                    results.push({
                        success: true,
                        recipient: recipient.address,
                        ipfsHash: prepareResult.ipfsHash,
                        encryptionKey: prepareResult.encryptionKey
                    });
                } else {
                    results.push({
                        success: false,
                        recipient: recipient.address,
                        error: prepareResult.error
                    });
                }
            } catch (error) {
                results.push({
                    success: false,
                    recipient: recipient.address,
                    error: error.message
                });
            }
        }
        
        return {
            success: true,
            caseId,
            results,
            summary: {
                total: recipients.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        };
    }

    /**
     * Simple encryption for PDF
     */
    async encryptPDF(pdfBuffer, key) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
            'aes-256-cbc',
            Buffer.from(key, 'hex'),
            iv
        );
        
        const encrypted = Buffer.concat([
            iv,
            cipher.update(pdfBuffer),
            cipher.final()
        ]);
        
        return encrypted;
    }

    /**
     * Mark case as served after blockchain transaction
     */
    async markCaseAsServed(caseId, txHash, alertNftId, documentNftId) {
        try {
            const query = `
                UPDATE cases 
                SET status = 'served',
                    tx_hash = $2,
                    alert_nft_id = $3,
                    document_nft_id = $4,
                    served_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
            `;
            
            const result = await this.db.query(query, [
                caseId, txHash, alertNftId, documentNftId
            ]);
            
            // Archive the case on disk
            await this.diskStorage.archiveCase(caseId);
            
            return {
                success: true,
                case: result.rows[0]
            };
            
        } catch (error) {
            console.error('Failed to mark case as served:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Amend/Update an existing case
     */
    async amendCase(caseId, serverAddress, uploadedFiles, metadata = {}) {
        console.log(`Amending case ${caseId} for server: ${serverAddress}`);
        
        try {
            // Check if case exists
            const existingCase = await this.db.query(
                'SELECT * FROM cases WHERE id = $1 AND server_address = $2',
                [caseId, serverAddress]
            );
            
            if (existingCase.rows.length === 0) {
                return {
                    success: false,
                    error: 'Case not found to amend'
                };
            }
            
            // Process new PDFs if provided
            let pdfPath = existingCase.rows[0].pdf_path;
            let alertPreview = existingCase.rows[0].alert_preview;
            
            if (uploadedFiles && uploadedFiles.length > 0) {
                console.log(`Processing ${uploadedFiles.length} new files for case amendment`);
                
                // Convert uploaded files to buffers
                const pdfBuffers = [];
                for (const file of uploadedFiles) {
                    if (file.buffer) {
                        pdfBuffers.push(file.buffer);
                    }
                }
                
                // Clean and merge PDFs
                const { consolidatedPdf, pageCount } = await this.pdfProcessor.processMultiplePDFs(pdfBuffers);
                
                // Store the consolidated PDF
                pdfPath = await this.diskStorage.storePDF(caseId, consolidatedPdf, 'consolidated.pdf');
                
                // Generate new preview if needed
                alertPreview = await this.pdfProcessor.generateAlertPreview({
                    ...metadata,
                    pageCount
                });
            }
            
            // Update case metadata
            const updateQuery = `
                UPDATE cases 
                SET 
                    metadata = $3,
                    pdf_path = $4,
                    alert_preview = $5,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND server_address = $2
                RETURNING *
            `;
            
            const result = await this.db.query(updateQuery, [
                caseId,
                serverAddress,
                JSON.stringify({...metadata, amended: true, amendedAt: new Date().toISOString()}),
                pdfPath,
                alertPreview
            ]);
            
            return {
                success: true,
                amended: true,
                caseId,
                case: result.rows[0],
                message: 'Case successfully amended'
            };
            
        } catch (error) {
            console.error('Failed to amend case:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Delete case (allows deletion of any case)
     */
    async deleteCase(caseId, serverAddress) {
        try {
            console.log(`Deleting case ${caseId} for server ${serverAddress}`);
            
            // Delete from cases table
            const casesResult = await this.db.query(
                'DELETE FROM cases WHERE id = $1 AND server_address = $2',
                [caseId, serverAddress]
            );
            
            console.log(`Deleted ${casesResult.rowCount} records from cases table`);
            
            // Try to delete from disk if storage exists
            try {
                await this.diskStorage.deleteCase(caseId);
                console.log(`Deleted case files from disk`);
            } catch (diskError) {
                console.log('No disk files to delete or disk storage unavailable');
            }
            
            return { 
                success: true, 
                message: `Case ${caseId} deleted successfully`,
                deletedFromCases: casesResult.rowCount
            };
            
        } catch (error) {
            console.error('Failed to delete case:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Cleanup old temp files periodically
     */
    startCleanupJob() {
        // Run cleanup every hour
        setInterval(async () => {
            console.log('🧹 Running cleanup job');
            await this.diskStorage.cleanupTemp();
            
            // Also check disk usage
            const stats = await this.diskStorage.getDiskStats();
            if (stats) {
                console.log(`💾 Disk usage: ${stats.used}/${stats.total} (${stats.percentUsed})`);
                
                // Alert if disk is getting full
                const percentUsed = parseInt(stats.percentUsed);
                if (percentUsed > 80) {
                    console.warn('⚠️ Disk usage is above 80%!');
                }
            }
        }, 60 * 60 * 1000); // Every hour
    }
}

module.exports = CaseManager;