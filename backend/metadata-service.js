// NFT Metadata Service - Serves TRC-721 compliant metadata via PostgreSQL
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('./db');

// In-memory cache for performance (avoids repeated DB reads)
const metadataCache = new Map();
const MAX_CACHE_SIZE = 500;

// Auto-create nft_metadata table on startup
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS nft_metadata (
                id VARCHAR(64) PRIMARY KEY,
                metadata JSONB NOT NULL,
                case_number VARCHAR(255),
                recipient_address VARCHAR(255),
                ipfs_hash VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('nft_metadata table ready');
    } catch (err) {
        console.error('Failed to create nft_metadata table:', err.message);
    }
})();

/**
 * GET /api/metadata/:id
 * Serve metadata for a specific NFT by storage ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check in-memory cache first
        if (metadataCache.has(id)) {
            res.set('Cache-Control', 'public, max-age=3600');
            return res.json(metadataCache.get(id));
        }

        // Query PostgreSQL
        const result = await pool.query(
            'SELECT metadata FROM nft_metadata WHERE id = $1',
            [id]
        );

        if (result.rows.length > 0) {
            const metadata = result.rows[0].metadata;

            // Cache it
            if (metadataCache.size >= MAX_CACHE_SIZE) {
                const firstKey = metadataCache.keys().next().value;
                metadataCache.delete(firstKey);
            }
            metadataCache.set(id, metadata);

            res.set('Cache-Control', 'public, max-age=3600');
            return res.json(metadata);
        }

        // Fallback: generate default metadata (backwards compat for old tokenId-based lookups)
        const metadata = generateDefaultMetadata(id);

        res.set('Cache-Control', 'public, max-age=3600');
        res.json(metadata);

    } catch (error) {
        console.error('Failed to serve metadata:', error);
        res.status(500).json({ error: 'Failed to serve metadata' });
    }
});

/**
 * POST /api/metadata/store
 * Store metadata JSON in PostgreSQL, return HTTPS URL
 */
router.post('/store', express.json(), async (req, res) => {
    try {
        const { metadata, caseNumber, recipientAddress, ipfsHash } = req.body;

        if (!metadata) {
            return res.status(400).json({ error: 'metadata is required' });
        }

        // Generate a unique ID
        const id = crypto.randomBytes(16).toString('hex');

        // Insert into PostgreSQL
        await pool.query(
            `INSERT INTO nft_metadata (id, metadata, case_number, recipient_address, ipfs_hash)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, JSON.stringify(metadata), caseNumber || null, recipientAddress || null, ipfsHash || null]
        );

        // Cache it immediately
        if (metadataCache.size >= MAX_CACHE_SIZE) {
            const firstKey = metadataCache.keys().next().value;
            metadataCache.delete(firstKey);
        }
        metadataCache.set(id, metadata);

        // Build the HTTPS URL
        const baseUrl = process.env.BASE_URL || 'https://nftserviceapp.onrender.com';
        const url = `${baseUrl}/api/metadata/${id}`;

        res.json({
            success: true,
            id,
            url,
            message: 'Metadata stored successfully'
        });

    } catch (error) {
        console.error('Failed to store metadata:', error);
        res.status(500).json({ error: 'Failed to store metadata' });
    }
});

/**
 * Generate default metadata for backwards-compatible lookups
 */
function generateDefaultMetadata(tokenId) {
    return {
        name: `Legal Notice #${tokenId}`,
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
        image: `https://nftserviceapp.onrender.com/api/thumbnail/${tokenId}`,
        external_url: `https://blockserved.com?case=${encodeURIComponent(tokenId)}`,
        background_color: "1a1a2e",
        attributes: [
            { trait_type: 'Type', value: 'Legal Notice' },
            { trait_type: 'Status', value: 'Delivered' },
            { trait_type: 'Verification', value: 'Blockchain Verified' }
        ]
    };
}

module.exports = router;
