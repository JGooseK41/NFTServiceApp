const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * Register or update a process server after blockchain registration
 * Supports both /api/server/register (singular) and /api/servers/register (plural)
 */
const handleServerRegistration = async (req, res) => {
    let client;
    
    try {
        const {
            server_id,
            wallet_address,
            server_name,
            agency_name,
            physical_address,
            phone_number,
            contact_email,
            website,
            license_number
        } = req.body;
        
        // Validate required fields
        if (!wallet_address || !server_id) {
            return res.status(400).json({
                success: false,
                error: 'wallet_address and server_id are required'
            });
        }
        
        // Ensure process_servers table exists with all required columns
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS process_servers (
                    id SERIAL PRIMARY KEY,
                    server_id VARCHAR(255),
                    wallet_address VARCHAR(255) UNIQUE NOT NULL,
                    server_name VARCHAR(255),
                    agency_name VARCHAR(255),
                    physical_address TEXT,
                    phone_number VARCHAR(50),
                    contact_email VARCHAR(255),
                    website VARCHAR(255),
                    license_number VARCHAR(100),
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
        } catch (tableErr) {
            console.log('Note: Could not create process_servers table:', tableErr.message);
        }

        // Add missing columns if table already exists with different schema
        const alterStatements = [
            'ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS server_id VARCHAR(255)',
            'ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS server_name VARCHAR(255)',
            'ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS physical_address TEXT'
        ];

        for (const stmt of alterStatements) {
            try {
                await pool.query(stmt);
            } catch (alterErr) {
                // Column already exists or other non-fatal error
                console.log('Note: ALTER statement skipped:', alterErr.message);
            }
        }

        client = await pool.connect();

        // Upsert the process server record
        const query = `
            INSERT INTO process_servers (
                server_id,
                wallet_address,
                server_name,
                agency_name,
                physical_address,
                phone_number,
                contact_email,
                website,
                license_number,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved')
            ON CONFLICT (wallet_address) DO UPDATE SET
                server_id = EXCLUDED.server_id,
                server_name = EXCLUDED.server_name,
                agency_name = EXCLUDED.agency_name,
                physical_address = EXCLUDED.physical_address,
                phone_number = EXCLUDED.phone_number,
                contact_email = EXCLUDED.contact_email,
                website = EXCLUDED.website,
                license_number = EXCLUDED.license_number,
                updated_at = NOW()
            RETURNING *
        `;
        
        const values = [
            server_id,
            wallet_address.toLowerCase(),
            server_name || `Server #${server_id}`,
            agency_name || 'Independent Process Server',
            physical_address || '',
            phone_number || '',
            contact_email || '',
            website || '',
            license_number || ''
        ];
        
        const result = await client.query(query, values);

        // Log the registration in audit_logs (non-fatal if it fails)
        try {
            await client.query(`
                INSERT INTO audit_logs (
                    action_type,
                    actor_address,
                    target_id,
                    details
                ) VALUES (
                    'SERVER_REGISTRATION',
                    $1,
                    $2,
                    $3
                )
            `, [
                wallet_address,
                server_id.toString(),
                JSON.stringify({
                    server_name,
                    agency_name,
                    timestamp: new Date().toISOString()
                })
            ]);
        } catch (auditError) {
            console.log('Note: Could not log to audit_logs:', auditError.message);
        }

        res.json({
            success: true,
            server: result.rows[0],
            message: 'Process server registered successfully'
        });
        
    } catch (error) {
        console.error('Error registering process server:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register process server',
            details: error.message,
            code: error.code
        });
    } finally {
        if (client) {
            client.release();
        }
    }
};

// Register all route variations (different frontends use different paths)
router.post('/api/server/register', handleServerRegistration);
router.post('/api/servers/register', handleServerRegistration);
router.post('/api/registerServer', handleServerRegistration);  // camelCase version used by some frontends

/**
 * Get process server details by wallet address or server ID
 */
router.get('/api/servers/:identifier', async (req, res) => {
    let client;
    
    try {
        const { identifier } = req.params;
        
        client = await pool.connect();
        
        // Check if identifier is a number (server_id) or address
        const isServerId = !isNaN(identifier);
        
        const query = isServerId ? `
            SELECT * FROM process_servers WHERE server_id = $1
        ` : `
            SELECT * FROM process_servers WHERE LOWER(wallet_address) = LOWER($1)
        `;
        
        const result = await client.query(query, [identifier]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Process server not found'
            });
        }
        
        res.json({
            success: true,
            server: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error fetching process server:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch process server'
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

module.exports = router;