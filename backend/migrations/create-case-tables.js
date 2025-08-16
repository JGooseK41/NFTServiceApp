/**
 * Database Migration: Create Case Tables
 * For 2-stage case preparation workflow
 */

const { Pool } = require('pg');

async function createCaseTables() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('Creating case management tables...');

        // Create prepared_cases table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS prepared_cases (
                id SERIAL PRIMARY KEY,
                case_number VARCHAR(255) NOT NULL,
                case_title VARCHAR(500),
                notice_type VARCHAR(100) DEFAULT 'Legal Notice',
                issuing_agency VARCHAR(255),
                server_address VARCHAR(42) NOT NULL,
                status VARCHAR(50) DEFAULT 'preparing',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(case_number, server_address)
            )
        `);
        console.log('✅ Created prepared_cases table');

        // Create case_documents table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS case_documents (
                id SERIAL PRIMARY KEY,
                case_id INTEGER NOT NULL REFERENCES prepared_cases(id) ON DELETE CASCADE,
                alert_image TEXT,
                alert_thumbnail TEXT,
                document_image TEXT,
                document_thumbnail TEXT,
                page_count INTEGER DEFAULT 1,
                file_names TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(case_id)
            )
        `);
        console.log('✅ Created case_documents table');

        // Create indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_prepared_cases_server ON prepared_cases(server_address)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_prepared_cases_status ON prepared_cases(status)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_case_documents_case ON case_documents(case_id)');
        console.log('✅ Created indexes');

        console.log('✅ Case management tables ready');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run migration if called directly
if (require.main === module) {
    createCaseTables()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = createCaseTables;