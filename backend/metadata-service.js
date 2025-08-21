// NFT Metadata Service - Serves TRC-721 compliant metadata
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

// Cache for metadata
const metadataCache = new Map();

/**
 * GET /api/metadata/:tokenId
 * Serve metadata for a specific NFT token
 */
router.get('/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        
        // Check cache first
        if (metadataCache.has(tokenId)) {
            const cached = metadataCache.get(tokenId);
            return res.json(cached);
        }
        
        // Try to load from database or storage
        let metadata;
        try {
            // Check if we have stored metadata
            const metadataPath = path.join(__dirname, '../storage/metadata', `${tokenId}.json`);
            const metadataJson = await fs.readFile(metadataPath, 'utf8');
            metadata = JSON.parse(metadataJson);
        } catch (e) {
            // Generate default metadata
            metadata = await generateDefaultMetadata(tokenId);
        }
        
        // Cache it
        if (metadataCache.size > 100) {
            const firstKey = metadataCache.keys().next().value;
            metadataCache.delete(firstKey);
        }
        metadataCache.set(tokenId, metadata);
        
        // Return with proper headers
        res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.json(metadata);
        
    } catch (error) {
        console.error('Failed to serve metadata:', error);
        res.status(500).json({ error: 'Failed to generate metadata' });
    }
});

/**
 * POST /api/metadata/store
 * Store metadata for a token
 */
router.post('/store', express.json(), async (req, res) => {
    try {
        const { tokenId, metadata } = req.body;
        
        if (!tokenId || !metadata) {
            return res.status(400).json({ error: 'Token ID and metadata required' });
        }
        
        // Ensure storage directory exists
        const storageDir = path.join(__dirname, '../storage/metadata');
        await fs.mkdir(storageDir, { recursive: true });
        
        // Store the metadata
        const metadataPath = path.join(storageDir, `${tokenId}.json`);
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        
        // Clear cache for this token
        metadataCache.delete(tokenId);
        
        // Generate the metadata URL
        const baseUrl = process.env.BASE_URL || `https://nft-legal-service.netlify.app`;
        const metadataUrl = `${baseUrl}/api/metadata/${tokenId}`;
        
        res.json({
            success: true,
            tokenId,
            metadataUrl,
            message: 'Metadata stored successfully'
        });
        
    } catch (error) {
        console.error('Failed to store metadata:', error);
        res.status(500).json({ error: 'Failed to store metadata' });
    }
});

/**
 * Generate default metadata for a token
 */
async function generateDefaultMetadata(tokenId, agency) {
    const baseUrl = process.env.BASE_URL || 'https://nft-legal-service.netlify.app';
    
    return {
        name: `${agency || 'Legal Notice'} #${tokenId}`,
        description: `⚖️ OFFICIAL LEGAL NOTICE ⚖️\n\n` +
                    `You have been served with an official legal document that requires your attention.\n\n` +
                    `📋 WHAT THIS MEANS:\n` +
                    `This NFT represents legal service of process. You have been officially notified ` +
                    `of a legal matter that may require your response or appearance.\n\n` +
                    `🔓 TO ACCESS YOUR FULL DOCUMENT:\n` +
                    `1. Visit https://www.BlockServed.com\n` +
                    `2. Connect this wallet\n` +
                    `3. View and download your complete legal notice\n` +
                    `4. Follow the instructions provided in the document\n\n` +
                    `⏰ IMPORTANT: Legal notices often have deadlines. Failure to respond within ` +
                    `the required timeframe may result in default judgments or other legal consequences.\n\n` +
                    `🔒 SECURITY: Your full document is encrypted and can only be accessed by connecting ` +
                    `this wallet to BlockServed.com\n\n` +
                    `✅ PROOF OF SERVICE: This NFT serves as immutable proof that you were properly ` +
                    `served on the blockchain at the timestamp shown in the transaction.`,
        image: `${baseUrl}/api/thumbnail/${tokenId}`,
        external_url: `https://blockserved.com/notice/${tokenId}`,
        attributes: [
            {
                trait_type: 'Type',
                value: 'Legal Notice'
            },
            {
                trait_type: 'Status',
                value: 'Delivered'
            },
            {
                trait_type: 'Verification',
                value: 'Blockchain Verified'
            },
            {
                trait_type: 'Token ID',
                value: tokenId
            }
        ],
        properties: {
            category: 'legal',
            files: [
                {
                    uri: `${baseUrl}/api/thumbnail/${tokenId}`,
                    type: 'image/png'
                }
            ]
        }
    };
}

module.exports = router;