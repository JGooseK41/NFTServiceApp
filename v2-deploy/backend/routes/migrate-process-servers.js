/**
 * Run migration to create process_servers table
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

router.get('/run', async (req, res) => {
    let client;
    
    try {
        client = await pool.connect();
        
        // Create process_servers table
        await client.query(`
            CREATE TABLE IF NOT EXISTS process_servers (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255),
                agency VARCHAR(255),
                email VARCHAR(255),
                phone VARCHAR(50),
                server_id VARCHAR(100) UNIQUE,
                status VARCHAR(50) DEFAULT 'pending',
                jurisdiction VARCHAR(255),
                license_number VARCHAR(100),
                notes TEXT,
                registration_data JSONB,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                approved_at TIMESTAMP,
                approved_by VARCHAR(255)
            )
        `);
        
        // Create indexes
        await client.query(`CREATE INDEX IF NOT EXISTS idx_process_servers_wallet ON process_servers(wallet_address)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_process_servers_status ON process_servers(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_process_servers_agency ON process_servers(agency)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_process_servers_created ON process_servers(created_at DESC)`);
        
        // Create update trigger
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);
        
        // Check if trigger exists before creating
        const triggerExists = await client.query(`
            SELECT 1 FROM pg_trigger WHERE tgname = 'update_process_servers_updated_at'
        `);
        
        if (triggerExists.rows.length === 0) {
            await client.query(`
                CREATE TRIGGER update_process_servers_updated_at 
                BEFORE UPDATE ON process_servers 
                FOR EACH ROW 
                EXECUTE PROCEDURE update_updated_at_column()
            `);
        }
        
        res.json({
            success: true,
            message: 'Process servers table created successfully'
        });
        
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            detail: error.detail
        });
    } finally {
        if (client) client.release();
    }
});

module.exports = router;