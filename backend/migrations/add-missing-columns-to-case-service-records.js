/**
 * Add missing columns to case_service_records table
 * These columns are needed for BlockServed recipient portal
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function addMissingColumns() {
    console.log('Adding missing columns to case_service_records table...');
    console.log('Connecting to database...');
    
    try {
        // Test connection first
        const testResult = await pool.query('SELECT NOW()');
        console.log('✅ Connected to database at:', testResult.rows[0].now);
        
        // Add server_name column
        try {
            await pool.query(`
                ALTER TABLE case_service_records 
                ADD COLUMN IF NOT EXISTS server_name VARCHAR(255)
            `);
            console.log('✅ Added server_name column');
        } catch (e) {
            if (e.code === '42701') {
                console.log('ℹ️ server_name column already exists');
            } else {
                throw e;
            }
        }
        
        // Add issuing_agency column
        try {
            await pool.query(`
                ALTER TABLE case_service_records 
                ADD COLUMN IF NOT EXISTS issuing_agency VARCHAR(255)
            `);
            console.log('✅ Added issuing_agency column');
        } catch (e) {
            if (e.code === '42701') {
                console.log('ℹ️ issuing_agency column already exists');
            } else {
                throw e;
            }
        }
        
        // Add page_count column
        try {
            await pool.query(`
                ALTER TABLE case_service_records 
                ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1
            `);
            console.log('✅ Added page_count column');
        } catch (e) {
            if (e.code === '42701') {
                console.log('ℹ️ page_count column already exists');
            } else {
                throw e;
            }
        }
        
        // Add status column
        try {
            await pool.query(`
                ALTER TABLE case_service_records 
                ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'served'
            `);
            console.log('✅ Added status column');
        } catch (e) {
            if (e.code === '42701') {
                console.log('ℹ️ status column already exists');
            } else {
                throw e;
            }
        }
        
        // Update existing records with default values
        console.log('Setting default values for existing records...');
        
        try {
            const updateResult = await pool.query(`
                UPDATE case_service_records
                SET 
                    server_name = COALESCE(server_name, 'Process Server'),
                    issuing_agency = COALESCE(issuing_agency, 'Fort Lauderdale Police'),
                    page_count = COALESCE(page_count, 1),
                    status = COALESCE(status, 'served')
                WHERE server_name IS NULL 
                   OR issuing_agency IS NULL
                   OR page_count IS NULL
                   OR status IS NULL
            `);
            
            console.log(`✅ Updated ${updateResult.rowCount} existing records with defaults`);
        } catch (e) {
            console.log('⚠️ Could not update existing records:', e.message);
        }
        
        // Show current table structure
        const tableInfo = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'case_service_records'
            ORDER BY ordinal_position
        `);
        
        console.log('\n📊 Current case_service_records table structure:');
        tableInfo.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
        });
        
        console.log('\n✅ Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Error adding columns:', error);
    } finally {
        await pool.end();
    }
}

// Run the migration
addMissingColumns();