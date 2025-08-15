/**
 * Production Migration: Create Images Table
 * Run this directly on Render to create the images table
 */

const { Client } = require('pg');

async function createImagesTable() {
    // Use the production DATABASE_URL from environment
    const connectionString = process.env.DATABASE_URL || 
        'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db';
    
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000, // 30 seconds
        query_timeout: 60000, // 60 seconds
        statement_timeout: 60000 // 60 seconds
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('✅ Connected to database');

        // Start transaction
        await client.query('BEGIN');

        // Drop old tables if they exist
        console.log('Dropping old unused tables if they exist...');
        await client.query('DROP TABLE IF EXISTS notice_images CASCADE;');
        await client.query('DROP TABLE IF EXISTS document_images CASCADE;');
        await client.query('DROP TABLE IF EXISTS image_metadata CASCADE;');
        console.log('✅ Cleaned up old tables');

        // Create the images table
        console.log('Creating images table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS images (
                id SERIAL PRIMARY KEY,
                notice_id VARCHAR(255) NOT NULL UNIQUE,
                server_address VARCHAR(255) NOT NULL,
                recipient_address VARCHAR(255) NOT NULL,
                alert_image TEXT,
                document_image TEXT,
                alert_thumbnail TEXT,
                document_thumbnail TEXT,
                transaction_hash VARCHAR(255),
                case_number VARCHAR(255),
                signature_status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Images table created');

        // Create indexes
        console.log('Creating indexes...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_images_notice_id ON images(notice_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_images_server_address ON images(server_address);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_images_recipient_address ON images(recipient_address);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_images_transaction_hash ON images(transaction_hash);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_images_case_number ON images(case_number);');
        console.log('✅ Indexes created');

        // Create update trigger for updated_at
        console.log('Creating update trigger...');
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);

        await client.query(`
            DROP TRIGGER IF EXISTS update_images_updated_at ON images;
        `);

        await client.query(`
            CREATE TRIGGER update_images_updated_at 
            BEFORE UPDATE ON images 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
        `);
        console.log('✅ Update trigger created');

        // Commit transaction
        await client.query('COMMIT');
        console.log('✅ Transaction committed');

        // Verify table structure
        const columns = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'images'
            ORDER BY ordinal_position;
        `);

        console.log('\n📋 Table Structure:');
        console.table(columns.rows);

        // Check if table is empty
        const count = await client.query('SELECT COUNT(*) FROM images;');
        console.log(`\n📊 Table has ${count.rows[0].count} records`);

        // Optionally migrate some data from notice_components
        console.log('\n🔄 Checking for data to migrate from notice_components...');
        const recentNotices = await client.query(`
            SELECT 
                nc.notice_id,
                nc.alert_id,
                nc.server_address,
                nc.recipient_address,
                nc.alert_thumbnail_url,
                nc.document_unencrypted_url,
                nc.case_number,
                nc.created_at
            FROM notice_components nc
            WHERE nc.created_at > NOW() - INTERVAL '7 days'
            AND nc.alert_thumbnail_url IS NOT NULL
            LIMIT 10;
        `);

        if (recentNotices.rows.length > 0) {
            console.log(`Found ${recentNotices.rows.length} recent notices to migrate`);
            
            for (const notice of recentNotices.rows) {
                try {
                    await client.query(`
                        INSERT INTO images (
                            notice_id, server_address, recipient_address,
                            alert_image, document_image, case_number, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (notice_id) DO NOTHING;
                    `, [
                        notice.alert_id || notice.notice_id,
                        notice.server_address,
                        notice.recipient_address,
                        notice.alert_thumbnail_url,
                        notice.document_unencrypted_url,
                        notice.case_number,
                        notice.created_at
                    ]);
                    console.log(`✅ Migrated notice ${notice.alert_id || notice.notice_id}`);
                } catch (e) {
                    console.log(`⚠️ Skipped notice ${notice.alert_id || notice.notice_id}: ${e.message}`);
                }
            }
        } else {
            console.log('No recent notices to migrate');
        }

        console.log('\n✅ ✅ ✅ Images table successfully created and ready to use! ✅ ✅ ✅');

    } catch (error) {
        console.error('\n❌ Error creating images table:', error);
        
        // Rollback on error
        try {
            await client.query('ROLLBACK');
            console.log('Transaction rolled back');
        } catch (rollbackError) {
            console.error('Rollback error:', rollbackError);
        }
        
        throw error;
    } finally {
        await client.end();
        console.log('\nDatabase connection closed');
    }
}

// Run the migration
if (require.main === module) {
    createImagesTable()
        .then(() => {
            console.log('\n✅ Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration failed:', error.message);
            process.exit(1);
        });
}

module.exports = createImagesTable;