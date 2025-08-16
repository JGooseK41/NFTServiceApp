/**
 * Run Case Tables Migration
 * Execute this in Render shell to create the case management tables
 * 
 * Usage in Render Shell:
 * node run-case-migration.js
 */

const { Pool } = require('pg');

async function runMigration() {
    console.log('🚀 Starting Case Management Tables Migration...');
    console.log('Database:', process.env.DATABASE_URL ? 'Connected' : 'Missing DATABASE_URL');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
    });

    try {
        // Test connection
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful');

        console.log('\n📋 Creating prepared_cases table...');
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
        console.log('✅ prepared_cases table created');

        console.log('\n📋 Creating case_documents table...');
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
        console.log('✅ case_documents table created');

        console.log('\n🔍 Creating indexes...');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_prepared_cases_server ON prepared_cases(server_address)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_prepared_cases_status ON prepared_cases(status)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_case_documents_case ON case_documents(case_id)');
        console.log('✅ Indexes created');

        // Verify tables exist
        console.log('\n🔍 Verifying tables...');
        const tables = await pool.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE tablename IN ('prepared_cases', 'case_documents')
            AND schemaname = 'public'
        `);
        
        console.log('Found tables:', tables.rows.map(r => r.tablename).join(', '));
        
        if (tables.rows.length === 2) {
            console.log('\n✅ SUCCESS! All tables created successfully');
            
            // Show table structure
            console.log('\n📊 Table Structure:');
            const caseColumns = await pool.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_name = 'prepared_cases'
                ORDER BY ordinal_position
            `);
            console.log('\nprepared_cases columns:');
            caseColumns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
            });
            
            const docColumns = await pool.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_name = 'case_documents'
                ORDER BY ordinal_position
            `);
            console.log('\ncase_documents columns:');
            docColumns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
            });
        } else {
            console.error('⚠️ Warning: Not all tables were created');
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('Error details:', error);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the migration
console.log('='.repeat(60));
console.log('CASE MANAGEMENT TABLES MIGRATION');
console.log('='.repeat(60));

runMigration()
    .then(() => {
        console.log('\n' + '='.repeat(60));
        console.log('MIGRATION COMPLETED SUCCESSFULLY! 🎉');
        console.log('='.repeat(60));
        console.log('\nYour 2-stage workflow is ready to use:');
        console.log('1. Upload documents in Create tab');
        console.log('2. Click "Prepare Case (No Cost)"');
        console.log('3. View prepared cases in "Prepared Cases" tab');
        console.log('4. Mint NFTs when ready\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n' + '='.repeat(60));
        console.error('MIGRATION FAILED! ❌');
        console.error('='.repeat(60));
        console.error('Error:', error.message);
        process.exit(1);
    });