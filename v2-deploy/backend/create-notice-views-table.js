/**
 * Create notice_views table for tracking view-only access
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db',
    ssl: { rejectUnauthorized: false }
});

async function createNoticeViewsTable() {
    try {
        console.log('Creating notice_views table...');
        
        // Create the table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notice_views (
                id SERIAL PRIMARY KEY,
                notice_id VARCHAR(255) NOT NULL,
                document_id VARCHAR(255),
                viewer_address VARCHAR(255) NOT NULL,
                view_type VARCHAR(50) NOT NULL,
                viewed_at TIMESTAMP NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ Table created successfully');
        
        // Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_notice_views_notice_id ON notice_views(notice_id);
            CREATE INDEX IF NOT EXISTS idx_notice_views_viewer ON notice_views(viewer_address);
        `);
        
        console.log('✅ Indexes created successfully');
        
        // Add columns to notice_components if they don't exist
        await pool.query(`
            ALTER TABLE notice_components 
            ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
        `);
        
        console.log('✅ Additional columns added to notice_components');
        
        console.log('\n✅ All database updates completed successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

createNoticeViewsTable();