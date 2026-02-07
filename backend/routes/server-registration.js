const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Email service for notifications
let emailService;
try {
    emailService = require('../services/email-service');
} catch (err) {
    console.log('Email service not available:', err.message);
}

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * Ensure process_servers table exists with all required columns
 */
async function ensureTableExists() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS process_servers (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(255) UNIQUE NOT NULL,
                agency_name VARCHAR(255) NOT NULL,
                contact_email VARCHAR(255) NOT NULL,
                phone_number VARCHAR(50) NOT NULL,
                server_name VARCHAR(255),
                physical_address TEXT,
                website VARCHAR(255),
                license_number VARCHAR(100),
                status VARCHAR(50) DEFAULT 'approved',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
    } catch (tableErr) {
        console.log('Note: Could not create process_servers table:', tableErr.message);
    }

    // Add potentially missing columns if table already exists
    const alterStatements = [
        'ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS agency_name VARCHAR(255)',
        'ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255)',
        'ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50)',
        'ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS server_name VARCHAR(255)',
        'ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS physical_address TEXT',
        'ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS website VARCHAR(255)',
        'ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS license_number VARCHAR(100)',
        'ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'approved\'',
        'ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()',
        'ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()'
    ];

    for (const stmt of alterStatements) {
        try {
            await pool.query(stmt);
        } catch (alterErr) {
            // Column already exists or other non-fatal error
        }
    }
}

// Run table check on module load
ensureTableExists();

/**
 * POST /api/server/register
 * Register a NEW process server (first-time only)
 *
 * Required fields:
 * - wallet_address: TRON wallet address (becomes permanent server ID)
 * - agency_name: Agency name (PERMANENT - cannot be changed after registration)
 * - contact_email: Admin contact email (can be updated later)
 * - phone_number: Admin contact phone (can be updated later)
 *
 * Optional fields:
 * - server_name, physical_address, website, license_number
 */
const handleServerRegistration = async (req, res) => {
    let client;

    try {
        const {
            wallet_address,
            agency_name,
            contact_email,
            phone_number,
            server_name,
            physical_address,
            website,
            license_number
        } = req.body;

        // Validate required fields
        const missingFields = [];
        if (!wallet_address) missingFields.push('wallet_address');
        if (!agency_name) missingFields.push('agency_name');
        if (!contact_email) missingFields.push('contact_email');
        if (!phone_number) missingFields.push('phone_number');

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`,
                required_fields: ['wallet_address', 'agency_name', 'contact_email', 'phone_number']
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contact_email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Validate phone number (basic check - at least 10 digits)
        const phoneDigits = phone_number.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
            return res.status(400).json({
                success: false,
                error: 'Phone number must have at least 10 digits'
            });
        }

        client = await pool.connect();

        // Check if wallet is already registered
        const existingCheck = await client.query(
            'SELECT wallet_address, agency_name FROM process_servers WHERE LOWER(wallet_address) = LOWER($1)',
            [wallet_address]
        );

        if (existingCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'This wallet address is already registered',
                existing_agency: existingCheck.rows[0].agency_name,
                message: 'Use PUT /api/server/contact to update contact information'
            });
        }

        // Insert new server registration (agency_name is permanent)
        const query = `
            INSERT INTO process_servers (
                wallet_address,
                agency_name,
                contact_email,
                phone_number,
                server_name,
                physical_address,
                website,
                license_number,
                status,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'approved', NOW())
            RETURNING *
        `;

        const values = [
            wallet_address.toLowerCase(),
            agency_name.trim(),
            contact_email.trim().toLowerCase(),
            phone_number.trim(),
            server_name || null,
            physical_address || null,
            website || null,
            license_number || null
        ];

        const result = await client.query(query, values);

        // Log the registration in audit_logs
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
                wallet_address,
                JSON.stringify({
                    agency_name,
                    contact_email,
                    timestamp: new Date().toISOString()
                })
            ]);
        } catch (auditError) {
            console.log('Note: Could not log to audit_logs:', auditError.message);
        }

        // Send email notifications (non-blocking)
        if (emailService) {
            const serverData = {
                wallet_address: wallet_address.toLowerCase(),
                agency_name: agency_name.trim(),
                contact_email: contact_email.trim().toLowerCase(),
                phone_number: phone_number.trim(),
                website: website || null,
                license_number: license_number || null
            };

            // Notify admin of new registration
            emailService.notifyNewServerRegistration(serverData)
                .then(result => {
                    if (result.success) {
                        console.log('Admin notified of new server registration');
                    }
                })
                .catch(err => console.log('Failed to notify admin:', err.message));

            // Send welcome email to server
            emailService.sendServerWelcomeEmail(serverData)
                .then(result => {
                    if (result.success) {
                        console.log('Welcome email sent to server');
                    }
                })
                .catch(err => console.log('Failed to send welcome email:', err.message));
        }

        res.status(201).json({
            success: true,
            server: result.rows[0],
            message: 'Process server registered successfully. Agency name is now permanently linked to this wallet.'
        });

    } catch (error) {
        console.error('Error registering process server:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register process server',
            details: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * PUT /api/server/contact
 * Update server contact information (NOT agency name)
 *
 * Agency name cannot be changed - it is permanently linked to the wallet
 */
router.put('/api/server/contact', async (req, res) => {
    let client;

    try {
        const {
            wallet_address,
            contact_email,
            phone_number,
            server_name,
            physical_address,
            website,
            license_number
        } = req.body;

        if (!wallet_address) {
            return res.status(400).json({
                success: false,
                error: 'wallet_address is required'
            });
        }

        // At least one field to update
        if (!contact_email && !phone_number && !server_name && !physical_address && !website && !license_number) {
            return res.status(400).json({
                success: false,
                error: 'At least one field to update is required'
            });
        }

        // Validate email if provided
        if (contact_email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contact_email)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid email format'
                });
            }
        }

        // Validate phone if provided
        if (phone_number) {
            const phoneDigits = phone_number.replace(/\D/g, '');
            if (phoneDigits.length < 10) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number must have at least 10 digits'
                });
            }
        }

        client = await pool.connect();

        // Check if server exists
        const existingCheck = await client.query(
            'SELECT * FROM process_servers WHERE LOWER(wallet_address) = LOWER($1)',
            [wallet_address]
        );

        if (existingCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Server not found. Please register first.'
            });
        }

        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (contact_email) {
            updates.push(`contact_email = $${paramCount++}`);
            values.push(contact_email.trim().toLowerCase());
        }
        if (phone_number) {
            updates.push(`phone_number = $${paramCount++}`);
            values.push(phone_number.trim());
        }
        if (server_name !== undefined) {
            updates.push(`server_name = $${paramCount++}`);
            values.push(server_name);
        }
        if (physical_address !== undefined) {
            updates.push(`physical_address = $${paramCount++}`);
            values.push(physical_address);
        }
        if (website !== undefined) {
            updates.push(`website = $${paramCount++}`);
            values.push(website);
        }
        if (license_number !== undefined) {
            updates.push(`license_number = $${paramCount++}`);
            values.push(license_number);
        }

        updates.push(`updated_at = NOW()`);
        values.push(wallet_address);

        const query = `
            UPDATE process_servers
            SET ${updates.join(', ')}
            WHERE LOWER(wallet_address) = LOWER($${paramCount})
            RETURNING *
        `;

        const result = await client.query(query, values);

        res.json({
            success: true,
            server: result.rows[0],
            message: 'Contact information updated successfully'
        });

    } catch (error) {
        console.error('Error updating server contact:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update contact information',
            details: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

/**
 * GET /api/servers/:identifier
 * Get process server details by wallet address
 */
router.get('/api/servers/:identifier', async (req, res) => {
    let client;

    try {
        const { identifier } = req.params;

        client = await pool.connect();

        const query = `
            SELECT
                wallet_address,
                agency_name,
                contact_email,
                phone_number,
                server_name,
                physical_address,
                website,
                license_number,
                status,
                created_at,
                updated_at
            FROM process_servers
            WHERE LOWER(wallet_address) = LOWER($1)
        `;

        const result = await client.query(query, [identifier]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Process server not found',
                message: 'This wallet is not registered. Use POST /api/server/register to register.'
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

/**
 * GET /api/server/check/:walletAddress
 * Quick check if a wallet is registered (for frontend validation)
 */
router.get('/api/server/check/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;

        const result = await pool.query(
            'SELECT wallet_address, agency_name FROM process_servers WHERE LOWER(wallet_address) = LOWER($1)',
            [walletAddress]
        );

        if (result.rows.length === 0) {
            return res.json({
                registered: false,
                message: 'Wallet not registered'
            });
        }

        res.json({
            registered: true,
            agency_name: result.rows[0].agency_name
        });

    } catch (error) {
        console.error('Error checking server registration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check registration'
        });
    }
});

/**
 * POST /api/server/approve
 * Admin endpoint to mark a server as blockchain-approved and send notification
 * Call this after granting the role on the blockchain
 */
router.post('/api/server/approve', async (req, res) => {
    try {
        const { wallet_address, admin_key } = req.body;

        // Simple admin key validation (you may want to enhance this)
        const ADMIN_KEY = process.env.ADMIN_API_KEY || 'default-admin-key';
        if (admin_key !== ADMIN_KEY) {
            return res.status(403).json({
                success: false,
                error: 'Invalid admin key'
            });
        }

        if (!wallet_address) {
            return res.status(400).json({
                success: false,
                error: 'wallet_address is required'
            });
        }

        // Get server data
        const result = await pool.query(
            'SELECT * FROM process_servers WHERE LOWER(wallet_address) = LOWER($1)',
            [wallet_address]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Server not found'
            });
        }

        const serverData = result.rows[0];

        // Update status to approved
        await pool.query(
            'UPDATE process_servers SET status = $1, updated_at = NOW() WHERE LOWER(wallet_address) = LOWER($2)',
            ['blockchain_approved', wallet_address]
        );

        // Send approval notification email
        if (emailService) {
            emailService.notifyServerApproved(serverData)
                .then(result => {
                    if (result.success) {
                        console.log('Approval notification sent to server');
                    }
                })
                .catch(err => console.log('Failed to send approval notification:', err.message));
        }

        res.json({
            success: true,
            message: 'Server marked as approved and notification sent',
            server: serverData.agency_name
        });

    } catch (error) {
        console.error('Error approving server:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve server'
        });
    }
});

// Register route handlers
router.post('/api/server/register', handleServerRegistration);
router.post('/api/servers/register', handleServerRegistration);

module.exports = router;
