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
router.get('/', async (req, res) => {
    // Redirect root to /list handler
    return listServers(req, res);
});

router.get('/list', async (req, res) => {
    return listServers(req, res);
});

async function listServers(req, res) {
    let client;
    try {
        client = await pool.connect();

        const result = await client.query(`
            SELECT *
            FROM process_servers
            ORDER BY created_at DESC
        `);

        // Map DB column names to what the frontend expects (fallbacks for schema variations)
        const servers = result.rows.map(row => ({
            id: row.id,
            wallet_address: row.wallet_address,
            full_name: row.agency_name || row.name || 'Unknown',
            agency: row.agency_name || row.agency || row.name || 'N/A',
            email: row.contact_email || row.email,
            phone: row.phone_number || row.phone,
            website: row.website,
            license_number: row.license_number,
            jurisdictions: row.jurisdictions || row.jurisdiction,
            status: row.status,
            is_active: row.status === 'active' || row.status === 'approved',
            total_cases: row.total_notices_served || 0,
            signed_cases: 0,
            last_activity: row.updated_at,
            created_at: row.created_at,
            updated_at: row.updated_at
        }));

        res.json({
            success: true,
            servers
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
}

// UPDATE a process server
router.post('/update', async (req, res) => {
    let client;
    try {
        const {
            wallet_address,
            agency_name,
            contact_email,
            phone_number,
            website,
            license_number,
            jurisdictions,
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
                agency_name = COALESCE($2, agency_name),
                contact_email = COALESCE($3, contact_email),
                phone_number = COALESCE($4, phone_number),
                website = COALESCE($5, website),
                license_number = COALESCE($6, license_number),
                jurisdictions = COALESCE($7, jurisdictions),
                status = COALESCE($8, status),
                updated_at = NOW()
            WHERE wallet_address = $1
            RETURNING *
        `, [wallet_address, agency_name, contact_email, phone_number, website, license_number, jurisdictions, status]);
        
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