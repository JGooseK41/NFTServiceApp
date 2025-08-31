/**
 * Fixed Disk Storage Manager for Render Disk
 * Handles permission issues and write test failures
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
            backups: path.join(this.basePath, 'backups'),
            documents: path.join(this.basePath, 'documents'),
            pdfs: path.join(this.basePath, 'documents', 'pdfs'),
            unencrypted: path.join(this.basePath, 'documents', 'unencrypted')
        };
    }

    /**
     * Initialize directory structure on disk with better error handling
     */
    async initialize() {
        console.log('🔧 Initializing Render Disk storage at:', this.basePath);
        
        try {
            // Check if mount point exists
            try {
                await fs.access(this.basePath);
                console.log('✅ Disk mounted at:', this.basePath);
            } catch (error) {
                console.log('❌ Disk not mounted at:', this.basePath);
                throw new Error(`Disk mount point not accessible: ${this.basePath}`);
            }
            
            // Create directory structure
            for (const [name, dirPath] of Object.entries(this.directories)) {
                try {
                    await fs.mkdir(dirPath, { recursive: true });
                    
                    // Verify directory was created
                    const stats = await fs.stat(dirPath);
                    if (stats.isDirectory()) {
                        console.log(`📁 Directory ready: ${name} at ${dirPath}`);
                    }
                } catch (error) {
                    if (error.code !== 'EEXIST') {
                        console.error(`❌ Failed to create ${name}:`, error.message);
                        // Continue anyway - some directories might work
                    } else {
                        console.log(`📁 Directory exists: ${name}`);
                    }
                }
            }
            
            // Test write permissions with better error handling
            const testFile = path.join(this.directories.temp, `.write-test-${Date.now()}`);
            try {
                // Write test
                await fs.writeFile(testFile, 'test', 'utf8');
                console.log('✅ Write test successful');
                
                // Read test
                await fs.readFile(testFile, 'utf8');
                console.log('✅ Read test successful');
                
                // Delete test - don't fail if file doesn't exist
                try {
                    await fs.unlink(testFile);
                    console.log('✅ Delete test successful');
                } catch (unlinkError) {
                    if (unlinkError.code !== 'ENOENT') {
                        console.warn('⚠️ Could not delete test file:', unlinkError.message);
                    }
                }
                
                console.log('✅ All disk permissions verified');
                
            } catch (error) {
                console.error('⚠️ Write test failed:', error.message);
                // Don't throw - disk might still be partially usable
                console.log('⚠️ Disk may have limited permissions');
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Disk initialization error:', error);
            
            // Try fallback to local storage
            const fallbackPath = path.join(process.cwd(), 'uploads');
            console.log(`📁 Attempting fallback to local storage: ${fallbackPath}`);
            
            try {
                await fs.mkdir(fallbackPath, { recursive: true });
                await fs.mkdir(path.join(fallbackPath, 'pdfs'), { recursive: true });
                await fs.mkdir(path.join(fallbackPath, 'documents'), { recursive: true });
                
                // Update paths to use fallback
                this.basePath = fallbackPath;
                this.directories = {
                    cases: path.join(fallbackPath, 'cases'),
                    archived: path.join(fallbackPath, 'archived'),
                    temp: path.join(fallbackPath, 'temp'),
                    backups: path.join(fallbackPath, 'backups'),
                    documents: path.join(fallbackPath, 'documents'),
                    pdfs: path.join(fallbackPath, 'documents', 'pdfs'),
                    unencrypted: path.join(fallbackPath, 'documents', 'unencrypted')
                };
                
                console.log('✅ Fallback to local storage successful');
                return true;
                
            } catch (fallbackError) {
                console.error('❌ Fallback also failed:', fallbackError);
                throw new Error(`Storage initialization completely failed: ${error.message}`);
            }
        }
    }

    /**
     * Get storage path (might be disk or fallback)
     */
    getStoragePath() {
        return this.basePath;
    }

    /**
     * Check if using actual disk or fallback
     */
    isUsingDisk() {
        return this.basePath === (process.env.DISK_MOUNT_PATH || '/var/data');
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
     * Save case PDF to disk with error handling
     */
    async saveCasePDF(caseId, pdfBuffer) {
        try {
            const casePath = path.join(this.directories.cases || this.basePath, caseId);
            await fs.mkdir(casePath, { recursive: true });
            
            const pdfPath = path.join(casePath, 'document.pdf');
            await fs.writeFile(pdfPath, pdfBuffer);
            
            // Also save metadata
            const metadata = {
                caseId,
                size: pdfBuffer.length,
                savedAt: new Date().toISOString(),
                path: pdfPath,
                storagePath: this.basePath,
                usingDisk: this.isUsingDisk()
            };
            
            const metadataPath = path.join(casePath, 'metadata.json');
            await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
            
            console.log(`💾 Saved case ${caseId}: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB to ${this.isUsingDisk() ? 'disk' : 'local'} storage`);
            
            return {
                caseId,
                pdfPath,
                metadataPath,
                size: pdfBuffer.length,
                storagePath: this.basePath
            };
            
        } catch (error) {
            console.error('Error saving case PDF:', error);
            throw error;
        }
    }

    /**
     * Read case PDF from disk
     */
    async readCasePDF(caseId) {
        try {
            const pdfPath = path.join(this.directories.cases || this.basePath, caseId, 'document.pdf');
            const pdfBuffer = await fs.readFile(pdfPath);
            
            console.log(`📖 Retrieved case ${caseId}: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB`);
            
            return pdfBuffer;
            
        } catch (error) {
            console.error('Error reading case PDF:', error);
            throw error;
        }
    }

    /**
     * Check if a case exists on disk
     */
    async caseExists(caseId) {
        try {
            const pdfPath = path.join(this.directories.cases || this.basePath, caseId, 'document.pdf');
            await fs.access(pdfPath);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get disk usage statistics
     */
    async getDiskStats() {
        try {
            const { statfs } = require('fs').promises;
            if (statfs) {
                const stats = await statfs(this.basePath);
                return {
                    total: stats.blocks * stats.bsize,
                    free: stats.bavail * stats.bsize,
                    used: (stats.blocks - stats.bavail) * stats.bsize,
                    path: this.basePath,
                    usingDisk: this.isUsingDisk()
                };
            }
        } catch (error) {
            console.log('Could not get disk stats:', error.message);
        }
        return null;
    }

    /**
     * Clean up temporary files older than 24 hours
     */
    async cleanupTemp() {
        const tempPath = path.join(this.basePath, 'temp');
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        try {
            // Ensure temp directory exists
            await fs.mkdir(tempPath, { recursive: true });
            
            // Read all files in temp directory
            const files = await fs.readdir(tempPath);
            let cleaned = 0;
            
            for (const file of files) {
                const filePath = path.join(tempPath, file);
                try {
                    const stats = await fs.stat(filePath);
                    const age = now - stats.mtimeMs;
                    
                    // Delete if older than 24 hours
                    if (age > maxAge) {
                        await fs.unlink(filePath);
                        cleaned++;
                    }
                } catch (err) {
                    console.log(`Could not check/delete temp file ${file}:`, err.message);
                }
            }
            
            if (cleaned > 0) {
                console.log(`🧹 Cleaned up ${cleaned} old temp files`);
            }
            
            return cleaned;
        } catch (error) {
            console.log('Error during temp cleanup:', error.message);
            return 0;
        }
    }
}

module.exports = DiskStorageManager;