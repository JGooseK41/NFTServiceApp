/**
 * Simple Images Table Migration
 * Creates a straightforward table for storing notice images
 */

const { Client } = require('pg');
require('dotenv').config();

async function createSimpleImagesTable() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Drop the old complex tables if they exist
        console.log('Cleaning up old tables...');
        await client.query(`
            DROP TABLE IF EXISTS notice_images CASCADE;
            DROP TABLE IF EXISTS document_images CASCADE;
            DROP TABLE IF EXISTS image_metadata CASCADE;
        `);

        // Create simple images table
        console.log('Creating simple images table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS images (
                id SERIAL PRIMARY KEY,
                notice_id VARCHAR(255) NOT NULL,
                server_address VARCHAR(255) NOT NULL,
                recipient_address VARCHAR(255) NOT NULL,
                alert_image TEXT,
                document_image TEXT,
                alert_thumbnail TEXT,
                document_thumbnail TEXT,
                transaction_hash VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                -- Indexes for fast lookups
                INDEX idx_notice_id (notice_id),
                INDEX idx_server_address (server_address),
                INDEX idx_recipient_address (recipient_address),
                INDEX idx_transaction_hash (transaction_hash)
            );
        `);

        // Create a simple function to update the updated_at timestamp
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);

        // Add trigger for updated_at
        await client.query(`
            CREATE TRIGGER update_images_updated_at 
            BEFORE UPDATE ON images 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
        `);

        console.log('✅ Simple images table created successfully');

        // Show table structure
        const result = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'images'
            ORDER BY ordinal_position;
        `);

        console.log('\nTable structure:');
        console.table(result.rows);

    } catch (error) {
        console.error('Error creating images table:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Run if called directly
if (require.main === module) {
    createSimpleImagesTable();
}

module.exports = createSimpleImagesTable;