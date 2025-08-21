// Thumbnail Upload Endpoint - Stores the exact thumbnail shown in preview
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Configure multer for memory storage
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max
    }
});

/**
 * POST /api/thumbnail/upload
 * Upload and store the exact thumbnail that was shown in preview
 */
router.post('/upload', upload.single('thumbnail'), async (req, res) => {
    try {
        const { noticeId, caseNumber } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No thumbnail provided' });
        }
        
        if (!noticeId && !caseNumber) {
            return res.status(400).json({ error: 'Notice ID or case number required' });
        }
        
        // Use noticeId or generate from case number
        const id = noticeId || crypto.createHash('md5').update(caseNumber).digest('hex');
        
        // Ensure storage directory exists
        const storageDir = path.join(__dirname, '../storage/thumbnails');
        await fs.mkdir(storageDir, { recursive: true });
        
        let thumbnailBuffer;
        
        // Handle base64 data URI
        if (req.body.thumbnailData && req.body.thumbnailData.startsWith('data:image')) {
            const base64Data = req.body.thumbnailData.replace(/^data:image\/\w+;base64,/, '');
            thumbnailBuffer = Buffer.from(base64Data, 'base64');
        } 
        // Handle uploaded file
        else if (req.file) {
            thumbnailBuffer = req.file.buffer;
        } else {
            return res.status(400).json({ error: 'No valid thumbnail data' });
        }
        
        // Save the thumbnail
        const thumbnailPath = path.join(storageDir, `${id}.png`);
        await fs.writeFile(thumbnailPath, thumbnailBuffer);
        
        // Generate the URL for this thumbnail
        const thumbnailUrl = `${req.protocol}://${req.get('host')}/api/thumbnail/${id}`;
        
        console.log(`✅ Thumbnail saved for ${id} at ${thumbnailPath}`);
        
        res.json({
            success: true,
            noticeId: id,
            thumbnailUrl,
            message: 'Thumbnail uploaded successfully'
        });
        
    } catch (error) {
        console.error('Failed to upload thumbnail:', error);
        res.status(500).json({ 
            error: 'Failed to upload thumbnail',
            details: error.message 
        });
    }
});

/**
 * POST /api/thumbnail/store-base64
 * Store a base64 thumbnail directly
 */
router.post('/store-base64', express.json({ limit: '10mb' }), async (req, res) => {
    try {
        const { noticeId, caseNumber, thumbnailData } = req.body;
        
        if (!thumbnailData) {
            return res.status(400).json({ error: 'No thumbnail data provided' });
        }
        
        if (!noticeId && !caseNumber) {
            return res.status(400).json({ error: 'Notice ID or case number required' });
        }
        
        // Use noticeId or generate from case number
        const id = noticeId || crypto.createHash('md5').update(caseNumber).digest('hex');
        
        // Ensure storage directory exists
        const storageDir = path.join(__dirname, '../storage/thumbnails');
        await fs.mkdir(storageDir, { recursive: true });
        
        // Handle base64 data URI
        const base64Data = thumbnailData.replace(/^data:image\/\w+;base64,/, '');
        const thumbnailBuffer = Buffer.from(base64Data, 'base64');
        
        // Save the thumbnail
        const thumbnailPath = path.join(storageDir, `${id}.png`);
        await fs.writeFile(thumbnailPath, thumbnailBuffer);
        
        // Generate the URL for this thumbnail
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const thumbnailUrl = `${baseUrl}/api/thumbnail/${id}`;
        
        console.log(`✅ Thumbnail saved for ${id} (${thumbnailBuffer.length} bytes)`);
        
        res.json({
            success: true,
            noticeId: id,
            thumbnailUrl,
            size: thumbnailBuffer.length,
            message: 'Thumbnail stored successfully'
        });
        
    } catch (error) {
        console.error('Failed to store thumbnail:', error);
        res.status(500).json({ 
            error: 'Failed to store thumbnail',
            details: error.message 
        });
    }
});

module.exports = router;