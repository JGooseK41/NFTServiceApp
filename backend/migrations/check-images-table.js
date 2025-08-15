/**
 * Check if images table exists and create it if not
 */

const { Client } = require('pg');
require('dotenv').config();

async function checkAndCreateImagesTable() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') 
            ? { rejectUnauthorized: false } 
            : false,
        connectionTimeoutMillis: 10000
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Check if table exists
        const checkResult = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'images'
            );
        `);

        if (checkResult.rows[0].exists) {
            console.log('✅ Images table already exists');
            
            // Get table structure
            const structure = await client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'images'
                ORDER BY ordinal_position;
            `);
            
            console.log('\nTable structure:');
            console.table(structure.rows);
        } else {
            console.log('Images table does not exist, creating...');
            
            // Create table
            await client.query(`
                CREATE TABLE images (
                    id SERIAL PRIMARY KEY,
                    notice_id VARCHAR(255) NOT NULL,
                    server_address VARCHAR(255) NOT NULL,
                    recipient_address VARCHAR(255) NOT NULL,
                    alert_image TEXT,
                    document_image TEXT,
                    alert_thumbnail TEXT,
                    document_thumbnail TEXT,
                    transaction_hash VARCHAR(255),
                    case_number VARCHAR(255),
                    signature_status VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            
            // Create indexes
            await client.query('CREATE INDEX idx_images_notice_id ON images(notice_id);');
            await client.query('CREATE INDEX idx_images_server_address ON images(server_address);');
            await client.query('CREATE INDEX idx_images_recipient_address ON images(recipient_address);');
            await client.query('CREATE INDEX idx_images_transaction_hash ON images(transaction_hash);');
            
            console.log('✅ Images table created successfully');
        }

    } catch (error) {
        console.error('Error:', error.message);
        
        // If connection failed, table operations will use fallback
        if (error.message.includes('Connection') || error.message.includes('timeout')) {
            console.log('\n⚠️ Could not connect to database');
            console.log('The application will use fallback to existing tables (notice_components, served_notices)');
            console.log('This is fine - the simple-images API already has fallback logic built in.');
        }
    } finally {
        await client.end();
    }
}

// Run if called directly
if (require.main === module) {
    checkAndCreateImagesTable();
}

module.exports = checkAndCreateImagesTable;