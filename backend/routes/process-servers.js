/**
 * Process Server Management Routes
 * Full CRUD operations for admin management of process servers
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { formatServerId } = require('../utils/server-id-formatter');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * GET /api/process-servers
 * Get all process servers with their details
 */
router.get('/', async (req, res) => {
    let client;
    
    try {
        client = await pool.connect();
        
        // Get all process servers from the database
        const result = await client.query(`
            SELECT 
                ps.*,
                COUNT(DISTINCT sn.notice_id) as total_notices_served,
                COUNT(DISTINCT CASE WHEN sn.created_at > NOW() - INTERVAL '30 days' THEN sn.notice_id END) as notices_last_30_days,
                MAX(sn.created_at) as last_activity
            FROM process_servers ps
            LEFT JOIN served_notices sn ON ps.wallet_address = sn.server_address
            GROUP BY ps.id
            ORDER BY ps.created_at DESC
        `);
        
        // Format server IDs for display
        const formattedServers = result.rows.map(server => ({
            ...server,
            display_server_id: server.server_id || 'Pending'
        }));
        
        res.json({
            success: true,
            servers: formattedServers,
            total: formattedServers.length
        });
        
    } catch (error) {
        console.error('Error fetching process servers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * GET /api/process-servers/:walletAddress
 * Get specific process server details
 */
router.get('/:walletAddress', async (req, res) => {
    let client;
    
    try {
        const { walletAddress } = req.params;
        client = await pool.connect();
        
        // Get process server details
        const serverResult = await client.query(`
            SELECT * FROM process_servers 
            WHERE wallet_address = $1
        `, [walletAddress]);
        
        if (serverResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Process server not found'
            });
        }
        
        const server = serverResult.rows[0];
        
        // Get recent activity
        const activityResult = await client.query(`
            SELECT 
                notice_id, 
                recipient_address, 
                notice_type, 
                case_number, 
                created_at
            FROM served_notices 
            WHERE server_address = $1
            ORDER BY created_at DESC
            LIMIT 10
        `, [walletAddress]);
        
        // Get statistics
        const statsResult = await client.query(`
            SELECT 
                COUNT(DISTINCT notice_id) as total_notices,
                COUNT(DISTINCT recipient_address) as unique_recipients,
                COUNT(DISTINCT case_number) as unique_cases,
                MIN(created_at) as first_notice,
                MAX(created_at) as last_notice
            FROM served_notices
            WHERE server_address = $1
        `, [walletAddress]);
        
        res.json({
            success: true,
            server: server,
            recentActivity: activityResult.rows,
            statistics: statsResult.rows[0]
        });
        
    } catch (error) {
        console.error('Error fetching process server:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * POST /api/process-servers
 * Create or update process server
 */
router.post('/', async (req, res) => {
    let client;
    
    try {
        const {
            wallet_address,
            name,
            agency,
            email,
            phone,
            server_id,
            status,
            jurisdiction,
            license_number,
            notes
        } = req.body;
        
        if (!wallet_address) {
            return res.status(400).json({
                success: false,
                error: 'Wallet address is required'
            });
        }
        
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Check if exists
        const existing = await client.query(
            'SELECT id FROM process_servers WHERE wallet_address = $1',
            [wallet_address]
        );
        
        let result;
        if (existing.rows.length > 0) {
            // Update existing
            result = await client.query(`
                UPDATE process_servers SET
                    name = COALESCE($2, name),
                    agency = COALESCE($3, agency),
                    email = COALESCE($4, email),
                    phone = COALESCE($5, phone),
                    server_id = COALESCE($6, server_id),
                    status = COALESCE($7, status),
                    jurisdiction = COALESCE($8, jurisdiction),
                    license_number = COALESCE($9, license_number),
                    notes = COALESCE($10, notes),
                    updated_at = NOW()
                WHERE wallet_address = $1
                RETURNING *
            `, [wallet_address, name, agency, email, phone, server_id, status, jurisdiction, license_number, notes]);
        } else {
            // Create new
            result = await client.query(`
                INSERT INTO process_servers (
                    wallet_address, name, agency, email, phone, 
                    server_id, status, jurisdiction, license_number, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `, [wallet_address, name, agency, email, phone, 
                server_id || null,  // Don't generate random IDs - use blockchain IDs
                status || 'pending', jurisdiction, license_number, notes]);
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            server: result.rows[0],
            message: existing.rows.length > 0 ? 'Process server updated' : 'Process server created'
        });
        
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error saving process server:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * PUT /api/process-servers/:walletAddress
 * Update specific process server
 */
router.put('/:walletAddress', async (req, res) => {
    let client;
    
    try {
        const { walletAddress } = req.params;
        const updates = req.body;
        
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Build dynamic update query
        const updateFields = [];
        const values = [walletAddress];
        let paramCount = 2;
        
        for (const [key, value] of Object.entries(updates)) {
            if (key !== 'wallet_address' && value !== undefined) {
                updateFields.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update'
            });
        }
        
        updateFields.push('updated_at = NOW()');
        
        const result = await client.query(`
            UPDATE process_servers 
            SET ${updateFields.join(', ')}
            WHERE wallet_address = $1
            RETURNING *
        `, values);
        
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Process server not found'
            });
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            server: result.rows[0],
            message: 'Process server updated successfully'
        });
        
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error updating process server:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * PUT /api/process-servers/:walletAddress/status
 * Update process server status (approved, suspended, rejected)
 */
router.put('/:walletAddress/status', async (req, res) => {
    let client;
    
    try {
        const { walletAddress } = req.params;
        const { status } = req.body;
        
        // Validate status
        const validStatuses = ['pending', 'approved', 'rejected', 'suspended'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }
        
        client = await pool.connect();
        
        // Update status
        const result = await client.query(`
            UPDATE process_servers 
            SET status = $2, updated_at = NOW()
            WHERE wallet_address = $1
            RETURNING *
        `, [walletAddress, status]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Process server not found'
            });
        }
        
        res.json({
            success: true,
            server: result.rows[0],
            message: `Process server status updated to ${status}`
        });
        
    } catch (error) {
        console.error('Error updating process server status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * DELETE /api/process-servers/:walletAddress
 * Delete process server (soft delete - sets status to 'suspended')
 */
router.delete('/:walletAddress', async (req, res) => {
    let client;
    
    try {
        const { walletAddress } = req.params;
        const { hardDelete } = req.query;
        
        client = await pool.connect();
        
        if (hardDelete === 'true') {
            // Permanent deletion (admin only)
            const result = await client.query(`
                DELETE FROM process_servers 
                WHERE wallet_address = $1
                RETURNING *
            `, [walletAddress]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Process server not found'
                });
            }
            
            res.json({
                success: true,
                message: 'Process server permanently deleted',
                server: result.rows[0]
            });
        } else {
            // Soft delete - just deactivate
            const result = await client.query(`
                UPDATE process_servers 
                SET status = 'deactivated', updated_at = NOW()
                WHERE wallet_address = $1
                RETURNING *
            `, [walletAddress]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Process server not found'
                });
            }
            
            res.json({
                success: true,
                message: 'Process server deactivated',
                server: result.rows[0]
            });
        }
        
    } catch (error) {
        console.error('Error deleting process server:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * GET /api/process-servers/search
 * Search process servers
 */
router.get('/search', async (req, res) => {
    let client;
    
    try {
        const { q, status, jurisdiction } = req.query;
        client = await pool.connect();
        
        let query = `
            SELECT ps.*, 
                   COUNT(DISTINCT sn.notice_id) as total_notices
            FROM process_servers ps
            LEFT JOIN served_notices sn ON ps.wallet_address = sn.server_address
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;
        
        if (q) {
            query += ` AND (
                LOWER(ps.name) LIKE LOWER($${paramCount}) OR 
                LOWER(ps.agency) LIKE LOWER($${paramCount}) OR 
                LOWER(ps.email) LIKE LOWER($${paramCount}) OR 
                ps.wallet_address LIKE $${paramCount} OR
                ps.server_id LIKE $${paramCount}
            )`;
            params.push(`%${q}%`);
            paramCount++;
        }
        
        if (status) {
            query += ` AND ps.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }
        
        if (jurisdiction) {
            query += ` AND ps.jurisdiction = $${paramCount}`;
            params.push(jurisdiction);
            paramCount++;
        }
        
        query += ` GROUP BY ps.id ORDER BY ps.created_at DESC`;
        
        const result = await client.query(query, params);
        
        // Format server IDs for display
        const formattedServers = result.rows.map(server => ({
            ...server,
            display_server_id: server.server_id || 'Pending'
        }));
        
        res.json({
            success: true,
            servers: formattedServers,
            total: formattedServers.length
        });
        
    } catch (error) {
        console.error('Error searching process servers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

module.exports = router;