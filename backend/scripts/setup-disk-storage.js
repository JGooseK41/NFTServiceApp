#!/usr/bin/env node

/**
 * Setup Script for PDF Disk Storage on Render
 * Run this to ensure upload directories exist
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

async function setupDiskStorage() {
    console.log('🚀 Setting up PDF Disk Storage on Render...\n');
    
    try {
        // 1. Create upload directories
        const dirs = [
            path.join(__dirname, '../uploads'),
            path.join(__dirname, '../uploads/pdfs'),
            path.join(__dirname, '../uploads/documents'),
            path.join(__dirname, '../uploads/thumbnails')
        ];
        
        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
                console.log(`✅ Created directory: ${dir}`);
                
                // Set permissions
                await fs.chmod(dir, 0o755);
                console.log(`   Set permissions to 755`);
            } catch (error) {
                console.log(`⚠️  Directory might already exist: ${dir}`);
            }
        }
        
        // 2. Create database table if needed
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
        });
        
        console.log('\n📊 Creating document_storage table...');
        
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS document_storage (
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
            console.log('✅ Table document_storage ready');
            
            // Create indexes
            await pool.query('CREATE INDEX IF NOT EXISTS idx_doc_storage_notice_id ON document_storage(notice_id)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_doc_storage_server_address ON document_storage(server_address)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_doc_storage_recipient_address ON document_storage(recipient_address)');
            console.log('✅ Indexes created');
            
        } catch (error) {
            console.log('⚠️  Table might already exist:', error.message);
        }
        
        await pool.end();
        
        // 3. Test write permissions
        console.log('\n🧪 Testing write permissions...');
        const testFile = path.join(__dirname, '../uploads/pdfs/test.txt');
        try {
            await fs.writeFile(testFile, 'PDF Disk Storage Test');
            console.log('✅ Write test successful');
            await fs.unlink(testFile);
            console.log('✅ Cleanup successful');
        } catch (error) {
            console.error('❌ Write test failed:', error.message);
            console.log('   You may need to check Render disk permissions');
        }
        
        console.log('\n✨ Setup complete! PDF Disk Storage is ready.');
        console.log('📝 PDFs will be stored in: /uploads/pdfs/');
        console.log('🖼️  Thumbnails remain as Base64 in database');
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    setupDiskStorage().catch(console.error);
}

module.exports = { setupDiskStorage };