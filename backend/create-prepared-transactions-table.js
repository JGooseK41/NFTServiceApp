/**
 * Create prepared_transactions table for validation workflow
 */

const { Pool } = require('pg');

async function createTable() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });
    
    let client;
    
    try {
        client = await pool.connect();
        
        console.log('Creating prepared_transactions table...');
        
        // Create table
        await client.query(`
            CREATE TABLE IF NOT EXISTS prepared_transactions (
                transaction_id VARCHAR(255) PRIMARY KEY,
                data JSONB NOT NULL,
                status VARCHAR(50) DEFAULT 'prepared',
                tx_hash VARCHAR(255),
                energy_rented BIGINT,
                created_at TIMESTAMP DEFAULT NOW(),
                executed_at TIMESTAMP,
                expires_at TIMESTAMP NOT NULL
            )
        `);
        
        console.log('✅ Table created successfully');
        
        // Create indexes
        console.log('Creating indexes...');
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_prepared_tx_status 
            ON prepared_transactions(status)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_prepared_tx_expires 
            ON prepared_transactions(expires_at)
        `);
        
        console.log('✅ Indexes created successfully');
        
    } catch (error) {
        console.error('❌ Error creating table:', error);
        throw error;
        
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Run if executed directly
if (require.main === module) {
    createTable()
        .then(() => {
            console.log('✨ Migration completed successfully');
            process.exit(0);
        })
        .catch(err => {
            console.error('Failed to create table:', err);
            process.exit(1);
        });
}

module.exports = { createTable };