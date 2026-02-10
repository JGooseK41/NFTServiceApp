/**
 * Disk Browser API
 * Browse and inspect files stored on Render disk
 * Access at: https://your-server.onrender.com/api/disk-browser
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const requireAdminKey = require('../middleware/admin-key-auth');

// Require admin authentication for all disk browser routes
router.use(requireAdminKey);

// Main disk paths to check
const DISK_PATHS = {
    'Mounted Disk': '/var/data',
    'Uploads': '/var/data/uploads',
    'PDFs': '/var/data/uploads/pdfs',
    'Documents': '/var/data/documents',
    'Backend Uploads': '/opt/render/project/src/backend/uploads',
    'Backend PDFs': '/opt/render/project/src/backend/uploads/pdfs'
};

/**
 * Browse disk contents
 * GET /api/disk-browser
 */
router.get('/', async (req, res) => {
    try {
        const report = {
            timestamp: new Date().toISOString(),
            disk_usage: {},
            directories: {},
            pdf_files: [],
            summary: {}
        };
        
        // Get overall disk usage
        try {
            const { stdout } = await exec('df -h /var/data');
            const lines = stdout.split('\n');
            if (lines[1]) {
                const parts = lines[1].split(/\s+/);
                report.disk_usage = {
                    filesystem: parts[0],
                    size: parts[1],
                    used: parts[2],
                    available: parts[3],
                    use_percent: parts[4],
                    mounted_on: parts[5]
                };
            }
        } catch (e) {
            report.disk_usage.error = e.message;
        }
        
        // Check each directory
        for (const [name, dirPath] of Object.entries(DISK_PATHS)) {
            try {
                await fs.access(dirPath);
                const files = await fs.readdir(dirPath);
                const stats = await fs.stat(dirPath);
                
                // Get file details
                const fileDetails = [];
                for (const file of files.slice(0, 50)) { // Limit to 50 files
                    try {
                        const filePath = path.join(dirPath, file);
                        const fileStat = await fs.stat(filePath);
                        fileDetails.push({
                            name: file,
                            type: fileStat.isDirectory() ? 'directory' : 'file',
                            size: fileStat.size,
                            size_mb: (fileStat.size / 1024 / 1024).toFixed(2),
                            modified: fileStat.mtime,
                            extension: path.extname(file)
                        });
                        
                        // Collect PDF files
                        if (file.endsWith('.pdf')) {
                            report.pdf_files.push({
                                path: filePath,
                                name: file,
                                size_mb: (fileStat.size / 1024 / 1024).toFixed(2),
                                modified: fileStat.mtime
                            });
                        }
                    } catch (e) {
                        // Skip files we can't read
                    }
                }
                
                report.directories[name] = {
                    path: dirPath,
                    exists: true,
                    file_count: files.length,
                    modified: stats.mtime,
                    files: fileDetails
                };
            } catch (e) {
                report.directories[name] = {
                    path: dirPath,
                    exists: false,
                    error: e.message
                };
            }
        }
        
        // Summary
        report.summary = {
            total_directories_checked: Object.keys(DISK_PATHS).length,
            directories_found: Object.values(report.directories).filter(d => d.exists).length,
            total_pdf_files: report.pdf_files.length,
            disk_mounted: report.directories['Mounted Disk']?.exists || false
        };
        
        // Format as HTML for browser viewing
        if (req.headers.accept && req.headers.accept.includes('text/html')) {
            const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Disk Browser - NFT Service</title>
    <style>
        body { font-family: monospace; margin: 20px; background: #1a1a1a; color: #0f0; }
        h1 { color: #0f0; border-bottom: 2px solid #0f0; }
        h2 { color: #0ff; margin-top: 30px; }
        .info { background: #000; padding: 10px; border: 1px solid #0f0; margin: 10px 0; }
        .error { color: #f00; }
        .success { color: #0f0; }
        .file { margin-left: 20px; color: #fff; }
        .pdf { color: #ff0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #0f0; padding: 5px; text-align: left; }
        th { background: #003300; }
    </style>
</head>
<body>
    <h1>🗄️ Render Disk Browser</h1>
    <p>Generated: ${report.timestamp}</p>
    
    <h2>💾 Disk Usage</h2>
    <div class="info">
        <table>
            <tr><th>Property</th><th>Value</th></tr>
            <tr><td>Total Size</td><td>${report.disk_usage.size || 'N/A'}</td></tr>
            <tr><td>Used</td><td>${report.disk_usage.used || 'N/A'}</td></tr>
            <tr><td>Available</td><td>${report.disk_usage.available || 'N/A'}</td></tr>
            <tr><td>Usage</td><td>${report.disk_usage.use_percent || 'N/A'}</td></tr>
            <tr><td>Mount Point</td><td>${report.disk_usage.mounted_on || 'N/A'}</td></tr>
        </table>
    </div>
    
    <h2>📁 Directories</h2>
    ${Object.entries(report.directories).map(([name, dir]) => `
        <div class="info">
            <h3>${name}</h3>
            <p>Path: ${dir.path}</p>
            <p class="${dir.exists ? 'success' : 'error'}">
                ${dir.exists ? `✅ Exists - ${dir.file_count} items` : `❌ Not found: ${dir.error}`}
            </p>
            ${dir.files ? `
                <details>
                    <summary>View files (${dir.files.length} shown)</summary>
                    <div class="file">
                        ${dir.files.map(f => `
                            <div class="${f.extension === '.pdf' ? 'pdf' : ''}">
                                ${f.type === 'directory' ? '📁' : '📄'} ${f.name} 
                                (${f.size_mb} MB)
                            </div>
                        `).join('')}
                    </div>
                </details>
            ` : ''}
        </div>
    `).join('')}
    
    <h2>📄 PDF Files Found (${report.pdf_files.length})</h2>
    <div class="info">
        ${report.pdf_files.length > 0 ? `
            <table>
                <tr><th>File</th><th>Size (MB)</th><th>Modified</th></tr>
                ${report.pdf_files.map(pdf => `
                    <tr>
                        <td class="pdf">${pdf.name}</td>
                        <td>${pdf.size_mb}</td>
                        <td>${pdf.modified}</td>
                    </tr>
                `).join('')}
            </table>
        ` : '<p class="error">No PDF files found</p>'}
    </div>
    
    <h2>📊 Summary</h2>
    <div class="info">
        <p>Directories checked: ${report.summary.total_directories_checked}</p>
        <p>Directories found: ${report.summary.directories_found}</p>
        <p>PDF files found: ${report.summary.total_pdf_files}</p>
        <p>Disk mounted: ${report.summary.disk_mounted ? '✅ Yes' : '❌ No'}</p>
    </div>
    
    <hr>
    <p><a href="/api/disk-browser?format=json">View as JSON</a></p>
</body>
</html>
            `;
            res.set('Content-Type', 'text/html');
            res.send(html);
        } else {
            // Return JSON
            res.json(report);
        }
        
    } catch (error) {
        console.error('Disk browser error:', error);
        res.status(500).json({
            error: 'Failed to browse disk',
            message: error.message
        });
    }
});

/**
 * Search for specific files
 * GET /api/disk-browser/search?query=235579
 */
router.get('/search', async (req, res) => {
    const { query = '' } = req.query;
    
    if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
    }
    
    try {
        const results = [];

        // Search in main directories using safe fs operations (no shell exec)
        for (const [name, dirPath] of Object.entries(DISK_PATHS)) {
            try {
                await fs.access(dirPath);
                const files = await fs.readdir(dirPath);
                const matching = files.filter(f => f.toLowerCase().includes(query.toLowerCase()));

                for (const file of matching.slice(0, 20)) {
                    try {
                        const filePath = path.join(dirPath, file);
                        const stat = await fs.stat(filePath);
                        if (stat.isFile()) {
                            results.push({
                                path: filePath,
                                name: file,
                                directory: dirPath,
                                size_mb: (stat.size / 1024 / 1024).toFixed(2),
                                modified: stat.mtime
                            });
                        }
                    } catch (e) {
                        // Skip files we can't stat
                    }
                }
            } catch (e) {
                // Directory doesn't exist or can't search
            }
        }
        
        res.json({
            query,
            results_found: results.length,
            results
        });
        
    } catch (error) {
        res.status(500).json({
            error: 'Search failed',
            message: error.message
        });
    }
});

module.exports = router;