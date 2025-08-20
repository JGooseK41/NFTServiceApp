#!/usr/bin/env node
/**
 * Update All Image Endpoints
 * Script to update all JS files to use the correct /api/images endpoint
 */

const fs = require('fs');
const path = require('path');

// Directory containing JS files
const jsDir = path.join(__dirname);

// Pattern to match old endpoint
const oldPattern = /\/api\/notices\/([^\/]+)\/images/g;
// Replacement pattern for new endpoint
const newPattern = '/api/images/$1';

// Files to update
const filesToUpdate = [
    'fix-frontend-recognition.js',
    'fix-backend-access.js',
    'fix-notice-viewer-display.js',
    'fix-server-address.js',
    'convert-alerts-to-base64-fixed.js',
    'fix-dashboard-image-viewer.js',
    'convert-alerts-to-base64.js',
    'fix-notice-display.js',
    'fix-image-loading.js',
    'court-ready-proof.js',
    'fix-notice-access.js',
    'reupload-missing-images.js',
    'fix-verify-function.js',
    'fix-backend-url.js',
    'unified-notice-system.js',
    'fix-backend-access-control.js'
];

let totalUpdates = 0;

filesToUpdate.forEach(filename => {
    const filePath = path.join(jsDir, filename);
    
    try {
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            const originalContent = content;
            
            // Count matches
            const matches = content.match(oldPattern);
            const matchCount = matches ? matches.length : 0;
            
            if (matchCount > 0) {
                // Replace all occurrences
                content = content.replace(oldPattern, newPattern);
                
                // Write back
                fs.writeFileSync(filePath, content, 'utf8');
                
                console.log(`✅ Updated ${filename}: ${matchCount} occurrences replaced`);
                totalUpdates += matchCount;
            } else {
                console.log(`⏭️ Skipped ${filename}: No occurrences found`);
            }
        } else {
            console.log(`❌ File not found: ${filename}`);
        }
    } catch (error) {
        console.error(`❌ Error processing ${filename}:`, error.message);
    }
});

console.log(`\n✅ Total updates: ${totalUpdates} endpoints fixed across ${filesToUpdate.length} files`);
console.log('🎯 All image endpoints now use /api/images/:id');