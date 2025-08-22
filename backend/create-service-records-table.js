/**
 * Create case_service_records table
 * Run this to set up the database table for storing service data
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function createTable() {
    try {
        console.log('Creating case_service_records table...');
        
        // Drop existing table if needed (be careful!)
        // await pool.query('DROP TABLE IF EXISTS case_service_records');
        
        // Create the table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS case_service_records (
                id SERIAL PRIMARY KEY,
                case_id INTEGER,
                case_number VARCHAR(255),
                transaction_hash VARCHAR(255),
                alert_token_id VARCHAR(255),
                document_token_id VARCHAR(255),
                ipfs_hash VARCHAR(255),
                encryption_key TEXT,
                recipients JSONB,
                page_count INTEGER DEFAULT 1,
                served_at TIMESTAMP,
                server_address VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        console.log('✅ Table created successfully');
        
        // Try to add unique index
        await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS case_service_records_case_number_unique 
            ON case_service_records(case_number)
        `).catch(err => console.log('Index might already exist:', err.message));
        
        // Check if table was created
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'case_service_records'
            ORDER BY ordinal_position
        `);
        
        console.log('\nTable columns:');
        result.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });
        
    } catch (error) {
        console.error('Error creating table:', error);
    } finally {
        await pool.end();
    }
}

createTable();