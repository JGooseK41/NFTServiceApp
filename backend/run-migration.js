const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('🔄 Running database migration...');
        
        // Read the migration SQL file
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'migrations', 'add_missing_columns.sql'),
            'utf8'
        );

        // Execute the migration
        await pool.query(migrationSQL);
        
        console.log('✅ Migration completed successfully!');
        
        // Verify the changes
        console.log('\n📊 Verifying database structure...');
        
        // Check served_notices columns
        const columnsResult = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'served_notices'
            ORDER BY ordinal_position;
        `);
        
        console.log('\nserved_notices columns:');
        columnsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });
        
        // Check if case 34-987654 exists
        const caseResult = await pool.query(
            "SELECT * FROM served_notices WHERE case_number = '34-987654'"
        );
        
        if (caseResult.rows.length > 0) {
            console.log('\n✅ Case 34-987654 found in database:');
            console.log(JSON.stringify(caseResult.rows[0], null, 2));
        } else {
            console.log('\n❌ Case 34-987654 not found in database');
        }
        
        // Check all tables
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);
        
        console.log('\nAll tables in database:');
        tablesResult.rows.forEach(table => {
            console.log(`  - ${table.table_name}`);
        });
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.error('Error details:', error.message);
    } finally {
        await pool.end();
    }
}

// Run the migration
runMigration();