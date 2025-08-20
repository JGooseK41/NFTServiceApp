/**
 * Database Cleanup and Setup Script
 * Cleans up redundant tables and sets up required ones
 * 
 * Usage in Render Shell:
 * node database-cleanup-and-setup.js
 */

const { Pool } = require('pg');

async function cleanupAndSetup() {
    console.log('🧹 DATABASE CLEANUP AND SETUP');
    console.log('='.repeat(60));
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
    });

    try {
        // Test connection
        await pool.query('SELECT NOW()');
        console.log('✅ Database connected\n');

        // STEP 1: Create missing required tables
        console.log('📋 STEP 1: Creating Required Tables');
        console.log('-'.repeat(60));
        
        // Create simple_images table for basic image storage
        console.log('Creating simple_images table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS simple_images (
                id SERIAL PRIMARY KEY,
                notice_id VARCHAR(255) NOT NULL,
                image_type VARCHAR(50) NOT NULL,
                image_data TEXT NOT NULL,
                thumbnail_data TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(notice_id, image_type)
            )
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_simple_images_notice ON simple_images(notice_id)');
        console.log('✅ simple_images table created');

        // Create case management tables
        console.log('\nCreating prepared_cases table...');
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

        console.log('Creating case_documents table...');
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
        await pool.query('CREATE INDEX IF NOT EXISTS idx_case_documents_case ON case_documents(case_id)');
        console.log('✅ case_documents table created');

        // STEP 2: Identify unused tables
        console.log('\n📋 STEP 2: Analyzing Table Usage');
        console.log('-'.repeat(60));
        
        const unusedTables = [
            'active_notices',           // 0 rows - not used
            'document_access_log',       // 0 rows - not used
            'document_access_tokens',    // 0 rows - not used
            'draft_files',              // 0 rows - not used
            'notice_acceptances',        // 0 rows - not used
            'notice_events',            // 0 rows - not used
            'pending_notices',          // 0 rows - not used
            'prepared_transactions',     // 0 rows - staging table not used
            'server_ratings',           // 0 rows - not used
            'staged_files',             // 0 rows - staging table not used
            'staged_ipfs',              // 0 rows - staging table not used
            'transaction_hashes',       // 0 rows - not used
            'access_attempts'           // 0 rows - not used
        ];

        console.log('Tables with 0 rows (candidates for removal):');
        for (const table of unusedTables) {
            console.log(`  - ${table}`);
        }

        // STEP 3: Identify tables to keep
        console.log('\n📋 STEP 3: Tables to Keep (Have Data)');
        console.log('-'.repeat(60));
        
        const importantTables = {
            'audit_logs': '8222 rows - Keep for audit trail',
            'batch_uploads': '14 rows - Keep for batch processing',
            'blockchain_cache': '26 rows - Keep for blockchain data',
            'document_storage': '13 rows - Keep existing documents',
            'images': '11 rows - Keep existing images',
            'notice_batch_items': '46 rows - Keep batch items',
            'notice_components': '51 rows - Main notice data',
            'notice_drafts': '4 rows - Keep drafts',
            'notice_views': '18 rows - Keep view tracking',
            'process_servers': '2 rows - Keep server registrations',
            'served_notices': '64 rows - Main served notices table',
            'staged_energy_estimates': '12 rows - Keep energy estimates',
            'staged_notices': '12 rows - Keep staged notices',
            'staged_recipients': '36 rows - Keep recipient staging',
            'staged_transactions': '12 rows - Keep transaction staging',
            'wallet_connections': '1075 rows - Keep connection logs'
        };

        console.log('Important tables with data:');
        for (const [table, info] of Object.entries(importantTables)) {
            console.log(`  ✅ ${table}: ${info}`);
        }

        // STEP 4: Show cleanup recommendation
        console.log('\n📋 STEP 4: Cleanup Recommendations');
        console.log('-'.repeat(60));
        console.log('\n⚠️  RECOMMENDED ACTIONS:');
        console.log('\n1. Run the following to DROP unused tables (0 rows):');
        console.log('   (Copy and paste these commands if you want to clean up)\n');

        for (const table of unusedTables) {
            console.log(`   DROP TABLE IF EXISTS ${table} CASCADE;`);
        }

        console.log('\n2. Consolidate image storage:');
        console.log('   - Use "simple_images" for quick image retrieval');
        console.log('   - Use "document_storage" for full documents');
        console.log('   - Phase out "images" table gradually');

        console.log('\n3. Main workflow tables:');
        console.log('   - served_notices: Main record of served notices');
        console.log('   - notice_components: Detailed notice data');
        console.log('   - prepared_cases + case_documents: 2-stage workflow');
        console.log('   - simple_images: Quick image access');

        // STEP 5: Verify new tables
        console.log('\n📋 STEP 5: Verifying New Tables');
        console.log('-'.repeat(60));
        
        const newTables = await pool.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE tablename IN ('simple_images', 'prepared_cases', 'case_documents')
            AND schemaname = 'public'
        `);
        
        console.log('✅ Successfully created tables:');
        newTables.rows.forEach(t => console.log(`   - ${t.tablename}`));

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('\n' + '='.repeat(60));
        console.log('SETUP COMPLETE');
        console.log('='.repeat(60));
        console.log('\nNext steps:');
        console.log('1. Review the cleanup recommendations above');
        console.log('2. Run the DROP commands if you want to remove unused tables');
        console.log('3. Your app is now ready with:');
        console.log('   - simple_images table for image storage');
        console.log('   - prepared_cases tables for 2-stage workflow');
        console.log('   - All existing data preserved\n');
    }
}

// Run the cleanup
cleanupAndSetup()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Setup failed:', error);
        process.exit(1);
    });