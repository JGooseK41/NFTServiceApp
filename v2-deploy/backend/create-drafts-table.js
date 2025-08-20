/**
 * Create drafts table for saving NFT creation progress
 * Allows users to save and resume their work
 */

const { Pool } = require('pg');

async function createDraftsTable() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });
    
    let client;
    
    try {
        client = await pool.connect();
        
        console.log('🏗️  Creating drafts table...\n');
        
        // Create drafts table
        console.log('Creating notice_drafts table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS notice_drafts (
                draft_id VARCHAR(255) PRIMARY KEY,
                draft_name VARCHAR(500) NOT NULL,
                server_address VARCHAR(255) NOT NULL,
                notice_type VARCHAR(255),
                case_number VARCHAR(255),
                issuing_agency VARCHAR(255),
                public_text TEXT,
                case_details TEXT,
                legal_rights TEXT,
                recipients JSONB,
                token_name VARCHAR(255),
                delivery_method VARCHAR(50),
                sponsor_fees BOOLEAN DEFAULT false,
                thumbnail_data TEXT,
                document_data TEXT,
                encrypted_document_data TEXT,
                ipfs_hash VARCHAR(255),
                encrypted_ipfs VARCHAR(255),
                encryption_key VARCHAR(500),
                metadata_uri VARCHAR(500),
                custom_fields JSONB,
                status VARCHAR(50) DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                last_accessed TIMESTAMP DEFAULT NOW(),
                CONSTRAINT valid_draft_status CHECK (status IN ('draft', 'staged', 'executed', 'archived'))
            )
        `);
        console.log('✅ notice_drafts created\n');
        
        // Create draft files table for storing file references
        console.log('Creating draft_files table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS draft_files (
                file_id SERIAL PRIMARY KEY,
                draft_id VARCHAR(255) REFERENCES notice_drafts(draft_id) ON DELETE CASCADE,
                file_type VARCHAR(50) NOT NULL,
                file_name VARCHAR(500),
                file_path VARCHAR(500),
                file_size BIGINT,
                mime_type VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT valid_file_type CHECK (file_type IN ('thumbnail', 'document', 'encrypted_document', 'attachment'))
            )
        `);
        console.log('✅ draft_files created\n');
        
        // Create indexes
        console.log('Creating indexes...');
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_drafts_server 
            ON notice_drafts(server_address)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_drafts_status 
            ON notice_drafts(status)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_drafts_created 
            ON notice_drafts(created_at DESC)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_drafts_accessed 
            ON notice_drafts(last_accessed DESC)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_draft_files_draft 
            ON draft_files(draft_id)
        `);
        
        console.log('✅ All indexes created\n');
        
        // Create auto-archive function for old drafts
        console.log('Creating auto-archive function...');
        await client.query(`
            CREATE OR REPLACE FUNCTION auto_archive_old_drafts()
            RETURNS INTEGER AS $$
            DECLARE
                archived_count INTEGER;
            BEGIN
                UPDATE notice_drafts
                SET status = 'archived'
                WHERE status = 'draft'
                AND last_accessed < NOW() - INTERVAL '30 days';
                
                GET DIAGNOSTICS archived_count = ROW_COUNT;
                RETURN archived_count;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ Auto-archive function created\n');
        
        console.log('✨ Drafts tables created successfully!');
        
    } catch (error) {
        console.error('❌ Error creating drafts table:', error);
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
    createDraftsTable()
        .then(() => {
            console.log('\n🎉 Drafts table migration completed successfully');
            process.exit(0);
        })
        .catch(err => {
            console.error('Failed to create drafts table:', err);
            process.exit(1);
        });
}

module.exports = { createDraftsTable };