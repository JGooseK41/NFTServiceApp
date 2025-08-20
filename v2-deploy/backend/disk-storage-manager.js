/**
 * Disk Storage Manager for Legal Documents
 * Manages PDF storage on Render Disk at /var/data
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class DiskStorageManager {
    constructor() {
        this.basePath = process.env.DISK_MOUNT_PATH || '/var/data';
        this.directories = {
            cases: path.join(this.basePath, 'cases'),
            archived: path.join(this.basePath, 'archived'),
            temp: path.join(this.basePath, 'temp'),
            backups: path.join(this.basePath, 'backups')
        };
    }

    /**
     * Initialize directory structure on disk
     */
    async initialize() {
        console.log('🔧 Initializing Render Disk storage at:', this.basePath);
        
        try {
            // Check if mount point exists
            await fs.access(this.basePath);
            console.log('✅ Disk mounted at:', this.basePath);
            
            // Create directory structure
            for (const [name, dirPath] of Object.entries(this.directories)) {
                try {
                    await fs.mkdir(dirPath, { recursive: true });
                    console.log(`📁 Created directory: ${name} at ${dirPath}`);
                } catch (error) {
                    if (error.code !== 'EEXIST') {
                        throw error;
                    }
                    console.log(`📁 Directory exists: ${name}`);
                }
            }
            
            // Test write permissions
            const testFile = path.join(this.directories.temp, '.write-test');
            await fs.writeFile(testFile, 'test');
            await fs.unlink(testFile);
            console.log('✅ Write permissions verified');
            
            return true;
        } catch (error) {
            console.error('❌ Disk initialization failed:', error);
            throw new Error(`Failed to initialize disk storage: ${error.message}`);
        }
    }

    /**
     * Generate unique case ID
     */
    generateCaseId() {
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        return `CASE-${timestamp}-${random}`;
    }

    /**
     * Save case PDF to disk
     */
    async saveCasePDF(caseId, pdfBuffer) {
        const casePath = path.join(this.directories.cases, caseId);
        await fs.mkdir(casePath, { recursive: true });
        
        const pdfPath = path.join(casePath, 'document.pdf');
        await fs.writeFile(pdfPath, pdfBuffer);
        
        // Also save metadata
        const metadata = {
            caseId,
            size: pdfBuffer.length,
            savedAt: new Date().toISOString(),
            path: pdfPath
        };
        
        const metadataPath = path.join(casePath, 'metadata.json');
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        
        console.log(`💾 Saved case ${caseId}: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB`);
        
        return {
            caseId,
            pdfPath,
            metadataPath,
            size: pdfBuffer.length
        };
    }

    /**
     * Read case PDF from disk
     */
    async readCasePDF(caseId) {
        const pdfPath = path.join(this.directories.cases, caseId, 'document.pdf');
        
        try {
            const pdfBuffer = await fs.readFile(pdfPath);
            console.log(`📖 Read case ${caseId}: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB`);
            return pdfBuffer;
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Check if archived
                const archivedPath = path.join(this.directories.archived, caseId, 'document.pdf');
                try {
                    const pdfBuffer = await fs.readFile(archivedPath);
                    console.log(`📖 Read archived case ${caseId}`);
                    return pdfBuffer;
                } catch (archiveError) {
                    throw new Error(`Case ${caseId} not found`);
                }
            }
            throw error;
        }
    }

    /**
     * Archive case after serving
     */
    async archiveCase(caseId) {
        const sourcePath = path.join(this.directories.cases, caseId);
        const destPath = path.join(this.directories.archived, caseId);
        
        try {
            // Create archive directory
            await fs.mkdir(path.dirname(destPath), { recursive: true });
            
            // Move entire case directory
            await fs.rename(sourcePath, destPath);
            
            console.log(`📦 Archived case ${caseId}`);
            return true;
        } catch (error) {
            console.error(`Failed to archive case ${caseId}:`, error);
            return false;
        }
    }

    /**
     * Save temporary file (for upload processing)
     */
    async saveTempFile(filename, buffer) {
        const tempPath = path.join(this.directories.temp, filename);
        await fs.writeFile(tempPath, buffer);
        return tempPath;
    }

    /**
     * Clean up temporary files older than 1 hour
     */
    async cleanupTemp() {
        const tempDir = this.directories.temp;
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        try {
            const files = await fs.readdir(tempDir);
            
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtimeMs < oneHourAgo) {
                    await fs.unlink(filePath);
                    console.log(`🗑️ Cleaned up temp file: ${file}`);
                }
            }
        } catch (error) {
            console.error('Temp cleanup error:', error);
        }
    }

    /**
     * Get disk usage statistics
     */
    async getDiskStats() {
        const { execSync } = require('child_process');
        
        try {
            // Get disk usage for mount point
            const dfOutput = execSync(`df -h ${this.basePath}`).toString();
            const lines = dfOutput.trim().split('\n');
            
            if (lines.length >= 2) {
                const parts = lines[1].split(/\s+/);
                return {
                    total: parts[1],
                    used: parts[2],
                    available: parts[3],
                    percentUsed: parts[4],
                    mountPoint: this.basePath
                };
            }
        } catch (error) {
            console.error('Failed to get disk stats:', error);
        }
        
        return null;
    }

    /**
     * List all cases
     */
    async listCases(includeArchived = false) {
        const cases = [];
        
        // List active cases
        try {
            const activeCases = await fs.readdir(this.directories.cases);
            for (const caseId of activeCases) {
                const metadataPath = path.join(this.directories.cases, caseId, 'metadata.json');
                try {
                    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
                    cases.push({ ...metadata, status: 'active' });
                } catch (e) {
                    // Skip if no metadata
                }
            }
        } catch (error) {
            console.error('Error listing active cases:', error);
        }
        
        // List archived cases if requested
        if (includeArchived) {
            try {
                const archivedCases = await fs.readdir(this.directories.archived);
                for (const caseId of archivedCases) {
                    const metadataPath = path.join(this.directories.archived, caseId, 'metadata.json');
                    try {
                        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
                        cases.push({ ...metadata, status: 'archived' });
                    } catch (e) {
                        // Skip if no metadata
                    }
                }
            } catch (error) {
                console.error('Error listing archived cases:', error);
            }
        }
        
        return cases;
    }

    /**
     * Delete case (careful!)
     */
    async deleteCase(caseId, archived = false) {
        const casePath = archived ? 
            path.join(this.directories.archived, caseId) :
            path.join(this.directories.cases, caseId);
        
        try {
            await fs.rm(casePath, { recursive: true, force: true });
            console.log(`🗑️ Deleted case ${caseId}`);
            return true;
        } catch (error) {
            console.error(`Failed to delete case ${caseId}:`, error);
            return false;
        }
    }
}

module.exports = DiskStorageManager;