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
                    `You have been served a legal document that requires your attention.\n\n` +
                    `📋 ACCESS YOUR DOCUMENT AT:\n` +
                    `👉 https://www.blockserved.com\n\n` +
                    `HOW TO CONNECT:\n` +
                    `• Desktop: Visit https://www.blockserved.com and connect your wallet\n` +
                    `• Mobile: Open the browser inside your wallet app and go to https://www.blockserved.com\n\n` +
                    `Your document will be available immediately after connecting.\n\n` +
                    `💡 FREE TO SIGN: The sender has covered your transaction fees.\n` +
                    `⏰ Legal notices may have deadlines — please review promptly.\n\n` +
                    `✅ This NFT is your proof of service on the blockchain.`,
        image: `${baseUrl}/api/thumbnail/${tokenId}`,
        external_url: `https://blockserved.com?case=${encodeURIComponent(tokenId)}`,
        background_color: "1a1a2e",
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
                trait_type: 'Service Date',
                display_type: 'date',
                value: new Date().toLocaleDateString()
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