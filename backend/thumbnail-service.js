// Thumbnail Service - Serves optimized thumbnails for NFTs
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { createCanvas, loadImage } = require('canvas');
const PDFDocument = require('pdfkit');

// Cache for generated thumbnails
const thumbnailCache = new Map();

// Default thumbnail for legal notices
const DEFAULT_THUMBNAIL_PATH = path.join(__dirname, '../public/images/legal-notice-default.png');

/**
 * Generate a standard legal notice thumbnail
 */
async function generateDefaultThumbnail() {
    const canvas = createCanvas(400, 400);
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 400, 400);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#0f0f1e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 400);
    
    // Legal scales icon
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(200, 100);
    ctx.lineTo(200, 250);
    ctx.moveTo(150, 150);
    ctx.lineTo(250, 150);
    ctx.arc(150, 180, 30, 0, Math.PI);
    ctx.arc(250, 180, 30, 0, Math.PI);
    ctx.stroke();
    
    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('LEGAL NOTICE', 200, 300);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = '#4a9eff';
    ctx.fillText('Blockchain Verified', 200, 330);
    
    // Border
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 380, 380);
    
    return canvas.toBuffer('image/png');
}

/**
 * Generate thumbnail from stored document's first page
 */
async function generateDocumentThumbnail(noticeId, caseNumber) {
    try {
        // Check if we have a stored thumbnail
        const thumbnailPath = path.join(__dirname, '../storage/thumbnails', `${noticeId}.png`);
        
        try {
            await fs.access(thumbnailPath);
            const buffer = await fs.readFile(thumbnailPath);
            return buffer;
        } catch (e) {
            // Thumbnail doesn't exist, try to generate from PDF
        }
        
        // Try to find the actual PDF document
        let pdfPath = null;
        const possiblePaths = [
            path.join(__dirname, '../storage/documents', `${noticeId}.pdf`),
            path.join(__dirname, '../storage/documents', `${caseNumber}.pdf`),
            path.join(__dirname, '../storage/consolidated', `${noticeId}.pdf`),
            path.join(__dirname, '../storage/consolidated', `${caseNumber}.pdf`)
        ];
        
        for (const testPath of possiblePaths) {
            try {
                await fs.access(testPath);
                pdfPath = testPath;
                break;
            } catch (e) {
                continue;
            }
        }
        
        if (pdfPath) {
            // Generate thumbnail from actual PDF first page
            try {
                const pdf2pic = require('pdf2pic');
                const options = {
                    density: 100,           // DPI
                    savename: noticeId,     
                    savedir: path.join(__dirname, '../storage/thumbnails'),
                    format: "png",
                    width: 400,
                    height: 400
                };
                
                const convert = pdf2pic.fromPath(pdfPath, options);
                const result = await convert(1); // First page only
                
                if (result && result.path) {
                    const buffer = await fs.readFile(result.path);
                    
                    // Add overlay with case number and legal notice badge
                    const canvas = createCanvas(400, 400);
                    const ctx = canvas.getContext('2d');
                    
                    // Draw the PDF page
                    const img = await loadImage(buffer);
                    ctx.drawImage(img, 0, 0, 400, 400);
                    
                    // Add semi-transparent overlay at top
                    ctx.fillStyle = 'rgba(26, 26, 46, 0.9)';
                    ctx.fillRect(0, 0, 400, 60);
                    
                    // Add case number
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 18px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(`CASE #${caseNumber || noticeId.substring(0, 8)}`, 200, 25);
                    
                    // Add "Legal Notice NFT" label
                    ctx.font = '14px Arial';
                    ctx.fillStyle = '#4a9eff';
                    ctx.fillText('Legal Notice NFT', 200, 45);
                    
                    // Add border
                    ctx.strokeStyle = '#4a9eff';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(0, 0, 400, 400);
                    
                    const finalBuffer = canvas.toBuffer('image/png');
                    
                    // Save for caching
                    await fs.writeFile(thumbnailPath, finalBuffer);
                    
                    return finalBuffer;
                }
            } catch (pdfError) {
                console.error('Failed to generate from PDF:', pdfError);
            }
        }
        
        // Fallback: Generate a custom thumbnail with case info
        const canvas = createCanvas(400, 400);
        const ctx = canvas.getContext('2d');
        
        // Background
        const gradient = ctx.createLinearGradient(0, 0, 400, 400);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0f0f1e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 400, 400);
        
        // Document icon
        ctx.fillStyle = '#2a2a3e';
        ctx.fillRect(100, 80, 200, 260);
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2;
        ctx.strokeRect(100, 80, 200, 260);
        
        // Lines to represent text
        for (let i = 0; i < 8; i++) {
            ctx.strokeStyle = '#4a4a5e';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(120, 110 + i * 25);
            ctx.lineTo(280, 110 + i * 25);
            ctx.stroke();
        }
        
        // Case number
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`CASE #${caseNumber || noticeId.substring(0, 8)}`, 200, 50);
        
        // Footer
        ctx.font = '14px Arial';
        ctx.fillStyle = '#4a9eff';
        ctx.fillText('Legal Document NFT', 200, 370);
        
        const buffer = canvas.toBuffer('image/png');
        
        // Cache it
        try {
            await fs.mkdir(path.join(__dirname, '../storage/thumbnails'), { recursive: true });
            await fs.writeFile(thumbnailPath, buffer);
        } catch (e) {
            console.error('Failed to cache thumbnail:', e);
        }
        
        return buffer;
        
    } catch (error) {
        console.error('Failed to generate document thumbnail:', error);
        // Return default thumbnail
        return await generateDefaultThumbnail();
    }
}

/**
 * GET /api/thumbnail/:noticeId
 * Serve thumbnail for a specific notice
 */
router.get('/:noticeId', async (req, res) => {
    try {
        const { noticeId } = req.params;
        
        // Check cache first
        if (thumbnailCache.has(noticeId)) {
            const cached = thumbnailCache.get(noticeId);
            res.set('Content-Type', 'image/png');
            res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
            return res.send(cached);
        }
        
        // FIRST: Check if we have an uploaded thumbnail (exact preview image)
        const uploadedPath = path.join(__dirname, '../storage/thumbnails', `${noticeId}.png`);
        try {
            await fs.access(uploadedPath);
            const uploadedThumb = await fs.readFile(uploadedPath);
            
            // Cache it
            if (thumbnailCache.size > 100) {
                const firstKey = thumbnailCache.keys().next().value;
                thumbnailCache.delete(firstKey);
            }
            thumbnailCache.set(noticeId, uploadedThumb);
            
            console.log(`✅ Serving uploaded thumbnail for ${noticeId}`);
            res.set('Content-Type', 'image/png');
            res.set('Cache-Control', 'public, max-age=86400');
            return res.send(uploadedThumb);
        } catch (e) {
            // No uploaded thumbnail, generate one
        }
        
        // Try to get case information from database
        let caseNumber;
        try {
            // You would query your database here
            // For now, we'll use the noticeId as a fallback
            caseNumber = noticeId.substring(0, 10);
        } catch (e) {
            caseNumber = noticeId.substring(0, 10);
        }
        
        // Generate thumbnail (will try PDF first, then fallback)
        const thumbnail = await generateDocumentThumbnail(noticeId, caseNumber);
        
        // Cache it (max 100 items)
        if (thumbnailCache.size > 100) {
            const firstKey = thumbnailCache.keys().next().value;
            thumbnailCache.delete(firstKey);
        }
        thumbnailCache.set(noticeId, thumbnail);
        
        // Send response
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(thumbnail);
        
    } catch (error) {
        console.error('Failed to serve thumbnail:', error);
        
        // Send default thumbnail
        try {
            const defaultThumb = await generateDefaultThumbnail();
            res.set('Content-Type', 'image/png');
            res.send(defaultThumb);
        } catch (e) {
            res.status(500).json({ error: 'Failed to generate thumbnail' });
        }
    }
});

/**
 * GET /api/thumbnail/default
 * Serve default legal notice thumbnail
 */
router.get('/default', async (req, res) => {
    try {
        const thumbnail = await generateDefaultThumbnail();
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=604800'); // Cache for 7 days
        res.send(thumbnail);
    } catch (error) {
        console.error('Failed to serve default thumbnail:', error);
        res.status(500).json({ error: 'Failed to generate thumbnail' });
    }
});

/**
 * Initialize default thumbnail on startup
 */
async function initializeThumbnailService() {
    try {
        // Create storage directory
        await fs.mkdir(path.join(__dirname, '../storage/thumbnails'), { recursive: true });
        
        // Generate and save default thumbnail
        const defaultThumb = await generateDefaultThumbnail();
        await fs.mkdir(path.join(__dirname, '../public/images'), { recursive: true });
        await fs.writeFile(DEFAULT_THUMBNAIL_PATH, defaultThumb);
        
        console.log('✅ Thumbnail service initialized');
    } catch (error) {
        console.error('Failed to initialize thumbnail service:', error);
    }
}

module.exports = {
    router,
    initializeThumbnailService,
    generateDocumentThumbnail,
    generateDefaultThumbnail
};