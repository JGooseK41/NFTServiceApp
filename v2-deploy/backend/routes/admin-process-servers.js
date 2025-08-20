/**
 * Admin API for managing process servers
 * Provides simple endpoints for the admin dashboard
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// GET all process servers for admin dashboard
router.get('/list', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        
        const result = await client.query(`
            SELECT 
                id,
                wallet_address,
                name,
                agency,
                email,
                phone,
                server_id,
                status,
                license_number,
                jurisdiction,
                created_at,
                updated_at
            FROM process_servers
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            servers: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

// UPDATE a process server
router.post('/update', async (req, res) => {
    let client;
    try {
        const {
            wallet_address,
            name,
            agency,
            email,
            phone,
            license_number,
            jurisdiction,
            status
        } = req.body;
        
        if (!wallet_address) {
            return res.status(400).json({
                success: false,
                error: 'Wallet address is required'
            });
        }
        
        client = await pool.connect();
        
        const result = await client.query(`
            UPDATE process_servers
            SET 
                name = $2,
                agency = $3,
                email = $4,
                phone = $5,
                license_number = $6,
                jurisdiction = $7,
                status = $8,
                updated_at = NOW()
            WHERE wallet_address = $1
            RETURNING *
        `, [wallet_address, name, agency, email, phone, license_number, jurisdiction, status]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Process server not found'
            });
        }
        
        res.json({
            success: true,
            server: result.rows[0],
            message: 'Process server updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating server:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

// DELETE a process server
router.post('/delete', async (req, res) => {
    let client;
    try {
        const { wallet_address } = req.body;
        
        if (!wallet_address) {
            return res.status(400).json({
                success: false,
                error: 'Wallet address is required'
            });
        }
        
        client = await pool.connect();
        
        const result = await client.query(`
            DELETE FROM process_servers
            WHERE wallet_address = $1
            RETURNING *
        `, [wallet_address]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Process server not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Process server deleted',
            server: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error deleting server:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

module.exports = router;