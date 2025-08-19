#!/usr/bin/env node

/**
 * Fix document_storage table schema
 * Ensures all required columns exist
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require'
});

async function fixDocumentStorageTable() {
    console.log('🔧 Fixing document_storage table schema...\n');
    
    try {
        // First check if table exists
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'document_storage'
            );
        `);
        
        if (tableExists.rows[0].exists) {
            console.log('✅ Table exists, checking columns...');
            
            // Get current columns
            const columns = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'document_storage'
            `);
            
            const existingColumns = columns.rows.map(r => r.column_name);
            console.log('Existing columns:', existingColumns);
            
            // Add missing columns
            const requiredColumns = {
                'case_number': 'VARCHAR(255)',
                'server_address': 'VARCHAR(255)',
                'recipient_address': 'VARCHAR(255)',
                'file_name': 'VARCHAR(255)',
                'file_path': 'TEXT',
                'file_size': 'BIGINT',
                'file_type': 'VARCHAR(100)',
                'disk_filename': 'VARCHAR(255)',
                'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            };
            
            for (const [col, type] of Object.entries(requiredColumns)) {
                if (!existingColumns.includes(col)) {
                    console.log(`Adding column: ${col} ${type}`);
                    try {
                        await pool.query(`ALTER TABLE document_storage ADD COLUMN ${col} ${type}`);
                        console.log(`✅ Added ${col}`);
                    } catch (err) {
                        if (err.message.includes('already exists')) {
                            console.log(`Column ${col} already exists`);
                        } else {
                            console.error(`Failed to add ${col}:`, err.message);
                        }
                    }
                }
            }
            
            // Make server_address NOT NULL if it isn't already
            try {
                await pool.query(`ALTER TABLE document_storage ALTER COLUMN server_address SET NOT NULL`);
            } catch (err) {
                // Column might already be NOT NULL
            }
            
            // Make disk_filename NOT NULL if it isn't already
            try {
                await pool.query(`ALTER TABLE document_storage ALTER COLUMN disk_filename SET NOT NULL`);
            } catch (err) {
                // Column might already be NOT NULL
            }
            
        } else {
            console.log('Creating new document_storage table...');
            
            // Create the table with all columns
            await pool.query(`
                CREATE TABLE document_storage (
                    id SERIAL PRIMARY KEY,
                    notice_id VARCHAR(255) UNIQUE NOT NULL,
                    case_number VARCHAR(255),
                    server_address VARCHAR(255) NOT NULL,
                    recipient_address VARCHAR(255),
                    file_name VARCHAR(255),
                    file_path TEXT NOT NULL,
                    file_size BIGINT,
                    file_type VARCHAR(100),
                    disk_filename VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            console.log('✅ Table created');
        }
        
        // Create indexes
        console.log('\nCreating indexes...');
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_doc_storage_notice_id ON document_storage(notice_id)',
            'CREATE INDEX IF NOT EXISTS idx_doc_storage_server_address ON document_storage(server_address)',
            'CREATE INDEX IF NOT EXISTS idx_doc_storage_recipient_address ON document_storage(recipient_address)'
        ];
        
        for (const index of indexes) {
            try {
                await pool.query(index);
                console.log(`✅ Index created/verified`);
            } catch (err) {
                console.log(`Index might already exist: ${err.message}`);
            }
        }
        
        // Show final table structure
        const finalColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'document_storage'
            ORDER BY ordinal_position
        `);
        
        console.log('\n📋 Final table structure:');
        console.log('Column Name          | Type          | Nullable');
        console.log('-'.repeat(50));
        finalColumns.rows.forEach(col => {
            console.log(`${col.column_name.padEnd(20)} | ${col.data_type.padEnd(13)} | ${col.is_nullable}`);
        });
        
        console.log('\n✅ document_storage table is ready!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

// Run the migration
fixDocumentStorageTable().catch(console.error);