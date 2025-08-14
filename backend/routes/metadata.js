/**
 * Metadata hosting endpoint for NFT metadata
 * Provides a fallback when IPFS is not available
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// In-memory store for metadata (in production, use database)
const metadataStore = new Map();

// Host metadata
router.post('/', async (req, res) => {
    try {
        const metadata = req.body;
        
        // Validate metadata structure
        if (!metadata.name || !metadata.description) {
            return res.status(400).json({ 
                error: 'Invalid metadata: name and description required' 
            });
        }
        
        // Generate unique ID for metadata
        const metadataId = crypto.randomBytes(16).toString('hex');
        
        // Store metadata
        metadataStore.set(metadataId, {
            ...metadata,
            timestamp: new Date().toISOString()
        });
        
        // Generate URL
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const url = `${protocol}://${host}/api/metadata/${metadataId}`;
        
        console.log(`✅ Metadata hosted: ${metadataId}`);
        
        res.json({ 
            success: true, 
            id: metadataId,
            url: url
        });
        
    } catch (error) {
        console.error('Error hosting metadata:', error);
        res.status(500).json({ error: 'Failed to host metadata' });
    }
});

// Retrieve metadata
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const metadata = metadataStore.get(id);
        
        if (!metadata) {
            return res.status(404).json({ error: 'Metadata not found' });
        }
        
        // Return metadata with proper headers for NFT wallets
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(metadata);
        
    } catch (error) {
        console.error('Error retrieving metadata:', error);
        res.status(500).json({ error: 'Failed to retrieve metadata' });
    }
});

// List all metadata (admin only - add authentication in production)
router.get('/', (req, res) => {
    try {
        const metadataList = Array.from(metadataStore.entries()).map(([id, data]) => ({
            id,
            name: data.name,
            timestamp: data.timestamp
        }));
        
        res.json({
            count: metadataList.length,
            metadata: metadataList
        });
        
    } catch (error) {
        console.error('Error listing metadata:', error);
        res.status(500).json({ error: 'Failed to list metadata' });
    }
});

module.exports = router;