/**
 * Run Alert Metadata Migration
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') 
        ? { rejectUnauthorized: false }
        : false
});

async function runMigration() {
    try {
        console.log('Running alert metadata migration...');
        
        // Read migration SQL
        const migrationPath = path.join(__dirname, 'migrations', 'alert-metadata-table.sql');
        const sql = await fs.readFile(migrationPath, 'utf8');
        
        // Execute migration
        await pool.query(sql);
        
        console.log('✅ Alert metadata table created successfully');
        
        // Check if table was created
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'alert_metadata'
            );
        `);
        
        if (tableCheck.rows[0].exists) {
            console.log('✅ Verified: alert_metadata table exists');
            
            // Check columns
            const columns = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'alert_metadata'
                ORDER BY ordinal_position;
            `);
            
            console.log('Table columns:');
            columns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type}`);
            });
        }
        
        console.log('\n✅ Migration complete!');
        
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();