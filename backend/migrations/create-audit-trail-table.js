/**
 * Migration: Create notice audit trail table
 * Stores detailed audit information when recipients view and sign for notices
 */

const { Pool } = require('pg');

async function createAuditTrailTable() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });
    
    try {
        console.log('Creating notice audit trail table...');
        
        // Create the audit trail table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notice_audit_trail (
                id SERIAL PRIMARY KEY,
                notice_id VARCHAR(255),
                document_id VARCHAR(255),
                case_number VARCHAR(255),
                recipient_address VARCHAR(42) NOT NULL,
                
                -- Timestamps
                viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                signed_at TIMESTAMP,
                
                -- Transaction info
                tx_id VARCHAR(255),
                signature_tx_id VARCHAR(255),
                
                -- Geolocation data
                ip_address VARCHAR(45),
                city VARCHAR(100),
                region VARCHAR(100),
                country VARCHAR(100),
                country_code VARCHAR(10),
                postal VARCHAR(20),
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                timezone VARCHAR(50),
                isp VARCHAR(255),
                
                -- Browser/Device info
                user_agent TEXT,
                language VARCHAR(20),
                platform VARCHAR(50),
                screen_resolution VARCHAR(20),
                referrer TEXT,
                
                -- Additional metadata
                metadata JSONB,
                
                -- Indexes
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Create indexes for efficient querying
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_notice_id 
            ON notice_audit_trail(notice_id);
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_document_id 
            ON notice_audit_trail(document_id);
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_case_number 
            ON notice_audit_trail(case_number);
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_recipient 
            ON notice_audit_trail(recipient_address);
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_viewed_at 
            ON notice_audit_trail(viewed_at);
        `);
        
        // Add signature tracking columns to served_notices if not exists
        await pool.query(`
            ALTER TABLE served_notices 
            ADD COLUMN IF NOT EXISTS signature_timestamp TIMESTAMP;
        `);
        
        await pool.query(`
            ALTER TABLE served_notices 
            ADD COLUMN IF NOT EXISTS signature_tx_id VARCHAR(255);
        `);
        
        console.log('✅ Audit trail table created successfully');
        
    } catch (error) {
        console.error('Error creating audit trail table:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run migration if called directly
if (require.main === module) {
    createAuditTrailTable()
        .then(() => {
            console.log('Migration completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = createAuditTrailTable;