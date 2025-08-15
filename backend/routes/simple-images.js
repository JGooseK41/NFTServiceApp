/**
 * Simple Images API
 * Straightforward endpoints for storing and retrieving notice images
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * Store images for a notice
 * POST /api/images
 */
router.post('/', async (req, res) => {
    const {
        notice_id,
        server_address,
        recipient_address,
        alert_image,
        document_image,
        alert_thumbnail,
        document_thumbnail,
        transaction_hash
    } = req.body;

    try {
        // Upsert - insert or update if exists
        const query = `
            INSERT INTO images (
                notice_id, server_address, recipient_address,
                alert_image, document_image, alert_thumbnail, document_thumbnail,
                transaction_hash
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (notice_id) 
            DO UPDATE SET
                alert_image = COALESCE(EXCLUDED.alert_image, images.alert_image),
                document_image = COALESCE(EXCLUDED.document_image, images.document_image),
                alert_thumbnail = COALESCE(EXCLUDED.alert_thumbnail, images.alert_thumbnail),
                document_thumbnail = COALESCE(EXCLUDED.document_thumbnail, images.document_thumbnail),
                transaction_hash = COALESCE(EXCLUDED.transaction_hash, images.transaction_hash),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;

        const result = await pool.query(query, [
            notice_id,
            server_address,
            recipient_address,
            alert_image,
            document_image,
            alert_thumbnail,
            document_thumbnail,
            transaction_hash
        ]);

        res.json({
            success: true,
            image: result.rows[0]
        });
    } catch (error) {
        console.error('Error storing images:', error);
        res.status(500).json({ error: 'Failed to store images' });
    }
});

/**
 * Get images for a specific notice
 * GET /api/images/:noticeId
 */
router.get('/:noticeId', async (req, res) => {
    const { noticeId } = req.params;
    const walletAddress = req.headers['x-wallet-address'];

    if (!walletAddress) {
        return res.status(401).json({ error: 'Wallet address required' });
    }

    try {
        // Get image if user is either the server or recipient
        const query = `
            SELECT * FROM images 
            WHERE notice_id = $1 
            AND (server_address = $2 OR recipient_address = $2)
            LIMIT 1;
        `;

        const result = await pool.query(query, [noticeId, walletAddress]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Image not found or access denied' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching image:', error);
        res.status(500).json({ error: 'Failed to fetch image' });
    }
});

/**
 * Get all images for a wallet (as server or recipient)
 * GET /api/images
 */
router.get('/', async (req, res) => {
    const walletAddress = req.headers['x-wallet-address'];
    const role = req.query.role; // 'server', 'recipient', or 'all'

    if (!walletAddress) {
        return res.status(401).json({ error: 'Wallet address required' });
    }

    try {
        let query;
        let params = [walletAddress];

        if (role === 'server') {
            query = `
                SELECT * FROM images 
                WHERE server_address = $1
                ORDER BY created_at DESC;
            `;
        } else if (role === 'recipient') {
            query = `
                SELECT * FROM images 
                WHERE recipient_address = $1
                ORDER BY created_at DESC;
            `;
        } else {
            // Get all where user is either server or recipient
            query = `
                SELECT * FROM images 
                WHERE server_address = $1 OR recipient_address = $1
                ORDER BY created_at DESC;
            `;
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching images:', error);
        res.status(500).json({ error: 'Failed to fetch images' });
    }
});

/**
 * Get images by transaction hash
 * GET /api/images/tx/:txHash
 */
router.get('/tx/:txHash', async (req, res) => {
    const { txHash } = req.params;
    const walletAddress = req.headers['x-wallet-address'];

    if (!walletAddress) {
        return res.status(401).json({ error: 'Wallet address required' });
    }

    try {
        const query = `
            SELECT * FROM images 
            WHERE transaction_hash = $1
            AND (server_address = $2 OR recipient_address = $2);
        `;

        const result = await pool.query(query, [txHash, walletAddress]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching images by tx:', error);
        res.status(500).json({ error: 'Failed to fetch images' });
    }
});

/**
 * Delete images for a notice (server only)
 * DELETE /api/images/:noticeId
 */
router.delete('/:noticeId', async (req, res) => {
    const { noticeId } = req.params;
    const walletAddress = req.headers['x-wallet-address'];

    if (!walletAddress) {
        return res.status(401).json({ error: 'Wallet address required' });
    }

    try {
        // Only server can delete
        const query = `
            DELETE FROM images 
            WHERE notice_id = $1 AND server_address = $2
            RETURNING *;
        `;

        const result = await pool.query(query, [noticeId, walletAddress]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Image not found or access denied' });
        }

        res.json({
            success: true,
            deleted: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

module.exports = router;